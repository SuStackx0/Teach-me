import { useState } from 'react'
import CodeBlock from '../CodeBlock.jsx'

export default function Challenge({ lesson, goNext, goPrev, canGoPrev, canGoNext }) {
  const status = lesson._generation_status || 'complete'
  const challenge = lesson.coding_challenge || {}
  const [hintsRevealed, setHintsRevealed] = useState(0)
  const [showSolution, setShowSolution] = useState(false)

  if (status !== 'complete' && !challenge.title) {
    return (
      <div className="section-fade">
        <span className="badge challenge">⚡ Challenge</span>
        <h2>Coding Challenge</h2>
        <div className="generating-hint">
          <div className="spinner" />
          <div>Generating challenge... auto-refreshing every 5s</div>
        </div>
      </div>
    )
  }

  const hints = challenge.hints || []

  return (
    <div className="section-fade">
      <span className="badge challenge">⚡ Challenge</span>
      <h2>{challenge.title || 'Coding Challenge'}</h2>

      {challenge.prompt && (
        <div className="card">
          <p style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{challenge.prompt}</p>
        </div>
      )}

      {(challenge.requirements || []).length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <h3>Requirements</h3>
          <ul>{challenge.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      {challenge.starter_code && (
        <div style={{ marginTop: '1rem' }}>
          <CodeBlock example={{ filename: 'starter_code.py', language: 'python', code: challenge.starter_code, line_by_line: [] }} />
        </div>
      )}

      {hints.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          {hintsRevealed > 0 && hints.slice(0, hintsRevealed).map((h, i) => (
            <div key={i} className="callout tip">
              <span className="callout-title">Hint {i + 1}</span>
              <span>{h}</span>
            </div>
          ))}
          {hintsRevealed < hints.length && (
            <button onClick={() => setHintsRevealed(n => n + 1)}>Reveal Hint {hintsRevealed + 1}</button>
          )}
        </div>
      )}

      {challenge.solution && (
        <div style={{ marginTop: '1.25rem' }}>
          {!showSolution ? (
            <button onClick={() => setShowSolution(true)}>Show Solution</button>
          ) : (
            <>
              <h3>Solution</h3>
              <CodeBlock example={{ filename: 'solution.py', language: 'python', code: challenge.solution, line_by_line: [] }} />
            </>
          )}
        </div>
      )}

      {challenge.extension && (
        <div className="callout" style={{ marginTop: '1rem' }}>
          <span className="callout-title">Extension Challenge</span>
          <span>{challenge.extension}</span>
        </div>
      )}

      <div className="nav-row">
        <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
        <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
      </div>
    </div>
  )
}
