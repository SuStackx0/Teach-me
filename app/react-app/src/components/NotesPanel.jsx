import { useState, useEffect, useRef, useCallback } from 'react'

const DEBOUNCE_MS = 700

function isCodeLike(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return false
  let score = 0
  for (const line of lines) {
    const t = line.trim()
    if (/^(def |class |import |from |const |let |var |function |return |if |for |async |await )/.test(t)) score += 2
    if (/[{};=()\[\]]/.test(t)) score++
    if (/^\s{2,}/.test(line)) score++
    if (/[a-z][A-Z]/.test(t) || /_[a-z]/.test(t)) score++
  }
  return score / lines.length > 1.2
}

function renderPreview(text) {
  const segments = []
  const fenceRe = /```[\w]*\n?([\s\S]*?)```/g
  let last = 0, m
  while ((m = fenceRe.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', content: text.slice(last, m.index) })
    segments.push({ type: 'code', content: m[1].trim() })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) })

  return segments.map((seg, i) => {
    if (seg.type === 'code') {
      return (
        <pre key={i} className="notes-preview-code">
          <code>{seg.content}</code>
        </pre>
      )
    }
    const lines = seg.content.split('\n')
    const elems = []
    let bqLines = []
    const flushBq = () => {
      if (!bqLines.length) return
      elems.push(
        <blockquote key={`bq${elems.length}`} className="notes-preview-quote">
          {bqLines.join('\n')}
        </blockquote>
      )
      bqLines = []
    }
    for (const line of lines) {
      if (line.startsWith('> ')) {
        bqLines.push(line.slice(2))
      } else {
        flushBq()
        if (line.trim()) elems.push(<p key={`p${elems.length}`} className="notes-preview-p">{line}</p>)
      }
    }
    flushBq()
    return <div key={i}>{elems}</div>
  })
}

export default function NotesPanel({ slug, currentSection, lessonTitle, collapsed, onToggleCollapse }) {
  const [note, setNote] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [tab, setTab] = useState('edit')
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef(null)
  const textareaRef = useRef(null)
  const pendingNoteRef = useRef('')

  // Load note for slug
  useEffect(() => {
    if (!slug) return
    setNote('')
    const cached = localStorage.getItem(`notes:${slug}`)
    if (cached !== null) {
      setNote(cached)
      pendingNoteRef.current = cached
    }
    fetch(`/api/notes/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.note !== undefined) {
          setNote(data.note)
          pendingNoteRef.current = data.note
          localStorage.setItem(`notes:${slug}`, data.note)
        }
      })
      .catch(() => {})
  }, [slug])

  const saveToServer = useCallback((text) => {
    if (!slug) return
    setSaveState('saving')
    fetch(`/api/notes/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: text }),
    })
      .then(r => r.ok ? setSaveState('saved') : setSaveState('dirty'))
      .catch(() => setSaveState('dirty'))
  }, [slug])

  const handleChange = useCallback((e) => {
    const val = e.target.value
    setNote(val)
    pendingNoteRef.current = val
    setSaveState('dirty')
    if (slug) localStorage.setItem(`notes:${slug}`, val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveToServer(val), DEBOUNCE_MS)
  }, [slug, saveToServer])

  // Save on blur
  const handleBlur = useCallback(() => {
    setFocused(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    saveToServer(pendingNoteRef.current)
  }, [saveToServer])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (pendingNoteRef.current && slug) saveToServer(pendingNoteRef.current)
    }
  }, [slug, saveToServer])

  // Listen for clip events
  useEffect(() => {
    const handler = (e) => {
      const clipped = e.detail
      if (!clipped) return

      const newNote = pendingNoteRef.current
        ? pendingNoteRef.current + '\n\n' + clipped
        : clipped

      setNote(newNote)
      pendingNoteRef.current = newNote
      setSaveState('dirty')
      if (slug) localStorage.setItem(`notes:${slug}`, newNote)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => saveToServer(newNote), DEBOUNCE_MS)

      // Scroll textarea to bottom + flash
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight
          textareaRef.current.classList.add('clip-landed')
          setTimeout(() => textareaRef.current?.classList.remove('clip-landed'), 900)
        }
      }, 50)

      // Switch to edit tab to show the clip
      setTab('edit')
    }
    window.addEventListener('noteClip', handler)
    return () => window.removeEventListener('noteClip', handler)
  }, [slug, saveToServer])

  // Auto-fence code on paste
  const handlePaste = useCallback((e) => {
    const pasted = e.clipboardData?.getData('text') || ''
    if (pasted && isCodeLike(pasted)) {
      e.preventDefault()
      const fenced = `\`\`\`\n${pasted.trim()}\n\`\`\``
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const val = ta.value.slice(0, start) + fenced + ta.value.slice(end)
      handleChange({ target: { value: val } })
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + fenced.length
      }, 0)
    }
  }, [handleChange])

  const wordCount = note.trim() ? note.trim().split(/\s+/).length : 0
  const hasNotes = note.trim().length > 0

  if (collapsed) {
    return (
      <div
        className="notes-panel notes-panel--collapsed"
        onClick={onToggleCollapse}
        title="Open notes"
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggleCollapse()}
      >
        <div className="notes-rail-vertical">
          📝 Notes {hasNotes && <span className="notes-rail-dot" />}
        </div>
      </div>
    )
  }

  return (
    <div className={`notes-panel${focused ? ' notes-panel--focused' : ''}`}>
      <div className="notes-header">
        <span className="notes-label">📝 Notes</span>
        {wordCount > 0 && <span className="notes-wordcount">{wordCount}w</span>}
        <span className={`notes-save-dot notes-save-dot--${saveState}`} title={saveState} />
        <button className="notes-collapse-btn" onClick={onToggleCollapse} title="Collapse">⟩</button>
      </div>

      <div className="notes-tabs">
        <button
          className={`notes-tab${tab === 'edit' ? ' notes-tab--active' : ''}`}
          onClick={() => setTab('edit')}
        >Edit</button>
        <button
          className={`notes-tab${tab === 'preview' ? ' notes-tab--active' : ''}`}
          onClick={() => setTab('preview')}
        >Preview</button>
      </div>

      <div className="notes-body">
        {tab === 'edit' ? (
          <textarea
            ref={textareaRef}
            className="notes-textarea"
            value={note}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            onPaste={handlePaste}
            placeholder={'Type, paste, or select text and press ⌘L to clip…'}
            spellCheck={false}
          />
        ) : (
          <div className="notes-preview">
            {note.trim()
              ? renderPreview(note)
              : <span className="notes-empty-preview">No notes yet.</span>
            }
          </div>
        )}
      </div>

      <div className="notes-footer">
        <span className="notes-hint">
          <kbd>⌘L</kbd> clip selection &nbsp;·&nbsp; <kbd>```</kbd> code block
        </span>
      </div>
    </div>
  )
}
