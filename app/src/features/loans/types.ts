import type { LoanStatus, TrafficLight } from '../../core/constants'

export interface Loan {
  id: string
  user_id: string
  client_id: string
  loan_number: number
  principal: number | string
  loan_date: string
  due_date: string
  interest_rate: number | string | null
  interest_amount: number | string
  total_expected: number | string
  notes: string | null
  status: LoanStatus
  canceled_at: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
}

/** Linha da view loan_stats (empréstimo + cliente + cálculos). */
export interface LoanStats extends Loan {
  client_name: string
  client_cpf_cnpj: string | null
  paid_principal: number | string
  paid_interest: number | string
  paid_total: number | string
  pending_principal: number | string
  pending_interest: number | string
  pending_total: number | string
  days_elapsed: number
  days_late: number
  effective_status: LoanStatus
  traffic_light: TrafficLight
  expected_return_pct: number | string
  realized_return_pct: number | string
  monthly_return_pct: number | string
  last_payment_date: string | null
  return_days: number | null
}

export interface LoanInput {
  client_id: string
  principal: number
  loan_date: string
  due_date: string
  interest_rate: number | null
  interest_amount: number
  notes: string | null
}
