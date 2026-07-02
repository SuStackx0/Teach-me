import { useState } from 'react'

export default function Quiz({ lesson, goNext, goPrev, canGoPrev, canGoNext, quizScore, setQuizScore }) {
  const status = lesson._generation_status || 'complete'
  const questions = lesson.quiz || []
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [revealed, setRevealed] = useState(new Set())

  if (status !== 'complete' && questions.length === 0) {
    return (
      <div className="section-fade">
        <span className="badge quiz">✦ Quiz</span>
        <h2>Knowledge Check</h2>
        <div className="generating-hint">
          <div className="spinner" />
          <div>Generating quiz... auto-refreshing every 5s</div>
        </div>
      </div>
    )
  }

  const total = questions.length
  const answered = revealed.size

  if (qIdx >= total && total > 0) {
    return (
      <div className="section-fade">
        <span className="badge quiz">✦ Quiz</span>
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div className="score-number">{quizScore}/{total}</div>
          <p style={{ marginTop: '0.5rem' }}>Quiz complete!</p>
        </div>
        <div className="nav-row">
          <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
          <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="section-fade">
        <span className="badge quiz">✦ Quiz</span>
        <h2>Knowledge Check</h2>
        <p>No quiz questions in this lesson.</p>
        <div className="nav-row">
          <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
          <button className="primary" onClick={goNext} disabled={!canGoNext}>Next →</button>
        </div>
      </div>
    )
  }

  const q = questions[qIdx]
  const qid = q.id ?? qIdx
  const qtype = q.type || 'multiple_choice'
  const isRevealed = revealed.has(qid)
  const accepted = (q.accepted_answers || [q.answer]).map(a => String(a).trim().toLowerCase())
  const userAnswer = answers[qid]

  function optionKey(opt) { return String(opt).trim().charAt(0).toLowerCase() }

  function submitAnswer(opt) {
    if (isRevealed) return
    setAnswers(a => ({ ...a, [qid]: opt }))
    setRevealed(r => new Set([...r, qid]))
    if (accepted.includes(optionKey(opt))) {
      setQuizScore(s => s + 1)
    }
  }

  function skipQuestion() {
    if (isRevealed) return
    setAnswers(a => ({ ...a, [qid]: '__skipped__' }))
    setRevealed(r => new Set([...r, qid]))
    // no score increment for skipped
  }

  function advanceQuestion() {
    if (qIdx < total - 1) setQIdx(i => i + 1)
    else setQIdx(total)
  }

  function isCorrect(opt) { return accepted.includes(optionKey(opt)) }

  const options = q.options || (qtype === 'true_false' ? ['A. True', 'B. False'] : [])
  const isSkipped = answers[qid] === '__skipped__'

  return (
    <div className="section-fade">
      <span className="badge quiz">✦ Quiz</span>
      <h2>Knowledge Check</h2>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(answered / total * 100)}%`, height: '100%', background: 'var(--success)' }} />
        </div>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{answered}/{total}</span>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', alignItems: 'center' }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Q{qIdx + 1} of {total}</span>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--accent)', background: 'rgba(42,107,79,0.10)', padding: '2px 8px', borderRadius: 5 }}>{qtype.replace(/_/g, ' ')}</span>
        </div>
        {q.code && <pre style={{ marginBottom: '1rem' }}><code>{q.code}</code></pre>}
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}>{q.question}</p>
      </div>

      {/* Options — all types with options array */}
      {options.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          {options.map((opt, i) => {
            const correct = isCorrect(opt)
            const selected = userAnswer === opt
            let cls = 'quiz-option'
            if (isRevealed && !isSkipped) {
              if (correct) cls += ' correct'
              else if (selected) cls += ' wrong'
              else cls += ' neutral'
            }
            return (
              <button key={i} className={cls} onClick={() => submitAnswer(opt)} disabled={isRevealed}>
                {isRevealed && !isSkipped && correct && <span style={{ marginRight: 8, fontWeight: 700 }}>✓</span>}
                {isRevealed && !isSkipped && selected && !correct && <span style={{ marginRight: 8, fontWeight: 700 }}>✗</span>}
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {/* Open ended or unknown type with no options */}
      {options.length === 0 && !isRevealed && (
        <div style={{ marginTop: '0.75rem' }}>
          <button className="primary" onClick={() => { setRevealed(r => new Set([...r, qid])); setAnswers(a => ({ ...a, [qid]: 'open' })) }}>Show Answer</button>
        </div>
      )}

      {/* Skip button — always visible before answering */}
      {!isRevealed && (
        <div style={{ marginTop: '0.5rem' }}>
          <button onClick={skipQuestion} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
            Skip →
          </button>
        </div>
      )}

      {isSkipped && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>Skipped.</div>
      )}

      {isRevealed && !isSkipped && q.explanation && (
        <div className="callout tip" style={{ marginTop: '0.75rem' }}>
          <span className="callout-title">Why</span>
          <span style={{ fontSize: '0.95rem', lineHeight: 1.65 }}>{q.explanation}</span>
        </div>
      )}

      {isRevealed && (
        <button className="primary" style={{ marginTop: '0.75rem' }} onClick={advanceQuestion}>
          {qIdx < total - 1 ? 'Next Question →' : 'Finish Quiz →'}
        </button>
      )}

      <div className="nav-row">
        <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
        <button className="primary" onClick={goNext} disabled={!canGoNext || answered === 0}>Next Section →</button>
      </div>
    </div>
  )
}
