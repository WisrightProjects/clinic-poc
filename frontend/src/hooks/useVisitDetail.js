// Detail source for the selected patient. Fetches GET /api/visits/:id ONLY when
// visitId changes — never on a queue poll — so the open panel is not reset or
// re-fetched by background refreshes (AC3).
//
// The API returns { visit, template, answers, summary, reports, test_requests, vitals_display,
// previous_visits, … } where questions live in template.questions and transcripts in answers. We
// merge them by question_id and sort by order_index (same shape the mobile app derives). Output:
// { visit, qa, summary, reports, testRequests, vitals, vitalsDisplay, previousVisits, summaryCard,
//   mainProblem, trends, isLoading, error, refetch, saveSummary }.

import { useEffect, useRef, useState, useCallback } from 'react'
import { getVisit, saveSummary as putSummary } from '../utils/apiClient'

export function useVisitDetail(visitId) {
  // The detail is stored with the visit it belongs to (as useVisitQueue stores its day), so
  // another patient's data or error never shows under this one.
  const [state, setState] = useState({ id: null, data: null, error: null })
  // Numbers each load; only the latest one may set state. Covers a slower reply for a patient
  // the doctor has left, and an older reply for this patient finishing after a newer one.
  const seq = useRef(0)
  const inFlight = useRef(false) // the latest load hasn't answered yet

  // A newly selected patient starts without an old error, so one whose last load failed shows
  // "Loading patient…" while it loads again (set while rendering, not in the effect).
  const [selected, setSelected] = useState(visitId)
  if (selected !== visitId) {
    setSelected(visitId)
    if (state.error) setState((s) => ({ ...s, error: null }))
  }

  // A failed refresh keeps this visit's data. No visit: nothing to fetch — `current` is null.
  const fetchVisit = useCallback(() => {
    const n = ++seq.current
    inFlight.current = Boolean(visitId)
    if (!visitId) return Promise.resolve()
    const settle = (update) => {
      if (seq.current !== n) return
      inFlight.current = false
      setState(update)
    }
    return getVisit(visitId).then(
      (data) => settle({ id: visitId, data, error: null }),
      (error) => settle((s) => ({ id: visitId, data: s.id === visitId ? s.data : null, error }))
    )
  }, [visitId])

  useEffect(() => {
    fetchVisit()
  }, [fetchVisit])

  // Reload in place (the panel stays while it runs); Retry clears the error first, so the page
  // shows "Loading patient…" until the answer comes.
  const refetch = useCallback(() => {
    setState((s) => (s.error ? { ...s, error: null } : s))
    return fetchVisit()
  }, [fetchVisit])

  // Only data for the visit asked for. Right after the selection changes, the state still holds
  // the previous patient until the effect above loads the new one; treat that as loading,
  // so one patient's summary, tests or photos never render under another's name.
  const mine = state.id === visitId
  const current = mine ? state.data : null
  // An error only matters while there is nothing to show: a failed refresh keeps the panel.
  const error = mine && !current ? state.error : null
  const loading = Boolean(visitId) && !current && !error

  // Merge questions (template) with answers (transcripts) — ordered.
  const questions = current?.template?.questions ?? []
  const answers = current?.answers ?? []
  const byQuestion = new Map(answers.map((a) => [a.question_id, a]))
  const qa = [...questions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({
      id: q.id,
      text: q.text,
      transcript: byQuestion.get(q.id)?.transcript ?? null,
      transcriptStatus: byQuestion.get(q.id)?.transcript_status ?? null,
    }))

  // Save the doctor's edited summary (CLINIC-012). The PUT returns the updated row, which
  // replaces the shown summary without a refetch that would flash the whole panel back
  // to "Loading patient…". Rejects with the server error so the caller can show it.
  const saveSummary = useCallback(
    async (text) => {
      const summary = await putSummary(visitId, text)
      // Skip if the doctor already switched to another patient while this was saving.
      // The PUT also returns the doctor card read from the edited text (CLINIC-028).
      setState((s) => (s.data?.visit?.id === summary.visit_id
        ? { ...s, data: { ...s.data, summary, summary_card: summary.summary_card ?? null } } : s))
      // A load that started before the save would bring back the old summary: load again
      // (the newer load drops the older reply).
      if (inFlight.current) fetchVisit()
    },
    [visitId, fetchVisit]
  )

  return {
    visit: current?.visit ?? null,
    qa,
    summary: current?.summary ?? null,
    reports: current?.reports ?? [],
    testRequests: current?.test_requests ?? [], // CLINIC-014 history, newest first
    vitalsDisplay: current?.vitals_display ?? [], // CLINIC-024 today's vitals [{ label, value }]
    previousVisits: current?.previous_visits ?? [], // CLINIC-027 the patient's earlier visits
    vitals: current?.vitals ?? null, // CLINIC-024 the vitals row (recorded_at for the card)
    summaryCard: current?.summary_card ?? null, // CLINIC-028 the card's AI blocks, or null = paragraph
    mainProblem: current?.main_problem ?? null, // CLINIC-028 the Q1 taps
    trends: current?.trends ?? null, // CLINIC-030 the same measurements across visits, or null
    isLoading: loading,
    error,
    refetch,
    saveSummary,
  }
}
