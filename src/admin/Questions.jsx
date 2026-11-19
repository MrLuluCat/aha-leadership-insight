import { useEffect, useMemo, useState } from 'react'
import { fmt } from '../lib/format'
import CustomSelect from './CustomSelect'
import {
  createQuestion,
  deleteQuestion,
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

export default function Questions() {
  const [dimensions, setDimensions] = useState([])
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  // DataTable state
  const [search, setSearch] = useState('')
  const [dimFilter, setDimFilter] = useState('all')
  const [statusFilter, setStatus] = useState('all')
  const [sortKey, setSortKey] = useState('sort_order')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

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

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!editing) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) closeModal()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [editing, busy])

  const dimName = (id) => dimensions.find((d) => d.id === id)?.name ?? '—'
  const nextOrder = questions.length
    ? Math.max(...questions.map((q) => q.sort_order)) + 1
    : 1

  function startNew() {
    setEditing(emptyForm(dimensions, nextOrder))
    setFormError('')
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
    setFormError('')
    setNotice('')
    setError('')
  }

  function closeModal() {
    if (busy) return
    setEditing(null)
    setFormError('')
  }

  function patch(field, value) {
    setFormError('')
    setEditing((cur) => ({ ...cur, [field]: value }))
  }

  async function save(e) {
    e.preventDefault()
    if (!editing) return

    const rawText = editing.question_text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
    const weight = Number(editing.weight)
    const sortOrder = Number(editing.sort_order)
    const validDim = dimensions.some((d) => String(d.id) === String(editing.dimension_id))

    if (!rawText) return setFormError('Teks pertanyaan wajib diisi.')
    if (rawText.length < 5) return setFormError('Teks pertanyaan minimal 5 karakter.')
    if (rawText.length > 1000) return setFormError('Teks pertanyaan maksimal 1000 karakter.')
    if (/<script|javascript:/i.test(rawText)) {
      return setFormError('Teks pertanyaan mengandung karakter atau pola yang tidak diizinkan.')
    }
    if (!validDim) return setFormError('Pilih dimensi yang valid untuk pertanyaan ini.')
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
      return setFormError('Bobot pertanyaan harus antara 0,01 dan 100.')
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
      return setFormError('Urutan harus berupa bilangan bulat antara 0 dan 9999.')
    }

    setBusy(true)
    setFormError('')
    setError('')
    setNotice('')
    try {
      const payload = {
        dimension_id: editing.dimension_id,
        question_text: rawText,
        weight,
        reverse_scoring: Boolean(editing.reverse_scoring),
        sort_order: sortOrder,
        is_active: Boolean(editing.is_active),
      }
      if (editing.id) await updateQuestion(editing.id, payload)
      else await createQuestion(payload)
      setNotice(editing.id ? 'Pertanyaan diperbarui.' : 'Pertanyaan ditambahkan.')
      setEditing(null)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(q) {
    setError('')
    setNotice('')
    try {
      await updateQuestion(q.id, { is_active: !q.is_active })
      setNotice(
        q.is_active
          ? 'Pertanyaan dinonaktifkan. Histori hasil tetap tersimpan.'
          : 'Pertanyaan diaktifkan kembali.'
      )
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await deleteQuestion(deleting.id)
      setNotice('Pertanyaan berhasil dihapus.')
      setDeleting(null)
      await load()
    } catch (err) {
      const msg = err?.message || ''
      if (/foreign key|violates|23503/i.test(msg)) {
        setError('Pertanyaan sudah digunakan pada hasil asesmen sehingga tidak dapat dihapus permanen; gunakan tombol Nonaktifkan.')
      } else {
        setError(msg || 'Gagal menghapus pertanyaan.')
      }
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  function resetFilters() {
    setSearch('')
    setDimFilter('all')
    setStatus('all')
    setPage(0)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return questions.filter((item) => {
      if (statusFilter === 'active' && !item.is_active) return false
      if (statusFilter === 'inactive' && item.is_active) return false
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
      if (sortKey === 'dimension') {
        va = dimName(a.dimension_id)
        vb = dimName(b.dimension_id)
      }
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : Number(va) - Number(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir, dimensions])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const paged = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
  const fromRecord = sorted.length === 0 ? 0 : safePage * pageSize + 1
  const toRecord = Math.min((safePage + 1) * pageSize, sorted.length)
  const hasFilters = Boolean(search || dimFilter !== 'all' || statusFilter !== 'all')
  const activeCount = questions.filter((q) => q.is_active).length

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

  if (loading) return <p className="meta">Memuat pertanyaan…</p>

  return (
    <>
      <header className="rs-head">
        <div>
          <h1>Pertanyaan</h1>
          <p className="rs-sub">
            {questions.length} pertanyaan ({activeCount} aktif). Pertanyaan yang sudah digunakan
            pada hasil asesmen tidak dihapus permanen; gunakan status nonaktif.
          </p>
        </div>
        <button className="btn" onClick={startNew} disabled={!dimensions.length}>
          Tambah pertanyaan
        </button>
      </header>

      {error && <p className="alert">{error}</p>}
      {notice && <p className="alert success">{notice}</p>}

      {editing && (
        <div
          className="qm-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <form
            className="qm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qm-title"
            onSubmit={save}
          >
            <div className="qm-head">
              <div className="qm-head-left">
                <span className="qm-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                  </svg>
                </span>
                <div>
                  <h2 id="qm-title">{editing.id ? 'Edit Pertanyaan' : 'Tambah Pertanyaan'}</h2>
                  <p>
                    {editing.id
                      ? 'Perbarui informasi pertanyaan pada dimensi terkait.'
                      : 'Lengkapi informasi pertanyaan yang akan ditambahkan.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="qm-close"
                onClick={closeModal}
                disabled={busy}
                aria-label="Tutup modal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="qm-body">
              {formError && <p className="alert qm-alert">{formError}</p>}

              <div className="qm-field">
                <label htmlFor="qm-text">
                  Pertanyaan <span className="qm-req">*</span>
                </label>
                <div className="qm-textarea-wrap">
                  <textarea
                    id="qm-text"
                    rows="4"
                    maxLength={1000}
                    autoFocus
                    placeholder="Masukkan pertanyaan..."
                    value={editing.question_text}
                    onChange={(e) => patch('question_text', e.target.value)}
                    required
                  />
                  <span className="qm-counter">{editing.question_text.length} / 1000</span>
                </div>
              </div>

              <div className="qm-grid">
                <div className="qm-field">
                  <label htmlFor="qm-dim">
                    Dimensi <span className="qm-req">*</span>
                  </label>
                  <CustomSelect
                    id="qm-dim"
                    ariaLabel="Dimensi"
                    value={editing.dimension_id}
                    onChange={(val) => patch('dimension_id', val)}
                    options={dimensions.map((d) => ({ value: d.id, label: d.name }))}
                  />
                </div>

                <div className="qm-field">
                  <label htmlFor="qm-weight">
                    Bobot pertanyaan <span className="qm-req">*</span>
                  </label>
                  <input
                    id="qm-weight"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={editing.weight}
                    onChange={(e) => patch('weight', e.target.value)}
                    required
                  />
                </div>

                <div className="qm-field">
                  <label htmlFor="qm-order">
                    Urutan <span className="qm-req">*</span>
                  </label>
                  <input
                    id="qm-order"
                    type="number"
                    min="0"
                    max="9999"
                    step="1"
                    value={editing.sort_order}
                    onChange={(e) => patch('sort_order', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="qm-checks">
                <label className="qm-check">
                  <input
                    type="checkbox"
                    checked={editing.is_active}
                    onChange={(e) => patch('is_active', e.target.checked)}
                  />
                  <span>Aktif</span>
                  <span
                    className="rp-info-pill"
                    title="Pertanyaan nonaktif tidak akan muncul pada sesi asesmen baru."
                    aria-label="Info status aktif"
                  >
                    i
                  </span>
                </label>

                <label className="qm-check">
                  <input
                    type="checkbox"
                    checked={editing.reverse_scoring}
                    onChange={(e) => patch('reverse_scoring', e.target.checked)}
                  />
                  <span>Reverse scoring (6 − jawaban)</span>
                </label>
              </div>
            </div>

            <div className="qm-foot">
              <button type="button" className="qm-btn-cancel" onClick={closeModal} disabled={busy}>
                Batal
              </button>
              <button type="submit" className="qm-btn-save" disabled={busy}>
                {busy ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="rs-card" aria-label="Daftar pertanyaan">
        <div className="rs-toolbar">
          <div className="rs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Cari pertanyaan atau dimensi…"
              aria-label="Cari pertanyaan atau dimensi"
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

          <CustomSelect
            ariaLabel="Filter status"
            value={statusFilter}
            onChange={(val) => {
              setStatus(val)
              setPage(0)
            }}
            options={[
              { value: 'all', label: 'Semua status' },
              { value: 'active', label: 'Aktif' },
              { value: 'inactive', label: 'Nonaktif' },
            ]}
          />

          {hasFilters && (
            <button type="button" className="rs-reset" onClick={resetFilters}>
              Reset
            </button>
          )}
        </div>

        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                {sortTh('sort_order', 'Urutan')}
                {sortTh('question_text', 'Pertanyaan')}
                {sortTh('dimension', 'Dimensi')}
                {sortTh('weight', 'Bobot', 'rs-num')}
                {sortTh('reverse_scoring', 'Reverse')}
                {sortTh('is_active', 'Status')}
                <th className="rs-act rs-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((q) => (
                <tr key={q.id} className={q.is_active ? '' : 'muted'}>
                  <td data-label="Urutan">
                    <span className="rs-ver">#{q.sort_order}</span>
                  </td>
                  <td data-label="Pertanyaan">{q.question_text}</td>
                  <td data-label="Dimensi">{dimName(q.dimension_id)}</td>
                  <td data-label="Bobot" className="rs-num">
                    <strong>{fmt(q.weight)}</strong>
                  </td>
                  <td data-label="Reverse">{q.reverse_scoring ? 'Ya' : '—'}</td>
                  <td data-label="Status">
                    <span className={'rs-cat ' + (q.is_active ? 'rs-cat-strong' : 'rs-cat-low')}>
                      {q.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td data-label="Aksi" className="rs-act">
                    <div className="row-actions row-actions-icons">
                      <button
                        type="button"
                        className="rs-icon-btn"
                        onClick={() => startEdit(q)}
                        title="Edit pertanyaan"
                        aria-label={`Edit pertanyaan #${q.sort_order}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={'rs-icon-btn' + (q.is_active ? ' is-power-on' : ' is-power-off')}
                        onClick={() => toggleActive(q)}
                        title={q.is_active ? 'Nonaktifkan pertanyaan' : 'Aktifkan pertanyaan'}
                        aria-label={`${q.is_active ? 'Nonaktifkan' : 'Aktifkan'} pertanyaan #${q.sort_order}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                          <line x1="12" y1="2" x2="12" y2="12" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="rs-icon-btn rs-icon-btn-danger"
                        onClick={() => setDeleting(q)}
                        title="Hapus pertanyaan"
                        aria-label={`Hapus pertanyaan #${q.sort_order}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!paged.length && (
                <tr>
                  <td colSpan="7" className="rs-empty">
                    {hasFilters
                      ? 'Tidak ada pertanyaan yang cocok dengan filter.'
                      : 'Belum ada pertanyaan.'}
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

          <nav className="rs-pager" aria-label="Paginasi pertanyaan">
            <button
              type="button"
              className="rs-pg"
              onClick={() => setPage(0)}
              disabled={safePage === 0}
              aria-label="Halaman pertama"
            >
              «
            </button>
            <button
              type="button"
              className="rs-pg"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
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
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Halaman berikutnya"
            >
              ›
            </button>
            <button
              type="button"
              className="rs-pg"
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              aria-label="Halaman terakhir"
            >
              »
            </button>
          </nav>
        </div>
      </section>
      {deleting && (
        <div
          className="qm-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setDeleting(null)
          }}
        >
          <div className="qm-modal" role="dialog" aria-modal="true" aria-labelledby="qm-del-title">
            <div className="qm-head">
              <div className="qm-head-left">
                <span className="qm-icon qm-icon-danger" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </span>
                <div>
                  <h2 id="qm-del-title">Hapus Pertanyaan?</h2>
                  <p>Tindakan ini tidak dapat dibatalkan.</p>
                </div>
              </div>
              <button
                type="button"
                className="qm-close"
                onClick={() => setDeleting(null)}
                disabled={busy}
                aria-label="Tutup"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="qm-body">
              <p className="rp-confirm-text">
                Anda yakin ingin menghapus pertanyaan <strong>"{deleting.question_text}"</strong>?
              </p>
            </div>
            <div className="qm-foot">
              <button
                type="button"
                className="qm-btn-cancel"
                onClick={() => setDeleting(null)}
                disabled={busy}
              >
                Batal
              </button>
              <button
                type="button"
                className="qm-btn-danger"
                onClick={confirmDelete}
                disabled={busy}
              >
                {busy ? 'Menghapus…' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
