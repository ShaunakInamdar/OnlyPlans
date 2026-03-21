/**
 * User Service
 *
 * Authentication and user profile (mindprint) management.
 *
 * ─── Auth Flow (Supabase Phone OTP) ──────────────────────────────────────────
 *
 * 1. User enters phone number on signup screen
 *    POST /auth/v1/otp
 *    Body: { phone: '+49151...' }
 *
 * 2. User enters the SMS code
 *    POST /auth/v1/verify
 *    Body: { phone, token, type: 'sms' }
 *    Response: { access_token, refresh_token, user }
 *    → Store access_token with setAuthToken(token)
 *
 * 3. All subsequent requests use the JWT in the Authorization header
 *    (handled by apiFetch in client.js)
 *
 * 4. On app load, check for an existing session:
 *    supabase.auth.getSession()
 *    If valid, set the token and proceed. If expired, redirect to login.
 *
 * ─── User Profile Endpoints ──────────────────────────────────────────────────
 *
 * GET  /rest/v1/users?id=eq.me&select=*
 *   Response: User
 *
 * PATCH /rest/v1/users?id=eq.{userId}
 *   Body:    Partial<User>  e.g. { mindprint: { ... } }
 *   Response: User
 *
 * ─── Types ────────────────────────────────────────────────────────────────────
 *
 * User:
 * {
 *   id:         string    — UUID (from Supabase auth.users)
 *   name:       string
 *   email:      string
 *   phone:      string    — E.164 format e.g. '+49151...'
 *   created_at: string    — ISO 8601
 *   mindprint:  Mindprint — built during onboarding, null until onboarding complete
 * }
 *
 * Mindprint:
 * {
 *   peak_hours:            string   — e.g. '8am–11am'
 *   blocked_hours:         string[] — e.g. ['12pm–1pm', 'after 8pm']
 *   work_style:            'flexible' | 'structured'
 *   accountability_style:  'direct' | 'gentle'
 *   motivation_driver:     'rewards' | 'consequences' | 'progress'
 *   check_in_frequency:    'once_daily' | 'twice_daily' | 'hourly'
 *   fallback_on_no_answer: 'text_after_30min' | 'retry' | 'wait'
 *   tone:                  string   — free-form description captured during call
 * }
 */
import { API_CONFIG } from '../config'
import { apiFetch } from '../client'
import { delay, getMockUser } from '../mock/db'

// ─── getCurrentUser ───────────────────────────────────────────────────────────

/**
 * Returns the current authenticated user and their mindprint.
 * Called once on app load to hydrate the user context.
 *
 * @returns {Promise<{ user: User }>}
 */
export async function getCurrentUser() {
  if (API_CONFIG.USE_MOCK) {
    await delay()
    return { user: getMockUser() }
  }

  return apiFetch('/rest/v1/users?id=eq.me&select=*')
}

// ─── updateMindprint ─────────────────────────────────────────────────────────

/**
 * Saves the user's mindprint after onboarding is completed.
 * Called by the onboarding flow (not yet built in the frontend).
 *
 * PATCH /rest/v1/users?id=eq.{userId}
 * Body: { mindprint }
 *
 * @param {object} mindprint - the full mindprint object from onboarding
 * @returns {Promise<{ user: User }>}
 */
export async function updateMindprint(mindprint) {
  if (API_CONFIG.USE_MOCK) {
    await delay()
    return { user: { ...getMockUser(), mindprint } }
  }

  return apiFetch(`/rest/v1/users?id=eq.me`, {
    method: 'PATCH',
    body: JSON.stringify({ mindprint }),
  })
}
