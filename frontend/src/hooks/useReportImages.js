// Loads the previous-report photos (CLINIC-011) for the doctor dashboard. The photos
// need the login token, so each is fetched through the API client as a blob and shown
// via an object URL (a plain <img src> can't send the header).
// Output: { [reportId]: objectUrl | 'error' }
//
// Each report is fetched once, a few at a time, and the effect keys on the report ids
// (not the array), so a refetch of the visit with the same reports doesn't re-download
// them or revoke a URL the viewer is showing. All URLs are released on unmount.

import { useEffect, useRef, useState } from 'react'
import { getReportImage } from '../utils/apiClient'

const CONCURRENCY = 4 // keeps 20 photos from hogging the browser's connections

export function useReportImages(reports) {
  const [images, setImages] = useState({})
  const urls = useRef(new Map()) // id -> object URL, so unmount can release them
  const requested = useRef(new Set())
  const mounted = useRef(false)
  const idsKey = reports.map((r) => r.id).join(',')

  useEffect(() => {
    mounted.current = true
    const map = urls.current
    return () => {
      mounted.current = false
      map.forEach((url) => URL.revokeObjectURL(url))
      map.clear()
    }
  }, [])

  useEffect(() => {
    const todo = idsKey.split(',').filter(Boolean).map(Number).filter((id) => !requested.current.has(id))
    todo.forEach((id) => requested.current.add(id))
    let next = 0

    async function worker() {
      while (next < todo.length) {
        const id = todo[next++]
        let value
        try {
          value = URL.createObjectURL(await getReportImage(id))
          if (!mounted.current) {
            URL.revokeObjectURL(value)
            return
          }
          urls.current.set(id, value)
        } catch {
          value = 'error'
        }
        if (mounted.current) setImages((prev) => ({ ...prev, [id]: value }))
      }
    }
    for (let i = 0; i < Math.min(CONCURRENCY, todo.length); i++) worker()
  }, [idsKey])

  return images
}
