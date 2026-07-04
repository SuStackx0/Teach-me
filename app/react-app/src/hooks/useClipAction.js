import { useEffect, useRef, useState } from 'react'

export function useClipAction({ mainRef, getCurrentSection, lessonTitle }) {
  const [chipPos, setChipPos] = useState(null)
  const chipTimerRef = useRef(null)
  const lastSelectionRef = useRef('')

  // Track selection in the main content area
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() || ''

      if (!text || !sel.rangeCount) {
        if (chipTimerRef.current) clearTimeout(chipTimerRef.current)
        setChipPos(null)
        lastSelectionRef.current = ''
        return
      }

      // Only show chip if selection is inside .main-content
      const range = sel.getRangeAt(0)
      const node = range.commonAncestorContainer
      const mainEl = mainRef?.current
      if (!mainEl || !mainEl.contains(node)) {
        setChipPos(null)
        return
      }

      lastSelectionRef.current = text

      // Position chip near the end of the selection
      const rect = range.getBoundingClientRect()
      setChipPos({
        top: rect.bottom + window.scrollY + 6,
        left: Math.min(rect.left + window.scrollX, window.innerWidth - 200),
      })
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [mainRef])

  // Cmd+Shift+L shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const modKey = isMac ? e.metaKey : e.ctrlKey
      if (!modKey || e.shiftKey || e.key !== 'l') return

      // If focus is in the notes textarea, don't intercept — just focus it
      const active = document.activeElement
      if (active?.classList.contains('notes-textarea')) return

      const sel = window.getSelection()
      const text = sel?.toString().trim() || ''

      if (text) {
        e.preventDefault()

        // Build attributed blockquote
        const section = getCurrentSection?.() || ''
        const attribution = [section, lessonTitle].filter(Boolean).join(' · ')
        const formatted = attribution
          ? `> "${text}"\n— ${attribution}`
          : `> "${text}"`

        // Fire ghost animation
        fireGhostAnimation(sel)

        // Dismiss chip
        setChipPos(null)
        lastSelectionRef.current = ''
        sel.removeAllRanges()

        // Dispatch clip event to NotesPanel
        window.dispatchEvent(new CustomEvent('noteClip', { detail: formatted }))
      } else {
        // No selection — just focus the notes textarea
        e.preventDefault()
        document.querySelector('.notes-textarea')?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [getCurrentSection, lessonTitle])

  // Hide chip on scroll or resize
  useEffect(() => {
    const hide = () => setChipPos(null)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  return { chipPos, lastSelectedText: lastSelectionRef }
}

function fireGhostAnimation(sel) {
  if (!sel?.rangeCount) return
  const range = sel.getRangeAt(0)
  const srcRect = range.getBoundingClientRect()

  // Find the notes panel to get its position
  const panel = document.querySelector('.notes-panel:not(.notes-panel--collapsed)')
  const destRect = panel ? panel.getBoundingClientRect() : null

  const ghost = document.createElement('div')
  ghost.className = 'clip-ghost'
  ghost.textContent = sel.toString().trim().slice(0, 60) + (sel.toString().length > 60 ? '…' : '')
  ghost.style.top = `${srcRect.top + window.scrollY}px`
  ghost.style.left = `${srcRect.left + window.scrollX}px`

  if (destRect) {
    const dx = destRect.left - srcRect.left
    const dy = destRect.top + 80 - srcRect.top
    ghost.style.setProperty('--clip-target', `translate(${dx}px, ${dy}px)`)
  }

  document.body.appendChild(ghost)
  setTimeout(() => ghost.remove(), 400)
}
