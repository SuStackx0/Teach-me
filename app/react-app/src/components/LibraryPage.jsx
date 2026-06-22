import { useEffect, useState } from 'react'
import LessonCard from './LessonCard.jsx'

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

      {groups.map(group => (
        <div key={group.domain_key} className="domain-group">
          <div className="domain-group-header">
            <span className="domain-group-title">{group.domain || 'General'}</span>
            <span className="domain-group-count">{group.lessons.length}</span>
          </div>
          <div className="lesson-cards-grid">
            {group.lessons.map(lesson => (
              <LessonCard key={lesson.slug} lesson={lesson} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
