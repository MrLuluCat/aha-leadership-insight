import { useState } from 'react'
import Radar from './Radar'
import logo from './assets/aha-logo.jpg'
import { buildReport } from './lib/report'
import { exportParticipantReportExcel } from './lib/exportExcel'
import { fmt, dtfmt } from './lib/format'

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

export default function Report({ result, onBack, onRestart, compact = false }) {
  const [confirmRestart, setConfirmRestart] = useState(false)
  const report = buildReport(result)
  if (!report) return null

  const { dimensions, overall, category, strengths, priorities, plan } = report

  return (
    <article className={'rp-wrap' + (compact ? ' rp-compact' : '')}>

      {/* ══ Top Navbar (aligned with content below) ══════════════════ */}
      <header className="rp-navbar no-print">
        <div className="rp-navbar-inner">
          <img className="rp-nav-logo" src={logo} alt="AHA Leadership Centre" />
          <div className="rp-nav-actions">
            {onBack ? (
              <button type="button" className="rp-back-btn" onClick={onBack}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                <span>Kembali<span className="rp-back-extra"> ke Dashboard</span></span>
              </button>
            ) : (
              <a className="rp-back-btn" href="#/">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                <span>Kembali<span className="rp-back-extra"> ke Dashboard</span></span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ══ Main content area ══════════════════════════════════════════ */}
      <div className="rp-body">

        {/* ── Title block across full width ────────────────────────── */}
        <div className="rp-title-block">
          <img className="rp-nav-logo print-only" src={logo} alt="AHA Leadership Centre" />
          <p className="rp-label">Laporan asesmen</p>
          <h1 className="rp-name">{result.participant_name}</h1>
          <p className="rp-date">
            Asesmen {dtfmt(result.completed_at)} · Versi konfigurasi {result.version_number}
          </p>
        </div>

        {/* ── Row 1: 3 Equal-Height Cards (Score Card, Radar, Table) ── */}
        <section className="rp-hero-cards">

          {/* CARD 1: Overall Score Card with Progress Bar */}
          <div className="rp-card rp-score-card">
            <div className="rp-score-top">
              <div className="rp-score-col">
                <span className="rp-score-title">Skor Keseluruhan</span>
                <div className="rp-score-val-wrap">
                  <span className="rp-score-large">{fmt(overall)}</span>
                  <span className="rp-score-out-of">dari 100</span>
                </div>
              </div>

              <div className="rp-score-v-divider" aria-hidden="true" />

              <div className="rp-score-col">
                <span className="rp-score-cat-label">Kategori</span>
                <div className="rp-category-row">
                  <span className="rp-category-title">{category?.name ?? '—'}</span>
                  <span
                    className="rp-info-pill"
                    title={category?.description || category?.mean}
                    aria-label="Info kategori"
                  >
                    i
                  </span>
                </div>
              </div>
            </div>

            <p className="rp-score-narrative">
              {category?.mean || 'Kemampuan kepemimpinan Anda menunjukkan perkembangan yang cukup baik dengan ruang untuk ditingkatkan.'}
            </p>

            {/* Bottom Progress Bar + % */}
            <div className="rp-progress-row">
              <div className="rp-progress-track">
                <div
                  className="rp-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(0, overall))}%` }}
                />
              </div>
              <span className="rp-progress-text">{fmt(overall)}%</span>
            </div>
          </div>

          {/* CARD 2: Radar Chart Card */}
          <div className="rp-card rp-radar-card">
            <div className="rp-radar-inner">
              <Radar
                values={dimensions.map((d) => d.score / 100)}
                labels={dimensions.map((d) => getShortLabel(d))}
              />
            </div>
          </div>

          {/* CARD 3: Clean Dimensions Table Card (Dimensi, Skor, Kategori) */}
          <div className="rp-card rp-table-card">
            <table className="rp-clean-table">
              <thead>
                <tr>
                  <th className="rp-col-dim">Dimensi</th>
                  <th className="rp-col-score">Skor</th>
                  <th className="rp-col-cat">Kategori</th>
                </tr>
              </thead>
              <tbody>
                {dimensions.map((d) => (
                  <tr key={d.id}>
                    <td className="rp-td-name">{d.name}</td>
                    <td className="rp-td-score">{fmt(d.score)}</td>
                    <td className="rp-td-cat-name">{d.category}</td>
                  </tr>
                ))}
                <tr className="rp-row-highlight">
                  <td className="rp-td-name"><strong>Overall Leadership Index</strong></td>
                  <td className="rp-td-score"><strong>{fmt(overall)}</strong></td>
                  <td className="rp-td-cat-name"><strong>{category?.name}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Row 2: Equal Balanced Insights (Strengths & Priorities) ─ */}
        <section className="rp-insights-row">

          {/* Top 3 Strengths */}
          <div className="rp-card rp-insight-card">
            <div className="rp-insight-header">
              <div className="rp-insight-accent" />
              <h2 className="rp-insight-title">Top 3 Strengths</h2>
            </div>
            <ol className="rp-insight-list">
              {strengths.map((d, i) => (
                <li key={d.id} className="rp-insight-item">
                  <span className="rp-rank">{i + 1}</span>
                  <div className="rp-insight-body">
                    <p className="rp-insight-name">
                      {d.name} <span className="rp-insight-score">({fmt(d.score)})</span>
                    </p>
                    <p className="rp-insight-desc">{d.strength_guidance}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Development Priorities */}
          <div className="rp-card rp-insight-card">
            <div className="rp-insight-header">
              <div className="rp-insight-accent rp-accent-dev" />
              <h2 className="rp-insight-title">Development Priorities</h2>
            </div>
            <ol className="rp-insight-list">
              {priorities.map((d, i) => (
                <li key={d.id} className="rp-insight-item">
                  <span className="rp-rank">{i + 1}</span>
                  <div className="rp-insight-body">
                    <p className="rp-insight-name">
                      {d.name} <span className="rp-insight-score">({fmt(d.score)})</span>
                    </p>
                    <p className="rp-insight-desc">{d.development_guidance}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Row 3: 21-Day Action Plan (3 Equal Sized Cards) ──────── */}
        <section className="rp-plan-section">
          <div className="rp-plan-header">
            <div className="rp-insight-accent" />
            <h2 className="rp-plan-title">21-Day Action Plan</h2>
          </div>
          <div className="rp-phases">
            {plan.map((phase) => (
              <div className="rp-card rp-phase" key={phase.days}>
                <span className="rp-phase-days">{phase.days}</span>
                <h3 className="rp-phase-title">{phase.title}</h3>
                <p className="rp-phase-focus">{phase.focus}</p>
                <ul className="rp-phase-actions">
                  {phase.actions.map((action, i) => (
                    <li key={i} className="rp-phase-action">
                      <svg className="rp-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="rp-footer">
          <p className="rp-disclaimer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{flexShrink:0,marginTop:2}}>
              <circle cx="12" cy="12" r="10"/><path fill="white" d="M12 16v-4M12 8h.01"/>
            </svg>
            <span>
              Hasil mencerminkan jawaban reflektif peserta untuk pengembangan diri, bukan diagnosis
              psikologis atau dasar keputusan seleksi. Skor dihitung menggunakan konfigurasi versi
              yang tercatat pada sesi asesmen ini.
            </span>
          </p>
          <div className="rp-footer-actions no-print">
            <button type="button" className="rp-print-btn" onClick={() => window.print()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
              Cetak / simpan PDF
            </button>
            <button
              type="button"
              className="rp-excel-btn"
              onClick={() => exportParticipantReportExcel(report)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 13l6 6M15 13l-6 6" />
              </svg>
              Ekspor Excel
            </button>
            {onRestart && (
              <button type="button" className="rp-restart-btn" onClick={() => setConfirmRestart(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
                Ulangi asesmen
              </button>
            )}
          </div>
        </footer>
      </div>

      {confirmRestart && onRestart && (
        <div
          className="qm-backdrop no-print"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmRestart(false)
          }}
        >
          <div className="qm-modal" role="dialog" aria-modal="true" aria-labelledby="rp-restart-title">
            <div className="qm-head">
              <div className="qm-head-left">
                <span className="qm-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
                  </svg>
                </span>
                <div>
                  <h2 id="rp-restart-title">Ulangi Asesmen?</h2>
                  <p>Konfirmasi sebelum memulai sesi asesmen baru.</p>
                </div>
              </div>
              <button
                type="button"
                className="qm-close"
                onClick={() => setConfirmRestart(false)}
                aria-label="Tutup"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="qm-body">
              <p className="rp-confirm-text">
                Anda sudah pernah melakukan asesmen sebagai{' '}
                <strong>"{result.participant_name}"</strong>. Informasi nama dan email yang sudah
                Anda masukkan akan dimuat ulang kembali pada asesmen baru.
              </p>
            </div>
            <div className="qm-foot">
              <button
                type="button"
                className="qm-btn-cancel"
                onClick={() => setConfirmRestart(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="qm-btn-save"
                onClick={() => {
                  setConfirmRestart(false)
                  onRestart()
                }}
              >
                Ya, Ulangi Asesmen
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
