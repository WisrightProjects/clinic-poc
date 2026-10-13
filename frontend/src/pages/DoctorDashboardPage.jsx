// Composition root for /doctor. Owns selected-visit state, composes the queue
// rail + detail panel, and handles Done: optimistic chip/stat update -> PATCH ->
// rollback on failure (AC9) -> advance to the next actionable patient (AC5).

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSession, clearSession } from '../utils/authStore'
import { useVisitQueue } from '../hooks/useVisitQueue'
import { useVisitDetail } from '../hooks/useVisitDetail'
import { setVisitDone } from '../utils/apiClient'
import { isActionable } from '../utils/statusMap'
import QueueRail from '../components/QueueRail'
import PatientHeader from '../components/PatientHeader'
import StatsStrip from '../components/StatsStrip'
import AiSummaryCard from '../components/AiSummaryCard'
import QaList from '../components/QaList'
import ReportsList from '../components/ReportsList'
import TestRequestPanel from '../components/TestRequestPanel'
import { isInQueueOn, todayKey } from '../utils/queue'

export default function DoctorDashboardPage() {
  const user = useSession()?.user
  // The day whose queue is shown (CLINIC-015): today unless the doctor picks another day.
  // Not remembered — reopening the page starts on today again.
  const today = todayKey()
  const [pickedDate, setPickedDate] = useState(null)
  const viewDate = pickedDate ?? today
  const { visits, isLoading, error, refetch } = useVisitQueue(viewDate)
  const [selectedId, setSelectedId] = useState(null)
  const [overrides, setOverrides] = useState({}) // optimistic status by visit id
  const [doneError, setDoneError] = useState(null)
  const [markingId, setMarkingId] = useState(null) // the visit whose Done is in flight

  // Apply optimistic overrides on top of the polled queue (token order kept).
  const queue = useMemo(
    () => visits.map((v) => (overrides[v.id] ? { ...v, status: overrides[v.id] } : v)),
    [visits, overrides]
  )

  // Drop an override once the real data has caught up (status persisted).
  useEffect(() => {
    setOverrides((prev) => {
      let changed = false
      const next = { ...prev }
      for (const v of visits) {
        if (next[v.id] && v.status === next[v.id]) {
          delete next[v.id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [visits])

  // Auto-select the first actionable patient only when nothing is selected yet
  // (never override the doctor's selection on a background poll — AC3).
  useEffect(() => {
    if (!selectedId && queue.length) {
      const first = queue.find((v) => isActionable(v.status)) ?? queue[0]
      setSelectedId(first?.id ?? null)
    }
  }, [queue, selectedId])

  const detail = useVisitDetail(selectedId)
  const selected = queue.find((v) => v.id === selectedId) ?? null

  // "Seen" / "Remaining" are day stats, so scope them to the day shown. The queue also holds
  // everyone waiting for tests (any day), who are not part of a day's queue.
  // A returned patient counts on the day they re-joined the queue.
  const dayVisits = queue.filter((v) => isInQueueOn(v, viewDate))

  const seenToday = dayVisits.filter((v) => v.status === 'done').length
  const remaining = dayVisits.filter((v) => isActionable(v.status)).length
  const answeredCount = detail.qa.filter((q) => q.transcript && q.transcript.trim()).length

  const canMarkDone = selected && selected.status === 'summarised'

  // After "Send for tests" the visit's status moved: reload its detail (quietly, so the
  // whole pane doesn't flash back to "Loading patient…") and the queue.
  async function handleTestsChanged() {
    await Promise.all([detail.refetch({ silent: true }), refetch()])
  }

  // The queue rail previews the summary's display_text, so refresh it after a save. The save
  // itself is awaited — a failed save still rejects and shows its error in the card.
  async function handleSummarySave(text) {
    await detail.saveSummary(text)
    refetch()
  }

  // A Done error belongs to the patient it happened on.
  function selectPatient(id) {
    setDoneError(null)
    setSelectedId(id)
  }

  async function handleDone() {
    if (!selected || markingId) return
    const id = selected.id
    setMarkingId(id)
    setDoneError(null)
    setOverrides((p) => ({ ...p, [id]: 'done' })) // optimistic
    try {
      await setVisitDone(id)
      await refetch()
      // Advance to the next actionable patient in token order — only if the doctor is
      // still on this patient (never override a selection made while Done was saving).
      const next = queue.find((v) => v.id !== id && isActionable(v.status))
      setSelectedId((cur) => (cur === id ? (next?.id ?? null) : cur))
    } catch (e) {
      setOverrides((p) => {
        const n = { ...p }
        delete n[id]
        return n // rollback
      })
      setDoneError(e?.message ?? 'Could not mark done. Please retry.')
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="doctor-app">
      <header className="topbar">
        <span className="brand">ClinicAI</span>
        <span className="topbar-sub">Doctor Dashboard</span>
        <span className="topbar-user">
          {[user?.clinic?.name, user?.name].filter(Boolean).join(' · ')}
        </span>
        <button className="topbar-logout" onClick={clearSession}>Logout</button>
      </header>

      <div className="layout">
        <QueueRail
          user={user}
          visits={queue}
          selectedId={selectedId}
          onSelect={selectPatient}
          viewDate={viewDate}
          onDateChange={(d) => setPickedDate(d === today ? null : d)}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
        />

        <main className="main">
          {!selectedId ? (
            <div className="placeholder">
              <h2>Select a patient</h2>
              <p>Choose a patient from the queue to review their intake.</p>
            </div>
          ) : detail.isLoading ? (
            <div className="placeholder">Loading patient…</div>
          ) : detail.error ? (
            <div className="placeholder placeholder--error">
              <p>Could not load this patient.</p>
              <button className="link-btn" onClick={() => detail.refetch()}>Retry</button>
            </div>
          ) : detail.visit ? (
            // Keyed by patient, so switching patients remounts the whole detail: an open
            // summary edit, the send-for-tests dialog and loaded photos never carry over.
            // One key on the wrapper — sibling components must never share a key, which
            // left the previous patient's panels on screen (CR-003). useVisitDetail only
            // returns data for the selected visit, so nothing stale renders under it.
            <Fragment key={selectedId}>
              <PatientHeader visit={selected ?? detail.visit} />
              <StatsStrip
                seenToday={seenToday}
                remaining={remaining}
                isToday={viewDate === today}
                answered={answeredCount}
                total={detail.qa.length}
              />
              <TestRequestPanel
                visit={selected ?? detail.visit}
                requests={detail.testRequests}
                onChanged={handleTestsChanged}
              />
              <AiSummaryCard
                summary={detail.summary}
                status={(selected ?? detail.visit).status}
                onSave={handleSummarySave}
              />
              <QaList qa={detail.qa} />
              <ReportsList reports={detail.reports} />

              {doneError ? <div className="done-error">{doneError}</div> : null}
              <div className="action-bar">
                <button
                  className="done-btn"
                  onClick={handleDone}
                  disabled={!canMarkDone || markingId !== null}
                  title={canMarkDone ? '' : 'Only a summarised patient can be marked done'}
                >
                  {markingId === selectedId ? 'Marking…' : (selected ?? detail.visit).status === 'done' ? 'Done ✓' : 'Mark Done'}
                </button>
              </div>
            </Fragment>
          ) : null}
        </main>
      </div>

      <footer className="app-credit">
        Developed by WisRight Technologies · © {new Date().getFullYear()}. All rights reserved.
      </footer>
    </div>
  )
}
