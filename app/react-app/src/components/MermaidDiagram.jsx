import { useEffect, useRef, useState } from 'react'

function isDark() {
  return document.documentElement.classList.contains('dark')
}

async function renderDiagram(content, dark) {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'default',
    fontFamily: 'IBM Plex Mono, monospace',
  })
  const id = `mmd-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const { svg } = await mermaid.render(id, content)
  return svg
}

export default function MermaidDiagram({ diagram }) {
  const ref = useRef(null)
  const [failed, setFailed] = useState(false)
  const [dark, setDark] = useState(isDark)

  // Watch for dark-mode class toggled on <html>
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!diagram) return
    const content = diagram.content || ''
    const type = diagram.type || 'ascii'
    if (type !== 'mermaid') return

    let cancelled = false
    renderDiagram(content, dark).then((svg) => {
      if (!cancelled && ref.current) ref.current.innerHTML = svg
    }).catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => { cancelled = true }
  }, [diagram, dark])

  if (!diagram) return null
  const { type, content } = diagram

  if (type !== 'mermaid' || failed) {
    return (
      <div className="diagram-wrap">
        <pre style={{ margin: 0 }}>{content}</pre>
      </div>
    )
  }

  return (
    <div className="diagram-wrap">
      <div ref={ref} style={{ color: 'var(--text-primary)' }} />
    </div>
  )
}
