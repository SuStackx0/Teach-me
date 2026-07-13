import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ConnectionsWidget({ slug }) {
  const navigate = useNavigate()
  const [connections, setConnections] = useState([])
  const [library, setLibrary] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [toSlug, setToSlug] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchConnections = () =>
    fetch(`/api/connections/${slug}`)
      .then(r => r.ok ? r.json() : { connections: [] })
      .then(d => setConnections(d.connections || []))
      .catch(() => {})

  useEffect(() => {
    fetchConnections()
    fetch('/api/library')
      .then(r => r.ok ? r.json() : { groups: [] })
      .then(d => {
        const map = {}
        for (const group of (d.groups || [])) {
          for (const lesson of (group.lessons || [])) {
            map[lesson.slug] = lesson.title
          }
        }
        setLibrary(map)
      })
      .catch(() => {})
  }, [slug])

  const handleAdd = async (e) => {
    e.preventDefault()
    const target = toSlug.trim()
    if (!target || target === slug) return
    setSaving(true)
    try {
      await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_slug: slug, to_slug: target, label: label.trim() }),
      })
      setToSlug('')
      setLabel('')
      setShowForm(false)
      await fetchConnections()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cid) => {
    await fetch(`/api/connections/${cid}`, { method: 'DELETE' })
    setConnections(cs => cs.filter(c => c.id !== cid))
  }

  const getOtherSlug = (conn) => conn.from_slug === slug ? conn.to_slug : conn.from_slug

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
      }}>
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
        }}>See Also</span>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0.2rem 0.6rem',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        >
          {showForm ? '✕' : '+ link'}
        </button>
      </div>

      {connections.length === 0 && !showForm && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>No connections yet.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {connections.map(conn => {
          const other = getOtherSlug(conn)
          const title = library[other] || other
          return (
            <div key={conn.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.65rem',
              background: 'var(--surface-2)',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}>
              <span
                onClick={() => navigate(`/lesson/${other}`)}
                style={{ flex: 1, cursor: 'pointer', color: 'var(--accent)', fontSize: '0.88rem' }}
              >
                {title}
              </span>
              {conn.label && (
                <span style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  background: 'var(--bg)',
                  borderRadius: 4,
                  padding: '0.1rem 0.4rem',
                  border: '1px solid var(--border)',
                }}>
                  {conn.label}
                </span>
              )}
              <button
                onClick={() => handleDelete(conn.id)}
                title="Remove connection"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.25rem',
                  lineHeight: 1,
                  borderRadius: 4,
                }}
              >✕</button>
            </div>
          )
        })}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{
          marginTop: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          <input
            value={toSlug}
            onChange={e => setToSlug(e.target.value)}
            placeholder="target-lesson-slug"
            required
            autoFocus
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.4rem 0.65rem',
              color: 'var(--text)',
              fontSize: '0.85rem',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          />
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="label (optional, e.g. 'prerequisite')"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.4rem 0.65rem',
              color: 'var(--text)',
              fontSize: '0.82rem',
            }}
          />
          <button
            type="submit"
            disabled={saving || !toSlug.trim()}
            style={{
              alignSelf: 'flex-start',
              padding: '0.35rem 0.9rem',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--bg)',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Add link'}
          </button>
        </form>
      )}
    </div>
  )
}
