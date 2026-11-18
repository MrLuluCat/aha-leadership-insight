import { useEffect, useState } from 'react'
import { fetchOverview } from '../services/admin'
import { fmt } from '../lib/format'
import { CATS } from '../scoring'

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
  const maxTrend = Math.max(1, ...trend.map((item) => Number(item.count)))

  return (
    <>
      <header className="ahead">
        <div>
          <p className="brand">Statistik</p>
          <h1>Overview</h1>
        </div>
      </header>

      <section className="stats">
        <div>
          <b>{data?.total_participants ?? 0}</b>
          <span>Total peserta</span>
        </div>
        <div>
          <b>{data?.total_completed ?? 0}</b>
          <span>Asesmen selesai</span>
        </div>
        <div>
          <b>{fmt(data?.avg_overall ?? 0)}</b>
          <span>Rata-rata Leadership Index</span>
        </div>
        <div>
          <b>{highest?.short_name || highest?.name || '—'}</b>
          <span>Dimensi tertinggi</span>
        </div>
        <div>
          <b>{lowest?.short_name || lowest?.name || '—'}</b>
          <span>Dimensi terendah</span>
        </div>
      </section>

      {!data?.total_completed && (
        <p className="alert info">
          Belum ada asesmen selesai. Statistik akan terisi setelah peserta mengirim jawaban.
        </p>
      )}

      <section className="davg card">
        <h2>Rata-rata per dimensi</h2>
        {dimensions.length ? (
          <ul>
            {dimensions.map((dimension) => (
              <li key={dimension.id}>
                <span>{dimension.name}</span>
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

      <div className="grid2">
        <section className="card">
          <h2>Distribusi kategori</h2>
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

        <section className="card">
          <h2>Tren peserta</h2>
          <p className="meta">Jumlah asesmen selesai per bulan (12 bulan terakhir).</p>
          {trend.length ? (
            <ul className="trend-list">
              {trend.map((item) => (
                <li key={item.period}>
                  <span>{item.period}</span>
                  <div className="track">
                    <span style={{ width: `${(Number(item.count) / maxTrend) * 100}%` }} />
                  </div>
                  <b>{item.count}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="meta">Belum ada data tren.</p>
          )}
        </section>
      </div>
    </>
  )
}
