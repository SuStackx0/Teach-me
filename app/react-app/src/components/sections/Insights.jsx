import MarkdownText from '../MarkdownText.jsx'

export default function Insights({ lesson, goNext, goPrev, canGoPrev, canGoNext }) {
  const status = lesson._generation_status || 'complete'
  const insights = lesson.key_insights || []

  if (status !== 'complete' && insights.length === 0) {
    return (
      <div className="section-fade">
        <span className="badge insights">★ Key Insights</span>
        <h2>Key Insights</h2>
        <div className="generating-hint">
          <div className="spinner" />
          <div>Generating insights... auto-refreshing every 5s</div>
        </div>
      </div>
    )
  }

  const kindMap = { insight: 'insight', gotcha: 'gotcha', tip: 'tip' }
  const icons = { insight: '💡', gotcha: '⚠️', tip: '✅' }

  return (
    <div className="section-fade">
      <span className="badge insights">★ Key Insights</span>
      <h2>Key Insights</h2>
      {insights.length === 0 ? (
        <p>No insights in this lesson.</p>
      ) : (
        insights.map((item, i) => {
          const kind = kindMap[item.kind] || 'tip'
          return (
            <div key={i} className={`callout ${kind}`}>
              <span className="callout-title">{icons[item.kind] || '💡'} {item.title}</span>
              <MarkdownText text={item.text} />
            </div>
          )
        })
      )}
      <div className="nav-row">
        <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
        <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
      </div>
    </div>
  )
}
