import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../core/supabase'
import { Button, Input, useToast } from '../../shared/components/ui'
import { AuthLayout } from './AuthLayout'

export function SignupPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast('A senha precisa ter pelo menos 6 caracteres', 'error')
      return
    }
    if (password !== confirm) {
      toast('As senhas não conferem', 'error')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    })
    setLoading(false)
    if (error) {
      const msg = error.message.includes('already registered')
        ? 'Este e-mail já possui uma conta'
        : 'Não foi possível criar a conta. Tente novamente.'
      toast(msg, 'error')
      return
    }
    // Se a confirmação de e-mail estiver ativada, não há sessão ainda
    if (!data.session) {
      setDone(true)
      return
    }
    navigate('/', { replace: true })
  }

  if (done) {
    return (
      <AuthLayout title="Confira seu e-mail 📬">
        <p className="text-ink/70">
          Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele
          para ativar sua conta e depois volte aqui para entrar.
        </p>
        <div className="mt-5">
          <Link to="/entrar">
            <Button>Ir para o login</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Leva menos de um minuto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Seu nome"
          autoComplete="name"
          placeholder="Nome completo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
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
          autoComplete="new-password"
          placeholder="Mínimo de 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" loading={loading}>
          Criar conta
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink/60">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-semibold text-brand-700">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}
