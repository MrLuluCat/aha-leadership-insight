import { useState } from 'react'
import logo from '../assets/aha-logo.jpg'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onLogin(email.trim(), password)
    } catch (err) {
      setError(err.message || 'Login gagal. Periksa email dan password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="wrap login-wrap">
      <div className="card login">
        <img className="logo sm" src={logo} alt="AHA Leadership Centre" />
        <h1 className="splash-title">Dashboard admin</h1>
        <p className="meta">Masuk menggunakan akun admin yang terdaftar.</p>
        <form onSubmit={submit} className="start">
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <button className="btn" disabled={busy || !email.trim() || !password}>
            {busy ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>
        {error && <p className="alert">{error}</p>}
        <p className="meta login-note">
          Akun admin dibuat melalui Supabase Dashboard. Tidak tersedia pendaftaran publik.
        </p>
        <a className="link" href="#/">
          Kembali ke asesmen
        </a>
      </div>
    </main>
  )
}
