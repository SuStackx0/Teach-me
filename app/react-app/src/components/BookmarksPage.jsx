import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function formatTimestamp(isoStr) {
  const d = new Date(isoStr)
  const month = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${month} ${day} · ${time}`
}

function groupBySlug(bookmarks) {
  const map = new Map()
  for (const bm of bookmarks) {
    if (!map.has(bm.slug)) map.set(bm.slug, [])
    map.get(bm.slug).push(bm)
  }
  // Sort each group internally by created_at desc
  for (const [, items] of map) {
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }
  // Sort groups by most recent created_at desc
  return [...map.entries()].sort((a, b) => {
    const aLatest = new Date(a[1][0].created_at)
    const bLatest = new Date(b[1][0].created_at)
    return bLatest - aLatest
  })
}

export default function BookmarksPage() {
  const navigate = useNavigate()
  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/bookmarks')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => setBookmarks(data.bookmarks ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function handleDelete(id) {
    // Optimistic update first
    setBookmarks(prev => prev.filter(bm => bm.id !== id))
    fetch(`/api/bookmarks/${id}`, { method: 'DELETE' }).catch(() => {
      // If the request fails, re-fetch to restore state
      fetch('/api/bookmarks')
        .then(r => r.json())
        .then(data => setBookmarks(data.bookmarks ?? []))
    })
  }

  if (loading) {
    return (
      <div className="library-page">
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
          <div style={styles.spinner} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="library-page">
        <div style={{ color: 'var(--error)', padding: '2rem' }}>
          Failed to load bookmarks: {error}
        </div>
      </div>
    )
  }

  const groups = groupBySlug(bookmarks)

  return (
    <div className="library-page">
      <div className="library-header">
        <h1>Bookmarks</h1>
        <p>Saved passages from your lessons, grouped by topic.</p>
      </div>

      {groups.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No bookmarks yet. Select text in a lesson and click ☆ Bookmark.</p>
        </div>
      ) : (
        <div style={styles.groupList}>
          {groups.map(([slug, items], groupIdx) => {
            const title = items[0].title || slug
            return (
              <div key={slug} style={styles.group}>
                <h3
                  style={styles.groupHeader}
                  onClick={() => navigate(`/lesson/${slug}`)}
                  title={`Go to lesson: ${title}`}
                >
                  {title}
                </h3>

                {items.map(bm => (
                  <div key={bm.id} style={styles.card}>
                    <button
                      style={styles.deleteBtn}
                      aria-label="Remove bookmark"
                      onClick={() => handleDelete(bm.id)}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      ×
                    </button>

                    {bm.section && (
                      <span style={styles.badge}>{bm.section}</span>
                    )}

                    <blockquote style={styles.blockquote}>
                      {bm.content}
                    </blockquote>

                    <div style={styles.timestamp}>
                      {formatTimestamp(bm.created_at)}
                    </div>
                  </div>
                ))}

                {groupIdx < groups.length - 1 && (
                  <div style={styles.divider} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },

  emptyState: {
    marginTop: '3rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    lineHeight: '1.7',
  },

  groupList: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '0 1rem 4rem',
  },

  group: {
    marginBottom: '0.5rem',
  },

  groupHeader: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '1.5rem 0 0.75rem',
    cursor: 'pointer',
    display: 'inline-block',
    transition: 'color 0.15s',
  },

  card: {
    position: 'relative',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '1rem 1rem 0.75rem',
    marginBottom: '0.5rem',
  },

  deleteBtn: {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.1rem',
    lineHeight: 1,
    color: 'var(--text-muted)',
    padding: '0 4px',
    transition: 'color 0.15s',
  },

  badge: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.7rem',
    background: 'var(--surface-2)',
    color: 'var(--text-muted)',
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'inline-block',
    marginBottom: '0.5rem',
    letterSpacing: '0.02em',
  },

  blockquote: {
    borderLeft: '3px solid var(--accent)',
    paddingLeft: '1rem',
    margin: '0 0 0.5rem',
    color: 'var(--text-secondary)',
    fontFamily: "'IBM Plex Serif', Georgia, serif",
    fontStyle: 'italic',
    fontSize: '0.95rem',
    lineHeight: '1.65',
  },

  timestamp: {
    textAlign: 'right',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '0.25rem',
    fontFamily: "'Inter', system-ui, sans-serif",
  },

  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '1.25rem 0 0.25rem',
    opacity: 0.6,
  },
}
