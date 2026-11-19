import { useEffect, useState } from 'react'
import { fetchOverview } from '../services/admin'
import { fmt } from '../lib/format'
import { CATS } from '../scoring'
import CustomSelect from './CustomSelect'
import DimensionAnalytics from './DimensionAnalytics'
import Icon from './icons'
import TrendChart, { buildTrendSeries } from './TrendChart'
import PageLoader from '../components/PageLoader'

const CAT_META = [
  { color: '#061e55', bg: 'rgba(6,30,85,.10)', text: '#061e55' },      // Sangat Kuat
  { color: '#4f46e5', bg: '#eef2ff', text: '#4338ca' },                // Kuat
  { color: '#f59e0b', bg: '#fffbeb', text: '#b45309' },                // Cukup Berkembang
  { color: '#f97316', bg: '#fff7ed', text: '#c2410c' },                // Tahap Pengembangan
  { color: '#cbd5e1', bg: '#f1f5f9', text: '#64748b' },                // Perlu Penguatan Mendasar
]

function StatCard({ icon, tone, value, label, text = false }) {
  const waveColor = tone === 'gold' ? '#f5e1b9' : '#dce6fb'
  return (
    <div className="ov-stat">
      <div className="ov-stat-main">
        <span className={`ov-stat-icon ${tone}`} aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <div className="ov-stat-copy">
          <b className={'ov-stat-val' + (text ? ' is-text' : '')}>{value}</b>
          <span className="ov-stat-lbl">{label}</span>
        </div>
      </div>
      <svg className="ov-stat-wave" viewBox="0 0 120 44" fill="none" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 44 C26 42, 42 26, 66 28 C86 30, 96 10, 120 14 L120 44 Z"
          fill={waveColor}
          fillOpacity="0.55"
        />
      </svg>
    </div>
  )
}

function CategoryDonut({ items, total }) {
  const [activeName, setActiveName] = useState(null)
  const size = 164
  const stroke = 18
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const safeTotal = Math.max(1, total)

  let offset = 0
  const enriched = items.map((item, idx) => {
    const meta = CAT_META[idx % CAT_META.length]
    const share = item.count / safeTotal
    const pct = total > 0 ? (item.count / total) * 100 : 0
    const dash = share * circumference
    const seg = { ...item, ...meta, pct, dash, offset }
    offset += dash
    return seg
  })

  const nonZero = enriched.filter((s) => s.count > 0)
  const activeItem = activeName ? enriched.find((s) => s.name === activeName) : null

  return (
    <div className="ov-donut-wrap">
      <div className="ov-donut-box">
        <svg
          className="ov-donut-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Distribusi kategori dari ${total} hasil`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={stroke}
          />
          {nonZero.map((seg) => {
            const isDimmed = activeName && activeName !== seg.name
            const isActive = activeName === seg.name
            return (
              <circle
                key={seg.name}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isActive ? stroke + 2 : stroke}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0, seg.dash - 8)} ${circumference}`}
                strokeDashoffset={-seg.offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className={'ov-donut-arc' + (isDimmed ? ' is-dim' : '') + (isActive ? ' is-active' : '')}
                onMouseEnter={() => setActiveName(seg.name)}
                onMouseLeave={() => setActiveName(null)}
                onClick={() => setActiveName((prev) => (prev === seg.name ? null : seg.name))}
              />
            )
          })}
        </svg>

        <div className="ov-donut-center">
          {activeItem ? (
            <>
              <b>{activeItem.count}</b>
              <span className="ov-dc-name">{activeItem.name}</span>
              <span
                className="ov-dc-pill"
                style={{ background: activeItem.bg, color: activeItem.text }}
              >
                {fmt(activeItem.pct)}%
              </span>
            </>
          ) : (
            <>
              <b>{total}</b>
              <span>Total Peserta</span>
            </>
          )}
        </div>
      </div>

      <div className="ov-donut-legend" role="list">
        {enriched.map((item) => {
          const isActive = activeName === item.name
          const isZero = item.count === 0
          return (
            <button
              key={item.name}
              type="button"
              className={
                'ov-leg-btn' +
                (isActive ? ' is-active' : '') +
                (isZero ? ' is-zero' : '')
              }
              onMouseEnter={() => setActiveName(item.name)}
              onMouseLeave={() => setActiveName(null)}
              onClick={() => setActiveName((prev) => (prev === item.name ? null : item.name))}
            >
              <span className="ov-leg-left">
                <span
                  className="ov-leg-dot"
                  style={{ background: item.color }}
                  aria-hidden="true"
                />
                <span className="ov-leg-name">{item.name}</span>
              </span>
              <span className="ov-leg-right">
                <span
                  className="ov-leg-pct"
                  style={isZero ? undefined : { background: item.bg, color: item.text }}
                >
                  {isZero ? '0%' : `${fmt(item.pct)}%`}
                </span>
                <b className="ov-leg-val">{item.count}</b>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function OverviewView({ data }) {
  const [range, setRange] = useState(12)
  const dimensions = data?.dimensions ?? []
  const sorted = [...dimensions].sort((a, b) => b.score - a.score)
  const highest = sorted[0]
  const lowest = sorted[sorted.length - 1]
  const categories = data?.categories ?? []
  const categoryNames = [
    ...CATS.map((cat) => cat.name),
    ...categories
      .map((item) => item.name)
      .filter((name) => !CATS.some((cat) => cat.name === name)),
  ]
  const categoryItems = categoryNames.map((name) => {
    const found = categories.find((entry) => entry.name === name)
    return { name, count: Number(found?.count ?? 0) }
  })
  const totalCategories = categoryItems.reduce((sum, item) => sum + item.count, 0)
  const nonZeroCounts = categoryItems.filter((c) => c.count > 0).map((c) => c.count)
  const trend = data?.trend ?? []
  const trendSeries = buildTrendSeries(trend, range)
  const trendTotal = trendSeries.reduce((sum, item) => sum + item.count, 0)
  const trendPeak = trendSeries.reduce(
    (best, item) => (item.count >= best.count ? item : best),
    trendSeries[trendSeries.length - 1] ?? { label: '—', count: 0 }
  )

  // Status summary percentages (computed from real overview counts)
  const completedCount = Number(data?.total_completed ?? 0)
  const inProgressCount = Number(data?.total_in_progress ?? 0)
  const totalParticipants = Number(data?.total_participants ?? 0)
  const waitingCount = Math.max(0, totalParticipants - completedCount - inProgressCount)
  const statusTotal = completedCount + inProgressCount + waitingCount
  const statusDenom = Math.max(1, statusTotal)

  const pctCompleted = statusTotal ? Math.round((completedCount / statusDenom) * 100) : 0
  const pctInProgress = statusTotal ? Math.round((inProgressCount / statusDenom) * 100) : 0
  const pctWaiting = statusTotal ? Math.max(0, 100 - pctCompleted - pctInProgress) : 0

  return (
    <>
      <header className="ov-head-bar">
        <div className="ov-head">
          <h1>Overview</h1>
          <p>Ringkasan hasil asesmen dan insight kepemimpinan peserta.</p>
        </div>
        <div className="ov-period-box">
          <CustomSelect
            className="ov-period-select"
            ariaLabel="Periode ringkasan"
            value={range}
            onChange={(val) => setRange(Number(val))}
            options={[
              { value: 12, label: 'Periode: 12 Bulan' },
              { value: 6, label: 'Periode: 6 Bulan' },
              { value: 3, label: 'Periode: 3 Bulan' },
            ]}
          />
        </div>
      </header>

      <section className="ov-stats-row" aria-label="Statistik utama">
        <StatCard icon="users" tone="navy" value={totalParticipants} label="Total peserta" />
        <StatCard icon="check" tone="gold" value={completedCount} label="Asesmen selesai" />
        <StatCard
          icon="trophy"
          tone="navy"
          value={fmt(data?.avg_overall ?? 0)}
          label="Rata-rata Leadership Index"
        />
        <StatCard
          icon="layers"
          tone="gold"
          value={highest?.short_name || highest?.name || '—'}
          label="Dimensi tertinggi"
          text
        />
        <StatCard
          icon="bulb"
          tone="navy"
          value={lowest?.short_name || lowest?.name || '—'}
          label="Dimensi terendah"
          text
        />
      </section>

      {!data?.total_completed && (
        <p className="alert info ov-alert">
          Belum ada asesmen selesai. Statistik akan terisi setelah peserta mengirim jawaban.
        </p>
      )}

      {/* Row 2: Rata-rata per Dimensi (Left) + Ringkasan Status (Right) */}
      <div className="ov-bento-row">
        <DimensionAnalytics dimensions={dimensions} />

        {/* Upgraded Card: Ringkasan Status */}
        <section className="panel ov-rich-card">
          <div className="ov-rc-head">
            <div className="ov-rc-head-left">
              <span className="ov-rc-icon is-dark" aria-hidden="true">
                <Icon name="check" size={19} />
              </span>
              <div>
                <h2>Ringkasan Status</h2>
                <p>Progres penyelesaian asesmen peserta</p>
              </div>
            </div>
            <span className="ov-rc-pill">
              <span className="ov-rc-dot" aria-hidden="true" />
              {statusTotal} Sesi
            </span>
          </div>

          <div className="ov-st-stack">
            <div className="ov-st-row is-done">
              <div className="ov-st-row-top">
                <div className="ov-st-left">
                  <span className="ov-st-box is-done" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div className="ov-st-copy">
                    <strong>Selesai</strong>
                    <span>
                      {completedCount} dari {statusTotal} sesi
                    </span>
                  </div>
                </div>
                <span className="ov-st-badge is-done">{pctCompleted}%</span>
              </div>
              <div className="ov-st-track">
                <span className="ov-st-fill is-done" style={{ width: `${pctCompleted}%` }} />
              </div>
            </div>

            <div className="ov-st-row is-prog">
              <div className="ov-st-row-top">
                <div className="ov-st-left">
                  <span className="ov-st-box is-prog" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 14" />
                    </svg>
                  </span>
                  <div className="ov-st-copy">
                    <strong>Dalam Proses</strong>
                    <span>
                      {inProgressCount} dari {statusTotal} sesi
                    </span>
                  </div>
                </div>
                <span className="ov-st-badge is-prog">{pctInProgress}%</span>
              </div>
              <div className="ov-st-track">
                <span className="ov-st-fill is-prog" style={{ width: `${pctInProgress}%` }} />
              </div>
            </div>

            <div className="ov-st-row is-wait">
              <div className="ov-st-row-top">
                <div className="ov-st-left">
                  <span className="ov-st-box is-wait" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 4h14M5 20h14M7 4v3a5 5 0 0 0 10 0V4M7 20v-3a5 5 0 0 1 10 0v3" />
                    </svg>
                  </span>
                  <div className="ov-st-copy">
                    <strong>Menunggu</strong>
                    <span>
                      {waitingCount} dari {statusTotal} sesi
                    </span>
                  </div>
                </div>
                <span className="ov-st-badge is-wait">{pctWaiting}%</span>
              </div>
              <div className="ov-st-track">
                <span className="ov-st-fill is-wait" style={{ width: `${pctWaiting}%` }} />
              </div>
            </div>
          </div>

          <div className="ov-rc-foot">
            <span className="ov-rc-foot-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              </svg>
              <span>
                {pctCompleted >= 80
                  ? 'Tingkat penyelesaian sangat tinggi'
                  : 'Progres penyelesaian terus berjalan'}
              </span>
            </span>
            <strong className="ov-rc-foot-right">100% Terdata</strong>
          </div>
        </section>
      </div>

      {/* Row 3: Tren Peserta (Left) + Distribusi Kategori Donut (Right) */}
      <div className="ov-bento-row">
        <section className="panel ov-trend-card" aria-labelledby="heading-tren">
          <div className="ov-trend-head">
            <div className="ov-dim-title-group">
              <span className="ov-card-icon" aria-hidden="true">
                <Icon name="trend" size={19} />
              </span>
              <div className="ov-dim-titles">
                <h2 id="heading-tren">Tren Peserta</h2>
                <p className="ov-card-sub">
                  Jumlah asesmen selesai per bulan ({range} bulan terakhir).
                </p>
              </div>
            </div>

            <div className="ov-trend-actions">
              <div className="ov-trend-pills">
                <span className="ov-trend-pill is-total">
                  <span>Total Selesai:</span>
                  <b>{trendTotal}</b>
                </span>
                <span className="ov-trend-pill is-peak">
                  <span>Puncak:</span>
                  <b>
                    {trendPeak.label} ({trendPeak.count})
                  </b>
                </span>
              </div>

              <CustomSelect
                className="cs-compact ov-trend-select"
                ariaLabel="Rentang waktu tren peserta"
                value={range}
                onChange={(val) => setRange(Number(val))}
                options={[
                  { value: 12, label: '12 bulan terakhir' },
                  { value: 6, label: '6 bulan terakhir' },
                  { value: 3, label: '3 bulan terakhir' },
                ]}
              />
            </div>
          </div>

          {trend.length ? (
            <div className="chart-wrap">
              <TrendChart trend={trend} months={range} series={trendSeries} />
            </div>
          ) : (
            <p className="meta">Belum ada data tren.</p>
          )}
        </section>

        {/* Upgraded Card: Distribusi Kategori */}
        <section className="panel ov-rich-card">
          <div className="ov-rc-head">
            <div className="ov-rc-head-left">
              <span className="ov-rc-icon is-indigo" aria-hidden="true">
                <Icon name="pie" size={19} />
              </span>
              <div>
                <h2>Distribusi Kategori</h2>
                <p>Arahkan kursor ke grafik atau daftar untuk detail</p>
              </div>
            </div>
          </div>

          <div className="ov-rc-body">
            {totalCategories > 0 ? (
              <CategoryDonut items={categoryItems} total={totalCategories} />
            ) : (
              <p className="meta">Belum ada hasil asesmen.</p>
            )}
          </div>

          <div className="ov-rc-foot">
            <span className="ov-rc-foot-left is-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                {nonZeroCounts.length > 0 ? (
                  <>
                    Akumulasi aktual:{' '}
                    <strong>
                      {nonZeroCounts.join(' + ')} = {totalCategories} hasil
                    </strong>
                  </>
                ) : (
                  'Belum ada akumulasi kategori'
                )}
              </span>
            </span>
            <strong className="ov-rc-foot-right">{categoryItems.length} Kategori</strong>
          </div>
        </section>
      </div>
    </>
  )
}

export default function Overview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    fetchOverview()
      .then((result) => {
        if (mounted) setData(result)
      })
      .catch((err) => {
        if (mounted) setError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <PageLoader variant="overview" label="Memuat statistik…" />
  if (error) return <p className="alert">{error}</p>

  return <OverviewView data={data} />
}
