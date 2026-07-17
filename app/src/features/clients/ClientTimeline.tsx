import { useMemo } from 'react'
import { formatDate } from '../../core/format'
import { formatBRL, toCents } from '../../core/money'
import { Card } from '../../shared/components/ui'
import { useLoansByClient } from '../loans/hooks'
import { useClientPayments } from '../payments/hooks'

type Event = {
  date: string
  sortKey: string
  icon: string
  title: string
  detail?: string
  negative?: boolean
}

/** Linha do tempo do cliente: empréstimos, pagamentos e cancelamentos. */
export function ClientTimeline({ clientId }: { clientId: string }) {
  const { data: loans } = useLoansByClient(clientId)
  const { data: payments } = useClientPayments(clientId)

  const events = useMemo(() => {
    const list: Event[] = []
    for (const l of loans ?? []) {
      list.push({
        date: l.loan_date,
        sortKey: `${l.loan_date}T00:00:00`,
        icon: '💸',
        title: `Empréstimo #${l.loan_number} de ${formatBRL(toCents(l.principal))}`,
        detail: l.notes ?? undefined,
      })
      if (l.status === 'cancelado' && l.canceled_at) {
        list.push({
          date: l.canceled_at.slice(0, 10),
          sortKey: l.canceled_at,
          icon: '❌',
          title: `Empréstimo #${l.loan_number} cancelado`,
          detail: l.cancel_reason ?? undefined,
          negative: true,
        })
      }
    }
    for (const p of payments ?? []) {
      list.push({
        date: p.payment_date,
        sortKey: `${p.payment_date}T12:00:00`,
        icon: '💰',
        title: `Pagamento de ${formatBRL(toCents(p.total_amount))} (#${p.loans.loan_number})`,
        detail:
          toCents(p.interest_amount) > 0
            ? `Juros: ${formatBRL(toCents(p.interest_amount))}`
            : undefined,
      })
      if (p.status === 'cancelado' && p.canceled_at) {
        list.push({
          date: p.canceled_at.slice(0, 10),
          sortKey: p.canceled_at,
          icon: '❌',
          title: `Pagamento de ${formatBRL(toCents(p.total_amount))} cancelado`,
          detail: p.cancel_reason ?? undefined,
          negative: true,
        })
      }
    }
    return list.sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
  }, [loans, payments])

  if (events.length === 0) return null

  return (
    <>
      <h2 className="mt-5 font-bold">🕐 Linha do tempo</h2>
      <Card className="mt-3">
        <div className="flex flex-col">
          {events.map((e, i) => (
            <div key={i} className="flex gap-3 border-b border-ink/5 py-2.5 last:border-0">
              <span className="text-lg leading-6">{e.icon}</span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${e.negative ? 'text-red-600' : ''}`}>
                  {e.title}
                </p>
                <p className="text-xs text-ink/40">{formatDate(e.date)}</p>
                {e.detail && <p className="mt-0.5 text-xs text-ink/60">{e.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
