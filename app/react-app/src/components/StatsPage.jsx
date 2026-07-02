import { useEffect, useState } from 'react'

function fmtPct(p) {
  if (p === null || p === undefined) return '—'
  return `${Math.round(p * 100)}%`
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TrackBar({ track }) {
  const actualPct = Math.min(100, Math.round((track.actual_pct || 0) * 100))
  const targetPct = track.target_pct != null ? Math.min(100, Math.round(track.target_pct * 100)) : null
  const coveragePct = track.total > 0 ? Math.round((track.completed / track.total) * 100) : 0

  return (
    <div className="track-row">
      <div className="track-row-head">
        <span className="track-row-title">{track.title}</span>
        <span className="track-row-count">{track.completed}/{track.total}</span>
      </div>
      <div className="track-bar-track">
        <div className="track-bar-fill" style={{ width: `${coveragePct}%` }} />
        {targetPct !== null && (
          <div className="track-bar-target" style={{ left: `${targetPct}%` }} title={`Target mix: ${targetPct}%`} />
        )}
      </div>
      <div className="track-row-foot">
        <span>{fmtPct(track.actual_pct)} of your sessions</span>
        {targetPct !== null && <span className="track-row-target-label">target {targetPct}%</span>}
      </div>
    </div>
  )
}

function ScoreTrendChart({ trend }) {
  if (!trend || trend.length === 0) return <p className="stats-empty">No quiz scores yet.</p>

  const w = 640
  const h = 140
  const padX = 16
  const padY = 20
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const n = trend.length

  const x = i => (n === 1 ? padX + innerW / 2 : padX + (innerW * i) / (n - 1))
  const y = pct => padY + innerH * (1 - (pct ?? 0))

  const scored = trend.map((t, i) => ({ ...t, i })).filter(t => t.score_pct !== null && t.score_pct !== undefined)
  const linePath = scored.map((t, idx) => `${idx === 0 ? 'M' : 'L'} ${x(t.i)} ${y(t.score_pct)}`).join(' ')

  return (
    <div className="score-trend-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="score-trend-svg" preserveAspectRatio="none">
        <line x1={padX} y1={y(0.6)} x2={w - padX} y2={y(0.6)} className="trend-gridline" />
        <line x1={padX} y1={y(0.8)} x2={w - padX} y2={y(0.8)} className="trend-gridline" />
        {scored.length > 1 && <path d={linePath} className="trend-line" fill="none" />}
        {trend.map((t, i) => {
          const cx = x(i)
          const hasScore = t.score_pct !== null && t.score_pct !== undefined
          const cy = hasScore ? y(t.score_pct) : y(0)
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={hasScore ? cy : padY + innerH / 2}
                r={hasScore ? 4 : 4}
                className={hasScore ? 'trend-dot' : 'trend-dot-hollow'}
              >
                <title>{`${t.title} — ${hasScore ? fmtPct(t.score_pct) : 'not scored'} (${fmtDate(t.date)})`}</title>
              </circle>
            </g>
          )
        })}
      </svg>
      <div className="score-trend-legend">
        <span><span className="trend-dot-legend filled" /> scored</span>
        <span><span className="trend-dot-legend hollow" /> no score</span>
      </div>
    </div>
  )
}

function WeakAreaRow({ w }) {
  const dots = Math.min(w.reinforced_count || 0, 5)
  return (
    <div className={`weak-area-row${w.retired ? ' retired' : ''}`}>
      <span className="weak-area-phrase">{w.phrase}</span>
      <span className="weak-area-meta">
        {w.age_days !== null && w.age_days !== undefined && (
          <span className="age-badge">{w.age_days}d old</span>
        )}
        <span className="reinforced-dots">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`reinforced-dot${i < dots ? ' filled' : ''}`} />
          ))}
        </span>
        {w.retired && <span className="retired-label">retired</span>}
      </span>
    </div>
  )
}

export default function StatsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.ok ? r.json() : Promise.reject('Server error'))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Could not load stats.'); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="library-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', paddingTop: '2rem' }}>
        <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        Loading stats...
      </div>
    </div>
  )

  if (error) return (
    <div className="library-page">
      <p style={{ color: 'var(--error)' }}>{error}</p>
    </div>
  )

  const {
    tracks = [],
    score_trend = [],
    weak_areas = [],
    review_debt = { overdue: [], next_7_days: [] },
    streak = 0,
    requiz_queue = [],
  } = data || {}

  const activeWeakAreas = weak_areas.filter(w => !w.retired)
  const retiredWeakAreas = weak_areas.filter(w => w.retired)

  return (
    <div className="library-page">
      <div className="library-header">
        <h1>Stats</h1>
        <p>Coverage, trend, and what still needs work</p>
      </div>

      {streak > 0 && (
        <div className="stats-callout streak-callout">
          <span className="streak-pill">🔥 {streak} day streak</span>
        </div>
      )}

      {requiz_queue.length > 0 && (
        <div className="stats-callout requiz-callout">
          <strong>Re-quiz queue</strong>
          <span>{requiz_queue.length} topic{requiz_queue.length === 1 ? '' : 's'} due for a re-check: {requiz_queue.join(', ')}</span>
        </div>
      )}

      <section className="stats-section">
        <h3>Track Coverage</h3>
        {tracks.length === 0 ? (
          <p className="stats-empty">No track data yet.</p>
        ) : (
          <div className="track-list">
            {tracks.map(t => <TrackBar key={t.id} track={t} />)}
          </div>
        )}
      </section>

      <section className="stats-section">
        <h3>Score Trend</h3>
        <ScoreTrendChart trend={score_trend} />
      </section>

      <section className="stats-section">
        <h3>Weak Areas</h3>
        {weak_areas.length === 0 ? (
          <p className="stats-empty">No weak areas flagged yet.</p>
        ) : (
          <div className="weak-area-list">
            {activeWeakAreas.map((w, i) => <WeakAreaRow key={i} w={w} />)}
            {retiredWeakAreas.map((w, i) => <WeakAreaRow key={`r${i}`} w={w} />)}
          </div>
        )}
      </section>

      <section className="stats-section">
        <h3>Review Debt</h3>
        <div className="review-debt-grid">
          <div>
            <div className="review-debt-label overdue">Overdue</div>
            {review_debt.overdue.length === 0 ? (
              <p className="stats-empty">Nothing overdue.</p>
            ) : (
              <ul className="review-debt-list">
                {review_debt.overdue.map(item => (
                  <li key={item.slug} className="review-debt-item overdue">
                    <span>{item.title}</span>
                    <span className="review-debt-due">{fmtDate(item.due)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="review-debt-label">Next 7 Days</div>
            {review_debt.next_7_days.length === 0 ? (
              <p className="stats-empty">Nothing due soon.</p>
            ) : (
              <ul className="review-debt-list">
                {review_debt.next_7_days.map(item => (
                  <li key={item.slug} className="review-debt-item">
                    <span>{item.title}</span>
                    <span className="review-debt-due">{fmtDate(item.due)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
