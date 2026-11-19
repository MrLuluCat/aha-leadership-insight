import { useEffect, useState } from 'react'
import { CATS } from '../scoring'
import { fmt, dfmt, tfmt, dtfmt } from '../lib/format'
import { exportResultsListExcel } from '../lib/exportExcel'
import { fetchResultDetail, fetchResultsPage } from '../services/admin'
import CustomDatePicker from './CustomDatePicker'
import CustomSelect from './CustomSelect'
import ResultDetailModal from './ResultDetailModal'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const catTone = (name = '') => {
  const n = name.toLowerCase()
  if (n.includes('sangat kuat') || n === 'kuat') return 'strong'
  if (n.includes('cukup')) return 'mid'
  if (n.includes('tahap')) return 'dev'
  return 'low'
}

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

  // Detail dialog: Esc to close + lock background scroll
  useEffect(() => {
    if (!selectedId) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') closeDetail()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [selectedId])

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

  function resetFilters() {
    setSearch('')
    setDebounced('')
    setCategory('')
    setFrom('')
    setTo('')
  }

  async function fetchAllFilteredRows() {
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
    return allRows
  }

  async function exportCsv() {
    setExporting(true)
    setError('')
    try {
      const allRows = await fetchAllFilteredRows()

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
        dtfmt(row.assessment_date),
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

  async function exportExcel() {
    setExporting(true)
    setError('')
    try {
      const allRows = await fetchAllFilteredRows()
      exportResultsListExcel(allRows)
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
  const hasFilters = Boolean(search || category || from || to)

  const sortAria = (key) =>
    sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'

  const sortTh = (k, label, className = '') => (
    <th className={className} aria-sort={sortAria(k)}>
      <button type="button" className="rs-sort" onClick={() => sortBy(k)}>
        <span>{label}</span>
        <span className={'rs-sort-icon' + (sort === k ? ' on' : '')} aria-hidden="true">
          {sort === k ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )

  return (
    <>
      <header className="rs-head">
        <div>
          <h1>Hasil peserta</h1>
          <p className="rs-sub">
            Pantau seluruh hasil asesmen kepemimpinan, buka detail per peserta, atau ekspor ke CSV.
          </p>
        </div>
        <div className="rs-head-stat" aria-live="polite">
          <b>{total}</b>
          <span>hasil asesmen</span>
        </div>
      </header>

      {error && <p className="alert">{error}</p>}

      <section className="rs-card" aria-label="Daftar hasil peserta">
        {/* Toolbar */}
        <div className="rs-toolbar">
          <div className="rs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              aria-label="Cari nama atau email peserta"
              placeholder="Cari nama atau email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <CustomSelect
            ariaLabel="Filter kategori"
            value={category}
            onChange={(val) => setCategory(val)}
            options={[
              { value: '', label: 'Semua kategori' },
              ...CATS.map((cat) => ({ value: cat.name, label: cat.name })),
            ]}
          />

          <div className="rs-dates">
            <CustomDatePicker
              value={from}
              onChange={(val) => setFrom(val)}
              ariaLabel="Tanggal mulai"
              placeholder="Dari tanggal"
            />
            <span aria-hidden="true">–</span>
            <CustomDatePicker
              value={to}
              onChange={(val) => setTo(val)}
              ariaLabel="Tanggal akhir"
              placeholder="Sampai tanggal"
              alignRight
            />
          </div>

          {hasFilters && (
            <button type="button" className="rs-reset" onClick={resetFilters}>
              Reset
            </button>
          )}

          <div className="rs-export-group">
            <button
              type="button"
              className="rs-export rs-export-excel"
              onClick={exportExcel}
              disabled={exporting || !total}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 13l6 6M15 13l-6 6" />
              </svg>
              {exporting ? 'Menyiapkan…' : 'Ekspor Excel'}
            </button>
            <button
              type="button"
              className="rs-export"
              onClick={exportCsv}
              disabled={exporting || !total}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exporting ? 'Menyiapkan…' : 'Ekspor CSV'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                {sortTh('name', 'Peserta')}
                {sortTh('date', 'Tanggal asesmen')}
                {sortTh('overall', 'Leadership Index', 'rs-num')}
                <th>Kategori</th>
                <th>Versi</th>
                <th className="rs-act">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`sk-${idx}`} className="sk-tr" aria-hidden="true">
                    <td>
                      <div className="sk-cell-person">
                        <span className="sk-circle" />
                        <div className="sk-cell-lines">
                          <span className="sk-line sk-w-60" />
                          <span className="sk-line sk-w-40 sk-h-sm" />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="sk-cell-lines">
                        <span className="sk-line sk-w-60" />
                        <span className="sk-line sk-w-40 sk-h-sm" />
                      </div>
                    </td>
                    <td className="rs-num">
                      <span className="sk-line sk-w-40 sk-inline" />
                    </td>
                    <td>
                      <span className="sk-line sk-w-70" />
                    </td>
                    <td>
                      <span className="sk-line sk-w-30" />
                    </td>
                    <td className="rs-act">
                      <span className="sk-line sk-w-60 sk-inline" />
                    </td>
                  </tr>
                ))}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan="6" className="rs-empty">
                    {hasFilters
                      ? 'Tidak ada hasil yang cocok dengan filter.'
                      : 'Belum ada peserta yang menyelesaikan asesmen.'}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.result_id} className={row.result_id === selectedId ? 'on' : ''}>
                    <td data-label="Peserta">
                      <div className="rs-person">
                        <span className="rs-avatar" aria-hidden="true">
                          {(row.participant_name || '?').trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="rs-person-text">
                          <strong>{row.participant_name}</strong>
                          {row.participant_email && <small>{row.participant_email}</small>}
                        </span>
                      </div>
                    </td>
                    <td data-label="Tanggal">
                      <div className="rs-datetime">
                        <span className="rs-date-main">{dfmt(row.assessment_date)}</span>
                        {tfmt(row.assessment_date) && (
                          <span className="rs-time-sub">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {tfmt(row.assessment_date)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Index" className="rs-num">
                      <span className="rs-score">{fmt(row.overall_score)}</span>
                    </td>
                    <td data-label="Kategori">
                      <span className={'rs-cat rs-cat-' + catTone(row.category)}>
                        {row.category}
                      </span>
                    </td>
                    <td data-label="Versi">
                      <span className="rs-ver">v{row.version_number}</span>
                    </td>
                    <td data-label="" className="rs-act">
                      <button type="button" className="rs-view" onClick={() => openDetail(row)}>
                        Lihat detail
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="rs-footer">
          <div className="rs-size">
            <span>Tampilkan</span>
            <CustomSelect
              className="cs-compact"
              ariaLabel="Jumlah entri per halaman"
              value={pageSize}
              onChange={(val) => setPageSize(Number(val))}
              options={PAGE_SIZE_OPTIONS.map((opt) => ({ value: opt, label: String(opt) }))}
            />
            <span>entri</span>
          </div>

          <span className="rs-info">
            {fromRecord}–{toRecord} dari {total}
          </span>

          <nav className="rs-pager" aria-label="Paginasi hasil">
            <button
              type="button"
              className="rs-pg"
              disabled={page === 0}
              onClick={() => setPage(0)}
              aria-label="Halaman pertama"
            >
              «
            </button>
            <button
              type="button"
              className="rs-pg"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              aria-label="Halaman sebelumnya"
            >
              ‹
            </button>
            <span className="rs-pg-now">
              {page + 1} / {pages}
            </span>
            <button
              type="button"
              className="rs-pg"
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
              aria-label="Halaman berikutnya"
            >
              ›
            </button>
            <button
              type="button"
              className="rs-pg"
              disabled={page + 1 >= pages}
              onClick={() => setPage(pages - 1)}
              aria-label="Halaman terakhir"
            >
              »
            </button>
          </nav>
        </div>
      </section>

      {/* Detail dialog */}
      {selectedId && (
        <ResultDetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      )}
    </>
  )
}
