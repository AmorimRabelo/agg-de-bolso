import { useEffect, useState } from 'react'
import { supabase } from '../../core/supabase'
import { useAuth } from '../auth/useAuth'
import { Button, Card, Input, useToast } from '../../shared/components/ui'
import { useSaveSettings, useSettings } from './hooks'

export function SettingsPage() {
  const { session } = useAuth()
  const toast = useToast()
  const { data: settings } = useSettings()
  const save = useSaveSettings()

  const [company, setCompany] = useState('')
  const [rate, setRate] = useState('')

  useEffect(() => {
    if (!settings) return
    setCompany(settings.company_name ?? '')
    setRate(String(Number(settings.default_interest_rate)))
  }, [settings])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const rateNumber = Number(rate.replace(',', '.'))
    if (!Number.isFinite(rateNumber) || rateNumber < 0)
      return toast('Taxa padrão inválida', 'error')
    try {
      await save.mutateAsync({
        company_name: company.trim() || null,
        default_interest_rate: rateNumber,
        theme: settings?.theme ?? 'claro',
      })
      toast('Configurações salvas ✅')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div className="px-5 pt-8 pb-6">
      <h1 className="text-2xl font-extrabold">Ajustes</h1>

      <Card className="mt-5">
        <p className="text-sm text-ink/50">Conectado como</p>
        <p className="font-semibold">{session?.user.email}</p>
      </Card>

      <form onSubmit={handleSave} className="mt-4 flex flex-col gap-4">
        <Input
          label="Nome da empresa"
          placeholder="Ex.: Empréstimos do Marcus"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          hint="Aparece no topo do painel"
        />
        <Input
          label="Taxa padrão de juros (%)"
          inputMode="decimal"
          placeholder="20"
          value={rate}
          onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
          hint="Sugerida automaticamente ao criar um empréstimo"
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink/70">Tema</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-2xl border border-brand-700 bg-brand-700 py-2.5 text-sm font-semibold text-white"
            >
              Claro
            </button>
            <button
              type="button"
              disabled
              className="flex-1 rounded-2xl border border-ink/10 bg-white py-2.5 text-sm font-semibold text-ink/30"
            >
              Escuro (em breve)
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink/70">Moeda</span>
          <div className="rounded-2xl border border-ink/10 bg-white px-4 py-3 text-ink/50">
            Real brasileiro (R$)
          </div>
        </div>

        <Button type="submit" loading={save.isPending}>
          Salvar configurações
        </Button>
      </form>

      <div className="mt-6">
        <Button variant="danger" onClick={() => supabase.auth.signOut()}>
          Sair da conta
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-ink/30">Agg de Bolso · versão 1.0</p>
    </div>
  )
}
