export default function Summary({ lesson, goNext, goPrev, canGoPrev, canGoNext }) {
  const status = lesson._generation_status || 'complete'
  const summary = lesson.summary || {}
  const further = lesson.further_reading || []
  const kata = lesson.design_kata
  const nextTopics = lesson.next_topics || []

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

      {nextTopics.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Up Next</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {nextTopics.map((t, i) => (
              <div key={t.slug} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '0.75rem 1rem',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--accent-dim)', border: '1.5px solid var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.65rem',
                  color: 'var(--accent-bright)', fontWeight: 700, marginTop: 1,
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>{t.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3, fontFamily: 'IBM Plex Mono, monospace' }}>{t.why}</div>
                  {t.concepts?.length > 0 && (
                    <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {t.concepts.map((c, j) => <span key={j} className="pill" style={{ fontSize: '0.7rem', padding: '1px 7px' }}>{c}</span>)}
                    </div>
                  )}
                </div>
                {t.difficulty && (
                  <div style={{ flexShrink: 0, fontSize: '0.7rem', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-muted)', marginTop: 2 }}>{t.difficulty}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="nav-row">
        <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
        <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
      </div>
    </div>
  )
}
