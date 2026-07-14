// Parses text into alternating text/code-block segments before any other processing.
// This prevents fenced code blocks from being split by the paragraph splitter.
function parseSegments(text) {
  const segments = []
  const fence = /```(\w*)\n([\s\S]*?)```/g
  let last = 0, m
  while ((m = fence.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', content: text.slice(last, m.index) })
    segments.push({ type: 'code', lang: m[1] || 'text', content: m[2].replace(/\n$/, '') })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) })
  return segments
}

function renderInline(text) {
  const parts = []
  // Order matters: bold-italic before bold before italic
  const re = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g
  let last = 0, key = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const raw = m[0]
    if (raw.startsWith('***')) {
      parts.push(<strong key={key++}><em>{raw.slice(3, -3)}</em></strong>)
    } else if (raw.startsWith('**')) {
      parts.push(<strong key={key++}>{raw.slice(2, -2)}</strong>)
    } else if (raw.startsWith('*') || raw.startsWith('_')) {
      parts.push(<em key={key++}>{raw.slice(1, -1)}</em>)
    } else {
      parts.push(<code key={key++} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.88em', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)' }}>{raw.slice(1, -1)}</code>)
    }
    last = m.index + raw.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderBlock(block, key) {
  const trimmed = block.trim()
  if (!trimmed) return null

  // ATX headers: # ## ###
  const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/)
  if (headingMatch) {
    const level = headingMatch[1].length
    const sizes = { 1: '1.1rem', 2: '1rem', 3: '0.95rem' }
    return <div key={key} style={{ fontWeight: 700, fontSize: sizes[level], color: 'var(--text-primary)', marginTop: '1.1rem', marginBottom: '0.25rem' }}>{renderInline(headingMatch[2])}</div>
  }

  // Horizontal rule
  if (/^[-*_]{3,}$/.test(trimmed)) {
    return <hr key={key} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
  }

  // Blockquote
  if (trimmed.startsWith('> ')) {
    const inner = trimmed.replace(/^>\s*/gm, '')
    return (
      <blockquote key={key} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '1rem', margin: '0.5rem 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {renderInline(inner)}
      </blockquote>
    )
  }

  const lines = trimmed.split('\n')
  const elements = []
  let list = null

  const flushList = () => {
    if (!list) return
    const Tag = list.type
    elements.push(
      <Tag key={`l${elements.length}`} style={{ margin: '0.4rem 0', paddingLeft: '1.4rem', lineHeight: 1.75 }}>
        {list.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
      </Tag>
    )
    list = null
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) { flushList(); continue }

    const olMatch = t.match(/^(\d+)\.\s+(.+)/)
    const ulMatch = t.match(/^[-*+]\s+(.+)/)

    if (olMatch) {
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] } }
      list.items.push(olMatch[2])
    } else if (ulMatch) {
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] } }
      list.items.push(ulMatch[1])
    } else {
      flushList()
      // Bold-only line → sub-header
      if (/^\*\*[^*]+\*\*$/.test(t)) {
        elements.push(<strong key={`h${elements.length}`} style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 700, marginTop: '0.75rem', marginBottom: '0.15rem' }}>{t.slice(2, -2)}</strong>)
      } else {
        elements.push(<span key={`s${elements.length}`}>{renderInline(t)}</span>)
      }
    }
  }
  flushList()

  const allInline = elements.every(el => el.type === 'span' || el.type === 'strong')
  if (allInline) {
    const withBreaks = elements.reduce((acc, el, j) => {
      if (j > 0 && elements[j - 1].type === 'span') acc.push(<br key={`br${j}`} />)
      acc.push(el)
      return acc
    }, [])
    return <p key={key} style={{ marginBottom: '0.65rem', lineHeight: 1.8 }}>{withBreaks}</p>
  }

  return <div key={key} style={{ marginBottom: '0.5rem' }}>{elements}</div>
}

const LANG_LABELS = { sql: 'SQL', python: 'Python', bash: 'Bash', sh: 'Shell', js: 'JS', javascript: 'JS', typescript: 'TS', json: 'JSON', yaml: 'YAML', go: 'Go', rust: 'Rust', java: 'Java', cpp: 'C++', c: 'C' }

function CodeBlock({ lang, content }) {
  return (
    <div style={{ margin: '0.75rem 0', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {lang && LANG_LABELS[lang.toLowerCase()] && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>{LANG_LABELS[lang.toLowerCase()]}</span>
        </div>
      )}
      <pre style={{ margin: 0, padding: '0.875rem 1rem', background: 'var(--surface)', overflowX: 'auto', fontSize: '0.82rem', lineHeight: 1.6, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-primary)', tabSize: 2 }}>
        <code>{content}</code>
      </pre>
    </div>
  )
}

export default function MarkdownText({ text, style }) {
  if (!text) return null
  const segments = parseSegments(text)
  const out = []
  segments.forEach((seg, si) => {
    if (seg.type === 'code') {
      out.push(<CodeBlock key={`c${si}`} lang={seg.lang} content={seg.content} />)
    } else {
      seg.content.split(/\n\n+/).forEach((block, bi) => {
        const el = renderBlock(block, `${si}-${bi}`)
        if (el) out.push(el)
      })
    }
  })
  return <div style={style}>{out}</div>
}
