// Left rail: the patient queue grouped by visit date, newest day first, with a
// status chip per row. Selection is owned by the page and preserved across polls
// (AC3). Grouping is presentation-only — rows still carry the real visit id, so
// selection / stats / Done are unaffected. Tokens are per-day (they restart at 1
// each day), so grouping by date is what makes the repeated numbers make sense.
import StatusChip from './StatusChip'

// Clinic name and doctor are static placeholders — the POC has no clinic entity
// and no doctor login to populate them (auth is just the x-role header).
const CLINIC_NAME = 'CarePoint Clinic'
const DOCTOR_LINE = 'Dr. S. Ramesh · General'

// Local calendar day as YYYY-MM-DD, to flag "Today" without a timezone shift.
function todayKey() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Bucket visits by their visit_date (date part only), newest day first. Within a
// day, order by token so it reads 1, 2, 3… Undated rows (shouldn't happen) sort last.
function groupByDate(visits) {
  const buckets = new Map()
  for (const v of visits) {
    const key = (v.visit_date || '').slice(0, 10) || 'unknown'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(v)
  }
  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, items]) => ({
      date,
      items: [...items].sort((x, y) => (x.token_number ?? 0) - (y.token_number ?? 0)),
    }))
}

function formatDate(key) {
  if (key === 'unknown') return 'No date'
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d) // local construction — no tz shift
  return dt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function QueueRail({ visits, selectedId, onSelect, isLoading, error, onRetry }) {
  const groups = groupByDate(visits)
  const today = todayKey()

  return (
    <aside className="rail">
      <div className="rail-clinic">
        <div className="rail-clinic-name">{CLINIC_NAME}</div>
        <div className="rail-clinic-date">{formatDate(today)}</div>
        <div className="rail-clinic-doc">{DOCTOR_LINE}</div>
      </div>

      <div className="rail-head">
        <span className="rail-title">Queue</span>
        <span className="rail-count">{visits.length}</span>
      </div>

      {isLoading ? (
        <div className="rail-msg">Loading queue…</div>
      ) : error && visits.length === 0 ? (
        <div className="rail-msg rail-msg--error">
          Could not load queue.
          <button className="link-btn" onClick={onRetry}>Retry</button>
        </div>
      ) : visits.length === 0 ? (
        <div className="rail-msg">No patients in the queue yet</div>
      ) : (
        <div className="rail-groups">
          {groups.map((g) => (
            <section className="rail-group" key={g.date}>
              <div className="rail-group-hdr">
                <span className="rail-group-date">{formatDate(g.date)}</span>
                {g.date === today ? <span className="rail-group-today">Today</span> : null}
                <span className="rail-group-count">{g.items.length}</span>
              </div>
              <ul className="rail-list">
                {g.items.map((v) => (
                  <li
                    key={v.id}
                    className={`rail-item${v.id === selectedId ? ' rail-item--sel' : ''}`}
                    onClick={() => onSelect(v.id)}
                  >
                    <span className={`rail-token${v.token_number === 1 ? ' rail-token--first' : ''}`}>
                      {v.token_number}
                    </span>
                    <span className="rail-name">{v.patient_name}</span>
                    <StatusChip status={v.status} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  )
}
