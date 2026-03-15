import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { Checkmark16Regular, Dismiss16Regular, Edit16Regular, Info16Regular } from '@fluentui/react-icons'
import { useEffect, useMemo, useState } from 'react'
import { callApi } from '../services/api'
import { DismissalFeedback, Issue, IssueStatus, ModifiedFields } from '../types/issue'
import { issueRiskLevel, issueRiskTone, issueStatusLabel, issueTypeLabel, normalizeIssueStatus } from '../i18n/labels'

const useStyles = makeStyles({
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flexShrink: 0,
    minHeight: 0,
    maxHeight: 'min(58vh, 680px)',
  },
  // ========== PANEL ==========
  panel: {
    borderRadius: '10px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '8px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
  },
  // ========== HEADER ==========
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
    lineHeight: '1.35',
    display: '-webkit-box',
    WebkitLineClamp: '4',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  pageTag: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    fontFamily: 'monospace',
  },
  statusTag: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
  },
  // ========== FORM SECTION ==========
  formSection: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflowY: 'auto',
    flex: 1,
    minHeight: 'clamp(180px, 24vh, 280px)',
  },
  textareaField: {
    '& textarea': {
      backgroundColor: tokens.colorNeutralBackground2,
      minHeight: 'clamp(90px, 14vh, 160px)',
      borderTopColor: tokens.colorNeutralStroke2,
      borderRightColor: tokens.colorNeutralStroke2,
      borderBottomColor: tokens.colorNeutralStroke2,
      borderLeftColor: tokens.colorNeutralStroke2,
      borderRadius: '8px',
      '&:focus': {
        borderTopColor: tokens.colorBrandStroke1,
        borderRightColor: tokens.colorBrandStroke1,
        borderBottomColor: tokens.colorBrandStroke1,
        borderLeftColor: tokens.colorBrandStroke1,
      },
    },
  },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground2,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px',
  },
  // ========== FOOTER ==========
  footer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'nowrap',
    padding: '8px 12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  actionBtn: {
    minWidth: 'auto',
    whiteSpace: 'nowrap',
    padding: '4px 10px',
  },
  // ========== EMPTY STATE ==========
  emptyCard: {
    padding: '14px',
  },
  emptyTitle: {
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '6px',
    color: tokens.colorNeutralForeground1,
  },
  emptyDesc: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    lineHeight: '1.5',
  },
  // ========== DIALOG ==========
  dialogSurface: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px',
  },
})

function buildModifiedFields(modifiedExplanation?: string, modifiedSuggestedFix?: string): ModifiedFields | undefined {
  const modifiedFields: ModifiedFields = {}
  if (modifiedExplanation) modifiedFields.explanation = modifiedExplanation
  if (modifiedSuggestedFix) modifiedFields.suggested_fix = modifiedSuggestedFix
  return Object.keys(modifiedFields).length ? modifiedFields : undefined
}

export function IssueDetailsPanel({
  docId,
  issue,
  onUpdate,
}: {
  docId: string
  issue?: Issue
  onUpdate: (updatedIssue: Issue) => void
}) {
  const classes = useStyles()
  const [error, setError] = useState<string>()

  const [modifiedExplanation, setModifiedExplanation] = useState<string>()
  const [modifiedSuggestedFix, setModifiedSuggestedFix] = useState<string>()

  const [accepting, setAccepting] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState<DismissalFeedback>()
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  const [hitlOpen, setHitlOpen] = useState(false)
  const [hitlLoading, setHitlLoading] = useState(false)
  const [hitlThreadId, setHitlThreadId] = useState<string>()
  const [hitlInterruptId, setHitlInterruptId] = useState<string>()
  const [hitlArgsJson, setHitlArgsJson] = useState<string>('')
  const [hitlError, setHitlError] = useState<string>()
  const [guideOpen, setGuideOpen] = useState(false)

  const current = issue

  const defaults = useMemo(() => {
    if (!current) return { explanation: '', suggestedFix: '' }
    return {
      explanation: current.modified_fields?.explanation ?? current.explanation,
      suggestedFix: current.modified_fields?.suggested_fix ?? current.suggested_fix,
    }
  }, [current])

  // 🔧 修复：当 issue 变化时，重置编辑状态
  useEffect(() => {
    setModifiedExplanation(undefined)
    setModifiedSuggestedFix(undefined)
    setError(undefined)
  }, [issue?.id])

  async function handleAccept() {
    if (!current) return
    setError(undefined)
    try {
      setAccepting(true)
      const response = await callApi(
        `${docId}/issues/${current.id}/accept`,
        'PATCH',
        buildModifiedFields(modifiedExplanation, modifiedSuggestedFix),
      )
      const updatedIssue = (await response.json()) as Issue
      onUpdate(updatedIssue)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAccepting(false)
    }
  }

  async function handleDismiss() {
    if (!current) return
    setError(undefined)
    try {
      setDismissing(true)
      const response = await callApi(`${docId}/issues/${current.id}/dismiss`, 'PATCH')
      const updatedIssue = (await response.json()) as Issue
      onUpdate(updatedIssue)
      setFeedbackOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDismissing(false)
    }
  }

  async function handleSubmitFeedback() {
    if (!current) return
    setError(undefined)
    try {
      setSubmittingFeedback(true)
      await callApi(`${docId}/issues/${current.id}/feedback`, 'PATCH', feedback)
      setFeedbackOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmittingFeedback(false)
    }
  }

  async function openHitlEditDialog() {
    if (!current) return
    setHitlError(undefined)
    setHitlOpen(true)
    setHitlLoading(true)
    try {
      const response = await callApi(`${docId}/issues/${current.id}/hitl/start`, 'POST', {
        action: 'accept',
        modified_fields: buildModifiedFields(modifiedExplanation, modifiedSuggestedFix),
      })
      const payload = (await response.json()) as {
        thread_id: string
        interrupt_id?: string
        proposed_action: { name: string; args: unknown }
      }
      setHitlThreadId(payload.thread_id)
      setHitlInterruptId(payload.interrupt_id)
      setHitlArgsJson(JSON.stringify(payload.proposed_action.args, null, 2))
    } catch (e) {
      setHitlError(e instanceof Error ? e.message : String(e))
    } finally {
      setHitlLoading(false)
    }
  }

  async function runHitlDecision(decision: Record<string, unknown>) {
    if (!current) return
    if (!hitlThreadId) {
      setHitlError('缺少 thread_id，无法继续。请重新打开编辑窗口。')
      return
    }
    setHitlLoading(true)
    setHitlError(undefined)
    try {
      const response = await callApi(`${docId}/issues/${current.id}/hitl/resume`, 'POST', {
        thread_id: hitlThreadId,
        interrupt_id: hitlInterruptId,
        decision,
      })
      const updatedIssue = (await response.json()) as Issue
      onUpdate(updatedIssue)
      setHitlOpen(false)
      setHitlThreadId(undefined)
      setHitlInterruptId(undefined)
      setHitlArgsJson('')
    } catch (e) {
      setHitlError(e instanceof Error ? e.message : String(e))
    } finally {
      setHitlLoading(false)
    }
  }

  // Empty state
  if (!current) {
    return (
      <div className={classes.wrap}>
        <Card className={classes.panel}>
          <div className={classes.sectionHeader}>
            <span className={classes.sectionTitle}>问题详情</span>
            <Button
              size="small"
              appearance="subtle"
              icon={<Info16Regular />}
              onClick={() => setGuideOpen(true)}
            />
          </div>
          <div className={classes.emptyCard}>
            <div className={classes.emptyTitle}>请选择左侧问题</div>
            <div className={classes.emptyDesc}>
              选择左侧问题列表中的项目以查看详情并进行处理。
              支持采纳建议、不采纳或进行人工复核（HITL）操作。
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const normalizedStatus = normalizeIssueStatus(current.status as unknown as string)
  const editable = normalizedStatus === IssueStatus.NotReviewed

  return (
    <div className={classes.wrap}>
      {/* Issue Header Card */}
      <Card className={classes.panel}>
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTitle}>问题详情</span>
          <Button
            size="small"
            appearance="subtle"
            icon={<Info16Regular />}
            onClick={() => setGuideOpen(true)}
          />
        </div>
        <CardHeader
          header={<span className={classes.headerTitle}>{current.text}</span>}
          description={
            <div className={classes.headerMeta}>
              <Badge appearance="tint" shape="rounded" color={issueRiskTone(current.type, current.risk_level)}>
                {issueRiskLevel(current.type, current.risk_level)}风险
              </Badge>
              <Badge appearance="outline" shape="rounded" color="informative">
                {issueTypeLabel(current.type)}
              </Badge>
              <span className={classes.pageTag}>P{current.location?.page_num ?? '-'}</span>
              <span className={classes.statusTag}>{issueStatusLabel(normalizedStatus)}</span>
            </div>
          }
        />
      </Card>

      {/* Error Message */}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>操作失败</MessageBarTitle>
            {error}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Form Card */}
      <Card className={classes.panel}>
        <div className={classes.formSection}>
          <Field label={<span className={classes.fieldLabel}>问题说明</span>}>
            <Textarea
              className={classes.textareaField}
              readOnly={!editable}
              value={modifiedExplanation ?? defaults.explanation}
              onChange={(e) => setModifiedExplanation(e.target.value)}
              rows={6}
              resize="vertical"
            />
          </Field>
          <Field label={<span className={classes.fieldLabel}>修改建议</span>}>
            <Textarea
              className={classes.textareaField}
              readOnly={!editable}
              value={modifiedSuggestedFix ?? defaults.suggestedFix}
              onChange={(e) => setModifiedSuggestedFix(e.target.value)}
              rows={6}
              resize="vertical"
            />
          </Field>
        </div>
        {editable && (
          <div className={classes.footer}>
            <Button
              size="small"
              appearance="secondary"
              className={classes.actionBtn}
              icon={<Edit16Regular />}
              onClick={openHitlEditDialog}
              disabledFocusable={hitlLoading}
            >
              人工复核
            </Button>
            <Button
              size="small"
              appearance="secondary"
              className={classes.actionBtn}
              icon={dismissing ? <Spinner size="tiny" /> : <Dismiss16Regular />}
              onClick={handleDismiss}
              disabledFocusable={dismissing}
            >
              不采纳
            </Button>
            <Button
              size="small"
              appearance="primary"
              className={classes.actionBtn}
              icon={accepting ? <Spinner size="tiny" /> : <Checkmark16Regular />}
              onClick={handleAccept}
              disabledFocusable={accepting}
            >
              采纳建议
            </Button>
          </div>
        )}
      </Card>

      {/* Feedback Dialog */}
      <Dialog open={feedbackOpen} onOpenChange={(_, data) => setFeedbackOpen(data.open)}>
        <DialogSurface className={classes.dialogSurface}>
          <DialogBody>
            <DialogTitle>不采纳原因（可选）</DialogTitle>
            <DialogContent>
              <Field label="用于改进审阅与规则策略">
                <Textarea
                  className={classes.textareaField}
                  value={feedback?.reason}
                  placeholder="说明为何不采纳该建议，以及更合适的判断方式（可选）…"
                  onChange={(e) => setFeedback({ ...feedback, reason: e.target.value })}
                  rows={5}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                disabledFocusable={submittingFeedback}
                icon={submittingFeedback ? <Spinner size="tiny" /> : undefined}
                onClick={handleSubmitFeedback}
              >
                提交
              </Button>
              <Button appearance="secondary" onClick={() => setFeedbackOpen(false)}>
                关闭
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* HITL Dialog */}
      <Dialog open={hitlOpen} onOpenChange={(_, data) => setHitlOpen(data.open)}>
        <DialogSurface className={classes.dialogSurface}>
          <DialogBody>
            <DialogTitle>人工复核确认</DialogTitle>
            <DialogContent>
              {hitlError && (
                <MessageBar intent="error" style={{ marginBottom: 12 }}>
                  <MessageBarBody>
                    <MessageBarTitle>错误</MessageBarTitle>
                    {hitlError}
                  </MessageBarBody>
                </MessageBar>
              )}
              <div style={{ 
                padding: '16px', 
                backgroundColor: tokens.colorNeutralBackground2, 
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: tokens.colorNeutralForeground1 }}>
                  即将执行的操作
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: tokens.colorNeutralForeground3 }}>操作类型</span>
                    <Badge appearance="filled" color="success">采纳建议</Badge>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: tokens.colorNeutralForeground3 }}>处理人</span>
                    <span style={{ color: tokens.colorNeutralForeground1 }}>当前用户</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: tokens.colorNeutralForeground3 }}>处理时间</span>
                    <span style={{ color: tokens.colorNeutralForeground1 }}>{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground3, lineHeight: '1.5' }}>
                确认后将采纳此问题的修改建议，并标记为已处理。
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setHitlOpen(false)}>
                取消
              </Button>
              <Button
                appearance="primary"
                disabledFocusable={hitlLoading}
                icon={hitlLoading ? <Spinner size="tiny" /> : <Checkmark16Regular />}
                onClick={() => runHitlDecision({ type: 'approve' })}
              >
                确认执行
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={guideOpen} onOpenChange={(_, data) => setGuideOpen(data.open)}>
        <DialogSurface className={classes.dialogSurface}>
          <DialogBody>
            <DialogTitle>右侧栏怎么用</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                <div>1. 左侧点选一个问题，右侧会显示该问题详情。</div>
                <div>2. 在“问题说明 / 修改建议”中可人工改写（法务润色）。</div>
                <div>3. 点“采纳建议”表示确认，点“不采纳”表示驳回，点“人工复核”进入审批流。</div>
                <div>4. 完成后点击上方“导出审阅版”，系统会生成可下载的 DOCX 审阅结果。</div>
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
