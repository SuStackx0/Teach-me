export default function Hook({ lesson, goNext, goPrev, canGoPrev, canGoNext }) {
  const hook = lesson.hook || {}
  const meta = lesson.meta || {}
  const prereqs = meta.prerequisites || []
  const concepts = meta.concepts || []

  return (
    <div className="section-fade">
      <span className="badge hook">◉ Hook</span>
      <h1>{meta.title || "Today's Lesson"}</h1>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        {hook.problem && <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.75rem' }}>{hook.problem}</p>}
        {hook.narrative && <p style={{ fontSize: '1rem' }}>{hook.narrative}</p>}
      </div>

      {hook.why_it_matters && (
        <div className="callout insight">
          <span className="callout-title">Why This Matters</span>
          <span>{hook.why_it_matters}</span>
        </div>
      )}

      {(prereqs.length > 0 || concepts.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          {prereqs.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prerequisites</h3>
              <ul>{prereqs.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          {concepts.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>You'll Learn</h3>
              <ul>{concepts.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="nav-row">
        <span />
        <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
      </div>
    </div>
  )
}
