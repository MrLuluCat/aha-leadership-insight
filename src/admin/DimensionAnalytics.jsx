import { useMemo, useState } from 'react'
import { fmt } from '../lib/format'
import { catOf } from '../scoring'
import Icon from './icons'

function formatDelta(delta) {
  const rounded = Math.round(delta * 10) / 10
  if (rounded > 0) return `+${fmt(rounded)}`
  if (rounded < 0) return `-${fmt(Math.abs(rounded))}`
  return fmt(0)
}

function polarPoint(cx, cy, radius, angle) {
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
}

function labelAnchor(cos) {
  if (Math.abs(cos) < 0.22) return 'middle'
  return cos > 0 ? 'start' : 'end'
}

function InteractiveRadar({ dimensions, avgScore, selectedId, onSelect }) {
  const count = dimensions.length
  const w = 440
  const h = 344
  const cx = w / 2
  const cy = h / 2 + 4
  const maxR = 112
  const levels = [0.25, 0.5, 0.75, 1]

  const angleFor = (i) => -Math.PI / 2 + (2 * Math.PI * i) / count
  const polyPoints = (values) =>
    values
      .map((val, i) => {
        const ratio = Math.max(0, Math.min(100, val)) / 100
        return polarPoint(cx, cy, maxR * ratio, angleFor(i))
          .map((n) => n.toFixed(1))
          .join(',')
      })
      .join(' ')

  const avgPoints = polyPoints(dimensions.map(() => avgScore))
  const dataPoints = polyPoints(dimensions.map((d) => Number(d.score ?? 0)))

  return (
    <svg
      className="ov-radar-svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Grafik radar skor rata-rata dimensi dibandingkan rata-rata keseluruhan"
    >
      {levels.map((lv, idx) => (
        <polygon
          key={lv}
          points={polyPoints(dimensions.map(() => lv * 100))}
          className={'ov-radar-ring' + (idx === levels.length - 1 ? ' is-outer' : '')}
        />
      ))}

      {dimensions.map((dim, i) => {
        const [x, y] = polarPoint(cx, cy, maxR, angleFor(i))
        return <line key={`axis-${dim.id}`} x1={cx} y1={cy} x2={x} y2={y} className="ov-radar-axis" />
      })}

      <polygon points={avgPoints} className="ov-radar-avg-poly" />
      <polygon points={dataPoints} className="ov-radar-data-poly" />

      {dimensions.map((dim, i) => {
        const score = Number(dim.score ?? 0)
        const ratio = Math.max(0, Math.min(100, score)) / 100
        const angle = angleFor(i)
        const [vx, vy] = polarPoint(cx, cy, maxR * ratio, angle)
        const [lx, ly] = polarPoint(cx, cy, maxR + 22, angle)
        const isSelected = dim.id === selectedId
        const anchor = labelAnchor(Math.cos(angle))
        const label = dim.short_name || dim.name

        return (
          <g
            key={dim.id}
            className={'ov-radar-node' + (isSelected ? ' is-selected' : '')}
            tabIndex={0}
            role="button"
            aria-label={`${dim.name}: ${fmt(score)}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(dim.id)}
            onMouseEnter={() => onSelect(dim.id)}
            onFocus={() => onSelect(dim.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(dim.id)
              }
            }}
          >
            {isSelected && <circle cx={vx} cy={vy} r={10} className="ov-radar-halo" />}
            <circle cx={vx} cy={vy} r={isSelected ? 6 : 4.2} className="ov-radar-dot" />
            <text
              x={lx}
              y={ly + (Math.sin(angle) > 0.5 ? 6 : Math.sin(angle) < -0.5 ? -2 : 4)}
              textAnchor={anchor}
              className="ov-radar-lbl"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function DimensionAnalytics({ dimensions = [] }) {
  const [sortMode, setSortMode] = useState('original')
  const [viewMode, setViewMode] = useState('bar')
  const [activeBarId, setActiveBarId] = useState(null)
  const [selectedRadarId, setSelectedRadarId] = useState(null)

  const summary = useMemo(() => {
    if (!dimensions.length) {
      return { avg: 0, highest: null, lowest: null, sorted: [], spread: 0, showExtremes: false }
    }
    const scores = dimensions.map((d) => Number(d.score ?? 0))
    const avg = scores.reduce((sum, v) => sum + v, 0) / dimensions.length
    const sorted = [...dimensions].sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
    const highest = sorted[0]
    const lowest = sorted[sorted.length - 1]
    const spread = Number(highest.score ?? 0) - Number(lowest.score ?? 0)
    const showExtremes = dimensions.length > 1 && spread > 0.05
    return { avg, highest, lowest, sorted, spread, showExtremes }
  }, [dimensions])

  const displayed = sortMode === 'desc' ? summary.sorted : dimensions
  const avgPct = Math.max(0, Math.min(100, summary.avg))
  const effectiveRadarId = selectedRadarId ?? summary.highest?.id ?? dimensions[0]?.id
  const selectedDim = dimensions.find((d) => d.id === effectiveRadarId) ?? summary.highest ?? dimensions[0]

  const selectedDelta = selectedDim ? Number(selectedDim.score ?? 0) - summary.avg : 0
  const selectedCat = selectedDim ? catOf(Number(selectedDim.score ?? 0)) : null

  return (
    <section className="panel ov-dim-card" aria-labelledby="heading-dimensi">
      <div className="ov-dim-head">
        <div className="ov-dim-title-group">
          <span className="ov-card-icon" aria-hidden="true">
            <Icon name="bars" size={19} />
          </span>
          <div className="ov-dim-titles">
            <div className="ov-dim-title-line">
              <h2 id="heading-dimensi">Rata-rata per Dimensi</h2>
              <span className="ov-scale-pill">Skor dalam skala 0–100</span>
            </div>
            <p className="ov-card-sub">Pemetaan skor kompetensi utama seluruh peserta asesmen</p>
          </div>
        </div>

        <div className="ov-dim-controls">
          {viewMode === 'bar' && (
            <div className="ov-seg" role="group" aria-label="Urutan dimensi">
              <button
                type="button"
                className={'ov-seg-btn' + (sortMode === 'original' ? ' is-active' : '')}
                aria-pressed={sortMode === 'original'}
                onClick={() => setSortMode('original')}
              >
                Urutan Asli
              </button>
              <button
                type="button"
                className={'ov-seg-btn' + (sortMode === 'desc' ? ' is-active' : '')}
                aria-pressed={sortMode === 'desc'}
                onClick={() => setSortMode('desc')}
              >
                Tertinggi
              </button>
            </div>
          )}

          <div className="ov-seg is-view" role="group" aria-label="Tampilan visualisasi">
            <button
              type="button"
              className={'ov-seg-btn is-navy' + (viewMode === 'bar' ? ' is-active' : '')}
              aria-pressed={viewMode === 'bar'}
              onClick={() => setViewMode('bar')}
            >
              <Icon name="bars" size={14} />
              <span>Grafik Batang</span>
            </button>
            <button
              type="button"
              className={'ov-seg-btn is-navy' + (viewMode === 'radar' ? ' is-active' : '')}
              aria-pressed={viewMode === 'radar'}
              onClick={() => setViewMode('radar')}
            >
              <Icon name="radar" size={14} />
              <span>Radar</span>
            </button>
          </div>
        </div>
      </div>

      {dimensions.length ? (
        <>
          <div className="ov-dim-kpis">
            <div className="ov-kpi is-navy">
              <span className="ov-kpi-label">
                <span className="ov-kpi-dot" aria-hidden="true" />
                <span>Rata-rata Keseluruhan</span>
              </span>
              <b className="ov-kpi-val">{fmt(summary.avg)}</b>
            </div>

            <div className="ov-kpi is-peak">
              <span className="ov-kpi-label">
                <Icon name="up" size={14} />
                <span className="ov-kpi-name" title={summary.highest?.name}>
                  Tertinggi: {summary.highest?.short_name || summary.highest?.name || '—'}
                </span>
              </span>
              <b className="ov-kpi-pill is-peak">{fmt(summary.highest?.score ?? 0)}</b>
            </div>

            <div className="ov-kpi is-focus">
              <span className="ov-kpi-label">
                <Icon name="alert" size={14} />
                <span className="ov-kpi-name" title={summary.lowest?.name}>
                  Perlu Fokus: {summary.lowest?.short_name || summary.lowest?.name || '—'}
                </span>
              </span>
              <b className="ov-kpi-pill is-focus">{fmt(summary.lowest?.score ?? 0)}</b>
            </div>
          </div>

          {viewMode === 'bar' ? (
            <div className="ov-dim-bar-wrap">
              <div className="ov-dim-legend">
                <span className="ov-dim-hint">
                  Arahkan kursor atau ketuk baris untuk melihat selisih terhadap rata-rata ({fmt(summary.avg)})
                </span>
                <div className="ov-dim-keys">
                  <span className="ov-dim-key">
                    <span className="ov-key-tick" aria-hidden="true" />
                    <span>Garis Rata-rata ({fmt(summary.avg)})</span>
                  </span>
                  <span className="ov-dim-key">
                    <span className="ov-key-dot" aria-hidden="true" />
                    <span>Skor Dimensi</span>
                  </span>
                </div>
              </div>

              <ul className="ov-dim-list">
                {displayed.map((dim) => {
                  const score = Number(dim.score ?? 0)
                  const widthPct = Math.max(0, Math.min(100, score))
                  const isPeak = summary.showExtremes && dim.id === summary.highest?.id
                  const isFocus = summary.showExtremes && dim.id === summary.lowest?.id
                  const isSub = !isPeak && score < summary.avg
                  const delta = score - summary.avg
                  const isActive = activeBarId === dim.id

                  return (
                    <li
                      key={dim.id}
                      className={'ov-dim-row' + (isActive ? ' is-active' : '')}
                      tabIndex={0}
                      onMouseEnter={() => setActiveBarId(dim.id)}
                      onMouseLeave={() => setActiveBarId(null)}
                      onFocus={() => setActiveBarId(dim.id)}
                      onBlur={() => setActiveBarId(null)}
                      onClick={() => setActiveBarId((prev) => (prev === dim.id ? null : dim.id))}
                    >
                      <div className="ov-dim-name-cell">
                        <span className="ov-dim-label">{dim.name}</span>
                        {isPeak && <span className="ov-dim-tag is-peak">Puncak</span>}
                        {isFocus && <span className="ov-dim-tag is-focus">Fokus</span>}
                      </div>

                      <div className="ov-dim-track-wrap" aria-hidden="true">
                        <div className="ov-dim-track">
                          <span
                            className={
                              'ov-dim-fill' + (isPeak ? ' is-peak' : isSub ? ' is-sub' : '')
                            }
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="ov-avg-marker" style={{ left: `${avgPct}%` }} />
                      </div>

                      <div className="ov-dim-val-cell">
                        <span
                          className={
                            'ov-dim-delta' +
                            (isActive ? ' is-shown' : '') +
                            (delta >= 0 ? ' is-pos' : ' is-neg')
                          }
                        >
                          {formatDelta(delta)}
                        </span>
                        <b className="ov-dim-score">{fmt(score)}</b>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : dimensions.length >= 3 ? (
            <div className="ov-radar-grid">
              <div className="ov-radar-stage">
                <InteractiveRadar
                  dimensions={dimensions}
                  avgScore={summary.avg}
                  selectedId={effectiveRadarId}
                  onSelect={setSelectedRadarId}
                />
                <div className="ov-radar-legend">
                  <span className="ov-dim-key">
                    <span className="ov-key-line is-navy" aria-hidden="true" />
                    <span>Skor Dimensi</span>
                  </span>
                  <span className="ov-dim-key">
                    <span className="ov-key-line is-amber" aria-hidden="true" />
                    <span>Rata-rata ({fmt(summary.avg)})</span>
                  </span>
                </div>
              </div>

              <div className="ov-radar-side">
                <div className="ov-radar-balance">
                  <h3>
                    {summary.spread <= 8
                      ? 'Profil Kompetensi Merata'
                      : 'Variasi Kompetensi Terdeteksi'}
                  </h3>
                  <p>
                    Seluruh {dimensions.length} dimensi berada pada rentang{' '}
                    <strong>{fmt(summary.lowest?.score ?? 0)}</strong> –{' '}
                    <strong>{fmt(summary.highest?.score ?? 0)}</strong> (selisih{' '}
                    {fmt(summary.spread)} poin), menunjukkan fondasi kompetensi yang{' '}
                    {summary.spread <= 8
                      ? 'stabil di seluruh aspek penilaian.'
                      : 'beragam dan memiliki ruang penguatan spesifik.'}
                  </p>
                </div>

                {selectedDim && (
                  <div className="ov-radar-detail">
                    <div className="ov-radar-detail-top">
                      <span className="ov-radar-detail-meta">Dimensi Terpilih</span>
                      <span className="ov-radar-cat">{selectedCat?.name}</span>
                    </div>
                    <div className="ov-radar-detail-main">
                      <h4>{selectedDim.name}</h4>
                      <b className="ov-radar-detail-score">{fmt(selectedDim.score)}</b>
                    </div>
                    <p
                      className={
                        'ov-radar-detail-delta' + (selectedDelta >= 0 ? ' is-pos' : ' is-neg')
                      }
                    >
                      {formatDelta(selectedDelta)} poin{' '}
                      {selectedDelta >= 0 ? 'di atas' : 'di bawah'} rata-rata keseluruhan (
                      {fmt(summary.avg)})
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="meta">Tampilan radar membutuhkan minimal 3 dimensi aktif.</p>
          )}
        </>
      ) : (
        <p className="meta">Belum ada data dimensi.</p>
      )}
    </section>
  )
}
