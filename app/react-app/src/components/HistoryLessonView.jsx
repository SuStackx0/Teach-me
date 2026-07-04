import { useRef, useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLessonSession, sectionLabel } from '../hooks/useLessonSession.js'
import { useClipAction } from '../hooks/useClipAction.js'
import Sidebar from './Sidebar.jsx'
import ProgressBar from './ProgressBar.jsx'
import NotesPanel from './NotesPanel.jsx'
import Hook from './sections/Hook.jsx'
import ConceptMap from './sections/ConceptMap.jsx'
import CoreConcept from './sections/CoreConcept.jsx'
import Insights from './sections/Insights.jsx'
import Quiz from './sections/Quiz.jsx'
import Challenge from './sections/Challenge.jsx'
import Summary from './sections/Summary.jsx'
import Scenario from './sections/Scenario.jsx'

export default function HistoryLessonView() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [notesCollapsed, setNotesCollapsed] = useState(
    () => localStorage.getItem('notes-panel-collapsed') === 'true'
  )
  const [focusMode, setFocusMode] = useState(
    () => localStorage.getItem('focus-mode') === 'true'
  )
  const mainRef = useRef(null)

  const session = useLessonSession(`/api/lesson/${slug}`)
  const {
    lesson, loading, error, sections, sectionIdx, visited,
    mqScores, setMqScores, quizScore, setQuizScore,
    startTime, goTo, goNext, goPrev, canGoNext, canGoPrev,
  } = session

  const getCurrentSection = useCallback(() => {
    if (!lesson || !sections[sectionIdx]) return ''
    return sectionLabel(sections[sectionIdx], lesson)
  }, [lesson, sections, sectionIdx])

  const [bookmarkFlash, setBookmarkFlash] = useState(false)
  const { chipPos, lastSelectedText } = useClipAction({
    mainRef,
    getCurrentSection,
    lessonTitle: lesson?.meta?.title || '',
  })

  const handleToggleCollapse = () => {
    setNotesCollapsed(c => {
      const next = !c
      localStorage.setItem('notes-panel-collapsed', String(next))
      return next
    })
  }

  const handleToggleFocus = useCallback(() => {
    setFocusMode(f => {
      const next = !f
      localStorage.setItem('focus-mode', String(next))
      return next
    })
  }, [])

  useEffect(() => {
    const handle = (e) => {
      if (e.key !== 'f' && e.key !== 'F') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
      handleToggleFocus()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [handleToggleFocus])

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
    if (current === 'scenario') return <Scenario {...sharedProps} />
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

  const shellClass = `app-shell with-notes${notesCollapsed ? ' notes-collapsed' : ''}${focusMode ? ' focus-mode' : ''}`

  return (
    <div className={shellClass}>
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
      <main ref={mainRef} className="main-content section-fade" key={sectionIdx}>
        <div className="history-banner">
          Archived lesson — quiz scores are not saved
        </div>
        {renderSection()}
      </main>
      <NotesPanel
        slug={slug}
        currentSection={getCurrentSection()}
        lessonTitle={lesson?.meta?.title || ''}
        collapsed={notesCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      {chipPos && (
        <div className="clip-chip" style={{ top: chipPos.top, left: chipPos.left, position: 'fixed', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span><kbd>⌘L</kbd> Clip to Notes</span>
          <button
            className="clip-bookmark-btn"
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              const text = lastSelectedText.current || window.getSelection()?.toString().trim()
              if (!text) return
              const lessonSlug = lesson?.meta?.slug || slug
              const section = getCurrentSection()
              fetch('/api/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: lessonSlug, title: lesson?.meta?.title || '', section, content: text })
              }).then(() => {
                setBookmarkFlash(true)
                setTimeout(() => setBookmarkFlash(false), 1500)
              }).catch(() => {})
              window.getSelection()?.removeAllRanges()
              lastSelectedText.current = ''
            }}
          >{bookmarkFlash ? '★ Saved!' : '☆ Bookmark'}</button>
        </div>
      )}
      <button
        className={`focus-toggle${focusMode ? ' active' : ''}`}
        onClick={handleToggleFocus}
        title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
      >
        {focusMode ? '⊠' : '⊞'}
      </button>
    </div>
  )
}
