/**
 * API Client
 *
 * Central fetch wrapper for all real (non-mock) API calls.
 * Automatically attaches the auth token and Supabase headers.
 *
 * Authentication:
 *   After login, Supabase returns a JWT access token. Store it with setAuthToken()
 *   and it will be sent on every subsequent request.
 *
 * Supabase REST API base paths:
 *   Tables:         GET  /rest/v1/{table}?select=*
 *   Edge Functions: POST /functions/v1/{function-name}
 *   Auth:           POST /auth/v1/otp   (send OTP)
 *                   POST /auth/v1/verify (verify OTP → returns JWT)
 */
import { API_CONFIG } from './config'

// ─── Auth token storage ───────────────────────────────────────────────────────
// In production Supabase will manage this via supabase-js SDK.
// These helpers are for manual fetch usage.

export function setAuthToken(token) {
  localStorage.setItem('onlyplans_token', token)
}

export function getAuthToken() {
  return localStorage.getItem('onlyplans_token') || ''
}

export function clearAuthToken() {
  localStorage.removeItem('onlyplans_token')
}

// ─── Base fetch wrapper ───────────────────────────────────────────────────────

/**
 * Makes an authenticated request to the Supabase backend.
 *
 * @param {string} path     - e.g. '/rest/v1/tasks?select=*'
 * @param {object} options  - standard fetch options (method, body, headers…)
 * @returns {Promise<any>}  - parsed JSON response body
 * @throws {Error}          - if the response is not 2xx
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_CONFIG.BASE_URL}${path}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Supabase requires both headers for authenticated requests
      'Authorization': `Bearer ${getAuthToken()}`,
      'apikey': API_CONFIG.SUPABASE_ANON_KEY,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `API error ${response.status}: ${path}`)
  }

  // 204 No Content — return null instead of trying to parse empty body
  if (response.status === 204) return null
  return response.json()
}
