import { useEffect, useState } from 'react'
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

export default function Questions() {
  const [dimensions, setDimensions] = useState([])
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('all')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [dims, items] = await Promise.all([fetchDimensions(), fetchQuestions()])
      setDimensions(dims)
      setQuestions(items)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const dimName = (id) => dimensions.find((dim) => dim.id === id)?.name ?? '—'
  const nextOrder = questions.length
    ? Math.max(...questions.map((question) => question.sort_order)) + 1
    : 1

  function startNew() {
    setEditing(emptyForm(dimensions, nextOrder))
    setNotice('')
    setError('')
  }

  function startEdit(question) {
    setEditing({
      id: question.id,
      dimension_id: question.dimension_id,
      question_text: question.question_text,
      weight: Number(question.weight),
      reverse_scoring: question.reverse_scoring,
      sort_order: question.sort_order,
      is_active: question.is_active,
    })
    setNotice('')
    setError('')
  }

  function patch(field, value) {
    setEditing((current) => ({ ...current, [field]: value }))
  }

  async function save(event) {
    event.preventDefault()
    if (!editing) return

    const text = editing.question_text.trim()
    const weight = Number(editing.weight)
    if (!text) return setError('Teks pertanyaan wajib diisi.')
    if (!editing.dimension_id) return setError('Pilih dimensi untuk pertanyaan ini.')
    if (!Number.isFinite(weight) || weight <= 0) {
      return setError('Bobot pertanyaan harus lebih besar dari 0.')
    }

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

  async function toggleActive(question) {
    setError('')
    setNotice('')
    try {
      await updateQuestion(question.id, { is_active: !question.is_active })
      setNotice(
        question.is_active
          ? 'Pertanyaan dinonaktifkan. Histori hasil tetap tersimpan.'
          : 'Pertanyaan diaktifkan kembali.'
      )
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const shown = questions.filter((question) =>
    status === 'all' ? true : status === 'active' ? question.is_active : !question.is_active
  )

  if (loading) return <p className="meta">Memuat pertanyaan…</p>

  return (
    <>
      <header className="ahead">
        <div>
          <h1>Pertanyaan</h1>
        </div>
        <button className="btn" onClick={startNew} disabled={!dimensions.length}>
          Tambah pertanyaan
        </button>
      </header>

      <p className="meta">
        {questions.length} pertanyaan · {questions.filter((question) => question.is_active).length}{' '}
        aktif. Pertanyaan yang sudah digunakan pada hasil asesmen tidak dihapus permanen; gunakan
        status nonaktif. Perubahan berlaku pada sesi baru setelah draft dipublikasikan dari tab Versi
        Asesmen.
      </p>

      {error && <p className="alert">{error}</p>}
      {notice && <p className="alert success">{notice}</p>}

      {editing && (
        <form className="card form-card" onSubmit={save}>
          <h2>{editing.id ? 'Edit pertanyaan' : 'Pertanyaan baru'}</h2>
          <label className="field">
            <span>Teks pertanyaan</span>
            <textarea
              rows="3"
              value={editing.question_text}
              onChange={(event) => patch('question_text', event.target.value)}
              required
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Dimensi</span>
              <select
                value={editing.dimension_id}
                onChange={(event) => patch('dimension_id', event.target.value)}
              >
                {dimensions.map((dimension) => (
                  <option key={dimension.id} value={dimension.id}>
                    {dimension.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Bobot pertanyaan</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={editing.weight}
                onChange={(event) => patch('weight', event.target.value)}
              />
            </label>
            <label className="field">
              <span>Urutan</span>
              <input
                type="number"
                step="1"
                value={editing.sort_order}
                onChange={(event) => patch('sort_order', event.target.value)}
              />
            </label>
          </div>
          <div className="checks">
            <label>
              <input
                type="checkbox"
                checked={editing.reverse_scoring}
                onChange={(event) => patch('reverse_scoring', event.target.checked)}
              />
              Reverse scoring (6 − jawaban)
            </label>
            <label>
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(event) => patch('is_active', event.target.checked)}
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

      <div className="tools">
        <select
          aria-label="Filter status pertanyaan"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <span className="meta">{shown.length} ditampilkan</span>
      </div>

      <div className="tablewrap card">
        <table className="data stack">
          <thead>
            <tr>
              <th>Urutan</th>
              <th>Pertanyaan</th>
              <th>Dimensi</th>
              <th>Bobot</th>
              <th>Reverse</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((question) => (
              <tr key={question.id} className={question.is_active ? '' : 'muted'}>
                <td data-label="Urutan">{question.sort_order}</td>
                <td data-label="Pertanyaan">{question.question_text}</td>
                <td data-label="Dimensi">{dimName(question.dimension_id)}</td>
                <td data-label="Bobot">{fmt(question.weight)}</td>
                <td data-label="Reverse">{question.reverse_scoring ? 'Ya' : '—'}</td>
                <td data-label="Status">
                  <span className={'badge ' + (question.is_active ? 'ok' : 'off')}>
                    {question.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="row-actions">
                  <button className="thb" onClick={() => startEdit(question)}>
                    Edit
                  </button>
                  <button className="thb" onClick={() => toggleActive(question)}>
                    {question.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan="7" className="meta">
                  Belum ada pertanyaan pada filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
