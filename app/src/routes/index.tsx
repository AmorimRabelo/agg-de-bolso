import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { useToast } from '../shared/components/ui'
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
import { SubscriptionGate } from '../features/subscription/SubscriptionGate'
import { SubscriptionPage } from '../features/subscription/SubscriptionPage'
import { AdminPage } from '../features/subscription/AdminPage'
import { NotificationsPage } from '../features/notifications/NotificationsPage'
import { PrivacyPage, TermsPage } from '../features/legal/LegalPages'
import { AppLayout } from './AppLayout'
import { Splash } from '../shared/components/ui'

/**
 * Recebe quem chega por link de e-mail do Supabase (confirmação de conta ou
 * recuperação de senha). Esses links voltam com "#access_token=..." ou
 * "#error=...", que colidem com as rotas do app — este portão segura o
 * roteador até o supabase-js processar o token, e então leva o usuário
 * para o lugar certo (painel ou nova senha), com erro amigável se o link venceu.
 */
function AuthCallbackGate({ children }: { children: React.ReactNode }) {
  const toast = useToast()
  const { session, recovery } = useAuth()
  const [pending, setPending] = useState(() => {
    const h = window.location.hash
    return h.length > 1 && !h.startsWith('#/')
  })

  useEffect(() => {
    if (!pending) return
    const h = window.location.hash
    if (h.includes('error')) {
      const params = new URLSearchParams(h.replace(/^#/, ''))
      const code = params.get('error_code') ?? ''
      toast(
        code === 'otp_expired'
          ? 'Este link expirou. Faça login ou peça um novo link.'
          : 'Link inválido ou expirado. Tente novamente.',
        'error',
      )
      window.location.hash = '#/entrar'
      setPending(false)
      return
    }
    // token válido: aguarda o supabase-js criar a sessão (limite de 6s)
    const t = setTimeout(() => {
      window.location.hash = '#/'
      setPending(false)
    }, 6000)
    return () => clearTimeout(t)
  }, [pending, toast])

  useEffect(() => {
    if (pending && (session || recovery)) {
      window.location.hash = recovery ? '#/nova-senha' : '#/'
      setPending(false)
    }
  }, [pending, session, recovery])

  if (pending) return <Splash />
  return <>{children}</>
}

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading, recovery } = useAuth()
  if (loading) return <Splash />
  if (recovery) return <Navigate to="/nova-senha" replace />
  if (!session) return <Navigate to="/entrar" replace />
  return <SubscriptionGate>{children}</SubscriptionGate>
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
    <AuthCallbackGate>
      <RouterTree />
    </AuthCallbackGate>
  )
}

function RouterTree() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/entrar" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/criar-conta" element={<GuestOnly><SignupPage /></GuestOnly>} />
        <Route path="/recuperar-senha" element={<GuestOnly><RecoverPage /></GuestOnly>} />
        <Route path="/nova-senha" element={<NewPasswordPage />} />
        <Route path="/termos" element={<TermsPage />} />
        <Route path="/privacidade" element={<PrivacyPage />} />
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
          <Route path="/notificacoes" element={<NotificationsPage />} />
          <Route path="/assinatura" element={<SubscriptionPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
