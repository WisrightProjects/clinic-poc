// Composition root for /doctor. Owns the selected visit (kept in the URL,
// /doctor/:visitId), composes the queue rail + detail panel, and handles Done: optimistic
// chip/stat update -> PATCH -> rollback on failure (AC9) -> advance to the next actionable
// patient (AC5).
//
// Phone layout (CLINIC-010, under 768px): the queue and the patient are shown one at a
// time — the queue until a patient is open, then the patient with a Back to queue control.
// Because the open patient is in the URL, the phone's own back button does the same.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSession, clearSession } from '../utils/authStore'
import { useVisitQueue } from '../hooks/useVisitQueue'
import { useVisitDetail } from '../hooks/useVisitDetail'
import { useMediaQuery, PHONE_QUERY } from '../hooks/useMediaQuery'
import { setVisitDone } from '../utils/apiClient'
import { isActionable } from '../utils/statusMap'
import QueueRail from '../components/QueueRail'
import PatientHeader from '../components/PatientHeader'
import StatsStrip from '../components/StatsStrip'
import AiSummaryCard from '../components/AiSummaryCard'
import QaList from '../components/QaList'
import ReportsList from '../components/ReportsList'
import VitalsStrip from '../components/VitalsStrip'
import TestRequestPanel from '../components/TestRequestPanel'
import PreviousVisits from '../components/PreviousVisits'
import { isInQueueOn, todayKey } from '../utils/queue'

export default function DoctorDashboardPage() {
  const user = useSession()?.user
  // The day whose queue is shown (CLINIC-015): today unless the doctor picks another day.
  // Not remembered — reopening the page starts on today again.
  const today = todayKey()
  const [pickedDate, setPickedDate] = useState(null)
  const viewDate = pickedDate ?? today
  const { visits, isLoading, error, refetch } = useVisitQueue(viewDate)
  const navigate = useNavigate()
  const location = useLocation()
  const isPhone = useMediaQuery(PHONE_QUERY)
  // The open patient comes from the URL; anything that isn't a number counts as none.
  const { visitId } = useParams()
  const selectedId = /^\d+$/.test(visitId ?? '') ? Number(visitId) : null
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
  // (never override the doctor's selection on a background poll — AC3). Not on a phone:
  // there the queue is the starting view, and Back to queue must not reopen a patient.
  useEffect(() => {
    if (!isPhone && !selectedId && queue.length) {
      const first = queue.find((v) => isActionable(v.status)) ?? queue[0]
      if (first) navigate(`/doctor/${first.id}`, { replace: true })
    }
  }, [queue, selectedId, isPhone, navigate])

  // Phone: back to the queue. Undo the step into the patient when it came from the queue
  // (so the phone's back button and this control agree); a patient opened directly by
  // link has no queue behind it, so go to the queue instead.
  function backToQueue() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/doctor', { replace: true })
  }

  const detail = useVisitDetail(selectedId)
  const selected = queue.find((v) => v.id === selectedId) ?? null

  // "Seen" / "Remaining" are day stats, so scope them to the day shown. The queue also holds
  // everyone waiting for tests (any day), who are not part of a day's queue.
  // A returned patient counts on the day they re-joined the queue.
  const dayVisits = queue.filter((v) => isInQueueOn(v, viewDate))

  const seenToday = dayVisits.filter((v) => v.status === 'done').length
  const remaining = dayVisits.filter((v) => isActionable(v.status)).length
  const answeredCount = detail.qa.filter((q) => q.transcript && q.transcript.trim()).length

  // The open visit: from the queue, or from the detail for one not in the shown day's queue
  // (e.g. opened from Previous visits, CLINIC-027).
  const current = selected ?? detail.visit
  const canMarkDone = current?.status === 'summarised'

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

  // A Done error belongs to the patient it happened on. `replace`: opening a previous visit
  // (CLINIC-027) takes the open patient's place, so Back to queue still goes to the queue.
  function selectPatient(id, { replace = false } = {}) {
    setDoneError(null)
    navigate(`/doctor/${id}`, { replace })
  }

  // Changing the day closes the open patient (back to /doctor): they belong to the day that
  // was shown. On a laptop the first patient of the new day is then opened as usual.
  function changeDay(day) {
    setPickedDate(day === today ? null : day)
    setDoneError(null)
    navigate('/doctor', { replace: true })
  }

  // The patient open right now, for handleDone to check after its await (the closure's
  // selectedId is the one from when Done was tapped).
  const openIdRef = useRef(selectedId)
  useEffect(() => {
    openIdRef.current = selectedId
  }, [selectedId])

  async function handleDone() {
    if (!canMarkDone || markingId) return
    const id = current.id
    setMarkingId(id)
    setDoneError(null)
    setOverrides((p) => ({ ...p, [id]: 'done' })) // optimistic
    try {
      await setVisitDone(id)
      await Promise.all([refetch(), selected ? null : detail.refetch({ silent: true })])
      // Advance to the next actionable patient in token order (on a phone, back to the queue)
      // — only if the doctor is still on this patient (never override a selection made
      // while Done was saving).
      if (openIdRef.current === id) {
        const next = queue.find((v) => v.id !== id && isActionable(v.status))
        navigate(isPhone || !next ? '/doctor' : `/doctor/${next.id}`, { replace: true })
      }
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

      <div className={`layout${selectedId ? ' layout--detail' : ''}`}>
        <QueueRail
          user={user}
          visits={queue}
          selectedId={selectedId}
          onSelect={selectPatient}
          viewDate={viewDate}
          onDateChange={changeDay}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
        />

        <main className="main">
          {isPhone && selectedId ? (
            <button className="link-btn back-btn" onClick={backToQueue}>‹ Back to queue</button>
          ) : null}
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
              {/* The queue row has no mobile (CLINIC-023): it comes from the detail. */}
              <PatientHeader visit={current} mobile={detail.visit?.patient_mobile} />
              <VitalsStrip display={detail.vitalsDisplay} />
              <StatsStrip
                seenToday={seenToday}
                remaining={remaining}
                isToday={viewDate === today}
                answered={answeredCount}
                total={detail.qa.length}
              />
              {/* Summary right after the patient (CLINIC-010 reading order), then the actions
                  that follow from it. */}
              <AiSummaryCard
                summary={detail.summary}
                status={current.status}
                onSave={handleSummarySave}
              />
              <PreviousVisits visits={detail.previousVisits} onOpen={(id) => selectPatient(id, { replace: true })} />
              <TestRequestPanel
                visit={current}
                requests={detail.testRequests}
                onChanged={handleTestsChanged}
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
                  {markingId === selectedId ? 'Marking…' : current.status === 'done' ? 'Done ✓' : 'Mark Done'}
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
