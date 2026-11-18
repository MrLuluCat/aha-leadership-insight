import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from './lib/supabase'
import { useAuth } from './lib/useAuth'
import AdminLogin from './admin/AdminLogin'
import Overview from './admin/Overview'
import Results from './admin/Results'
import Questions from './admin/Questions'
import Dimensions from './admin/Dimensions'
import Versions from './admin/Versions'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'results', label: 'Hasil Peserta' },
  { id: 'questions', label: 'Pertanyaan' },
  { id: 'dimensions', label: 'Dimensi & Bobot' },
  { id: 'versions', label: 'Versi Asesmen' },
]

const tabFromHash = () => {
  const value = window.location.hash.replace(/^#\/admin\/?/, '')
  return TABS.some((tab) => tab.id === value) ? value : 'overview'
}

export default function Admin() {
  const auth = useAuth()
  const [tab, setTab] = useState(tabFromHash)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function navigate(nextTab) {
    window.location.hash = `#/admin/${nextTab}`
    setTab(nextTab)
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="wrap splash">
        <div className="card">
          <p className="brand">Dashboard admin</p>
          <h1 className="splash-title">Supabase belum dikonfigurasi</h1>
          <p className="lead">
            {supabaseConfigError ||
              'Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env, lalu jalankan ulang aplikasi.'}
          </p>
          <a className="link" href="#/">
            Kembali ke asesmen
          </a>
        </div>
      </main>
    )
  }

  if (auth.loading) {
    return (
      <main className="wrap splash">
        <p className="brand">Dashboard admin</p>
        <p className="meta">Memeriksa sesi…</p>
      </main>
    )
  }

  if (!auth.session) {
    return <AdminLogin onLogin={auth.login} />
  }

  if (auth.error) {
    return (
      <Blocked
        title="Gagal memuat profil admin"
        message={auth.error}
        email={auth.session.user.email}
        onLogout={auth.logout}
      />
    )
  }

  if (!auth.profile) {
    return (
      <Blocked
        title="Profil admin tidak ditemukan"
        message="Akun ini belum memiliki profil admin. Hubungi administrator untuk mengaktifkan akses."
        email={auth.session.user.email}
        onLogout={auth.logout}
      />
    )
  }

  if (auth.profile.role !== 'admin' || !auth.profile.is_active) {
    return (
      <Blocked
        title="Akun belum diaktifkan"
        message="Akun Anda belum memiliki akses aktif ke dashboard. Hubungi administrator."
        email={auth.profile.email}
        onLogout={auth.logout}
      />
    )
  }

  return (
    <main className="wrap admin">
      <header className="ahead">
        <div>
          <p className="brand">Dashboard admin</p>
          <h1>AHA Leadership Insight</h1>
        </div>
        <div className="admin-user">
          <span className="meta">{auth.profile.email}</span>
          <a className="link" href="#/">
            Lihat asesmen
          </a>
          <button className="link" onClick={auth.logout}>
            Keluar
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Navigasi admin">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={'tab' + (tab === item.id ? ' on' : '')}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="admin-body">
        {tab === 'overview' && <Overview />}
        {tab === 'results' && <Results />}
        {tab === 'questions' && <Questions />}
        {tab === 'dimensions' && <Dimensions />}
        {tab === 'versions' && <Versions />}
      </section>
    </main>
  )
}

function Blocked({ title, message, email, onLogout }) {
  return (
    <main className="wrap splash">
      <div className="card">
        <p className="brand">Dashboard admin</p>
        <h1 className="splash-title">{title}</h1>
        <p className="lead">{message}</p>
        {email && <p className="meta">Masuk sebagai {email}</p>}
        <div className="actions">
          <button className="btn" onClick={onLogout}>
            Keluar
          </button>
          <a className="link" href="#/">
            Kembali ke asesmen
          </a>
        </div>
      </div>
    </main>
  )
}
