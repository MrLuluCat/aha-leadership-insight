import { useEffect, useState } from 'react'
import { fmt } from '../lib/format'
import CustomSelect from './CustomSelect'
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

function HintTip({ text, label = 'Info bantuan' }) {
  return (
    <span className="dim-hint-wrap">
      <button type="button" className="dim-hint-trigger" aria-label={label}>
        ?
      </button>
      <span className="dim-hint-bubble" role="tooltip">
        {text}
      </span>
    </span>
  )
}

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

  const radius = 18
  const circumference = 2 * Math.PI * radius
  const clampedWeight = Math.min(100, Math.max(0, totalWeight))
  const strokeDashoffset = circumference - (clampedWeight / 100) * circumference

  return (
    <>
      <header className="dim-hero-head">
        <div>
          <div className="dim-title-row">
            <h1>Dimensi &amp; Bobot</h1>
            <div className="dim-help-wrap">
              <button
                type="button"
                className="dim-help-btn"
                aria-label="Penjelasan dan alur kerja Dimensi & Bobot"
              >
                ?
              </button>
              <div className="dim-help-popover" role="tooltip">
                <div className="dim-help-item">
                  <strong>1. Atur Dimensi &amp; Total Bobot 100%</strong>
                  <p>
                    Pilih tab dimensi untuk mengubah nama, label radar, bobot (%), dan narasi.
                    Total bobot seluruh dimensi aktif wajib tepat <strong>100,0%</strong>.
                  </p>
                </div>
                <div className="dim-help-item">
                  <strong>2. Bobot Relatif Pertanyaan</strong>
                  <p>
                    Di tabel bawah, atur bobot tiap pertanyaan di dalam dimensinya serta status
                    <em> Reverse scoring</em> atau aktif/nonaktif.
                  </p>
                </div>
                <div className="dim-help-item">
                  <strong>3. Simpan Draf vs Publikasikan</strong>
                  <p>
                    <strong>Simpan perubahan / Simpan draf</strong> menyimpan ke <em>working draft</em>.
                    Klik <strong>Publikasikan</strong> untuk mengaktifkan versi baru bagi peserta
                    berikutnya tanpa mengubah histori hasil peserta lama.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="rs-sub">
            Atur dimensi penilaian dan bobot masing-masing dimensi sesuai kebutuhan asesmen.
            {dirty ? ' (Ada perubahan belum disimpan)' : ''}
          </p>
        </div>

        <div className="dim-head-right">
          <div className={'dim-donut-card ' + (weightValid ? 'valid' : 'invalid')}>
            <svg className="dim-donut-svg" width="44" height="44" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r={radius} className="dim-donut-track" />
              <circle
                cx="24"
                cy="24"
                r={radius}
                className="dim-donut-fill"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="dim-donut-info">
              <b>{fmt(totalWeight)}%</b>
              <span>
                {weightValid
                  ? 'Total Bobot (Pas 100%)'
                  : totalWeight < 100
                    ? `Kurang ${fmt(100 - totalWeight)}% dari 100%`
                    : `Lebih ${fmt(totalWeight - 100)}% dari 100%`}
              </span>
            </div>
            <span className={'badge ' + (weightValid ? 'ok' : 'warn')}>
              {weightValid ? '✓ Valid' : 'Belum 100%'}
            </span>
          </div>

          <div className="dim-top-actions">
            <button
              type="button"
              className="dim-btn-outline"
              onClick={handleSaveDraft}
              disabled={busy || !dirty}
              title={!dirty ? 'Belum ada perubahan untuk disimpan ke draf' : 'Simpan ke working draft tanpa mempublikasikan'}
            >
              Simpan draf
            </button>
            <button
              type="button"
              className="dim-btn-primary"
              onClick={handleSave}
              disabled={busy || !dirty}
              title={!dirty ? 'Ubah data dimensi atau bobot terlebih dahulu' : 'Validasi dan simpan konfigurasi'}
            >
              {busy ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
            <button
              type="button"
              className="dim-btn-publish"
              onClick={handlePublish}
              disabled={busy}
              title="Kunci working draft menjadi versi asesmen aktif baru"
            >
              Publikasikan
            </button>
          </div>
        </div>
      </header>

      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="alert success" role="status">{notice}</p>}

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
            {/* Top Header inside Card */}
            <div className="dim-card-top">
              <div className="dim-card-heading">
                <span className="dim-card-accent" aria-hidden="true" />
                <div>
                  <h2>{currentDimension.name}</h2>
                  <p>{currentDimension.description || 'Atur detail dan narasi untuk dimensi ini.'}</p>
                </div>
              </div>
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
                <span className="dim-field-label">
                  Label singkat
                  <HintTip text="Nama ringkas (maks. 24 karakter) yang ditampilkan pada titik diagram radar laporan hasil peserta." />
                </span>
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
                <span className="dim-field-label">
                  Bobot dimensi (%)
                  <HintTip text="Persentase kontribusi dimensi ini ke skor akhir (Overall Leadership Index). Total seluruh dimensi aktif wajib tepat 100%." />
                </span>
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
                <span className="dim-field-label">
                  Urutan
                  <HintTip text="Urutan tampil dimensi pada tab, tabel laporan, dan diagram radar." />
                </span>
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
              <span className="dim-field-label">
                Deskripsi
                <HintTip text="Penjelasan singkat mengenai apa yang diukur oleh dimensi ini (tampil di halaman depan & laporan)." />
              </span>
              <div className="qm-textarea-wrap">
                <textarea
                  className="dim-textarea"
                  rows="2"
                  maxLength={500}
                  value={currentDimension.description}
                  onChange={(event) =>
                    patchDimension(currentDimension.id, 'description', event.target.value)
                  }
                />
                <span className="qm-counter">{(currentDimension.description || '').length} / 500</span>
              </div>
            </label>

            {/* Row 3: Narasi kekuatan */}
            <label className="dim-field">
              <span className="dim-field-label">
                Narasi kekuatan
                <HintTip text="Muncul otomatis di kartu 'Top 3 Strengths' pada laporan peserta apabila dimensi ini termasuk 3 skor tertinggi." />
              </span>
              <div className="qm-textarea-wrap">
                <textarea
                  className="dim-textarea"
                  rows="2"
                  maxLength={500}
                  value={currentDimension.strength_guidance}
                  onChange={(event) =>
                    patchDimension(currentDimension.id, 'strength_guidance', event.target.value)
                  }
                />
                <span className="qm-counter">{(currentDimension.strength_guidance || '').length} / 500</span>
              </div>
            </label>

            {/* Row 4: Narasi pengembangan */}
            <label className="dim-field">
              <span className="dim-field-label">
                Narasi pengembangan
                <HintTip text="Muncul otomatis di kartu 'Development Priorities' & '21-Day Action Plan' apabila dimensi ini termasuk 3 skor terendah peserta." />
              </span>
              <div className="qm-textarea-wrap">
                <textarea
                  className="dim-textarea"
                  rows="2"
                  maxLength={500}
                  value={currentDimension.development_guidance}
                  onChange={(event) =>
                    patchDimension(currentDimension.id, 'development_guidance', event.target.value)
                  }
                />
                <span className="qm-counter">{(currentDimension.development_guidance || '').length} / 500</span>
              </div>
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

        </div>
      )}

      {/* Questions DataTables Section */}
      <section className="rs-card" aria-labelledby="dt-questions-heading">
        <div className="dim-dt-head">
          <div>
            <h2 id="dt-questions-heading">Bobot pertanyaan</h2>
            <p className="rs-sub">
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

        <div className="rs-toolbar">
          <div className="rs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
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

          <CustomSelect
            ariaLabel="Filter berdasarkan dimensi"
            value={qDimFilter}
            onChange={(val) => {
              setQDimFilter(val)
              setQPage(0)
            }}
            options={[
              { value: 'all', label: `Semua Dimensi (${questions.length})` },
              ...dimensions.map((dim) => {
                const count = questions.filter((q) => q.dimension_id === dim.id).length
                return { value: dim.id, label: `${dim.name} (${count})` }
              }),
            ]}
          />

          <CustomSelect
            ariaLabel="Filter status aktif"
            value={qStatusFilter}
            onChange={(val) => {
              setQStatusFilter(val)
              setQPage(0)
            }}
            options={[
              { value: 'all', label: 'Semua Status' },
              { value: 'active', label: 'Aktif Saja' },
              { value: 'inactive', label: 'Nonaktif Saja' },
            ]}
          />

          <CustomSelect
            ariaLabel="Filter reverse scoring"
            value={qReverseFilter}
            onChange={(val) => {
              setQReverseFilter(val)
              setQPage(0)
            }}
            options={[
              { value: 'all', label: 'Semua Skala' },
              { value: 'reverse', label: 'Reverse Scoring Saja' },
              { value: 'normal', label: 'Normal Scoring Saja' },
            ]}
          />

          {isFiltered && (
            <button type="button" className="rs-reset" onClick={handleResetFilters}>
              Reset
            </button>
          )}
        </div>

        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="rs-sort" onClick={() => handleSort('sort_order')}>
                    <span>Urutan</span>
                    {renderSortIndicator('sort_order')}
                  </button>
                </th>
                <th>
                  <button type="button" className="rs-sort" onClick={() => handleSort('question_text')}>
                    <span>Pertanyaan</span>
                    {renderSortIndicator('question_text')}
                  </button>
                </th>
                <th>
                  <button type="button" className="rs-sort" onClick={() => handleSort('dimension')}>
                    <span>Dimensi</span>
                    {renderSortIndicator('dimension')}
                  </button>
                </th>
                <th className="rs-center">
                  <button type="button" className="rs-sort" onClick={() => handleSort('weight')}>
                    <span>Bobot</span>
                    {renderSortIndicator('weight')}
                  </button>
                </th>
                <th className="rs-center">
                  <button type="button" className="rs-sort" onClick={() => handleSort('reverse_scoring')}>
                    <span>Reverse</span>
                    {renderSortIndicator('reverse_scoring')}
                  </button>
                </th>
                <th className="rs-center">
                  <button type="button" className="rs-sort" onClick={() => handleSort('is_active')}>
                    <span>Aktif</span>
                    {renderSortIndicator('is_active')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedQuestions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="rs-empty">
                    Tidak ada pertanyaan yang sesuai dengan filter atau kriteria pencarian.
                  </td>
                </tr>
              ) : (
                pagedQuestions.map((question) => {
                  const dim = dimensions.find((d) => d.id === question.dimension_id)
                  const dimName = dim?.name ?? '—'
                  return (
                    <tr key={question.id} className={question.is_active ? '' : 'muted'}>
                      <td data-label="Urutan">
                        <span className="rs-ver">#{question.sort_order}</span>
                      </td>
                      <td data-label="Pertanyaan">{question.question_text}</td>
                      <td data-label="Dimensi">
                        <span className="dt-dim-badge">
                          <DimensionIcon name={dimName} />
                          <span>{dimName}</span>
                        </span>
                      </td>
                      <td className="rs-center" data-label="Bobot">
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
                      <td className="rs-center" data-label="Reverse">
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
                      <td className="rs-center" data-label="Aktif">
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

        <div className="rs-footer">
          <div className="rs-size">
            <span>Tampilkan</span>
            <CustomSelect
              className="cs-compact"
              ariaLabel="Jumlah pertanyaan per halaman"
              value={qPageSize}
              onChange={(val) => {
                setQPageSize(Number(val))
                setQPage(0)
              }}
              options={PAGE_SIZE_OPTIONS.map((opt) => ({ value: opt, label: String(opt) }))}
            />
            <span>entri</span>
          </div>

          <span className="rs-info">
            {fromRecord}–{toRecord} dari {totalFiltered}
          </span>

          <nav className="rs-pager" aria-label="Paginasi bobot pertanyaan">
            <button
              type="button"
              className="rs-pg"
              disabled={safePage === 0}
              onClick={() => setQPage(0)}
              aria-label="Halaman pertama"
            >
              «
            </button>
            <button
              type="button"
              className="rs-pg"
              disabled={safePage === 0}
              onClick={() => setQPage((p) => Math.max(0, p - 1))}
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
              onClick={() => setQPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Halaman berikutnya"
            >
              ›
            </button>
            <button
              type="button"
              className="rs-pg"
              disabled={safePage >= totalPages - 1}
              onClick={() => setQPage(totalPages - 1)}
              aria-label="Halaman terakhir"
            >
              »
            </button>
          </nav>
        </div>
      </section>
    </>
  )
}
