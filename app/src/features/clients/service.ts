import { supabase } from '../../core/supabase'
import type { Client, ClientInput, ClientStats } from './types'

/** Traduz erros do banco para mensagens amigáveis. */
function friendly(error: { code?: string; message: string }): Error {
  if (error.code === '42501' || (error.message ?? '').includes('row-level security'))
    return new Error('Seu período de acesso terminou — ative sua assinatura para continuar')
  if (error.code === '23505')
    return new Error('Já existe um cliente com este CPF/CNPJ')
  if (error.code === '23503')
    return new Error('Este cliente possui empréstimos e não pode ser excluído')
  return new Error('Algo deu errado. Tente novamente.')
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Sessão expirada. Entre novamente.')
  return id
}

export const clientsService = {
  /** Lista todos os clientes com os agregados financeiros. */
  async list(): Promise<ClientStats[]> {
    const { data, error } = await supabase
      .from('client_stats')
      .select('*')
      .order('name')
    if (error) throw friendly(error)
    return data as ClientStats[]
  },

  async get(id: string): Promise<ClientStats> {
    const { data, error } = await supabase
      .from('client_stats')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw friendly(error)
    return data as ClientStats
  },

  async create(input: ClientInput): Promise<Client> {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...input, user_id })
      .select()
      .single()
    if (error) throw friendly(error)
    return data as Client
  },

  async update(id: string, input: ClientInput): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw friendly(error)
    return data as Client
  },

  /** Só funciona para clientes sem empréstimos (FK RESTRICT no banco). */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw friendly(error)
  },
}
