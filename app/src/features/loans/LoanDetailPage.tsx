import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { INSTALLMENT_STATUS, LOAN_STATUS, PERIODICITY, TRAFFIC_LIGHT } from '../../core/constants'
import { formatDate } from '../../core/format'
import { formatBRL, formatPct, toCents } from '../../core/money'
import { Button, Card, useToast } from '../../shared/components/ui'
import { useCancelLoan, useInstallments, useLoan } from './hooks'
import type { InstallmentStats } from './types'
import { PaymentList } from '../payments/PaymentList'
import { PaymentSheet } from '../payments/PaymentSheet'

export function LoanDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: l, isLoading } = useLoan(id)
  const { data: installments } = useInstallments(id)
  const cancel = useCancelLoan()
  const [showCancel, setShowCancel] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [payInstallment, setPayInstallment] = useState<InstallmentStats | null>(null)
  const [reason, setReason] = useState('')

  if (isLoading || !l) {
    return (
      <div className="px-5 pt-8">
        <div className="h-40 animate-pulse rounded-3xl bg-ink/5" />
      </div>
    )
  }

  const badge = LOAN_STATUS[l.effective_status]
  const light = TRAFFIC_LIGHT[l.traffic_light]
  const isOpen = !['pago', 'cancelado'].includes(l.effective_status)

  const money = (v: number | string) => formatBRL(toCents(v))
  const rows: Array<[string, string, string?]> = [
    ['Valor emprestado', money(l.principal)],
    ['Juros previstos', money(l.interest_amount), 'text-brand-700'],
    ['Total previsto', money(l.total_expected)],
    ['Principal recebido', money(l.paid_principal)],
    ['Juros recebidos', money(l.paid_interest), 'text-brand-700'],
    ['Total recebido', money(l.paid_total)],
    ['Principal pendente', money(l.pending_principal)],
    ['Juros pendentes', money(l.pending_interest)],
    ['Saldo pendente', money(l.pending_total), toCents(l.pending_total) > 0 ? 'text-amber-600' : 'text-brand-700'],
  ]
  const perf: Array<[string, string]> = [
    ['Dias decorridos', `${l.days_elapsed} dia${l.days_elapsed === 1 ? '' : 's'}`],
    ['Dias em atraso', l.days_late > 0 ? `${l.days_late} dias` : '—'],
    ['Rentabilidade prevista', formatPct(l.expected_return_pct)],
    ['Rentabilidade realizada', formatPct(l.realized_return_pct)],
    ['Rent. média mensal', formatPct(l.monthly_return_pct)],
    ['Tempo de retorno', l.return_days !== null ? `${l.return_days} dias` : '—'],
  ]

  async function handleCancel() {
    if (!reason.trim()) return toast('Informe o motivo do cancelamento', 'error')
    try {
      await cancel.mutateAsync({ id: l!.id, reason: reason.trim() })
      toast('Empréstimo cancelado')
      setShowCancel(false)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div>
      <header className="bg-gradient-to-b from-brand-950 to-brand-800 px-5 pb-12 pt-8 text-white">
        <button onClick={() => navigate(-1)} className="mb-3 text-sm font-medium text-brand-200">
          ‹ Voltar
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-brand-200">
              Empréstimo #{l.loan_number}
              {l.loan_type === 'parcelado' &&
                ` · ${l.num_installments}x ${PERIODICITY[l.periodicity ?? 'mensal'].toLowerCase()}`}
            </p>
            <h1 className="text-2xl font-extrabold">{l.client_name}</h1>
            <p className="mt-0.5 text-sm text-brand-200">
              {formatDate(l.loan_date)} →{' '}
              {l.loan_type === 'parcelado'
                ? `próx. venc. ${formatDate(l.next_due ?? l.due_date)}`
                : `vence ${formatDate(l.due_date)}`}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.color}`}>
            {light.emoji && `${light.emoji} `}
            {badge.label}
          </span>
        </div>
        <div className="mt-4">
          <p className="text-xs text-brand-300">Saldo pendente</p>
          <p className="text-3xl font-extrabold">{money(l.pending_total)}</p>
        </div>
      </header>

      <div className="-mt-6 px-5 pb-8">
        <Card className="anim-fade-up">
          {rows.map(([label, value, cls]) => (
            <div key={label} className="flex justify-between border-b border-ink/5 py-2 text-sm last:border-0">
              <span className="text-ink/60">{label}</span>
              <strong className={cls}>{value}</strong>
            </div>
          ))}
        </Card>

        <Card className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
            Desempenho
          </p>
          {perf.map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-ink/5 py-2 text-sm last:border-0">
              <span className="text-ink/60">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </Card>

        {l.notes && (
          <Card className="mt-3">
            <p className="text-xs text-ink/40">Observações</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{l.notes}</p>
          </Card>
        )}

        {l.status === 'cancelado' && (
          <Card className="mt-3 !bg-red-50">
            <p className="text-xs font-semibold text-red-600">Cancelado em {formatDate(l.canceled_at)}</p>
            <p className="mt-1 text-sm text-red-700">{l.cancel_reason}</p>
          </Card>
        )}

        {l.loan_type === 'parcelado' && (installments ?? []).length > 0 && (
          <>
            <h2 className="mt-5 font-bold">Parcelas</h2>
            <Card className="mt-3 !p-2">
              {installments!.map((p) => {
                const badge = INSTALLMENT_STATUS[p.effective_status]
                const light = TRAFFIC_LIGHT[p.traffic_light]
                const pending = toCents(p.pending_total)
                const charge = toCents(p.suggested_late_charge)
                const open = !['paga', 'cancelada'].includes(p.effective_status)
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 border-b border-ink/5 px-3 py-2.5 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {p.number}ª · {formatDate(p.due_date)}{' '}
                        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
                          {light.emoji && `${light.emoji} `}
                          {badge.label}
                        </span>
                      </p>
                      <p className="text-xs text-ink/50">
                        {open ? (
                          <>
                            Pendente <strong>{formatBRL(pending)}</strong>
                            {charge > 0 && (
                              <span className="text-red-600"> + {formatBRL(charge)} multa/mora</span>
                            )}
                          </>
                        ) : (
                          <>Valor {formatBRL(toCents(p.total_amount))}</>
                        )}
                      </p>
                    </div>
                    {open && isOpen && (
                      <button
                        onClick={() => setPayInstallment(p)}
                        className="shrink-0 rounded-2xl bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white active:bg-brand-800"
                      >
                        Receber
                      </button>
                    )}
                  </div>
                )
              })}
            </Card>
          </>
        )}

        <h2 className="mt-5 font-bold">Pagamentos</h2>
        <div className="mt-3">
          <PaymentList loanId={l.id} canCancel={l.status !== 'cancelado'} />
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {isOpen && (
            <>
              {l.loan_type === 'unico' && (
                <Button onClick={() => setShowPayment(true)}>Registrar pagamento</Button>
              )}
              <Button variant="ghost" onClick={() => setShowCancel(true)}>
                <span className="text-red-600">Cancelar empréstimo</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {showPayment && <PaymentSheet loan={l} onClose={() => setShowPayment(false)} />}
      {payInstallment && (
        <PaymentSheet
          loan={l}
          installment={payInstallment}
          onClose={() => setPayInstallment(null)}
        />
      )}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm">
          <div className="anim-fade-up w-full max-w-md rounded-t-3xl bg-white p-6 pb-10">
            <h2 className="text-lg font-bold">Cancelar empréstimo #{l.loan_number}</h2>
            <p className="mt-1 text-sm text-ink/60">
              O empréstimo sai dos cálculos, mas fica registrado na auditoria. Esta ação
              não pode ser desfeita.
            </p>
            <textarea
              className="mt-4 min-h-24 w-full rounded-2xl border border-ink/10 bg-white p-4 text-base outline-none placeholder:text-ink/30 focus:border-brand-600"
              placeholder="Motivo do cancelamento *"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="danger" onClick={handleCancel} loading={cancel.isPending}>
                Confirmar cancelamento
              </Button>
              <Button variant="ghost" onClick={() => setShowCancel(false)}>
                Voltar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
