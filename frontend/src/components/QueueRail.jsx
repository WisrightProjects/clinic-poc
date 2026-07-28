// Left rail: the patient queue in token order with a status chip per row.
// Selection is owned by the page and preserved across polls (AC3).
import StatusChip from './StatusChip'

// Clinic name and doctor are static placeholders — the POC has no clinic entity
// and no doctor login to populate them (auth is just the x-role header). The date
// is real (today), formatted like the mockup ("Tuesday, 13 May 2026").
const CLINIC_NAME = 'CarePoint Clinic'
const DOCTOR_LINE = 'Dr. S. Ramesh · General'

export default function QueueRail({ visits, selectedId, onSelect, isLoading, error, onRetry }) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <aside className="rail">
      <div className="rail-clinic">
        <div className="rail-clinic-name">{CLINIC_NAME}</div>
        <div className="rail-clinic-date">{today}</div>
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
        <ul className="rail-list">
          {visits.map((v) => (
            <li
              key={v.id}
              className={`rail-item${v.id === selectedId ? ' rail-item--sel' : ''}`}
              onClick={() => onSelect(v.id)}
            >
              <span className="rail-token">{v.token_number}</span>
              <span className="rail-name">{v.patient_name}</span>
              <StatusChip status={v.status} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
