import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../core/supabase'
import { Button, Input, useToast } from '../../shared/components/ui'
import { AuthLayout } from './AuthLayout'

export function RecoverPage() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    })
    setLoading(false)
    if (error) {
      toast('Não foi possível enviar o e-mail. Tente novamente.', 'error')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title="E-mail enviado 📬">
        <p className="text-ink/70">
          Se existir uma conta para <strong>{email}</strong>, você receberá um link
          para criar uma nova senha. Abra o link <strong>neste mesmo aparelho</strong>.
        </p>
        <div className="mt-5">
          <Link to="/entrar">
            <Button>Voltar para o login</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Enviaremos um link para o seu e-mail"
    >
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
        <Button type="submit" loading={loading}>
          Enviar link
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink/60">
        Lembrou a senha?{' '}
        <Link to="/entrar" className="font-semibold text-brand-700">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}
