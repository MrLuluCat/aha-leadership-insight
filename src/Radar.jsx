export default function Radar({ values = [], labels = [], size = 340, showLabels = true }) {
  const n = values.length
  if (!n) return null

  const c = size / 2
  const R = size * 0.34
  const pt = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]
  }
  const poly = (f) => values.map((_, i) => pt(i, f(i)).join(',')).join(' ')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="radar"
      role="img"
      aria-label="Diagram radar dimensi kepemimpinan"
    >
      {[0.2, 0.4, 0.6, 0.8, 1].map((r) => (
        <polygon key={r} points={poly(() => r)} className="ring" />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, 1)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} className="spoke" />
      })}
      <polygon points={poly((i) => Math.max(values[i], 0.04))} className="shape" />
      {values.map((value, i) => {
        const [x, y] = pt(i, Math.max(value, 0.04))
        return <circle key={i} cx={x} cy={y} r="4.5" className="dot" />
      })}
      {showLabels &&
        values.map((_, i) => {
          const [x, y] = pt(i, 1.2)
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="lbl">
              {labels[i] ?? ''}
            </text>
          )
        })}
    </svg>
  )
}
