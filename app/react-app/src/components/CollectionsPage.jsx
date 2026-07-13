import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function CollectionsPage() {
  const navigate = useNavigate()
  const [collections, setCollections] = useState([])
  const [library, setLibrary] = useState({})   // slug -> title
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [addSlugInputs, setAddSlugInputs] = useState({})  // collectionId -> slug text

  const fetchCollections = () =>
    fetch('/api/collections')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setCollections(d.collections || []))
      .catch(() => {})

  useEffect(() => {
    Promise.all([
      fetch('/api/collections').then(r => r.ok ? r.json() : { collections: [] }),
      fetch('/api/library').then(r => r.ok ? r.json() : { groups: [] }),
    ]).then(([colData, libData]) => {
      setCollections(colData.collections || [])
      const map = {}
      for (const group of (libData.groups || [])) {
        for (const lesson of (group.lessons || [])) {
          map[lesson.slug] = lesson.title
        }
      }
      setLibrary(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: newDesc.trim() }),
      })
      setNewName('')
      setNewDesc('')
      setShowForm(false)
      await fetchCollections()
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (cid) => {
    if (!confirm('Delete this collection?')) return
    await fetch(`/api/collections/${cid}`, { method: 'DELETE' })
    setCollections(cs => cs.filter(c => c.id !== cid))
    if (expandedId === cid) setExpandedId(null)
  }

  const handleAddLesson = async (cid) => {
    const slug = (addSlugInputs[cid] || '').trim()
    if (!slug) return
    await fetch(`/api/collections/${cid}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
    setAddSlugInputs(prev => ({ ...prev, [cid]: '' }))
    await fetchCollections()
  }

  const handleRemoveLesson = async (cid, slug) => {
    await fetch(`/api/collections/${cid}/lessons/${slug}`, { method: 'DELETE' })
    setCollections(cs => cs.map(c =>
      c.id === cid ? { ...c, slugs: c.slugs.filter(s => s !== slug), lesson_count: c.lesson_count - 1 } : c
    ))
  }

  if (loading) return (
    <div className="library-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', paddingTop: '2rem' }}>
        <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        Loading collections...
      </div>
    </div>
  )

  return (
    <div className="library-page">
      <div className="library-header" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1>Collections</h1>
          <p>{collections.length} {collections.length === 1 ? 'collection' : 'collections'}</p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: 8,
            border: '1px solid var(--accent)',
            background: showForm ? 'var(--accent-dim)' : 'transparent',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '0.8rem',
          }}
        >
          {showForm ? '✕ cancel' : '+ new collection'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: 480,
        }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Collection name"
            required
            autoFocus
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.5rem 0.75rem',
              color: 'var(--text)',
              fontSize: '0.95rem',
            }}
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.5rem 0.75rem',
              color: 'var(--text)',
              fontSize: '0.9rem',
            }}
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            style={{
              alignSelf: 'flex-start',
              padding: '0.45rem 1.25rem',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--bg)',
              cursor: creating ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      {collections.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', maxWidth: 480 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>No collections yet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Create one to group related lessons together.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {collections.map(col => (
          <div key={col.id} style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {/* Header row */}
            <div
              onClick={() => setExpandedId(id => id === col.id ? null : col.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                cursor: 'pointer',
                gap: '0.75rem',
              }}
            >
              <span style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                transition: 'transform 0.15s',
                transform: expandedId === col.id ? 'rotate(90deg)' : 'none',
              }}>▶</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: col.description ? '0.2rem' : 0 }}>
                  {col.name}
                </div>
                {col.description && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{col.description}</div>
                )}
              </div>
              <span style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {col.lesson_count} {col.lesson_count === 1 ? 'lesson' : 'lessons'}
              </span>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(col.id) }}
                title="Delete collection"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  padding: '0.2rem 0.4rem',
                  borderRadius: 6,
                  lineHeight: 1,
                }}
              >✕</button>
            </div>

            {/* Expanded body */}
            {expandedId === col.id && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {col.slugs.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No lessons yet. Add one below.</p>
                )}
                {col.slugs.map(slug => (
                  <div key={slug} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <span
                      onClick={() => navigate(`/lesson/${slug}`)}
                      style={{ flex: 1, cursor: 'pointer', color: 'var(--accent)', fontSize: '0.9rem' }}
                    >
                      {library[slug] || slug}
                    </span>
                    <button
                      onClick={() => handleRemoveLesson(col.id, slug)}
                      title="Remove from collection"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        padding: '0.1rem 0.3rem',
                        borderRadius: 4,
                      }}
                    >✕</button>
                  </div>
                ))}

                {/* Add lesson form */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    value={addSlugInputs[col.id] || ''}
                    onChange={e => setAddSlugInputs(prev => ({ ...prev, [col.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddLesson(col.id)}
                    placeholder="lesson-slug"
                    style={{
                      flex: 1,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.4rem 0.65rem',
                      color: 'var(--text)',
                      fontSize: '0.85rem',
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}
                  />
                  <button
                    onClick={() => handleAddLesson(col.id)}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: 8,
                      border: '1px solid var(--accent)',
                      background: 'var(--accent-dim)',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >Add</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
