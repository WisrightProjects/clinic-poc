import { Routes, Route, Navigate } from 'react-router-dom'
import RequireDoctor from './components/RequireDoctor'
import DoctorDashboardPage from './pages/DoctorDashboardPage'
import LoginPage from './pages/LoginPage'

// Doctor web. Signed in with a mobile number + password (CLINIC-008); the token is
// sent as a Bearer header on every API call (see utils/apiClient.js).
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* The open patient is in the URL (/doctor/:visitId) so the phone's back button
          returns to the queue. One optional-segment route, so moving between the queue and
          a patient keeps the same page mounted (no reload of the polled queue). */}
      <Route
        path="/doctor/:visitId?"
        element={
          <RequireDoctor>
            <DoctorDashboardPage />
          </RequireDoctor>
        }
      />
      <Route path="*" element={<Navigate to="/doctor" replace />} />
    </Routes>
  )
}
