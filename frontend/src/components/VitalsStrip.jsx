// CLINIC-024: today's vitals, entered by the attender as fields. Every vital has its place;
// one not measured says "Not recorded". The labels and values come from the server's
// vitals_display (the same text the app and the summary line use).
export default function VitalsStrip({ display }) {
  // Empty for a visit with only the spoken vitals answer (older lists — the server decides):
  // no "Not recorded" row next to answered vitals.
  if (!display?.length) return null
  return (
    <div className="vitals" aria-label="Today's vitals">
      {display.map(({ label, value }) => (
        <div key={label} className="vital">
          <div className="vital-lbl">{label}</div>
          <div className={value ? 'vital-val' : 'vital-val vital-none'}>{value ?? 'Not recorded'}</div>
        </div>
      ))}
    </div>
  )
}
