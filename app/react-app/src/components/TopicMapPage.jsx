import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function statusColors(status) {
  if (status === 'done' || status === 'completed') {
    return {
      border: 'var(--success)',
      bgLight: 'rgba(42,107,79,0.08)',
      bgDark: 'rgba(74,222,128,0.08)',
      dot: 'var(--success)',
    }
  }
  if (status === 'in_progress') {
    return {
      border: 'var(--warning)',
      bgLight: 'rgba(160,97,42,0.08)',
      bgDark: 'rgba(160,97,42,0.08)',
      dot: 'var(--warning)',
    }
  }
  return {
    border: 'var(--border)',
    bgLight: null,
    bgDark: null,
    dot: 'var(--text-muted)',
  }
}

function TopicNode({ topic, isDark }) {
  const navigate = useNavigate()
  const { border, bgLight, bgDark, dot } = statusColors(topic.status)
  const isClickable = topic.status === 'done' || topic.status === 'completed'
  const bg = isDark ? bgDark : bgLight

  return (
    <div
      onClick={() => isClickable && navigate(`/lesson/${topic.slug}`)}
      style={{
        position: 'relative',
        width: 200,
        margin: '0 8px 8px 8px',
        padding: '10px 12px',
        background: bg || 'var(--surface)',
        border: `1px solid ${border}`,
        borderRadius: 6,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = border
      }}
    >
      {/* Status dot */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dot,
          flexShrink: 0,
        }}
      />

      {/* Title */}
      <div
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          paddingRight: 14,
        }}
      >
        {topic.title}
      </div>

      {/* builds_on indicator */}
      {topic.builds_on && topic.builds_on.length > 0 && (
        <div
          style={{
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            marginTop: 4,
          }}
        >
          ↑ builds on {topic.builds_on.length} {topic.builds_on.length === 1 ? 'topic' : 'topics'}
        </div>
      )}
    </div>
  )
}

function TrackColumn({ track, isDark }) {
  return (
    <div style={{ width: 220, flexShrink: 0 }}>
      {/* Track header */}
      <h3
        style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
          fontFamily: 'IBM Plex Mono, monospace',
          paddingBottom: 8,
          borderBottom: '1px solid var(--border)',
          marginBottom: 12,
          fontWeight: 500,
        }}
      >
        {track.title}
      </h3>

      {/* Topic nodes */}
      {(track.ladder || []).map(topic => (
        <TopicNode key={topic.slug} topic={topic} isDark={isDark} />
      ))}
    </div>
  )
}

const LEGEND_ITEMS = [
  { dot: 'var(--success)', label: 'Completed', filled: true },
  { dot: 'var(--warning)', label: 'In Progress', filled: true },
  { dot: 'var(--text-muted)', label: 'Available', filled: false },
]

export default function TopicMapPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setIsDark(document.documentElement.classList.contains('dark') || mq.matches)
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    mq.addEventListener('change', update)
    return () => {
      observer.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    fetch('/api/curriculum')
      .then(r => r.ok ? r.json() : Promise.reject('Server error'))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Could not load curriculum.'); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="library-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', paddingTop: '2rem' }}>
        <div style={{
          width: 18,
          height: 18,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
        Loading curriculum map...
      </div>
    </div>
  )

  if (error) return (
    <div className="library-page">
      <p style={{ color: 'var(--error)' }}>{error}</p>
    </div>
  )

  const tracks = data?.tracks || []

  return (
    <div className="library-page">
      {/* Page header */}
      <div className="library-header">
        <h1>Curriculum Map</h1>
        <p>
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} — click a completed topic to review it
        </p>
      </div>

      {/* Scrollable track columns */}
      <div
        style={{
          display: 'flex',
          gap: '2rem',
          overflowX: 'auto',
          padding: '1rem 0 2rem',
          alignItems: 'flex-start',
        }}
      >
        {tracks.map(track => (
          <TrackColumn key={track.id} track={track} isDark={isDark} />
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginTop: '1rem',
          alignItems: 'center',
        }}
      >
        {LEGEND_ITEMS.map(item => (
          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: item.filled ? item.dot : 'transparent',
                border: item.filled ? 'none' : `1.5px solid ${item.dot}`,
                flexShrink: 0,
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
