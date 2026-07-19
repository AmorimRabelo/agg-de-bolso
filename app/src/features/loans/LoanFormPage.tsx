import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CALC_MODE,
  PERIODICITY,
  type CalcMode,
  type LoanType,
  type Periodicity,
} from '../../core/constants'
import { formatDate, todayISO } from '../../core/format'
import { formatBRL, fromCents, maskMoneyInput } from '../../core/money'
import { simulateInstallments } from '../../core/parcelas'
import { Button, Input, useToast } from '../../shared/components/ui'
import { useClients } from '../clients/hooks'
import { useSettings } from '../settings/hooks'
import { useSaveLoan } from './hooks'

type JurosMode = 'taxa' | 'valor'

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition
        ${active ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink/10 bg-white text-ink/60'}`}
    >
      {children}
    </button>
  )
}

export function LoanFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { data: clients } = useClients()
  const save = useSaveLoan()

  const [clientId, setClientId] = useState(params.get('cliente') ?? '')
  const [loanType, setLoanType] = useState<LoanType>('unico')
  const [principalCents, setPrincipalCents] = useState(0)
  const [principalDisplay, setPrincipalDisplay] = useState('')
  const [loanDate, setLoanDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [mode, setMode] = useState<JurosMode>('taxa')
  const [rate, setRate] = useState('20')
  const [rateTouched, setRateTouched] = useState(false)
  const [interestCents, setInterestCents] = useState(0)
  const [interestDisplay, setInterestDisplay] = useState('')
  const [notes, setNotes] = useState('')
  // parcelado
  const [numParcelas, setNumParcelas] = useState('4')
  const [periodicity, setPeriodicity] = useState<Periodicity>('mensal')
  const [calcMode, setCalcMode] = useState<CalcMode>('juros_simples')

  const { data: settings } = useSettings()
  useEffect(() => {
    if (settings && !rateTouched) setRate(String(Number(settings.default_interest_rate)))
  }, [settings, rateTouched])

  const activeClients = useMemo(
    () => (clients ?? []).filter((c) => c.status === 'ativo'),
    [clients],
  )

  const rateNumber = Number(rate.replace(',', '.')) || 0
  const n = Math.max(parseInt(numParcelas, 10) || 0, 0)
  const isPrice = loanType === 'parcelado' && calcMode === 'price'

  // Juros do contrato (único e parcelado/juros simples): taxa total OU valor
  const simpleInterestCents =
    mode === 'taxa' ? Math.round((principalCents * rateNumber) / 100) : interestCents

  // Simulação das parcelas (prévia — o banco gera as oficiais com a mesma regra)
  const simulation = useMemo(() => {
    if (loanType !== 'parcelado' || principalCents <= 0 || n < 2 || !dueDate) return null
    if (isPrice && rateNumber <= 0) return null
    return simulateInstallments({
      principalCents,
      n,
      mode: calcMode,
      ratePct: rateNumber,
      interestTotalCents: calcMode === 'juros_simples' ? simpleInterestCents : undefined,
      firstDue: dueDate,
      periodicity,
    })
  }, [loanType, principalCents, n, dueDate, isPrice, rateNumber, calcMode, simpleInterestCents, periodicity])

  const previewInterestCents = isPrice
    ? (simulation?.interestTotalCents ?? 0)
    : simpleInterestCents
  const totalCents = principalCents + previewInterestCents
  const computedRate =
    mode === 'valor' && principalCents > 0 ? (interestCents / principalCents) * 100 : rateNumber

  useEffect(() => {
    if (mode === 'taxa' && !isPrice) {
      setInterestDisplay(simpleInterestCents ? formatBRL(simpleInterestCents) : '')
    }
  }, [mode, isPrice, simpleInterestCents])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) return toast('Escolha o cliente', 'error')
    if (principalCents <= 0) return toast('Informe o valor emprestado', 'error')
    if (!dueDate)
      return toast(
        loanType === 'parcelado' ? 'Informe o 1º vencimento' : 'Informe a data prevista de pagamento',
        'error',
      )
    if (dueDate < loanDate)
      return toast('O vencimento não pode ser antes do empréstimo', 'error')
    if (loanType === 'parcelado') {
      if (n < 2 || n > 120) return toast('Informe de 2 a 120 parcelas', 'error')
      if (isPrice && rateNumber <= 0)
        return toast('A Tabela Price exige taxa por período maior que zero', 'error')
    }
    try {
      await save.mutateAsync({
        client_id: clientId,
        principal: fromCents(principalCents),
        loan_date: loanDate,
        due_date: dueDate,
        interest_rate: isPrice
          ? rateNumber
          : mode === 'taxa'
            ? rateNumber
            : Math.round(computedRate * 10000) / 10000,
        interest_amount: isPrice ? 0 : fromCents(simpleInterestCents),
        notes: notes.trim() || null,
        loan_type: loanType,
        num_installments: loanType === 'parcelado' ? n : null,
        periodicity: loanType === 'parcelado' ? periodicity : null,
        calc_mode: loanType === 'parcelado' ? calcMode : null,
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

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink/70">Tipo de empréstimo</span>
          <div className="flex gap-2">
            <Chip active={loanType === 'unico'} onClick={() => setLoanType('unico')}>
              Pagamento único
            </Chip>
            <Chip active={loanType === 'parcelado'} onClick={() => setLoanType('parcelado')}>
              Parcelado
            </Chip>
          </div>
        </div>

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
            label={loanType === 'parcelado' ? '1º vencimento *' : 'Vencimento *'}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>

        {loanType === 'parcelado' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nº de parcelas *"
                inputMode="numeric"
                placeholder="4"
                value={numParcelas}
                onChange={(e) => setNumParcelas(e.target.value.replace(/\D/g, '').slice(0, 3))}
              />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">Periodicidade</span>
                <select
                  className="h-13 w-full appearance-none rounded-2xl border border-ink/10 bg-white px-4 text-base outline-none focus:border-brand-600"
                  value={periodicity}
                  onChange={(e) => setPeriodicity(e.target.value as Periodicity)}
                >
                  {(Object.keys(PERIODICITY) as Periodicity[]).map((p) => (
                    <option key={p} value={p}>
                      {PERIODICITY[p]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink/70">Cálculo dos juros</span>
              <div className="flex gap-2">
                {(Object.keys(CALC_MODE) as CalcMode[]).map((m) => (
                  <Chip key={m} active={calcMode === m} onClick={() => setCalcMode(m)}>
                    {CALC_MODE[m]}
                  </Chip>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink/50">
                {calcMode === 'price'
                  ? 'Parcela fixa — informe a taxa POR PERÍODO (ex.: ao mês)'
                  : 'Principal e juros divididos igualmente entre as parcelas'}
              </p>
            </div>
          </>
        )}

        {!isPrice && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink/70">Juros — informe por:</span>
            <div className="flex gap-2">
              <Chip active={mode === 'taxa'} onClick={() => setMode('taxa')}>
                Taxa (%)
              </Chip>
              <Chip active={mode === 'valor'} onClick={() => setMode('valor')}>
                Valor (R$)
              </Chip>
            </div>
          </div>
        )}

        {isPrice || mode === 'taxa' ? (
          <Input
            label={isPrice ? `Taxa por período (%) — ${PERIODICITY[periodicity].toLowerCase()}` : 'Taxa de juros (%)'}
            inputMode="decimal"
            placeholder="20"
            value={rate}
            onChange={(e) => {
              setRateTouched(true)
              setRate(e.target.value.replace(/[^\d.,]/g, ''))
            }}
            hint={
              principalCents > 0
                ? `Juros totais: ${formatBRL(previewInterestCents)}`
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
            <strong className="text-brand-700">{formatBRL(previewInterestCents)}</strong>
          </div>
          <div className="mt-2 flex justify-between border-t border-brand-200 pt-2">
            <span className="font-semibold">Total previsto</span>
            <strong className="text-lg text-brand-800">{formatBRL(totalCents)}</strong>
          </div>
        </div>

        {simulation && (
          <div className="rounded-2xl border border-brand-100 bg-white p-4">
            <p className="mb-2 text-sm font-semibold">
              Simulação — {simulation.installments.length} parcelas
            </p>
            <div className="max-h-56 overflow-y-auto">
              {simulation.installments.map((p) => (
                <div
                  key={p.number}
                  className="flex items-center justify-between border-b border-ink/5 py-1.5 text-sm last:border-0"
                >
                  <span className="text-ink/60">
                    {p.number}ª · {formatDate(p.dueDate)}
                  </span>
                  <span>
                    <strong>{formatBRL(p.totalCents)}</strong>{' '}
                    <span className="text-xs text-ink/40">
                      (juros {formatBRL(p.interestCents)})
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink/40">
              Prévia — as parcelas oficiais são geradas pelo sistema ao salvar.
            </p>
          </div>
        )}

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
