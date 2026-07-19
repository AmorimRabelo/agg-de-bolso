import type {
  CalcMode,
  InstallmentStatus,
  LoanStatus,
  LoanType,
  Periodicity,
  TrafficLight,
} from '../../core/constants'

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
  loan_type: LoanType
  num_installments: number | null
  periodicity: Periodicity | null
  calc_mode: CalcMode | null
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
  next_due: string | null
  open_installments: number
}

export interface LoanInput {
  client_id: string
  principal: number
  loan_date: string
  due_date: string
  interest_rate: number | null
  interest_amount: number
  notes: string | null
  loan_type: LoanType
  num_installments: number | null
  periodicity: Periodicity | null
  calc_mode: CalcMode | null
}

/** Linha da view installment_stats (parcela + cálculos). */
export interface InstallmentStats {
  id: string
  user_id: string
  loan_id: string
  number: number
  due_date: string
  principal_amount: number | string
  interest_amount: number | string
  total_amount: number | string
  status: Exclude<InstallmentStatus, 'atrasada'>
  loan_number: number
  client_id: string
  client_name: string
  paid_principal: number | string
  paid_interest: number | string
  paid_total: number | string
  pending_principal: number | string
  pending_interest: number | string
  pending_total: number | string
  days_late: number
  effective_status: InstallmentStatus
  traffic_light: TrafficLight
  late_fine_pct: number | string
  late_interest_month_pct: number | string
  suggested_late_charge: number | string
}

/** Linha da view receivables (a receber: únicos + parcelas). */
export interface Receivable {
  kind: 'unico' | 'parcela'
  loan_id: string
  installment_id: string | null
  installment_number: number | null
  user_id: string
  client_id: string
  client_name: string
  loan_number: number
  due_date: string
  amount: number | string
  status: string
  days_late: number
  traffic_light: TrafficLight
}
