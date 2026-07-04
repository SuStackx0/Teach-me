import { useRef, useState, useCallback, useEffect } from 'react'
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
import Complete from './sections/Complete.jsx'
import Scenario from './sections/Scenario.jsx'

export default function TodayView() {
  const [notesCollapsed, setNotesCollapsed] = useState(
    () => localStorage.getItem('notes-panel-collapsed') === 'true'
  )
  const [focusMode, setFocusMode] = useState(
    () => localStorage.getItem('focus-mode') === 'true'
  )
  const mainRef = useRef(null)

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

  const getCurrentSection = useCallback(() => {
    if (!lesson || !sections[sectionIdx]) return ''
    return sectionLabel(sections[sectionIdx], lesson)
  }, [lesson, sections, sectionIdx])

  const chipPos = useClipAction({
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
    if (current === 'scenario') return <Scenario {...sharedProps} />
    if (current === 'insights') return <Insights {...sharedProps} />
    if (current === 'quiz') return <Quiz {...sharedProps} quizScore={quizScore} setQuizScore={setQuizScore} />
    if (current === 'challenge') return <Challenge {...sharedProps} />
    if (current === 'summary') return <Summary {...sharedProps} />
    if (current === 'complete') return <Complete {...sharedProps} quizScore={quizScore} startTime={startTime} />
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
        {renderSection()}
      </main>
      <NotesPanel
        slug={lesson?.meta?.slug || ''}
        currentSection={getCurrentSection()}
        lessonTitle={lesson?.meta?.title || ''}
        collapsed={notesCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      {chipPos && (
        <div className="clip-chip" style={{ top: chipPos.top, left: chipPos.left, position: 'fixed', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span><kbd>⌘⇧L</kbd> Clip to Notes</span>
          <button
            className="clip-bookmark-btn"
            onClick={() => {
              const text = window.getSelection()?.toString().trim()
              if (!text) return
              const slug = lesson?.meta?.slug || ''
              const section = getCurrentSection()
              fetch('/api/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, title: lesson?.meta?.title || '', section, content: text })
              }).catch(() => {})
              window.getSelection()?.removeAllRanges()
            }}
          >☆ Bookmark</button>
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
