// Q&A drill-down: each question with its Tanglish transcript rendered verbatim
// (read-only, italic), in order_index order. Multibyte text shown intact (AC10).
export default function QaList({ qa }) {
  return (
    <div className="qa-list">
      {qa.map((item, i) => (
        <div className="qa-item" key={item.id}>
          <div className="qa-q">
            <span className="qa-num">{i + 1}</span>
            {item.text}
          </div>
          {item.transcript ? (
            <div className="qa-a">“{item.transcript}”</div>
          ) : (
            <div className="qa-a qa-a--empty">No answer recorded</div>
          )}
        </div>
      ))}
    </div>
  )
}
