// Small stats strip: seen today (done), remaining (actionable), and the
// selected patient's answered Q&A count.
export default function StatsStrip({ seenToday, remaining, answered, total }) {
  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-num">{seenToday}</div>
        <div className="stat-lbl">Seen today</div>
      </div>
      <div className="stat">
        <div className="stat-num">{remaining}</div>
        <div className="stat-lbl">Remaining</div>
      </div>
      <div className="stat">
        <div className="stat-num">{total > 0 ? `${answered}/${total}` : '—'}</div>
        <div className="stat-lbl">Q&amp;A</div>
      </div>
    </div>
  )
}
