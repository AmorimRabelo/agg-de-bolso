import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../core/supabase'
import { Button, Input, useToast } from '../../shared/components/ui'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './useAuth'

export function NewPasswordPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { clearRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

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
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast('Não foi possível alterar a senha. Tente novamente.', 'error')
      return
    }
    clearRecovery()
    toast('Senha alterada com sucesso ✅')
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha sua nova senha de acesso">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" loading={loading}>
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  )
}
