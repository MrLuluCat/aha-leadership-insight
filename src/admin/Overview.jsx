import { useEffect, useState } from 'react'
import { fetchOverview } from '../services/admin'
import { fmt } from '../lib/format'
import { CATS } from '../scoring'
import Icon from './icons'
import TrendChart from './TrendChart'

function Stat({ icon, tone, value, label, text = false }) {
  return (
    <div className="stat">
      <span className={`stat-icon ${tone}`} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className="stat-copy">
        <b className={'stat-value' + (text ? ' is-text' : '')}>{value}</b>
        <span className="stat-label">{label}</span>
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
  const totalCategories = categories.reduce((sum, item) => sum + Number(item.count), 0)
  const trend = data?.trend ?? []

  return (
    <>
      <header className="ov-head">
        <span className="ov-rule" aria-hidden="true" />
        <h1>Overview</h1>
        <p>Ringkasan hasil asesmen dan insight kepemimpinan peserta.</p>
      </header>

      <section className="stats" aria-label="Statistik utama">
        <Stat icon="users" tone="navy" value={data?.total_participants ?? 0} label="Total peserta" />
        <Stat icon="check" tone="gold" value={data?.total_completed ?? 0} label="Asesmen selesai" />
        <Stat
          icon="trophy"
          tone="navy"
          value={fmt(data?.avg_overall ?? 0)}
          label="Rata-rata Leadership Index"
        />
        <Stat
          icon="layers"
          tone="gold"
          value={highest?.short_name || highest?.name || '—'}
          label="Dimensi tertinggi"
          text
        />
        <Stat
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

      <section className="panel panel-dimensions">
        <div className="panel-head">
          <div className="panel-title">
            <Icon name="bars" size={19} />
            <h2>Rata-rata per dimensi</h2>
          </div>
          <span className="panel-note">Skor dalam skala 0–100</span>
        </div>
        {dimensions.length ? (
          <ul className="dim-bars">
            {dimensions.map((dimension) => (
              <li key={dimension.id}>
                <span className="dim-name">{dimension.name}</span>
                <div className="track">
                  <span style={{ width: `${Math.max(0, Math.min(100, dimension.score))}%` }} />
                </div>
                <b>{fmt(dimension.score)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">Belum ada data dimensi.</p>
        )}
      </section>

      <div className="ov-grid">
        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <Icon name="pie" size={19} />
              <h2>Distribusi kategori</h2>
            </div>
          </div>
          {categories.length ? (
            <ul className="dist-list">
              {categoryNames.map((name) => {
                const item = categories.find((entry) => entry.name === name)
                const count = Number(item?.count ?? 0)
                const share = totalCategories ? (count / totalCategories) * 100 : 0
                return (
                  <li key={name}>
                    <div className="dist-row">
                      <span>{name}</span>
                      <b>{count}</b>
                    </div>
                    <div className="track">
                      <span style={{ width: `${share}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="meta">Belum ada hasil asesmen.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <Icon name="trend" size={19} />
              <h2>Tren peserta</h2>
            </div>
            <label className="range-pill">
              <select
                value={range}
                onChange={(event) => setRange(Number(event.target.value))}
                aria-label="Rentang waktu tren peserta"
              >
                <option value={12}>12 bulan terakhir</option>
                <option value={6}>6 bulan terakhir</option>
              </select>
              <Icon name="chevron" size={14} />
            </label>
          </div>
          <p className="panel-sub">Jumlah asesmen selesai per bulan ({range} bulan terakhir).</p>
          {trend.length ? (
            <div className="chart-wrap">
              <TrendChart trend={trend} months={range} />
            </div>
          ) : (
            <p className="meta">Belum ada data tren.</p>
          )}
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

  if (loading) return <p className="meta">Memuat statistik…</p>
  if (error) return <p className="alert">{error}</p>

  return <OverviewView data={data} />
}
