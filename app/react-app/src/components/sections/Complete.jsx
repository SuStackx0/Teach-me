import { useState } from 'react'

function elapsed(startTime) {
  const secs = Math.floor((Date.now() - startTime) / 1000)
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  if (h) return `${h}h ${m % 60}m`
  return `${m}m`
}

function daysUntilReview(scoreInput) {
  const s = (scoreInput || '').trim().toLowerCase()
  if (!s || s === 'skipped') return 7
  try {
    const [a, b] = s.split('/')
    const pct = parseFloat(a) / parseFloat(b)
    if (pct >= 0.8) return 14
    if (pct >= 0.6) return 7
    return 2
  } catch { return 7 }
}

export default function Complete({ lesson, quizScore, startTime, goPrev }) {
  const meta = lesson.meta || {}
  const summary = lesson.summary || {}
  const quizTotal = (lesson.quiz || []).length
  const timeSpent = Math.round((Date.now() - startTime) / 60000 * 10) / 10

  const [debrief, setDebrief] = useState('')
  const [scoreInput, setScoreInput] = useState(quizTotal ? `${quizScore}/${quizTotal}` : '')
  const [logged, setLogged] = useState(false)
  const [logging, setLogging] = useState(false)
  const [streak, setStreak] = useState(null)
  const [logError, setLogError] = useState(null)

  async function handleLog() {
    setLogging(true)
    setLogError(null)
    try {
      const res = await fetch('/api/session/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: meta.slug || 'unknown',
          title: meta.title || 'Unknown',
          domain: meta.domain || '',
          debrief_phrase: debrief,
          quiz_score_input: scoreInput,
          time_spent_minutes: timeSpent,
        }),
      })
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      setStreak(data.streak)
      setLogged(true)
    } catch (e) {
      setLogError('Could not save session — is the server running?')
    }
    setLogging(false)
  }

  const days = daysUntilReview(scoreInput)
  const nextDate = new Date(Date.now() + days * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const takeaways = summary.takeaways || []

  return (
    <div className="section-fade">
      <div className="score-hero">
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 12 }}>Session Complete</div>
        <div className="score-number">{quizScore}/{quizTotal}</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Quiz Score</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{quizScore}/{quizTotal}</div>
          <div className="stat-label">Quiz</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#00D4FF' }}>{elapsed(startTime)}</div>
          <div className="stat-label">Time Spent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{days}d</div>
          <div className="stat-label">Next Review</div>
        </div>
      </div>

      {takeaways.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3>What You Learned</h3>
          <div style={{ marginTop: '0.5rem' }}>
            {takeaways.map((t, i) => <span key={i} className="pill">{t.slice(0, 60)}{t.length > 60 ? '...' : ''}</span>)}
          </div>
        </div>
      )}

      {!logged ? (
        <div className="debrief-form">
          <h3>Archive this session</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>One phrase is enough — just name what tripped you up. Logging locks in your score.</p>
          <div className="form-row">
            <label>What gave you trouble? (optional)</label>
            <input type="text" value={debrief} onChange={e => setDebrief(e.target.value)} placeholder="e.g. NTK scaling math, ALiBi slope derivation..." />
          </div>
          <div className="form-row">
            <label>Quiz score</label>
            <input type="text" value={scoreInput} onChange={e => setScoreInput(e.target.value)} placeholder="e.g. 4/5 or skipped" />
          </div>
          {logError && <p style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{logError}</p>}
          <button className="primary" style={{ width: '100%', padding: '0.75rem' }} onClick={handleLog} disabled={logging}>
            {logging ? 'Saving...' : 'Log Session & Archive'}
          </button>
        </div>
      ) : (
        <div className="success-banner">
          <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>{streak && streak >= 3 ? '🔥' : '✓'}</div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>
            {streak && streak > 1 ? `${streak} day streak` : 'Day 1 — let\'s build a streak'}
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Session logged and archived.<br />
            Next review in <strong style={{ color: 'var(--text-primary)' }}>{days} days</strong> ({nextDate}).
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <button onClick={goPrev}>← Review Lesson</button>
      </div>
    </div>
  )
}
