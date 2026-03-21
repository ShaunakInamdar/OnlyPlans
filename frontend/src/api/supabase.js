import { createClient } from '@supabase/supabase-js'
import { API_CONFIG } from './config'
import { getAuthToken } from './client'

// Supabase JS client — used for Realtime subscriptions.
// REST calls still use apiFetch (raw fetch) for simplicity.
export const supabase = createClient(API_CONFIG.BASE_URL, API_CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  },
})

// Authenticate the Realtime WebSocket with the user's JWT
const token = getAuthToken()
if (token) {
  supabase.realtime.setAuth(token)
}

// Decode the sub (user UUID) from the stored JWT without a library
export function getUserId() {
  const t = getAuthToken()
  if (!t) return null
  try {
    return JSON.parse(atob(t.split('.')[1])).sub
  } catch {
    return null
  }
}
