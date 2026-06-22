import { useEffect, useRef, useState } from 'react'

let mermaidReady = false
let mermaidInitialized = false

async function ensureMermaid() {
  if (mermaidReady) return true
  if (mermaidInitialized) return false
  mermaidInitialized = true
  try {
    const m = await import('mermaid')
    m.default.initialize({ startOnLoad: false, theme: 'default', fontFamily: 'IBM Plex Mono, monospace' })
    mermaidReady = true
    return true
  } catch {
    return false
  }
}

export default function MermaidDiagram({ diagram }) {
  const ref = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!diagram) return
    const content = diagram.content || ''
    const type = diagram.type || 'ascii'
    if (type !== 'mermaid') return

    let cancelled = false
    ensureMermaid().then(async (ok) => {
      if (!ok || cancelled || !ref.current) { setFailed(true); return }
      try {
        const { default: mermaid } = await import('mermaid')
        const id = `mmd-${Math.random().toString(36).slice(2)}`
        const { svg } = await mermaid.render(id, content)
        if (!cancelled && ref.current) ref.current.innerHTML = svg
      } catch {
        if (!cancelled) setFailed(true)
      }
    })
    return () => { cancelled = true }
  }, [diagram])

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
