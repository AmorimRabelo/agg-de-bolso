import { supabase } from '../../core/supabase'
import type { InstallmentStats, Loan, LoanInput, LoanStats } from './types'

function friendly(error: { code?: string; message: string }): Error {
  // Mensagens levantadas pelos triggers do banco chegam em message
  const m = error.message ?? ''
  if (error.code === '42501' || m.includes('row-level security'))
    return new Error('Seu período de acesso terminou — ative sua assinatura para continuar')
  if (m.includes('cancelamento')) return new Error('Informe o motivo do cancelamento')
  if (m.includes('pagamentos antes'))
    return new Error('Cancele os pagamentos deste empréstimo antes de cancelá-lo')
  if (m.includes('não pode ser alterado'))
    return new Error('Empréstimo cancelado não pode ser alterado')
  if (m.includes('menor que o valor'))
    return new Error('O valor emprestado não pode ser menor que o que já foi recebido')
  if (error.code === '23514') return new Error('Valores inválidos — confira os campos')
  return new Error('Algo deu errado. Tente novamente.')
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Sessão expirada. Entre novamente.')
  return id
}

export const loansService = {
  async list(): Promise<LoanStats[]> {
    const { data, error } = await supabase
      .from('loan_stats')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw friendly(error)
    return data as LoanStats[]
  },

  async listByClient(clientId: string): Promise<LoanStats[]> {
    const { data, error } = await supabase
      .from('loan_stats')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (error) throw friendly(error)
    return data as LoanStats[]
  },

  async get(id: string): Promise<LoanStats> {
    const { data, error } = await supabase
      .from('loan_stats')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw friendly(error)
    return data as LoanStats
  },

  async create(input: LoanInput): Promise<Loan> {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('loans')
      .insert({ ...input, user_id })
      .select()
      .single()
    if (error) throw friendly(error)
    return data as Loan
  },

  async update(id: string, input: Partial<LoanInput>): Promise<Loan> {
    const { data, error } = await supabase
      .from('loans')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw friendly(error)
    return data as Loan
  },

  /** Parcelas de um empréstimo (geradas pelo banco), com cálculos. */
  async listInstallments(loanId: string): Promise<InstallmentStats[]> {
    const { data, error } = await supabase
      .from('installment_stats')
      .select('*')
      .eq('loan_id', loanId)
      .order('number')
    if (error) throw friendly(error)
    return data as InstallmentStats[]
  },

  /** Cancelamento (nunca exclusão) — o banco exige motivo e audita. */
  async cancel(id: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('loans')
      .update({ status: 'cancelado', cancel_reason: reason })
      .eq('id', id)
    if (error) throw friendly(error)
  },
}
