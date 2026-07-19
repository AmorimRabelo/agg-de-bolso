import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TRAFFIC_LIGHT } from '../../core/constants'
import { formatDate } from '../../core/format'
import { formatBRL, toCents } from '../../core/money'
import { whatsappChargeLink } from '../../core/whatsapp'
import { Card } from '../../shared/components/ui'
import { useClients } from '../clients/hooks'
import { useSettings } from '../settings/hooks'
import { useOverdue } from './hooks'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { data: overdue, isLoading } = useOverdue()
  const { data: clients } = useClients()
  const { data: settings } = useSettings()

  // mapa cliente → whatsapp
  const whatsById = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const c of clients ?? []) m.set(c.id, c.whatsapp)
    return m
  }, [clients])

  return (
    <div className="px-5 pt-8 pb-6">
      <button onClick={() => navigate(-1)} className="mb-2 text-sm font-medium text-brand-700">
        ‹ Voltar
      </button>
      <h1 className="text-2xl font-extrabold">🔔 Cobranças em atraso</h1>
      <p className="mt-1 text-sm text-ink/50">
        {(overdue ?? []).length} pendência{(overdue ?? []).length === 1 ? '' : 's'} para cobrar
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading &&
          [1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-ink/5" />)}

        {!isLoading && (overdue ?? []).length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-4xl">🎉</span>
            <p className="font-semibold">Nenhum atraso!</p>
            <p className="text-sm text-ink/50">Toda a carteira está em dia.</p>
          </Card>
        )}

        {(overdue ?? []).map((r) => {
          const amount = toCents(r.amount)
          const light = TRAFFIC_LIGHT[r.traffic_light]
          const link = whatsappChargeLink({
            whatsapp: whatsById.get(r.client_id),
            clientName: r.client_name,
            amountCents: amount,
            dueDate: r.due_date,
            daysLate: r.days_late,
            installmentNumber: r.installment_number,
            companyName: settings?.company_name,
          })
          return (
            <Card key={r.installment_id ?? r.loan_id} className="anim-fade-up">
              <div
                onClick={() => navigate(`/emprestimos/${r.loan_id}`)}
                className="cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.client_name}</p>
                    <p className="text-xs text-ink/50">
                      #{r.loan_number}
                      {r.kind === 'parcela' && ` · parcela ${r.installment_number}`} · venceu{' '}
                      {formatDate(r.due_date)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                    {light.emoji} {r.days_late}d
                  </span>
                </div>
                <p className="mt-2 text-lg font-bold text-amber-600">{formatBRL(amount)}</p>
              </div>

              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-2.5 text-sm font-semibold text-white active:opacity-90"
                >
                  💬 Cobrar no WhatsApp
                </a>
              ) : (
                <p className="mt-3 rounded-2xl bg-ink/5 py-2.5 text-center text-xs text-ink/40">
                  Sem WhatsApp cadastrado para este cliente
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
