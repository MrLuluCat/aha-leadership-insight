import { useMemo, useRef, useState } from 'react'
import { CATS, SCALE } from '../scoring'
import { dfmt, dtfmt, fmt, tfmt } from '../lib/format'
import { buildReport } from '../lib/report'
import { exportParticipantReportExcel } from '../lib/exportExcel'
import CustomSelect from './CustomSelect'
import PageLoader from '../components/PageLoader'
import logo from '../assets/aha-logo.jpg'

const PAGE_SIZE_OPTIONS = [10, 25, 50]

function getShortLabel(d) {
  if (d.short_name) return d.short_name
  const n = (d.name || '').toLowerCase()
  if (n.includes('kesadaran')) return 'Kesadaran'
  if (n.includes('pengelolaan')) return 'Pengelolaan'
  if (n.includes('empati')) return 'Empati'
  if (n.includes('harmoni')) return 'Harmoni'
  if (n.includes('kolaborasi')) return 'Kolaborasi'
  if (n.includes('adaptas') || n.includes('adaptabilitas')) return 'Adaptasi'
  if (n.includes('aksi')) return 'Aksi'
  return d.name
}

function catTone(name = '') {
  const n = name.toLowerCase()
  if (n.includes('sangat kuat') || n === 'kuat') return 'emerald'
  if (n.includes('cukup')) return 'sky'
  if (n.includes('tahap')) return 'amber'
  return 'rose'
}

function likertTone(answer) {
  if (answer === 1) return 'rose'
  if (answer === 2) return 'amber'
  if (answer === 3) return 'slate'
  if (answer === 4) return 'sky'
  return 'emerald'
}

function InteractiveRadar({ dimensions, activeDimId, onHoverDim }) {
  const size = 320
  const height = 275
  const cx = 160
  const cy = 138
  const maxRadius = 86
  const numAxes = Math.max(1, dimensions.length)
  const levels = [25, 50, 75, 100]

  const getPoint = (idx, radius) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / numAxes
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle,
    }
  }

  const dataPoints = dimensions.map((dim, idx) => {
    const score = Math.max(0, Math.min(100, Number(dim.score ?? 0)))
    const pt = getPoint(idx, (score / 100) * maxRadius)
    return { ...dim, ...pt, score }
  })

  const polygonStr = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${size} ${height}`}
      className="rm-radar-svg"
      role="img"
      aria-label="Radar chart profil kompetensi"
    >
      {levels.map((lvl) => {
        const r = (lvl / 100) * maxRadius
        const pts = dimensions
          .map((_, idx) => {
            const p = getPoint(idx, r)
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
          })
          .join(' ')
        return <polygon key={lvl} points={pts} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      })}

      {dimensions.map((dim, idx) => {
        const end = getPoint(idx, maxRadius)
        const lbl = getPoint(idx, maxRadius + 22)
        const isActive = activeDimId === dim.id
        let textAnchor = 'middle'
        if (Math.cos(lbl.angle) > 0.25) textAnchor = 'start'
        else if (Math.cos(lbl.angle) < -0.25) textAnchor = 'end'

        return (
          <g key={dim.id}>
            <line
              x1={cx}
              y1={cy}
              x2={end.x.toFixed(1)}
              y2={end.y.toFixed(1)}
              stroke={isActive ? '#d97706' : '#e2e8f0'}
              strokeWidth={isActive ? '1.6' : '1'}
            />
            <text
              x={lbl.x.toFixed(1)}
              y={(lbl.y + 3).toFixed(1)}
              textAnchor={textAnchor}
              fill={isActive ? '#061844' : '#475569'}
              fontSize="10.5"
              fontWeight={isActive ? '800' : '600'}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => onHoverDim(dim.id)}
              onMouseLeave={() => onHoverDim(null)}
              onClick={() => onHoverDim(isActive ? null : dim.id)}
            >
              {getShortLabel(dim)}
            </text>
          </g>
        )
      })}

      <polygon
        points={polygonStr}
        fill="rgba(245, 158, 11, 0.24)"
        stroke="#061844"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {dataPoints.map((pt) => {
        const isActive = activeDimId === pt.id
        return (
          <g key={pt.id}>
            {isActive && (
              <circle
                cx={pt.x.toFixed(1)}
                cy={pt.y.toFixed(1)}
                r="9"
                fill="rgba(245, 158, 11, 0.28)"
              />
            )}
            <circle
              cx={pt.x.toFixed(1)}
              cy={pt.y.toFixed(1)}
              r={isActive ? '5.5' : '4'}
              fill={isActive ? '#d97706' : '#061844'}
              stroke="#ffffff"
              strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'all .15s ease' }}
              onMouseEnter={() => onHoverDim(pt.id)}
              onMouseLeave={() => onHoverDim(null)}
              onClick={() => onHoverDim(isActive ? null : pt.id)}
            />
          </g>
        )
      })}
    </svg>
  )
}

export default function ResultDetailModal({ detail, loading, error, onClose }) {
  const [activeNav, setActiveNav] = useState('ringkasan')
  const [activeDimId, setActiveDimId] = useState(null)
  const [showCatPopover, setShowCatPopover] = useState(false)
  const [checkedActions, setCheckedActions] = useState({})
  const [answersOpen, setAnswersOpen] = useState(true)

  const bodyRef = useRef(null)
  const ringkasanRef = useRef(null)
  const kekuatanRef = useRef(null)
  const planRef = useRef(null)
  const jawabanRef = useRef(null)

  const report = useMemo(() => (detail?.result ? buildReport(detail.result) : null), [detail])

  const overall = report?.overall ?? 0
  const category = report?.category
  const dimensions = report?.dimensions ?? []
  const strengths = report?.strengths ?? []
  const priorities = report?.priorities ?? []
  const plan = report?.plan ?? []

  const totalActions = plan.reduce((s, p) => s + (p.actions?.length ?? 0), 0)
  const doneActions = Object.values(checkedActions).filter(Boolean).length

  const activeDim = activeDimId ? dimensions.find((d) => d.id === activeDimId) : null

  const gaugeRadius = 26
  const gaugeCirc = 2 * Math.PI * gaugeRadius
  const gaugeOffset = gaugeCirc * (1 - Math.min(100, Math.max(0, overall)) / 100)

  const pName = detail?.result?.participant_name || detail?.participant?.name || 'Peserta'
  const pInitial = pName.trim().charAt(0).toUpperCase() || '?'
  const completedAt = detail?.result?.completed_at

  function scrollToSection(key, ref) {
    setActiveNav(key)
    if (key === 'jawaban' && !answersOpen) {
      setAnswersOpen(true)
    }
    if (ref?.current && bodyRef.current) {
      const top = ref.current.offsetTop - bodyRef.current.offsetTop - 8
      bodyRef.current.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
  }

  function toggleAction(phaseIdx, actIdx) {
    const id = `${phaseIdx}-${actIdx}`
    setCheckedActions((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div
      className="rs-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="rm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rm-participant-title"
      >
        {/* Sticky Modal Header + Quick Nav Pills */}
        <header className="rm-head no-print">
          <div className="rm-head-top">
            <div className="rm-identity">
              <div className="rm-avatar" aria-hidden="true">
                {pInitial}
              </div>
              <div className="rm-id-text">
                <div className="rm-badges">
                  <span className="rm-eyebrow-pill">LAPORAN ASESMEN</span>
                  {detail?.version && (
                    <span className="rm-ver-pill">
                      Versi konfigurasi {detail.version.version_number}
                    </span>
                  )}
                </div>
                <div className="rm-name-row">
                  <h2 id="rm-participant-title">{pName}</h2>
                  {completedAt && (
                    <span className="rm-date-meta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>
                        Asesmen {dfmt(completedAt)}
                        {tfmt(completedAt) ? ` • ${tfmt(completedAt)}` : ''}
                      </span>
                    </span>
                  )}
                  {detail?.participant?.email && (
                    <span className="rm-email-meta">{detail.participant.email}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rm-actions">
              <button
                type="button"
                className="rm-btn-primary"
                onClick={() => window.print()}
                disabled={!report}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Cetak / simpan PDF</span>
              </button>
              <button
                type="button"
                className="rm-btn-excel"
                onClick={() => exportParticipantReportExcel(report)}
                disabled={!report}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 13l6 6M15 13l-6 6" />
                </svg>
                <span>Ekspor Excel</span>
              </button>
              <span className="rm-act-sep" aria-hidden="true" />
              <button
                type="button"
                className="rm-close-x"
                onClick={onClose}
                aria-label="Tutup modal laporan asesmen"
                title="Tutup (Esc)"
                autoFocus
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {detail && (
            <nav className="rm-nav" aria-label="Navigasi bagian laporan">
              <button
                type="button"
                className={'rm-nav-pill' + (activeNav === 'ringkasan' ? ' active' : '')}
                onClick={() => scrollToSection('ringkasan', ringkasanRef)}
              >
                Ringkasan &amp; Skor
              </button>
              <button
                type="button"
                className={'rm-nav-pill' + (activeNav === 'kekuatan' ? ' active' : '')}
                onClick={() => scrollToSection('kekuatan', kekuatanRef)}
              >
                Kekuatan &amp; Prioritas
              </button>
              <button
                type="button"
                className={'rm-nav-pill' + (activeNav === 'plan' ? ' active' : '')}
                onClick={() => scrollToSection('plan', planRef)}
              >
                21-Day Action Plan
              </button>
              <button
                type="button"
                className={'rm-nav-pill' + (activeNav === 'jawaban' ? ' active' : '')}
                onClick={() => scrollToSection('jawaban', jawabanRef)}
              >
                <span>Detail Jawaban</span>
                <span className="rm-nav-count">{detail.responses?.length ?? 0}</span>
              </button>
            </nav>
          )}
        </header>

        {/* Scrollable Modal Body */}
        <div className="rm-body" ref={bodyRef}>
          {loading && <PageLoader variant="modal-report" label="Memuat detail peserta…" />}
          {error && <p className="alert">{error}</p>}

          {detail && report && (
            <>
              {/* Print-only executive header */}
              <div className="print-only rm-print-head">
                <img className="rp-nav-logo" src={logo} alt="AHA Leadership Centre" />
                <p className="rp-label">Laporan asesmen</p>
                <h1 className="rp-name">{pName}</h1>
                <p className="rp-date">
                  Asesmen {dtfmt(completedAt)} · Versi konfigurasi {detail.version?.version_number}
                </p>
              </div>

              {/* SECTION 1: 3-COL BENTO */}
              <section ref={ringkasanRef} className="rm-bento-3">
                {/* Card A: Skor Keseluruhan */}
                <div className="rm-card rm-score-card">
                  <div>
                    <div className="rm-card-top">
                      <span className="rm-kicker">SKOR KESELURUHAN</span>
                      <div className="rm-cat-pop-wrap">
                        <button
                          type="button"
                          className={`rm-cat-pill tone-${catTone(category?.name)}`}
                          onClick={() => setShowCatPopover((v) => !v)}
                        >
                          <span>{category?.name ?? '—'}</span>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </button>

                        {showCatPopover && (
                          <div className="rm-popover" role="tooltip">
                            <p className="rm-popover-title">Rentang Kategori Skor</p>
                            <ul>
                              {CATS.map((c, i) => {
                                const prevMin = i === 0 ? 100 : CATS[i - 1].min - 0.1
                                const rangeLabel =
                                  i === CATS.length - 1
                                    ? `< ${CATS[i - 1].min}`
                                    : `${c.min} – ${fmt(prevMin)}`
                                const isCurrent = c.name === category?.name
                                return (
                                  <li key={c.name} className={isCurrent ? 'is-current' : ''}>
                                    <span>{c.name}</span>
                                    <b>{rangeLabel}</b>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rm-score-main">
                      <div>
                        <div className="rm-score-val">
                          <strong>{fmt(overall)}</strong>
                          <span>/ 100</span>
                        </div>
                        <p className="rm-score-sub">Overall Leadership Index</p>
                      </div>

                      <div className="rm-gauge">
                        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                          <circle cx="32" cy="32" r={gaugeRadius} fill="none" stroke="#f1f5f9" strokeWidth="6" />
                          <circle
                            cx="32"
                            cy="32"
                            r={gaugeRadius}
                            fill="none"
                            stroke="#061844"
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={gaugeCirc}
                            strokeDashoffset={gaugeOffset}
                            transform="rotate(-90 32 32)"
                          />
                        </svg>
                        <span>{fmt(overall)}%</span>
                      </div>
                    </div>

                    <div className="rm-narrative-box">
                      <p>
                        {category?.mean ||
                          'Kemampuan kepemimpinan Anda menunjukkan perkembangan yang cukup baik dengan ruang untuk ditingkatkan.'}
                      </p>
                    </div>
                  </div>

                  <div className="rm-progress-foot">
                    <div className="rm-pf-top">
                      <span>Capaian Indeks</span>
                      <strong>{fmt(overall)}%</strong>
                    </div>
                    <div className="rm-pf-track">
                      <div
                        className="rm-pf-fill"
                        style={{ width: `${Math.min(100, Math.max(0, overall))}%` }}
                      />
                    </div>
                    <div className="rm-pf-ticks">
                      <span>0</span>
                      <span>25</span>
                      <span>50</span>
                      <span>75</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>

                {/* Card B: Interactive 7-Axis Radar */}
                <div className="rm-card rm-radar-card">
                  <div className="rm-radar-head">
                    <div>
                      <h3>Profil Kompetensi</h3>
                      <p>Arahkan kursor pada titik sumbu</p>
                    </div>
                    <span className="rm-radar-pill">
                      {activeDim
                        ? `${getShortLabel(activeDim)}: ${fmt(activeDim.score)}`
                        : `${dimensions.length} Dimensi`}
                    </span>
                  </div>

                  <div className="rm-radar-wrap">
                    <InteractiveRadar
                      dimensions={dimensions}
                      activeDimId={activeDimId}
                      onHoverDim={setActiveDimId}
                    />
                  </div>

                  <div className="rm-radar-foot">
                    <span className="rm-legend-dot">
                      <i aria-hidden="true" />
                      <span>Area Profil Peserta</span>
                    </span>
                    <b>Skala 0–100</b>
                  </div>
                </div>

                {/* Card C: Rincian per Dimensi (Zero Horizontal Scrollbar) */}
                <div className="rm-card rm-dims-card">
                  <div>
                    <div className="rm-dims-head">
                      <h3>Rincian per Dimensi</h3>
                      <span>Skor &amp; Kategori</span>
                    </div>

                    <div className="rm-dims-list">
                      {dimensions.map((d) => {
                        const isHi = activeDimId === d.id
                        const tone = catTone(d.category)
                        return (
                          <div
                            key={d.id}
                            className={'rm-dim-row' + (isHi ? ' is-hi' : '')}
                            onMouseEnter={() => setActiveDimId(d.id)}
                            onMouseLeave={() => setActiveDimId(null)}
                            onClick={() => setActiveDimId(isHi ? null : d.id)}
                          >
                            <div className="rm-dim-left">
                              <div className="rm-dim-top">
                                <span className="rm-dim-name">{d.name}</span>
                                <b className="rm-dim-score">{fmt(d.score)}</b>
                              </div>
                              <div className="rm-dim-track">
                                <span
                                  className={`rm-dim-fill tone-${tone}`}
                                  style={{ width: `${Math.min(100, Math.max(0, d.score))}%` }}
                                />
                              </div>
                            </div>
                            <span className={`rm-dim-badge tone-${tone}`}>{d.category}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rm-dims-foot">
                    <strong>Overall Leadership Index</strong>
                    <div className="rm-dims-foot-right">
                      <b>{fmt(overall)}</b>
                      <span className={`rm-dim-badge tone-${catTone(category?.name)}`}>
                        {category?.name ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 2: TOP 3 STRENGTHS vs DEVELOPMENT PRIORITIES */}
              <section ref={kekuatanRef} className="rm-bento-2">
                {/* Strengths */}
                <div className="rm-card">
                  <div className="rm-sec-head">
                    <div className="rm-sec-head-left">
                      <span className="rm-sec-icon is-emerald" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                        </svg>
                      </span>
                      <div>
                        <h3>Top 3 Strengths</h3>
                        <p>Kekuatan utama yang menjadi modal kepemimpinan</p>
                      </div>
                    </div>
                    <span className="rm-sec-tag is-emerald">Skor Tertinggi</span>
                  </div>

                  <div className="rm-insight-stack">
                    {strengths.map((d, i) => (
                      <div key={d.id} className={'rm-insight-box' + (i === 0 ? ' is-top-emerald' : '')}>
                        <div className="rm-ib-top">
                          <div className="rm-ib-left">
                            <span className={'rm-ib-rank' + (i === 0 ? ' is-emerald-solid' : ' is-emerald-soft')}>
                              {i + 1}
                            </span>
                            <strong>{d.name}</strong>
                          </div>
                          <span className={'rm-ib-score' + (i === 0 ? ' is-emerald' : '')}>
                            {fmt(d.score)}
                          </span>
                        </div>
                        <p>{d.strength_guidance}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priorities */}
                <div className="rm-card">
                  <div className="rm-sec-head">
                    <div className="rm-sec-head-left">
                      <span className="rm-sec-icon is-amber" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                        </svg>
                      </span>
                      <div>
                        <h3>Development Priorities</h3>
                        <p>Area fokus pengembangan dengan rekomendasi praktis</p>
                      </div>
                    </div>
                    <span className="rm-sec-tag is-amber">Prioritas Fokus</span>
                  </div>

                  <div className="rm-insight-stack">
                    {priorities.map((d, i) => (
                      <div key={d.id} className={'rm-insight-box' + (i === 0 ? ' is-top-amber' : '')}>
                        <div className="rm-ib-top">
                          <div className="rm-ib-left">
                            <span className={'rm-ib-rank' + (i === 0 ? ' is-amber-solid' : ' is-amber-soft')}>
                              {i + 1}
                            </span>
                            <strong>{d.name}</strong>
                          </div>
                          <span className={'rm-ib-score' + (i === 0 ? ' is-amber' : '')}>
                            {fmt(d.score)}
                          </span>
                        </div>
                        <p>{d.development_guidance}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* SECTION 3: 21-DAY ACTION PLAN */}
              <section ref={planRef} className="rm-card">
                <div className="rm-sec-head">
                  <div className="rm-sec-head-left">
                    <span className="rm-sec-icon is-navy" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </span>
                    <div>
                      <h3>21-Day Action Plan</h3>
                      <p>Klik item aksi di bawah untuk mensimulasikan progres latihan harian</p>
                    </div>
                  </div>

                  <div className="rm-plan-counter no-print">
                    <span>Progres Simulasi:</span>
                    <b>
                      {doneActions} / {totalActions} Selesai
                    </b>
                  </div>
                </div>

                <div className="rm-phases-grid">
                  {plan.map((phase, pIdx) => {
                    const phaseTone = pIdx === 0 ? 'amber' : pIdx === 1 ? 'indigo' : 'emerald'
                    return (
                      <div key={phase.days} className={`rm-phase-card tone-${phaseTone}`}>
                        <div className="rm-phase-top">
                          <span className={`rm-phase-pill tone-${phaseTone}`}>{phase.days}</span>
                          <span className={`rm-phase-num tone-${phaseTone}`}>Fase {pIdx + 1}</span>
                        </div>
                        <h4>{phase.title}</h4>
                        <p className="rm-phase-focus">{phase.focus}</p>

                        <div className="rm-phase-items">
                          {phase.actions.map((act, aIdx) => {
                            const id = `${pIdx}-${aIdx}`
                            const checked = Boolean(checkedActions[id])
                            return (
                              <label
                                key={id}
                                className={'rm-action-item' + (checked ? ' is-done' : '')}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleAction(pIdx, aIdx)}
                                />
                                <span>{act}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* SECTION 4: COLLAPSIBLE & SEARCHABLE DETAIL JAWABAN */}
              <section ref={jawabanRef} className="rm-card rm-answers-card no-print">
                <button
                  type="button"
                  className="rm-acc-btn"
                  aria-expanded={answersOpen}
                  onClick={() => setAnswersOpen((v) => !v)}
                >
                  <div className="rm-acc-left">
                    <span className={'rm-acc-chev' + (answersOpen ? ' is-open' : '')} aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                    <div>
                      <div className="rm-acc-title">
                        <h3>Detail jawaban peserta ({detail.responses?.length ?? 0})</h3>
                        <span className="rm-likert-chip">Skala Likert 1–5</span>
                      </div>
                      <p>Klik untuk menyembunyikan atau menampilkan rincian butir pernyataan asesmen</p>
                    </div>
                  </div>
                  <span className="rm-acc-toggle">{answersOpen ? 'Sembunyikan' : 'Tampilkan'}</span>
                </button>

                {answersOpen && (
                  <AnswersSection
                    responses={detail.responses ?? []}
                    dimensions={detail.result.config?.dimensions ?? []}
                  />
                )}
              </section>

              {/* Disclaimer Footer */}
              <footer className="rm-disclaimer">
                <span className="rm-disc-dot" aria-hidden="true" />
                <p>
                  Hasil mencerminkan jawaban reflektif peserta untuk pengembangan diri, bukan
                  diagnosis psikologis atau dasar keputusan seleksi. Skor dihitung menggunakan
                  konfigurasi versi yang tercatat pada sesi asesmen ini.
                </p>
              </footer>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function AnswersSection({ responses, dimensions }) {
  const [search, setSearch] = useState('')
  const [dimFilter, setDimFilter] = useState('all')
  const [scoreFilter, setScoreFilter] = useState('ALL')
  const [sortKey, setSortKey] = useState('index')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const dimName = (id) => dimensions.find((d) => d.id === id)?.name ?? '—'

  const enriched = useMemo(
    () =>
      responses.map((r, i) => ({
        ...r,
        index: i + 1,
        dimension: dimName(r.question?.dimension_id),
        itemScore: ((Number(r.corrected_answer ?? 1) - 1) / 4) * 100,
      })),
    [responses, dimensions]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter((r) => {
      if (dimFilter !== 'all' && r.question?.dimension_id !== dimFilter) return false
      if (scoreFilter === 'LOW' && r.itemScore > 25) return false
      if (scoreFilter === 'HIGH' && r.itemScore < 75) return false
      if (q) {
        const hay = `${r.question?.text ?? ''} ${r.dimension} ${SCALE[r.answer - 1] ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [enriched, dimFilter, scoreFilter, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'index') cmp = a.index - b.index
      else if (sortKey === 'dimension') cmp = a.dimension.localeCompare(b.dimension)
      else if (sortKey === 'answer') cmp = a.answer - b.answer
      else if (sortKey === 'score') cmp = a.itemScore - b.itemScore
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const paged = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  const sortIcon = (key) => {
    if (sortKey !== key) return <span className="rs-sort-icon" aria-hidden="true">↕</span>
    return (
      <span className="rs-sort-icon on" aria-hidden="true">
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    )
  }

  return (
    <div className="rm-ans-body">
      <div className="rm-ans-filters">
        <div className="rm-ans-row">
          <div className="rs-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Cari pertanyaan atau jawaban…"
              aria-label="Cari pertanyaan atau jawaban"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
            />
          </div>

          <CustomSelect
            ariaLabel="Filter dimensi"
            value={dimFilter}
            onChange={(val) => {
              setDimFilter(val)
              setPage(0)
            }}
            options={[
              { value: 'all', label: 'Semua dimensi' },
              ...dimensions.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>

        <div className="rm-score-pills-row">
          <div className="rm-score-pills">
            <span className="rm-sp-label">Filter Skor:</span>
            <button
              type="button"
              className={'rm-sp-btn' + (scoreFilter === 'ALL' ? ' active' : '')}
              onClick={() => {
                setScoreFilter('ALL')
                setPage(0)
              }}
            >
              Semua ({responses.length})
            </button>
            <button
              type="button"
              className={'rm-sp-btn' + (scoreFilter === 'LOW' ? ' active is-low' : '')}
              onClick={() => {
                setScoreFilter('LOW')
                setPage(0)
              }}
            >
              Skor Rendah ≤25
            </button>
            <button
              type="button"
              className={'rm-sp-btn' + (scoreFilter === 'HIGH' ? ' active is-high' : '')}
              onClick={() => {
                setScoreFilter('HIGH')
                setPage(0)
              }}
            >
              Skor Tinggi ≥75
            </button>
          </div>
          <span className="rm-sp-count">Menampilkan {filtered.length} butir</span>
        </div>
      </div>

      <div className="rs-table-wrap">
        <table className="rs-table rs-table-sm">
          <thead>
            <tr>
              <th>
                <button type="button" className="rs-sort" onClick={() => handleSort('index')}>
                  <span>#</span>
                  {sortIcon('index')}
                </button>
              </th>
              <th>Pertanyaan</th>
              <th>
                <button type="button" className="rs-sort" onClick={() => handleSort('dimension')}>
                  <span>Dimensi</span>
                  {sortIcon('dimension')}
                </button>
              </th>
              <th>
                <button type="button" className="rs-sort" onClick={() => handleSort('answer')}>
                  <span>Jawaban</span>
                  {sortIcon('answer')}
                </button>
              </th>
              <th className="rs-num">
                <button type="button" className="rs-sort" onClick={() => handleSort('score')}>
                  <span>Skor butir</span>
                  {sortIcon('score')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => {
              const lTone = likertTone(r.answer)
              const scoreCls =
                r.itemScore >= 75 ? 'is-high' : r.itemScore <= 25 ? 'is-low' : ''
              return (
                <tr key={r.question_id}>
                  <td data-label="No.">
                    <span className="rs-ver">#{r.index}</span>
                  </td>
                  <td data-label="Pertanyaan">
                    {r.question?.text}
                    {r.question?.reverse_scoring && <small className="tag">reverse</small>}
                  </td>
                  <td data-label="Dimensi">{r.dimension}</td>
                  <td data-label="Jawaban">
                    <span className={`rm-ans-pill tone-${lTone}`}>
                      {r.answer} · {SCALE[r.answer - 1]}
                    </span>
                  </td>
                  <td data-label="Skor butir" className="rs-num">
                    <strong className={`rm-item-score ${scoreCls}`}>{fmt(r.itemScore)}</strong>
                  </td>
                </tr>
              )
            })}
            {!paged.length && (
              <tr>
                <td colSpan="5" className="rs-empty">
                  Tidak ada pertanyaan atau jawaban yang cocok dengan filter saat ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rs-footer">
        <div className="rs-size">
          <span>Tampilkan</span>
          <CustomSelect
            className="cs-compact"
            ariaLabel="Jumlah jawaban per halaman"
            value={pageSize}
            onChange={(val) => {
              setPageSize(Number(val))
              setPage(0)
            }}
            options={PAGE_SIZE_OPTIONS.map((opt) => ({ value: opt, label: String(opt) }))}
          />
          <span>entri</span>
        </div>

        <span className="rs-info">
          {sorted.length === 0
            ? '0 entri'
            : `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, sorted.length)} dari ${sorted.length}`}
        </span>

        <nav className="rs-pager" aria-label="Paginasi jawaban">
          <button
            type="button"
            className="rs-pg"
            disabled={safePage === 0}
            onClick={() => setPage(0)}
            aria-label="Halaman pertama"
          >
            «
          </button>
          <button
            type="button"
            className="rs-pg"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Halaman sebelumnya"
          >
            ‹
          </button>
          <span className="rs-pg-now">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="rs-pg"
            disabled={safePage + 1 >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="Halaman berikutnya"
          >
            ›
          </button>
          <button
            type="button"
            className="rs-pg"
            disabled={safePage + 1 >= totalPages}
            onClick={() => setPage(totalPages - 1)}
            aria-label="Halaman terakhir"
          >
            »
          </button>
        </nav>
      </div>
    </div>
  )
}
