import { useEffect, useMemo, useState } from 'react'
import { fmt } from '../lib/format'
import {
  createQuestion,
  fetchDimensions,
  fetchQuestions,
  updateQuestion,
} from '../services/admin'

const emptyForm = (dimensions, nextOrder) => ({
  id: null,
  dimension_id: dimensions[0]?.id ?? '',
  question_text: '',
  weight: 1,
  reverse_scoring: false,
  sort_order: nextOrder,
  is_active: true,
})

const PAGE_SIZES = [10, 25, 50, 100]

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col)
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginLeft: 4 }}>
        <path d="M12 5v14M5 12l7-7 7 7" />
      </svg>
    )
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginLeft: 4, transform: sortDir === 'desc' ? 'rotate(180deg)' : 'none', color: '#2563eb' }}
    >
      <path d="M12 5v14M5 12l7-7 7 7" />
    </svg>
  )
}

export default function Questions() {
  const [dimensions, setDimensions] = useState([])
  const [questions, setQuestions]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [notice, setNotice]         = useState('')
  const [editing, setEditing]       = useState(null)
  const [busy, setBusy]             = useState(false)

  // DataTable state
  const [search, setSearch]         = useState('')
  const [dimFilter, setDimFilter]   = useState('all')
  const [statusFilter, setStatus]   = useState('all')
  const [sortKey, setSortKey]       = useState('sort_order')
  const [sortDir, setSortDir]       = useState('asc')
  const [page, setPage]             = useState(0)
  const [pageSize, setPageSize]     = useState(10)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [dims, items] = await Promise.all([fetchDimensions(), fetchQuestions()])
      setDimensions(dims)
      setQuestions(items)
      setPage(0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const dimName = (id) => dimensions.find((d) => d.id === id)?.name ?? '—'
  const nextOrder = questions.length
    ? Math.max(...questions.map((q) => q.sort_order)) + 1
    : 1

  function startNew() {
    setEditing(emptyForm(dimensions, nextOrder))
    setNotice('')
    setError('')
  }

  function startEdit(q) {
    setEditing({
      id: q.id,
      dimension_id: q.dimension_id,
      question_text: q.question_text,
      weight: Number(q.weight),
      reverse_scoring: q.reverse_scoring,
      sort_order: q.sort_order,
      is_active: q.is_active,
    })
    setNotice('')
    setError('')
  }

  function patch(field, value) {
    setEditing((cur) => ({ ...cur, [field]: value }))
  }

  async function save(e) {
    e.preventDefault()
    if (!editing) return
    const text   = editing.question_text.trim()
    const weight = Number(editing.weight)
    if (!text) return setError('Teks pertanyaan wajib diisi.')
    if (!editing.dimension_id) return setError('Pilih dimensi untuk pertanyaan ini.')
    if (!Number.isFinite(weight) || weight <= 0)
      return setError('Bobot pertanyaan harus lebih besar dari 0.')

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        dimension_id: editing.dimension_id,
        question_text: text,
        weight,
        reverse_scoring: Boolean(editing.reverse_scoring),
        sort_order: Number(editing.sort_order) || 0,
        is_active: Boolean(editing.is_active),
      }
      if (editing.id) await updateQuestion(editing.id, payload)
      else await createQuestion(payload)
      setNotice(editing.id ? 'Pertanyaan diperbarui.' : 'Pertanyaan ditambahkan.')
      setEditing(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(q) {
    setError('')
    setNotice('')
    try {
      await updateQuestion(q.id, { is_active: !q.is_active })
      setNotice(q.is_active
        ? 'Pertanyaan dinonaktifkan. Histori hasil tetap tersimpan.'
        : 'Pertanyaan diaktifkan kembali.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  // ── DataTable logic ──────────────────────────────────────────
  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return questions.filter((item) => {
      if (statusFilter === 'active'   && !item.is_active) return false
      if (statusFilter === 'inactive' &&  item.is_active) return false
      if (dimFilter !== 'all' && item.dimension_id !== dimFilter) return false
      if (q) {
        const hay = `${item.question_text} ${dimName(item.dimension_id)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [questions, search, statusFilter, dimFilter, dimensions])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortKey] ?? ''
      let vb = b[sortKey] ?? ''
      if (sortKey === 'dimension') { va = dimName(a.dimension_id); vb = dimName(b.dimension_id) }
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages - 1)
  const paged      = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const cols = [
    { key: 'sort_order', label: 'Urutan', width: '72px' },
    { key: 'question_text', label: 'Pertanyaan' },
    { key: 'dimension', label: 'Dimensi', width: '150px' },
    { key: 'weight', label: 'Bobot', width: '72px' },
    { key: 'reverse_scoring', label: 'Reverse', width: '80px' },
    { key: 'is_active', label: 'Status', width: '90px' },
  ]

  if (loading) return <p className="meta">Memuat pertanyaan…</p>

  return (
    <>
      {/* ── Header ── */}
      <header className="ahead">
        <div>
          <h1>Pertanyaan</h1>
        </div>
        <button className="btn" onClick={startNew} disabled={!dimensions.length}>
          Tambah pertanyaan
        </button>
      </header>

      <p className="meta">
        {questions.length} pertanyaan · {questions.filter((q) => q.is_active).length} aktif.{' '}
        Pertanyaan yang sudah digunakan pada hasil asesmen tidak dihapus permanen; gunakan status
        nonaktif. Perubahan berlaku pada sesi baru setelah draft dipublikasikan dari tab Versi
        Asesmen.
      </p>

      {error  && <p className="alert">{error}</p>}
      {notice && <p className="alert success">{notice}</p>}

      {/* ── Inline edit/create form ── */}
      {editing && (
        <form className="card form-card" onSubmit={save}>
          <h2>{editing.id ? 'Edit pertanyaan' : 'Pertanyaan baru'}</h2>
          <label className="field">
            <span>Teks pertanyaan</span>
            <textarea
              rows="3"
              value={editing.question_text}
              onChange={(e) => patch('question_text', e.target.value)}
              required
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Dimensi</span>
              <select
                value={editing.dimension_id}
                onChange={(e) => patch('dimension_id', e.target.value)}
              >
                {dimensions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Bobot pertanyaan</span>
              <input
                type="number" min="0.01" step="0.01"
                value={editing.weight}
                onChange={(e) => patch('weight', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Urutan</span>
              <input
                type="number" step="1"
                value={editing.sort_order}
                onChange={(e) => patch('sort_order', e.target.value)}
              />
            </label>
          </div>
          <div className="checks">
            <label>
              <input
                type="checkbox"
                checked={editing.reverse_scoring}
                onChange={(e) => patch('reverse_scoring', e.target.checked)}
              />
              Reverse scoring (6 − jawaban)
            </label>
            <label>
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => patch('is_active', e.target.checked)}
              />
              Aktif
            </label>
          </div>
          <div className="actions">
            <button className="btn" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan pertanyaan'}
            </button>
            <button type="button" className="link" onClick={() => setEditing(null)}>
              Batal
            </button>
          </div>
        </form>
      )}

      {/* ── DataTable card ── */}
      <div className="dt-questions-card">
        {/* Controls top bar */}
        <div className="dt-card-header">
          <div className="dt-left-controls">
            <label className="dt-page-size-label">
              Tampilkan&nbsp;
              <select
                className="dt-page-size-sel"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              &nbsp;data
            </label>
          </div>

          <div className="dt-right-controls">
            {/* Dimension filter */}
            <select
              className="dt-filter-sel"
              value={dimFilter}
              aria-label="Filter dimensi"
              onChange={(e) => { setDimFilter(e.target.value); setPage(0) }}
            >
              <option value="all">Semua dimensi</option>
              {dimensions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              className="dt-filter-sel"
              value={statusFilter}
              aria-label="Filter status"
              onChange={(e) => { setStatus(e.target.value); setPage(0) }}
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>

            {/* Search */}
            <div className="dt-search-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dt-search-icon" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="dt-search-input"
                type="search"
                placeholder="Cari pertanyaan…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="dt-table-wrap">
          <table className="dt-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    style={{ width: c.width }}
                    onClick={() => handleSort(c.key)}
                    className="dt-th"
                  >
                    {c.label}
                    <SortIcon col={c.key} sortKey={sortKey} sortDir={sortDir} />
                  </th>
                ))}
                <th className="dt-th" style={{ width: '140px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((q) => (
                <tr key={q.id} className={q.is_active ? '' : 'muted'}>
                  <td>{q.sort_order}</td>
                  <td>{q.question_text}</td>
                  <td>{dimName(q.dimension_id)}</td>
                  <td>{fmt(q.weight)}</td>
                  <td>{q.reverse_scoring ? 'Ya' : '—'}</td>
                  <td>
                    <span className={'badge ' + (q.is_active ? 'ok' : 'off')}>
                      {q.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button className="thb" onClick={() => startEdit(q)}>Edit</button>
                    <button className="thb" onClick={() => toggleActive(q)}>
                      {q.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
              {!paged.length && (
                <tr>
                  <td colSpan="7" className="meta dt-empty">
                    Tidak ada data yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="dt-footer">
          <span className="dt-info">
            {sorted.length === 0
              ? 'Tidak ada data'
              : `Menampilkan ${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, sorted.length)} dari ${sorted.length} data`}
          </span>
          <div className="dt-pager">
            <button
              className="dt-pg-btn"
              onClick={() => setPage(0)}
              disabled={safePage === 0}
              aria-label="Halaman pertama"
            >«</button>
            <button
              className="dt-pg-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Halaman sebelumnya"
            >‹</button>

            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => Math.abs(i - safePage) <= 2)
              .map((i) => (
                <button
                  key={i}
                  className={'dt-pg-btn' + (i === safePage ? ' active' : '')}
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </button>
              ))}

            <button
              className="dt-pg-btn"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Halaman berikutnya"
            >›</button>
            <button
              className="dt-pg-btn"
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              aria-label="Halaman terakhir"
            >»</button>
          </div>
        </div>
      </div>
    </>
  )
}
