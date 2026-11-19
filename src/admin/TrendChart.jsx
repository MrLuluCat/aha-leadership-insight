import { useState } from 'react'

const W = 740
const H = 264
const PAD = { l: 38, r: 22, t: 40, b: 34 }

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_FULL = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

// Build `length` recent months filled with 0 for missing periods, including MoM delta
// computed using the extra preceding month before the visible window.
export function buildTrendSeries(trend = [], length = 12) {
  const counts = new Map(trend.map((item) => [String(item.period).slice(0, 7), Number(item.count)]))
  const last = trend.length ? String(trend[trend.length - 1].period).slice(0, 7) : ''
  let [year, month] = last.split('-').map(Number)
  if (!year || !month) {
    const now = new Date()
    year = now.getFullYear()
    month = now.getMonth() + 1
  }

  const extended = Array.from({ length: length + 1 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 - (length - i), 1))
    const key = date.toISOString().slice(0, 7)
    const mIdx = date.getUTCMonth()
    return {
      period: key,
      year: date.getUTCFullYear(),
      label: MONTHS_SHORT[mIdx],
      fullLabel: MONTHS_FULL[mIdx],
      count: counts.get(key) ?? 0,
    }
  })

  return extended.slice(1).map((item, i) => ({
    ...item,
    mom: item.count - extended[i].count,
  }))
}

export default function TrendChart({ trend, months = 12, series: providedSeries }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const series = providedSeries ?? buildTrendSeries(trend, months)
  if (!series.length) return null

  const counts = series.map((item) => item.count)
  const rawMax = Math.max(...counts)
  const max = Math.max(4, rawMax)
  const step = (W - PAD.l - PAD.r) / Math.max(1, series.length - 1)
  const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)
  const pts = counts.map((v, i) => [PAD.l + i * step, y(v)])
  const line = pts.map((p) => p.join(',')).join(' ')
  const area = `${PAD.l},${H - PAD.b} ${line} ${pts[pts.length - 1][0]},${H - PAD.b}`

  const ticks = Array.from(new Set(Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i))))

  // Highlight latest month holding the peak count (or last month if all 0)
  let peakIdx = series.length - 1
  if (rawMax > 0) {
    series.forEach((item, i) => {
      if (item.count >= series[peakIdx].count) peakIdx = i
    })
  }
  const peakPt = pts[peakIdx]
  const peakItem = series[peakIdx]
  const badgeText = String(peakItem.count)
  const badgeW = Math.max(28, badgeText.length * 9 + 14)

  const hoveredItem = hoverIdx !== null ? series[hoverIdx] : null
  const hoveredPt = hoverIdx !== null ? pts[hoverIdx] : null
  const momVal = hoveredItem?.mom ?? 0
  const momLabel = momVal > 0 ? `+${momVal} MoM` : momVal < 0 ? `${momVal} MoM` : '0 MoM'
  const momTone = momVal > 0 ? 'is-pos' : momVal < 0 ? 'is-neg' : 'is-flat'

  // Anchor tooltip away from left/right boundaries so it never clips
  let alignClass = 'is-center'
  if (hoverIdx !== null) {
    if (hoverIdx === 0) alignClass = 'is-left'
    else if (hoverIdx === series.length - 1) alignClass = 'is-right'
  }

  return (
    <div
      className="ov-trend-stage"
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg
        className="trend-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Tren asesmen selesai ${months} bulan terakhir, puncak ${peakItem.label} sebanyak ${peakItem.count}`}
      >
        <defs>
          <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ebb04d" stopOpacity="0.34" />
            <stop offset="55%" stopColor="#061e55" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#061e55" stopOpacity="0" />
          </linearGradient>
          <filter id="trendBadgeShadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#061e55" floodOpacity="0.22" />
          </filter>
        </defs>

        {ticks.map((t, idx) => (
          <g key={t}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(t)}
              y2={y(t)}
              className={'grid-line' + (idx === 0 ? ' is-base' : ' is-dashed')}
            />
            <text x={PAD.l - 10} y={y(t) + 4} textAnchor="end" className="axis">
              {t}
            </text>
          </g>
        ))}

        <polygon points={area} fill="url(#trendAreaGrad)" />
        <polyline points={line} className="trend-line" />

        {hoveredPt && (
          <line
            x1={hoveredPt[0]}
            x2={hoveredPt[0]}
            y1={PAD.t}
            y2={H - PAD.b}
            className="ov-trend-crosshair"
          />
        )}

        {pts.map((p, i) => {
          const isPeak = i === peakIdx
          const isHovered = i === hoverIdx
          return (
            <g key={series[i].period}>
              {isHovered && <circle cx={p[0]} cy={p[1]} r={9} className="ov-trend-halo" />}
              <circle
                cx={p[0]}
                cy={p[1]}
                r={isHovered ? 6 : isPeak ? 5.5 : 3.6}
                className={
                  'trend-dot' + (isPeak || isHovered ? ' last' : '')
                }
              />
              <text
                x={p[0]}
                y={H - 10}
                textAnchor="middle"
                className={'axis' + (isPeak || isHovered ? ' is-bold' : '')}
              >
                {series[i].label}
              </text>
            </g>
          )
        })}

        {hoverIdx !== peakIdx && (
          <g
            transform={`translate(${peakPt[0]} ${peakPt[1] - 14})`}
            filter="url(#trendBadgeShadow)"
          >
            <rect x={-badgeW / 2} y="-22" width={badgeW} height="22" rx="7" className="trend-tip" />
            <polygon points="-4,0 4,0 0,4" className="trend-tip" />
            <text y="-7" textAnchor="middle" className="tip-text">
              {badgeText}
            </text>
          </g>
        )}

        {/* Wide invisible hit targets for smooth scrubbing */}
        {pts.map((p, i) => (
          <rect
            key={`hit-${series[i].period}`}
            x={p[0] - step / 2}
            y={PAD.t - 10}
            width={Math.max(24, step)}
            height={H - PAD.t - PAD.b + 30}
            fill="transparent"
            className="ov-trend-hit"
            tabIndex={0}
            aria-label={`${series[i].fullLabel} ${series[i].year}: ${series[i].count} asesmen selesai`}
            onMouseEnter={() => setHoverIdx(i)}
            onFocus={() => setHoverIdx(i)}
            onBlur={() => setHoverIdx(null)}
            onClick={() => setHoverIdx((prev) => (prev === i ? null : i))}
          />
        ))}
      </svg>

      {hoveredItem && hoveredPt && (
        <div
          className={`ov-trend-popover ${alignClass}`}
          style={{
            left: `${(hoveredPt[0] / W) * 100}%`,
            top: `${Math.max(6, ((hoveredPt[1] - 14) / H) * 100)}%`,
          }}
          role="status"
          aria-live="polite"
        >
          <div className="ov-tp-top">
            <span className="ov-tp-month">
              {hoveredItem.fullLabel} {hoveredItem.year}
            </span>
            <span className={`ov-tp-mom ${momTone}`}>{momLabel}</span>
          </div>
          <div className="ov-tp-val">
            <span>Asesmen selesai</span>
            <b>{hoveredItem.count} peserta</b>
          </div>
        </div>
      )}
    </div>
  )
}
