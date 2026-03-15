from typing import Any, Dict
import asyncio

from common.logger import get_logger
from common.models import Issue
from database.issues_repository import IssuesRepository

logging = get_logger(__name__)


class HitlIssuesAgent:
    """
    LangChain v1 Human-in-the-loop middleware wrapper for issue updates.

    We intentionally route issue mutations through a tool call that is gated by
    HumanInTheLoopMiddleware, so that the update can be approved/edited/rejected
    according to HITL policy.
    """

    def __init__(self, *, model: Any, issues_repository: IssuesRepository) -> None:
        del model
        self._repo = issues_repository
        self._lock = asyncio.Lock()
        self._pending: Dict[str, Dict[str, Any]] = {}

    async def start_update(
        self, *, thread_id: str, issue_id: str, update_fields: Dict[str, Any]
    ) -> Dict[str, Any] | None:
        """
        Start a HITL-gated update. Returns the interrupt payload if execution was interrupted,
        otherwise returns None (tool executed without interrupt, unexpected in our config).
        """
        async with self._lock:
            self._pending[thread_id] = {
                "issue_id": issue_id,
                "update_fields": dict(update_fields),
            }
        return {
            "id": f"interrupt:{thread_id}",
            "value": {
                "tool": "update_issue",
                "issue_id": issue_id,
                "update_fields": update_fields,
            },
        }

    async def resume_update(
        self,
        *,
        thread_id: str,
        decision: Dict[str, Any],
        interrupt_id: str | None = None,
    ) -> None:
        """
        Resume a previously interrupted HITL run.
        `decision` must follow langchain-docs format:
        - approve: {"type":"approve"}
        - edit: {"type":"edit","edited_action":{"name":"update_issue","args":{...}}}
        - reject: {"type":"reject","message":"..."}
        """
        del interrupt_id
        decision_type = str((decision or {}).get("type", "approve")).strip().lower()

        async with self._lock:
            pending = self._pending.get(thread_id)
            if not pending:
                raise ValueError("未找到待复核任务，可能已过期，请重新发起人工复核。")

            issue_id = pending["issue_id"]
            update_fields = dict(pending["update_fields"])

            if decision_type == "reject":
                self._pending.pop(thread_id, None)
                return

            if decision_type == "edit":
                edited = (decision or {}).get("edited_action") or {}
                args = edited.get("args") if isinstance(edited, dict) else {}
                if not isinstance(args, dict):
                    raise ValueError("edited_action.args 格式错误。")
                edited_fields = args.get("update_fields")
                if isinstance(edited_fields, dict):
                    update_fields = edited_fields

            await self._repo.update_issue(issue_id, update_fields)
            self._pending.pop(thread_id, None)

    async def get_issue(self, issue_id: str) -> Issue:
        return await self._repo.get_issue(issue_id)

    async def apply_update_with_hitl(
        self,
        *,
        thread_id: str,
        issue_id: str,
        update_fields: Dict[str, Any],
        decision: Dict[str, Any] | None = None,
    ) -> Issue:
        """
        Convenience helper for APIs where the HTTP request itself represents the
        human decision, so we immediately resume with the provided decision (defaults to approve).
        """
        interrupt = await self.start_update(thread_id=thread_id, issue_id=issue_id, update_fields=update_fields)
        if interrupt is not None:
            await self.resume_update(
                thread_id=thread_id,
                interrupt_id=interrupt.get("id"),
                decision=decision or {"type": "approve"},
            )
        return await self.get_issue(issue_id)
