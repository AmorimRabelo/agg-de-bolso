import { createClient } from '@supabase/supabase-js'

// Somente a chave PÚBLICA (publishable/anon) — a segurança real é o RLS no banco.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
