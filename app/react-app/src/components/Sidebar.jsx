import { useEffect, useState } from 'react'

function elapsed(startTime) {
  const secs = Math.floor((Date.now() - startTime) / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  const h = Math.floor(m / 60)
  if (h) return `${h}h ${m % 60}m`
  return `${m}m ${s}s`
}

export default function Sidebar({ lesson, sections, sectionIdx, visited, mqScores, sectionLabel, goTo, quizScore, startTime }) {
  const meta = lesson.meta || {}
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 10000)
    return () => clearInterval(t)
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
  const diffColor = { intermediate: '#7C5CFF', advanced: '#FBBF24', expert: '#F87171' }[diff] || '#7C5CFF'
  const quizTotal = (lesson.quiz || []).length

  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-title">{meta.title || "Today's Lesson"}</div>
        <div className="sidebar-meta">
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: diffColor, background: 'rgba(124,92,255,0.1)', padding: '3px 9px', borderRadius: '999px', border: `1px solid ${diffColor}44` }}>{diff}</span>
          <span style={{ marginLeft: 8 }}>~{meta.estimated_minutes || '?'} min</span>
        </div>
      </div>

      <nav className="toc-list">
        {sections.filter(s => s !== 'complete').map((section, i) => {
          const label = sectionLabel(section, lesson)
          const dc = dotClass(section, i)
          const isActive = i === sectionIdx
          return (
            <button key={section} className={`toc-item${isActive ? ' active' : ''}`} onClick={() => goTo(i)}>
              <span className={`toc-dot${dc ? ' ' + dc : ''}`} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-stats">
        <div className="sidebar-stats-row"><span>Elapsed</span><span>{elapsed(startTime)}</span></div>
        <div className="sidebar-stats-row"><span>Quiz</span><span style={{ color: 'var(--success)' }}>{quizScore}/{quizTotal}</span></div>
      </div>
    </>
  )
}
