import { supabase } from '../../core/supabase'
import type { Payment, PaymentInput } from './types'

function friendly(error: { code?: string; message: string }): Error {
  const m = error.message ?? ''
  if (error.code === '42501' || m.includes('row-level security'))
    return new Error('Seu período de acesso terminou — ative sua assinatura para continuar')
  if (m.includes('excede o principal pendente da parcela'))
    return new Error('O principal informado é maior que o pendente desta parcela')
  if (m.includes('excede o principal'))
    return new Error('O principal informado é maior que o principal pendente')
  if (m.includes('Informe a parcela'))
    return new Error('Escolha a parcela deste pagamento')
  if (m.includes('parcela não aceita'))
    return new Error('Esta parcela já está paga ou cancelada')
  if (m.includes('não aceita pagamentos'))
    return new Error('Este empréstimo está cancelado e não aceita pagamentos')
  if (m.includes('quitado')) return new Error('Este empréstimo já está quitado')
  if (m.includes('motivo')) return new Error('Informe o motivo do cancelamento')
  if (m.includes('não podem ser alterados') || m.includes('não pode ser alterado'))
    return new Error('Pagamentos não podem ser alterados — apenas cancelados')
  if (error.code === '23514')
    return new Error('Valores inválidos: principal + juros deve ser igual ao total')
  return new Error('Algo deu errado. Tente novamente.')
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Sessão expirada. Entre novamente.')
  return id
}

export interface PaymentWithLoan extends Payment {
  loans: { client_id: string; loan_number: number; clients: { name: string } }
}

export const paymentsService = {
  /** Todos os pagamentos ativos do usuário, com cliente (para relatórios). */
  async listAllActive(): Promise<PaymentWithLoan[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*, loans!inner(client_id, loan_number, clients(name))')
      .eq('status', 'ativo')
      .order('payment_date', { ascending: false })
    if (error) throw friendly(error)
    return data as unknown as PaymentWithLoan[]
  },

  /** Pagamentos (ativos e cancelados) de um cliente, para a linha do tempo. */
  async listByClient(clientId: string): Promise<PaymentWithLoan[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*, loans!inner(client_id, loan_number, clients(name))')
      .eq('loans.client_id', clientId)
      .order('payment_date', { ascending: false })
    if (error) throw friendly(error)
    return data as unknown as PaymentWithLoan[]
  },

  async listByLoan(loanId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw friendly(error)
    return data as Payment[]
  },

  async create(input: PaymentInput): Promise<Payment> {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('payments')
      .insert({ ...input, user_id })
      .select()
      .single()
    if (error) throw friendly(error)
    return data as Payment
  },

  /** Cancelamento (nunca exclusão) — o banco exige motivo e audita. */
  async cancel(id: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'cancelado', cancel_reason: reason })
      .eq('id', id)
    if (error) throw friendly(error)
  },
}
