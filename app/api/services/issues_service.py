import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, List
from uuid import uuid4

from common.logger import get_logger
from common.models import DismissalFeedbackModel, Issue, IssueStatusEnum, ModifiedFieldsModel, ReviewRule
from config.config import settings
from database.issues_repository import IssuesRepository
from security.auth import User
from services.hitl_agent import HitlIssuesAgent
from services.lc_pipeline import LangChainPipeline
from services.review_docx_exporter import export_review_docx

logging = get_logger(__name__)


class IssuesService:
    def __init__(self, issues_repository: IssuesRepository, pipeline: LangChainPipeline) -> None:
        self.pipeline = pipeline
        self.issues_repository = issues_repository
        self.hitl = HitlIssuesAgent(model=self.pipeline.llm, issues_repository=self.issues_repository)
        # Guards to avoid duplicate expensive review runs.
        self._review_guard_lock = asyncio.Lock()
        self._active_reviews: set[str] = set()
        self._reviewed_empty: set[str] = set()

    async def clear_review_cache(self, doc_id: str) -> None:
        """Clear in-memory review markers for this document (used by force re-review)."""
        async with self._review_guard_lock:
            self._reviewed_empty.discard(doc_id)

    async def is_review_active(self, doc_id: str) -> bool:
        async with self._review_guard_lock:
            return doc_id in self._active_reviews

    async def _try_start_review(self, doc_id: str, force: bool) -> bool:
        async with self._review_guard_lock:
            if force:
                self._reviewed_empty.discard(doc_id)
            if doc_id in self._active_reviews:
                return False
            if not force and doc_id in self._reviewed_empty:
                return False
            self._active_reviews.add(doc_id)
            return True

    async def _finish_review(self, doc_id: str, completed: bool, produced_any_issue: bool) -> None:
        async with self._review_guard_lock:
            self._active_reviews.discard(doc_id)
            # Only mark "reviewed empty" when a run completes normally with zero issues.
            # If the run errors/cancels, do not cache empty state.
            if not completed:
                return
            if produced_any_issue:
                self._reviewed_empty.discard(doc_id)
            else:
                self._reviewed_empty.add(doc_id)

    async def get_issues_data(self, doc_id: str) -> List[Issue]:
        try:
            logging.debug(f"Retrieving document issues for {doc_id}")
            issues = await self.issues_repository.get_issues(doc_id)
            return issues
        except Exception as e:
            logging.error(f"Error retrieving PDF issues for doc_id={doc_id}: {str(e)}")
            raise e

    async def initiate_review(
        self,
        pdf_path: str,
        user: User,
        time_stamp: datetime | str,
        custom_rules: List[ReviewRule] | None = None,
        review_party: str | None = None,
        force: bool = False,
    ) -> AsyncGenerator[List[Issue], None]:
        doc_id = Path(pdf_path).name
        can_start = await self._try_start_review(doc_id, force=force)
        if not can_start:
            logging.info(
                f"Skip starting review for {doc_id}: already running or reviewed with empty result."
            )
            return

        produced_any_issue = False
        completed = False
        try:
            logging.info(f"Initiating review for document {pdf_path}")
            timestamp_iso = time_stamp.isoformat() if isinstance(time_stamp, datetime) else str(time_stamp)
            stream_data = self.pipeline.stream_issues(pdf_path, user.oid, timestamp_iso, custom_rules, review_party)
            async for issues in stream_data:
                if issues:
                    produced_any_issue = True
                    await self.issues_repository.store_issues(issues)
                    yield issues
            completed = True
        except Exception as e:
            logging.error(f"Error initiating review for document {pdf_path}: {str(e)}")
            raise
        finally:
            await self._finish_review(doc_id, completed=completed, produced_any_issue=produced_any_issue)

    async def accept_issue(
        self, issue_id: str, user: User, modified_fields: ModifiedFieldsModel | None = None
    ) -> Issue:
        try:
            update_fields = {
                "status": IssueStatusEnum.accepted.value,
                "resolved_by": user.oid,
                "resolved_at_UTC": datetime.now(timezone.utc).isoformat(),
            }

            if modified_fields:
                update_fields["modified_fields"] = modified_fields.model_dump(exclude_none=True)

            return await self.hitl.apply_update_with_hitl(
                thread_id=f"issue:{issue_id}:{uuid4()}",
                issue_id=issue_id,
                update_fields=update_fields,
            )
        except Exception as e:
            logging.error(f"Failed to accept issue {issue_id}: {e}")
            raise

    async def dismiss_issue(
        self, issue_id: str, user: User, dismissal_feedback: DismissalFeedbackModel | None = None
    ) -> Issue:
        try:
            update_fields = {
                "status": IssueStatusEnum.dismissed.value,
                "resolved_by": user.oid,
                "resolved_at_UTC": datetime.now(timezone.utc).isoformat(),
            }

            if dismissal_feedback:
                update_fields["dismissal_feedback"] = dismissal_feedback.model_dump()

            return await self.hitl.apply_update_with_hitl(
                thread_id=f"issue:{issue_id}:{uuid4()}",
                issue_id=issue_id,
                update_fields=update_fields,
            )
        except Exception as e:
            logging.error(f"Failed to dismiss issue {issue_id}: {e}")
            raise

    async def add_feedback(self, issue_id: str, feedback: DismissalFeedbackModel) -> Issue:
        try:
            return await self.hitl.apply_update_with_hitl(
                thread_id=f"issue:{issue_id}:{uuid4()}",
                issue_id=issue_id,
                update_fields={"dismissal_feedback": feedback.model_dump(exclude_none=True)},
            )
        except Exception as e:
            logging.error(f"Failed to provide feedback on issue {issue_id}: {e}")
            raise

    async def export_reviewed_docx(self, doc_id: str, accepted_only: bool = True) -> Path:
        source = Path(settings.local_docs_dir) / doc_id
        if not source.exists():
            raise FileNotFoundError(f"Document not found: {doc_id}")
        issues = await self.get_issues_data(doc_id)
        if not issues:
            raise ValueError("No review issues found for this document.")
        return await asyncio.to_thread(export_review_docx, source, issues, accepted_only)
