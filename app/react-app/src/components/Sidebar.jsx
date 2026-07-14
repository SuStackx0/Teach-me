import { useEffect, useState } from 'react'

function elapsed(startTime) {
  const secs = Math.floor((Date.now() - startTime) / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  const h = Math.floor(m / 60)
  if (h) return `${h}h ${m % 60}m`
  return `${m}m ${s}s`
}

export default function Sidebar({ lesson, sections, sectionIdx, visited, mqScores, sectionLabel, goTo, quizScore, startTime, sectionProgress, onSectionCheck }) {
  const meta = lesson.meta || {}
  const [tick, setTick] = useState(0)
  const [queue, setQueue] = useState([])
  const [activateError, setActivateError] = useState(null)
  const [activating, setActivating] = useState(false)

  function activateSlot(slot) {
    if (activating) return
    setActivating(true)
    setActivateError(null)
    fetch(`/api/queue/activate/${slot}`, { method: 'POST' })
      .then(r => {
        if (r.ok) {
          window.location.reload()
        } else if (r.status === 404) {
          setActivateError(slot)
          setActivating(false)
        }
      })
      .catch(() => { setActivateError(slot); setActivating(false) })
  }

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetch('/api/queue')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.slots) setQueue(d.slots.filter(s => s.status === 'ready').slice(0, 4)) })
      .catch(() => {})
  }, [])

  function dotClass(section, i) {
    if (section.startsWith('concept:')) {
      const ci = parseInt(section.split(':')[1])
      const concept = (lesson.core_concepts || [])[ci] || {}
      const mqCount = (concept.micro_quiz || []).length
      if (mqCount === 0) return i === sectionIdx ? 'active' : visited.has(i) ? 'done' : ''
      let anyScored = false, anyMissed = false, allGot = true
      for (let q = 0; q < mqCount; q++) {
        const v = mqScores[`${ci}_${q}`]
        if (v === undefined) { allGot = false }
        else { anyScored = true; if (v === 0) { anyMissed = true; allGot = false } }
      }
      if (anyScored && allGot) return 'got-it'
      if (anyScored && anyMissed) return 'missed'
    }
    if (i === sectionIdx) return 'active'
    if (visited.has(i)) return 'done'
    return ''
  }

  const diff = meta.difficulty || 'intermediate'
  const diffColor = { intermediate: 'var(--accent)', advanced: 'var(--warning)', expert: 'var(--error)' }[diff] || 'var(--accent)'
  const quizTotal = (lesson.quiz || []).length

  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-title">{meta.title || "Today's Lesson"}</div>
        <div className="sidebar-meta">
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: diffColor, background: 'rgba(0,0,0,0.05)', padding: '3px 9px', borderRadius: '999px', border: '1px solid rgba(0,0,0,0.12)' }}>{diff}</span>
          <span style={{ marginLeft: 8 }}>~{meta.estimated_minutes || '?'} min</span>
        </div>
      </div>

      <nav className="toc-list">
        {sections.filter(s => s !== 'complete').map((section, i) => {
          const label = sectionLabel(section, lesson)
          const dc = dotClass(section, i)
          const isActive = i === sectionIdx
          const isChecked = sectionProgress && label ? !!sectionProgress[label]?.checked : false
          return (
            <div key={section} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button className={`toc-item${isActive ? ' active' : ''}`} onClick={() => goTo(i)} style={{ flex: 1 }}>
                <span className={`toc-dot${dc ? ' ' + dc : ''}`} />
                {label}
              </button>
              {onSectionCheck && visited.has(i) && label && (
                <button
                  title={isChecked ? 'Uncheck section' : 'Check off section'}
                  onClick={e => { e.stopPropagation(); onSectionCheck(label, !isChecked) }}
                  style={{
                    flexShrink: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: '0.85rem',
                    color: isChecked ? 'var(--success)' : 'var(--border)',
                    lineHeight: 1,
                    transition: 'color 0.12s',
                  }}
                >
                  {isChecked ? '✓' : '○'}
                </button>
              )}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-stats">
        <div className="sidebar-stats-row"><span>Elapsed</span><span>{elapsed(startTime)}</span></div>
        <div className="sidebar-stats-row"><span>Quiz</span><span style={{ color: 'var(--success)' }}>{quizScore}/{quizTotal}</span></div>
      </div>

      {queue.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Up Next</div>
          {queue.map((slot, i) => (
            <div key={slot.slug}>
              <button
                onClick={() => activateSlot(slot.slot)}
                style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', padding: '4px 0', width: '100%', textDecoration: 'none', borderRadius: 4, background: 'none', border: 'none', borderBottom: i < queue.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: 'var(--accent)', minWidth: 14, flexShrink: 0 }}>{slot.slot}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.12s' }} title={slot.title}
                  onMouseEnter={e => e.target.style.color = 'var(--text)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                >{slot.title}</span>
              </button>
              {activateError === slot.slot && (
                <div style={{ fontSize: '0.65rem', color: 'var(--error)', padding: '2px 0 2px 18px' }}>slot unavailable</div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
