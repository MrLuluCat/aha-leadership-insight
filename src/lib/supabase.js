import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client = null
let configError = ''

if (url && anonKey) {
  try {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  } catch (err) {
    configError = err.message
  }
}

export const supabase = client
export const isSupabaseConfigured = Boolean(client)
export const supabaseConfigError = configError

export function requireClient() {
  if (!client) {
    throw new Error(
      configError ||
        'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env.'
    )
  }
  return client
}
