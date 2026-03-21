/**
 * Messages Service
 *
 * Handles all communication between the user and the AI agent —
 * both text messages and call records.
 *
 * ─── Real API (Supabase) ──────────────────────────────────────────────────────
 *
 * Tables used:
 *   messages  — stores all text messages (user + agent)
 *   calls     — stores call metadata; linked to messages via message_id
 *
 * Real-time:
 *   Subscribe to the messages table via Supabase Realtime so new agent messages
 *   and incoming call records appear instantly without polling.
 *   Channel: supabase.channel('messages').on('postgres_changes', ...)
 *
 * ─── Endpoints ───────────────────────────────────────────────────────────────
 *
 * GET  /rest/v1/messages
 *      ?user_id=eq.{userId}
 *      &select=*,calls(*)
 *      &order=created_at.asc
 *      &limit=50
 *      &created_at=gt.{cursor}   ← pagination cursor (ISO timestamp)
 *
 *   Response: Message[]
 *
 * POST /rest/v1/messages
 *   Body:    { user_id, type: 'user', kind: 'text', text, created_at }
 *   Response: Message   (the inserted row)
 *
 * ─── Types ────────────────────────────────────────────────────────────────────
 *
 * Message (text):
 * {
 *   id:         string        — UUID
 *   user_id:    string        — UUID
 *   type:       'user' | 'agent'
 *   kind:       'text'
 *   text:       string
 *   created_at: string        — ISO 8601
 *   date:       string        — display label e.g. 'Today', 'Monday'
 *   time:       string        — display label e.g. '09:02'
 * }
 *
 * Message (call):
 * {
 *   id:          string
 *   user_id:     string
 *   type:        'call'
 *   kind:        'call'
 *   created_at:  string
 *   date:        string
 *   time:        string
 *   call_id:     string        — UUID of the related row in calls table
 *   duration:    string        — human-readable e.g. '4 min 32 sec'
 *   task_id:     string | null — UUID of the task discussed
 *   task:        string        — task title (denormalised for display)
 *   user_status: 'inprogress' | 'notstarted' | 'cantfinish'
 *   summary:     string        — what was discussed
 *   followUp:    string | null — action the agent took after the call
 * }
 */
import { API_CONFIG } from '../config'
import { apiFetch } from '../client'
import { delay, getMockMessages, addMockMessage } from '../mock/db'

// ─── getMessages ──────────────────────────────────────────────────────────────

/**
 * Fetches the full message history for the current user.
 *
 * @param {object} opts
 * @param {number} opts.limit   - max messages to return (default 50)
 * @param {string} opts.cursor  - ISO timestamp for pagination (load older messages)
 * @returns {Promise<{ messages: Message[] }>}
 */
export async function getMessages({ limit = 50, cursor = null } = {}) {
  if (API_CONFIG.USE_MOCK) {
    await delay()
    return { messages: getMockMessages() }
  }

  // Real: join calls table so call metadata comes back in one request
  let path = `/rest/v1/messages?user_id=eq.me&select=*,calls(*)&order=created_at.asc&limit=${limit}`
  if (cursor) path += `&created_at=gt.${encodeURIComponent(cursor)}`
  return apiFetch(path)
}

// ─── sendMessage ──────────────────────────────────────────────────────────────

/**
 * Sends a text message from the user to the agent.
 * The agent's reply will arrive via the real-time subscription.
 *
 * POST /rest/v1/messages
 * Body: { user_id, type: 'user', kind: 'text', text, created_at }
 *
 * @param {string} text - the message content
 * @returns {Promise<{ message: Message }>}
 */
export async function sendMessage(text) {
  if (API_CONFIG.USE_MOCK) {
    await delay()
    const message = addMockMessage(text)
    return { message }
  }

  return apiFetch('/rest/v1/messages', {
    method: 'POST',
    body: JSON.stringify({
      type: 'user',
      kind: 'text',
      text,
      created_at: new Date().toISOString(),
    }),
  })
}

// ─── subscribeToMessages ──────────────────────────────────────────────────────

/**
 * Subscribes to new messages in real-time (agent replies, incoming call records).
 *
 * Real implementation uses Supabase Realtime:
 *   const channel = supabase
 *     .channel('messages')
 *     .on('postgres_changes', {
 *       event: 'INSERT',
 *       schema: 'public',
 *       table: 'messages',
 *       filter: `user_id=eq.${userId}`,
 *     }, (payload) => callback(payload.new))
 *     .subscribe()
 *
 *   Returns: () => supabase.removeChannel(channel)
 *
 * @param {function} callback - called with each new Message
 * @returns {function} unsubscribe
 */
export function subscribeToMessages(callback) {
  if (API_CONFIG.USE_MOCK) {
    // Mock: no real-time — agent replies are not simulated
    return () => {}
  }

  // Real: wire up Supabase Realtime channel here
  // See AGENTS.md §Real-time for full implementation
  console.warn('subscribeToMessages: real-time not yet connected')
  return () => {}
}
