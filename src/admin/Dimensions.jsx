import { useEffect, useState } from 'react'
import { fmt } from '../lib/format'
import {
  fetchDimensions,
  fetchQuestions,
  publishAssessment,
  saveConfiguration,
  saveDraft,
} from '../services/admin'

export default function Dimensions() {
  const [dimensions, setDimensions] = useState([])
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [dims, items] = await Promise.all([fetchDimensions(), fetchQuestions()])
      setDimensions(dims.map((dim) => ({ ...dim, weight: Number(dim.weight) })))
      setQuestions(items.map((question) => ({ ...question, weight: Number(question.weight) })))
      setDirty(false)
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

  if (loading) return <p className="meta">Memuat dimensi dan bobot…</p>

  return (
    <>
      <header className="ahead">
        <div>
          <p className="brand">Pengaturan asesmen</p>
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

      {error && <p className="alert">{error}</p>}
      {notice && <p className="alert success">{notice}</p>}

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

      <div className="dim-list">
        {dimensions.map((dimension) => {
          const dimQuestions = questions.filter(
            (question) => question.dimension_id === dimension.id
          )
          const activeQuestions = dimQuestions.filter((question) => question.is_active)
          return (
            <section className={'card dim-card' + (dimension.is_active ? '' : ' muted')} key={dimension.id}>
              <div className="dim-head">
                <h3>{dimension.name}</h3>
                <span className={'badge ' + (dimension.is_active ? 'ok' : 'off')}>
                  {dimension.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Nama dimensi</span>
                  <input
                    value={dimension.name}
                    onChange={(event) => patchDimension(dimension.id, 'name', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Label singkat</span>
                  <input
                    value={dimension.short_name}
                    onChange={(event) =>
                      patchDimension(dimension.id, 'short_name', event.target.value)
                    }
                    maxLength={24}
                  />
                </label>
                <label className="field">
                  <span>Bobot dimensi (%)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dimension.weight}
                    onChange={(event) =>
                      patchDimension(dimension.id, 'weight', event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Urutan</span>
                  <input
                    type="number"
                    step="1"
                    value={dimension.sort_order}
                    onChange={(event) =>
                      patchDimension(dimension.id, 'sort_order', event.target.value)
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>Deskripsi</span>
                <textarea
                  rows="2"
                  value={dimension.description}
                  onChange={(event) =>
                    patchDimension(dimension.id, 'description', event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Narasi kekuatan</span>
                <textarea
                  rows="2"
                  value={dimension.strength_guidance}
                  onChange={(event) =>
                    patchDimension(dimension.id, 'strength_guidance', event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Narasi pengembangan</span>
                <textarea
                  rows="2"
                  value={dimension.development_guidance}
                  onChange={(event) =>
                    patchDimension(dimension.id, 'development_guidance', event.target.value)
                  }
                />
              </label>

              <div className="checks">
                <label>
                  <input
                    type="checkbox"
                    checked={dimension.is_active}
                    onChange={(event) =>
                      patchDimension(dimension.id, 'is_active', event.target.checked)
                    }
                  />
                  Aktif
                </label>
                <span className="meta">
                  {activeQuestions.length} dari {dimQuestions.length} pertanyaan aktif
                </span>
              </div>

              {dimension.is_active && activeQuestions.length === 0 && (
                <p className="alert">Dimensi aktif harus memiliki minimal satu pertanyaan aktif.</p>
              )}
            </section>
          )
        })}
      </div>

      <section className="card">
        <h2>Bobot pertanyaan</h2>
        <p className="meta">
          Bobot bersifat relatif di dalam dimensi. Pertanyaan dengan bobot lebih besar memberi
          kontribusi lebih tinggi pada skor dimensi.
        </p>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr>
                <th>Urutan</th>
                <th>Pertanyaan</th>
                <th>Dimensi</th>
                <th>Bobot</th>
                <th>Reverse</th>
                <th>Aktif</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id} className={question.is_active ? '' : 'muted'}>
                  <td>{question.sort_order}</td>
                  <td>{question.question_text}</td>
                  <td>
                    {dimensions.find((dim) => dim.id === question.dimension_id)?.name ?? '—'}
                  </td>
                  <td>
                    <input
                      className="inline-input"
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
                  <td>
                    <input
                      type="checkbox"
                      checked={question.reverse_scoring}
                      aria-label={`Reverse scoring pertanyaan ${question.sort_order}`}
                      onChange={(event) =>
                        patchQuestion(question.id, 'reverse_scoring', event.target.checked)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={question.is_active}
                      aria-label={`Status aktif pertanyaan ${question.sort_order}`}
                      onChange={(event) =>
                        patchQuestion(question.id, 'is_active', event.target.checked)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
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
