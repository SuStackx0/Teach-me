import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LessonCard from './LessonCard.jsx'

function TagChips({ slug, onTagsLoaded }) {
  const [tags, setTags] = useState(null)
  const [input, setInput] = useState('')
  const [showInput, setShowInput] = useState(false)

  useEffect(() => {
    fetch(`/api/tags/${slug}`)
      .then(r => r.ok ? r.json() : { tags: [] })
      .then(d => setTags(d.tags || []))
      .catch(() => setTags([]))
  }, [slug])

  const addTag = async () => {
    const name = input.trim()
    if (!name) return
    await fetch(`/api/tags/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: name }),
    })
    setTags(prev => [...(prev || []), { name }])
    setInput('')
    setShowInput(false)
  }

  const removeTag = async (tagName) => {
    await fetch(`/api/tags/${slug}/${encodeURIComponent(tagName)}`, { method: 'DELETE' })
    setTags(prev => (prev || []).filter(t => t.name !== tagName))
  }

  if (!tags) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem' }}>
      {tags.map(t => (
        <span key={t.name} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          borderRadius: 99,
          padding: '0.15rem 0.55rem',
          fontSize: '0.7rem',
          fontFamily: 'IBM Plex Mono, monospace',
          border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
        }}>
          {t.name}
          <button
            onClick={e => { e.stopPropagation(); removeTag(t.name) }}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.65rem' }}
          >×</button>
        </span>
      ))}
      {showInput ? (
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setShowInput(false) }}
          onBlur={() => { if (!input.trim()) setShowInput(false) }}
          onClick={e => e.stopPropagation()}
          placeholder="tag name"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 99,
            padding: '0.15rem 0.55rem',
            color: 'var(--text)',
            fontSize: '0.7rem',
            fontFamily: 'IBM Plex Mono, monospace',
            width: 90,
            outline: 'none',
          }}
        />
      ) : (
        <button
          onClick={e => { e.stopPropagation(); setShowInput(true) }}
          title="Add tag"
          style={{
            background: 'none',
            border: '1px dashed var(--border)',
            borderRadius: 99,
            padding: '0.15rem 0.45rem',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.68rem',
            fontFamily: 'IBM Plex Mono, monospace',
            lineHeight: 1.4,
          }}
        >+ tag</button>
      )}
    </div>
  )
}

function PinnedSection({ onUnpin }) {
  const navigate = useNavigate()
  const [pins, setPins] = useState(null)
  const [library, setLibrary] = useState({})

  useEffect(() => {
    Promise.all([
      fetch('/api/pins').then(r => r.ok ? r.json() : { pins: [] }),
      fetch('/api/library').then(r => r.ok ? r.json() : { groups: [] }),
    ]).then(([pinData, libData]) => {
      setPins(pinData.pins || [])
      const map = {}
      for (const group of (libData.groups || [])) {
        for (const lesson of (group.lessons || [])) {
          map[lesson.slug] = lesson
        }
      }
      setLibrary(map)
    }).catch(() => setPins([]))
  }, [])

  const handleUnpin = async (slug) => {
    await fetch(`/api/pins/${slug}`, { method: 'DELETE' })
    setPins(prev => (prev || []).filter(p => p.slug !== slug))
    if (onUnpin) onUnpin(slug)
  }

  if (!pins || pins.length === 0) return null

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      }}>
        <span style={{ fontSize: '0.9rem' }}>📌</span>
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
        }}>Currently Studying</span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {pins.map(pin => {
          const lesson = library[pin.slug]
          return (
            <div
              key={pin.slug}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--accent)',
                borderRadius: 12,
                padding: '0.75rem 1rem',
                minWidth: 200,
                maxWidth: 280,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                position: 'relative',
              }}
            >
              <button
                onClick={() => handleUnpin(pin.slug)}
                title="Unpin"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: '0.1rem 0.3rem',
                  borderRadius: 4,
                  lineHeight: 1,
                }}
              >✕</button>
              <div
                onClick={() => navigate(`/lesson/${pin.slug}`)}
                style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text)', paddingRight: '1.2rem', fontSize: '0.9rem', lineHeight: 1.3 }}
              >
                {lesson?.title || pin.slug}
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Pinned {new Date(pin.pinned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LessonCardWithActions({ lesson }) {
  const navigate = useNavigate()
  const [pinned, setPinned] = useState(false)
  const [pinError, setPinError] = useState('')

  function scoreClass(pct) {
    if (pct === null || pct === undefined) return 'none'
    if (pct >= 0.8) return 'good'
    if (pct >= 0.6) return 'ok'
    return 'bad'
  }

  function scoreText(pct) {
    if (pct === null || pct === undefined) return '—'
    return `${Math.round(pct * 100)}%`
  }

  function formatDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const diffColor = {
    intermediate: 'var(--accent)',
    advanced: 'var(--warning)',
    expert: 'var(--error)',
  }[lesson.difficulty] || 'var(--text-muted)'

  const handlePin = async (e) => {
    e.stopPropagation()
    setPinError('')
    const res = await fetch(`/api/pins/${lesson.slug}`, { method: 'POST' })
    if (res.ok) {
      setPinned(true)
      setTimeout(() => setPinned(false), 2000)
    } else {
      const data = await res.json().catch(() => ({}))
      setPinError(data.detail || 'Max 3 pinned')
      setTimeout(() => setPinError(''), 2500)
    }
  }

  if (!lesson.archived) {
    return (
      <div className="lesson-card" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
        <div className="lesson-card-title">{lesson.title}</div>
        <div className="lesson-card-meta">
          <span style={{ color: 'var(--error)' }}>Archive file missing</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="lesson-card"
      onClick={() => navigate(`/lesson/${lesson.slug}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/lesson/${lesson.slug}`)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div className="lesson-card-title" style={{ flex: 1 }}>{lesson.title}</div>
        <button
          onClick={handlePin}
          title={pinned ? 'Pinned!' : 'Pin to top'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: pinned ? 'var(--accent)' : 'var(--text-muted)',
            padding: '0.1rem 0.2rem',
            borderRadius: 4,
            lineHeight: 1,
            flexShrink: 0,
            transition: 'color 0.15s',
          }}
        >
          {pinned ? '📌' : '📍'}
        </button>
      </div>
      <div className="lesson-card-meta">
        <span>{formatDate(lesson.date)}</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span className={`lesson-card-score ${scoreClass(lesson.quiz_score_pct)}`}>
          {scoreText(lesson.quiz_score_pct)}
        </span>
        {lesson.difficulty && (
          <>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{ color: diffColor }}>{lesson.difficulty}</span>
          </>
        )}
        {lesson.time_spent_minutes > 0 && (
          <>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{Math.round(lesson.time_spent_minutes)}m</span>
          </>
        )}
      </div>
      {pinError && (
        <div style={{ fontSize: '0.72rem', color: 'var(--error)', marginTop: '0.25rem', fontFamily: 'IBM Plex Mono, monospace' }}>
          {pinError}
        </div>
      )}
      <TagChips slug={lesson.slug} />
    </div>
  )
}

export default function LibraryPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/library')
      .then(r => r.ok ? r.json() : Promise.reject('Server error'))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Could not load library.'); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="library-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', paddingTop: '2rem' }}>
        <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        Loading library...
      </div>
    </div>
  )

  if (error) return (
    <div className="library-page">
      <p style={{ color: 'var(--error)' }}>{error}</p>
    </div>
  )

  const { groups = [], total = 0 } = data || {}

  if (total === 0) return (
    <div className="library-page">
      <div className="library-header">
        <h1>Library</h1>
        <p>No sessions yet.</p>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '3rem', maxWidth: 480 }}>
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Run <code>/teach</code> in Claude Code to generate your first lesson.
          After you finish and log the session, it appears here.
        </p>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.9rem', color: 'var(--accent)' }}>/teach</div>
      </div>
    </div>
  )

  return (
    <div className="library-page">
      <div className="library-header">
        <h1>Library</h1>
        <p>{total} {total === 1 ? 'session' : 'sessions'} completed</p>
      </div>

      <PinnedSection />

      {groups.map(group => (
        <div key={group.domain_key} className="domain-group">
          <div className="domain-group-header">
            <span className="domain-group-title">{group.domain || 'General'}</span>
            <span className="domain-group-count">{group.lessons.length}</span>
          </div>
          <div className="lesson-cards-grid">
            {group.lessons.map(lesson => (
              <LessonCardWithActions key={lesson.slug} lesson={lesson} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
