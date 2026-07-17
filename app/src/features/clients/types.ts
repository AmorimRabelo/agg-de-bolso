import type { ClientStatus } from '../../core/constants'

export interface Client {
  id: string
  user_id: string
  name: string
  cpf_cnpj: string | null
  phone: string | null
  whatsapp: string | null
  notes: string | null
  status: ClientStatus
  created_at: string
  updated_at: string
}

/** Linha da view client_stats (cliente + agregados financeiros). */
export interface ClientStats extends Client {
  loan_count: number
  total_lent: number | string
  total_received: number | string
  paid_principal: number | string
  paid_interest: number | string
  pending_total: number | string
  return_pct: number | string
}

export interface ClientInput {
  name: string
  cpf_cnpj: string | null
  phone: string | null
  whatsapp: string | null
  notes: string | null
  status: ClientStatus
}
