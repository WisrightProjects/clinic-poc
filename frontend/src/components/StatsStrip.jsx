// Small stats strip: seen (done) and remaining (actionable) for the day shown in the queue
// ("Seen today" on today, "Seen" on another day), and the selected patient's answered Q&A count.
export default function StatsStrip({ seenToday, remaining, answered, total, isToday = true }) {
  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-num">{seenToday}</div>
        <div className="stat-lbl">{isToday ? 'Seen today' : 'Seen'}</div>
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
