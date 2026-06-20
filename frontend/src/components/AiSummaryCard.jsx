// AI summary card. Reads the MOCK summary as-is (generated_by='mock'); no client
// generation. Shows a clear placeholder when a visit is submitted but the summary
// is not ready yet (status 'answered' vs 'summarised') — AC6.
export default function AiSummaryCard({ summary, status }) {
  if (!summary) {
    return (
      <div className="sum-card sum-card--pending">
        <span className="ai-badge">AI Summary</span>
        <p className="sum-pending">
          {status === 'answered'
            ? 'Summary not ready yet — answers submitted, awaiting AI summary.'
            : 'No summary available for this visit.'}
        </p>
      </div>
    )
  }
  return (
    <div className="sum-card">
      <div className="sum-hdr">
        <span className="ai-badge">AI Summary</span>
        <span className="sum-by">generated · {summary.generated_by}</span>
      </div>
      <p className="sum-text">{summary.summary_text}</p>
    </div>
  )
}
