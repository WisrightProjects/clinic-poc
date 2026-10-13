// True while the viewport matches a CSS media query; re-renders when it changes (rotating
// the phone, resizing the window).
import { useCallback, useSyncExternalStore } from 'react'

// The phone breakpoint (CLINIC-010): the queue and the patient are shown one at a time.
// Every phone rule in assets/doctor.css sits under this same max-width: 767px.
export const PHONE_QUERY = '(max-width: 767px)'

// One MediaQueryList per query, so rendering doesn't re-parse the query string.
const lists = new Map()
function listFor(query) {
  if (!lists.has(query)) lists.set(query, window.matchMedia(query))
  return lists.get(query)
}

export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const list = listFor(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(subscribe, () => listFor(query).matches)
}
