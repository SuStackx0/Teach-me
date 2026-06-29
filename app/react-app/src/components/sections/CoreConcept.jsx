import { useState } from 'react'
import MermaidDiagram from '../MermaidDiagram.jsx'
import CodeBlock from '../CodeBlock.jsx'
import MarkdownText from '../MarkdownText.jsx'

export default function CoreConcept({ lesson, conceptIdx, goNext, goPrev, canGoPrev, canGoNext, mqScores, setMqScores }) {
  const concepts = lesson.core_concepts || []
  const concept = concepts[conceptIdx]
  const total = concepts.length
  const microQuiz = concept?.micro_quiz || []
  const [revealed, setRevealed] = useState({}) // idx → true

  if (!concept) return <div className="section-fade"><p>Concept not found.</p></div>

  const allAnswered = microQuiz.length === 0 || microQuiz.every((_, i) => mqScores[`${conceptIdx}_${i}`] !== undefined)

  return (
    <div className="section-fade">
      <span className="badge concept">◈ Concept {conceptIdx + 1}/{total}</span>
      <h2>{concept.title}</h2>

      {concept.explanation && (
        <div className="card">
          <MarkdownText text={concept.explanation} style={{ fontSize: '1.05rem', color: 'var(--text-primary)', maxWidth: '680px' }} />
        </div>
      )}

      {concept.analogy && (
        <div className="callout tip">
          <span className="callout-title">Analogy</span>
          <MarkdownText text={concept.analogy} />
        </div>
      )}

      {concept.diagram && <MermaidDiagram diagram={concept.diagram} />}

      {((concept.code_snippets || concept.code_examples || []).length > 0) && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Code Examples</h3>
          {(concept.code_snippets || concept.code_examples || []).map((ex, i) => <CodeBlock key={i} example={ex} />)}
        </div>
      )}

      {microQuiz.length > 0 && (
        <div className="mq-section">
          <span className="badge quiz" style={{ marginBottom: '1rem' }}>✦ Quick Check</span>
          {microQuiz.map((mq, i) => {
            const key = `${conceptIdx}_${i}`
            const isRevealed = revealed[i]
            const score = mqScores[key]
            return (
              <div key={i} style={{ marginBottom: i < microQuiz.length - 1 ? '1.5rem' : 0 }}>
                <div className="mq-question">{mq.question}</div>

                {!isRevealed ? (
                  <button onClick={() => setRevealed(r => ({ ...r, [i]: true }))}>Reveal Answer</button>
                ) : (
                  <>
                    <div className="callout tip mq-answer">
                      <span className="callout-title">Answer</span>
                      <MarkdownText text={mq.answer} />
                    </div>
                    {mq.explanation && (
                      <div className="callout insight">
                        <span className="callout-title">Why it matters</span>
                        <MarkdownText text={mq.explanation} />
                      </div>
                    )}
                    {score === undefined ? (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button className="success" onClick={() => setMqScores(s => ({ ...s, [key]: 1 }))}>Got it</button>
                        <button className="warning" onClick={() => setMqScores(s => ({ ...s, [key]: 0 }))}>Missed it</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono, monospace', color: score === 1 ? 'var(--success)' : 'var(--warning)' }}>
                        {score === 1 ? '● Got it' : '● Missed it — flagged for later'}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="nav-row">
        <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
        <button className="primary" onClick={goNext} disabled={!canGoNext || !allAnswered}>Next →</button>
      </div>
      {!allAnswered && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>Answer the quick check to continue</p>}
    </div>
  )
}
