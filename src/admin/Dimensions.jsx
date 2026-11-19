import { useEffect, useState } from 'react'
import { fmt } from '../lib/format'
import {
  fetchDimensions,
  fetchQuestions,
  publishAssessment,
  saveConfiguration,
  saveDraft,
} from '../services/admin'

function DimensionIcon({ name }) {
  const lower = (name || '').toLowerCase()

  if (lower.includes('kesadaran')) {
    // 4 squares / grid icon
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      </svg>
    )
  }

  if (lower.includes('pengelolaan')) {
    // Heart outline icon
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    )
  }

  if (lower.includes('empati')) {
    // Users / people icon
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }

  if (lower.includes('harmoni')) {
    // Chat / relationship connection icon
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    )
  }

  if (lower.includes('kolaborasi')) {
    // Collaboration / layers icon
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    )
  }

  if (lower.includes('adaptasi') || lower.includes('adaptabilitas')) {
    // Refresh / cycle icon
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
      </svg>
    )
  }

  if (lower.includes('aksi')) {
    // Target / action icon
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    )
  }

  // Fallback icon
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  )
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function Dimensions() {
  const [dimensions, setDimensions] = useState([])
  const [questions, setQuestions] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)

  // DataTables State for Questions
  const [qSearch, setQSearch] = useState('')
  const [qDimFilter, setQDimFilter] = useState('all') // 'all' | dimensionId
  const [qStatusFilter, setQStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [qReverseFilter, setQReverseFilter] = useState('all') // 'all' | 'reverse' | 'normal'
  const [qSortKey, setQSortKey] = useState('sort_order')
  const [qSortDir, setQSortDir] = useState('asc')
  const [qPage, setQPage] = useState(0)
  const [qPageSize, setQPageSize] = useState(10)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [dims, items] = await Promise.all([fetchDimensions(), fetchQuestions()])
      const parsedDims = dims.map((dim) => ({ ...dim, weight: Number(dim.weight) }))
      setDimensions(parsedDims)
      setQuestions(items.map((question) => ({ ...question, weight: Number(question.weight) })))
      setDirty(false)
      if (parsedDims.length > 0 && !activeTabId) {
        setActiveTabId(parsedDims[0].id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function patchDimension(id, field, value) {
    setDimensions((current) =>
      current.map((dim) => (dim.id === id ? { ...dim, [field]: value } : dim))
    )
    setDirty(true)
    setNotice('')
  }

  function patchQuestion(id, field, value) {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, [field]: value } : question))
    )
    setDirty(true)
    setNotice('')
  }

  async function persist() {
    if (!dimensions.length) throw new Error('Tidak ada dimensi untuk disimpan.')

    for (const dim of dimensions) {
      if (!dim.name.trim()) throw new Error('Nama dimensi wajib diisi.')
      if (Number(dim.weight) < 0 || !Number.isFinite(Number(dim.weight))) {
        throw new Error(`Bobot dimensi "${dim.name}" tidak valid.`)
      }
    }
    for (const question of questions) {
      if (!(Number(question.weight) > 0)) {
        throw new Error('Bobot setiap pertanyaan harus lebih besar dari 0.')
      }
    }

    await saveConfiguration(
      dimensions.map((dim) => ({
        id: dim.id,
        name: dim.name.trim(),
        short_name: dim.short_name.trim(),
        description: dim.description ?? '',
        weight: Number(dim.weight),
        strength_guidance: dim.strength_guidance ?? '',
        development_guidance: dim.development_guidance ?? '',
        sort_order: Number(dim.sort_order) || 0,
        is_active: Boolean(dim.is_active),
      })),
      questions.map((question) => ({
        id: question.id,
        dimension_id: question.dimension_id,
        weight: Number(question.weight),
        reverse_scoring: Boolean(question.reverse_scoring),
        is_active: Boolean(question.is_active),
        sort_order: Number(question.sort_order) || 0,
      }))
    )

    setDirty(false)
  }

  async function handleSave() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await persist()
      setNotice('Perubahan konfigurasi tersimpan.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveDraft() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await persist()
      const draft = await saveDraft()
      setNotice(`Draft versi ${draft.version_number} berhasil disimpan.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (
      !window.confirm(
        'Publikasikan konfigurasi ini sebagai versi asesmen baru? Hasil asesmen sebelumnya tidak akan berubah.'
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await persist()
      const published = await publishAssessment()
      setNotice(
        `Versi ${published.version_number} berhasil dipublikasikan. Sesi baru akan menggunakan versi ini.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const activeDimensions = dimensions.filter((dim) => dim.is_active)
  const totalWeight = activeDimensions.reduce((sum, dim) => sum + Number(dim.weight || 0), 0)
  const weightValid = Math.abs(totalWeight - 100) <= 0.01
  const activeQuestionCount = questions.filter((question) => question.is_active).length

  const currentDimension =
    dimensions.find((dim) => dim.id === activeTabId) || dimensions[0] || null

  const dimQuestions = currentDimension
    ? questions.filter((question) => question.dimension_id === currentDimension.id)
    : []
  const activeDimQuestions = dimQuestions.filter((question) => question.is_active)

  // DataTables Sorting & Filtering Logic for Questions
  function handleSort(key) {
    if (qSortKey === key) {
      setQSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setQSortKey(key)
      setQSortDir('asc')
    }
    setQPage(0)
  }

  const renderSortIndicator = (key) => {
    if (qSortKey !== key) return <span className="dt-sort-icon neutral">↕</span>
    return <span className="dt-sort-icon active">{qSortDir === 'asc' ? '▲' : '▼'}</span>
  }

  function handleResetFilters() {
    setQSearch('')
    setQDimFilter('all')
    setQStatusFilter('all')
    setQReverseFilter('all')
    setQPage(0)
  }

  const filteredQuestions = questions.filter((q) => {
    // Dimension filter
    if (qDimFilter !== 'all' && q.dimension_id !== qDimFilter) {
      return false
    }
    // Status filter
    if (qStatusFilter === 'active' && !q.is_active) return false
    if (qStatusFilter === 'inactive' && q.is_active) return false
    // Reverse scoring filter
    if (qReverseFilter === 'reverse' && !q.reverse_scoring) return false
    if (qReverseFilter === 'normal' && q.reverse_scoring) return false
    // Search query
    if (qSearch.trim()) {
      const term = qSearch.toLowerCase().trim()
      const text = (q.question_text || '').toLowerCase()
      const order = String(q.sort_order || '')
      const dim = dimensions.find((d) => d.id === q.dimension_id)
      const dimName = (dim?.name || '').toLowerCase()
      if (!text.includes(term) && !order.includes(term) && !dimName.includes(term)) {
        return false
      }
    }
    return true
  })

  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
    let cmp = 0
    if (qSortKey === 'sort_order') {
      cmp = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    } else if (qSortKey === 'question_text') {
      cmp = (a.question_text || '').localeCompare(b.question_text || '')
    } else if (qSortKey === 'dimension') {
      const dimA = dimensions.find((d) => d.id === a.dimension_id)?.name || ''
      const dimB = dimensions.find((d) => d.id === b.dimension_id)?.name || ''
      cmp = dimA.localeCompare(dimB)
    } else if (qSortKey === 'weight') {
      cmp = (Number(a.weight) || 0) - (Number(b.weight) || 0)
    } else if (qSortKey === 'reverse_scoring') {
      cmp = (a.reverse_scoring ? 1 : 0) - (b.reverse_scoring ? 1 : 0)
    } else if (qSortKey === 'is_active') {
      cmp = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0)
    }
    return qSortDir === 'asc' ? cmp : -cmp
  })

  const totalFiltered = sortedQuestions.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / qPageSize))
  const safePage = Math.min(qPage, totalPages - 1)
  const pagedQuestions = sortedQuestions.slice(safePage * qPageSize, (safePage + 1) * qPageSize)
  const fromRecord = totalFiltered === 0 ? 0 : safePage * qPageSize + 1
  const toRecord = Math.min((safePage + 1) * qPageSize, totalFiltered)

  const isFiltered =
    qSearch.trim() !== '' ||
    qDimFilter !== 'all' ||
    qStatusFilter !== 'all' ||
    qReverseFilter !== 'all'

  if (loading) return <p className="meta">Memuat dimensi dan bobot…</p>

  return (
    <>
      <header className="ahead">
        <div>
          <h1>Dimensi &amp; bobot</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={handleSave} disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan perubahan'}
          </button>
          <button className="link" onClick={handleSaveDraft} disabled={busy}>
            Simpan draft
          </button>
          <button className="link" onClick={handlePublish} disabled={busy}>
            Publikasikan
          </button>
        </div>
      </header>

      <p className="meta">
        {dirty ? 'Ada perubahan yang belum disimpan. ' : ''}
        {activeDimensions.length} dimensi aktif · {activeQuestionCount} pertanyaan aktif
      </p>

      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="alert success" role="status">{notice}</p>}

      {/* Weight Summary Banner */}
      <section className={'card weight-summary ' + (weightValid ? 'valid' : 'invalid')}>
        <div>
          <h2>Total bobot dimensi</h2>
          <p className="meta">
            Total bobot seluruh dimensi aktif harus tepat 100%. Bobot pertanyaan dinormalisasi di
            dalam masing-masing dimensi.
          </p>
        </div>
        <div className="weight-total">
          <b>{fmt(totalWeight)}%</b>
          <span className={'badge ' + (weightValid ? 'ok' : 'warn')}>
            {weightValid ? 'Valid' : 'Belum 100%'}
          </span>
        </div>
      </section>

      {/* Tabbed Dimension Editor Section */}
      {dimensions.length > 0 && currentDimension && (
        <div className="dim-tabs-wrapper">
          {/* Dimension Tabs Navigation Bar */}
          <div className="dim-tabs-nav" role="tablist" aria-label="Pilih Dimensi">
            {dimensions.map((dim) => {
              const isSelected = dim.id === currentDimension.id
              return (
                <button
                  key={dim.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`panel-${dim.id}`}
                  id={`tab-${dim.id}`}
                  className={`dim-tab-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setActiveTabId(dim.id)}
                >
                  <span className="dim-tab-icon">
                    <DimensionIcon name={dim.name} />
                  </span>
                  <span>{dim.name}</span>
                </button>
              )
            })}
          </div>

          {/* Active Dimension Card Panel */}
          <section
            className="dim-card-panel"
            role="tabpanel"
            id={`panel-${currentDimension.id}`}
            aria-labelledby={`tab-${currentDimension.id}`}
          >
            {/* Top Right Status Badge */}
            <div className="dim-card-top">
              <span
                className={`dim-status-pill ${currentDimension.is_active ? 'active' : 'inactive'}`}
              >
                <span
                  className={`dim-status-dot ${currentDimension.is_active ? 'active' : 'inactive'}`}
                  aria-hidden="true"
                />
                {currentDimension.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>

            {/* 4-column fields row: Nama dimensi, Label singkat, Bobot dimensi (%), Urutan */}
            <div className="dim-grid-4">
              <label className="dim-field">
                <span className="dim-field-label">Nama dimensi</span>
                <input
                  className="dim-input"
                  value={currentDimension.name}
                  onChange={(event) =>
                    patchDimension(currentDimension.id, 'name', event.target.value)
                  }
                />
              </label>

              <label className="dim-field">
                <span className="dim-field-label">Label singkat</span>
                <input
                  className="dim-input"
                  value={currentDimension.short_name}
                  maxLength={24}
                  onChange={(event) =>
                    patchDimension(currentDimension.id, 'short_name', event.target.value)
                  }
                />
              </label>

              <label className="dim-field">
                <span className="dim-field-label">Bobot dimensi (%)</span>
                <input
                  className="dim-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentDimension.weight}
                  onChange={(event) =>
                    patchDimension(currentDimension.id, 'weight', event.target.value)
                  }
                />
              </label>

              <label className="dim-field">
                <span className="dim-field-label">Urutan</span>
                <input
                  className="dim-input"
                  type="number"
                  step="1"
                  value={currentDimension.sort_order}
                  onChange={(event) =>
                    patchDimension(currentDimension.id, 'sort_order', event.target.value)
                  }
                />
              </label>
            </div>

            {/* Row 2: Deskripsi */}
            <label className="dim-field">
              <span className="dim-field-label">Deskripsi</span>
              <textarea
                className="dim-textarea"
                rows="2"
                value={currentDimension.description}
                onChange={(event) =>
                  patchDimension(currentDimension.id, 'description', event.target.value)
                }
              />
            </label>

            {/* Row 3: Narasi kekuatan */}
            <label className="dim-field">
              <span className="dim-field-label">Narasi kekuatan</span>
              <textarea
                className="dim-textarea"
                rows="2"
                value={currentDimension.strength_guidance}
                onChange={(event) =>
                  patchDimension(currentDimension.id, 'strength_guidance', event.target.value)
                }
              />
            </label>

            {/* Row 4: Narasi pengembangan */}
            <label className="dim-field">
              <span className="dim-field-label">Narasi pengembangan</span>
              <textarea
                className="dim-textarea"
                rows="2"
                value={currentDimension.development_guidance}
                onChange={(event) =>
                  patchDimension(currentDimension.id, 'development_guidance', event.target.value)
                }
              />
            </label>

            {/* Row 5: Card bottom controls */}
            <div className="dim-card-footer">
              <label className="dim-checkbox-label">
                <input
                  type="checkbox"
                  checked={currentDimension.is_active}
                  onChange={(event) =>
                    patchDimension(currentDimension.id, 'is_active', event.target.checked)
                  }
                />
                Aktif
              </label>
              <span className="dim-footer-sep" aria-hidden="true">|</span>
              <span className="dim-footer-info">
                {activeDimQuestions.length} dari {dimQuestions.length} pertanyaan aktif
              </span>
            </div>

            {currentDimension.is_active && activeDimQuestions.length === 0 && (
              <p className="alert" style={{ marginTop: '1rem' }} role="alert">
                Dimensi aktif harus memiliki minimal satu pertanyaan aktif.
              </p>
            )}
          </section>

          {/* Information Callout Banner below card */}
          <section className="dim-info-card" aria-label="Informasi pengaturan dimensi">
            <div className="dim-info-icon-badge" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div className="dim-info-content">
              <div className="dim-info-title">Informasi</div>
              <div className="dim-info-text">
                Pengaturan ini akan digunakan untuk seluruh asesmen pada kategori yang dipilih.
              </div>
            </div>
            {/* Subtle golden corner wave illustration */}
            <svg
              className="dim-info-corner-art"
              viewBox="0 0 160 80"
              fill="none"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M160 0 C 128 16, 75 42, 45 80 L 160 80 Z"
                fill="url(#dimGoldGradient)"
              />
              <defs>
                <linearGradient
                  id="dimGoldGradient"
                  x1="160"
                  y1="0"
                  x2="60"
                  y2="80"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#fef3c7" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#fde68a" stopOpacity="0.45" />
                </linearGradient>
              </defs>
            </svg>
          </section>
        </div>
      )}

      {/* Questions DataTables Section */}
      <section className="dt-questions-card" aria-labelledby="dt-questions-heading">
        {/* Card Header with UI/UX Clarity */}
        <div className="dt-card-header">
          <div className="dt-card-title-group">
            <h2 id="dt-questions-heading">Bobot pertanyaan</h2>
            <p>
              Bobot bersifat relatif di dalam dimensi. Pertanyaan dengan bobot lebih besar memberi
              kontribusi lebih tinggi pada skor dimensi.
            </p>
          </div>
          <div className="dt-card-meta-pill">
            <span>{questions.length} total pertanyaan</span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ color: '#065f46' }}>{activeQuestionCount} aktif</span>
          </div>
        </div>

        {/* DataTables Controls Header: Entries per page & Filters */}
        <div className="dt-controls-top">
          <div className="dt-length">
            <label>
              <span>Tampilkan</span>
              <select
                value={qPageSize}
                onChange={(e) => {
                  setQPageSize(Number(e.target.value))
                  setQPage(0)
                }}
                aria-label="Jumlah pertanyaan per halaman"
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
            {/* Quick search input */}
            <div className="dt-search-box">
              <input
                type="search"
                aria-label="Cari pertanyaan"
                placeholder="Cari teks pertanyaan / no urut…"
                value={qSearch}
                onChange={(e) => {
                  setQSearch(e.target.value)
                  setQPage(0)
                }}
              />
            </div>

            {/* Filter by Dimension */}
            <select
              aria-label="Filter berdasarkan dimensi"
              value={qDimFilter}
              onChange={(e) => {
                setQDimFilter(e.target.value)
                setQPage(0)
              }}
            >
              <option value="all">Semua Dimensi ({questions.length})</option>
              {dimensions.map((dim) => {
                const count = questions.filter((q) => q.dimension_id === dim.id).length
                return (
                  <option key={dim.id} value={dim.id}>
                    {dim.name} ({count})
                  </option>
                )
              })}
            </select>

            {/* Filter by Status */}
            <select
              aria-label="Filter status aktif"
              value={qStatusFilter}
              onChange={(e) => {
                setQStatusFilter(e.target.value)
                setQPage(0)
              }}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif Saja</option>
              <option value="inactive">Nonaktif Saja</option>
            </select>

            {/* Filter by Reverse Scoring */}
            <select
              aria-label="Filter reverse scoring"
              value={qReverseFilter}
              onChange={(e) => {
                setQReverseFilter(e.target.value)
                setQPage(0)
              }}
            >
              <option value="all">Semua Skala</option>
              <option value="reverse">Reverse Scoring Saja</option>
              <option value="normal">Normal Scoring Saja</option>
            </select>

            {/* Reset button if filter is active */}
            {isFiltered && (
              <button
                type="button"
                className="dt-clear-btn"
                onClick={handleResetFilters}
                title="Bersihkan seluruh filter dan pencarian"
              >
                Reset filter
              </button>
            )}
          </div>
        </div>

        {/* DataTables Table Container */}
        <div className="tablewrap dt-tablewrap">
          <table className="data dt-table">
            <thead>
              <tr>
                <th
                  className="dt-th-sortable"
                  style={{ width: '88px', textAlign: 'center' }}
                  onClick={() => handleSort('sort_order')}
                >
                  <div className="dt-th-content" style={{ justifyContent: 'center' }}>
                    <span>Urutan</span>
                    {renderSortIndicator('sort_order')}
                  </div>
                </th>
                <th
                  className="dt-th-sortable"
                  onClick={() => handleSort('question_text')}
                >
                  <div className="dt-th-content">
                    <span>Pertanyaan</span>
                    {renderSortIndicator('question_text')}
                  </div>
                </th>
                <th
                  className="dt-th-sortable"
                  style={{ width: '190px' }}
                  onClick={() => handleSort('dimension')}
                >
                  <div className="dt-th-content">
                    <span>Dimensi</span>
                    {renderSortIndicator('dimension')}
                  </div>
                </th>
                <th
                  className="dt-th-sortable"
                  style={{ width: '110px', textAlign: 'center' }}
                  onClick={() => handleSort('weight')}
                >
                  <div className="dt-th-content" style={{ justifyContent: 'center' }}>
                    <span>Bobot</span>
                    {renderSortIndicator('weight')}
                  </div>
                </th>
                <th
                  className="dt-th-sortable"
                  style={{ width: '100px', textAlign: 'center' }}
                  onClick={() => handleSort('reverse_scoring')}
                >
                  <div className="dt-th-content" style={{ justifyContent: 'center' }}>
                    <span>Reverse</span>
                    {renderSortIndicator('reverse_scoring')}
                  </div>
                </th>
                <th
                  className="dt-th-sortable"
                  style={{ width: '90px', textAlign: 'center' }}
                  onClick={() => handleSort('is_active')}
                >
                  <div className="dt-th-content" style={{ justifyContent: 'center' }}>
                    <span>Aktif</span>
                    {renderSortIndicator('is_active')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedQuestions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="dt-empty">
                    <div style={{ display: 'grid', gap: '8px', placeItems: 'center', padding: '20px 0' }}>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.94rem' }}>
                        Tidak ada pertanyaan yang sesuai dengan filter atau kriteria pencarian.
                      </p>
                      {isFiltered && (
                        <button
                          type="button"
                          className="dt-clear-btn"
                          onClick={handleResetFilters}
                          style={{ marginTop: '4px' }}
                        >
                          Reset semua filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedQuestions.map((question) => {
                  const dim = dimensions.find((d) => d.id === question.dimension_id)
                  const dimName = dim?.name ?? '—'
                  return (
                    <tr key={question.id} className={question.is_active ? '' : 'muted'}>
                      {/* Urutan */}
                      <td style={{ textAlign: 'center' }} data-label="Urutan">
                        <span className="dt-order-pill">{question.sort_order}</span>
                      </td>

                      {/* Pertanyaan */}
                      <td data-label="Pertanyaan">
                        <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.94rem', lineHeight: 1.45 }}>
                          {question.question_text}
                        </div>
                      </td>

                      {/* Dimensi */}
                      <td data-label="Dimensi">
                        <span className="dt-dim-badge">
                          <DimensionIcon name={dimName} />
                          <span>{dimName}</span>
                        </span>
                      </td>

                      {/* Bobot Input */}
                      <td style={{ textAlign: 'center' }} data-label="Bobot">
                        <input
                          className="dt-weight-input"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={question.weight}
                          aria-label={`Bobot pertanyaan ${question.sort_order}`}
                          onChange={(event) =>
                            patchQuestion(question.id, 'weight', event.target.value)
                          }
                        />
                      </td>

                      {/* Reverse Scoring Checkbox */}
                      <td style={{ textAlign: 'center' }} data-label="Reverse">
                        <div className="dt-checkbox-cell">
                          <input
                            type="checkbox"
                            checked={question.reverse_scoring}
                            aria-label={`Reverse scoring pertanyaan ${question.sort_order}`}
                            title="Reverse scoring (6 − jawaban peserta)"
                            onChange={(event) =>
                              patchQuestion(question.id, 'reverse_scoring', event.target.checked)
                            }
                          />
                        </div>
                      </td>

                      {/* Status Aktif Checkbox */}
                      <td style={{ textAlign: 'center' }} data-label="Aktif">
                        <div className="dt-checkbox-cell">
                          <input
                            type="checkbox"
                            checked={question.is_active}
                            aria-label={`Status aktif pertanyaan ${question.sort_order}`}
                            onChange={(event) =>
                              patchQuestion(question.id, 'is_active', event.target.checked)
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* DataTables Bottom Controls: Entry Info & Pagination */}
        <div className="dt-controls-bottom">
          <div className="dt-info">
            Menampilkan <strong>{fromRecord}</strong> sampai <strong>{toRecord}</strong> dari{' '}
            <strong>{totalFiltered}</strong> pertanyaan
            {isFiltered && ` (difilter dari ${questions.length} total pertanyaan)`}
          </div>

          <div className="dt-pagination" role="navigation" aria-label="Navigasi halaman pertanyaan">
            <button
              type="button"
              className="dt-page-btn"
              disabled={safePage === 0}
              onClick={() => setQPage((p) => Math.max(0, p - 1))}
              aria-label="Halaman sebelumnya"
            >
              « Sebelumnya
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              // Only display nearby pages when totalPages is large
              if (
                totalPages > 7 &&
                idx !== 0 &&
                idx !== totalPages - 1 &&
                Math.abs(idx - safePage) > 1
              ) {
                if (idx === 1 || idx === totalPages - 2) {
                  return (
                    <span key={idx} className="dt-page-indicator">
                      …
                    </span>
                  )
                }
                return null
              }

              const isCurrent = idx === safePage
              return (
                <button
                  key={idx}
                  type="button"
                  className={`dt-page-btn ${isCurrent ? 'active' : ''}`}
                  style={
                    isCurrent
                      ? { background: 'var(--ink)', color: 'var(--white)', borderColor: 'var(--ink)', fontWeight: 700 }
                      : {}
                  }
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => setQPage(idx)}
                >
                  {idx + 1}
                </button>
              )
            })}

            <button
              type="button"
              className="dt-page-btn"
              disabled={safePage >= totalPages - 1}
              onClick={() => setQPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Halaman berikutnya"
            >
              Selanjutnya »
            </button>
          </div>
        </div>
      </section>

      {/* Alur Publikasi Information */}
      <section className="card" style={{ marginTop: '2rem' }}>
        <h2>Alur publikasi</h2>
        <p className="meta">
          Perubahan disimpan ke working draft. Publikasi membuat snapshot versi baru yang tidak dapat
          diedit, sehingga hasil asesmen lama tetap konsisten. Setelah publikasi, draft berikutnya
          dibuat otomatis.
        </p>
      </section>
    </>
  )
}
