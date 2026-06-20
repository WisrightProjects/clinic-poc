import { statusUi } from '../utils/statusMap'

export default function StatusChip({ status }) {
  const ui = statusUi(status)
  return (
    <span className="chip" style={{ background: ui.bg, color: ui.fg }}>
      {ui.label}
    </span>
  )
}
