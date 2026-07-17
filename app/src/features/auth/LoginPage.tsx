import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../core/supabase'
import { Button, Input, useToast } from '../../shared/components/ui'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      const msg = error.message.includes('Invalid login')
        ? 'E-mail ou senha incorretos'
        : error.message.includes('Email not confirmed')
          ? 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada)'
          : 'Não foi possível entrar. Tente novamente.'
      toast(msg, 'error')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Entrar" subtitle="Acesse sua carteira de empréstimos">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
      </form>
      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        <Link to="/recuperar-senha" className="font-medium text-brand-700">
          Esqueci minha senha
        </Link>
        <p className="text-ink/60">
          Ainda não tem conta?{' '}
          <Link to="/criar-conta" className="font-semibold text-brand-700">
            Criar conta
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
