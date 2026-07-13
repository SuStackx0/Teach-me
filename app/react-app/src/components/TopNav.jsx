import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import WishlistPanel from './WishlistPanel.jsx'

export default function TopNav() {
  const [streak, setStreak] = useState(null)
  const [notesCount, setNotesCount] = useState(0)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef(null)
  const moreRef = useRef(null)
  const location = useLocation()

  useEffect(() => {
    fetch('/api/memory')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStreak(data.streak) })
      .catch(() => {})

    fetch('/api/notes')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNotesCount(data.total || 0) })
      .catch(() => {})

    fetch('/api/wishlist')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setWishlistCount((data.items || []).filter(i => !i.surfaced).length) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  useEffect(() => {
    if (!mobileMenuOpen && !moreOpen) return
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMobileMenuOpen(false)
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [mobileMenuOpen, moreOpen])

  // Close More dropdown when route changes
  useEffect(() => { setMoreOpen(false) }, [location.pathname])

  const primaryLinks = [
    { to: '/', label: 'Today', end: true },
    { to: '/library', label: 'Library' },
    { to: '/stats', label: 'Stats' },
    { to: '/review', label: 'Review' },
    { to: '/search', label: 'Search' },
  ]

  const moreLinks = [
    { to: '/notes', label: notesCount > 0 ? `Notes (${notesCount})` : 'Notes' },
    { to: '/map', label: 'Map' },
    { to: '/timeline', label: 'Timeline' },
    { to: '/bookmarks', label: 'Bookmarks' },
    { to: '/til', label: 'TIL' },
    { to: '/highlights', label: 'Highlights' },
    { to: '/glossary', label: 'Glossary' },
    { to: '/snippets', label: 'Snippets' },
    { to: '/collections', label: 'Collections' },
    { to: '/planner', label: 'Planner' },
    { to: '/flashcards', label: 'Flashcards' },
  ]

  const allLinks = [...primaryLinks, ...moreLinks]
  const moreActive = moreLinks.some(l => location.pathname === l.to)

  return (
    <nav className="topnav" ref={menuRef}>
      <span className="topnav-logo">teach-me</span>

      {/* Desktop nav links */}
      <div className="topnav-links">
        {primaryLinks.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>{label}</NavLink>
        ))}

        {/* More dropdown */}
        <div style={{ position: 'relative' }} ref={moreRef}>
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={'topnav-link' + (moreActive ? ' active' : '')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            More <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{moreOpen ? '▲' : '▼'}</span>
          </button>
          {moreOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '6px 4px', minWidth: 150,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 200,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2,
            }}>
              {moreLinks.map(({ to, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}
                  style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', padding: '5px 10px' }}>
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile hamburger */}
      <button className="topnav-hamburger" onClick={() => setMobileMenuOpen(o => !o)} title="Menu">
        {mobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Mobile dropdown — all links */}
      <div className={`topnav-mobile-menu${mobileMenuOpen ? ' open' : ''}`}>
        {allLinks.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')} onClick={() => setMobileMenuOpen(false)}>{label}</NavLink>
        ))}
      </div>

      <div className="topnav-spacer" />

      {streak !== null && streak > 0 && (
        <span className="streak-pill">🔥 {streak}</span>
      )}

      <button
        onClick={() => setWishlistOpen(o => !o)}
        title="Study Wishlist"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 9,
          border: `1px solid ${wishlistOpen ? 'var(--accent)' : 'var(--border)'}`,
          background: wishlistOpen ? 'var(--accent-dim)' : 'var(--surface-2)',
          color: wishlistOpen ? 'var(--accent-bright)' : 'var(--text-muted)',
          cursor: 'pointer', fontSize: '1rem',
          transition: 'border-color 0.13s, color 0.13s, background 0.13s',
        }}
      >
        ◈
        {wishlistCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 15, height: 15, borderRadius: 999,
            background: 'var(--accent)', color: 'var(--bg)',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.55rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', border: '1.5px solid var(--bg)',
          }}>{wishlistCount}</span>
        )}
      </button>

      <button
        className="theme-toggle"
        onClick={() => setDark(d => !d)}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {dark ? '☀︎' : '◑'}
      </button>

      <WishlistPanel
        open={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        onCountChange={setWishlistCount}
      />
    </nav>
  )
}
