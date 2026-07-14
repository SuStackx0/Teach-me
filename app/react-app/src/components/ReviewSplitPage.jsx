import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLessonSession, sectionLabel } from '../hooks/useLessonSession.js'
import Hook from './sections/Hook.jsx'
import ConceptMap from './sections/ConceptMap.jsx'
import CoreConcept from './sections/CoreConcept.jsx'
import Insights from './sections/Insights.jsx'
import Quiz from './sections/Quiz.jsx'
import Challenge from './sections/Challenge.jsx'
import Summary from './sections/Summary.jsx'
import Scenario from './sections/Scenario.jsx'

// ── Recall card (left panel) ─────────────────────────────────────
function RecallCard({ q, a, hint, idx }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.6rem' }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 7px', borderRadius: 4 }}>Q{idx + 1}</span>
          {hint && <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{hint}</span>}
        </div>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.6 }}>{q}</p>
      </div>
      {!revealed ? (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0.6rem 1.25rem' }}>
          <button
            aria-expanded={false}
            onClick={() => setRevealed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono, monospace', padding: 0 }}
            onMouseEnter={e => e.target.style.color = 'var(--accent)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
          >reveal answer ▾</button>
        </div>
      ) : (
        <div aria-live="polite" style={{ borderTop: '1px solid var(--border)', padding: '0.875rem 1.25rem', background: 'var(--accent-dim)' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.6 }}>{a}</p>
        </div>
      )}
    </div>
  )
}

// ── Right panel: lesson viewer ───────────────────────────────────
function LessonViewPanel({ slug, navigate }) {
  const {
    lesson, loading, error, sections, sectionIdx,
    quizScore, setQuizScore, mqScores, setMqScores,
    goNext, goPrev, canGoPrev, canGoNext,
  } = useLessonSession(`/api/lesson/${slug}`)

  const lessonBodyRef = useRef(null)
  useEffect(() => {
    if (lessonBodyRef.current) lessonBodyRef.current.scrollTop = 0
  }, [sectionIdx])

  const current = sections[sectionIdx]
  const sharedProps = { lesson, goNext, goPrev, canGoPrev, canGoNext }
  const currentLabel = lesson && current ? sectionLabel(current, lesson) : ''
  const visibleSections = sections.filter(s => s !== 'complete')

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
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 12 }}>
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
    <div className="lesson-panel">
      <div className="lesson-panel-header">
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {currentLabel}
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {sectionIdx + 1} / {visibleSections.length}
        </span>
        <div style={{ flex: 1 }} />
        <a
          href={`/api/export/${slug}?fmt=md`}
          target="_blank"
          rel="noreferrer"
          style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '3px 10px', borderRadius: 5, textDecoration: 'none' }}
          aria-label="Export lesson as Markdown"
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >↓ md</a>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['←', goPrev, !canGoPrev, 'Previous section'], ['→', goNext, !canGoNext, 'Next section']].map(([label, fn, disabled, ariaLabel]) => (
            <button
              key={label}
              onClick={fn}
              disabled={disabled}
              aria-label={ariaLabel}
              aria-disabled={disabled}
              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >{label}</button>
          ))}
        </div>
      </div>

      <div className="lesson-panel-body" ref={lessonBodyRef}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            Loading lesson...
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 16, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 360, margin: 0 }}>{error}</p>
            <button onClick={() => navigate('/library')}>&larr; Back to Library</button>
          </div>
        )}
        {!loading && !error && lesson && (
          <div className="section-fade" key={sectionIdx}>
            {renderSection()}
          </div>
        )}
      </div>
    </div>
  )
}

const RATINGS = [
  { value: 3, label: 'Knew it',    sub: 'Confident recall',     days: '+28 days', color: 'var(--success)' },
  { value: 2, label: 'Fuzzy',      sub: 'Got it with effort',   days: '+14 days', color: 'var(--warning)' },
  { value: 1, label: 'Struggled',  sub: 'Need more practice',   days: '+7 days',  color: 'var(--error)'   },
]

// ── Main split-screen page ───────────────────────────────────────
export default function ReviewSplitPage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [reviewData, setReviewData] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(true)
  const [reviewError, setReviewError] = useState(null)

  const [doneState, setDoneState] = useState('idle') // idle | rating | submitting | done
  const [nextReviewDate, setNextReviewDate] = useState(null)
  const [daysUntil, setDaysUntil] = useState(null)

  function submitRating(r) {
    setDoneState('submitting')
    fetch('/api/review/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, rating: r }),
    })
      .then(res => res.json())
      .then(d => { setNextReviewDate(d.next_review_date); setDaysUntil(d.days_until); setDoneState('done') })
      .catch(() => setDoneState('rating'))
  }

  useEffect(() => {
    fetch(`/api/review/content/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setReviewData(d); setReviewLoading(false) })
      .catch(e => { setReviewError(e === 404 ? 'not_generated' : 'error'); setReviewLoading(false) })
  }, [slug])

  const { recall_questions = [], key_reminders = [] } = reviewData || {}
  const title = reviewData?.title || reviewData?.lesson_title || slug.replace(/-/g, ' ')
  const questionCount = recall_questions.length

  return (
    <div className="review-split-shell">

      {/* ── Left panel: revision content ── */}
      <div className="review-panel">
        <div className="review-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <button
              onClick={() => navigate('/review')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'IBM Plex Mono, monospace', padding: 0 }}
              onMouseEnter={e => e.target.style.color = 'var(--accent)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
            >← Review Queue</button>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: 4 }}>REVIEW</span>
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
            {questionCount} recall questions · click to reveal
          </div>
        </div>

        <div className="review-panel-body">
          {reviewLoading && (
            <>
              <div className="shimmer" style={{ height: 80 }} />
              <div className="shimmer" style={{ height: 96 }} />
              <div className="shimmer" style={{ height: 80 }} />
            </>
          )}

          {!reviewLoading && reviewError && (
            reviewError === 'not_generated' ? (
              <div style={{ maxWidth: 380, padding: '8px 0' }}>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 8px', fontSize: '0.875rem' }}>Revision content hasn't been generated for this lesson yet.</p>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>Generated automatically when you say <code style={{ fontFamily: 'IBM Plex Mono, monospace', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4 }}>"done"</code> at end of a session.</p>
              </div>
            ) : (
              <p style={{ color: 'var(--error)', fontSize: '0.875rem' }}>Could not load revision content.</p>
            )
          )}

          {!reviewLoading && !reviewError && (
            <>
              {recall_questions.map((item, i) => (
                <RecallCard
                  key={i}
                  idx={i}
                  q={item.q || item.question || item}
                  a={item.a || item.answer || ''}
                  hint={item.hint || item.topic || null}
                />
              ))}

              {key_reminders.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>Key Reminders</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {key_reminders.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <span style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem', marginTop: 3, flexShrink: 0 }}>◆</span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Done Review section ── */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                {doneState === 'idle' && (
                  <button
                    onClick={() => setDoneState('rating')}
                    style={{ width: '100%', padding: '10px 0', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
                  >Done Review</button>
                )}

                {(doneState === 'rating' || doneState === 'submitting') && (
                  <div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10 }}>How well did you know this?</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {RATINGS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => submitRating(opt.value)}
                          disabled={doneState === 'submitting'}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', background: 'var(--surface)',
                            border: `1px solid var(--border)`, borderRadius: 8,
                            cursor: doneState === 'submitting' ? 'not-allowed' : 'pointer',
                            opacity: doneState === 'submitting' ? 0.6 : 1,
                            transition: 'border-color 0.12s, background 0.12s',
                          }}
                          onMouseEnter={e => { if (doneState !== 'submitting') { e.currentTarget.style.borderColor = opt.color; e.currentTarget.style.background = 'var(--surface-2)' }}}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
                        >
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{opt.sub}</div>
                          </div>
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem', color: opt.color, fontWeight: 700 }}>{opt.days}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setDoneState('idle')}
                      style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono, monospace', padding: 0 }}
                    >cancel</button>
                  </div>
                )}

                {doneState === 'done' && (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>✓</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Review logged</div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                      Next review: {nextReviewDate} · {daysUntil} days
                    </div>
                    <button onClick={() => navigate('/review')} style={{ fontSize: '0.8rem' }}>← Back to Review Queue</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel-divider" />

      {/* ── Right panel: lesson viewer ── */}
      <LessonViewPanel slug={slug} navigate={navigate} />
    </div>
  )
}
