export default function Summary({ lesson, goNext, goPrev, canGoPrev, canGoNext }) {
  const status = lesson._generation_status || 'complete'
  const summary = lesson.summary || {}
  const further = lesson.further_reading || []
  const kata = lesson.design_kata

  if (status !== 'complete' && !summary.one_liner) {
    return (
      <div className="section-fade">
        <span className="badge summary">◎ Summary</span>
        <h2>Summary</h2>
        <div className="generating-hint">
          <div className="spinner" />
          <div>Generating summary... auto-refreshing every 5s</div>
        </div>
      </div>
    )
  }

  const kindIcons = { paper: '📄', blog: '📝', code: '💻', docs: '📚', video: '🎥' }

  return (
    <div className="section-fade">
      <span className="badge summary">◎ Summary</span>
      <h2>Summary</h2>

      {summary.one_liner && (
        <div className="card">
          <p style={{ fontStyle: 'italic', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{summary.one_liner}</p>
        </div>
      )}

      {(summary.takeaways || []).length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Key Takeaways</h3>
          {summary.takeaways.map((t, i) => (
            <div key={i} className="callout tip" style={{ margin: '0.5rem 0' }}>
              <span>{t}</span>
            </div>
          ))}
        </div>
      )}

      {kata && kata.prompt && (
        <div className="apply-it-card" style={{ marginTop: '1.5rem' }}>
          <div className="apply-it-label">Apply It</div>
          <p style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}>{kata.prompt}</p>
        </div>
      )}

      {further.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>Further Reading</h3>
          {further.map((item, i) => {
            const icon = kindIcons[item.kind] || '🔗'
            return (
              <div key={i} className="reading-card">
                <div style={{ fontWeight: 600 }}>
                  {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{icon} {item.title}</a> : `${icon} ${item.title}`}
                </div>
                {item.why && <div className="why">{item.why}</div>}
              </div>
            )
          })}
        </div>
      )}

      <div className="nav-row">
        <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
        <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
      </div>
    </div>
  )
}
