import { useEffect, useState } from 'react'
import { CATS, SCALE } from '../scoring'
import { fmt, dfmt } from '../lib/format'
import { fetchResultDetail, fetchResultsPage } from '../services/admin'
import Report from '../Report'
import Icon from './icons'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function Results() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState('date')
  const [dir, setDir] = useState('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState({ total: 0, rows: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [category, from, to, pageSize])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')
    fetchResultsPage({
      search: debounced,
      category,
      from,
      to,
      sort,
      dir,
      limit: pageSize,
      offset: page * pageSize,
    })
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
  }, [debounced, category, from, to, sort, dir, page, pageSize])

  async function openDetail(row) {
    setSelectedId(row.result_id)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const result = await fetchResultDetail(row.result_id)
      setDetail(result)
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setSelectedId(null)
    setDetail(null)
    setDetailError('')
  }

  function sortBy(key) {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setSort(key)
      setDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  async function exportCsv() {
    setExporting(true)
    setError('')
    try {
      const allRows = []
      const chunk = 500
      let offset = 0
      let totalRows = Infinity

      while (offset < totalRows) {
        const chunkData = await fetchResultsPage({
          search: debounced,
          category,
          from,
          to,
          sort,
          dir,
          limit: chunk,
          offset,
        })
        const rowsChunk = chunkData.rows ?? []
        allRows.push(...rowsChunk)
        totalRows = Number(chunkData.total ?? 0)
        offset += chunk
        if (!rowsChunk.length) break
      }

      const head = [
        'Participant',
        'Email',
        'Assessment Date',
        'Leadership Index',
        'Category',
        'Version',
      ]
      const body = allRows.map((row) => [
        row.participant_name,
        row.participant_email ?? '',
        dfmt(row.assessment_date),
        fmt(row.overall_score),
        row.category,
        row.version_number,
      ])
      const csv = [head, ...body]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'hasil-aha-leadership.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const rows = data?.rows ?? []
  const total = Number(data?.total ?? 0)
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const fromRecord = total === 0 ? 0 : page * pageSize + 1
  const toRecord = Math.min((page + 1) * pageSize, total)

  const renderSortIndicator = (key) => {
    if (sort !== key) return <span className="dt-sort-icon neutral">↕</span>
    return <span className="dt-sort-icon active">{dir === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <>
      <header className="ahead">
        <div>
          <h1>Hasil peserta</h1>
        </div>
        <p className="meta">{total} hasil asesmen</p>
      </header>

      {/* DataTables Controls Header */}
      <div className="dt-controls-top">
        <div className="dt-length">
          <label>
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Jumlah entri per halaman"
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>entri</span>
          </label>
        </div>

        <div className="dt-filters">
          <div className="dt-search-box">
            <input
              type="search"
              aria-label="Cari nama atau email peserta"
              placeholder="Cari peserta…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            aria-label="Filter kategori"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Semua kategori</option>
            {CATS.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
          <div className="dt-date-range">
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="Tanggal mulai"
              title="Tanggal mulai"
            />
            <span className="dt-date-sep">s/d</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-label="Tanggal akhir"
              title="Tanggal akhir"
            />
          </div>
          <button className="btn sm dt-export-btn" onClick={exportCsv} disabled={exporting || !total}>
            {exporting ? 'Menyiapkan…' : 'Ekspor CSV'}
          </button>
        </div>
      </div>

      {error && <p className="alert">{error}</p>}

      <div className="tablewrap card dt-tablewrap">
        <table className="data stack dt-table">
          <thead>
            <tr>
              <th className="dt-th-sortable" onClick={() => sortBy('name')}>
                <div className="dt-th-content">
                  <span>Participant</span>
                  {renderSortIndicator('name')}
                </div>
              </th>
              <th className="dt-th-sortable" onClick={() => sortBy('date')}>
                <div className="dt-th-content">
                  <span>Assessment Date</span>
                  {renderSortIndicator('date')}
                </div>
              </th>
              <th className="dt-th-sortable" onClick={() => sortBy('overall')}>
                <div className="dt-th-content">
                  <span>Leadership Index</span>
                  {renderSortIndicator('overall')}
                </div>
              </th>
              <th>Category</th>
              <th>Version</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="dt-empty">
                  Memuat data peserta…
                </td>
              </tr>
            )}
            {!loading && !rows.length && (
              <tr>
                <td colSpan="6" className="dt-empty">
                  Tidak ada data yang cocok dengan kriteria pencarian.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.result_id} className={row.result_id === selectedId ? 'on' : ''}>
                  <td data-label="Peserta">
                    <strong className="dt-primary-text">{row.participant_name}</strong>
                    {row.participant_email && <span className="sub">{row.participant_email}</span>}
                  </td>
                  <td data-label="Tanggal">{dfmt(row.assessment_date)}</td>
                  <td data-label="Leadership Index">
                    <span className="dt-score-pill">{fmt(row.overall_score)}</span>
                  </td>
                  <td data-label="Kategori">
                    <span className="badge">{row.category}</span>
                  </td>
                  <td data-label="Versi">
                    <span className="badge off">v{row.version_number}</span>
                  </td>
                  <td data-label="Aksi">
                    <button className="dt-btn-action" onClick={() => openDetail(row)}>
                      Lihat
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* DataTables Info & Pagination Footer */}
      <div className="dt-controls-bottom">
        <div className="dt-info">
          Menampilkan {fromRecord} sampai {toRecord} dari {total} entri
        </div>
        <div className="dt-pagination">
          <button
            type="button"
            className="dt-page-btn"
            disabled={page === 0}
            onClick={() => setPage(0)}
            title="Halaman pertama"
          >
            «
          </button>
          <button
            type="button"
            className="dt-page-btn"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Sebelumnya
          </button>
          <span className="dt-page-indicator">
            {page + 1} / {pages}
          </span>
          <button
            type="button"
            className="dt-page-btn"
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
          >
            Berikutnya
          </button>
          <button
            type="button"
            className="dt-page-btn"
            disabled={page + 1 >= pages}
            onClick={() => setPage(pages - 1)}
            title="Halaman terakhir"
          >
            »
          </button>
        </div>
      </div>

      {selectedId && (
        <section className="detail-panel card">
          <div className="detail-meta no-print">
            <h2>Detail hasil</h2>
            <button className="link" onClick={closeDetail}>
              Tutup
            </button>
          </div>
          {detailLoading && <p className="meta">Memuat detail peserta…</p>}
          {detailError && <p className="alert">{detailError}</p>}
          {detail && (
            <>
              <p className="meta">
                {detail.participant.email || 'Tanpa email'} · Versi konfigurasi{' '}
                {detail.version.version_number}
                {detail.version.published_at
                  ? ` (dipublikasikan ${dfmt(detail.version.published_at)})`
                  : ''}
              </p>
              <Report result={detail.result} compact />
              <details className="answers">
                <summary>Detail jawaban peserta ({detail.responses.length})</summary>
                <div className="tablewrap">
                  <table className="data stack">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Pertanyaan</th>
                        <th>Dimensi</th>
                        <th>Jawaban</th>
                        <th>Skor butir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.responses.map((response, i) => {
                        const dim = (detail.result.config?.dimensions ?? []).find(
                          (item) => item.id === response.question.dimension_id
                        )
                        return (
                          <tr key={response.question_id}>
                            <td data-label="No.">{i + 1}</td>
                            <td data-label="Pertanyaan">
                              {response.question.text}
                              {response.question.reverse_scoring && (
                                <small className="tag">reverse</small>
                              )}
                            </td>
                            <td data-label="Dimensi">{dim?.name ?? '—'}</td>
                            <td data-label="Jawaban">
                              {response.answer} · {SCALE[response.answer - 1]}
                            </td>
                            <td data-label="Skor butir">{fmt(((response.corrected_answer - 1) / 4) * 100)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </section>
      )}
    </>
  )
}
