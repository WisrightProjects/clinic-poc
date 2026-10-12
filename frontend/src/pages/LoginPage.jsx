// Doctor sign-in (CLINIC-008.5): mobile number + password -> POST /api/auth/login.
// Only doctor accounts may use the web dashboard; an attender login is refused here
// and no session is stored.
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { login } from '../utils/apiClient'
import { useSession, saveSession, isDoctor } from '../utils/authStore'

export default function LoginPage() {
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const session = useSession()

  if (session) return <Navigate to="/doctor" replace />

  const canSubmit = mobile.trim() && password && !submitting

  async function onSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await login(mobile.trim(), password)
      if (!isDoctor(result)) {
        setError('This dashboard is for doctors. Attenders sign in on the mobile app.')
        return
      }
      saveSession(result) // the session change redirects to /doctor
    } catch (err) {
      setError(err.status ? err.message : 'Cannot reach the server. Check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1 className="login-brand">ClinicAI</h1>
        <p className="login-sub">Doctor sign in</p>

        <label className="login-label" htmlFor="mobile">Mobile number</label>
        <input
          id="mobile"
          className="login-input"
          type="tel"
          inputMode="numeric"
          autoComplete="username"
          placeholder="10-digit mobile number"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          disabled={submitting}
          autoFocus
        />

        <label className="login-label" htmlFor="password">Password</label>
        <input
          id="password"
          className="login-input"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />

        {error ? <div className="login-error" role="alert">{error}</div> : null}

        <button className="login-btn" type="submit" disabled={!canSubmit}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
