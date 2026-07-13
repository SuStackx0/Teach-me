import { useEffect, useState } from 'react'

export default function GlossaryPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ term: '', definition: '', source_slug: '' })
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ term: '', definition: '' })

  useEffect(() => {
    loadEntries()
  }, [])

  function loadEntries() {
    setLoading(true)
    fetch('/api/glossary')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => setEntries(data.entries || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  function handleAdd(e) {
    e.preventDefault()
    if (!form.term.trim() || !form.definition.trim()) return
    setSubmitting(true)
    fetch('/api/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => {
        setForm({ term: '', definition: '', source_slug: '' })
        loadEntries()
      })
      .catch(() => {})
      .finally(() => setSubmitting(false))
  }

  function handleDelete(id) {
    fetch(`/api/glossary/${id}`, { method: 'DELETE' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setEntries(prev => prev.filter(e => e.id !== id)))
      .catch(() => {})
  }

  function startEdit(entry) {
    setEditId(entry.id)
    setEditForm({ term: entry.term, definition: entry.definition })
  }

  function handleEditSave(id) {
    fetch(`/api/glossary/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => {
        setEntries(prev => prev.map(e =>
          e.id === id ? { ...e, term: editForm.term, definition: editForm.definition } : e
        ))
        setEditId(null)
      })
      .catch(() => {})
  }

  const inputStyle = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', padding: '0.5rem 0.75rem',
    fontSize: '0.88rem', outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text)' }}>
        Glossary
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem', fontFamily: 'IBM Plex Mono, monospace' }}>
        Your personal term definitions
      </p>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '1.25rem', marginBottom: '2rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
          Add term
        </div>
        <input
          style={inputStyle}
          placeholder="Term"
          value={form.term}
          onChange={e => setForm(f => ({ ...f, term: e.target.value }))}
        />
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
          placeholder="Definition"
          value={form.definition}
          onChange={e => setForm(f => ({ ...f, definition: e.target.value }))}
        />
        <input
          style={inputStyle}
          placeholder="Source lesson slug (optional)"
          value={form.source_slug}
          onChange={e => setForm(f => ({ ...f, source_slug: e.target.value }))}
        />
        <button
          type="submit"
          disabled={submitting || !form.term.trim() || !form.definition.trim()}
          style={{
            alignSelf: 'flex-start', padding: '0.45rem 1.1rem',
            background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', borderRadius: 6, fontWeight: 700,
            fontSize: '0.85rem', cursor: 'pointer', opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </form>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--error)' }}>Error: {error}</p>}

      {!loading && entries.length === 0 && (
        <div style={{
          padding: '2.5rem', textAlign: 'center',
          background: 'var(--surface-2)', borderRadius: 10,
          border: '1px solid var(--border)', color: 'var(--text-muted)',
          fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.85rem',
        }}>
          No glossary entries yet. Add terms you encounter in lessons.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {entries.map(entry => (
          <div key={entry.id} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '1rem 1.1rem',
          }}>
            {editId === entry.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <input
                  style={inputStyle}
                  value={editForm.term}
                  onChange={e => setEditForm(f => ({ ...f, term: e.target.value }))}
                />
                <textarea
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  value={editForm.definition}
                  onChange={e => setEditForm(f => ({ ...f, definition: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleEditSave(entry.id)}
                    style={{
                      padding: '0.35rem 0.9rem', background: 'var(--accent)',
                      color: 'var(--bg)', border: 'none', borderRadius: 5,
                      fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                    }}
                  >Save</button>
                  <button
                    onClick={() => setEditId(null)}
                    style={{
                      padding: '0.35rem 0.9rem', background: 'none',
                      color: 'var(--text-muted)', border: '1px solid var(--border)',
                      borderRadius: 5, fontSize: '0.82rem', cursor: 'pointer',
                    }}
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                    {entry.term}
                  </div>
                  <div style={{ color: 'var(--text)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                    {entry.definition}
                  </div>
                  {entry.source_slug && (
                    <div style={{
                      fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem',
                      color: 'var(--accent)', marginTop: '0.4rem',
                    }}>
                      <a href={`/lesson/${entry.source_slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        ↗ {entry.source_slug}
                      </a>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button
                    onClick={() => startEdit(entry)}
                    title="Edit"
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 5, cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '0.78rem',
                      padding: '2px 7px',
                    }}
                  >Edit</button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    title="Delete"
                    style={{
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--text-muted)',
                      fontSize: '0.85rem', padding: '2px 4px', borderRadius: 4,
                    }}
                    onMouseEnter={e => e.target.style.color = 'var(--error)'}
                    onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
