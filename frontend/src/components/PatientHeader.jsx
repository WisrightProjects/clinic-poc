import StatusChip from './StatusChip'

export default function PatientHeader({ visit }) {
  const demo = [
    visit.sex,
    visit.age != null ? `${visit.age} yrs` : null,
  ].filter(Boolean).join(', ')

  return (
    <div className="dm-top">
      <div>
        <div className="dm-name">{visit.patient_name}</div>
        <div className="dm-sub">
          Token {visit.token_number}
          {demo ? ` · ${demo}` : ''}
        </div>
      </div>
      <StatusChip status={visit.status} />
    </div>
  )
}
