// CLINIC-030: the trends table on the doctor card — the same measurement across a returning
// patient's visits (oldest left, today last), from the visit detail's `trends`. Values are
// shown exactly as recorded; the change is up / down / same only — never better or worse.
// HbA1c comes from the reports read by the AI, which list only abnormal results, so a visit
// without it says "not listed" (it may have been normal), not "not recorded".
import { formatDay, SHORT_DAY } from '../utils/format'
import { todayKey } from '../utils/queue'

const ARROW = { up: '↑', down: '↓', same: '→' }
// The open visit is the last column: "Today" (registered today, or back in today's queue after
// tests), or its day when an earlier visit is opened.
const columnLabel = (v) => {
  if (!v.today) return formatDay(v.visit_date, SHORT_DAY)
  return [v.visit_date, v.queue_date].includes(todayKey()) ? 'Today' : `${formatDay(v.visit_date, SHORT_DAY)} (this visit)`
}
// A cell without a value: why.
const missing = (val) => (val?.notListed ? 'not listed' : val?.unread ? 'check photos' : val?.repeat ? 'same report' : '—')
const SOURCE = { vitals: 'vitals · entered', registration: 'registration · entered', reports: 'from reports · AI-read' }

function Change({ change }) {
  if (!change) return <span className="dc-muted">—</span>
  if (change.every((p) => p.dir === 'same')) return <span className="dc-muted">→ no change</span>
  return change.map((p, i) => (
    <span key={i}>{i ? ' / ' : ''}{ARROW[p.dir]}{p.dir === 'same' ? '' : ` ${p.by}`}</span>
  ))
}

export default function TrendsTable({ trends, onOpenVisit }) {
  return (
    <>
      <div className="trd-scroll">
        <table className="trd-table">
          <thead>
            <tr>
              <th>Test</th>
              {trends.visits.map((v) => (
                <th key={v.id} className={v.today ? 'trd-today' : ''}>{columnLabel(v)}</th>
              ))}
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {trends.rows.map((r) => (
              <tr key={r.key}>
                <td className="trd-test">{r.label}<small>{SOURCE[r.source]}</small></td>
                {r.values.map((val, i) => {
                  const v = trends.visits[i]
                  if (!val?.text) {
                    return (
                      <td key={v.id} className={`trd-missing${v.today ? ' trd-today' : ''}`}>
                        {missing(val)}
                      </td>
                    )
                  }
                  // A report value carries its report's date: the patient may bring an older report.
                  return (
                    <td key={v.id} className={v.today ? 'trd-today' : ''}>
                      {v.today ? val.text : <button className="trd-link" onClick={() => onOpenVisit(v.id)}>{val.text}</button>}
                      {val.date ? <small className="trd-date">report {val.date}</small> : null}
                    </td>
                  )
                })}
                <td><Change change={r.change} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dc-note">
        — = not recorded that visit · not listed = that visit's reports list only abnormal results · check photos =
        some report photos or values were not read · same report = the earlier report sent again · Click a value to open
        that visit. Values as recorded, nothing estimated; arrows show up / down only.
      </p>
    </>
  )
}
