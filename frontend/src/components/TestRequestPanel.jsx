// Tests before consultation (CLINIC-014), doctor side. For a summarised (waiting) patient
// the doctor can "Send for tests" with a required note; the patient leaves the queue, the
// attender is alerted, and when the patient returns the visit is back in today's queue.
// This panel shows: the button + note dialog, the current "waiting for tests" state, the
// "Returned with test results" badge with the doctor's earlier note, and the history.
// Notes are plain text only (React text nodes / a textarea), never HTML.
import { useState } from 'react'
import { requestTests } from '../utils/apiClient'

const MAX_NOTE = 1000 // matches backend/src/utils/testRequestValidation.js

function formatWhen(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function requestState(r) {
  if (r.returned_at) return `Back in queue · ${formatWhen(r.returned_at)}`
  if (r.acknowledged_at) return `Patient informed${r.acknowledged_by_name ? ` by ${r.acknowledged_by_name}` : ''} · ${formatWhen(r.acknowledged_at)}`
  return 'Attender not informed yet'
}

// One request: the note, and who / when / what happened to it.
function RequestEntry({ request, label }) {
  const by = request.requested_by_name ? `${request.requested_by_name} · ` : ''
  return (
    <div className="tr-entry">
      {label ? <div className="tr-entry-label">{label}</div> : null}
      <p className="tr-note-text">{request.note}</p>
      <div className="tr-meta">{by}{formatWhen(request.requested_at)} · {requestState(request)}</div>
    </div>
  )
}

function SendDialog({ onSend, onClose }) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const trimmed = note.trim()
  const tooLong = trimmed.length > MAX_NOTE
  const canSend = !sending && trimmed.length > 0 && !tooLong

  async function submit() {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await onSend(trimmed)
    } catch (e) {
      setError(e?.message ?? 'Could not send the request. Please retry.')
      setSending(false)
    }
  }

  return (
    <div className="tr-overlay" role="dialog" aria-modal="true" aria-label="Send for tests" onClick={sending ? undefined : onClose}>
      <div className="tr-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="tr-dialog-title">Send for tests</h3>
        <p className="tr-dialog-help">
          Write which tests the patient should do. The attender is alerted and tells the patient;
          the patient leaves the queue until they return with the results.
        </p>
        <textarea
          className="tr-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={5}
          disabled={sending}
          placeholder="e.g. Do ECG, lipid profile and HbA1c, and come back."
          aria-label="Tests to do"
          autoFocus
        />
        <span className={tooLong ? 'tr-count tr-count--over' : 'tr-count'}>
          {trimmed.length} / {MAX_NOTE}
        </span>
        {error ? <div className="tr-error" role="alert">{error}</div> : null}
        <div className="tr-actions">
          <button className="tr-btn" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="tr-btn tr-btn--primary" onClick={submit} disabled={!canSend}>
            {sending ? 'Sending…' : 'Send for tests'}
          </button>
        </div>
      </div>
    </div>
  )
}

// visit: the selected visit (status, id). requests: its test requests, newest first.
// onChanged: refetch the detail and the queue after the status moved.
export default function TestRequestPanel({ visit, requests, onChanged }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const latest = requests[0]
  const summarised = visit.status === 'summarised'
  const waiting = visit.status === 'tests_requested'
  const returned = summarised && Boolean(latest?.returned_at)

  async function send(note) {
    await requestTests(visit.id, note)
    setDialogOpen(false)
    await onChanged()
  }

  // Nothing to offer or show for a visit that can't be sent and was never sent.
  if (!summarised && !waiting && !latest) return null

  return (
    <section className="tr-panel">
      {returned ? <div className="tr-badge">Returned with test results</div> : null}

      {waiting ? (
        <div className="tr-state">
          <strong>Sent for tests.</strong> The patient is out of the queue until they return with the results.
        </div>
      ) : null}

      {latest ? <RequestEntry request={latest} label={returned ? 'Your earlier note' : 'Your note'} /> : null}

      {summarised ? (
        <button className="tr-btn tr-btn--navy" onClick={() => setDialogOpen(true)}>Send for tests</button>
      ) : null}

      {requests.length > 1 ? (
        <details className="tr-history">
          <summary>Earlier test requests ({requests.length - 1})</summary>
          {requests.slice(1).map((r) => <RequestEntry key={r.id} request={r} />)}
        </details>
      ) : null}

      {dialogOpen ? <SendDialog onSend={send} onClose={() => setDialogOpen(false)} /> : null}
    </section>
  )
}
