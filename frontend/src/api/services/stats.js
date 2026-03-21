/**
 * Stats Service
 *
 * Provides gamification data: XP, level, streak, weekly progress, milestones.
 *
 * ─── Real API (Supabase) ──────────────────────────────────────────────────────
 *
 * Option A — Stored stats (recommended):
 *   Table: user_stats  (one row per user, updated by database triggers)
 *   Trigger fires on: INSERT/UPDATE on tasks WHERE status = 'done'
 *   Trigger updates: points, streak, completed_total, week_days, milestones
 *
 *   GET /rest/v1/user_stats?user_id=eq.{userId}&select=*
 *
 * Option B — Computed on demand:
 *   POST /functions/v1/get-stats
 *   Body:    { user_id }
 *   Response: Stats
 *   (Slower but always accurate — good for the MVP)
 *
 * Real-time:
 *   After the user marks a task complete, subscribe to user_stats changes
 *   so the gamification screen updates without a page refresh:
 *   supabase.channel('stats').on('postgres_changes', { table: 'user_stats', ... })
 *
 * ─── Types ────────────────────────────────────────────────────────────────────
 *
 * Stats:
 * {
 *   user_id:           string
 *   streak:            number   — consecutive days with at least one completed task
 *   points:            number   — total XP earned
 *   level:             number   — current level (computed from points thresholds)
 *   level_name:        string   — e.g. 'Focus Champion'
 *   next_level_points: number   — XP needed for next level
 *   weekly_goal:       number   — target tasks per day (set during onboarding)
 *   weekly_done:       number   — days this week where goal was hit
 *   completed_total:   number   — all-time completed tasks
 *   milestones:        Milestone[]
 *   week_days:         WeekDay[]
 *   agent_nudge:       string   — motivational message from the agent
 * }
 *
 * Milestone:
 * {
 *   id:       string
 *   label:    string
 *   unlocked: boolean
 * }
 *
 * WeekDay:
 * {
 *   day:   string   — 'Mon' | 'Tue' | ... | 'Sun'
 *   done:  number   — tasks completed that day
 *   total: number   — tasks scheduled that day
 * }
 *
 * XP Award Scale (backend logic):
 *   Overdue task completed:   +5 XP
 *   On-time task completed:  +20 XP
 *   In-progress update:       +5 XP
 *   Daily goal hit:          +50 XP bonus
 *   Streak milestone (7d):  +100 XP bonus
 */
import { API_CONFIG } from '../config'
import { apiFetch } from '../client'
import { delay, getMockStats } from '../mock/db'

// ─── getStats ─────────────────────────────────────────────────────────────────

/**
 * Fetches the gamification stats for the current user.
 *
 * @returns {Promise<{ stats: Stats }>}
 */
export async function getStats() {
  if (API_CONFIG.USE_MOCK) {
    await delay()
    return { stats: getMockStats() }
  }

  // Option A — stored stats table:
  return apiFetch('/rest/v1/user_stats?user_id=eq.me&select=*')
  // Option B — Edge Function:
  // return apiFetch('/functions/v1/get-stats', { method: 'POST' })
}
