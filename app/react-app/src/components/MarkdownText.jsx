function renderInline(text) {
  const parts = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0, key = 0, match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const raw = match[0]
    if (raw.startsWith('**')) {
      parts.push(<strong key={key++}>{raw.slice(2, -2)}</strong>)
    } else {
      parts.push(<code key={key++}>{raw.slice(1, -1)}</code>)
    }
    last = match.index + raw.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderBlock(block, i) {
  const trimmed = block.trim()
  if (!trimmed) return null

  const lines = trimmed.split('\n').filter(l => l.trim())

  // Standalone bold line → section header
  if (lines.length === 1 && /^\*\*[^*]+\*\*$/.test(trimmed)) {
    return <h3 key={i} style={{ marginTop: '1.25rem', marginBottom: '0.2rem', fontSize: '0.95rem', fontWeight: 700 }}>{trimmed.slice(2, -2)}</h3>
  }

  // Parse line-by-line to handle mixed content (prose + embedded lists)
  const elements = []
  let list = null // { type, items }

  const flushList = () => {
    if (!list) return
    const Tag = list.type
    elements.push(
      <Tag key={`l${elements.length}`} style={{ margin: '0.4rem 0 0.4rem 0' }}>
        {list.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
      </Tag>
    )
    list = null
  }

  for (const line of lines) {
    const t = line.trim()
    const olMatch = t.match(/^(\d+)\.\s+(.+)/)
    const ulMatch = t.match(/^[-*]\s+(.+)/)

    if (olMatch) {
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] } }
      list.items.push(olMatch[2])
    } else if (ulMatch) {
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] } }
      list.items.push(ulMatch[1])
    } else {
      flushList()
      // Bold-only line inside a block → sub-header
      if (/^\*\*[^*]+\*\*$/.test(t)) {
        elements.push(<strong key={`h${elements.length}`} style={{ display: 'block', color: 'var(--text-primary)', marginTop: '0.75rem', marginBottom: '0.15rem' }}>{t.slice(2, -2)}</strong>)
      } else {
        elements.push(<span key={`s${elements.length}`}>{renderInline(t)}</span>)
      }
    }
  }
  flushList()

  // All spans → single paragraph with line breaks between them
  const allInline = elements.every(el => el.type === 'span' || el.type === 'strong')
  if (allInline) {
    const withBreaks = elements.reduce((acc, el, j) => {
      if (j > 0 && elements[j - 1].type === 'span') acc.push(<br key={`br${j}`} />)
      acc.push(el)
      return acc
    }, [])
    return <p key={i} style={{ marginBottom: '0.6rem', lineHeight: 1.8 }}>{withBreaks}</p>
  }

  return <div key={i} style={{ marginBottom: '0.5rem' }}>{elements}</div>
}

export default function MarkdownText({ text, style }) {
  if (!text) return null
  const blocks = text.split(/\n\n+/)
  return (
    <div style={style}>
      {blocks.map((block, i) => renderBlock(block, i)).filter(Boolean)}
    </div>
  )
}
