import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { RequireAuth } from './components/auth/RequireAuth'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/LoginPage'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { AssetsPage } from './pages/AssetsPage'
import { AssetDetailPage } from './pages/AssetDetailPage'
import { IncidentsPage } from './pages/IncidentsPage'
import { IncidentDetailPage } from './pages/IncidentDetailPage'
import { DevicesPage } from './pages/DevicesPage'
import { LogsPage } from './pages/LogsPage'
import { UsersPage } from './pages/UsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/:id" element={<AssetDetailPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="incidents/:id" element={<IncidentDetailPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route element={<RequireAuth roles={['admin']} />}>
            <Route path="devices" element={<DevicesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
