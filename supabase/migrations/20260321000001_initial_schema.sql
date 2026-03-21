-- =============================================================================
-- Migration 001: Initial Schema
-- OnlyPlans — AI accountability partner app
--
-- Tables: users, levels, tasks, subtasks, messages, calls, user_stats
-- =============================================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =============================================================================
-- USERS
-- One row per authenticated user. Created on signup via trigger (see 003).
-- mindprint is null until the onboarding voice call is complete.
-- =============================================================================
CREATE TABLE public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  email       TEXT        UNIQUE,
  phone       TEXT        UNIQUE NOT NULL,  -- E.164 format e.g. '+49151...'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  mindprint   JSONB       -- null until onboarding complete; see shape below
  --
  -- mindprint JSONB shape:
  -- {
  --   "peak_hours":            "8am–11am",
  --   "blocked_hours":         ["12pm–1pm", "after 8pm"],
  --   "work_style":            "flexible" | "structured",
  --   "accountability_style":  "direct" | "gentle",
  --   "motivation_driver":     "rewards" | "consequences" | "progress",
  --   "check_in_frequency":    "once_daily" | "twice_daily" | "hourly",
  --   "fallback_on_no_answer": "text_after_30min" | "retry" | "wait",
  --   "tone":                  "straight_no_fluff"    -- free-form
  -- }
);

-- =============================================================================
-- LEVELS
-- Lookup table for XP thresholds. Read-only — no user writes.
-- Frontend uses level, level_name, next_level_points from user_stats (denorm).
-- =============================================================================
CREATE TABLE public.levels (
  level        INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL,
  xp_required  INTEGER NOT NULL
);

INSERT INTO public.levels (level, name, xp_required) VALUES
  (1, 'Getting Started',   0),
  (2, 'Building Momentum', 200),
  (3, 'On a Roll',         500),
  (4, 'Focus Champion',    1000),
  (5, 'Flow State',        1500),
  (6, 'Deep Worker',       2500);

-- =============================================================================
-- TASKS
-- One row per task. Contains both a human-readable label (due, due_order) for
-- the frontend and an actual date (due_date) for server-side recalculation.
-- =============================================================================
CREATE TABLE public.tasks (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  goal        TEXT    NOT NULL,    -- parent goal/category name e.g. 'Project Proposal'
  why         TEXT,                -- personal motivation captured during onboarding call
  status      TEXT    NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo', 'inprogress', 'done')),
  due         TEXT,                -- human label shown in UI: 'Today', 'Tomorrow', etc.
  due_date    DATE,                -- actual date used for due_order recalculation
  due_order   INTEGER NOT NULL DEFAULT 3
                CHECK (due_order BETWEEN 0 AND 3),
  --   0 = overdue (due_date < today)
  --   1 = today   (due_date = today)
  --   2 = tomorrow
  --   3 = later / no date
  notes       TEXT,                -- agent's note, updated after each call
  reminder_at TIMESTAMPTZ,         -- when the agent will next call / remind
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- SUBTASKS
-- Child rows of tasks. Cascade-deleted with the parent task.
-- Ordered by position for display.
-- =============================================================================
CREATE TABLE public.subtasks (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id  UUID    NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  text     TEXT    NOT NULL,
  done     BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0   -- display order, 0-indexed
);

-- =============================================================================
-- MESSAGES
-- All chat history: user text, agent text, and call record cards.
-- type 'call' + kind 'call' = a call card (metadata lives in the calls table).
-- =============================================================================
CREATE TABLE public.messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('user', 'agent', 'call')),
  kind       TEXT        NOT NULL CHECK (kind IN ('text', 'call')),
  text       TEXT,                -- populated for kind = 'text'; null for kind = 'call'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- CALLS
-- Metadata for completed AI accountability calls.
-- Linked back to the messages table via message_id (the call card in the chat).
-- task_title is denormalised from tasks.title so the frontend gets it in one join.
--
-- Insert flow (from process-call-result Edge Function):
--   1. INSERT INTO calls (...)
--   2. INSERT INTO messages (kind='call', message_id = calls.id)  ← triggers realtime
--   3. UPDATE tasks SET status = ..., notes = ...
--   4. XP trigger fires automatically
-- =============================================================================
CREATE TABLE public.calls (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_id  UUID        REFERENCES public.messages(id) ON DELETE SET NULL,
  task_id     UUID        REFERENCES public.tasks(id)    ON DELETE SET NULL,
  task_title  TEXT,       -- denormalised copy of tasks.title at call time
  started_at  TIMESTAMPTZ NOT NULL,
  duration    TEXT,       -- human-readable e.g. '4 min 32 sec'
  user_status TEXT
                CHECK (user_status IN ('inprogress', 'notstarted', 'cantfinish')),
  summary     TEXT,       -- written by AI after call
  follow_up   TEXT        -- action taken post-call e.g. 'Rescheduled for 9 AM'
);

-- =============================================================================
-- USER_STATS
-- Gamification state per user. Kept in sync by database triggers (see 003).
-- One row inserted automatically when a user is created.
--
-- milestones JSONB shape:
--   [{"id":"ms_1","label":"1st task done","unlocked":false}, ...]
--
-- week_days JSONB shape:
--   [{"day":"Mon","done":4,"total":5}, {"day":"Tue","done":3,"total":4}, ...]
-- =============================================================================
CREATE TABLE public.user_stats (
  user_id           UUID        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  streak            INTEGER     NOT NULL DEFAULT 0,
  points            INTEGER     NOT NULL DEFAULT 0,
  level             INTEGER     NOT NULL DEFAULT 1,
  level_name        TEXT        NOT NULL DEFAULT 'Getting Started',
  next_level_points INTEGER     NOT NULL DEFAULT 200,
  weekly_goal       INTEGER     NOT NULL DEFAULT 5,
  weekly_done       INTEGER     NOT NULL DEFAULT 0,
  completed_total   INTEGER     NOT NULL DEFAULT 0,
  milestones        JSONB       NOT NULL DEFAULT '[
    {"id":"ms_1","label":"1st task done","unlocked":false},
    {"id":"ms_2","label":"3-day streak","unlocked":false},
    {"id":"ms_3","label":"10 tasks done","unlocked":false},
    {"id":"ms_4","label":"7-day streak","unlocked":false},
    {"id":"ms_5","label":"50 tasks done","unlocked":false}
  ]'::jsonb,
  week_days         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  agent_nudge       TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- tasks: most common query patterns
CREATE INDEX idx_tasks_user_id       ON public.tasks(user_id);
CREATE INDEX idx_tasks_due_order     ON public.tasks(due_order);
CREATE INDEX idx_tasks_status        ON public.tasks(status);
CREATE INDEX idx_tasks_reminder_at   ON public.tasks(reminder_at)
  WHERE reminder_at IS NOT NULL;                           -- sparse index

-- subtasks: always joined from tasks
CREATE INDEX idx_subtasks_task_id    ON public.subtasks(task_id);
CREATE INDEX idx_subtasks_position   ON public.subtasks(task_id, position);

-- messages: primary query is user_id + created_at (pagination)
CREATE INDEX idx_messages_user_id    ON public.messages(user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_messages_user_time  ON public.messages(user_id, created_at);

-- calls: joined from messages
CREATE INDEX idx_calls_user_id       ON public.calls(user_id);
CREATE INDEX idx_calls_message_id    ON public.calls(message_id);
CREATE INDEX idx_calls_task_id       ON public.calls(task_id)
  WHERE task_id IS NOT NULL;
