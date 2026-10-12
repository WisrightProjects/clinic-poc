// Detail source for the selected patient. Fetches GET /api/visits/:id ONLY when
// visitId changes — never on a queue poll — so the open panel is not reset or
// re-fetched by background refreshes (AC3).
//
// The API returns { visit, template, answers, summary, reports, test_requests } where questions live in
// template.questions and transcripts in answers. We merge them by question_id
// and sort by order_index (same shape the mobile app derives). Output:
// { visit, qa, summary, reports, testRequests, isLoading, error, refetch, saveSummary }.

import { useEffect, useRef, useState, useCallback } from 'react'
import { getVisit, saveSummary as putSummary } from '../utils/apiClient'

export function useVisitDetail(visitId) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  // The visit the latest load is for: a slower response for a patient the doctor has
  // already clicked away from must not replace the current patient's data.
  const latestId = useRef(visitId)

  // silent = refresh the data in place, without flipping the page to "Loading patient…".
  const load = useCallback(async ({ silent = false } = {}) => {
    latestId.current = visitId
    if (!visitId) {
      setData(null)
      return
    }
    const isCurrent = () => latestId.current === visitId
    if (!silent) setIsLoading(true)
    setError(null)
    try {
      const result = await getVisit(visitId)
      if (isCurrent()) setData(result)
    } catch (e) {
      if (isCurrent()) setError(e)
    } finally {
      if (!silent && isCurrent()) setIsLoading(false)
    }
  }, [visitId])

  useEffect(() => {
    load()
  }, [load])

  // Merge questions (template) with answers (transcripts) — ordered.
  const questions = data?.template?.questions ?? []
  const answers = data?.answers ?? []
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
      setData((d) => (d?.visit?.id === summary.visit_id ? { ...d, summary } : d))
    },
    [visitId]
  )

  return {
    visit: data?.visit ?? null,
    qa,
    summary: data?.summary ?? null,
    reports: data?.reports ?? [],
    testRequests: data?.test_requests ?? [], // CLINIC-014 history, newest first
    isLoading,
    error,
    refetch: load,
    saveSummary,
  }
}
