import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function TopNav() {
  const [streak, setStreak] = useState(null)

  useEffect(() => {
    fetch('/api/memory')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStreak(data.streak) })
      .catch(() => {})
  }, [])

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      padding: '0 1.5rem',
      height: '48px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <span style={{
        fontFamily: "'IBM Plex Sans Condensed', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: '1rem',
        letterSpacing: '0',
        color: 'var(--text-primary)',
      }}>teach-me</span>

      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <NavLink to="/" end style={navStyle}>Today</NavLink>
        <NavLink to="/library" style={navStyle}>Library</NavLink>
      </div>

      <div style={{ flex: 1 }} />

      {streak !== null && streak > 0 && (
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.8rem',
          color: 'var(--warning)',
        }}>🔥 {streak}</span>
      )}
    </nav>
  )
}

function navStyle({ isActive }) {
  return {
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    background: isActive ? 'rgba(42,107,79,0.10)' : 'transparent',
    textDecoration: 'none',
    transition: 'background 0.12s, color 0.12s',
  }
}
