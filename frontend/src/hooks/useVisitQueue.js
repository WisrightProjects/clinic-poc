// Polling queue source for the doctor rail.
// Fetches GET /api/visits on mount, then every intervalMs. Background polls
// update data WITHOUT flipping isLoading (AC8) and keep the last good list on
// failure (AC9). Output: { visits, isLoading, error, refetch }.

import { useEffect, useRef, useState, useCallback } from 'react'
import { getVisits } from '../utils/apiClient'

export function useVisitQueue(intervalMs = 5000) {
  const [visits, setVisits] = useState([])
  const [isLoading, setIsLoading] = useState(true) // first load only
  const [error, setError] = useState(null)
  const firstLoad = useRef(true)

  const load = useCallback(async () => {
    try {
      const data = await getVisits()
      setVisits(Array.isArray(data) ? data : [])
      setError(null)
    } catch (e) {
      setError(e) // keep last good list visible
    } finally {
      if (firstLoad.current) {
        setIsLoading(false)
        firstLoad.current = false
      }
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, intervalMs)
    return () => clearInterval(id) // stop polling on unmount (AC2)
  }, [load, intervalMs])

  return { visits, isLoading, error, refetch: load }
}
