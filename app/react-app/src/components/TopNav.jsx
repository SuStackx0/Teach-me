import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function TopNav() {
  const [streak, setStreak] = useState(null)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    fetch('/api/memory')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStreak(data.streak) })
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
      </div>

      <div className="topnav-spacer" />

      {streak !== null && streak > 0 && (
        <span className="streak-pill">🔥 {streak}</span>
      )}

      <button
        className="theme-toggle"
        onClick={() => setDark(d => !d)}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {dark ? '☀︎' : '◑'}
      </button>
    </nav>
  )
}
