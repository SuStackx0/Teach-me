import { useEffect, useState, useRef } from 'react'

export default function SnippetsPage() {
  const [snippets, setSnippets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tagFilter, setTagFilter] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    loadSnippets(tagFilter)
  }, [tagFilter])

  function loadSnippets(tag) {
    setLoading(true)
    const url = tag ? `/api/snippets?tag=${encodeURIComponent(tag)}` : '/api/snippets'
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => setSnippets(data.snippets || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  function handleDelete(id) {
    fetch(`/api/snippets/${id}`, { method: 'DELETE' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setSnippets(prev => prev.filter(s => s.id !== id)))
      .catch(() => {})
  }

  function handleCopy(s) {
    navigator.clipboard.writeText(s.code).then(() => {
      setCopiedId(s.id)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopiedId(null), 1800)
    }).catch(() => {})
  }

  // Collect all unique tags for the filter dropdown
  const allTags = [...new Set(snippets.map(s => s.tag).filter(Boolean))]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text)' }}>
        Snippets
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', fontFamily: 'IBM Plex Mono, monospace' }}>
        Saved code blocks from lessons
      </p>

      {/* Tag filter */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
          Filter by tag:
        </label>
        <select
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text)', padding: '0.35rem 0.7rem',
            fontSize: '0.85rem', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="">All tags</option>
          {allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
        {tagFilter && (
          <button
            onClick={() => setTagFilter('')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.82rem', padding: '2px 6px',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--error)' }}>Error: {error}</p>}

      {!loading && snippets.length === 0 && (
        <div style={{
          padding: '2.5rem', textAlign: 'center',
          background: 'var(--surface-2)', borderRadius: 10,
          border: '1px solid var(--border)', color: 'var(--text-muted)',
          fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.85rem',
        }}>
          {tagFilter ? `No snippets with tag "${tagFilter}".` : 'No snippets yet. Save code blocks from lessons.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {snippets.map(s => (
          <div key={s.id} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.92rem', flex: 1, minWidth: 0 }}>
                {s.title}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                {s.language && (
                  <span style={{
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem',
                    background: 'var(--accent-dim)', color: 'var(--accent)',
                    borderRadius: 4, padding: '2px 7px', fontWeight: 700,
                  }}>
                    {s.language}
                  </span>
                )}
                {s.tag && (
                  <span style={{
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem',
                    background: 'var(--border)', color: 'var(--text-muted)',
                    borderRadius: 4, padding: '2px 7px',
                  }}>
                    {s.tag}
                  </span>
                )}
                <button
                  onClick={() => handleCopy(s)}
                  title="Copy to clipboard"
                  style={{
                    background: copiedId === s.id ? 'var(--success)' : 'var(--surface-2)',
                    border: `1px solid ${copiedId === s.id ? 'var(--success)' : 'var(--border)'}`,
                    borderRadius: 5, cursor: 'pointer',
                    color: copiedId === s.id ? 'var(--bg)' : 'var(--text-muted)',
                    fontSize: '0.75rem', padding: '3px 9px',
                    fontFamily: 'IBM Plex Mono, monospace',
                    transition: 'all 0.15s',
                  }}
                >
                  {copiedId === s.id ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  title="Delete snippet"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2px 4px',
                    borderRadius: 4,
                  }}
                  onMouseEnter={e => e.target.style.color = 'var(--error)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Code block */}
            <div style={{ overflowX: 'auto' }}>
              <pre style={{
                margin: 0, padding: '1rem',
                fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.82rem',
                color: 'var(--text)', lineHeight: 1.6,
                whiteSpace: 'pre', minWidth: 0,
              }}>
                {s.code}
              </pre>
            </div>

            {/* Footer */}
            <div style={{
              padding: '0.4rem 1rem',
              borderTop: '1px solid var(--border)',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem',
              color: 'var(--text-muted)',
              display: 'flex', gap: '1rem',
            }}>
              <span>from: {s.slug}</span>
              <span>{s.created_at}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
