import { useEffect, useState } from 'react'

const COLOR_MAP = {
  yellow: '#f5c518',
  green: '#4caf82',
  blue: '#4f8ef7',
  pink: '#f76fa8',
  orange: '#f7943a',
}

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/highlights')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => setHighlights(data.highlights || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  function handleDelete(id) {
    fetch(`/api/highlights/${id}`, { method: 'DELETE' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setHighlights(prev => prev.filter(h => h.id !== id)))
      .catch(() => {})
  }

  // Group by slug
  const grouped = {}
  for (const h of highlights) {
    if (!grouped[h.slug]) grouped[h.slug] = []
    grouped[h.slug].push(h)
  }
  const slugs = Object.keys(grouped).sort()

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text)' }}>
        Highlights
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem', fontFamily: 'IBM Plex Mono, monospace' }}>
        Text passages saved from lessons
      </p>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--error)' }}>Error: {error}</p>}

      {!loading && highlights.length === 0 && (
        <div style={{
          padding: '2.5rem', textAlign: 'center',
          background: 'var(--surface-2)', borderRadius: 10,
          border: '1px solid var(--border)', color: 'var(--text-muted)',
          fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.85rem',
        }}>
          No highlights yet. Select text in a lesson to save a highlight.
        </div>
      )}

      {slugs.map(slug => (
        <div key={slug} style={{ marginBottom: '2rem' }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace',
            textTransform: 'uppercase', marginBottom: '0.75rem',
            paddingBottom: '0.4rem', borderBottom: '1px solid var(--border)',
          }}>
            {slug}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {grouped[slug].map(h => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                background: 'var(--surface-2)', borderRadius: 8,
                border: '1px solid var(--border)',
                padding: '0.75rem 1rem',
              }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10,
                  borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: COLOR_MAP[h.color] || COLOR_MAP.yellow,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.72rem',
                    color: 'var(--text-muted)', marginBottom: '0.3rem',
                  }}>
                    {h.section}
                  </div>
                  <div style={{
                    color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.55,
                    wordBreak: 'break-word',
                  }}>
                    &ldquo;{h.text}&rdquo;
                  </div>
                  <div style={{
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem',
                    color: 'var(--text-muted)', marginTop: '0.35rem',
                  }}>
                    {h.created_at}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  title="Delete highlight"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '0.85rem',
                    padding: '2px 4px', borderRadius: 4, flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.target.style.color = 'var(--error)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
