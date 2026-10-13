// Doctor sign-in (CLINIC-008.5): mobile number + password -> POST /api/auth/login.
// Only doctor accounts may use the web dashboard; an attender login is refused here
// and no session is stored.
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { login } from '../utils/apiClient'
import { useSession, saveSession, isDoctor } from '../utils/authStore'

// Eye (password hidden — click to show) or eye with a slash (shown — click to hide).
function EyeIcon({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {open ? null : <line x1="3" y1="21" x2="21" y2="3" />}
    </svg>
  )
}

export default function LoginPage() {
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const session = useSession()

  if (session) return <Navigate to="/doctor" replace />

  const canSubmit = mobile.trim() && password && !submitting
  const eyeLabel = showPassword ? 'Hide password' : 'Show password'

  async function onSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setShowPassword(false) // submit a password field, so the browser offers to save it
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
        <div className="login-password">
          <input
            id="password"
            className="login-input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          <button
            type="button"
            className="login-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={eyeLabel}
            aria-pressed={showPassword}
            title={eyeLabel}
          >
            <EyeIcon open={!showPassword} />
          </button>
        </div>

        {error ? <div className="login-error" role="alert">{error}</div> : null}

        <button className="login-btn" type="submit" disabled={!canSubmit}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
