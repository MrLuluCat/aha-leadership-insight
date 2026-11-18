import { useEffect, useState } from 'react'
import Radar from './Radar'
import Report from './Report'
import Admin from './Admin'
import { SCALE } from './scoring'
import { isSupabaseConfigured, supabaseConfigError } from './lib/supabase'
import {
  fetchActiveAssessment,
  fetchAssessmentResult,
  startAssessment,
  submitAssessment,
} from './services/assessment'

const INPROGRESS_KEY = 'aha_inprogress'
const LAST_KEY = 'aha_last_session'
const ART_SHAPE = [0.9, 0.62, 0.78, 0.55, 0.85, 0.7, 0.6]

const readJSON = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
const clearKey = (key) => {
  try {
    localStorage.removeItem(key)
  } catch {}
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash)

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route.startsWith('#/admin')) return <Admin />
  return <Participant />
}

function Participant() {
  const [config, setConfig] = useState(null)
  const [version, setVersion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState('intro')
  const [session, setSession] = useState(null)
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!isSupabaseConfigured) {
        setLoadError(
          supabaseConfigError ||
            'Aplikasi belum terhubung ke Supabase. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env.'
        )
        setLoading(false)
        return
      }

      try {
        const saved = readJSON(INPROGRESS_KEY)
        if (saved?.session_id && saved?.access_token && saved?.config) {
          if (!mounted) return
          setSession({
            session_id: saved.session_id,
            access_token: saved.access_token,
            participant_name: saved.participant_name,
            version_number: saved.version_number,
          })
          setConfig(saved.config)
          setVersion(saved.version_number)
          setAnswers(saved.answers ?? {})
          setIndex(saved.index ?? 0)
          setView('quiz')
          setLoading(false)
          return
        }

        const last = readJSON(LAST_KEY)
        if (last?.session_id && last?.access_token) {
          const restored = await fetchAssessmentResult(last.session_id, last.access_token)
          if (restored) {
            if (!mounted) return
            setResult(restored)
            setSession({
              ...last,
              participant_name: restored.participant_name,
              version_number: restored.version_number,
            })
            setView('result')
            setLoading(false)
            return
          }
          clearKey(LAST_KEY)
        }

        const active = await fetchActiveAssessment()
        if (!mounted) return

        if (!active) {
          setLoadError('Asesmen belum tersedia. Silakan hubungi administrator.')
          setLoading(false)
          return
        }

        setConfig(active.config)
        setVersion(active.version_number)
      } catch (err) {
        if (mounted) setLoadError(err.message || 'Gagal memuat konfigurasi asesmen.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const saveProgress = (nextAnswers, nextIndex) => {
    if (!session) return
    writeJSON(INPROGRESS_KEY, {
      ...session,
      config,
      answers: nextAnswers,
      index: nextIndex,
    })
  }

  async function handleStart({ name, email }) {
    setBusy(true)
    setError('')
    try {
      const data = await startAssessment(name, email)
      const nextSession = {
        session_id: data.session_id,
        access_token: data.access_token,
        participant_name: data.participant_name,
        version_number: data.version_number,
      }
      setSession(nextSession)
      setConfig(data.config)
      setVersion(data.version_number)
      setAnswers({})
      setIndex(0)
      setResult(null)
      setView('quiz')
      writeJSON(INPROGRESS_KEY, { ...nextSession, config: data.config, answers: {}, index: 0 })
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(err.message || 'Gagal memulai asesmen.')
    } finally {
      setBusy(false)
    }
  }

  function handleAnswer(questionId, value) {
    const next = { ...answers, [questionId]: value }
    setAnswers(next)
    setError('')
    saveProgress(next, index)
  }

  function handleNavigate(nextIndex) {
    setIndex(nextIndex)
    setError('')
    saveProgress(answers, nextIndex)
    window.scrollTo({ top: 0 })
  }

  async function handleSubmit() {
    const questions = config?.questions ?? []
    const unanswered = questions.findIndex((q) => !answers[q.id])
    if (unanswered !== -1) {
      setError('Seluruh pertanyaan wajib dijawab sebelum mengirim.')
      setIndex(unanswered)
      return
    }

    setBusy(true)
    setError('')
    try {
      const data = await submitAssessment(session.session_id, session.access_token, answers)
      clearKey(INPROGRESS_KEY)
      writeJSON(LAST_KEY, { session_id: session.session_id, access_token: session.access_token })
      setResult(data)
      setView('result')
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(err.message || 'Gagal mengirim jawaban. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function restart() {
    clearKey(LAST_KEY)
    clearKey(INPROGRESS_KEY)
    setResult(null)
    setSession(null)
    setAnswers({})
    setIndex(0)
    setError('')
    setView('intro')
    setLoading(true)

    try {
      const active = await fetchActiveAssessment()
      if (!active) {
        setLoadError('Asesmen belum tersedia. Silakan hubungi administrator.')
      } else {
        setLoadError('')
        setConfig(active.config)
        setVersion(active.version_number)
      }
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat konfigurasi asesmen.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="wrap splash">
        <p className="brand">AHA Leadership Centre</p>
        <p className="meta">Memuat asesmen…</p>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="wrap splash">
        <div className="card">
          <p className="brand">AHA Leadership Centre</p>
          <h1 className="splash-title">Asesmen belum dapat dibuka</h1>
          <p className="lead">{loadError}</p>
          <a className="link" href="#/admin">
            Masuk ke dashboard admin
          </a>
        </div>
      </main>
    )
  }

  if (view === 'result' && result) {
    return (
      <main className="wrap result">
        <Report result={result} onRestart={restart} />
      </main>
    )
  }

  if (view === 'quiz' && config) {
    return (
      <Quiz
        config={config}
        session={session}
        answers={answers}
        index={index}
        busy={busy}
        error={error}
        onAnswer={handleAnswer}
        onNavigate={handleNavigate}
        onSubmit={handleSubmit}
      />
    )
  }

  return (
    <Intro
      config={config}
      version={version}
      busy={busy}
      error={error}
      onStart={handleStart}
    />
  )
}

function Intro({ config, version, busy, error, onStart }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const dimensions = config?.dimensions ?? []
  const questionCount = config?.questions?.length ?? 0

  function submit(event) {
    event.preventDefault()
    if (name.trim()) onStart({ name: name.trim(), email: email.trim() })
  }

  return (
    <main className="wrap intro">
      <div className="copy">
        <p className="brand">AHA Leadership Centre</p>
        <h1>Kenali diri Anda sebagai pemimpin.</h1>
        <p className="lead">
          Tidak ada jawaban benar atau salah. Jawablah sesuai diri Anda yang sesungguhnya, bukan diri
          yang ingin Anda tampilkan.
        </p>
        <form onSubmit={submit} className="start">
          <label htmlFor="nama">Nama lengkap</label>
          <input
            id="nama"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tulis nama Anda"
            autoComplete="name"
            maxLength={200}
            required
          />
          <label htmlFor="email">Email (opsional)</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nama@email.com"
            autoComplete="email"
          />
          <button className="btn" disabled={!name.trim() || busy}>
            {busy ? 'Menyiapkan sesi…' : 'Mulai asesmen'}
          </button>
        </form>
        {error && <p className="alert">{error}</p>}
        <p className="meta">
          {questionCount} pernyataan dalam {dimensions.length} dimensi. Waktu pengerjaan 15–20 menit.
        </p>
      </div>
      <div className="art">
        <Radar
          values={dimensions.map((_, i) => ART_SHAPE[i % ART_SHAPE.length])}
          labels={dimensions.map((d) => d.short_name || d.name)}
        />
      </div>
      <section className="dims" aria-label="Dimensi yang diukur">
        <h2>Dimensi yang diukur</h2>
        <ul>
          {dimensions.map((d) => (
            <li key={d.id}>
              <h3>{d.name}</h3>
              <p>{d.description}</p>
            </li>
          ))}
        </ul>
      </section>
      <footer className="foot">
        <span className="meta">Versi asesmen {version} · </span>
        <a className="link" href="#/admin">
          Dashboard admin
        </a>
      </footer>
    </main>
  )
}

function Quiz({ config, session, answers, index, busy, error, onAnswer, onNavigate, onSubmit }) {
  const [confirming, setConfirming] = useState(false)
  const questions = config?.questions ?? []
  const dimensions = config?.dimensions ?? []
  const question = questions[index]
  const answeredCount = questions.filter((q) => answers[q.id]).length
  const dimension = dimensions.find((d) => d.id === question?.dimension_id)
  const isLast = index === questions.length - 1
  const currentAnswer = answers[question?.id]

  if (!question) return null

  function next() {
    if (!currentAnswer) return
    if (isLast) setConfirming(true)
    else onNavigate(index + 1)
  }

  function confirmSubmit() {
    setConfirming(false)
    onSubmit()
  }

  return (
    <main className="wrap quiz">
      <div
        className="bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax={questions.length}
        aria-valuenow={index + 1}
      >
        <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      <p className="meta">
        Pernyataan {index + 1} dari {questions.length} · {dimension?.name} · {answeredCount} terjawab
      </p>
      <p className="meta quiz-person">{session?.participant_name}</p>
      <h2 key={question.id} className="stmt">
        {question.text}
      </h2>
      <div className="scale" role="group" aria-label="Seberapa sesuai pernyataan ini dengan Anda?">
        {SCALE.map((label, i) => (
          <button
            key={label}
            type="button"
            className={'opt' + (currentAnswer === i + 1 ? ' on' : '')}
            onClick={() => onAnswer(question.id, i + 1)}
          >
            <b>{i + 1}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>
      {error && <p className="alert">{error}</p>}
      <div className="quiz-nav">
        <button className="link" disabled={index === 0} onClick={() => onNavigate(index - 1)}>
          Sebelumnya
        </button>
        <button className="btn" disabled={!currentAnswer || busy} onClick={next}>
          {isLast ? 'Selesai & kirim' : 'Berikutnya'}
        </button>
      </div>

      {confirming && (
        <div className="overlay" role="presentation" onClick={() => setConfirming(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-title">Kirim jawaban asesmen?</h2>
            <p className="meta">
              Anda telah menjawab {answeredCount} dari {questions.length} pernyataan. Setelah dikirim,
              jawaban tidak dapat diubah.
            </p>
            <div className="actions">
              <button className="btn" disabled={busy} onClick={confirmSubmit}>
                {busy ? 'Mengirim…' : 'Ya, kirim jawaban'}
              </button>
              <button className="link" disabled={busy} onClick={() => setConfirming(false)}>
                Periksa kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
