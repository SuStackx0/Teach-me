import { useState, useEffect, useRef, useCallback } from 'react'

function buildSections(lesson) {
  const s = ['hook', 'concept_map']
  const concepts = lesson.core_concepts || []
  concepts.forEach((_, i) => s.push(`concept:${i}`))
  s.push('scenario', 'insights', 'quiz', 'challenge', 'summary', 'complete')
  return s
}

export function sectionLabel(section, lesson) {
  if (section === 'hook') return 'Hook'
  if (section === 'concept_map') return 'Concept Map'
  if (section.startsWith('concept:')) {
    const idx = parseInt(section.split(':')[1])
    const c = (lesson.core_concepts || [])[idx]
    return c ? c.title : `Concept ${idx + 1}`
  }
  const map = { scenario: 'Scenario', insights: 'Key Insights', quiz: 'Quiz', challenge: 'Coding Challenge', summary: 'Summary', complete: 'Complete' }
  return map[section] || section
}

export function useLessonSession(url) {
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sections, setSections] = useState([])
  const [sectionIdx, setSectionIdx] = useState(0)
  const [visited, setVisited] = useState(new Set())
  const [startTime] = useState(Date.now())
  const [quizScore, setQuizScore] = useState(0)
  const [mqScores, setMqScores] = useState({})
  const pollRef = useRef(null)
  const retryRef = useRef(null)
  const prevUrlRef = useRef(url)

  useEffect(() => {
    if (prevUrlRef.current === url) return
    prevUrlRef.current = url
    clearTimeout(retryRef.current)
    clearInterval(pollRef.current)
    setLesson(null)
    setLoading(true)
    setError(null)
    setSections([])
    setSectionIdx(0)
    setVisited(new Set())
    setQuizScore(0)
    setMqScores({})
  }, [url])

  const fetchLesson = useCallback(async (attempt = 0) => {
    const MAX = 12
    try {
      const res = await fetch(url)
      if (!res.ok) {
        if (attempt < MAX) {
          retryRef.current = setTimeout(() => fetchLesson(attempt + 1), 1200)
          return
        }
        setError('Lesson not found. Run /teach in Claude Code then refresh.')
        setLoading(false)
        return
      }
      const data = await res.json()
      setLesson(data)
      setLoading(false)
      const built = buildSections(data)
      setSections(prev => prev.length < built.length ? built : prev.length ? prev : built)
    } catch {
      if (attempt < MAX) {
        retryRef.current = setTimeout(() => fetchLesson(attempt + 1), 1200)
        return
      }
      setError('Cannot reach server. Is uvicorn running on port 8001?')
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    fetchLesson()
    return () => clearTimeout(retryRef.current)
  }, [fetchLesson])

  useEffect(() => {
    if (!lesson) return
    if (lesson._generation_status === 'complete') {
      clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(async () => {
      const res = await fetch(url).catch(() => null)
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
  }, [lesson?._generation_status, url])

  const goTo = (idx) => {
    setVisited(v => new Set([...v, sectionIdx]))
    setSectionIdx(idx)
  }
  const goNext = () => goTo(Math.min(sectionIdx + 1, sections.length - 1))
  const goPrev = () => goTo(Math.max(sectionIdx - 1, 0))

  return {
    lesson, loading, error,
    sections, sectionIdx,
    visited, setVisited,
    startTime,
    quizScore, setQuizScore,
    mqScores, setMqScores,
    goTo, goNext, goPrev,
    canGoNext: sectionIdx < sections.length - 1,
    canGoPrev: sectionIdx > 0,
  }
}
