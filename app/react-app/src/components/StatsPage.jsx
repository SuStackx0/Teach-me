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

function isRecent(dateStr) {
  if (!dateStr) return false
  const diff = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)
  return diff <= 7
}

function StudyTimeStats({ completed }) {
  if (!completed || completed.length === 0) {
    return <p className="stats-empty">No time data yet — time is recorded automatically each session.</p>
  }

  const minutes = completed.map(e => e.time_spent_minutes || 0)
  const totalMinutes = minutes.reduce((a, b) => a + b, 0)

  if (totalMinutes === 0) {
    return <p className="stats-empty">No time data yet — time is recorded automatically each session.</p>
  }

  const totalHours = (totalMinutes / 60).toFixed(1)
  const avgMin = Math.round(totalMinutes / completed.length)
  const longestMin = Math.max(...minutes)
  const totalSessions = completed.length

  const tiles = [
    { label: 'Total Sessions', value: totalSessions },
    { label: 'Total Hours', value: `${totalHours} hrs` },
    { label: 'Avg Session', value: `${avgMin} min` },
    { label: 'Longest Session', value: `${longestMin} min` },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
      {tiles.map(tile => (
        <div
          key={tile.label}
          style={{
            padding: '1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--accent)',
            fontFamily: 'IBM Plex Mono, monospace',
            lineHeight: 1.2,
            marginBottom: '0.4rem',
          }}>
            {tile.value}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {tile.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function StudyGrid({ completed }) {
  const CELL = 11, GAP = 2, STEP = CELL + GAP
  const cols = 53, rows = 7
  const W = cols * STEP, H = rows * STEP
  const LABEL_H = 18

  const studiedDates = new Set((completed || []).map(e => e.date).filter(Boolean))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build 364 days (52 full weeks + today's partial column = 53 cols max)
  const totalDays = 364
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - totalDays)

  const cells = []
  for (let d = 0; d <= totalDays; d++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + d)
    const col = Math.floor(d / 7)
    const row = d % 7
    const dateStr = date.toISOString().slice(0, 10)
    cells.push({ col, row, dateStr, studied: studiedDates.has(dateStr), date })
  }

  // Month labels: find first week col for each month
  const monthLabels = []
  const seenMonths = new Set()
  for (const cell of cells) {
    if (cell.row === 0) {
      const monthKey = `${cell.date.getFullYear()}-${cell.date.getMonth()}`
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey)
        monthLabels.push({
          col: cell.col,
          label: cell.date.toLocaleDateString('en-US', { month: 'short' }),
        })
      }
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        width={W}
        height={LABEL_H + H}
        aria-label="Study activity grid"
      >
        {/* Month labels */}
        {monthLabels.map(({ col, label }) => (
          <text
            key={`${col}-${label}`}
            x={col * STEP}
            y={LABEL_H - 4}
            fontSize={9}
            fill="var(--text-muted)"
          >
            {label}
          </text>
        ))}

        {/* Day cells */}
        {cells.map(({ col, row, dateStr, studied }) => (
          <rect
            key={dateStr}
            x={col * STEP}
            y={LABEL_H + row * STEP}
            width={CELL}
            height={CELL}
            rx={2}
            fill={studied ? 'var(--accent)' : 'var(--surface-2)'}
            opacity={studied ? 1 : 0.5}
          >
            <title>{dateStr}{studied ? ' — studied' : ''}</title>
          </rect>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width={11} height={11}><rect width={11} height={11} rx={2} fill="var(--accent)" /></svg>
          Studied
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width={11} height={11}><rect width={11} height={11} rx={2} fill="var(--surface-2)" opacity={0.5} /></svg>
          No session
        </span>
      </div>
    </div>
  )
}

function DomainDonut({ completed }) {
  if (!completed || completed.length === 0) {
    return <p className="stats-empty">No sessions yet.</p>
  }

  const DOMAIN_DISPLAY = {
    'llm-architecture': 'LLM Architecture',
    'inference-serving': 'Inference & Serving',
    'training-alignment': 'Training & Alignment',
    'agentic-systems': 'Agentic Systems',
    'ml-evaluation': 'ML/DS & Evaluation',
    'mlops': 'MLOps',
    'backend-systems': 'Backend Systems',
    'system-design': 'System Design / HLD',
    'cross-domain': 'Cross-domain',
    'wildcard': 'Wildcard',
  }

  const COLORS = ['#2A6B4F','#4A9B73','#7BC4A0','#A8D8C0','#D4EDE4','#6B8E4F','#9BBE73','#C4D8A0']

  const counts = {}
  for (const s of completed) {
    const key = s.domain || 'wildcard'
    counts[key] = (counts[key] || 0) + 1
  }
  const entries = Object.entries(counts).filter(([, v]) => v > 0)
  const total = entries.reduce((a, [, v]) => a + v, 0)

  if (total === 0) return <p className="stats-empty">No sessions yet.</p>

  // Build SVG arc paths
  const cx = 100, cy = 100, outerR = 70, innerR = 45
  const toRad = deg => (deg - 90) * (Math.PI / 180)
  const polarToXY = (r, deg) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  })

  let currentAngle = 0
  const slices = entries.map(([domain, count], i) => {
    const angle = (count / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle += angle

    const largeArc = angle > 180 ? 1 : 0
    const o1 = polarToXY(outerR, startAngle)
    const o2 = polarToXY(outerR, endAngle)
    const i1 = polarToXY(innerR, endAngle)
    const i2 = polarToXY(innerR, startAngle)

    const d = [
      `M ${o1.x} ${o1.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
      'Z',
    ].join(' ')

    return { domain, count, d, color: COLORS[i % COLORS.length] }
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
        <svg viewBox="0 0 200 200" width={180} height={180} style={{ flexShrink: 0 }}>
          {slices.map(s => (
            <path key={s.domain} d={s.d} fill={s.color}>
              <title>{DOMAIN_DISPLAY[s.domain] || s.domain}: {s.count}</title>
            </path>
          ))}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fontSize={20}
            fontWeight={700}
            fill="var(--text-primary)"
            fontFamily="IBM Plex Mono, monospace"
          >
            {total}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fontSize={9}
            fill="var(--text-muted)"
          >
            sessions
          </text>
        </svg>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', flex: 1 }}>
          {slices.map(s => (
            <div key={s.domain} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span>{DOMAIN_DISPLAY[s.domain] || s.domain}</span>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function StatsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [memory, setMemory] = useState(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.ok ? r.json() : Promise.reject('Server error'))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Could not load stats.'); setLoading(false) })

    fetch('/api/summary/latest')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.exists) setSummary(d) })
      .catch(() => {})

    fetch('/api/memory')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMemory(d) })
      .catch(() => {})
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

      {summary && isRecent(summary.generated_date) && (
        <div className="stats-callout" style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>📊 {summary.summary_title || '10-Session Summary'}</div>
          {summary.strengths?.length > 0 && (
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>Strengths: </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{summary.strengths.join(' · ')}</span>
            </div>
          )}
          {summary.gaps?.length > 0 && (
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 600 }}>Gaps: </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{summary.gaps.join(' · ')}</span>
            </div>
          )}
          {summary.next_focus?.length > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Next focus: </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{summary.next_focus.join(', ')}</span>
            </div>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Generated {summary.generated_date}</div>
        </div>
      )}

      {requiz_queue.length > 0 && (
        <div className="stats-callout requiz-callout">
          <strong>Re-quiz queue</strong>
          <span>{requiz_queue.length} topic{requiz_queue.length === 1 ? '' : 's'} due for a re-check: {requiz_queue.join(', ')}</span>
        </div>
      )}

      <section className="stats-section">
        <h3>Study Time</h3>
        <StudyTimeStats completed={memory?.completed} />
      </section>

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
        <h3>Study Activity</h3>
        <StudyGrid completed={memory?.completed} />
      </section>

      <section className="stats-section">
        <h3>Topic Distribution</h3>
        <DomainDonut completed={memory?.completed} />
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
