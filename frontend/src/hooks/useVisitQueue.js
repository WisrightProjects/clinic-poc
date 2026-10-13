// Polling queue source for the doctor rail.
// Fetches GET /api/visits?date= for the day being viewed (CLINIC-015) on mount and whenever
// the day changes, then every intervalMs. Background polls update data WITHOUT flipping
// isLoading (AC8) and keep the last good list on failure (AC9). Switching day shows a
// loading state instead of the previous day's list. Output: { visits, isLoading, error, refetch }.

import { useEffect, useRef, useState, useCallback } from 'react'
import { getVisits } from '../utils/apiClient'

export function useVisitQueue(date, intervalMs = 5000) {
  // The list is stored with the day it belongs to, so a day that hasn't loaded yet is
  // never shown another day's patients (and a slow reply for a day we left is dropped).
  const [state, setState] = useState({ date: null, visits: [], error: null })

  const currentDate = useRef(date)

  const load = useCallback(async () => {
    try {
      const data = await getVisits({ date })
      if (currentDate.current !== date) return // the doctor has moved to another day
      setState({ date, visits: Array.isArray(data) ? data : [], error: null })
    } catch (e) {
      if (currentDate.current !== date) return
      // keep the last good list of this day visible
      setState((s) => ({ date, visits: s.date === date ? s.visits : [], error: e }))
    }
  }, [date])

  useEffect(() => {
    currentDate.current = date
    load()
    const id = setInterval(load, intervalMs)
    return () => clearInterval(id) // stop polling on unmount (AC2)
  }, [load, date, intervalMs])

  const isLoading = state.date !== date // first load of this day only
  return { visits: isLoading ? [] : state.visits, isLoading, error: isLoading ? null : state.error, refetch: load }
}
