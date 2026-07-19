import { supabase } from '../../core/supabase'
import type { Receivable } from '../loans/types'

export const notificationsService = {
  /** Todos os recebíveis em atraso (empréstimos únicos + parcelas), piores primeiro. */
  async overdue(): Promise<Receivable[]> {
    const { data, error } = await supabase
      .from('receivables')
      .select('*')
      .gt('days_late', 0)
      .order('days_late', { ascending: false })
    if (error) throw new Error('Não foi possível carregar as cobranças')
    return data as Receivable[]
  },
}
