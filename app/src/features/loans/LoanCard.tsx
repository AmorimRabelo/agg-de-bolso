import { useNavigate } from 'react-router-dom'
import { LOAN_STATUS, TRAFFIC_LIGHT } from '../../core/constants'
import { formatDate } from '../../core/format'
import { formatBRL, toCents } from '../../core/money'
import { Card } from '../../shared/components/ui'
import type { LoanStats } from './types'

export function LoanCard({ loan, hideClient = false }: { loan: LoanStats; hideClient?: boolean }) {
  const navigate = useNavigate()
  const badge = LOAN_STATUS[loan.effective_status]
  const light = TRAFFIC_LIGHT[loan.traffic_light]
  const pending = toCents(loan.pending_total)

  return (
    <Card onClick={() => navigate(`/emprestimos/${loan.id}`)} className="anim-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {hideClient ? `Empréstimo #${loan.loan_number}` : loan.client_name}
          </p>
          <p className="text-xs text-ink/40">
            {hideClient ? formatDate(loan.loan_date) : `#${loan.loan_number} · ${formatDate(loan.loan_date)}`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.color}`}>
          {light.emoji && `${light.emoji} `}
          {badge.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-ink/40">Emprestado</p>
          <p className="font-bold">{formatBRL(toCents(loan.principal))}</p>
        </div>
        <div>
          <p className="text-xs text-ink/40">Juros</p>
          <p className="font-bold text-brand-700">{formatBRL(toCents(loan.interest_amount))}</p>
        </div>
        <div>
          <p className="text-xs text-ink/40">Saldo</p>
          <p className={`font-bold ${pending > 0 ? 'text-amber-600' : 'text-brand-700'}`}>
            {formatBRL(pending)}
          </p>
        </div>
      </div>
      {loan.effective_status !== 'pago' && loan.effective_status !== 'cancelado' && (
        <p className="mt-2 text-xs text-ink/50">
          Vencimento: <strong>{formatDate(loan.due_date)}</strong>
          {loan.days_late > 0 && (
            <span className="font-semibold text-red-600"> · {loan.days_late} dia{loan.days_late === 1 ? '' : 's'} de atraso</span>
          )}
        </p>
      )}
    </Card>
  )
}
