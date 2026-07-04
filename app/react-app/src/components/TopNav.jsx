import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import WishlistPanel from './WishlistPanel.jsx'

export default function TopNav() {
  const [streak, setStreak] = useState(null)
  const [notesCount, setNotesCount] = useState(0)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)

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

  return (
    <nav className="topnav">
      <span className="topnav-logo">teach-me</span>

      <div className="topnav-links">
        <NavLink to="/" end className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>Today</NavLink>
        <NavLink to="/library" className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>Library</NavLink>
        <NavLink to="/stats" className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>Stats</NavLink>
        <NavLink to="/notes" className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>
          Notes
          {notesCount > 0 && <span className="notes-nav-badge">{notesCount}</span>}
        </NavLink>
        <NavLink to="/map" className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>Map</NavLink>
        <NavLink to="/timeline" className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>Timeline</NavLink>
        <NavLink to="/search" className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>Search</NavLink>
        <NavLink to="/bookmarks" className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>Bookmarks</NavLink>
        <NavLink to="/til" className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')}>TIL</NavLink>
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
