import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ProgressBar from './components/ProgressBar.jsx'
import Hook from './components/sections/Hook.jsx'
import ConceptMap from './components/sections/ConceptMap.jsx'
import CoreConcept from './components/sections/CoreConcept.jsx'
import Insights from './components/sections/Insights.jsx'
import Quiz from './components/sections/Quiz.jsx'
import Challenge from './components/sections/Challenge.jsx'
import Summary from './components/sections/Summary.jsx'
import Complete from './components/sections/Complete.jsx'

function buildSections(lesson) {
  const s = ['hook', 'concept_map']
  const concepts = lesson.core_concepts || []
  concepts.forEach((_, i) => s.push(`concept:${i}`))
  s.push('insights', 'quiz', 'challenge', 'summary', 'complete')
  return s
}

function sectionLabel(section, lesson) {
  if (section === 'hook') return 'Hook'
  if (section === 'concept_map') return 'Concept Map'
  if (section.startsWith('concept:')) {
    const idx = parseInt(section.split(':')[1])
    const c = (lesson.core_concepts || [])[idx]
    return c ? c.title : `Concept ${idx + 1}`
  }
  const map = { insights: 'Key Insights', quiz: 'Quiz', challenge: 'Coding Challenge', summary: 'Summary', complete: 'Complete' }
  return map[section] || section
}

export default function App() {
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sections, setSections] = useState([])
  const [sectionIdx, setSectionIdx] = useState(0)
  const [visited, setVisited] = useState(new Set())
  const [startTime] = useState(Date.now())
  const [quizScore, setQuizScore] = useState(0)
  const [mqScores, setMqScores] = useState({}) // key: `${cIdx}_${qIdx}` → 1|0
  const pollRef = useRef(null)

  const fetchLesson = useCallback(async () => {
    try {
      const res = await fetch('/api/lesson')
      if (!res.ok) { setError('No lesson loaded yet.'); setLoading(false); return }
      const data = await res.json()
      setLesson(data)
      setLoading(false)
      const built = buildSections(data)
      setSections(prev => prev.length < built.length ? built : prev.length ? prev : built)
    } catch {
      setError('Cannot reach server. Is uvicorn running on port 8000?')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLesson()
  }, [fetchLesson])

  // Poll if still generating
  useEffect(() => {
    if (!lesson) return
    if (lesson._generation_status === 'complete') {
      clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(async () => {
      const res = await fetch('/api/lesson').catch(() => null)
      if (!res || !res.ok) return
      const data = await res.json()
      setLesson(data)
      if (data._generation_status === 'complete') {
        const built = buildSections(data)
        setSections(built)
        clearInterval(pollRef.current)
      }
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [lesson?._generation_status])

  const goTo = (idx) => {
    setVisited(v => new Set([...v, sectionIdx]))
    setSectionIdx(idx)
  }
  const goNext = () => goTo(Math.min(sectionIdx + 1, sections.length - 1))
  const goPrev = () => goTo(Math.max(sectionIdx - 1, 0))

  if (loading) return (
    <div className="loading-screen">
      <div style={{width:28,height:28,border:'2px solid rgba(255,255,255,0.08)',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.9s linear infinite'}}/>
      Loading lesson...
    </div>
  )

  if (error || !lesson) return (
    <div className="no-lesson">
      <div className="no-lesson-card">
        <h1>No Lesson Loaded</h1>
        <p>{error || 'Generate today\'s lesson first by running /teach in Claude Code.'}</p>
        <div className="code-hint">/teach</div>
        <p style={{marginTop:'1rem',fontSize:'0.85rem',color:'var(--text-muted)'}}>Then refresh this page.</p>
      </div>
    </div>
  )

  const pct = Math.round((sectionIdx / Math.max(sections.length - 1, 1)) * 100)
  const current = sections[sectionIdx]

  const sharedProps = { lesson, goNext, goPrev, canGoPrev: sectionIdx > 0, canGoNext: sectionIdx < sections.length - 1 }

  const renderSection = () => {
    if (current === 'hook') return <Hook {...sharedProps} />
    if (current === 'concept_map') return <ConceptMap {...sharedProps} />
    if (current?.startsWith('concept:')) {
      const idx = parseInt(current.split(':')[1])
      return <CoreConcept {...sharedProps} conceptIdx={idx} mqScores={mqScores} setMqScores={setMqScores} />
    }
    if (current === 'insights') return <Insights {...sharedProps} />
    if (current === 'quiz') return <Quiz {...sharedProps} quizScore={quizScore} setQuizScore={setQuizScore} />
    if (current === 'challenge') return <Challenge {...sharedProps} />
    if (current === 'summary') return <Summary {...sharedProps} />
    if (current === 'complete') return <Complete {...sharedProps} quizScore={quizScore} startTime={startTime} />
    return null
  }

  return (
    <div className="app-shell">
      <div className="progress-bar-slot">
        <ProgressBar pct={pct} />
      </div>
      <div className="sidebar">
        <Sidebar
          lesson={lesson}
          sections={sections}
          sectionIdx={sectionIdx}
          visited={visited}
          mqScores={mqScores}
          sectionLabel={sectionLabel}
          goTo={goTo}
          quizScore={quizScore}
          startTime={startTime}
        />
      </div>
      <main className="main-content section-fade" key={sectionIdx}>
        {renderSection()}
      </main>
    </div>
  )
}
