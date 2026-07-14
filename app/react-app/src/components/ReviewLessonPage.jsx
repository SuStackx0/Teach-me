import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

function RecallCard({ q, a, hint, idx }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      background: 'var(--surface)',
    }}>
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.6rem',
        }}>
          <span style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.6rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)',
            background: 'var(--accent-dim)', padding: '2px 7px', borderRadius: 4,
          }}>Q{idx + 1}</span>
          {hint && (
            <span style={{
              fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.6rem',
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>{hint}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.6 }}>{q}</p>
      </div>

      {!revealed ? (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0.6rem 1.25rem' }}>
          <button
            onClick={() => setRevealed(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.8rem',
              fontFamily: 'IBM Plex Mono, monospace', padding: 0,
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--accent)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
          >
            reveal answer ▾
          </button>
        </div>
      ) : (
        <div style={{
          borderTop: '1px solid var(--border)', padding: '0.875rem 1.25rem',
          background: 'var(--accent-dim)',
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.6 }}>{a}</p>
        </div>
      )}
    </div>
  )
}

export default function ReviewLessonPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/review/content/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e === 404 ? 'not_generated' : 'Could not load revision content.'); setLoading(false) })
  }, [slug])

  if (loading) return (
    <div className="library-page">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem', paddingTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
          <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          Generating revision session...
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Claude is producing recall questions targeted at this lesson. Takes ~5s, then cached.</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="library-page">
      {error === 'not_generated' ? (
        <div style={{ maxWidth: 480 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Revision content hasn't been generated for this lesson yet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>It's generated automatically when you say <code style={{ fontFamily: 'IBM Plex Mono, monospace', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4 }}>"done"</code> at the end of a session.</p>
        </div>
      ) : (
        <p style={{ color: 'var(--error)' }}>{error}</p>
      )}
      <button onClick={() => navigate('/review')} style={{ marginTop: '1rem' }}>← Back to Review</button>
    </div>
  )

  const { title, recall_questions = [], key_reminders = [] } = data

  return (
    <div className="library-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/review')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', padding: 0, fontFamily: 'IBM Plex Mono, monospace' }}
        >← Review Queue</button>
        <h1 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>Revision: {title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          {recall_questions.length} recall questions · answer before revealing
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2.5rem' }}>
        {recall_questions.map((item, i) => (
          <RecallCard key={i} idx={i} {...item} />
        ))}
      </div>

      {key_reminders.length > 0 && (
        <section>
          <h3 style={{
            fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace',
            marginBottom: '0.75rem', fontWeight: 600,
          }}>Key Reminders</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {key_reminders.map((r, i) => (
              <div key={i} style={{
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                padding: '0.75rem 1rem', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 8,
              }}>
                <span style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', marginTop: 3, flexShrink: 0 }}>◆</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.6 }}>{r}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem' }}>
        <button onClick={() => navigate('/review')}>← Back to Review Queue</button>
        <button
          onClick={() => navigate(`/lesson/${slug}`)}
          style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >Full Lesson</button>
      </div>
    </div>
  )
}
