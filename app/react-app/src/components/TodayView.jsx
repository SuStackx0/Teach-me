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
import CompletionAnimation from './CompletionAnimation.jsx'

export default function TodayView() {
  const [notesCollapsed, setNotesCollapsed] = useState(
    () => localStorage.getItem('notes-panel-collapsed') === 'true'
  )
  const [focusMode, setFocusMode] = useState(
    () => localStorage.getItem('focus-mode') === 'true'
  )
  const [bookmarkFlash, setBookmarkFlash] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [sectionProgress, setSectionProgress] = useState({})
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

  // Load section progress once lesson is available
  useEffect(() => {
    if (!lesson?.meta?.slug) return
    fetch(`/api/progress/${lesson.meta.slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSectionProgress(d.progress || {}) })
      .catch(() => {})
  }, [lesson?.meta?.slug])

  // Mark current section as visited whenever it changes
  useEffect(() => {
    if (!lesson?.meta?.slug || !sections[sectionIdx]) return
    const section = sectionLabel(sections[sectionIdx], lesson)
    if (!section) return
    fetch(`/api/progress/${lesson.meta.slug}/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section }),
    }).catch(() => {})
    setSectionProgress(prev => ({
      ...prev,
      [section]: { ...prev[section], visited_at: new Date().toISOString() },
    }))
  }, [lesson?.meta?.slug, sectionIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSectionCheck = useCallback((section, checked) => {
    if (!lesson?.meta?.slug) return
    fetch(`/api/progress/${lesson.meta.slug}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, checked }),
    }).catch(() => {})
    setSectionProgress(prev => ({
      ...prev,
      [section]: { ...prev[section], checked },
    }))
  }, [lesson?.meta?.slug])

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

  // Section checklist summary
  const sectionLabels = sections.map(s => sectionLabel(s, lesson)).filter(Boolean)
  const checkedCount = sectionLabels.filter(s => sectionProgress[s]?.checked).length
  const visitedCount = sectionLabels.filter(s => sectionProgress[s]?.visited_at).length

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
    if (current === 'summary') return <Summary {...sharedProps} goNext={() => { setCompleting(true); goNext() }} />
    if (current === 'complete') return <Complete {...sharedProps} quizScore={quizScore} startTime={startTime} />
    return null
  }

  const shellClass = `app-shell with-notes${notesCollapsed ? ' notes-collapsed' : ''}${focusMode ? ' focus-mode' : ''}`

  return (
    <div className={shellClass}>
      {completing && (
        <CompletionAnimation
          lessonTitle={lesson?.meta?.title || ''}
          onDone={() => setCompleting(false)}
        />
      )}
      <div className="progress-bar-slot">
        <ProgressBar pct={pct} />
        {!focusMode && sectionLabels.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0 1rem',
            marginTop: '0.25rem',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            <span>{visitedCount}/{sectionLabels.length} visited</span>
            {checkedCount > 0 && (
              <span style={{ color: 'var(--success)' }}>· {checkedCount} checked off</span>
            )}
          </div>
        )}
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
          sectionProgress={sectionProgress}
          onSectionCheck={handleSectionCheck}
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
          <span><kbd>⌘L</kbd> Clip to Notes</span>
          <button
            className="clip-bookmark-btn"
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              const text = lastSelectedText.current || window.getSelection()?.toString().trim()
              if (!text) return
              const slug = lesson?.meta?.slug || ''
              const section = getCurrentSection()
              fetch('/api/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, title: lesson?.meta?.title || '', section, content: text })
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
