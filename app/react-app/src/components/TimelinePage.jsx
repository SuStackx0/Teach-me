import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score === null || score === undefined) return 'var(--text-muted)'
  if (score >= 0.8) return 'var(--success)'
  if (score >= 0.6) return 'var(--warning)'
  return 'var(--text-muted)'
}

function fmtMonthYear(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function fmtShortDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function monthKey(dateStr) {
  if (!dateStr) return 'unknown'
  return dateStr.slice(0, 7) // "YYYY-MM"
}

function groupByMonth(sessions) {
  const groups = []
  const seen = new Map()
  for (const s of sessions) {
    const key = monthKey(s.date)
    if (!seen.has(key)) {
      const group = { key, label: fmtMonthYear(s.date), sessions: [] }
      groups.push(group)
      seen.set(key, group)
    }
    seen.get(key).sessions.push(s)
  }
  return groups
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SessionRow({ session, navigate }) {
  const dotColor = scoreColor(session.quiz_score_pct)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        padding: '0.75rem 0',
        position: 'relative',
      }}
    >
      {/* Dot column — fixed 20px wide so the vertical line can be anchored */}
      <div
        style={{
          width: 20,
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 4,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: dotColor,
            position: 'relative',
            zIndex: 1,
            boxShadow: '0 0 0 3px var(--bg)',
          }}
        />
      </div>

      {/* Content + date */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
        }}
      >
        {/* Left: title + badges */}
        <div style={{ minWidth: 0 }}>
          <div
            onClick={() => navigate(`/lesson/${session.slug}`)}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
            style={{
              fontWeight: 600,
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              marginBottom: '0.3rem',
              lineHeight: 1.4,
              transition: 'color 0.13s',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.title || session.slug}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {session.domain && (
              <span
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '0.7rem',
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                }}
              >
                {session.domain}
              </span>
            )}
            {session.time_spent_minutes > 0 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {session.time_spent_minutes} min
              </span>
            )}
          </div>
        </div>

        {/* Right: short date */}
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            paddingTop: 2,
          }}
        >
          {fmtShortDate(session.date)}
        </div>
      </div>
    </div>
  )
}

function MonthGroup({ group, navigate }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Month section divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.125rem',
        }}
      >
        <span
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {group.label}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Rows with a vertical connector line behind the dot column */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: 9,         // center of the 20px dot column
            top: 0,
            bottom: 0,
            width: 1,
            background: 'var(--border)',
            zIndex: 0,
          }}
        />
        {group.sessions.map((s, i) => (
          <SessionRow key={s.slug || i} session={s} navigate={navigate} />
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/memory')
      .then(r => r.ok ? r.json() : Promise.reject('Server error'))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Could not load session history.'); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="library-page">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: 'var(--text-muted)',
          paddingTop: '2rem',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.875rem',
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            border: '2px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        Loading timeline...
      </div>
    </div>
  )

  if (error) return (
    <div className="library-page">
      <p style={{ color: 'var(--error)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
        {error}
      </p>
    </div>
  )

  const { completed = [], streak = 0 } = data || {}

  // Sort most-recent first
  const sorted = [...completed].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })

  const groups = groupByMonth(sorted)

  // Average score (only show if >= 3 sessions have a score)
  const scored = sorted.filter(s => s.quiz_score_pct !== null && s.quiz_score_pct !== undefined)
  const avgScore =
    scored.length >= 3
      ? Math.round((scored.reduce((sum, s) => sum + s.quiz_score_pct, 0) / scored.length) * 100)
      : null

  if (sorted.length === 0) {
    return (
      <div className="library-page">
        <div className="library-header">
          <h1>Session Timeline</h1>
          <p>Your study history</p>
        </div>
        <p
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
            paddingTop: '1rem',
          }}
        >
          No sessions yet. Complete your first lesson to see history here.
        </p>
      </div>
    )
  }

  return (
    <div className="library-page">
      <div className="library-header">
        <h1>Session Timeline</h1>
        <p>Your study history</p>
      </div>

      {streak > 0 && (
        <div className="stats-callout streak-callout">
          <span className="streak-pill">🔥 {streak} day streak</span>
        </div>
      )}

      {/* Session count + optional average score */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          marginBottom: '1.75rem',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
        }}
      >
        <span>
          {sorted.length} {sorted.length === 1 ? 'session' : 'sessions'} completed
        </span>
        {avgScore !== null && (
          <>
            <span style={{ color: 'var(--border)', userSelect: 'none' }}>·</span>
            <span>Average score: {avgScore}%</span>
          </>
        )}
      </div>

      {/* Timeline */}
      <div>
        {groups.map(group => (
          <MonthGroup key={group.key} group={group} navigate={navigate} />
        ))}
      </div>
    </div>
  )
}
