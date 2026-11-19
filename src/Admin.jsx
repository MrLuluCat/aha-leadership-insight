import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from './lib/supabase'
import { useAuth } from './lib/useAuth'
import PageLoader from './components/PageLoader'
import Icon from './admin/icons'
import logo from './assets/aha-logo.jpg'

const AdminLogin = lazy(() => import('./admin/AdminLogin'))
const Overview = lazy(() => import('./admin/Overview'))
const Results = lazy(() => import('./admin/Results'))
const Questions = lazy(() => import('./admin/Questions'))
const Dimensions = lazy(() => import('./admin/Dimensions'))
const Versions = lazy(() => import('./admin/Versions'))
const DataManagement = lazy(() => import('./admin/DataManagement'))

const TABS = [
  { id: 'overview', label: 'Dashboard', icon: 'home' },
  { id: 'results', label: 'Hasil Peserta', icon: 'results' },
  { id: 'questions', label: 'Pertanyaan', icon: 'questions' },
  { id: 'dimensions', label: 'Dimensi & Bobot', icon: 'dimensions' },
  { id: 'versions', label: 'Versi Asesmen', icon: 'versions' },
  { id: 'data', label: 'Kelola Data', icon: 'database' },
]

const tabFromHash = () => {
  const value = window.location.hash.replace(/^#\/admin\/?/, '')
  return TABS.some((tab) => tab.id === value) ? value : 'overview'
}

export default function Admin() {
  const auth = useAuth()
  const [tab, setTab] = useState(tabFromHash)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const onHash = () => {
      setTab(tabFromHash())
      setMenuOpen(false)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function navigate(nextTab) {
    window.location.hash = `#/admin/${nextTab}`
    setTab(nextTab)
    setMenuOpen(false)
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
    return <PageLoader label="Memeriksa sesi admin…" />
  }

  if (!auth.session) {
    return (
      <Suspense fallback={<PageLoader label="Memuat halaman login…" />}>
        <AdminLogin onLogin={auth.login} />
      </Suspense>
    )
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
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">Lewati ke konten</a>

      {/* Mobile Top Navbar with Burger */}
      <header className="mobile-admin-bar">
        <button
          type="button"
          className="burger-btn"
          aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
        </button>
        <img className="mobile-bar-logo" src={logo} alt="AHA Leadership Insight" />
        <div style={{ width: 40 }} aria-hidden="true" />
      </header>

      {/* Overlay backdrop on mobile */}
      {menuOpen && (
        <div
          className="side-backdrop"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`side ${menuOpen ? 'open' : ''}`} aria-label="Sidebar">
        <div className="side-header">
          <img className="side-logo" src={logo} alt="AHA Leadership Insight" />
          <button
            type="button"
            className="side-close-btn"
            aria-label="Tutup navigasi"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <nav className="tabs" aria-label="Navigasi admin">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={'tab' + (tab === item.id ? ' on' : '')}
              aria-current={tab === item.id ? 'page' : undefined}
              aria-label={item.label}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ── User account block – pinned to bottom of sidebar ── */}
        <div className="side-user-block">
          <div className="user-dropdown-container" ref={dropdownRef}>
            <button
              type="button"
              className="user-trigger side-user-trigger"
              aria-label="Menu akun admin"
              aria-expanded={userDropdownOpen}
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            >
              <span className="avatar" aria-hidden="true">
                {(auth.profile.email || 'A').charAt(0).toUpperCase()}
              </span>
              <span className="user-trigger-info">
                <span className="user-trigger-email">{auth.profile.email}</span>
                <span className="user-trigger-badge">Administrator</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>

            {userDropdownOpen && (
              <div className="user-dropdown-menu side-user-dropdown" role="menu">
                <div className="user-dropdown-header">
                  <span className="dropdown-label">Masuk sebagai</span>
                  <strong className="dropdown-email">{auth.profile.email}</strong>
                </div>
                <div className="dropdown-divider" />
                <a
                  className="dropdown-item"
                  href="#/"
                  role="menuitem"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <Icon name="external" size={16} />
                  <span>Lihat asesmen</span>
                </a>
                <button
                  type="button"
                  className="dropdown-item danger"
                  role="menuitem"
                  onClick={() => {
                    setUserDropdownOpen(false)
                    auth.logout()
                  }}
                >
                  <Icon name="logout" size={16} />
                  <span>Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="admin-main" id="admin-content">
        <section className="admin-body">
          <Suspense fallback={<PageLoader variant="admin" label="Memuat halaman…" />}>
            {tab === 'overview' && <Overview />}
            {tab === 'results' && <Results />}
            {tab === 'questions' && <Questions />}
            {tab === 'dimensions' && <Dimensions />}
            {tab === 'versions' && <Versions />}
            {tab === 'data' && <DataManagement />}
          </Suspense>
        </section>
      </main>
    </div>
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
