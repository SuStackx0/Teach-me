import MarkdownText from '../MarkdownText.jsx'

export default function Scenario({ lesson, goNext, goPrev, canGoPrev, canGoNext }) {
  const topic = lesson?.meta?.title || 'This Concept'
  const data = lesson?.scenario
  const status = lesson?._generation_status || 'complete'

  if (status !== 'complete' && !data) {
    return (
      <div className="section-fade">
        <span className="badge insights">◈ Scenario</span>
        <h2>Real-World Scenario</h2>
        <div className="generating-hint">
          <div className="spinner" />
          <div>Generating scenario... auto-refreshing every 5s</div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="section-fade">
        <span className="badge insights">◈ Scenario</span>
        <h2>Real-World Scenario</h2>
        <div className="callout tip">
          <span className="callout-title">Not available</span>
          <p>This lesson was generated before the scenario feature. Run <code>/teach</code> on this topic again to get a scenario.</p>
        </div>
        <div className="nav-row">
          <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
          <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="section-fade">
      <span className="badge insights">◈ Scenario</span>
      <h2>{data.title}</h2>

      <div className="callout insight">
        <span className="callout-title">The Problem</span>
        <MarkdownText text={data.problem} />
      </div>

      <div className="callout tip">
        <span className="callout-title">The System</span>
        <MarkdownText text={data.system_description} />
      </div>

      <div className="card" style={{ marginTop: '1.25rem', padding: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>How {topic} Applies</h3>
        <MarkdownText text={data.how_concept_applies} />
      </div>

      <div className="callout gotcha" style={{ marginTop: '1.25rem' }}>
        <span className="callout-title">Without This</span>
        <MarkdownText text={data.what_breaks_without_it} />
      </div>

      {data.real_world_examples?.length > 0 && (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>Real Systems Using This</h3>
          <ul>
            {data.real_world_examples.map((ex, i) => <li key={i}>{ex}</li>)}
          </ul>
        </>
      )}

      <div className="nav-row">
        <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
        <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
      </div>
    </div>
  )
}
