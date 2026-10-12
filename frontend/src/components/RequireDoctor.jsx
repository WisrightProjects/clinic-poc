// Route gate (CLINIC-008.5): the doctor dashboard needs a signed-in doctor.
// No session -> /login (also reached the moment a logout or 401 clears it). An
// attender account never gets a stored session on the web (see LoginPage); the
// backend enforces the same on its doctor-only actions.
import { Navigate } from 'react-router-dom'
import { useSession, isDoctor } from '../utils/authStore'

export default function RequireDoctor({ children }) {
  const session = useSession()
  if (!session) return <Navigate to="/login" replace />
  if (!isDoctor(session)) {
    return (
      <div className="guard">
        <h1>Doctor access only</h1>
        <p>This dashboard is restricted to doctor accounts.</p>
      </div>
    )
  }
  return children
}
