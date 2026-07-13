import { useState } from 'react'

/**
 * 5-star confidence self-rating widget.
 * Props:
 *   slug           — lesson slug (used for the API call)
 *   initialRating  — pre-existing rating (1-5) or null
 *   onChange       — optional callback(newRating)
 */
export default function SelfRatingWidget({ slug, initialRating = null, onChange }) {
  const [rating, setRating] = useState(initialRating)
  const [hover, setHover] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!initialRating)

  async function handleRate(val) {
    if (saving) return
    setSaving(true)
    try {
      await fetch(`/api/rating/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: val }),
      })
      setRating(val)
      setSaved(true)
      onChange?.(val)
    } catch {
      // silently fail — non-critical
    }
    setSaving(false)
  }

  const displayRating = hover ?? rating ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-muted)',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        Confidence
      </div>
      <div
        style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHover(star)}
            disabled={saving}
            title={`Rate ${star} out of 5`}
            style={{
              background: 'none',
              border: 'none',
              cursor: saving ? 'wait' : 'pointer',
              padding: '2px 3px',
              fontSize: '1.35rem',
              lineHeight: 1,
              color: star <= displayRating ? 'var(--accent)' : 'var(--border)',
              transition: 'color 0.1s',
            }}
          >
            {star <= displayRating ? '★' : '☆'}
          </button>
        ))}
        {saved && rating && (
          <span style={{
            marginLeft: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            {rating}/5
          </span>
        )}
      </div>
    </div>
  )
}
