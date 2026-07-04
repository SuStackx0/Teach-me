import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const DOMAIN_DISPLAY = {
  'llm-arch': 'LLM Architecture',
  'inference': 'Inference & Serving',
  'training': 'Training & Alignment',
  'agentic': 'Agentic Systems',
  'backend': 'Backend Systems',
  'system-design': 'System Design',
  'mlops': 'MLOps',
  'ml-ds': 'ML/DS',
  'cross-domain': 'Cross-Domain',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function TILPage() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/til')
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then(data => {
        setItems(data.items || [])
        setTotal(data.total || 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="library-page">
      <div className="library-header">
        <div>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Today I Learned
          </h1>
          {!loading && (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
              {total} lesson{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          color: 'var(--text-muted)',
          fontFamily: 'IBM Plex Serif, serif',
          fontSize: '1rem',
        }}>
          No lessons completed yet. Run /teach to start your first session.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
        }}>
          {items.map(item => (
            <TILCard key={item.slug} item={item} navigate={navigate} />
          ))}
        </div>
      )}

      <style>{`
        .til-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1.1rem 1.2rem 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: border-color 0.15s ease;
        }
        .til-card:hover {
          border-color: var(--accent);
        }
        .til-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .til-domain-badge {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.7rem;
          background: var(--surface-2);
          color: var(--text-muted);
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .til-date {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: 'IBM Plex Mono', monospace;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .til-problem {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--text-primary);
          font-family: 'Inter', sans-serif;
          line-height: 1.45;
        }
        .til-why {
          font-size: 0.9rem;
          color: var(--text-secondary);
          font-family: 'IBM Plex Serif', serif;
          margin-top: 0.25rem;
          line-height: 1.5;
        }
        .til-card-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 0.25rem;
        }
        .til-view-link {
          font-size: 0.8rem;
          color: var(--accent);
          cursor: pointer;
          font-family: 'IBM Plex Mono', monospace;
          background: none;
          border: none;
          padding: 0;
          text-decoration: none;
        }
        .til-view-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

function TILCard({ item, navigate }) {
  const domainLabel = DOMAIN_DISPLAY[item.domain] || item.domain || ''
  const dateStr = formatDate(item.date)

  return (
    <div className="til-card">
      <div className="til-card-top">
        {domainLabel
          ? <span className="til-domain-badge">{domainLabel}</span>
          : <span />
        }
        {dateStr && <span className="til-date">{dateStr}</span>}
      </div>

      <div className="til-problem">{item.problem}</div>

      {item.why_it_matters && (
        <div className="til-why">{item.why_it_matters}</div>
      )}

      <div className="til-card-footer">
        <button
          className="til-view-link"
          onClick={() => navigate(`/lesson/${item.slug}`)}
        >
          → View Lesson
        </button>
      </div>
    </div>
  )
}
