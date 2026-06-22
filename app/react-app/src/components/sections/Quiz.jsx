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
  const correctAnswer = String(q.answer || '').trim().toLowerCase()
  const accepted = (q.accepted_answers || [q.answer]).map(a => String(a).trim().toLowerCase())
  const userAnswer = answers[qid]
  const allAnswered = revealed.size >= total

  function submitAnswer(opt) {
    if (isRevealed) return
    setAnswers(a => ({ ...a, [qid]: opt }))
    setRevealed(r => new Set([...r, qid]))
    if (String(opt).trim().toLowerCase() in Object.fromEntries(accepted.map(a => [a, true]))) {
      setQuizScore(s => s + 1)
    }
  }

  function isCorrect(opt) { return accepted.includes(String(opt).trim().toLowerCase()) }

  const options = q.options || (qtype === 'true_false' ? ['True', 'False'] : [])

  return (
    <div className="section-fade">
      <span className="badge quiz">✦ Quiz</span>
      <h2>Knowledge Check</h2>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(answered / total * 100)}%`, height: '100%', background: 'linear-gradient(90deg,var(--success),#00D4FF)' }} />
        </div>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{answered}/{total}</span>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', alignItems: 'center' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Q{qIdx + 1} of {total}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--accent)', background: 'rgba(124,92,255,0.1)', padding: '2px 8px', borderRadius: 5 }}>{qtype.replace(/_/g, ' ')}</span>
        </div>
        {q.code && <pre style={{ marginBottom: '1rem' }}><code>{q.code}</code></pre>}
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}>{q.question}</p>
      </div>

      {/* MCQ / true_false / code_reading */}
      {['multiple_choice', 'true_false', 'code_reading', 'mcq'].includes(qtype) && options.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          {options.map((opt, i) => {
            const correct = isCorrect(opt)
            const selected = userAnswer === opt
            let cls = 'quiz-option'
            if (isRevealed) {
              if (correct) cls += ' correct'
              else if (selected) cls += ' wrong'
              else cls += ' neutral'
            }
            return (
              <button key={i} className={cls} onClick={() => submitAnswer(opt)} disabled={isRevealed}>
                {isRevealed && correct && <span style={{ marginRight: 8, fontWeight: 700 }}>✓</span>}
                {isRevealed && selected && !correct && <span style={{ marginRight: 8, fontWeight: 700 }}>✗</span>}
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {/* Open ended */}
      {qtype === 'open_ended' && !isRevealed && (
        <div style={{ marginTop: '0.75rem' }}>
          <button className="primary" onClick={() => { setRevealed(r => new Set([...r, qid])); setAnswers(a => ({ ...a, [qid]: 'open' })) }}>Show Answer</button>
        </div>
      )}

      {isRevealed && q.explanation && (
        <div className="callout tip" style={{ marginTop: '0.75rem' }}>
          <span className="callout-title">Explanation</span>
          <span>{q.explanation}</span>
        </div>
      )}

      {isRevealed && qIdx < total - 1 && (
        <button className="primary" style={{ marginTop: '0.75rem' }} onClick={() => setQIdx(i => i + 1)}>Next Question →</button>
      )}
      {isRevealed && qIdx === total - 1 && (
        <button className="primary" style={{ marginTop: '0.75rem' }} onClick={() => setQIdx(total)}>Finish Quiz →</button>
      )}

      <div className="nav-row">
        <button onClick={goPrev} disabled={!canGoPrev}>← Back</button>
        <button className="primary" onClick={goNext} disabled={!canGoNext || !allAnswered}>Next Section →</button>
      </div>
    </div>
  )
}
