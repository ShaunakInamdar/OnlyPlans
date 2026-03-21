/**
 * API Configuration
 *
 * Toggle USE_MOCK to switch between the fake backend and the real Supabase backend.
 * All other values are read from environment variables (.env file).
 *
 * Required .env variables for production:
 *   VITE_USE_MOCK=false
 *   VITE_SUPABASE_URL=https://<your-project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<your-anon-key>
 */
export const API_CONFIG = {
  // Set to false to use the real Supabase backend
  USE_MOCK: import.meta.env.VITE_USE_MOCK !== 'false',

  // Supabase project URL — used for all REST and real-time calls
  BASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co',

  // Supabase anon key — safe to expose in the browser; row-level security enforces access
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',

  // Simulated network delay for mock responses (ms) — makes dev feel realistic
  MOCK_DELAY_MS: 350,
}
