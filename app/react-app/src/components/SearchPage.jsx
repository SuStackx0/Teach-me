import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const DEBOUNCE_MS = 350

function Spinner() {
  return (
    <div
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
        verticalAlign: 'middle',
        marginRight: '0.5rem',
      }}
    />
  )
}

function DomainBadge({ domain }) {
  return (
    <span
      style={{
        fontSize: '0.7rem',
        padding: '2px 6px',
        background: 'var(--surface-2)',
        borderRadius: 4,
        color: 'var(--text-muted)',
        fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
        whiteSpace: 'nowrap',
      }}
    >
      {domain}
    </span>
  )
}

function LessonCard({ result, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        background: hovered ? 'var(--accent-dim)' : 'var(--surface)',
        padding: '1rem',
        borderRadius: 8,
        margin: '0 0 0.5rem 0',
        transition: 'border-color 0.15s ease, background 0.15s ease',
        boxShadow: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
            flex: 1,
            minWidth: 0,
          }}
        >
          {result.title}
        </span>
        {result.domain && <DomainBadge domain={result.domain} />}
        {result.date && (
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: "'Inter', sans-serif",
              whiteSpace: 'nowrap',
              marginLeft: 'auto',
            }}
          >
            {result.date}
          </span>
        )}
      </div>
      {result.excerpt && (
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            marginTop: '0.25rem',
            fontFamily: "'IBM Plex Serif', Georgia, serif",
            lineHeight: 1.6,
          }}
        >
          {result.excerpt}
        </p>
      )}
    </div>
  )
}

function NoteCard({ result }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'default',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        background: hovered ? 'var(--accent-dim)' : 'var(--surface)',
        padding: '1rem',
        borderRadius: 8,
        margin: '0 0 0.5rem 0',
        transition: 'border-color 0.15s ease, background 0.15s ease',
        boxShadow: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
            flex: 1,
            minWidth: 0,
          }}
        >
          {result.title}
        </span>
        {result.date && (
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: "'Inter', sans-serif",
              whiteSpace: 'nowrap',
              marginLeft: 'auto',
            }}
          >
            {result.date}
          </span>
        )}
      </div>
      {result.excerpt && (
        <blockquote
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            marginTop: '0.4rem',
            fontFamily: "'IBM Plex Serif', Georgia, serif",
            lineHeight: 1.65,
            paddingLeft: '0.75rem',
            borderLeft: '2px solid var(--border)',
          }}
        >
          {result.excerpt}
        </blockquote>
      )}
    </div>
  )
}

function SectionHeader({ label }) {
  return (
    <div
      style={{
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-muted)',
        marginBottom: '0.5rem',
        marginTop: '1.5rem',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  )
}

export default function SearchPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Autofocus on mount
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery) {
      setResults(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => {
        if (!r.ok) throw new Error(`Search failed (${r.status})`)
        return r.json()
      })
      .then(data => {
        if (!cancelled) {
          setResults(data.results ?? [])
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Search failed')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [debouncedQuery])

  const lessons = results ? results.filter(r => r.type === 'lesson') : []
  const notes   = results ? results.filter(r => r.type === 'note')   : []
  const total   = results ? results.length : 0

  return (
    <div className="library-page">
      <div className="library-header">
        <h1>Search</h1>
        <p>Search across all lessons and notes</p>
      </div>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: '0.25rem' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search lessons and notes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            fontSize: '1rem',
            fontFamily: "'Inter', sans-serif",
            outline: 'none',
            transition: 'outline 0.1s ease',
          }}
          onFocus={e => { e.target.style.outline = '2px solid var(--accent)'; e.target.style.outlineOffset = '2px' }}
          onBlur={e => { e.target.style.outline = 'none' }}
        />
        {loading && (
          <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
            <Spinner />
          </div>
        )}
      </div>

      {/* Empty / prompt state */}
      {!query && (
        <p
          style={{
            marginTop: '2.5rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Type to search lessons and notes
        </p>
      )}

      {/* Error state */}
      {error && (
        <p
          style={{
            marginTop: '1.5rem',
            color: 'var(--error)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.9rem',
          }}
        >
          {error}
        </p>
      )}

      {/* No results state */}
      {results !== null && total === 0 && !loading && !error && (
        <p
          style={{
            marginTop: '2rem',
            color: 'var(--text-muted)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.9rem',
            textAlign: 'center',
          }}
        >
          No results found for &ldquo;{debouncedQuery}&rdquo;
        </p>
      )}

      {/* Results */}
      {results !== null && total > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          {lessons.length > 0 && (
            <section>
              <SectionHeader label={`Lessons (${lessons.length})`} />
              {lessons.map(result => (
                <LessonCard
                  key={result.slug}
                  result={result}
                  onClick={() => navigate(`/lesson/${result.slug}`)}
                />
              ))}
            </section>
          )}

          {notes.length > 0 && (
            <section>
              <SectionHeader label={`Notes (${notes.length})`} />
              {notes.map((result, idx) => (
                <NoteCard key={result.slug || idx} result={result} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
