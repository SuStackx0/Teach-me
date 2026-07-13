import { useState, useEffect } from 'react'

function FlipCard({ card, onDelete }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="fc-browse-card">
      <div className="fc-browse-front" onClick={() => setFlipped(f => !f)}>
        <span className="fc-q-label">Q</span>
        <span className="fc-front-text">{card.front}</span>
        {card.tag && <span className="fc-tag">{card.tag}</span>}
        <span className="fc-flip-hint">{flipped ? 'click to hide answer' : 'click to reveal answer'}</span>
      </div>
      {flipped && (
        <div className="fc-browse-back">
          <span className="fc-a-label">A</span>
          <span className="fc-back-text">{card.back}</span>
        </div>
      )}
      <button
        className="fc-delete-btn"
        onClick={() => onDelete(card.id)}
        title="Delete flashcard"
      >×</button>
    </div>
  )
}

function StudyMode({ cards, onExit }) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [animating, setAnimating] = useState(false)

  const card = cards[idx]

  const navigate = (dir) => {
    if (animating) return
    setAnimating(true)
    setFlipped(false)
    setTimeout(() => {
      setIdx(i => Math.max(0, Math.min(cards.length - 1, i + dir)))
      setAnimating(false)
    }, 180)
  }

  if (!card) return (
    <div className="fc-study-empty">
      <p>No cards to study.</p>
      <button onClick={onExit}>Exit Study Mode</button>
    </div>
  )

  return (
    <div className="fc-study-wrapper">
      <div className="fc-study-header">
        <button className="fc-exit-btn" onClick={onExit}>← Browse</button>
        <span className="fc-progress-label">{idx + 1} / {cards.length}</span>
      </div>

      <div
        className={`fc-scene${animating ? ' fc-animating' : ''}`}
        onClick={() => !animating && setFlipped(f => !f)}
        title="Click to flip"
      >
        <div className={`fc-card${flipped ? ' is-flipped' : ''}`}>
          <div className="fc-card-face fc-card-front">
            <span className="fc-side-label">Question</span>
            <p className="fc-card-text">{card.front}</p>
            {card.tag && <span className="fc-tag" style={{ marginTop: 'auto' }}>{card.tag}</span>}
            <span className="fc-flip-cue">tap to flip</span>
          </div>
          <div className="fc-card-face fc-card-back">
            <span className="fc-side-label">Answer</span>
            <p className="fc-card-text">{card.back}</p>
          </div>
        </div>
      </div>

      <div className="fc-study-nav">
        <button
          className="fc-nav-btn"
          onClick={() => navigate(-1)}
          disabled={idx === 0}
        >← Prev</button>
        <div className="fc-dots">
          {cards.map((_, i) => (
            <span
              key={i}
              className={`fc-dot${i === idx ? ' active' : ''}`}
              onClick={() => { setFlipped(false); setIdx(i) }}
            />
          ))}
        </div>
        <button
          className="fc-nav-btn"
          onClick={() => navigate(1)}
          disabled={idx === cards.length - 1}
        >Next →</button>
      </div>
    </div>
  )
}

export default function FlashcardsPage() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [studyMode, setStudyMode] = useState(false)
  const [filterTag, setFilterTag] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ front: '', back: '', tag: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadCards = async (tag = '') => {
    try {
      const params = tag ? `?tag=${encodeURIComponent(tag)}` : ''
      const r = await fetch(`/api/flashcards${params}`)
      if (r.ok) {
        const data = await r.json()
        setCards(data.cards || [])
      }
    } catch {
      setError('Failed to load flashcards.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCards(filterTag) }, [filterTag])

  const handleAdd = async () => {
    if (!form.front.trim() || !form.back.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (r.ok) {
        setForm({ front: '', back: '', tag: '' })
        setShowForm(false)
        await loadCards(filterTag)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this flashcard?')) return
    await fetch(`/api/flashcards/${id}`, { method: 'DELETE' })
    await loadCards(filterTag)
  }

  const allTags = [...new Set(cards.map(c => c.tag).filter(Boolean))]

  if (studyMode) {
    const deck = filterTag ? cards.filter(c => c.tag === filterTag) : cards
    return (
      <>
        <StudyMode cards={deck} onExit={() => setStudyMode(false)} />
        <StudyStyles />
      </>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header-row">
        <h1 className="page-title">Flashcards</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {cards.length > 0 && (
            <button onClick={() => setStudyMode(true)}>Study Mode →</button>
          )}
          <button className="primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ New Card'}
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>}

      {/* Filter by tag */}
      {allTags.length > 0 && (
        <div className="fc-tag-filter">
          <button
            className={`fc-tag-pill${filterTag === '' ? ' active' : ''}`}
            onClick={() => setFilterTag('')}
          >All</button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`fc-tag-pill${filterTag === tag ? ' active' : ''}`}
              onClick={() => setFilterTag(t => t === tag ? '' : tag)}
            >{tag}</button>
          ))}
        </div>
      )}

      {/* Add new card form */}
      {showForm && (
        <div className="fc-add-form">
          <h3 style={{ margin: '0 0 0.75rem', color: 'var(--text)' }}>New Flashcard</h3>
          <div className="fc-form-field">
            <label>Front (question) <span style={{ color: 'var(--error)' }}>*</span></label>
            <textarea
              placeholder="e.g. What is grouped-query attention?"
              value={form.front}
              onChange={e => setForm(f => ({ ...f, front: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="fc-form-field">
            <label>Back (answer) <span style={{ color: 'var(--error)' }}>*</span></label>
            <textarea
              placeholder="e.g. GQA shares key/value heads across multiple query heads…"
              value={form.back}
              onChange={e => setForm(f => ({ ...f, back: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="fc-form-field">
            <label>Tag</label>
            <input
              type="text"
              placeholder="e.g. llm-arch, inference"
              value={form.tag}
              onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              className="primary"
              onClick={handleAdd}
              disabled={saving || !form.front.trim() || !form.back.trim()}
            >
              {saving ? 'Saving…' : 'Save Card'}
            </button>
            <button onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen" style={{ height: 200 }}>Loading…</div>
      ) : cards.length === 0 ? (
        <div className="plan-empty-state">
          <p>No flashcards yet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Add cards to study key concepts and definitions.
          </p>
        </div>
      ) : (
        <div className="fc-browse-list">
          {cards.map(card => (
            <FlipCard key={card.id} card={card} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <BrowseStyles />
    </div>
  )
}

function BrowseStyles() {
  return (
    <style>{`
      .page-container { max-width: 800px; margin: 0 auto; padding: 2rem 1.5rem; }
      .page-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
      .page-title { font-size: 1.5rem; font-weight: 600; color: var(--text); margin: 0; }

      .fc-tag-filter { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 1rem; }
      .fc-tag-pill {
        padding: 3px 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--surface-2);
        color: var(--text-muted);
        font-size: 0.78rem;
        cursor: pointer;
        transition: all 0.13s;
        font-family: 'IBM Plex Mono', monospace;
      }
      .fc-tag-pill.active { background: var(--accent); color: var(--bg); border-color: var(--accent); }
      .fc-tag-pill:hover:not(.active) { border-color: var(--accent); color: var(--accent); }

      .fc-add-form {
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
      }
      .fc-form-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 0.75rem; }
      .fc-form-field label { font-size: 0.78rem; color: var(--text-muted); font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em; }
      .fc-form-field textarea, .fc-form-field input {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 0.45rem 0.65rem;
        color: var(--text);
        font-size: 0.875rem;
        resize: vertical;
        outline: none;
        font-family: inherit;
        transition: border-color 0.15s;
      }
      .fc-form-field textarea:focus, .fc-form-field input:focus { border-color: var(--accent); }

      .fc-browse-list { display: flex; flex-direction: column; gap: 0.6rem; }

      .fc-browse-card {
        position: relative;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 10px;
        overflow: hidden;
      }
      .fc-browse-front {
        display: flex; align-items: flex-start; gap: 0.75rem;
        padding: 0.85rem 2.5rem 0.85rem 1rem;
        cursor: pointer;
        flex-wrap: wrap;
        row-gap: 4px;
      }
      .fc-browse-front:hover { background: var(--accent-dim); }
      .fc-q-label, .fc-a-label {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.65rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        flex-shrink: 0;
        margin-top: 2px;
      }
      .fc-q-label { background: var(--accent-dim); color: var(--accent); }
      .fc-a-label { background: var(--success); color: var(--bg); opacity: 0.85; }
      .fc-front-text { flex: 1; color: var(--text); font-size: 0.9rem; min-width: 0; word-break: break-word; }
      .fc-tag {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.68rem;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--bg);
        border: 1px solid var(--border);
        color: var(--text-muted);
        white-space: nowrap;
      }
      .fc-flip-hint { font-size: 0.72rem; color: var(--text-muted); width: 100%; margin-top: 2px; }

      .fc-browse-back {
        display: flex; align-items: flex-start; gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: var(--bg);
        border-top: 1px solid var(--border);
      }
      .fc-back-text { flex: 1; color: var(--text-muted); font-size: 0.875rem; min-width: 0; word-break: break-word; }

      .fc-delete-btn {
        position: absolute; top: 0.6rem; right: 0.6rem;
        background: none; border: none; color: var(--text-muted);
        font-size: 1.1rem; cursor: pointer; line-height: 1; padding: 2px 5px;
        border-radius: 4px;
        transition: color 0.13s, background 0.13s;
      }
      .fc-delete-btn:hover { color: var(--error); background: var(--accent-dim); }

      .plan-empty-state {
        text-align: center; padding: 3rem 1rem; color: var(--text-muted);
        border: 1px dashed var(--border); border-radius: 10px;
      }
    `}</style>
  )
}

function StudyStyles() {
  return (
    <style>{`
      .fc-study-wrapper {
        min-height: calc(100vh - 60px);
        display: flex; flex-direction: column; align-items: center;
        padding: 2rem 1rem;
        gap: 2rem;
      }
      .fc-study-header {
        width: 100%; max-width: 560px;
        display: flex; align-items: center; justify-content: space-between;
      }
      .fc-exit-btn {
        background: none; border: 1px solid var(--border);
        color: var(--text-muted); border-radius: 6px;
        padding: 0.3rem 0.75rem; font-size: 0.85rem; cursor: pointer;
        transition: border-color 0.13s, color 0.13s;
      }
      .fc-exit-btn:hover { border-color: var(--accent); color: var(--accent); }
      .fc-progress-label {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.8rem; color: var(--text-muted);
      }

      .fc-scene {
        width: 100%; max-width: 520px; min-height: 260px;
        perspective: 1000px;
        cursor: pointer;
      }
      .fc-card {
        width: 100%; min-height: 260px;
        position: relative;
        transform-style: preserve-3d;
        transition: transform 0.45s cubic-bezier(.4,0,.2,1);
        border-radius: 14px;
      }
      .fc-card.is-flipped { transform: rotateY(180deg); }

      .fc-card-face {
        position: absolute; inset: 0;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        border-radius: 14px;
        border: 1px solid var(--border);
        padding: 2rem 1.75rem;
        display: flex; flex-direction: column; align-items: flex-start;
        gap: 0.75rem;
        background: var(--surface-2);
        min-height: 260px;
      }
      .fc-card-front { background: var(--surface-2); }
      .fc-card-back {
        background: var(--bg);
        transform: rotateY(180deg);
      }
      .fc-side-label {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-muted);
      }
      .fc-card-front .fc-side-label { color: var(--accent); }
      .fc-card-text { font-size: 1.05rem; color: var(--text); line-height: 1.6; margin: 0; flex: 1; }
      .fc-flip-cue { font-size: 0.75rem; color: var(--text-muted); margin-top: auto; }
      .fc-animating { pointer-events: none; }

      .fc-study-nav {
        display: flex; align-items: center; gap: 1rem;
        width: 100%; max-width: 520px; justify-content: space-between;
      }
      .fc-nav-btn {
        padding: 0.4rem 1rem; border-radius: 7px;
        border: 1px solid var(--border);
        background: var(--surface-2);
        color: var(--text); font-size: 0.875rem; cursor: pointer;
        transition: border-color 0.13s, color 0.13s;
      }
      .fc-nav-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
      .fc-nav-btn:disabled { opacity: 0.35; cursor: default; }
      .fc-dots { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; flex: 1; }
      .fc-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: var(--border); cursor: pointer;
        transition: background 0.15s;
      }
      .fc-dot.active { background: var(--accent); }
      .fc-dot:hover:not(.active) { background: var(--text-muted); }

      .fc-study-empty { text-align: center; padding: 4rem 1rem; color: var(--text-muted); }
    `}</style>
  )
}
