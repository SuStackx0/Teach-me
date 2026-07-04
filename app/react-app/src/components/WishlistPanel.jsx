import { useEffect, useRef, useState } from 'react'

export default function WishlistPanel({ open, onClose, onCountChange }) {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch('/api/wishlist')
      .then(r => r.json())
      .then(d => {
        const list = d.items || []
        setItems(list)
        onCountChange?.(list.filter(i => !i.surfaced).length)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    const topic = input.trim()
    if (!topic) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()
      if (data.ok) {
        const newItem = { id: data.id, topic, added_date: new Date().toISOString().slice(0, 10), surfaced: false }
        const next = [...items, newItem]
        setItems(next)
        onCountChange?.(next.filter(i => !i.surfaced).length)
        setInput('')
      }
    } catch {}
    setSubmitting(false)
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/wishlist/${id}`, { method: 'DELETE' })
      const next = items.filter(i => i.id !== id)
      setItems(next)
      onCountChange?.(next.filter(i => !i.surfaced).length)
    } catch {}
  }

  const pending = items.filter(i => !i.surfaced)
  const surfaced = items.filter(i => i.surfaced)

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'rgba(0,0,0,0.18)',
          }}
        />
      )}

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 200,
        width: 320,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: open ? 'var(--shadow-md)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.125rem 0.875rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Study Wishlist
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Claude decides when you're ready
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '1.1rem', padding: '4px 6px',
              borderRadius: 6, lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ padding: '0.875rem 1.125rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', marginBottom: '0.5rem' }}>
            Add a topic you want to study
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="e.g. inference, KV cache, LoRA…"
              style={{
                flex: 1, padding: '0.5rem 0.75rem',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--surface-2)', color: 'var(--text-primary)',
                fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={submitting || !input.trim()}
              className="primary"
              style={{ padding: '0.5rem 0.875rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
            >
              Add
            </button>
          </div>
        </form>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.125rem' }}>
          {pending.length === 0 && surfaced.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'IBM Plex Serif, Georgia, serif', marginTop: '2rem', lineHeight: 1.7 }}>
              Nothing yet.<br />Add topics you want to study — Claude will surface them when you're ready.
            </div>
          )}

          {pending.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Pending · {pending.length}
              </div>
              {pending.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.6rem 0.75rem', marginBottom: '0.35rem',
                  background: 'var(--surface-2)', borderRadius: 8,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent)', border: '1.5px solid var(--accent)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.topic}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace', marginTop: 1 }}>
                      added {item.added_date}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '1rem', padding: '2px 5px',
                      borderRadius: 4, lineHeight: 1, flexShrink: 0,
                    }}
                    title="Remove"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {surfaced.length > 0 && (
            <div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Surfaced · {surfaced.length}
              </div>
              {surfaced.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.6rem 0.75rem', marginBottom: '0.35rem',
                  background: 'var(--surface-2)', borderRadius: 8,
                  border: '1px solid var(--border)', opacity: 0.5,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: 'var(--success)', border: '1.5px solid var(--success)' }} />
                  <div style={{ flex: 1, fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'line-through' }}>
                    {item.topic}
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: '2px 5px', borderRadius: 4, lineHeight: 1, flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
