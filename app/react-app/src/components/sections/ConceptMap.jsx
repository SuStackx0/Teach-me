import MermaidDiagram from '../MermaidDiagram.jsx'

export default function ConceptMap({ lesson, goNext, goPrev, canGoPrev, canGoNext }) {
  const cm = lesson.concept_map || {}
  const fitsWith = cm.fits_with || []

  return (
    <div className="section-fade">
      <span className="badge concept">◈ Concept Map</span>
      <h2>Concept Map</h2>

      {cm.summary && (
        <div className="card">
          <p style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{cm.summary}</p>
        </div>
      )}

      {cm.diagram && (
        <div style={{ marginTop: '1rem' }}>
          <MermaidDiagram diagram={cm.diagram} />
        </div>
      )}

      {fitsWith.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Related Topics</h3>
          <div className="fits-with-list">
            {fitsWith.map((item, i) => {
              const topic = typeof item === 'string' ? item : item.topic
              const relation = typeof item === 'object' ? item.relation : ''
              return (
                <div key={i} className="callout">
                  <span className="callout-title">{topic}</span>
                  {relation && <span>{relation}</span>}
                </div>
              )
            })}
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
