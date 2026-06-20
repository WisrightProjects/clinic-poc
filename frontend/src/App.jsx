import { Routes, Route, Navigate } from 'react-router-dom'
import RequireDoctor from './components/RequireDoctor'
import DoctorDashboardPage from './pages/DoctorDashboardPage'

// Doctor web. Role is asserted (X-Role: doctor), not authenticated (POC).
export default function App() {
  return (
    <Routes>
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
