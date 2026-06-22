import { useNavigate } from 'react-router-dom'

export default function LessonCard({ lesson }) {
  const navigate = useNavigate()

  function scoreClass(pct) {
    if (pct === null || pct === undefined) return 'none'
    if (pct >= 0.8) return 'good'
    if (pct >= 0.6) return 'ok'
    return 'bad'
  }

  function scoreText(pct) {
    if (pct === null || pct === undefined) return '—'
    return `${Math.round(pct * 100)}%`
  }

  function formatDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const diffColor = {
    intermediate: 'var(--accent)',
    advanced: 'var(--warning)',
    expert: 'var(--error)',
  }[lesson.difficulty] || 'var(--text-muted)'

  if (!lesson.archived) {
    return (
      <div className="lesson-card" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
        <div className="lesson-card-title">{lesson.title}</div>
        <div className="lesson-card-meta">
          <span style={{ color: 'var(--error)' }}>Archive file missing</span>
        </div>
      </div>
    )
  }

  return (
    <div className="lesson-card" onClick={() => navigate(`/lesson/${lesson.slug}`)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/lesson/${lesson.slug}`)}>
      <div className="lesson-card-title">{lesson.title}</div>
      <div className="lesson-card-meta">
        <span>{formatDate(lesson.date)}</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span className={`lesson-card-score ${scoreClass(lesson.quiz_score_pct)}`}>
          {scoreText(lesson.quiz_score_pct)}
        </span>
        {lesson.difficulty && (
          <>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{ color: diffColor }}>{lesson.difficulty}</span>
          </>
        )}
        {lesson.time_spent_minutes > 0 && (
          <>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{Math.round(lesson.time_spent_minutes)}m</span>
          </>
        )}
      </div>
    </div>
  )
}
