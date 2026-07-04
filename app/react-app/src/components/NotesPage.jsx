import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const DOMAIN_DISPLAY = {
  'llm-arch': 'LLM Architecture',
  'inference': 'Inference & Serving',
  'training': 'Training & Alignment',
  'agentic': 'Agentic Systems',
  'backend': 'Backend Systems',
  'system-design': 'System Design',
  'mlops': 'MLOps',
  'ml-ds': 'ML/DS & Evaluation',
  'cross-domain': 'Cross-Domain',
  'custom': 'Custom',
}

const DOMAIN_ORDER = ['llm-arch', 'inference', 'training', 'agentic', 'ml-ds', 'mlops', 'backend', 'system-design', 'cross-domain', 'custom']

function formatRelative(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

function highlightMatch(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="notes-match">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function renderPreview(text) {
  if (!text?.trim()) return null
  const segments = []
  const fenceRe = /```[\w]*\n?([\s\S]*?)```/g
  let last = 0, m
  while ((m = fenceRe.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', content: text.slice(last, m.index) })
    segments.push({ type: 'code', content: m[1].trim() })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) })

  return segments.map((seg, i) => {
    if (seg.type === 'code') {
      return <pre key={i} className="notes-preview-code"><code>{seg.content}</code></pre>
    }
    const lines = seg.content.split('\n')
    const elems = []
    let bqLines = []
    const flushBq = () => {
      if (!bqLines.length) return
      elems.push(
        <blockquote key={`bq${elems.length}`} className="notes-preview-quote">
          {bqLines.join('\n')}
        </blockquote>
      )
      bqLines = []
    }
    for (const line of lines) {
      if (line.startsWith('> ')) {
        bqLines.push(line.slice(2))
      } else {
        flushBq()
        if (line.trim()) elems.push(<p key={`p${elems.length}`} className="notes-preview-p">{line}</p>)
      }
    }
    flushBq()
    return <div key={i}>{elems}</div>
  })
}

function exportAllNotes(notes) {
  const md = notes
    .filter(n => n.note?.trim())
    .map(n => `# ${n.title}\n\n${n.note}\n`)
    .join('\n---\n\n')
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'teach-me-notes.md'
  a.click()
  URL.revokeObjectURL(url)
}

export default function NotesPage() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState('track') // 'track' | 'recent'
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/notes')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.notes) {
          setNotes(data.notes)
          if (data.notes.length > 0) setSelected(data.notes[0].slug)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return notes
    const q = query.toLowerCase()
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.note.toLowerCase().includes(q)
    )
  }, [notes, query])

  const grouped = useMemo(() => {
    if (viewMode === 'recent') {
      return [{ label: 'Recent', items: [...filtered].sort((a, b) => (b.updated || '').localeCompare(a.updated || '')) }]
    }
    const byDomain = {}
    for (const note of filtered) {
      const key = note.domain || 'custom'
      if (!byDomain[key]) byDomain[key] = []
      byDomain[key].push(note)
    }
    const groups = []
    for (const key of DOMAIN_ORDER) {
      if (byDomain[key]) groups.push({ label: DOMAIN_DISPLAY[key] || key, items: byDomain[key] })
    }
    for (const [key, items] of Object.entries(byDomain)) {
      if (!DOMAIN_ORDER.includes(key)) groups.push({ label: DOMAIN_DISPLAY[key] || key, items })
    }
    return groups
  }, [filtered, viewMode])

  const selectedNote = notes.find(n => n.slug === selected)

  if (loading) return (
    <div className="notes-page">
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '0.75rem' }}>
        <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        Loading notes…
      </div>
    </div>
  )

  if (notes.length === 0) return (
    <div className="notes-page">
      <div className="notes-empty-pane" style={{ gridColumn: '1 / -1' }}>
        No notes yet — open a lesson and press ⌘⇧N to clip something.
      </div>
    </div>
  )

  return (
    <div className="notes-page">
      {/* Left rail */}
      <div className="notes-rail">
        <div className="notes-rail-header">
          <div className="notes-rail-title-row">
            <span className="notes-rail-title">Notes</span>
            <span className="notes-rail-count">{notes.length} {notes.length === 1 ? 'lesson' : 'lessons'}</span>
          </div>
          <div className="notes-search-bar">
            <span className="notes-search-icon">⌕</span>
            <input
              className="notes-search-input"
              placeholder="Search notes…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
              >✕</button>
            )}
          </div>
        </div>

        <div className="notes-rail-list">
          {grouped.length === 0 ? (
            <div style={{ padding: '1.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono, monospace' }}>
              No matches for "{query}"
            </div>
          ) : grouped.map(group => (
            <div key={group.label}>
              <div className="notes-group-label">{group.label}</div>
              {group.items.map(note => (
                <div
                  key={note.slug}
                  className={`notes-row${selected === note.slug ? ' active' : ''}`}
                  onClick={() => setSelected(note.slug)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelected(note.slug)}
                >
                  <div className="notes-row-title">
                    {highlightMatch(note.title, query)}
                  </div>
                  <div className="notes-row-meta">
                    {note.domain && (
                      <span className="notes-domain-chip">
                        {DOMAIN_DISPLAY[note.domain] || note.domain}
                      </span>
                    )}
                    <span>{formatRelative(note.updated)}</span>
                  </div>
                  <div className="notes-row-preview">
                    {highlightMatch(note.note.slice(0, 120), query)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="notes-rail-footer">
          <button className="notes-export-btn" onClick={() => exportAllNotes(notes)}>
            ↓ export all .md
          </button>
          <div className="notes-view-toggle">
            <button
              className={`notes-view-btn${viewMode === 'track' ? ' active' : ''}`}
              onClick={() => setViewMode('track')}
            >by track</button>
            <button
              className={`notes-view-btn${viewMode === 'recent' ? ' active' : ''}`}
              onClick={() => setViewMode('recent')}
            >recent</button>
          </div>
        </div>
      </div>

      {/* Right reading pane */}
      <div className="notes-reading-pane">
        {selectedNote ? (
          <>
            <div className="notes-reading-header">
              <div className="notes-reading-title">{selectedNote.title}</div>
              <div className="notes-reading-meta">
                {selectedNote.date && <span>{selectedNote.date}</span>}
                <button
                  className="notes-open-link"
                  onClick={() => navigate(`/lesson/${selectedNote.slug}`)}
                >
                  open lesson ↗
                </button>
              </div>
            </div>
            <div className="notes-reading-body">
              {selectedNote.updated && (
                <div className="notes-reading-date">// {selectedNote.updated.slice(0, 10)}</div>
              )}
              {renderPreview(selectedNote.note)}
            </div>
          </>
        ) : (
          <div className="notes-empty-pane">Select a lesson to see its notes.</div>
        )}
      </div>
    </div>
  )
}
