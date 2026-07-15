// Composition root for /doctor. Owns selected-visit state, composes the queue
// rail + detail panel, and handles Done: optimistic chip/stat update -> PATCH ->
// rollback on failure (AC9) -> advance to the next actionable patient (AC5).

import { useEffect, useMemo, useState } from 'react'
import { useVisitQueue } from '../hooks/useVisitQueue'
import { useVisitDetail } from '../hooks/useVisitDetail'
import { setVisitDone } from '../utils/apiClient'
import { isActionable } from '../utils/statusMap'
import QueueRail from '../components/QueueRail'
import PatientHeader from '../components/PatientHeader'
import StatsStrip from '../components/StatsStrip'
import AiSummaryCard from '../components/AiSummaryCard'
import QaList from '../components/QaList'

export default function DoctorDashboardPage() {
  const { visits, isLoading, error, refetch } = useVisitQueue()
  const [selectedId, setSelectedId] = useState(null)
  const [overrides, setOverrides] = useState({}) // optimistic status by visit id
  const [doneError, setDoneError] = useState(null)
  const [marking, setMarking] = useState(false)

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

  const seenToday = queue.filter((v) => v.status === 'done').length
  const remaining = queue.filter((v) => isActionable(v.status)).length
  const answeredCount = detail.qa.filter((q) => q.transcript && q.transcript.trim()).length

  const canMarkDone = selected && selected.status === 'summarised'

  async function handleDone() {
    if (!selected || marking) return
    const id = selected.id
    setMarking(true)
    setDoneError(null)
    setOverrides((p) => ({ ...p, [id]: 'done' })) // optimistic
    try {
      await setVisitDone(id)
      await refetch()
      // Advance to the next actionable patient in token order.
      const next = queue.find((v) => v.id !== id && isActionable(v.status))
      setSelectedId(next?.id ?? null)
    } catch (e) {
      setOverrides((p) => {
        const n = { ...p }
        delete n[id]
        return n // rollback
      })
      setDoneError(e?.message ?? 'Could not mark done. Please retry.')
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="doctor-app">
      <header className="topbar">
        <span className="brand">ClinicAI</span>
        <span className="topbar-sub">Doctor Dashboard</span>
      </header>

      <div className="layout">
        <QueueRail
          visits={queue}
          selectedId={selectedId}
          onSelect={setSelectedId}
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
              <button className="link-btn" onClick={detail.refetch}>Retry</button>
            </div>
          ) : detail.visit ? (
            <>
              <PatientHeader visit={selected ?? detail.visit} />
              <StatsStrip
                seenToday={seenToday}
                remaining={remaining}
                answered={answeredCount}
                total={detail.qa.length}
              />
              <AiSummaryCard summary={detail.summary} status={(selected ?? detail.visit).status} />
              <QaList qa={detail.qa} />

              {doneError ? <div className="done-error">{doneError}</div> : null}
              <div className="action-bar">
                <button
                  className="done-btn"
                  onClick={handleDone}
                  disabled={!canMarkDone || marking}
                  title={canMarkDone ? '' : 'Only a summarised patient can be marked done'}
                >
                  {marking ? 'Marking…' : (selected ?? detail.visit).status === 'done' ? 'Done ✓' : 'Mark Done'}
                </button>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}
