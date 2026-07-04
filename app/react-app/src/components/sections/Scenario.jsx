import { useState, useEffect, useCallback } from 'react'
import MarkdownText from '../MarkdownText.jsx'

export default function Scenario({ lesson, goNext, goPrev, canGoPrev, canGoNext }) {
  const slug = lesson?.meta?.slug
  const topic = lesson?.meta?.title || 'This Concept'

  const [status, setStatus] = useState('loading') // 'loading' | 'success' | '503' | 'error'
  const [data, setData] = useState(null)

  const fetchScenario = useCallback(async () => {
    if (!slug) {
      setStatus('error')
      return
    }
    setStatus('loading')
    setData(null)
    try {
      const res = await fetch(`/api/scenario/${slug}`)
      if (res.status === 503) {
        setStatus('503')
        return
      }
      if (!res.ok) {
        setStatus('error')
        return
      }
      const json = await res.json()
      setData(json)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }, [slug])

  useEffect(() => {
    fetchScenario()
  }, [fetchScenario])

  return (
    <div className="section-fade">
      <span className="badge insights">◈ Scenario</span>

      {status === 'loading' && (
        <>
          <h2>Real-World Scenario</h2>
          <div className="generating-hint">
            <div className="spinner" />
            <div>Generating scenario...</div>
          </div>
        </>
      )}

      {status === '503' && (
        <>
          <h2>Real-World Scenario</h2>
          <div className="callout gotcha">
            <span className="callout-title">Package Missing</span>
            <p>
              Scenario generation requires the <code>anthropic</code> package.
              Run <code>pip install anthropic</code> then restart the server.
            </p>
          </div>
          <div className="nav-row">
            <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
            <button onClick={fetchScenario}>Try Again</button>
            <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <h2>Real-World Scenario</h2>
          <div className="callout gotcha">
            <span className="callout-title">Could Not Load Scenario</span>
            <p>The scenario could not be generated. The server may be unavailable or the lesson slug is missing.</p>
          </div>
          <div className="nav-row">
            <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
            <button onClick={fetchScenario}>Try Again</button>
            <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
          </div>
        </>
      )}

      {status === 'success' && data && (
        <>
          <h2>{data.title}</h2>

          <div className="callout insight">
            <span className="callout-title">The Problem</span>
            <p>{data.problem}</p>
          </div>

          <div className="callout tip">
            <span className="callout-title">The System</span>
            <p>{data.system_description}</p>
          </div>

          <div className="card" style={{ marginTop: '1.25rem', padding: '1.25rem' }}>
            <h3 style={{ marginTop: 0 }}>How {topic} Applies</h3>
            <MarkdownText text={data.how_concept_applies} />
          </div>

          <div className="callout gotcha" style={{ marginTop: '1.25rem' }}>
            <span className="callout-title">Without This</span>
            <p>{data.what_breaks_without_it}</p>
          </div>

          {data.real_world_examples && data.real_world_examples.length > 0 && (
            <>
              <h3>Real Systems Using This</h3>
              <ul>
                {data.real_world_examples.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            </>
          )}

          <div className="nav-row">
            <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
            <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
          </div>
        </>
      )}
    </div>
  )
}
