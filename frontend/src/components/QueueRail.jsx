// Left rail: the patient queue in token order with a status chip per row.
// Selection is owned by the page and preserved across polls (AC3).
import StatusChip from './StatusChip'

export default function QueueRail({ visits, selectedId, onSelect, isLoading, error, onRetry }) {
  return (
    <aside className="rail">
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
