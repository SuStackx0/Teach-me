import { useState, useEffect } from 'react'

function PlanCard({ plan, onDelete, onAddLesson, onRemoveLesson, onToggleDone }) {
  const [expanded, setExpanded] = useState(false)
  const [addSlug, setAddSlug] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    const slug = addSlug.trim()
    if (!slug) return
    setAdding(true)
    await onAddLesson(plan.id, slug)
    setAddSlug('')
    setAdding(false)
  }

  const daysLeft = () => {
    if (!plan.target_date) return null
    const diff = Math.ceil((new Date(plan.target_date) - new Date()) / 86400000)
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true }
    if (diff === 0) return { label: 'Due today', overdue: false }
    return { label: `${diff}d left`, overdue: false }
  }
  const dl = daysLeft()

  return (
    <div className="plan-card">
      <div className="plan-card-header" onClick={() => setExpanded(e => !e)}>
        <div className="plan-card-title-row">
          <span className="plan-chevron">{expanded ? '▾' : '▸'}</span>
          <span className="plan-name">{plan.name}</span>
          {plan.target_date && dl && (
            <span className="plan-date-pill" style={{ color: dl.overdue ? 'var(--error)' : 'var(--text-muted)' }}>
              {dl.label}
            </span>
          )}
          <span className="plan-progress">{plan.progress}</span>
        </div>
        {plan.description && (
          <p className="plan-desc">{plan.description}</p>
        )}
      </div>

      {expanded && (
        <div className="plan-card-body">
          {plan.lessons.length === 0 ? (
            <p className="plan-empty">No lessons added yet.</p>
          ) : (
            <ul className="plan-lesson-list">
              {plan.lessons.map(l => (
                <li key={l.slug} className={`plan-lesson-item${l.done ? ' done' : ''}`}>
                  <label className="plan-lesson-check">
                    <input
                      type="checkbox"
                      checked={!!l.done}
                      onChange={e => onToggleDone(plan.id, l.slug, e.target.checked)}
                    />
                    <span className="plan-lesson-slug">{l.slug}</span>
                  </label>
                  <button
                    className="plan-remove-btn"
                    onClick={() => onRemoveLesson(plan.id, l.slug)}
                    title="Remove"
                  >×</button>
                </li>
              ))}
            </ul>
          )}

          <div className="plan-add-lesson-row">
            <input
              className="plan-slug-input"
              type="text"
              placeholder="lesson-slug"
              value={addSlug}
              onChange={e => setAddSlug(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              className="plan-add-btn"
              onClick={handleAdd}
              disabled={adding || !addSlug.trim()}
            >+ Add</button>
          </div>
        </div>
      )}

      <button
        className="plan-delete-btn"
        onClick={() => onDelete(plan.id)}
        title="Delete plan"
      >Delete plan</button>
    </div>
  )
}

export default function PlannerPage() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', target_date: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const loadPlans = async () => {
    try {
      const r = await fetch('/api/plans')
      if (r.ok) {
        const data = await r.json()
        setPlans(data.plans || [])
      }
    } catch (e) {
      setError('Failed to load plans.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPlans() }, [])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const r = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (r.ok) {
        setForm({ name: '', description: '', target_date: '' })
        setShowForm(false)
        await loadPlans()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (pid) => {
    if (!confirm('Delete this plan?')) return
    await fetch(`/api/plans/${pid}`, { method: 'DELETE' })
    await loadPlans()
  }

  const handleAddLesson = async (pid, slug) => {
    await fetch(`/api/plans/${pid}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
    await loadPlans()
  }

  const handleRemoveLesson = async (pid, slug) => {
    await fetch(`/api/plans/${pid}/lessons/${slug}`, { method: 'DELETE' })
    await loadPlans()
  }

  const handleToggleDone = async (pid, slug, done) => {
    await fetch(`/api/plans/${pid}/lessons/${slug}/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    })
    await loadPlans()
  }

  return (
    <div className="page-container">
      <div className="page-header-row">
        <h1 className="page-title">Study Planner</h1>
        <button className="primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ New Plan'}
        </button>
      </div>

      {error && <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>}

      {showForm && (
        <div className="plan-create-form">
          <h3 style={{ marginBottom: '0.75rem', color: 'var(--text)' }}>New Study Plan</h3>
          <div className="plan-form-field">
            <label>Name <span style={{ color: 'var(--error)' }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. LLM Architecture deep dive"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="plan-form-field">
            <label>Description</label>
            <input
              type="text"
              placeholder="Optional goal description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="plan-form-field">
            <label>Target Date</label>
            <input
              type="date"
              value={form.target_date}
              onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              className="primary"
              onClick={handleCreate}
              disabled={creating || !form.name.trim()}
            >
              {creating ? 'Creating…' : 'Create Plan'}
            </button>
            <button onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen" style={{ height: 200 }}>Loading…</div>
      ) : plans.length === 0 ? (
        <div className="plan-empty-state">
          <p>No study plans yet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Create a plan to group lessons into a named goal with a target date.
          </p>
        </div>
      ) : (
        <div className="plan-list">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onDelete={handleDelete}
              onAddLesson={handleAddLesson}
              onRemoveLesson={handleRemoveLesson}
              onToggleDone={handleToggleDone}
            />
          ))}
        </div>
      )}

      <style>{`
        .page-container { max-width: 800px; margin: 0 auto; padding: 2rem 1.5rem; }
        .page-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
        .page-title { font-size: 1.5rem; font-weight: 600; color: var(--text); margin: 0; }

        .plan-create-form {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }
        .plan-form-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 0.75rem; }
        .plan-form-field label { font-size: 0.8rem; color: var(--text-muted); font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em; }
        .plan-form-field input {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.45rem 0.65rem;
          color: var(--text);
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .plan-form-field input:focus { border-color: var(--accent); }

        .plan-list { display: flex; flex-direction: column; gap: 0.75rem; }

        .plan-card {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          position: relative;
        }
        .plan-card-header {
          padding: 1rem 1.25rem;
          cursor: pointer;
          user-select: none;
        }
        .plan-card-header:hover { background: var(--accent-dim); }
        .plan-card-title-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .plan-chevron { color: var(--text-muted); font-size: 0.85rem; min-width: 14px; }
        .plan-name { font-weight: 600; color: var(--text); flex: 1; }
        .plan-date-pill {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.7rem;
          padding: 2px 7px;
          border-radius: 999px;
          background: var(--bg);
          border: 1px solid var(--border);
        }
        .plan-progress {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.72rem;
          color: var(--accent);
          background: var(--accent-dim);
          padding: 2px 8px;
          border-radius: 999px;
        }
        .plan-desc { margin: 0.4rem 0 0 1.4rem; font-size: 0.85rem; color: var(--text-muted); }

        .plan-card-body { padding: 0 1.25rem 1rem; }
        .plan-empty { color: var(--text-muted); font-size: 0.875rem; padding: 0.5rem 0; }

        .plan-lesson-list { list-style: none; margin: 0 0 0.75rem; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .plan-lesson-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.35rem 0.5rem;
          border-radius: 6px;
          background: var(--bg);
          border: 1px solid var(--border);
          transition: opacity 0.15s;
        }
        .plan-lesson-item.done { opacity: 0.5; }
        .plan-lesson-check { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; flex: 1; }
        .plan-lesson-check input { accent-color: var(--accent); width: 14px; height: 14px; }
        .plan-lesson-slug { font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; color: var(--text); }
        .plan-lesson-item.done .plan-lesson-slug { text-decoration: line-through; color: var(--text-muted); }
        .plan-remove-btn {
          background: none; border: none; color: var(--text-muted); cursor: pointer;
          font-size: 1rem; padding: 0 4px; line-height: 1;
          transition: color 0.13s;
        }
        .plan-remove-btn:hover { color: var(--error); }

        .plan-add-lesson-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
        .plan-slug-input {
          flex: 1;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.35rem 0.6rem;
          color: var(--text);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.8rem;
          outline: none;
        }
        .plan-slug-input:focus { border-color: var(--accent); }
        .plan-add-btn {
          background: var(--accent-dim);
          color: var(--accent);
          border: 1px solid var(--accent);
          border-radius: 6px;
          padding: 0.3rem 0.75rem;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background 0.13s;
        }
        .plan-add-btn:hover:not(:disabled) { background: var(--accent); color: var(--bg); }
        .plan-add-btn:disabled { opacity: 0.5; cursor: default; }

        .plan-delete-btn {
          display: block;
          width: 100%;
          text-align: left;
          padding: 0.5rem 1.25rem;
          background: none;
          border: none;
          border-top: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.8rem;
          cursor: pointer;
          transition: color 0.13s, background 0.13s;
        }
        .plan-delete-btn:hover { color: var(--error); background: var(--accent-dim); }

        .plan-empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: var(--text-muted);
          border: 1px dashed var(--border);
          border-radius: 10px;
        }
      `}</style>
    </div>
  )
}
