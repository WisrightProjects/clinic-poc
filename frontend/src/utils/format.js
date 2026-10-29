// A timestamp as "12 Oct, 16:04" (day, month, time), or '' when it isn't a valid date.
export function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// "22 Oct" — a day in the doctor card's short form.
export const SHORT_DAY = { day: 'numeric', month: 'short' }

// A clinic day ("2026-10-22", as the API sends it) in en-GB with `options`. Built from its
// parts, in local time, so the day never shifts with the time zone.
export function formatDay(key, options) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', options)
}
