# OnlyPlans — Backend Agent Specification

> **Purpose:** This document is the single source of truth for any backend agent or developer
> implementing the OnlyPlans backend. It describes every data model, API endpoint, and
> Claude integration point that the frontend (`index_v6_en.html`) expects.
>
> **Stack:** Supabase (PostgreSQL + Auth + Realtime) · Anthropic Claude API · Node.js (Edge Functions)

---

## 1. Architecture Overview

```
Browser (Frontend)
      │
      │  HTTPS REST / Supabase JS Client
      ▼
┌─────────────────────────────────────┐
│           Supabase                  │
│  ┌─────────┐  ┌──────────────────┐  │
│  │  Auth   │  │  PostgreSQL DB   │  │
│  └─────────┘  └──────────────────┘  │
│  ┌──────────────────────────────┐   │
│  │  Edge Functions (Deno/Node)  │   │
│  │  - AI call scheduling        │   │
│  │  - Task breakdown via Claude │   │
│  │  - Personalization engine    │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
      │
      │  Anthropic SDK
      ▼
┌─────────────────┐
│  Claude API     │
│  (claude-sonnet)|
└─────────────────┘
      │
      │  Telephony API (e.g. Twilio / Vapi)
      ▼
┌─────────────────┐
│  Phone Calls    │
└─────────────────┘
```

---

## 2. Supabase Database Schema

### 2.1 `waitlist_entries`
Stores email signups from the landing page waitlist form.

```sql
CREATE TABLE waitlist_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  source      TEXT DEFAULT 'landing_page',   -- e.g. 'landing_page', 'referral'
  created_at  TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ                    -- set when launch email is sent
);
```

**RLS Policy:** Insert allowed for anonymous users. Select/Update only for `service_role`.

---

### 2.2 `profiles`
Extended user data beyond Supabase Auth. Created automatically on user signup via trigger.

```sql
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT,
  motivation_profile  JSONB,   -- output of Claude onboarding interview
  adhd_mode           BOOLEAN DEFAULT false,
  plan                TEXT DEFAULT 'free',   -- 'free' | 'pro' | 'max'
  onboarding_done     BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

**`motivation_profile` shape (Claude output):**
```json
{
  "primary_motivator": "achievement | social | autonomy | purpose",
  "focus_style": "deep_work | pomodoro | sprints",
  "accountability_preference": "gentle | firm | strict",
  "distraction_triggers": ["social_media", "email"],
  "best_work_hours": "morning | afternoon | evening"
}
```

---

### 2.3 `tasks`
All user tasks. Supports parent/child hierarchy for task breakdown.

```sql
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,  -- null = top-level task
  title         TEXT NOT NULL,
  description   TEXT,
  priority      SMALLINT DEFAULT 2,   -- 1=low, 2=medium, 3=high
  status        TEXT DEFAULT 'todo',  -- 'todo' | 'in_progress' | 'done' | 'skipped'
  due_date      DATE,
  scheduled_at  TIMESTAMPTZ,          -- placed in calendar
  completed_at  TIMESTAMPTZ,
  reward_points SMALLINT DEFAULT 0,   -- awarded on completion
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policy:** Users can only read/write their own tasks (`user_id = auth.uid()`).

---

### 2.4 `calls`
Scheduled and completed AI accountability phone calls.

```sql
CREATE TABLE calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  status          TEXT DEFAULT 'scheduled',  -- 'scheduled' | 'in_progress' | 'completed' | 'missed'
  transcript      TEXT,                      -- full call transcript
  summary         TEXT,                      -- Claude-generated summary
  tasks_discussed UUID[],                    -- task IDs mentioned in call
  outcome         TEXT,                      -- 'on_track' | 'off_track' | 'recovered'
  telephony_sid   TEXT,                      -- Twilio/Vapi call SID
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

### 2.5 `rewards`
Points and badges earned by completing tasks.

```sql
CREATE TABLE rewards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- 'points' | 'badge' | 'streak'
  value       INTEGER DEFAULT 0,
  label       TEXT,            -- e.g. 'First Task Done', '7-Day Streak'
  earned_at   TIMESTAMPTZ DEFAULT now()
);
```

---

### 2.6 `calendar_connections`
OAuth tokens for connected calendar providers.

```sql
CREATE TABLE calendar_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,   -- 'google' | 'apple' | 'outlook'
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. API Endpoints

All endpoints are implemented as **Supabase Edge Functions** (Deno/Node).
Base URL: `https://<project-ref>.supabase.co/functions/v1/`

Authentication: `Authorization: Bearer <supabase_jwt>` for protected routes.

---

### 3.1 Waitlist

#### `POST /waitlist/join`
Adds an email to the waitlist. Called on landing page form submit.

**Request:**
```json
{ "email": "user@example.com", "source": "landing_page" }
```

**Response 200:**
```json
{ "success": true, "id": "uuid" }
```

**Response 409** (already registered):
```json
{ "success": false, "error": "already_registered" }
```

**Supabase table write:** `waitlist_entries` — INSERT

---

### 3.2 Auth

Uses Supabase Auth directly from the client SDK. No custom edge function needed.

| Action   | Method                                  |
|----------|-----------------------------------------|
| Sign Up  | `supabase.auth.signUp({ email, password })` |
| Sign In  | `supabase.auth.signInWithPassword(...)` |
| Sign Out | `supabase.auth.signOut()`               |
| Get User | `supabase.auth.getUser()`               |

On signup, a Supabase **Database Trigger** automatically creates a `profiles` row.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

### 3.3 User Profile

#### `GET /profile`
Returns the profile of the authenticated user.

**Response 200:**
```json
{
  "id": "uuid",
  "display_name": "Ramona",
  "plan": "pro",
  "onboarding_done": true,
  "motivation_profile": { ... },
  "adhd_mode": false
}
```

**Supabase table read:** `profiles` WHERE `id = auth.uid()`

---

#### `PATCH /profile`
Updates profile fields.

**Request:**
```json
{ "display_name": "Ramona", "adhd_mode": true }
```

**Supabase table write:** `profiles` — UPDATE WHERE `id = auth.uid()`

---

### 3.4 Onboarding (Claude)

#### `POST /onboarding/analyze`
Receives answers from the onboarding interview and returns a `motivation_profile` generated by Claude.

**Request:**
```json
{
  "answers": [
    { "question": "What motivates you most?", "answer": "Finishing things" },
    { "question": "When do you work best?", "answer": "Early morning" }
  ]
}
```

**Claude call (inside Edge Function):**
```javascript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 500,
  system: `You are an expert productivity coach. Analyze the user's onboarding answers
           and return a structured motivation_profile JSON object.`,
  messages: [{ role: 'user', content: JSON.stringify(answers) }]
});
```

**Response 200:**
```json
{
  "motivation_profile": {
    "primary_motivator": "achievement",
    "focus_style": "deep_work",
    "accountability_preference": "firm",
    "distraction_triggers": ["social_media"],
    "best_work_hours": "morning"
  }
}
```

After success, frontend calls `PATCH /profile` to persist the profile.

---

### 3.5 Tasks

#### `GET /tasks`
Returns all tasks for the authenticated user, ordered by priority and due date.

**Query params:** `?status=todo&limit=20&offset=0`

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Finish project proposal",
    "priority": 3,
    "status": "todo",
    "due_date": "2025-03-25",
    "scheduled_at": "2025-03-22T09:00:00Z",
    "reward_points": 50,
    "children": []
  }
]
```

**Supabase table read:** `tasks` WHERE `user_id = auth.uid()`

---

#### `POST /tasks`
Creates a new task.

**Request:**
```json
{
  "title": "Launch OnlyPlans MVP",
  "description": "Ship the first version",
  "priority": 3,
  "due_date": "2025-04-01"
}
```

**Response 201:**
```json
{ "id": "uuid", "title": "Launch OnlyPlans MVP", ... }
```

---

#### `POST /tasks/:id/breakdown`
Uses Claude to break a task into smaller subtasks. Saves subtasks to DB automatically.

**Claude call (inside Edge Function):**
```javascript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1000,
  system: `You are a productivity assistant. Break the given task into 3-5 concrete,
           actionable subtasks. Return a JSON array of subtask objects with title,
           estimated_minutes, and priority (1-3).`,
  messages: [{ role: 'user', content: `Task: "${task.title}"\nDescription: "${task.description}"` }]
});
```

**Response 201:**
```json
{
  "parent_id": "uuid",
  "subtasks": [
    { "id": "uuid", "title": "Draft outline", "priority": 2, "estimated_minutes": 30 },
    { "id": "uuid", "title": "Write section 1", "priority": 2, "estimated_minutes": 60 }
  ]
}
```

---

#### `PATCH /tasks/:id`
Updates task fields (status, priority, due_date, etc.).

**Request:**
```json
{ "status": "done", "completed_at": "2025-03-21T14:00:00Z" }
```

On status → `done`: Edge Function automatically calculates and inserts `rewards` row.

---

#### `DELETE /tasks/:id`
Soft-deletes a task (sets `status = 'skipped'`). Hard delete available for `service_role` only.

---

### 3.6 Calls

#### `GET /calls`
Returns call history for the user.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "scheduled_at": "2025-03-21T10:00:00Z",
    "status": "completed",
    "summary": "User was on track. Discussed 3 tasks. Agreed to finish proposal by EOD.",
    "outcome": "on_track"
  }
]
```

---

#### `POST /calls/schedule`
Schedules a new AI accountability call.

**Request:**
```json
{ "scheduled_at": "2025-03-22T09:00:00Z" }
```

**What happens in the Edge Function:**
1. Insert into `calls` table
2. Register the call with the telephony provider (Twilio/Vapi) at the given time
3. Return the created call object

**Response 201:**
```json
{ "id": "uuid", "scheduled_at": "2025-03-22T09:00:00Z", "status": "scheduled" }
```

---

#### `POST /calls/:id/summary`
Called by the telephony webhook after a call ends. Sends transcript to Claude for summarization.

**Claude call (inside Edge Function):**
```javascript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 300,
  system: `Summarize this accountability call transcript in 2-3 sentences.
           Identify the outcome: on_track, off_track, or recovered.`,
  messages: [{ role: 'user', content: transcript }]
});
```

Updates `calls` row with `summary`, `outcome`, and `ended_at`.

---

### 3.7 Calendar

#### `POST /calendar/connect`
Initiates OAuth flow for a calendar provider.

**Request:**
```json
{ "provider": "google" }
```

**Response 200:**
```json
{ "auth_url": "https://accounts.google.com/o/oauth2/auth?..." }
```

---

#### `POST /calendar/sync`
Pushes all scheduled tasks into the connected calendar.

**What happens:**
1. Fetch all tasks WHERE `scheduled_at IS NOT NULL` for the user
2. For each task, create/update a calendar event via the provider API
3. Return sync summary

**Response 200:**
```json
{ "synced": 12, "errors": 0 }
```

---

### 3.8 Rewards

#### `GET /rewards`
Returns total points and earned badges for the user.

**Response 200:**
```json
{
  "total_points": 340,
  "badges": [
    { "label": "First Task Done", "earned_at": "2025-03-10T..." },
    { "label": "7-Day Streak", "earned_at": "2025-03-17T..." }
  ]
}
```

---

### 3.9 Pricing / Subscriptions

#### `GET /pricing`
Returns available pricing plans (used to populate pricing section dynamically).

**Response 200:**
```json
[
  {
    "id": "free",
    "name": "Free",
    "price_usd": 0,
    "features": { "tasks_per_day": 3, "calls_per_day": 1, "calendar_sync": false, "rewards": false, "custom_motivation": false }
  },
  {
    "id": "pro",
    "name": "Pro",
    "price_usd": 9.99,
    "features": { "tasks_per_day": -1, "calls_per_day": 5, "calendar_sync": true, "rewards": true, "custom_motivation": false }
  },
  {
    "id": "max",
    "name": "Max",
    "price_usd": 19.99,
    "features": { "tasks_per_day": -1, "calls_per_day": -1, "calendar_sync": true, "rewards": true, "custom_motivation": true }
  }
]
```

---

#### `POST /subscriptions`
Creates or updates a subscription (integrates with Stripe).

**Request:**
```json
{ "plan_id": "pro", "stripe_payment_method_id": "pm_xxx" }
```

**Response 200:**
```json
{ "success": true, "plan": "pro", "next_billing_date": "2025-04-21" }
```

---

## 4. Claude Integration Points Summary

| Feature               | Trigger                        | Model              | Purpose                                      |
|-----------------------|--------------------------------|--------------------|----------------------------------------------|
| Onboarding analysis   | User completes onboarding form | claude-sonnet-4-6  | Generate `motivation_profile` JSON            |
| Task breakdown        | User clicks "Break down task"  | claude-sonnet-4-6  | Split task into 3-5 actionable subtasks       |
| Call conversation     | Telephony provider (real-time) | claude-sonnet-4-6  | Drive the accountability call dialogue        |
| Call summarization    | After call ends (webhook)      | claude-sonnet-4-6  | Summarize transcript, detect outcome          |
| Daily briefing        | Cron job (morning)             | claude-sonnet-4-6  | Generate personalized daily task priorities   |

---

## 5. Environment Variables (Supabase Edge Functions)

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ANTHROPIC_API_KEY=sk-ant-...
TWILIO_ACCOUNT_SID=AC...          # or VAPI_API_KEY
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 6. Frontend ↔ Backend Contract (MockAPI)

The frontend uses a `MockAPI` object (see `index_v6_en.html`) that mirrors every endpoint
above. Each method is clearly commented with:

- Which Supabase table is read/written
- Which endpoint is called
- The exact request/response shape expected

When connecting to the real backend, replace `MockAPI.BASE_URL = null` with
`MockAPI.BASE_URL = process.env.SUPABASE_URL` and swap each mock return for the
real `fetch()` or Supabase JS client call.

---

## 7. Supabase Row Level Security (RLS) Summary

| Table                  | Anonymous | Authenticated User | Service Role |
|------------------------|-----------|--------------------|--------------|
| `waitlist_entries`     | INSERT    | —                  | ALL          |
| `profiles`             | —         | SELECT/UPDATE own  | ALL          |
| `tasks`                | —         | ALL own rows       | ALL          |
| `calls`                | —         | SELECT own         | ALL          |
| `rewards`              | —         | SELECT own         | ALL          |
| `calendar_connections` | —         | ALL own rows       | ALL          |

---

## 8. Webhooks

| Event                    | Sender              | Endpoint                       | Action                            |
|--------------------------|---------------------|--------------------------------|-----------------------------------|
| Call ended               | Twilio/Vapi         | `POST /calls/:id/summary`      | Save transcript, run Claude       |
| Payment succeeded        | Stripe              | `POST /webhooks/stripe`        | Update `profiles.plan`            |
| Payment failed           | Stripe              | `POST /webhooks/stripe`        | Downgrade plan, notify user       |

---

*Last updated: 2026-03-21 — Generated alongside `index_v6_en.html`*
