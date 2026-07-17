import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { formatBRL, formatPct, toCents } from '../../core/money'
import { Card } from '../../shared/components/ui'
import { useClients } from '../clients/hooks'
import { useLoans } from '../loans/hooks'
import { useAllPayments } from '../payments/hooks'

const PERIODS = [
  { key: 'mes', label: 'Este mês' },
  { key: 'anterior', label: 'Mês passado' },
  { key: 'tres', label: '3 meses' },
  { key: 'ano', label: 'Este ano' },
  { key: 'tudo', label: 'Tudo' },
] as const
type PeriodKey = (typeof PERIODS)[number]['key']

function periodRange(key: PeriodKey): [string, string] {
  const today = dayjs()
  switch (key) {
    case 'mes':
      return [today.startOf('month').format('YYYY-MM-DD'), today.endOf('month').format('YYYY-MM-DD')]
    case 'anterior': {
      const m = today.subtract(1, 'month')
      return [m.startOf('month').format('YYYY-MM-DD'), m.endOf('month').format('YYYY-MM-DD')]
    }
    case 'tres':
      return [today.subtract(3, 'month').format('YYYY-MM-DD'), today.format('YYYY-MM-DD')]
    case 'ano':
      return [today.startOf('year').format('YYYY-MM-DD'), today.endOf('year').format('YYYY-MM-DD')]
    case 'tudo':
      return ['0000-01-01', '9999-12-31']
  }
}

export function ReportsPage() {
  const { data: loans } = useLoans()
  const { data: payments } = useAllPayments()
  const { data: clients } = useClients()

  const [period, setPeriod] = useState<PeriodKey>('mes')
  const [clientId, setClientId] = useState('')

  const report = useMemo(() => {
    const [start, end] = periodRange(period)

    const loansIn = (loans ?? []).filter(
      (l) =>
        l.status !== 'cancelado' &&
        l.loan_date >= start &&
        l.loan_date <= end &&
        (!clientId || l.client_id === clientId),
    )
    const paymentsIn = (payments ?? []).filter(
      (p) =>
        p.payment_date >= start &&
        p.payment_date <= end &&
        (!clientId || p.loans.client_id === clientId),
    )

    const totalLent = loansIn.reduce((s, l) => s + toCents(l.principal), 0)
    const paidPrincipal = paymentsIn.reduce((s, p) => s + toCents(p.principal_amount), 0)
    const paidInterest = paymentsIn.reduce((s, p) => s + toCents(p.interest_amount), 0)
    const totalReceived = paidPrincipal + paidInterest
    const pending = loansIn.reduce((s, l) => s + toCents(l.pending_total), 0)
    const returnPct = totalLent > 0 ? (paidInterest / totalLent) * 100 : 0

    const returned = loansIn.filter((l) => l.return_days !== null && l.status === 'pago')
    const avgReturnDays =
      returned.length > 0
        ? Math.round(returned.reduce((s, l) => s + (l.return_days ?? 0), 0) / returned.length)
        : null

    return {
      totalLent,
      paidPrincipal,
      paidInterest,
      totalReceived,
      pending,
      returnPct,
      loanCount: loansIn.length,
      avgReturnDays,
    }
  }, [loans, payments, period, clientId])

  const r = report
  const result = r.paidInterest // Resultado financeiro = juros recebidos

  return (
    <div className="px-5 pt-8 pb-6">
      <h1 className="text-2xl font-extrabold">Relatórios</h1>

      {/* filtros */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition
              ${period === p.key ? 'bg-brand-700 text-white' : 'bg-white text-ink/60'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <select
        className="mt-3 h-12 w-full appearance-none rounded-2xl border border-ink/10 bg-white px-4 text-base outline-none focus:border-brand-600"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
      >
        <option value="">Todos os clientes</option>
        {(clients ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* resumo do período */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: 'Total emprestado', value: formatBRL(r.totalLent) },
          { label: 'Total recebido', value: formatBRL(r.totalReceived) },
          { label: 'Principal recebido', value: formatBRL(r.paidPrincipal) },
          { label: 'Juros recebidos', value: formatBRL(r.paidInterest), highlight: true },
          { label: 'Saldo em aberto', value: formatBRL(r.pending) },
          { label: 'Rentabilidade', value: formatPct(r.returnPct), highlight: true },
          { label: 'Empréstimos no período', value: String(r.loanCount) },
          {
            label: 'Tempo médio de retorno',
            value: r.avgReturnDays !== null ? `${r.avgReturnDays} dias` : '—',
          },
        ].map((k) => (
          <Card key={k.label} className="anim-fade-up !p-4">
            <p className="text-xs text-ink/40">{k.label}</p>
            <p className={`mt-0.5 font-bold ${k.highlight ? 'text-brand-700' : ''}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      {/* fluxo de caixa */}
      <h2 className="mt-6 font-bold">💰 Fluxo de caixa do período</h2>
      <Card className="mt-3">
        <div className="flex justify-between border-b border-ink/5 py-2 text-sm">
          <span className="text-ink/60">Entradas (recebimentos)</span>
          <strong className="text-brand-700">+ {formatBRL(r.totalReceived)}</strong>
        </div>
        <div className="flex justify-between border-b border-ink/5 py-2 pl-4 text-xs">
          <span className="text-ink/50">└ Principal</span>
          <span>{formatBRL(r.paidPrincipal)}</span>
        </div>
        <div className="flex justify-between border-b border-ink/5 py-2 pl-4 text-xs">
          <span className="text-ink/50">└ Juros</span>
          <span className="font-semibold text-brand-700">{formatBRL(r.paidInterest)}</span>
        </div>
        <div className="flex justify-between border-b border-ink/5 py-2 text-sm">
          <span className="text-ink/60">Saídas (novos empréstimos)</span>
          <strong className="text-amber-600">− {formatBRL(r.totalLent)}</strong>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-brand-50 p-3">
          <div>
            <p className="font-semibold">Resultado financeiro</p>
            <p className="text-xs text-ink/50">= juros recebidos (lucro real)</p>
          </div>
          <p className="text-xl font-extrabold text-brand-800">{formatBRL(result)}</p>
        </div>
      </Card>

      <p className="mt-3 text-center text-xs text-ink/40">
        O principal devolvido não é lucro — apenas retorna ao caixa.
      </p>
    </div>
  )
}
