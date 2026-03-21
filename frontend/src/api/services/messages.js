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

// ─── transformMessage ─────────────────────────────────────────────────────────

/**
 * Transforms a raw Supabase row into the shape the frontend expects.
 *
 * Supabase PostgREST returns:
 *   - snake_case field names
 *   - joined calls as a nested array: msg.calls = [{ id, follow_up, task_title, ... }]
 *
 * The frontend expects:
 *   - msg.date / msg.time  computed from created_at
 *   - For kind='call': flattened fields: call_id, duration, task, followUp, etc.
 */
function transformMessage(raw) {
  const createdAt = new Date(raw.created_at)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()

  let dateLabel
  if (isSameDay(createdAt, today)) {
    dateLabel = 'Today'
  } else if (isSameDay(createdAt, yesterday)) {
    dateLabel = 'Yesterday'
  } else {
    dateLabel = createdAt.toLocaleDateString('en-GB', { weekday: 'long' })
  }

  const timeLabel = createdAt.toLocaleTimeString('en-GB', {
    hour:   '2-digit',
    minute: '2-digit',
  })

  const base = {
    ...raw,
    date: dateLabel,
    time: timeLabel,
    calls: undefined,  // remove nested array from output
  }

  // For call messages: flatten the first calls row onto the message
  if (raw.kind === 'call' && Array.isArray(raw.calls) && raw.calls.length > 0) {
    const call = raw.calls[0]
    return {
      ...base,
      call_id:     call.id,
      duration:    call.duration,
      task_id:     call.task_id,
      task:        call.task_title,   // denormalised title stored at call time
      user_status: call.user_status,
      summary:     call.summary,
      followUp:    call.follow_up,    // snake_case → camelCase
    }
  }

  return base
}

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

  // join calls table; task_title is denormalised on calls so no second join needed
  // No user_id filter needed — RLS policy enforces user_id = auth.uid() automatically
  let path = `/rest/v1/messages?select=*,calls(*)&order=created_at.asc&limit=${limit}`
  if (cursor) path += `&created_at=gt.${encodeURIComponent(cursor)}`

  const rows = await apiFetch(path)
  return { messages: rows.map(transformMessage) }
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

  const row = await apiFetch('/rest/v1/messages', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      type: 'user',
      kind: 'text',
      text,
      created_at: new Date().toISOString(),
    }),
  })
  // Supabase returns an array for POST with return=representation
  const inserted = Array.isArray(row) ? row[0] : row
  return { message: transformMessage(inserted) }
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
export function subscribeToMessages(supabaseClient, userId, callback) {
  if (API_CONFIG.USE_MOCK) {
    // Mock: no real-time — agent replies are not simulated
    return () => {}
  }

  if (!supabaseClient) {
    console.warn('subscribeToMessages: no supabase client provided')
    return () => {}
  }

  // Subscribe to new rows on the messages table for this user.
  // New agent messages and call record cards arrive here in real-time.
  const channel = supabaseClient
    .channel('messages')
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const raw = payload.new

        // For call messages, fetch the linked calls row so we can flatten it
        if (raw.kind === 'call') {
          const callRows = await supabaseClient
            .from('calls')
            .select('*')
            .eq('message_id', raw.id)
            .limit(1)
          raw.calls = callRows.data || []
        } else {
          raw.calls = []
        }

        callback(transformMessage(raw))
      }
    )
    .subscribe()

  return () => supabaseClient.removeChannel(channel)
}
