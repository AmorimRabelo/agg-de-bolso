import { useState } from 'react'
import { PAYMENT_METHODS } from '../../core/constants'
import { formatDate } from '../../core/format'
import { formatBRL, toCents } from '../../core/money'
import { Button, Card, useToast } from '../../shared/components/ui'
import { useCancelPayment, usePayments } from './hooks'
import type { Payment } from './types'

export function PaymentList({ loanId, canCancel }: { loanId: string; canCancel: boolean }) {
  const { data: payments, isLoading } = usePayments(loanId)
  const [toCancel, setToCancel] = useState<Payment | null>(null)

  if (isLoading) return <div className="h-20 animate-pulse rounded-3xl bg-ink/5" />

  if (!payments || payments.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-1 py-8 text-center">
        <span className="text-3xl">🧾</span>
        <p className="text-sm font-semibold">Nenhum pagamento ainda</p>
      </Card>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {payments.map((p) => {
          const canceled = p.status === 'cancelado'
          return (
            <Card key={p.id} className={canceled ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`font-bold ${canceled ? 'line-through' : ''}`}>
                    {formatBRL(toCents(p.total_amount))}
                  </p>
                  <p className="text-xs text-ink/50">
                    {formatDate(p.payment_date)} · {PAYMENT_METHODS[p.method]}
                  </p>
                </div>
                {canceled ? (
                  <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500">
                    Cancelado
                  </span>
                ) : (
                  canCancel && (
                    <button
                      onClick={() => setToCancel(p)}
                      className="text-xs font-semibold text-red-500"
                    >
                      Cancelar
                    </button>
                  )
                )}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-ink/60">
                <span>
                  Principal: <strong>{formatBRL(toCents(p.principal_amount))}</strong>
                </span>
                <span>
                  Juros:{' '}
                  <strong className="text-brand-700">
                    {formatBRL(toCents(p.interest_amount))}
                  </strong>
                </span>
              </div>
              {canceled && p.cancel_reason && (
                <p className="mt-2 text-xs text-red-500">Motivo: {p.cancel_reason}</p>
              )}
              {p.notes && <p className="mt-2 text-xs text-ink/50">{p.notes}</p>}
            </Card>
          )
        })}
      </div>

      {toCancel && (
        <CancelPaymentSheet payment={toCancel} onClose={() => setToCancel(null)} />
      )}
    </>
  )
}

function CancelPaymentSheet({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const toast = useToast()
  const cancel = useCancelPayment()
  const [reason, setReason] = useState('')

  async function handleCancel() {
    if (!reason.trim()) return toast('Informe o motivo do cancelamento', 'error')
    try {
      await cancel.mutateAsync({ id: payment.id, reason: reason.trim() })
      toast('Pagamento cancelado — saldos recalculados')
      onClose()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm">
      <div className="anim-fade-up w-full max-w-md rounded-t-3xl bg-white p-6 pb-10">
        <h2 className="text-lg font-bold">
          Cancelar pagamento de {formatBRL(toCents(payment.total_amount))}?
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          O pagamento sai dos cálculos, mas fica registrado na auditoria. Esta ação não
          pode ser desfeita.
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
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  )
}
