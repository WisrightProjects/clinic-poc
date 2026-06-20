// Client-side role gate (POC: no real auth). The doctor role is asserted via a
// constant / ?role= query param. A non-doctor sees a "Doctor access only" guard.
import { ROLE } from '../utils/apiClient'

export default function RequireDoctor({ children }) {
  const params = new URLSearchParams(window.location.search)
  const role = params.get('role') ?? ROLE // defaults to 'doctor' in this POC
  if (role !== 'doctor') {
    return (
      <div className="guard">
        <h1>Doctor access only</h1>
        <p>This dashboard is restricted to the doctor role.</p>
      </div>
    )
  }
  return children
}
