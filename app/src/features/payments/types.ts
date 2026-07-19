import type { PaymentMethod } from '../../core/constants'

export interface Payment {
  id: string
  user_id: string
  loan_id: string
  payment_date: string
  total_amount: number | string
  principal_amount: number | string
  interest_amount: number | string
  method: PaymentMethod
  notes: string | null
  status: 'ativo' | 'cancelado'
  canceled_at: string | null
  cancel_reason: string | null
  canceled_by: string | null
  created_at: string
  updated_at: string
}

export interface PaymentInput {
  loan_id: string
  installment_id?: string | null
  payment_date: string
  total_amount: number
  principal_amount: number
  interest_amount: number
  method: PaymentMethod
  notes: string | null
}
