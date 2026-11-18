import { useEffect, useState } from 'react'
import { dtfmt, fmt } from '../lib/format'
import { fetchVersions, publishAssessment, saveDraft } from '../services/admin'

export default function Versions() {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)

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

  if (loading) return <p className="meta">Memuat versi asesmen…</p>

  return (
    <>
      <header className="ahead">
        <div>
          <h1>Versi asesmen</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={handleSaveDraft} disabled={busy}>
            Simpan draft
          </button>
          <button className="link" onClick={handlePublish} disabled={busy}>
            Publikasikan draft
          </button>
        </div>
      </header>

      <p className="meta">
        Setiap publikasi menghasilkan snapshot konfigurasi baru. Versi yang sudah dipublikasikan
        bersifat read-only dan menjadi acuan sesi asesmen yang sedang berjalan. Pastikan perubahan
        pada tab Dimensi &amp; Bobot sudah disimpan sebelum mempublikasikan.
      </p>

      {error && <p className="alert">{error}</p>}
      {notice && <p className="alert success">{notice}</p>}

      <div className="tablewrap card">
        <table className="data stack">
          <thead>
            <tr>
              <th>Versi</th>
              <th>Status</th>
              <th>Dipublikasikan</th>
              <th>Dimensi</th>
              <th>Pertanyaan</th>
              <th>Total bobot</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => {
              const snapshot = version.configuration_snapshot ?? {}
              const dimensions = snapshot.dimensions ?? []
              const questions = snapshot.questions ?? []
              const totalWeight = dimensions.reduce(
                (sum, dimension) => sum + Number(dimension.weight || 0),
                0
              )
              return (
                <tr key={version.id}>
                  <td data-label="Versi">
                    <b>v{version.version_number}</b>
                  </td>
                  <td data-label="Status">
                    <span className={'badge ' + statusClass(version.status)}>
                      {statusLabel(version.status)}
                    </span>
                  </td>
                  <td data-label="Dipublikasikan">{version.published_at ? dtfmt(version.published_at) : '—'}</td>
                  <td data-label="Dimensi">{dimensions.length}</td>
                  <td data-label="Pertanyaan">{questions.length}</td>
                  <td data-label="Total bobot">{fmt(totalWeight)}%</td>
                  <td>
                    <button
                      className="thb"
                      onClick={() => setPreview(preview === version.id ? null : version.id)}
                    >
                      {preview === version.id ? 'Tutup' : 'Preview'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {!versions.length && (
              <tr>
                <td colSpan="7" className="meta">
                  Belum ada versi asesmen. Simpan draft untuk membuat versi pertama.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {versions
        .filter((version) => version.id === preview)
        .map((version) => {
          const snapshot = version.configuration_snapshot ?? {}
          const dimensions = snapshot.dimensions ?? []
          const questions = snapshot.questions ?? []
          return (
            <section className="card version-preview" key={version.id}>
              <h2>Preview versi {version.version_number}</h2>
              <p className="meta">
                Dibuat {dtfmt(version.created_at)}
                {version.published_at ? ` · Dipublikasikan ${dtfmt(version.published_at)}` : ''}
              </p>
              <div className="tablewrap">
                <table className="data stack">
                  <thead>
                    <tr>
                      <th>Dimensi</th>
                      <th>Bobot</th>
                      <th>Pertanyaan aktif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map((dimension) => (
                      <tr key={dimension.id}>
                        <td data-label="Dimensi">{dimension.name}</td>
                        <td data-label="Bobot">{fmt(dimension.weight)}%</td>
                        <td data-label="Pertanyaan aktif">
                          {
                            questions.filter(
                              (question) => question.dimension_id === dimension.id
                            ).length
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>Snapshot konfigurasi (JSON)</summary>
                <pre className="json">{JSON.stringify(snapshot, null, 2)}</pre>
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

function statusClass(status) {
  if (status === 'published') return 'ok'
  if (status === 'archived') return 'off'
  return 'warn'
}
