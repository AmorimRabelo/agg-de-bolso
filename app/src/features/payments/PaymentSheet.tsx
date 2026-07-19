import { useState } from 'react'
import { PAYMENT_METHODS, type PaymentMethod } from '../../core/constants'
import { todayISO } from '../../core/format'
import { formatBRL, fromCents, maskMoneyInput, toCents } from '../../core/money'
import { Button, Input, useToast } from '../../shared/components/ui'
import type { InstallmentStats, LoanStats } from '../loans/types'
import { useCreatePayment } from './hooks'

/**
 * Bottom sheet de novo pagamento — para o empréstimo (único) ou para uma
 * parcela específica (parcelado). O usuário informa o TOTAL e os JUROS;
 * o principal é calculado. Regra de ouro garantida pelo banco:
 * principal + juros = total.
 */
export function PaymentSheet({
  loan,
  installment,
  onClose,
}: {
  loan: LoanStats
  installment?: InstallmentStats
  onClose: () => void
}) {
  const toast = useToast()
  const create = useCreatePayment()

  const pendingTotal = toCents(installment ? installment.pending_total : loan.pending_total)
  const pendingPrincipal = toCents(
    installment ? installment.pending_principal : loan.pending_principal,
  )
  const pendingInterest = toCents(
    installment ? installment.pending_interest : loan.pending_interest,
  )
  const lateCharge = installment ? toCents(installment.suggested_late_charge) : 0

  const [date, setDate] = useState(todayISO())
  const [totalCents, setTotalCents] = useState(0)
  const [totalDisplay, setTotalDisplay] = useState('')
  const [interestCents, setInterestCents] = useState(0)
  const [interestDisplay, setInterestDisplay] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [notes, setNotes] = useState('')

  const principalCents = totalCents - interestCents

  function fill(total: number, interest: number) {
    setTotalCents(total)
    setTotalDisplay(total ? formatBRL(total) : '')
    setInterestCents(interest)
    setInterestDisplay(interest ? formatBRL(interest) : '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (totalCents <= 0) return toast('Informe o valor do pagamento', 'error')
    if (principalCents < 0)
      return toast('Os juros não podem ser maiores que o valor total', 'error')
    if (principalCents > pendingPrincipal)
      return toast(
        `O principal (${formatBRL(principalCents)}) é maior que o pendente (${formatBRL(pendingPrincipal)})`,
        'error',
      )
    try {
      await create.mutateAsync({
        loan_id: loan.id,
        installment_id: installment?.id ?? null,
        payment_date: date,
        total_amount: fromCents(totalCents),
        principal_amount: fromCents(principalCents),
        interest_amount: fromCents(interestCents),
        method,
        notes: notes.trim() || null,
      })
      toast('Pagamento registrado ✅')
      onClose()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm">
      <div className="anim-fade-up max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 pb-10">
        <h2 className="text-lg font-bold">
          {installment
            ? `Receber parcela ${installment.number}/${loan.num_installments}`
            : 'Registrar pagamento'}
        </h2>
        <p className="mt-0.5 text-sm text-ink/60">
          Empréstimo #{loan.loan_number} · pendente {formatBRL(pendingTotal)}
          {lateCharge > 0 && (
            <span className="font-semibold text-red-600">
              {' '}
              + {formatBRL(lateCharge)} de multa/mora
            </span>
          )}
        </p>

        <div className="mt-4 flex gap-2">
          {installment ? (
            <>
              <button
                type="button"
                onClick={() => fill(pendingTotal, pendingInterest)}
                className="flex-1 rounded-2xl border border-brand-200 bg-brand-50 py-2 text-sm font-semibold text-brand-800"
              >
                Valor da parcela
              </button>
              {lateCharge > 0 && (
                <button
                  type="button"
                  onClick={() => fill(pendingTotal + lateCharge, pendingInterest + lateCharge)}
                  className="flex-1 rounded-2xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-700"
                >
                  Com multa e mora
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fill(pendingTotal, pendingInterest)}
                className="flex-1 rounded-2xl border border-brand-200 bg-brand-50 py-2 text-sm font-semibold text-brand-800"
              >
                Quitar tudo
              </button>
              <button
                type="button"
                onClick={() => fill(pendingInterest, pendingInterest)}
                className="flex-1 rounded-2xl border border-brand-200 bg-brand-50 py-2 text-sm font-semibold text-brand-800"
              >
                Só os juros
              </button>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <Input
            label="Data do pagamento *"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Input
            label="Valor total recebido *"
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={totalDisplay}
            onChange={(e) => {
              const { display, cents } = maskMoneyInput(e.target.value)
              setTotalDisplay(display)
              setTotalCents(cents)
            }}
          />
          <Input
            label="Desse valor, quanto é juros?"
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={interestDisplay}
            onChange={(e) => {
              const { display, cents } = maskMoneyInput(e.target.value)
              setInterestDisplay(display)
              setInterestCents(cents)
            }}
            hint={`Juros pendentes: ${formatBRL(pendingInterest)}${lateCharge > 0 ? ' · multa/mora entram como juros extras' : ''}`}
          />

          <div className="rounded-2xl bg-brand-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink/60">Principal</span>
              <strong className={principalCents < 0 ? 'text-red-600' : ''}>
                {formatBRL(Math.max(principalCents, 0))}
              </strong>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-ink/60">Juros</span>
              <strong className="text-brand-700">{formatBRL(interestCents)}</strong>
            </div>
            <div className="mt-2 flex justify-between border-t border-brand-200 pt-2">
              <span className="font-semibold">Total</span>
              <strong className="text-brand-800">{formatBRL(totalCents)}</strong>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink/70">Forma de pagamento</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition
                    ${method === m ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink/10 bg-white text-ink/60'}`}
                >
                  {PAYMENT_METHODS[m]}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink/70">Observações</span>
            <textarea
              className="min-h-16 w-full rounded-2xl border border-ink/10 bg-white p-4 text-base outline-none placeholder:text-ink/30 focus:border-brand-600"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <Button type="submit" loading={create.isPending}>
            Confirmar pagamento
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Voltar
          </Button>
        </form>
      </div>
    </div>
  )
}
