import { useParams, useNavigate } from 'react-router-dom'
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

export default function HistoryLessonView() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const session = useLessonSession(`/api/lesson/${slug}`)
  const {
    lesson, loading, error, sections, sectionIdx, visited,
    mqScores, setMqScores, quizScore, setQuizScore,
    startTime, goTo, goNext, goPrev, canGoNext, canGoPrev,
  } = session

  if (loading) return (
    <div className="loading-screen">
      <div style={{
        width: 28, height: 28,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      Loading lesson...
    </div>
  )

  if (error || !lesson) return (
    <div className="no-lesson">
      <div className="no-lesson-card">
        <h1>Lesson Not Found</h1>
        <p>{error || 'This lesson archive could not be loaded.'}</p>
        <button className="primary" onClick={() => navigate('/library')} style={{ marginTop: '1rem' }}>
          &larr; Back to Library
        </button>
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
    if (current === 'complete') return (
      <div className="section-fade">
        <div className="score-hero">
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            marginBottom: 12,
          }}>
            Review Complete
          </div>
          <div className="score-number">{quizScore}/{(lesson.quiz || []).length}</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Quiz Score</div>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => navigate('/library')}>&larr; Back to Library</button>
          <button onClick={goPrev}>&larr; Review Lesson</button>
        </div>
      </div>
    )
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
        <div className="history-banner">
          Archived lesson — quiz scores are not saved
        </div>
        {renderSection()}
      </main>
    </div>
  )
}
