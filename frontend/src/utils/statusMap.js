// Canonical visit_status -> doctor-UI label + chip colors.
// Mirrors the palette used across the app (teal/navy/green/amber).

export const STATUS_UI = {
  waiting:    { label: 'Waiting',    bg: '#eceff3', fg: '#6b7c93' },
  answering:  { label: 'Answering',  bg: '#e6f7f7', fg: '#0a8f8f' },
  answered:   { label: 'Answered',   bg: '#e8f0fe', fg: '#1a56c4' },
  summarised: { label: 'Summarised', bg: '#e6ffed', fg: '#2f855a' },
  done:       { label: 'Done',       bg: '#38a169', fg: '#ffffff' },
}

export function statusUi(status) {
  return STATUS_UI[status] ?? { label: status ?? '—', bg: '#eceff3', fg: '#6b7c93' }
}

// A visit the doctor can still act on (ready to review, not yet done).
export function isActionable(status) {
  return status === 'summarised' || status === 'answered'
}
