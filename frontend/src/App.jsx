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
      <Route
        path="/doctor"
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
