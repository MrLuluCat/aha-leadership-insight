import { useEffect, useMemo, useState } from 'react'
import { dtfmt, fmt } from '../lib/format'
import { fetchVersions, publishAssessment, saveDraft } from '../services/admin'
import CustomSelect from './CustomSelect'

const PAGE_SIZES = [10, 25, 50]

export default function Versions() {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('version_number')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setVersions(await fetchVersions())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSaveDraft() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const draft = await saveDraft()
      setNotice(`Draft versi ${draft.version_number} tersimpan dari konfigurasi aktif.`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (
      !window.confirm(
        'Publikasikan draft sebagai versi asesmen baru? Sesi baru akan memakai versi ini dan hasil lama tidak berubah.'
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const published = await publishAssessment()
      setNotice(`Versi ${published.version_number} dipublikasikan.`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const enriched = useMemo(() => {
    return versions.map((version) => {
      const snapshot = version.configuration_snapshot ?? {}
      const dimensions = snapshot.dimensions ?? []
      const questions = snapshot.questions ?? []
      const totalWeight = dimensions.reduce(
        (sum, dimension) => sum + Number(dimension.weight || 0),
        0
      )
      return {
        ...version,
        dimensions,
        questions,
        dimCount: dimensions.length,
        qCount: questions.length,
        totalWeight,
      }
    })
  }, [versions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false
      if (q) {
        const hay = `v${v.version_number} ${statusLabel(v.status)} ${v.published_at ? dtfmt(v.published_at) : ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [enriched, search, statusFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'version_number') cmp = a.version_number - b.version_number
      else if (sortKey === 'status') cmp = (a.status || '').localeCompare(b.status || '')
      else if (sortKey === 'published_at') {
        cmp = new Date(a.published_at || 0).getTime() - new Date(b.published_at || 0).getTime()
      } else if (sortKey === 'dimCount') cmp = a.dimCount - b.dimCount
      else if (sortKey === 'qCount') cmp = a.qCount - b.qCount
      else if (sortKey === 'totalWeight') cmp = a.totalWeight - b.totalWeight
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const paged = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
  const fromRecord = sorted.length === 0 ? 0 : safePage * pageSize + 1
  const toRecord = Math.min((safePage + 1) * pageSize, sorted.length)
  const hasFilters = Boolean(search || statusFilter !== 'all')

  const sortAria = (key) =>
    sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'

  const sortTh = (k, label, className = '') => (
    <th className={className} aria-sort={sortAria(k)}>
      <button type="button" className="rs-sort" onClick={() => handleSort(k)}>
        <span>{label}</span>
        <span className={'rs-sort-icon' + (sortKey === k ? ' on' : '')} aria-hidden="true">
          {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )

  if (loading) return <p className="meta">Memuat versi asesmen…</p>

  return (
    <>
      <header className="rs-head">
        <div>
          <h1>Versi asesmen</h1>
          <p className="rs-sub">
            Setiap publikasi menghasilkan snapshot konfigurasi baru yang bersifat read-only agar
            histori hasil asesmen lama tetap konsisten.
          </p>
        </div>
        <div className="dim-top-actions">
          <button type="button" className="dim-btn-outline" onClick={handleSaveDraft} disabled={busy}>
            Simpan draf
          </button>
          <button type="button" className="dim-btn-primary" onClick={handlePublish} disabled={busy}>
            Publikasikan draf
          </button>
        </div>
      </header>

      {error && <p className="alert">{error}</p>}
      {notice && <p className="alert success">{notice}</p>}

      <section className="rs-card" aria-label="Daftar versi asesmen">
        <div className="rs-toolbar">
          <div className="rs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Cari versi atau tanggal…"
              aria-label="Cari versi asesmen"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
            />
          </div>

          <CustomSelect
            ariaLabel="Filter status versi"
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val)
              setPage(0)
            }}
            options={[
              { value: 'all', label: 'Semua status' },
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
              { value: 'archived', label: 'Archived' },
            ]}
          />

          {hasFilters && (
            <button
              type="button"
              className="rs-reset"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setPage(0)
              }}
            >
              Reset
            </button>
          )}
        </div>

        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                {sortTh('version_number', 'Versi')}
                {sortTh('status', 'Status')}
                {sortTh('published_at', 'Dipublikasikan')}
                {sortTh('dimCount', 'Dimensi', 'rs-num')}
                {sortTh('qCount', 'Pertanyaan', 'rs-num')}
                {sortTh('totalWeight', 'Total bobot', 'rs-num')}
                <th className="rs-act">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((version) => (
                <tr key={version.id} className={preview === version.id ? 'on' : ''}>
                  <td data-label="Versi">
                    <span className="rs-ver">v{version.version_number}</span>
                  </td>
                  <td data-label="Status">
                    <span className={'rs-cat ' + statusTone(version.status)}>
                      {statusLabel(version.status)}
                    </span>
                  </td>
                  <td data-label="Dipublikasikan">
                    {version.published_at ? dtfmt(version.published_at) : '—'}
                  </td>
                  <td data-label="Dimensi" className="rs-num">
                    {version.dimCount}
                  </td>
                  <td data-label="Pertanyaan" className="rs-num">
                    {version.qCount}
                  </td>
                  <td data-label="Total bobot" className="rs-num">
                    <strong>{fmt(version.totalWeight)}%</strong>
                  </td>
                  <td data-label="" className="rs-act">
                    <button
                      type="button"
                      className="rs-view"
                      onClick={() => setPreview(preview === version.id ? null : version.id)}
                    >
                      {preview === version.id ? 'Tutup' : 'Preview'}
                    </button>
                  </td>
                </tr>
              ))}
              {!paged.length && (
                <tr>
                  <td colSpan="7" className="rs-empty">
                    {hasFilters
                      ? 'Tidak ada versi yang cocok dengan filter.'
                      : 'Belum ada versi asesmen. Simpan draf untuk membuat versi pertama.'}
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
              ariaLabel="Jumlah entri per halaman"
              value={pageSize}
              onChange={(val) => {
                setPageSize(Number(val))
                setPage(0)
              }}
              options={PAGE_SIZES.map((s) => ({ value: s, label: String(s) }))}
            />
            <span>entri</span>
          </div>

          <span className="rs-info">
            {fromRecord}–{toRecord} dari {sorted.length}
          </span>

          <nav className="rs-pager" aria-label="Paginasi versi">
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
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Halaman berikutnya"
            >
              ›
            </button>
            <button
              type="button"
              className="rs-pg"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
              aria-label="Halaman terakhir"
            >
              »
            </button>
          </nav>
        </div>
      </section>

      {enriched
        .filter((version) => version.id === preview)
        .map((version) => {
          const snapshot = version.configuration_snapshot ?? {}
          return (
            <section className="rs-card version-preview" key={version.id}>
              <div className="dim-dt-head">
                <div>
                  <h2>Preview versi {version.version_number}</h2>
                  <p className="rs-sub">
                    Dibuat {dtfmt(version.created_at)}
                    {version.published_at ? ` · Dipublikasikan ${dtfmt(version.published_at)}` : ''}
                  </p>
                </div>
                <button type="button" className="rs-view" onClick={() => setPreview(null)}>
                  Tutup preview
                </button>
              </div>
              <div className="rs-table-wrap">
                <table className="rs-table">
                  <thead>
                    <tr>
                      <th>Dimensi</th>
                      <th className="rs-num">Bobot</th>
                      <th className="rs-num">Pertanyaan aktif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {version.dimensions.map((dimension) => (
                      <tr key={dimension.id}>
                        <td data-label="Dimensi">
                          <strong>{dimension.name}</strong>
                        </td>
                        <td data-label="Bobot" className="rs-num">
                          {fmt(dimension.weight)}%
                        </td>
                        <td data-label="Pertanyaan aktif" className="rs-num">
                          {
                            version.questions.filter(
                              (question) => question.dimension_id === dimension.id
                            ).length
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="rs-answers" style={{ margin: '16px 20px 20px' }}>
                <summary>Snapshot konfigurasi (JSON)</summary>
                <pre className="json" style={{ margin: 0, borderRadius: 0 }}>
                  {JSON.stringify(snapshot, null, 2)}
                </pre>
              </details>
            </section>
          )
        })}
    </>
  )
}

function statusLabel(status) {
  if (status === 'published') return 'Published'
  if (status === 'archived') return 'Archived'
  return 'Draft'
}

function statusTone(status) {
  if (status === 'published') return 'rs-cat-strong'
  if (status === 'archived') return 'rs-cat-mid'
  return 'rs-cat-dev'
}
