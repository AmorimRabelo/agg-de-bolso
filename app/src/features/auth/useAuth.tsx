import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase'

type AuthState = {
  session: Session | null
  loading: boolean
  /** true quando o usuário chegou por um link de recuperação de senha */
  recovery: boolean
  clearRecovery: () => void
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  recovery: false,
  clearRecovery: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    // sessão persistente: o supabase-js guarda e renova o token sozinho
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{ session, loading, recovery, clearRecovery: () => setRecovery(false) }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
