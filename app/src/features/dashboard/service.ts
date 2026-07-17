import { supabase } from '../../core/supabase'
import type { LoanStats } from '../loans/types'
import type { PaymentMethod } from '../../core/constants'

export interface DashboardStats {
  loan_count: number
  total_lent: number | string
  total_received: number | string
  paid_principal: number | string
  paid_interest: number | string
  pending_principal: number | string
  pending_interest: number | string
  pending_total: number | string
  portfolio_return_pct: number | string
  active_count: number
  paid_count: number
  late_count: number
  expected_this_month: number | string
  received_this_month: number | string
}

const EMPTY: DashboardStats = {
  loan_count: 0,
  total_lent: 0,
  total_received: 0,
  paid_principal: 0,
  paid_interest: 0,
  pending_principal: 0,
  pending_interest: 0,
  pending_total: 0,
  portfolio_return_pct: 0,
  active_count: 0,
  paid_count: 0,
  late_count: 0,
  expected_this_month: 0,
  received_this_month: 0,
}

export interface RecentPayment {
  id: string
  payment_date: string
  total_amount: number | string
  interest_amount: number | string
  method: PaymentMethod
  loans: { id: string; loan_number: number; clients: { name: string } }
}

export const dashboardService = {
  /** Indicadores consolidados da carteira (view dashboard_stats). */
  async stats(): Promise<DashboardStats> {
    const { data, error } = await supabase.from('dashboard_stats').select('*')
    if (error) throw new Error('Não foi possível carregar o painel')
    return (data?.[0] as DashboardStats) ?? EMPTY
  },

  /** Últimos pagamentos ativos, com cliente e número do empréstimo. */
  async recentPayments(): Promise<RecentPayment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('id, payment_date, total_amount, interest_amount, method, loans(id, loan_number, clients(name))')
      .eq('status', 'ativo')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) throw new Error('Não foi possível carregar os pagamentos')
    return data as unknown as RecentPayment[]
  },

  /** Próximos vencimentos (em dia, ordenados pela data). */
  async upcoming(): Promise<LoanStats[]> {
    const { data, error } = await supabase
      .from('loan_stats')
      .select('*')
      .in('effective_status', ['em_aberto', 'parcial'])
      .order('due_date', { ascending: true })
      .limit(5)
    if (error) throw new Error('Não foi possível carregar os vencimentos')
    return data as LoanStats[]
  },

  /** Empréstimos atrasados (piores primeiro). */
  async late(): Promise<LoanStats[]> {
    const { data, error } = await supabase
      .from('loan_stats')
      .select('*')
      .eq('effective_status', 'atrasado')
      .order('days_late', { ascending: false })
      .limit(5)
    if (error) throw new Error('Não foi possível carregar os atrasados')
    return data as LoanStats[]
  },
}
