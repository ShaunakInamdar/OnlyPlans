# AGENTS.md — Backend Integration Guide

This document is the single reference for any backend developer connecting a real backend to the OnlyPlans frontend. It covers every data model, API endpoint, integration point, and behaviour the frontend depends on.

---

## 1. Project Overview

**OnlyPlans** is an AI-powered accountability partner app targeting people with ADHD and focus challenges. The core mechanic is that **the AI agent proactively calls the user** multiple times per day. The user does not initiate calls — the agent does.

### The Core Loop

```
Onboarding call → User profile (mindprint) built
     ↓
Agent schedules first task + first check-in call
     ↓
[Scheduled time] Agent calls user
     ↓
User reports status: In progress / Not started / Couldn't finish
     ↓
Agent updates task, adjusts schedule, sends follow-up text
     ↓
Task completed → XP awarded → Streak updated → Milestones checked
```

---

## 2. Tech Stack

| Layer         | Technology                                      |
|---------------|-------------------------------------------------|
| Frontend      | React + Vite + Tailwind CSS + Framer Motion     |
| Backend / DB  | Supabase (Postgres + Auth + Realtime + Edge Fn) |
| Auth          | Supabase Auth — phone number OTP (SMS)          |
| Calling       | Vapi or Twilio (outbound AI voice calls)        |
| Scheduling    | Supabase pg_cron or a cron Edge Function        |
| AI Agent      | Claude API (Anthropic) — for call conversations and text responses |

---

## 3. Environment Variables

The frontend reads these from a `.env` file. The backend must provide them.

```
VITE_USE_MOCK=false                         # set to false for production
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>           # safe to expose; RLS enforces access
```

---

## 4. Authentication

### Flow: Phone OTP

1. User enters phone number (E.164 format, e.g. `+49151...`)
2. Frontend calls `POST /auth/v1/otp` → Supabase sends SMS code
3. User enters code → Frontend calls `POST /auth/v1/verify` → Returns JWT
4. JWT stored in localStorage as `onlyplans_token`
5. All subsequent requests include `Authorization: Bearer <jwt>`

### Supabase Auth Endpoints

```
POST /auth/v1/otp
Body:     { "phone": "+49151..." }
Response: { }   (Supabase sends SMS)

POST /auth/v1/verify
Body:     { "phone": "+49151...", "token": "123456", "type": "sms" }
Response: { "access_token": "...", "refresh_token": "...", "user": { ... } }
```

### Row-Level Security (RLS)

Every table must have RLS enabled. The standard policy:

```sql
-- Users can only read/write their own rows
CREATE POLICY "user_isolation" ON <table>
  USING (user_id = auth.uid());
```

---

## 5. Database Schema

### `users`

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE,
  phone       TEXT UNIQUE NOT NULL,       -- E.164 format
  created_at  TIMESTAMPTZ DEFAULT now(),
  mindprint   JSONB                        -- null until onboarding complete
);
```

**mindprint JSONB shape:**

```json
{
  "peak_hours":            "8am–11am",
  "blocked_hours":         ["12pm–1pm", "after 8pm"],
  "work_style":            "flexible",
  "accountability_style":  "direct",
  "motivation_driver":     "rewards",
  "check_in_frequency":    "twice_daily",
  "fallback_on_no_answer": "text_after_30min",
  "tone":                  "straight_no_fluff"
}
```

**Allowed values:**

| Field                  | Values                                        |
|------------------------|-----------------------------------------------|
| `work_style`           | `flexible`, `structured`                      |
| `accountability_style` | `direct`, `gentle`                            |
| `motivation_driver`    | `rewards`, `consequences`, `progress`         |
| `check_in_frequency`   | `once_daily`, `twice_daily`, `hourly`         |
| `fallback_on_no_answer`| `text_after_30min`, `retry`, `wait`           |

---

### `tasks`

```sql
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  goal        TEXT NOT NULL,              -- parent goal/category name
  why         TEXT,                       -- personal motivation set during onboarding
  status      TEXT NOT NULL DEFAULT 'todo',  -- 'todo' | 'inprogress' | 'done'
  due         TEXT,                       -- human-readable label e.g. 'Today', 'Tomorrow'
  due_order   INTEGER NOT NULL DEFAULT 3, -- 0=overdue, 1=today, 2=tomorrow, 3=later
  notes       TEXT,                       -- agent's note, updated after each call
  reminder_at TIMESTAMPTZ,               -- when the agent will next call / remind
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**`due_order` must be kept up to date.** Options:
- Update via a nightly pg_cron job that recalculates `due_order` based on actual due dates
- Or store a `due_date DATE` column and compute `due_order` as a generated column

---

### `subtasks`

```sql
CREATE TABLE subtasks (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id  UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  done     BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0      -- display order
);
```

---

### `messages`

```sql
CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,   -- 'user' | 'agent'
  kind       TEXT NOT NULL,   -- 'text' | 'call'
  text       TEXT,            -- populated for kind='text'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### `calls`

```sql
CREATE TABLE calls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  message_id  UUID REFERENCES messages(id),  -- the call card in the chat
  task_id     UUID REFERENCES tasks(id),
  started_at  TIMESTAMPTZ NOT NULL,
  duration    TEXT,                           -- human-readable e.g. '4 min 32 sec'
  user_status TEXT,                           -- 'inprogress' | 'notstarted' | 'cantfinish'
  summary     TEXT,                           -- written by agent after call
  follow_up   TEXT                            -- action taken after call
);
```

**After a call completes:**
1. Insert row into `calls`
2. Insert a linked row into `messages` with `kind='call'` and `message_id` pointing back
3. Update `tasks.status` and `tasks.notes` based on `user_status`
4. Award XP via the XP trigger (see §8)

---

### `user_stats`

```sql
CREATE TABLE user_stats (
  user_id           UUID PRIMARY KEY REFERENCES users(id),
  streak            INTEGER NOT NULL DEFAULT 0,
  points            INTEGER NOT NULL DEFAULT 0,
  level             INTEGER NOT NULL DEFAULT 1,
  level_name        TEXT NOT NULL DEFAULT 'Getting Started',
  next_level_points INTEGER NOT NULL DEFAULT 100,
  weekly_goal       INTEGER NOT NULL DEFAULT 5,
  weekly_done       INTEGER NOT NULL DEFAULT 0,
  completed_total   INTEGER NOT NULL DEFAULT 0,
  milestones        JSONB NOT NULL DEFAULT '[]',
  week_days         JSONB NOT NULL DEFAULT '[]',
  agent_nudge       TEXT,
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

**`milestones` JSONB shape:**

```json
[
  { "id": "ms_1", "label": "1st task done",  "unlocked": true  },
  { "id": "ms_2", "label": "3-day streak",   "unlocked": true  },
  { "id": "ms_3", "label": "10 tasks done",  "unlocked": true  },
  { "id": "ms_4", "label": "7-day streak",   "unlocked": false },
  { "id": "ms_5", "label": "50 tasks done",  "unlocked": false }
]
```

**`week_days` JSONB shape:**

```json
[
  { "day": "Mon", "done": 4, "total": 5 },
  { "day": "Tue", "done": 3, "total": 4 },
  ...
]
```

---

## 6. REST API Endpoints

All endpoints follow Supabase PostgREST conventions.
Base URL: `https://<ref>.supabase.co/rest/v1/`

### Messages

```
GET  /messages
     ?user_id=eq.{userId}
     &select=*,calls(*)
     &order=created_at.asc
     &limit=50
     &created_at=gt.{cursor}      ← optional pagination

POST /messages
     Body: { user_id, type, kind, text, created_at }
     Response: the inserted Message row
```

### Tasks

```
GET  /tasks
     ?user_id=eq.{userId}
     &select=*,subtasks(*)
     &order=due_order.asc,created_at.asc

POST /tasks
     Body: { user_id, title, goal, why, status, due, due_order, notes, reminder_at }

PATCH /tasks?id=eq.{taskId}
     Body: { status }  or any other fields
     Prefer: return=representation    ← returns updated row

DELETE /tasks?id=eq.{taskId}
```

### Subtasks

```
PATCH /subtasks?id=eq.{subtaskId}
     Body: { done: <boolean> }
     Prefer: return=representation
```

### User

```
GET   /users?id=eq.me&select=*
PATCH /users?id=eq.{userId}
     Body: { mindprint }
```

### Stats

```
GET /user_stats?user_id=eq.{userId}&select=*
```

---

## 7. Edge Functions

Complex operations that can't be done with simple REST calls are handled by Supabase Edge Functions.

### `toggle-subtask`

Atomically reads the current `done` state and flips it — avoids race conditions.

```
POST /functions/v1/toggle-subtask
Body:     { "task_id": "...", "subtask_id": "..." }
Response: { "task": Task }
```

### `complete-task`

Marks a task done and runs all side effects in one transaction:
- Sets `tasks.status = 'done'`
- Awards XP
- Updates streak
- Checks milestones
- Writes `agent_nudge` to `user_stats`

```
POST /functions/v1/complete-task
Body:     { "task_id": "..." }
Response: { "task": Task, "stats": Stats }
```

### `get-stats`

Alternative to querying `user_stats` directly — recomputes on demand.
Use this for the MVP until trigger-based stats are stable.

```
POST /functions/v1/get-stats
Body:     {}
Response: { "stats": Stats }
```

---

## 8. XP & Gamification Logic

Award XP whenever a task is completed. Run this logic inside the `complete-task` Edge Function or a Postgres trigger on `tasks`.

| Event                        | XP Award |
|------------------------------|----------|
| Task completed (overdue)     | +5 XP    |
| Task completed (on time)     | +20 XP   |
| Daily goal hit               | +50 XP bonus |
| 7-day streak milestone       | +100 XP bonus |

**Level thresholds** (define in a `levels` lookup table or hardcode):

| Level | Name              | XP Required |
|-------|-------------------|-------------|
| 1     | Getting Started   | 0           |
| 2     | Building Momentum | 200         |
| 3     | On a Roll         | 500         |
| 4     | Focus Champion    | 1000        |
| 5     | Flow State        | 1500        |
| 6     | Deep Worker       | 2500        |

**Streak logic:**
- Increment `streak` if at least one task was completed yesterday
- Reset `streak = 0` if no task was completed yesterday
- Run daily via pg_cron at midnight in the user's timezone

---

## 9. Real-Time Subscriptions

The frontend expects real-time updates for two events. Implement via Supabase Realtime.

### New messages (agent replies + call records)

```js
supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    // payload.new is the new Message row
    // For call messages, also fetch the linked calls row
  })
  .subscribe()
```

### Stats updated (after task completion)

```js
supabase
  .channel('stats')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'user_stats',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    // payload.new is the updated Stats row
  })
  .subscribe()
```

---

## 10. AI Calling Agent Integration

This is the core differentiator of OnlyPlans. The agent calls the user — not the reverse.

### Call Trigger

At `reminder_at` time for each task, a scheduled job (pg_cron) calls an Edge Function:

```
POST /functions/v1/trigger-call
Body: { "task_id": "...", "user_id": "..." }
```

This Edge Function:
1. Fetches the user's mindprint and the task details
2. Initiates an outbound call via **Vapi** or **Twilio** to `user.phone`
3. Passes the mindprint and task context to the AI (Claude) as a system prompt
4. Starts the structured call conversation (see §11)

### Vapi Integration (recommended)

Vapi handles outbound calls and transcription. Set up a Vapi assistant with:
- A dynamic system prompt injected per call (mindprint + task context)
- End-of-call webhook → `POST /functions/v1/process-call-result`

### Call Result Processing

When the call ends, the webhook fires:

```
POST /functions/v1/process-call-result
Body: {
  "call_id":     "vapi_call_xyz",
  "user_id":     "uuid",
  "task_id":     "uuid",
  "transcript":  "...",
  "user_status": "inprogress" | "notstarted" | "cantfinish",
  "duration":    "4 min 32 sec",
  "summary":     "...",       ← written by Claude from the transcript
  "follow_up":   "..."        ← action taken
}
```

This function then:
1. Inserts a row into `calls`
2. Inserts a linked `messages` row (`kind='call'`) — triggers real-time update to frontend
3. Updates `tasks.status` and `tasks.notes`
4. If `user_status = 'cantfinish'` → reschedule task (update `reminder_at`)
5. Writes a follow-up text to `messages` as an agent text message

---

## 11. Call Conversation Structure

The call follows a fixed 3-option flow. The AI system prompt must enforce this.

### System Prompt Context Variables

```
User name:              {{user.name}}
Task title:             {{task.title}}
Task why:               {{task.why}}
Accountability style:   {{mindprint.accountability_style}}
Motivation driver:      {{mindprint.motivation_driver}}
Tone:                   {{mindprint.tone}}
```

### Call Script

```
OPENING:
"Hey {{name}}, it's OnlyPlans. You set {{task.title}} as your priority.
 Let's check in — how's it going?"

STATUS OPTIONS (user picks one or agent infers):

  1. IN PROGRESS:
     "Nice — keep going. I'll check in again at [Time]."
     → action: schedule follow-up call, update task status to 'inprogress'

  2. NOT STARTED:
     "What's getting in the way? Want me to call back in 30 minutes to get you going?"
     → action: reschedule call for +30 min, keep status 'todo'

  3. COULDN'T FINISH:
     "No problem. Want to reschedule this, or break it into something smaller?"
     → action: reschedule task OR split into subtasks, keep as 'inprogress'

CLOSING:
"Do you want a second call later today to wrap this up?"
```

---

## 12. Onboarding Flow

Onboarding is delivered as a voice call. The frontend has not yet implemented the onboarding screens — this is a future build.

### What the onboarding call collects

All 7 fields of the user's mindprint (see §5 users table). The call is guided by the AI using `onboarding-prompt.md` in the repository.

### First Task Card

At the end of onboarding, the agent creates the user's first task. The backend must:
1. Insert a row into `tasks` with the confirmed task details
2. Set `reminder_at` to the agreed check-in time
3. Set `tasks.why` to the personal reason captured during the call
4. Mark `users.mindprint` as complete

### Onboarding endpoint (future)

```
POST /functions/v1/complete-onboarding
Body: {
  "user_id":  "uuid",
  "mindprint": { ... },
  "first_task": {
    "title":       "...",
    "goal":        "...",
    "why":         "...",
    "due":         "Today",
    "due_order":   1,
    "reminder_at": "2026-03-21T08:45:00Z",
    "subtasks":    [{ "text": "...", "position": 0 }]
  }
}
```

---

## 13. Frontend ↔ Backend Integration Points Summary

| Frontend action              | Service function         | Real API call                                         |
|------------------------------|--------------------------|-------------------------------------------------------|
| Load chat history            | `getMessages()`          | `GET /rest/v1/messages?select=*,calls(*)`             |
| Send text message            | `sendMessage(text)`      | `POST /rest/v1/messages`                              |
| Receive agent reply          | `subscribeToMessages()`  | Supabase Realtime — messages INSERT                   |
| Load task list               | `getTasks()`             | `GET /rest/v1/tasks?select=*,subtasks(*)`             |
| Toggle subtask               | `toggleSubtask()`        | `POST /functions/v1/toggle-subtask`                   |
| Mark task complete           | `updateTask(id, {done})` | `POST /functions/v1/complete-task`                    |
| Load gamification stats      | `getStats()`             | `GET /rest/v1/user_stats`                             |
| Stats update after task done | `subscribeToMessages()`  | Supabase Realtime — user_stats UPDATE                 |
| Send voice transcript        | `sendMessage(text)`      | `POST /rest/v1/messages` (same as text)               |
| Load user profile            | `getCurrentUser()`       | `GET /rest/v1/users?select=*`                         |
| Save mindprint               | `updateMindprint()`      | `PATCH /rest/v1/users`                                |

---

## 14. Switching from Mock to Real Backend

1. Set `VITE_USE_MOCK=false` in your `.env`
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Each service function in `src/api/services/` will automatically use `apiFetch()` instead of the mock
4. The mock database (`src/api/mock/db.js`) can be deleted once the real backend is stable

**No frontend component code needs to change** — the components only call service functions and are unaware of whether mock or real data is being returned.

---

## 15. File Reference

```
src/
  api/
    config.js                 ← USE_MOCK flag + env vars
    client.js                 ← apiFetch() wrapper with auth headers
    mock/
      db.js                   ← in-memory mock database + mutation helpers
    services/
      messages.js             ← getMessages, sendMessage, subscribeToMessages
      tasks.js                ← getTasks, updateTask, toggleSubtask
      stats.js                ← getStats
      user.js                 ← getCurrentUser, updateMindprint
  screens/
    ChatScreen.jsx            ← uses messages service
    TasksScreen.jsx           ← uses tasks service
    GamificationScreen.jsx    ← uses stats service
  components/
    VoiceButton.jsx           ← uses messages service (sendMessage)
```
