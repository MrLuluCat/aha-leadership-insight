import { useEffect, useState } from 'react'
import Radar from './Radar'
import logo from './assets/aha-logo.jpg'
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
        <img className="logo sm" src={logo} alt="AHA Leadership Centre" />
        <p className="meta">Memuat asesmen…</p>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="wrap splash">
        <div className="card">
          <img className="logo sm" src={logo} alt="AHA Leadership Centre" />
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
        onExit={restart}
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

  // Icons mapping for the 7 dimensions
  const getDimensionIcon = (index) => {
    switch (index % 7) {
      case 0: // Kesadaran Diri (Eye)
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )
      case 1: // Pengelolaan Diri (Users/People)
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )
      case 2: // Empati (Heart)
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        )
      case 3: // Harmoni Relasi (Handshake)
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m11 17 2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4l-2.6-2.6" />
            <path d="m18 10 3.3-3.3a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0L14 6" />
            <path d="m2 14 6 6" />
            <path d="m7 9 4.3-4.3a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4L11 13" />
            <path d="M11 13 4 20l-2-2 7-7" />
          </svg>
        )
      case 4: // Kolaborasi (Sync / Circular arrows)
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        )
      case 5: // Adaptabilitas (Rocket)
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          </svg>
        )
      default: // Aksi & Ketuntasan (Star)
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )
    }
  }

  return (
    <div className="landing-page">
      {/* Top Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-brand">
            <img className="landing-logo" src={logo} alt="AHA Leadership Centre — Grow. Empower. Inspire" />
          </div>
          <nav className="landing-links" aria-label="Navigasi admin">
            <a href="#/admin" className="landing-admin-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 7h10M7 12h10M7 17h6" />
              </svg>
              <span>Login Admin</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-container">
          {/* Left Column: Headline & Form */}
          <div className="hero-copy">
            <h1 className="hero-title">
              Kenali diri Anda <br />
              sebagai <span className="highlight-gold">pemimpin.</span>
            </h1>
            <p className="hero-lead">
              Tidak ada jawaban benar atau salah. Jawablah sesuai diri Anda yang sesungguhnya, bukan diri yang ingin Anda tampilkan.
            </p>

            <form onSubmit={submit} className="hero-form-card">
              <div className="hero-inputs-row">
                <div className="hero-input-group">
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
                </div>
                <div className="hero-input-group">
                  <label htmlFor="email">Email (opsional)</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                  />
                </div>
                <button type="submit" className="hero-submit-btn" disabled={!name.trim() || busy}>
                  <span>{busy ? 'Menyiapkan…' : 'Mulai Asesmen'}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </form>

            {error && <p className="alert">{error}</p>}

            <div className="hero-meta-badges">
              <span className="hero-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>±2 penyelesaian dalam 7–8 menit</span>
              </span>
              <span className="hero-meta-dot">•</span>
              <span className="hero-meta-item">
                <span>Waktu pengerjaan 15–20 menit</span>
              </span>
            </div>
          </div>

          {/* Right Column: Hero Preview Card */}
          <div className="hero-preview-wrapper">
            <div className="hero-preview-card">
              <div className="preview-card-grid">
                {/* Left side: Radar chart */}
                <div className="preview-chart-pane">
                  <div className="preview-pane-header">
                    <span className="preview-accent-bar" />
                    <h3>Gambaran Profil Kepemimpinan Anda</h3>
                  </div>
                  <div className="preview-radar-box">
                    <Radar
                      values={dimensions.map((_, i) => ART_SHAPE[i % ART_SHAPE.length])}
                      labels={dimensions.map((d) => d.short_name || d.name)}
                      size={270}
                    />
                  </div>
                </div>

                {/* Right side: Mock profile result card */}
                <div className="preview-profile-pane">
                  <div className="preview-profile-info">
                    <span className="preview-profile-sub">Profil Kepemimpinan Anda</span>
                    <h4 className="preview-profile-title">Pemimpin Adaptif</h4>
                    <p className="preview-profile-desc">
                      Anda memiliki kesadaran diri yang baik, mampu beradaptasi dengan perubahan, dan peduli pada orang lain.
                    </p>
                  </div>

                  <div className="preview-tip-box">
                    <span className="preview-tip-icon" aria-hidden="true">💡</span>
                    <p>Terus kembangkan kekuatan Anda untuk menjadi pemimpin yang lebih berdampak.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dimensions Section */}
      <section className="landing-dimensions" id="program">
        <div className="landing-dimensions-container">
          <div className="dimensions-header">
            <span className="dimensions-accent-bar" />
            <h2>Dimensi yang diukur</h2>
            <p>Asesmen ini mengukur 7 dimensi utama kepemimpinan Anda.</p>
          </div>

          <div className="dimensions-cards-grid">
            {dimensions.map((d, index) => (
              <div key={d.id} className="dim-feature-card">
                <div className="dim-icon-circle">
                  {getDimensionIcon(index)}
                </div>
                <h3>{d.name}</h3>
                <p>{d.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="footer-left">
            <p className="footer-copy">© {new Date().getFullYear()} AHA Leadership Centre. All rights reserved.</p>
            <span className="footer-version">Versi asesmen {version}</span>
          </div>
          <div className="footer-right">
            <a className="footer-admin-link" href="#/admin">
              Masuk Dashboard Admin →
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Quiz({ config, session, answers, index, busy, error, onAnswer, onNavigate, onSubmit, onExit }) {
  const [confirming, setConfirming] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const questions = config?.questions ?? []
  const question = questions[index]
  const answeredCount = questions.filter((q) => answers[q.id]).length
  const isLast = index === questions.length - 1
  const currentAnswer = answers[question?.id]

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && navOpen) {
        setNavOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navOpen])

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

  function handleJump(targetIndex) {
    onNavigate(targetIndex)
    if (window.innerWidth < 1024) {
      setNavOpen(false)
    }
  }

  return (
    <div className="quiz-layout">
      {/* Top Header Bar */}
      <header className="quiz-header">
        <div className="quiz-header-inner">
          <div className="quiz-header-left">
            {/* Toggle Question Navigator Drawer on Left */}
            <button
              type="button"
              className={'quiz-nav-toggle-btn' + (navOpen ? ' active' : '')}
              onClick={() => setNavOpen((prev) => !prev)}
              aria-label={navOpen ? 'Tutup Daftar Soal' : 'Buka Daftar Soal'}
              aria-expanded={navOpen}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              <span className="quiz-nav-toggle-text">Daftar Soal</span>
              <span className="quiz-nav-badge">{answeredCount}/{questions.length}</span>
            </button>
          </div>

          <div className="quiz-header-brand">
            <img className="quiz-header-logo" src={logo} alt="AHA Leadership Centre" />
            <h1 className="quiz-header-title">Leadership Assessment</h1>
          </div>

          <div className="quiz-header-right">
            <button
              type="button"
              className="quiz-close-btn"
              aria-label="Tutup asesmen"
              onClick={() => setConfirmExit(true)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Left Drawer Backdrop */}
      <div
        className={'quiz-drawer-backdrop' + (navOpen ? ' open' : '')}
        role="presentation"
        onClick={() => setNavOpen(false)}
      />

      {/* Left Question Navigator Drawer */}
      <aside
        className={'quiz-sidebar-drawer' + (navOpen ? ' open' : '')}
        aria-label="Question Navigator"
        aria-hidden={!navOpen}
      >
        <div className="quiz-drawer-header">
          <div className="quiz-drawer-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
            <h3>Question Navigator</h3>
          </div>
          <button
            type="button"
            className="quiz-drawer-close"
            onClick={() => setNavOpen(false)}
            aria-label="Tutup navigator"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div className="quiz-legend-row">
          <span className="quiz-legend-item">
            <span className="quiz-legend-bullet current" />
            <span>Saat ini</span>
          </span>
          <span className="quiz-legend-item">
            <span className="quiz-legend-bullet answered" />
            <span>Sudah ({answeredCount})</span>
          </span>
          <span className="quiz-legend-item">
            <span className="quiz-legend-bullet unanswered" />
            <span>Belum ({questions.length - answeredCount})</span>
          </span>
        </div>

        {/* Scrollable Numbers Grid */}
        <div className="quiz-numbers-scroll-box">
          <div className="quiz-numbers-grid">
            {questions.map((q, idx) => {
              const isCurrent = idx === index
              const isAnswered = Boolean(answers[q.id])

              let cellClass = 'quiz-num-cell'
              if (isCurrent) cellClass += ' current'
              else if (isAnswered) cellClass += ' answered'
              else cellClass += ' unanswered'

              return (
                <button
                  key={q.id}
                  type="button"
                  className={cellClass}
                  aria-label={`Soal nomor ${idx + 1}`}
                  onClick={() => handleJump(idx)}
                >
                  <span>{idx + 1}</span>
                  {isAnswered && !isCurrent && (
                    <span className="quiz-check-dot">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Hint Box */}
        <div className="quiz-hint-box">
          <div className="quiz-hint-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <p>Klik nomor untuk melompat langsung ke pertanyaan tersebut.</p>
        </div>
      </aside>

      {/* Main Container — Full Display & Centered Focus */}
      <main className="quiz-center-wrap">
        <div className="quiz-card-centered">
          {/* Progress bar + Counter */}
          <div className="quiz-progress-row">
            <div
              className="quiz-progress-track"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax={questions.length}
              aria-valuenow={index + 1}
            >
              <div
                className="quiz-progress-fill"
                style={{ width: `${((index + 1) / questions.length) * 100}%` }}
              />
            </div>
            <span className="quiz-progress-counter">
              {index + 1} dari {questions.length} soal
            </span>
          </div>

          {/* Badge Pertanyaan */}
          <div className="quiz-badge-wrap">
            <span className="quiz-badge">Pertanyaan</span>
          </div>

          {/* Question Text */}
          <h2 key={question.id} className="quiz-statement">
            {question.text}
          </h2>

          {/* Scale Options (1 to 5) */}
          <div className="quiz-options-group" role="group" aria-label="Pilihan jawaban">
            {SCALE.map((label, i) => {
              const val = i + 1
              const isSelected = currentAnswer === val
              return (
                <button
                  key={label}
                  type="button"
                  className={'quiz-option-row' + (isSelected ? ' selected' : '')}
                  onClick={() => onAnswer(question.id, val)}
                >
                  <span className={'quiz-radio-circle' + (isSelected ? ' active' : '')}>
                    {isSelected && <span className="quiz-radio-inner" />}
                  </span>
                  <span className="quiz-option-num">{val}</span>
                  <span className="quiz-option-label">{label}</span>
                </button>
              )
            })}
          </div>

          {error && <p className="alert">{error}</p>}

          {/* Bottom Actions */}
          <div className="quiz-footer-actions">
            <button
              type="button"
              className="quiz-btn-prev"
              disabled={index === 0}
              onClick={() => onNavigate(index - 1)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Sebelumnya</span>
            </button>

            <button
              type="button"
              className="quiz-btn-next"
              disabled={!currentAnswer || busy}
              onClick={next}
            >
              <span>{isLast ? 'Selesai & kirim' : 'Berikutnya'}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* Confirmation Modal Submit */}
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

      {/* Exit Confirmation Modal */}
      {confirmExit && (
        <div className="overlay" role="presentation" onClick={() => setConfirmExit(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="exit-title">Keluar dari asesmen?</h2>
            <p className="meta">
              Jawaban yang sudah Anda isi tersimpan otomatis di perangkat ini. Anda dapat melanjutkannya nanti.
            </p>
            <div className="actions">
              <button className="btn" onClick={onExit}>
                Ya, kembali ke menu utama
              </button>
              <button className="link" onClick={() => setConfirmExit(false)}>
                Lanjutkan asesmen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
