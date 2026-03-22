/**
 * Tasks Service
 *
 * CRUD operations for tasks and their subtasks.
 *
 * ─── Real API (Supabase) ──────────────────────────────────────────────────────
 *
 * Tables:
 *   tasks    — one row per task
 *   subtasks — child rows linked by task_id; ordered by `position`
 *
 * ─── Endpoints ────────────────────────────────────────────────────────────────
 *
 * GET  /rest/v1/tasks
 *      ?user_id=eq.{userId}&select=*,subtasks(*)&order=due_order.asc,created_at.asc
 *   Response: Task[]
 *
 * POST /rest/v1/tasks
 *   Body:    { user_id, title, goal, why, status, due, due_order, notes, reminder_at }
 *   Response: Task
 *
 * PATCH /rest/v1/tasks?id=eq.{taskId}
 *   Body:    Partial<Task>   e.g. { status: 'done' }
 *   Response: Task
 *
 * DELETE /rest/v1/tasks?id=eq.{taskId}
 *   Response: 204 No Content
 *
 * PATCH /rest/v1/subtasks?id=eq.{subtaskId}
 *   Body:    { done: boolean }
 *   Response: Subtask
 *
 * ─── Types ────────────────────────────────────────────────────────────────────
 *
 * Task:
 * {
 *   id:          string     — UUID
 *   user_id:     string     — UUID
 *   title:       string
 *   goal:        string     — the parent goal/category name
 *   why:         string     — personal motivation set during onboarding call
 *   status:      'todo' | 'inprogress' | 'done'
 *   due:         string     — human-readable label e.g. 'Today', 'Tomorrow'
 *   due_order:   0|1|2|3   — 0=overdue, 1=today, 2=tomorrow, 3=later (for sorting)
 *   notes:       string     — agent's note on this task
 *   reminder_at: string     — ISO 8601 — when the agent will send a reminder
 *   created_at:  string     — ISO 8601
 *   subtasks:    Subtask[]  — joined from subtasks table
 * }
 *
 * Subtask:
 * {
 *   id:       string   — UUID
 *   task_id:  string   — UUID
 *   text:     string
 *   done:     boolean
 *   position: number   — display order
 * }
 */
import { API_CONFIG } from '../config'
import { apiFetch } from '../client'
import { delay, getMockTasks, updateMockTask, toggleMockSubtask } from '../mock/db'

// ─── getTasks ─────────────────────────────────────────────────────────────────

/**
 * Fetches all tasks for the current user, sorted by due_order then created_at.
 * Subtasks are returned nested under each task.
 *
 * @returns {Promise<{ tasks: Task[] }>}
 */
export async function getTasks() {
  if (API_CONFIG.USE_MOCK) {
    await delay()
    return { tasks: getMockTasks() }
  }

  // No user_id filter needed — RLS enforces user_id = auth.uid() automatically
  const rows = await apiFetch(
    '/rest/v1/tasks?select=*,subtasks(*)&order=due_order.asc,created_at.asc'
  )
  return { tasks: rows }
}

// ─── updateTask ───────────────────────────────────────────────────────────────

/**
 * Updates one or more fields on a task (e.g. marking it complete).
 *
 * PATCH /rest/v1/tasks?id=eq.{taskId}
 *
 * Marking a task done also triggers a backend function that:
 *   1. Awards XP to the user (scaled by task difficulty / due_order)
 *   2. Updates the streak counter
 *   3. Checks milestone unlocks
 *
 * @param {string} taskId   - UUID of the task
 * @param {object} updates  - fields to update e.g. { status: 'done' }
 * @returns {Promise<{ task: Task }>}
 */
export async function updateTask(taskId, updates) {
  if (API_CONFIG.USE_MOCK) {
    await delay()
    const task = updateMockTask(taskId, updates)
    return { task }
  }

  const rows = await apiFetch(`/rest/v1/tasks?id=eq.${taskId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(updates),
  })
  return { task: Array.isArray(rows) ? rows[0] : rows }
}

// ─── toggleSubtask ────────────────────────────────────────────────────────────

/**
 * Toggles the done state of a single subtask.
 *
 * PATCH /rest/v1/subtasks?id=eq.{subtaskId}
 * Body: { done: !current_done }
 *
 * @param {string} taskId     - UUID of the parent task
 * @param {string} subtaskId  - UUID of the subtask
 * @returns {Promise<{ task: Task }>}  — returns full updated task for convenience
 */
export async function toggleSubtask(taskId, subtaskId) {
  if (API_CONFIG.USE_MOCK) {
    await delay(150) // shorter delay — feels snappier for checkbox taps
    const task = toggleMockSubtask(taskId, subtaskId)
    return { task }
  }

  // Real: fetch current done value, then PATCH the opposite
  // In practice, use a Supabase Edge Function to do this atomically:
  // POST /functions/v1/toggle-subtask  { taskId, subtaskId }
  return apiFetch(`/rest/v1/subtasks?id=eq.${subtaskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ done: true }), // backend should XOR the current value
  })
}
