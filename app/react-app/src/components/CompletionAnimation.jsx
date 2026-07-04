import { useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// CompletionAnimation — full-screen "lesson complete" overlay.
//
// Timeline (total 1800ms):
//    0ms  overlay fades in (300ms, ease-out)
//  200ms  "LESSON COMPLETE" label blurs in (400ms)
//  400ms  lesson title fades up (500ms)
//  500ms  ring starts tracing clockwise (400ms, easeInOutCubic)
//  900ms  ring lands → micro scale-pop on the ring + checkmark draws in (200ms)
// 1400ms  overlay fades out (400ms, ease-in)
// 1800ms  onDone() fires, overlay unmounts
//
// Usage: <CompletionAnimation lessonTitle="..." onDone={() => ...} />
// ─────────────────────────────────────────────────────────────────────────────

const RING_SIZE = 120
const RING_R = 54                                  // 120px box, 3px stroke, breathing room
const RING_C = 2 * Math.PI * RING_R                // ≈ 339.292
const CHECK_PATH = 'M42 62 L55 75 L80 48'
const CHECK_LEN = 61                               // path length, slight over-measure is fine

const KEYFRAMES = `
@keyframes ca-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ca-overlay-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes ca-label-in {
  from { opacity: 0; filter: blur(4px); transform: translateY(4px); }
  to   { opacity: 1; filter: blur(0);   transform: translateY(0); }
}
@keyframes ca-title-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ca-ring-trace {
  from { stroke-dashoffset: ${RING_C.toFixed(3)}; }
  to   { stroke-dashoffset: 0; }
}
@keyframes ca-ring-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.035); }
  100% { transform: scale(1); }
}
@keyframes ca-check-in {
  from { stroke-dashoffset: ${CHECK_LEN}; opacity: 0; transform: rotate(90deg) scale(0.85); }
  to   { stroke-dashoffset: 0;            opacity: 1; transform: rotate(90deg) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .ca-overlay, .ca-overlay * { animation-duration: 0.01ms !important; animation-delay: 0.01ms !important; }
}
`

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.75rem',
    background: 'var(--bg)',
    // fade in 300ms, hold, fade out 400ms starting at 1400ms
    opacity: 0.97,
    animation: [
      'ca-overlay-in 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
      'ca-overlay-out 400ms cubic-bezier(0.55, 0.06, 0.68, 0.19) 1400ms forwards',
    ].join(', '),
    pointerEvents: 'all',
    cursor: 'default',
  },
  label: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.65rem',
    fontWeight: 500,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    // 200ms offset, blur-in
    opacity: 0,
    animation: 'ca-label-in 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 200ms forwards',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    // micro-pop fires exactly as the trace lands (900ms)
    animation: 'ca-ring-pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1) 900ms both',
  },
  svg: {
    display: 'block',
    width: '100%',
    height: '100%',
    // circle path starts at 3 o'clock; rotate so trace begins at 12 o'clock
    transform: 'rotate(-90deg)',
    overflow: 'visible',
  },
  track: {
    fill: 'none',
    stroke: 'var(--accent)',
    strokeWidth: 3,
    opacity: 0.12,
  },
  ring: {
    fill: 'none',
    stroke: 'var(--accent)',
    strokeWidth: 3,
    strokeLinecap: 'round',
    strokeDasharray: RING_C.toFixed(3),
    strokeDashoffset: RING_C.toFixed(3),
    // 500ms delay, 400ms trace → lands at 900ms. easeInOutCubic: slow start, decisive finish.
    animation: 'ca-ring-trace 400ms cubic-bezier(0.65, 0, 0.35, 1) 500ms forwards',
  },
  check: {
    fill: 'none',
    stroke: 'var(--accent-bright)',
    strokeWidth: 4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeDasharray: CHECK_LEN,
    strokeDashoffset: CHECK_LEN,
    opacity: 0,
    transformOrigin: '60px 60px',
    // counter-rotate the parent svg's -90deg so the check sits upright
    transform: 'rotate(90deg)',
    transformBox: 'view-box',
    // draws + scales in over 200ms with a soft overshoot, right as the ring lands
    animation: 'ca-check-in 200ms cubic-bezier(0.34, 1.4, 0.64, 1) 880ms forwards',
  },
  title: {
    fontFamily: "'Inter', sans-serif",
    fontSize: '1.1rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textAlign: 'center',
    maxWidth: '28rem',
    padding: '0 1.5rem',
    lineHeight: 1.4,
    // 400ms offset
    opacity: 0,
    animation: 'ca-title-in 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 400ms forwards',
  },
}

export default function CompletionAnimation({ lessonTitle, onDone }) {
  useEffect(() => {
    // inject keyframes once
    let styleEl = document.getElementById('ca-keyframes')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'ca-keyframes'
      styleEl.textContent = KEYFRAMES
      document.head.appendChild(styleEl)
    }
    const t = setTimeout(() => onDone?.(), 1800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="ca-overlay" style={styles.overlay} role="status" aria-live="polite">
      <div style={styles.label}>Lesson Complete</div>

      <div style={styles.ringWrap}>
        <svg style={styles.svg} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
          {/* background track */}
          <circle cx="60" cy="60" r={RING_R} style={styles.track} />
          {/* tracing ring */}
          <circle cx="60" cy="60" r={RING_R} style={styles.ring} />
          {/* checkmark — drawn upright via counter-rotation */}
          <path d={CHECK_PATH} style={styles.check} />
        </svg>
      </div>

      <div style={styles.title}>{lessonTitle}</div>
    </div>
  )
}
