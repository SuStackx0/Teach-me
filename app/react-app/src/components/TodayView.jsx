import { useLessonSession, sectionLabel } from '../hooks/useLessonSession.js'
import Sidebar from './Sidebar.jsx'
import ProgressBar from './ProgressBar.jsx'
import Hook from './sections/Hook.jsx'
import ConceptMap from './sections/ConceptMap.jsx'
import CoreConcept from './sections/CoreConcept.jsx'
import Insights from './sections/Insights.jsx'
import Quiz from './sections/Quiz.jsx'
import Challenge from './sections/Challenge.jsx'
import Summary from './sections/Summary.jsx'
import Complete from './sections/Complete.jsx'

export default function TodayView() {
  const {
    lesson, loading, error,
    sections, sectionIdx,
    visited,
    startTime,
    quizScore, setQuizScore,
    mqScores, setMqScores,
    goTo, goNext, goPrev,
    canGoNext, canGoPrev,
  } = useLessonSession('/api/lesson')

  if (loading) return (
    <div className="loading-screen">
      <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      Loading lesson...
    </div>
  )

  if (error || !lesson) return (
    <div className="no-lesson">
      <div className="no-lesson-card">
        <h1>No Lesson Loaded</h1>
        <p>{error || "Generate today's lesson first by running /teach in Claude Code."}</p>
        <div className="code-hint">/teach</div>
        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Then refresh this page.</p>
      </div>
    </div>
  )

  const pct = Math.round((sectionIdx / Math.max(sections.length - 1, 1)) * 100)
  const current = sections[sectionIdx]

  const sharedProps = { lesson, goNext, goPrev, canGoPrev, canGoNext }

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
