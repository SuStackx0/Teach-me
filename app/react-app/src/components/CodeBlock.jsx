import { useState } from 'react'

export default function CodeBlock({ example }) {
  const [outputOpen, setOutputOpen] = useState(false)
  const { filename, language, code, caption, expected_output } = example
  const hasHeader = !!(filename || caption || language || expected_output)

  return (
    <div className="code-block-wrap">
      {hasHeader && (
        <div className="code-block-header">
          <div className="code-block-meta">
            {filename && <span className="code-filename">{filename}</span>}
            {caption && <span className="code-caption">{caption}</span>}
          </div>
          <div className="code-block-actions">
            {language && <span className="code-lang-badge">{language}</span>}
            {expected_output && (
              <button
                className={`run-btn${outputOpen ? ' active' : ''}`}
                onClick={() => setOutputOpen(v => !v)}
                title="Show simulated output"
              >
                {outputOpen ? '▲ hide' : '▶ run'}
              </button>
            )}
          </div>
        </div>
      )}

      <pre className={hasHeader ? 'has-header' : ''}><code>{code}</code></pre>

      {expected_output && (
        <div className={`code-output${outputOpen ? ' open' : ''}`} aria-hidden={!outputOpen}>
          <span className="code-output-label">
            output<span className="cursor-blink">_</span>
          </span>
          <pre className="code-output-pre">{expected_output}</pre>
        </div>
      )}
    </div>
  )
}
