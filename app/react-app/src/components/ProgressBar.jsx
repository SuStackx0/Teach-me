export default function ProgressBar({ pct }) {
  return (
    <div className="top-progress-bar">
      <div className="top-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
