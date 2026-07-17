import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { todayISO } from '../../core/format'
import { formatBRL, fromCents, maskMoneyInput } from '../../core/money'
import { Button, Input, useToast } from '../../shared/components/ui'
import { useClients } from '../clients/hooks'
import { useSettings } from '../settings/hooks'
import { useSaveLoan } from './hooks'

type JurosMode = 'taxa' | 'valor'

export function LoanFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { data: clients } = useClients()
  const save = useSaveLoan()

  const [clientId, setClientId] = useState(params.get('cliente') ?? '')
  const [principalCents, setPrincipalCents] = useState(0)
  const [principalDisplay, setPrincipalDisplay] = useState('')
  const [loanDate, setLoanDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [mode, setMode] = useState<JurosMode>('taxa')
  const [rate, setRate] = useState('20')
  const [rateTouched, setRateTouched] = useState(false)
  const { data: settings } = useSettings()

  // taxa padrão vem das configurações do usuário
  useEffect(() => {
    if (settings && !rateTouched) setRate(String(Number(settings.default_interest_rate)))
  }, [settings, rateTouched])
  const [interestCents, setInterestCents] = useState(0)
  const [interestDisplay, setInterestDisplay] = useState('')
  const [notes, setNotes] = useState('')

  const activeClients = useMemo(
    () => (clients ?? []).filter((c) => c.status === 'ativo'),
    [clients],
  )

  // Juros calculados: taxa → valor (sempre em centavos inteiros)
  const rateNumber = Number(rate.replace(',', '.')) || 0
  const computedInterestCents =
    mode === 'taxa' ? Math.round((principalCents * rateNumber) / 100) : interestCents
  const computedRate =
    mode === 'valor' && principalCents > 0
      ? (interestCents / principalCents) * 100
      : rateNumber
  const totalCents = principalCents + computedInterestCents

  useEffect(() => {
    if (mode === 'taxa') {
      setInterestDisplay(computedInterestCents ? formatBRL(computedInterestCents) : '')
    }
  }, [mode, computedInterestCents])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) return toast('Escolha o cliente', 'error')
    if (principalCents <= 0) return toast('Informe o valor emprestado', 'error')
    if (!dueDate) return toast('Informe a data prevista de pagamento', 'error')
    if (dueDate < loanDate)
      return toast('O vencimento não pode ser antes do empréstimo', 'error')
    try {
      await save.mutateAsync({
        client_id: clientId,
        principal: fromCents(principalCents),
        loan_date: loanDate,
        due_date: dueDate,
        interest_rate: mode === 'taxa' ? rateNumber : Math.round(computedRate * 10000) / 10000,
        interest_amount: fromCents(computedInterestCents),
        notes: notes.trim() || null,
      })
      toast('Empréstimo registrado ✅')
      navigate(-1)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div className="px-5 pt-8">
      <button onClick={() => navigate(-1)} className="mb-2 text-sm font-medium text-brand-700">
        ‹ Voltar
      </button>
      <h1 className="text-2xl font-extrabold">Novo empréstimo</h1>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4 pb-8">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink/70">Cliente *</span>
          <select
            className="h-13 w-full appearance-none rounded-2xl border border-ink/10 bg-white px-4 text-base outline-none focus:border-brand-600"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="">Escolha o cliente…</option>
            {activeClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {activeClients.length === 0 && (
            <span className="mt-1 block text-xs text-amber-600">
              Nenhum cliente ativo — cadastre um cliente primeiro
            </span>
          )}
        </label>

        <Input
          label="Valor emprestado *"
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={principalDisplay}
          onChange={(e) => {
            const { display, cents } = maskMoneyInput(e.target.value)
            setPrincipalDisplay(display)
            setPrincipalCents(cents)
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data do empréstimo *"
            type="date"
            value={loanDate}
            onChange={(e) => setLoanDate(e.target.value)}
            required
          />
          <Input
            label="Vencimento *"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink/70">Juros — informe por:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('taxa')}
              className={`flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition
                ${mode === 'taxa' ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink/10 bg-white text-ink/60'}`}
            >
              Taxa (%)
            </button>
            <button
              type="button"
              onClick={() => setMode('valor')}
              className={`flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition
                ${mode === 'valor' ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink/10 bg-white text-ink/60'}`}
            >
              Valor (R$)
            </button>
          </div>
        </div>

        {mode === 'taxa' ? (
          <Input
            label="Taxa de juros (%)"
            inputMode="decimal"
            placeholder="20"
            value={rate}
            onChange={(e) => {
              setRateTouched(true)
              setRate(e.target.value.replace(/[^\d.,]/g, ''))
            }}
            hint={
              principalCents > 0
                ? `Juros: ${formatBRL(computedInterestCents)}`
                : 'Informe o valor emprestado para calcular'
            }
          />
        ) : (
          <Input
            label="Valor dos juros (R$)"
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={interestDisplay}
            onChange={(e) => {
              const { display, cents } = maskMoneyInput(e.target.value)
              setInterestDisplay(display)
              setInterestCents(cents)
            }}
            hint={
              principalCents > 0 && interestCents > 0
                ? `Equivale a ${computedRate.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
                : undefined
            }
          />
        )}

        <div className="rounded-2xl bg-brand-50 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-ink/60">Principal</span>
            <strong>{formatBRL(principalCents)}</strong>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-ink/60">Juros previstos</span>
            <strong className="text-brand-700">{formatBRL(computedInterestCents)}</strong>
          </div>
          <div className="mt-2 flex justify-between border-t border-brand-200 pt-2">
            <span className="font-semibold">Total previsto</span>
            <strong className="text-lg text-brand-800">{formatBRL(totalCents)}</strong>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink/70">Observações</span>
          <textarea
            className="min-h-20 w-full rounded-2xl border border-ink/10 bg-white p-4 text-base outline-none placeholder:text-ink/30 focus:border-brand-600"
            placeholder="Anotações sobre o empréstimo"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <Button type="submit" loading={save.isPending} className="mt-2">
          Registrar empréstimo
        </Button>
      </form>
    </div>
  )
}
