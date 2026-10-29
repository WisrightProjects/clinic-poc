// "Previous visits" (CLINIC-027): the same patient's earlier finished visits — same clinic,
// mobile and name (the server decides) — newest first, each with the day they came, the
// department and a summary preview. Tapping one opens it (also from another day).
import StatusChip from './StatusChip'
import { formatDay } from '../utils/format'

const DAY = { day: 'numeric', month: 'short', year: 'numeric' } // "22 Oct 2026"

export default function PreviousVisits({ visits, onOpen }) {
  if (!visits.length) return null
  return (
    <section className="reports">
      <h3 className="reports-title">Previous visits <span className="reports-count">{visits.length}</span></h3>
      {visits.map((v) => (
        <button key={v.id} className="prev-visit" onClick={() => onOpen(v.id)}>
          <div className="prev-visit-head">
            <span className="prev-visit-date">{formatDay(v.visit_date, DAY)}</span>
            <span className="prev-visit-dept">{v.department_name}</span>
            <StatusChip status={v.status} />
          </div>
          {v.summary_excerpt ? <p className="prev-visit-summary">{v.summary_excerpt}</p> : null}
        </button>
      ))}
    </section>
  )
}
