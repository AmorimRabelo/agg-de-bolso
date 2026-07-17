import { supabase } from '../../core/supabase'

export interface UserSettings {
  id: string
  user_id: string
  company_name: string | null
  default_interest_rate: number | string
  theme: string
  currency: string
}

export interface SettingsInput {
  company_name: string | null
  default_interest_rate: number
  theme: string
}

export const settingsService = {
  async get(): Promise<UserSettings> {
    const { data, error } = await supabase.from('user_settings').select('*').single()
    if (error) throw new Error('Não foi possível carregar as configurações')
    return data as UserSettings
  },

  async update(input: SettingsInput): Promise<UserSettings> {
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id
    if (!uid) throw new Error('Sessão expirada. Entre novamente.')
    const { data, error } = await supabase
      .from('user_settings')
      .update(input)
      .eq('user_id', uid)
      .select()
      .single()
    if (error) throw new Error('Não foi possível salvar as configurações')
    return data as UserSettings
  },
}
