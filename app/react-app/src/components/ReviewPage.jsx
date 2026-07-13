import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function fmtPct(p) {
  if (p === null || p === undefined) return null
  return `${Math.round(p * 100)}%`
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StarDisplay({ rating }) {
  if (!rating) return null
  return (
    <span style={{ color: 'var(--accent)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function ReviewCard({ item, accent }) {
  const score = fmtPct(item.quiz_score_pct)
  const absDay = Math.abs(item.days_until)
  const dueLabel = item.days_until < 0
    ? `${absDay}d overdue`
    : item.days_until === 0
    ? 'Due today'
    : `Due in ${item.days_until}d`

  return (
    <Link
      to={`/lesson/${item.slug}`}
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.875rem 1rem',
        background: 'var(--surface)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600,
            color: 'var(--text)',
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {item.title}
          </div>
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginTop: '0.3rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            {item.domain && <span>{item.domain}</span>}
            {item.date && <span>{fmtDate(item.date)}</span>}
            {score && <span style={{ color: 'var(--text-secondary)' }}>quiz {score}</span>}
            {item.self_rating && <StarDisplay rating={item.self_rating} />}
          </div>
        </div>
        <div style={{
          flexShrink: 0,
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: accent,
          whiteSpace: 'nowrap',
        }}>
          {dueLabel}
        </div>
      </div>
    </Link>
  )
}

function Section({ title, items, accent, emptyMsg }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{
        fontSize: '0.8rem',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: accent,
        fontFamily: 'IBM Plex Mono, monospace',
        marginBottom: '0.75rem',
        fontWeight: 600,
      }}>
        {title} {items.length > 0 && (
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({items.length})</span>
        )}
      </h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{emptyMsg}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map(item => (
            <ReviewCard key={item.slug} item={item} accent={accent} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function ReviewPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/review-queue')
      .then(r => r.ok ? r.json() : Promise.reject('Server error'))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Could not load review queue.'); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="library-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', paddingTop: '2rem' }}>
        <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        Loading review queue...
      </div>
    </div>
  )

  if (error) return (
    <div className="library-page">
      <p style={{ color: 'var(--error)' }}>{error}</p>
    </div>
  )

  const { overdue = [], due_soon = [], upcoming = [] } = data || {}
  const total = overdue.length + due_soon.length

  return (
    <div className="library-page">
      <div className="library-header">
        <h1>Review Queue</h1>
        <p>
          {total === 0
            ? 'You\'re all caught up — nothing overdue or due this week.'
            : `${total} lesson${total === 1 ? '' : 's'} need attention`}
        </p>
      </div>

      <Section
        title="Overdue"
        items={overdue}
        accent="var(--error)"
        emptyMsg="Nothing overdue."
      />
      <Section
        title="Due This Week"
        items={due_soon}
        accent="var(--warning)"
        emptyMsg="Nothing due in the next 7 days."
      />
      <Section
        title="Upcoming"
        items={upcoming}
        accent="var(--text-muted)"
        emptyMsg="No upcoming reviews scheduled."
      />
    </div>
  )
}
