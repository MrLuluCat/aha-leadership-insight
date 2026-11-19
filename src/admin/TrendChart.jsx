const W = 640
const H = 230
const PAD = { l: 34, r: 18, t: 24, b: 32 }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// The RPC only returns months that have results. Fill the other eleven months
// with zero so the chart reads as a true twelve-month timeline.
function recentMonths(trend, length) {
  const counts = new Map(trend.map((item) => [String(item.period).slice(0, 7), Number(item.count)]))
  const last = trend.length ? String(trend[trend.length - 1].period).slice(0, 7) : ''
  let [year, month] = last.split('-').map(Number)
  if (!year || !month) {
    const now = new Date()
    year = now.getFullYear()
    month = now.getMonth() + 1
  }

  return Array.from({ length }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 - (length - 1 - i), 1))
    const key = date.toISOString().slice(0, 7)
    return {
      period: key,
      label: MONTHS[date.getUTCMonth()],
      count: counts.get(key) ?? 0,
    }
  })
}

export default function TrendChart({ trend, months = 12 }) {
  const series = recentMonths(trend, months)
  const counts = series.map((item) => item.count)
  const max = Math.max(4, ...counts)
  const step = (W - PAD.l - PAD.r) / Math.max(1, series.length - 1)
  const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)
  const pts = counts.map((v, i) => [PAD.l + i * step, y(v)])
  const line = pts.map((p) => p.join(',')).join(' ')
  const area = `${PAD.l},${H - PAD.b} ${line} ${pts[pts.length - 1][0]},${H - PAD.b}`
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i))
  const last = pts[pts.length - 1]

  return (
    <svg
      className="trend-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Tren asesmen selesai ${months} bulan terakhir, bulan terakhir ${counts[counts.length - 1]}`}
    >
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ebb04d" stopOpacity=".34" />
          <stop offset="1" stopColor="#ebb04d" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid-line" />
          <text x={PAD.l - 10} y={y(t) + 4} textAnchor="end" className="axis">
            {t}
          </text>
        </g>
      ))}
      <polygon points={area} fill="url(#trendFill)" />
      <polyline points={line} className="trend-line" />
      {pts.map((p, i) => (
        <g key={series[i].period}>
          <circle
            cx={p[0]}
            cy={p[1]}
            r={i === pts.length - 1 ? 5.5 : 3.5}
            className={i === pts.length - 1 ? 'trend-dot last' : 'trend-dot'}
          />
          <text x={p[0]} y={H - 8} textAnchor="middle" className="axis">
            {series[i].label}
          </text>
        </g>
      ))}
      <g transform={`translate(${last[0]} ${last[1] - 14})`}>
        <rect x="-13" y="-18" width="26" height="21" rx="7" className="trend-tip" />
        <text y="-3" textAnchor="middle" className="tip-text">
          {counts[counts.length - 1]}
        </text>
      </g>
    </svg>
  )
}
