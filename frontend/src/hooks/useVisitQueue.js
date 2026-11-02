// Polling queue source for the doctor rail.
// Fetches GET /api/visits?date= for the day being viewed (CLINIC-015) on mount and whenever
// the day changes, then every intervalMs. Background polls update data WITHOUT flipping
// isLoading (AC8) and keep the last good list on failure (AC9). Switching day shows a
// loading state instead of the previous day's list. Output: { visits, isLoading, error, refetch }
// (refetch resolves to the fresh list, or undefined if it failed or was overtaken).

import { useEffect, useRef, useState, useCallback } from 'react'
import { getVisits } from '../utils/apiClient'

// One empty list for "loading", the same on every render (a new [] each render is a new
// value to anything that compares lists). Frozen: it is shared by every caller.
const NO_VISITS = Object.freeze([])

export function useVisitQueue(date, intervalMs = 5000) {
  // The list is stored with the day it belongs to, so a day that hasn't loaded yet is
  // never shown another day's patients.
  const [state, setState] = useState({ date: null, visits: [], error: null })

  // Numbers each load; only the latest one may set state. Drops a slow reply for a day we
  // left, and an older poll finishing after a newer reload (e.g. the one after Done).
  const seq = useRef(0)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    const n = ++seq.current
    inFlight.current = true
    try {
      const data = await getVisits({ date })
      if (seq.current !== n) return
      const visits = Array.isArray(data) ? data : []
      setState({ date, visits, error: null })
      return visits // for a caller that needs the fresh list now (handleDone)
    } catch (e) {
      if (seq.current !== n) return
      // keep the last good list of this day visible
      setState((s) => ({ date, visits: s.date === date ? s.visits : [], error: e }))
    } finally {
      if (seq.current === n) inFlight.current = false
    }
  }, [date])

  useEffect(() => {
    load()
    // A poll is skipped while a load is still running, so slow replies don't pile up.
    const id = setInterval(() => {
      if (!inFlight.current) load()
    }, intervalMs)
    return () => clearInterval(id) // stop polling on unmount (AC2)
  }, [load, intervalMs])

  const isLoading = state.date !== date // first load of this day only
  return { visits: isLoading ? NO_VISITS : state.visits, isLoading, error: isLoading ? null : state.error, refetch: load }
}
