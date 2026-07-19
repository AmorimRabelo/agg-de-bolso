import { supabase } from '../../core/supabase'

export type SubscriptionStatus = 'trial' | 'ativa' | 'inadimplente' | 'bloqueada' | 'cancelada'

export interface Subscription {
  id: string
  user_id: string
  plan: 'essencial' | 'profissional'
  status: SubscriptionStatus
  trial_ends_at: string
  paid_until: string | null
  notes: string | null
  created_at: string
}

export interface AdminSubscription extends Subscription {
  email: string
  full_name: string | null
  effective_status: SubscriptionStatus | 'trial_vencido'
  trial_days_left: number
}

/** Assinatura dá acesso? (mesma regra do banco — has_access) */
export function hasAccess(sub: Subscription | null | undefined): boolean {
  if (!sub) return true // ainda carregando — não bloquear indevidamente
  if (sub.status === 'ativa') return true
  if (sub.status === 'trial') return new Date(sub.trial_ends_at) > new Date()
  return false
}

export function trialDaysLeft(sub: Subscription): number {
  const ms = new Date(sub.trial_ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

export interface AdminMetrics {
  total_accounts: number
  trial_active: number
  trial_expired: number
  active: number
  blocked: number
  pro_plan: number
  mrr: number
  signups_7d: number
  signups_30d: number
  active_users_7d: number
  active_users_30d: number
  total_clients: number
  total_loans: number
  total_payments: number
  volume_lent: number | string
  volume_received: number | string
  generated_at: string
}

export interface SignupPoint {
  dia: string
  novos: number
}

export const subscriptionService = {
  async getMine(): Promise<Subscription | null> {
    const { data, error } = await supabase.from('subscriptions').select('*').maybeSingle()
    if (error) throw new Error('Não foi possível carregar a assinatura')
    return data as Subscription | null
  },

  async amIAdmin(): Promise<boolean> {
    const { data, error } = await supabase.from('admins').select('user_id')
    if (error) return false
    return (data?.length ?? 0) > 0
  },

  // ---- painel dos sócios -------------------------------------
  async adminList(): Promise<AdminSubscription[]> {
    const { data, error } = await supabase
      .from('admin_subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error('Não foi possível carregar os assinantes')
    return data as AdminSubscription[]
  },

  async adminUpdate(
    userId: string,
    patch: Partial<Pick<Subscription, 'status' | 'paid_until' | 'trial_ends_at' | 'plan' | 'notes'>>,
  ): Promise<void> {
    const { error } = await supabase.from('subscriptions').update(patch).eq('user_id', userId)
    if (error) throw new Error('Não foi possível atualizar a assinatura')
  },

  async adminMetrics(): Promise<AdminMetrics> {
    const { data, error } = await supabase.rpc('admin_metrics')
    if (error) throw new Error('Não foi possível carregar as métricas')
    return data as AdminMetrics
  },

  async adminSignupsSeries(): Promise<SignupPoint[]> {
    const { data, error } = await supabase.rpc('admin_signups_series')
    if (error) throw new Error('Não foi possível carregar o gráfico')
    return (data as SignupPoint[]) ?? []
  },
}
