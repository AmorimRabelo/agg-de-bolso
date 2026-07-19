import { Link, useNavigate } from 'react-router-dom'
import { PAYMENT_METHODS, TRAFFIC_LIGHT } from '../../core/constants'
import { firstName, formatDate } from '../../core/format'
import { formatBRL, formatPct, toCents } from '../../core/money'
import { Card } from '../../shared/components/ui'
import { useAuth } from '../auth/useAuth'
import type { Receivable } from '../loans/types'
import { useSettings } from '../settings/hooks'
import { useDashboardStats, useLate, useRecentPayments, useUpcoming } from './hooks'

function ReceivableRow({ item }: { item: Receivable }) {
  const navigate = useNavigate()
  const light = TRAFFIC_LIGHT[item.traffic_light]
  return (
    <Card onClick={() => navigate(`/emprestimos/${item.loan_id}`)} className="!p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.client_name}</p>
          <p className="text-xs text-ink/50">
            #{item.loan_number}
            {item.kind === 'parcela' && ` · parcela ${item.installment_number}`}
            {' · vence '}
            {formatDate(item.due_date)}
            {item.days_late > 0 && (
              <span className="font-semibold text-red-600"> · {item.days_late}d de atraso</span>
            )}
          </p>
        </div>
        <p className="shrink-0 font-bold">
          {light.emoji && `${light.emoji} `}
          {formatBRL(toCents(item.amount))}
        </p>
      </div>
    </Card>
  )
}

export function HomePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const name = firstName(session?.user.user_metadata?.full_name as string)

  const { data: settings } = useSettings()
  const { data: s, isLoading } = useDashboardStats()
  const { data: late } = useLate()
  const { data: upcoming } = useUpcoming()
  const { data: recent } = useRecentPayments()

  const kpis = s
    ? [
        { label: 'Total emprestado', value: formatBRL(toCents(s.total_lent)) },
        { label: 'Total recebido', value: formatBRL(toCents(s.total_received)) },
        { label: 'Principal recebido', value: formatBRL(toCents(s.paid_principal)) },
        { label: 'Juros recebidos', value: formatBRL(toCents(s.paid_interest)), highlight: true },
        { label: 'Principal em aberto', value: formatBRL(toCents(s.pending_principal)) },
        { label: 'Juros em aberto', value: formatBRL(toCents(s.pending_interest)) },
        { label: 'Recebido este mês', value: formatBRL(toCents(s.received_this_month)), highlight: true },
        { label: 'Previsto este mês', value: formatBRL(toCents(s.expected_this_month)) },
      ]
    : []

  return (
    <div>
      <header className="bg-gradient-to-b from-brand-950 to-brand-800 px-5 pb-14 pt-10 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-brand-200">Olá{name ? ',' : ''} {name} 👋</p>
            {settings?.company_name && (
              <p className="text-lg font-bold">{settings.company_name}</p>
            )}
            <p className="mt-3 text-xs text-brand-300">Saldo total em aberto</p>
            <p className="text-3xl font-extrabold">
              {s ? formatBRL(toCents(s.pending_total)) : '—'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
            <p className="text-xs text-brand-200">Rentabilidade</p>
            <p className="text-xl font-extrabold text-brand-400">
              {s ? formatPct(s.portfolio_return_pct) : '—'}
            </p>
          </div>
        </div>
      </header>

      <div className="-mt-8 px-5 pb-6">
        {/* contadores de situação */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Ativos', value: s?.active_count ?? 0, cls: 'text-sky-600' },
            { label: 'Pagos', value: s?.paid_count ?? 0, cls: 'text-brand-700' },
            { label: 'Atrasados', value: s?.late_count ?? 0, cls: (s?.late_count ?? 0) > 0 ? 'text-red-600' : 'text-ink/40' },
          ].map((c) => (
            <Card key={c.label} className="anim-fade-up !p-4 text-center">
              <p className={`text-2xl font-extrabold ${c.cls}`}>{c.value}</p>
              <p className="text-xs text-ink/50">{c.label}</p>
            </Card>
          ))}
        </div>

        {/* indicadores */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {isLoading &&
            [1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-3xl bg-ink/5" />)}
          {kpis.map((k) => (
            <Card key={k.label} className="anim-fade-up !p-4">
              <p className="text-xs text-ink/40">{k.label}</p>
              <p className={`mt-0.5 font-bold ${k.highlight ? 'text-brand-700' : ''}`}>{k.value}</p>
            </Card>
          ))}
        </div>

        {s && s.loan_count === 0 && !isLoading && (
          <Card className="mt-3 flex flex-col items-center gap-2 py-8 text-center">
            <span className="text-4xl">🚀</span>
            <p className="font-semibold">Comece sua carteira</p>
            <p className="text-sm text-ink/50">
              Cadastre um <Link to="/clientes" className="font-semibold text-brand-700">cliente</Link> e
              registre o primeiro <Link to="/emprestimos/novo" className="font-semibold text-brand-700">empréstimo</Link>
            </p>
          </Card>
        )}

        {/* atrasados (empréstimos e parcelas) */}
        {(late ?? []).length > 0 && (
          <>
            <h2 className="mt-6 font-bold text-red-600">⚠️ Atrasados</h2>
            <div className="mt-3 flex flex-col gap-3">
              {late!.map((r) => (
                <ReceivableRow key={r.installment_id ?? r.loan_id} item={r} />
              ))}
            </div>
          </>
        )}

        {/* próximos vencimentos (empréstimos e parcelas) */}
        {(upcoming ?? []).length > 0 && (
          <>
            <h2 className="mt-6 font-bold">📅 Próximos vencimentos</h2>
            <div className="mt-3 flex flex-col gap-3">
              {upcoming!.map((r) => (
                <ReceivableRow key={r.installment_id ?? r.loan_id} item={r} />
              ))}
            </div>
          </>
        )}

        {/* últimos pagamentos */}
        {(recent ?? []).length > 0 && (
          <>
            <h2 className="mt-6 font-bold">🧾 Últimos pagamentos</h2>
            <div className="mt-3 flex flex-col gap-3">
              {recent!.map((p) => (
                <Card key={p.id} onClick={() => navigate(`/emprestimos/${p.loans.id}`)} className="!p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{p.loans.clients.name}</p>
                      <p className="text-xs text-ink/50">
                        {formatDate(p.payment_date)} · #{p.loans.loan_number} · {PAYMENT_METHODS[p.method]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-700">{formatBRL(toCents(p.total_amount))}</p>
                      {toCents(p.interest_amount) > 0 && (
                        <p className="text-xs text-ink/50">
                          juros {formatBRL(toCents(p.interest_amount))}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
