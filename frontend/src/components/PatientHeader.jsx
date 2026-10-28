import StatusChip from './StatusChip'

// CLINIC-023: weight, height and New / Follow-up from registration, and the patient's mobile
// (detail header only — the queue list doesn't show it). pg sends NUMERIC columns as strings.
export default function PatientHeader({ visit, mobile }) {
  const demo = [
    visit.sex,
    visit.age != null ? `${visit.age} yrs` : null,
    visit.weight_kg != null ? `${Number(visit.weight_kg)} kg` : null,
    visit.height_cm != null ? `${Number(visit.height_cm)} cm` : null,
    visit.patient_type === 'follow_up' ? 'Follow-up' : null,
  ].filter(Boolean).join(', ')

  return (
    <div className="dm-top">
      <div>
        <div className="dm-name">{visit.patient_name}</div>
        <div className="dm-sub">
          Token {visit.queue_token}
          {demo ? ` · ${demo}` : ''}
          {mobile ? ` · Mobile ${mobile}` : ''}
        </div>
      </div>
      <StatusChip status={visit.status} />
    </div>
  )
}
