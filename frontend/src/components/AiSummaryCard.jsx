// AI summary card. Shows summary.display_text (the doctor's edit if there is one,
// otherwise the AI text) and lets the doctor edit it (CLINIC-012). The AI's original
// (summary_text) is never overwritten and stays viewable via "View AI original".
// Shows a clear placeholder when a visit is submitted but the summary is not ready
// yet (status 'answered' vs 'summarised') — AC6.
//
// All summary text is rendered as plain text (React text nodes / a textarea) — never
// as HTML or Markdown. Line breaks are kept with CSS (white-space: pre-wrap).
import { useState } from 'react'

const MAX_LENGTH = 4000 // matches the backend limit

function formatEditedAt(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// onSave(text) saves the edit and rejects with the server's error (see useVisitDetail).
export default function AiSummaryCard({ summary, status, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showOriginal, setShowOriginal] = useState(false)

  if (!summary) {
    return (
      <div className="sum-card sum-card--pending">
        <span className="ai-badge">AI Summary</span>
        <p className="sum-pending">
          {status === 'answered'
            ? 'Summary not ready yet — answers submitted, awaiting AI summary.'
            : 'No summary available for this visit.'}
        </p>
      </div>
    )
  }

  // edited_at, not edited_by_name: if the doctor who edited is later removed, edited_by
  // becomes NULL (ON DELETE SET NULL) but the edit — and the AI original — are still there.
  const edited = Boolean(summary.edited_at)
  const trimmed = draft.trim()
  const canSave = !saving && trimmed.length > 0 && trimmed.length <= MAX_LENGTH && trimmed !== summary.display_text

  function startEdit() {
    setDraft(summary.display_text)
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
      setEditing(false)
    } catch (e) {
      setError(e?.message ?? 'Could not save the summary. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sum-card">
      <div className="sum-hdr">
        <span className="ai-badge">AI Summary</span>
        <span className="sum-by">generated · {summary.generated_by}</span>
      </div>

      {editing ? (
        <>
          <textarea
            className="sum-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            disabled={saving}
            aria-label="Edit summary"
            autoFocus
          />
          <span className={trimmed.length > MAX_LENGTH ? 'sum-count sum-count--over' : 'sum-count'}>
            {trimmed.length} / {MAX_LENGTH}
          </span>
          {error ? <div className="sum-error" role="alert">{error}</div> : null}
          <div className="sum-actions">
            <button className="sum-btn sum-btn--primary" onClick={handleSave} disabled={!canSave}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="sum-btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <p className="sum-text">{summary.display_text}</p>
          <div className="sum-footer">
            {edited ? (
              <span className="sum-edited">
                Edited{summary.edited_by_name ? ` by ${summary.edited_by_name}` : ''} · {formatEditedAt(summary.edited_at)}
              </span>
            ) : null}
            <div className="sum-actions">
              {edited ? (
                <button className="link-btn" onClick={() => setShowOriginal((v) => !v)}>
                  {showOriginal ? 'Hide AI original' : 'View AI original'}
                </button>
              ) : null}
              <button className="sum-btn" onClick={startEdit}>Edit</button>
            </div>
          </div>
          {edited && showOriginal ? (
            <div className="sum-original">
              <div className="sum-original-label">AI original</div>
              <p className="sum-text">{summary.summary_text}</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
