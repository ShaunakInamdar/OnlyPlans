/**
 * Mock In-Memory Database
 *
 * This file is the single source of truth for all mock data.
 * It replaces src/data/mockData.js and is used exclusively by the mock service functions.
 *
 * When connecting a real backend: delete this file and update each service in
 * src/api/services/ to use apiFetch() instead of the mock functions below.
 *
 * State is mutable — changes (e.g. toggling a subtask) persist for the session,
 * making the mock feel like a real API.
 */
import { API_CONFIG } from '../config'

// Simulates network round-trip latency
export const delay = (ms = API_CONFIG.MOCK_DELAY_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms))

// ─── Mock User ─────────────────────────────────────────────────────────────────
/**
 * Supabase table: users (extended with mindprint JSONB column)
 *
 * The "mindprint" is collected during onboarding and referenced by the AI agent
 * on every call to personalise its tone, timing, and framing.
 */
export const mockUser = {
  id: 'user_001',
  name: 'Alex',
  email: 'alex@example.com',
  phone: '+49 151 12345678',
  created_at: '2026-03-15T08:00:00Z',
  // Mindprint — built during the onboarding voice call
  mindprint: {
    peak_hours: '8am–11am',
    blocked_hours: ['12pm–1pm', 'after 8pm'],
    work_style: 'flexible',             // 'flexible' | 'structured'
    accountability_style: 'direct',     // 'direct' | 'gentle'
    motivation_driver: 'rewards',       // 'rewards' | 'consequences' | 'progress'
    check_in_frequency: 'twice_daily',  // 'once_daily' | 'twice_daily' | 'hourly'
    fallback_on_no_answer: 'text_after_30min', // 'text_after_30min' | 'retry' | 'wait'
    tone: 'straight_no_fluff',
  },
}

// ─── Mock Messages ─────────────────────────────────────────────────────────────
/**
 * Supabase tables: messages + calls (joined by message_id)
 *
 * kind = 'text'  → a chat message (user or agent)
 * kind = 'call'  → a completed accountability call; carries call metadata
 *
 * Messages are ordered by created_at ASC (oldest first, newest at bottom).
 */
let _messages = [
  {
    id: 'msg_001',
    user_id: 'user_001',
    type: 'agent',
    kind: 'text',
    text: "Hey! I've reviewed your goals for this week. You're off to a great start — let's keep the momentum going 🙌",
    created_at: '2026-03-17T09:02:00Z',
    date: 'Monday',
    time: '09:02',
  },
  {
    id: 'msg_002',
    user_id: 'user_001',
    type: 'user',
    kind: 'text',
    text: "Thanks! I'm feeling a bit overwhelmed though, not sure where to start.",
    created_at: '2026-03-17T09:05:00Z',
    date: 'Monday',
    time: '09:05',
  },
  {
    id: 'msg_003',
    user_id: 'user_001',
    type: 'agent',
    kind: 'text',
    text: "That's totally normal. Let's narrow it down — your top priority today is finishing the project proposal. Everything else can wait. Can you give it 25 minutes right now?",
    created_at: '2026-03-17T09:06:00Z',
    date: 'Monday',
    time: '09:06',
  },
  {
    id: 'msg_004',
    user_id: 'user_001',
    type: 'user',
    kind: 'text',
    text: 'Yeah, I think I can do that.',
    created_at: '2026-03-17T09:07:00Z',
    date: 'Monday',
    time: '09:07',
  },
  {
    // Call record — the agent called the user at 10:15
    id: 'msg_005',
    user_id: 'user_001',
    type: 'call',
    kind: 'call',
    created_at: '2026-03-17T10:15:00Z',
    date: 'Monday',
    time: '10:15',
    // Call-specific fields (from the calls table, joined here)
    call_id: 'call_001',
    duration: '4 min 32 sec',
    task_id: 'task_012',
    task: 'Complete project proposal',
    user_status: 'inprogress',   // 'inprogress' | 'notstarted' | 'cantfinish'
    summary: 'You made good progress on the introduction section. We agreed to tackle the budget section next.',
    followUp: 'Check-in scheduled for 2:00 PM.',
  },
  {
    id: 'msg_006',
    user_id: 'user_001',
    type: 'agent',
    kind: 'text',
    text: "Great call! You've completed 2 of 5 tasks today. That's already 40% — solid progress. Want me to push tomorrow's gym session to the afternoon so you have more focus time in the morning?",
    created_at: '2026-03-17T11:30:00Z',
    date: 'Monday',
    time: '11:30',
  },
  {
    id: 'msg_007',
    user_id: 'user_001',
    type: 'user',
    kind: 'text',
    text: 'Yes please, morning is my best time for deep work.',
    created_at: '2026-03-17T11:32:00Z',
    date: 'Monday',
    time: '11:32',
  },
  {
    id: 'msg_008',
    user_id: 'user_001',
    type: 'agent',
    kind: 'text',
    text: "Done! I've moved the gym to 5:30 PM. Your morning block is now fully protected for focused work. You've got this.",
    created_at: '2026-03-17T11:32:30Z',
    date: 'Monday',
    time: '11:32',
  },
  {
    id: 'msg_009',
    user_id: 'user_001',
    type: 'call',
    kind: 'call',
    created_at: '2026-03-17T18:00:00Z',
    date: 'Monday',
    time: '18:00',
    call_id: 'call_002',
    duration: '2 min 11 sec',
    task_id: 'task_012',
    task: 'Complete budget section',
    user_status: 'cantfinish',
    summary: 'You completed 4 out of 5 tasks today. The budget section is still pending.',
    followUp: 'Rescheduled as first task tomorrow morning at 9:00 AM.',
  },
  {
    id: 'msg_010',
    user_id: 'user_001',
    type: 'agent',
    kind: 'text',
    text: "Good morning! Today's focus: finish the budget section (you're so close!) and then prepare for the client call at 3 PM. Ready to start?",
    created_at: '2026-03-21T08:30:00Z',
    date: 'Today',
    time: '08:30',
  },
  {
    id: 'msg_011',
    user_id: 'user_001',
    type: 'user',
    kind: 'text',
    text: "Ready. Let's do it.",
    created_at: '2026-03-21T08:31:00Z',
    date: 'Today',
    time: '08:31',
  },
]

// ─── Mock Tasks ────────────────────────────────────────────────────────────────
/**
 * Supabase tables: tasks + subtasks (subtasks joined as nested array)
 *
 * due_order:
 *   0 = overdue
 *   1 = today
 *   2 = tomorrow
 *   3 = later
 */
let _tasks = [
  {
    id: 'task_011',
    user_id: 'user_001',
    title: 'Write introduction section',
    goal: 'Project Proposal',
    why: 'Land the Müller contract and prove I can run a project solo.',
    status: 'done',            // 'todo' | 'inprogress' | 'done'
    due: 'Yesterday',
    due_order: 0,
    notes: 'Great work — this sets a strong tone for the whole proposal.',
    reminder_at: '2026-03-20T08:45:00Z',
    created_at: '2026-03-15T10:00:00Z',
    subtasks: [
      { id: 'sub_111', task_id: 'task_011', text: 'Draft outline', done: true, position: 0 },
      { id: 'sub_112', task_id: 'task_011', text: 'Write 3 paragraphs', done: true, position: 1 },
      { id: 'sub_113', task_id: 'task_011', text: 'Add project background', done: true, position: 2 },
    ],
  },
  {
    id: 'task_021',
    user_id: 'user_001',
    title: 'Morning run — 30 min',
    goal: 'Health & Fitness',
    why: 'Build the habit before summer. I want to feel good in my body again.',
    status: 'done',
    due: 'Yesterday',
    due_order: 0,
    notes: 'You ran 4.2 km. Personal best this month!',
    reminder_at: '2026-03-20T06:30:00Z',
    created_at: '2026-03-15T10:00:00Z',
    subtasks: [],
  },
  {
    id: 'task_012',
    user_id: 'user_001',
    title: 'Complete budget section',
    goal: 'Project Proposal',
    why: 'Land the Müller contract and prove I can run a project solo.',
    status: 'inprogress',
    due: 'Today',
    due_order: 1,
    notes: "You're halfway through this. Focus on the personnel costs first — that's the bulk of it.",
    reminder_at: '2026-03-21T08:45:00Z',
    created_at: '2026-03-15T10:00:00Z',
    subtasks: [
      { id: 'sub_121', task_id: 'task_012', text: 'Personnel costs', done: true, position: 0 },
      { id: 'sub_122', task_id: 'task_012', text: 'Equipment & software', done: false, position: 1 },
      { id: 'sub_123', task_id: 'task_012', text: 'Contingency buffer', done: false, position: 2 },
    ],
  },
  {
    id: 'task_022',
    user_id: 'user_001',
    title: 'Gym session',
    goal: 'Health & Fitness',
    why: 'Build the habit before summer. I want to feel good in my body again.',
    status: 'todo',
    due: 'Today, 5:30 PM',
    due_order: 1,
    notes: 'Moved to the afternoon to protect your morning focus block.',
    reminder_at: '2026-03-21T17:15:00Z',
    created_at: '2026-03-15T10:00:00Z',
    subtasks: [
      { id: 'sub_221', task_id: 'task_022', text: 'Upper body workout', done: false, position: 0 },
      { id: 'sub_222', task_id: 'task_022', text: 'Stretch & cool down', done: false, position: 1 },
    ],
  },
  {
    id: 'task_031',
    user_id: 'user_001',
    title: 'Read 20 pages of Deep Work',
    goal: 'Learning',
    why: 'Understand focus better so I can actually use these techniques on myself.',
    status: 'inprogress',
    due: 'Today',
    due_order: 1,
    notes: "You're on page 64. The chapter on rhythmic scheduling is very relevant to how we're structuring your day.",
    reminder_at: '2026-03-21T20:00:00Z',
    created_at: '2026-03-15T10:00:00Z',
    subtasks: [],
  },
  {
    id: 'task_013',
    user_id: 'user_001',
    title: 'Prepare client presentation',
    goal: 'Project Proposal',
    why: 'Land the Müller contract and prove I can run a project solo.',
    status: 'todo',
    due: 'Tomorrow',
    due_order: 2,
    notes: 'Based on the proposal, create 5–7 slides. Keep it visual.',
    reminder_at: '2026-03-22T09:00:00Z',
    created_at: '2026-03-15T10:00:00Z',
    subtasks: [
      { id: 'sub_131', task_id: 'task_013', text: 'Create slide deck', done: false, position: 0 },
      { id: 'sub_132', task_id: 'task_013', text: 'Add visuals', done: false, position: 1 },
      { id: 'sub_133', task_id: 'task_013', text: 'Rehearse once', done: false, position: 2 },
    ],
  },
]

// ─── Mock Stats ────────────────────────────────────────────────────────────────
/**
 * In production these values are either:
 *   a) computed by a Supabase database function / view
 *   b) stored in a user_stats table and updated by a trigger on task completion
 *
 * Endpoint: GET /functions/v1/get-stats   (Edge Function)
 * or:       GET /rest/v1/user_stats?user_id=eq.{id}&select=*
 */
const _stats = {
  user_id: 'user_001',
  streak: 6,
  points: 1240,
  level: 4,
  level_name: 'Focus Champion',
  next_level_points: 1500,
  weekly_goal: 5,
  weekly_done: 4,
  completed_total: 23,
  milestones: [
    { id: 'ms_1', label: '1st task done',  unlocked: true },
    { id: 'ms_2', label: '3-day streak',   unlocked: true },
    { id: 'ms_3', label: '10 tasks done',  unlocked: true },
    { id: 'ms_4', label: '7-day streak',   unlocked: false },
    { id: 'ms_5', label: '50 tasks done',  unlocked: false },
  ],
  week_days: [
    { day: 'Mon', done: 4, total: 5 },
    { day: 'Tue', done: 3, total: 4 },
    { day: 'Wed', done: 5, total: 5 },
    { day: 'Thu', done: 2, total: 4 },
    { day: 'Fri', done: 4, total: 4 },
    { day: 'Sat', done: 1, total: 2 },
    { day: 'Sun', done: 0, total: 0 },
  ],
  agent_nudge: "You're just 260 XP away from Level 5! Complete today's gym session and the budget section to get there. 💪",
}

// ─── Mutation helpers ──────────────────────────────────────────────────────────
// These simulate what database writes would do on the real backend.

export function getMockUser()     { return { ...mockUser } }
export function getMockMessages() { return [..._messages] }
export function getMockTasks()    { return _tasks.map(t => ({ ...t, subtasks: [...t.subtasks] })) }
export function getMockStats()    { return { ..._stats } }

/** Appends a new message to the in-memory list and returns it */
export function addMockMessage(content) {
  const msg = {
    id: `msg_${Date.now()}`,
    user_id: 'user_001',
    type: 'user',
    kind: 'text',
    text: content,
    created_at: new Date().toISOString(),
    date: 'Today',
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
  _messages = [..._messages, msg]
  return msg
}

/** Updates a task's top-level fields (e.g. status) */
export function updateMockTask(taskId, updates) {
  _tasks = _tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
  return _tasks.find(t => t.id === taskId)
}

/** Toggles a single subtask's done state */
export function toggleMockSubtask(taskId, subtaskId) {
  _tasks = _tasks.map(t => {
    if (t.id !== taskId) return t
    return {
      ...t,
      subtasks: t.subtasks.map(s =>
        s.id === subtaskId ? { ...s, done: !s.done } : s
      ),
    }
  })
  return _tasks.find(t => t.id === taskId)
}
