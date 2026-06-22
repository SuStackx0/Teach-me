import { useState } from 'react'

export default function CodeBlock({ example }) {
  const [open, setOpen] = useState(false)
  const { filename, language, code, line_by_line } = example

  return (
    <div className="code-block-wrap">
      {filename && <div className="code-filename">{filename}</div>}
      <pre><code>{code}</code></pre>
      {line_by_line && line_by_line.length > 0 && (
        <>
          <button className="lbl-toggle" onClick={() => setOpen(o => !o)}>
            {open ? '▲ Hide' : '▼ Line-by-line breakdown'}
          </button>
          {open && (
            <div className="lbl-list">
              {line_by_line.map((entry, i) => (
                <div key={i} className="lbl-item">
                  <span className="lbl-lines">L{entry.lines}</span>
                  <span className="lbl-text">{entry.explanation}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
