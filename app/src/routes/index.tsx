import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { LoginPage } from '../features/auth/LoginPage'
import { SignupPage } from '../features/auth/SignupPage'
import { RecoverPage } from '../features/auth/RecoverPage'
import { NewPasswordPage } from '../features/auth/NewPasswordPage'
import { HomePage } from '../features/dashboard/HomePage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { ClientsPage } from '../features/clients/ClientsPage'
import { ClientFormPage } from '../features/clients/ClientFormPage'
import { ClientDetailPage } from '../features/clients/ClientDetailPage'
import { LoansPage } from '../features/loans/LoansPage'
import { LoanFormPage } from '../features/loans/LoanFormPage'
import { LoanDetailPage } from '../features/loans/LoanDetailPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { AppLayout } from './AppLayout'
import { Splash } from '../shared/components/ui'

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading, recovery } = useAuth()
  if (loading) return <Splash />
  if (recovery) return <Navigate to="/nova-senha" replace />
  if (!session) return <Navigate to="/entrar" replace />
  return <>{children}</>
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { session, loading, recovery } = useAuth()
  if (loading) return <Splash />
  if (recovery) return <Navigate to="/nova-senha" replace />
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}

export function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/entrar" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/criar-conta" element={<GuestOnly><SignupPage /></GuestOnly>} />
        <Route path="/recuperar-senha" element={<GuestOnly><RecoverPage /></GuestOnly>} />
        <Route path="/nova-senha" element={<NewPasswordPage />} />
        <Route
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/novo" element={<ClientFormPage />} />
          <Route path="/clientes/:id" element={<ClientDetailPage />} />
          <Route path="/clientes/:id/editar" element={<ClientFormPage />} />
          <Route path="/emprestimos" element={<LoansPage />} />
          <Route path="/emprestimos/novo" element={<LoanFormPage />} />
          <Route path="/emprestimos/:id" element={<LoanDetailPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
