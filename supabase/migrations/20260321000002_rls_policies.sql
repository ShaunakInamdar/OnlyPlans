-- =============================================================================
-- Migration 002: Row Level Security
-- OnlyPlans — AI accountability partner app
--
-- Every table that contains user data is locked to auth.uid().
-- The service_role key (used by Edge Functions) bypasses RLS by default.
-- The anon key (used by the frontend) is subject to all policies below.
-- =============================================================================

-- ─── Enable RLS on all user-data tables ──────────────────────────────────────
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats  ENABLE ROW LEVEL SECURITY;

-- levels is a read-only lookup table; allow all authenticated reads
ALTER TABLE public.levels      ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- USERS
-- Users can only read and update their own row.
-- INSERT is handled by the handle_new_user trigger (runs as security definer).
-- =============================================================================
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- =============================================================================
-- TASKS
-- Full CRUD on own rows only.
-- =============================================================================
CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- SUBTASKS
-- Access is derived from the parent task's ownership.
-- Uses EXISTS subquery — relies on idx_subtasks_task_id for performance.
-- =============================================================================
CREATE POLICY "subtasks_select_own" ON public.subtasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = subtasks.task_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "subtasks_insert_own" ON public.subtasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = subtasks.task_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "subtasks_update_own" ON public.subtasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = subtasks.task_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "subtasks_delete_own" ON public.subtasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = subtasks.task_id AND t.user_id = auth.uid()
    )
  );

-- =============================================================================
-- MESSAGES
-- Users can read all their messages and insert their own (type='user').
-- Agent messages (type='agent') and call records (type='call') are inserted
-- by Edge Functions using the service_role key, which bypasses RLS.
-- =============================================================================
CREATE POLICY "messages_select_own" ON public.messages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "messages_insert_user" ON public.messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND type = 'user'
    AND kind = 'text'
  );

-- =============================================================================
-- CALLS
-- Read-only for the frontend. All inserts come from Edge Functions (service_role).
-- =============================================================================
CREATE POLICY "calls_select_own" ON public.calls
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- USER_STATS
-- Read-only for the frontend. All updates come from database triggers
-- (which run as security definer) or Edge Functions (service_role).
-- =============================================================================
CREATE POLICY "stats_select_own" ON public.user_stats
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- LEVELS
-- Public read — no user-specific data here.
-- =============================================================================
CREATE POLICY "levels_select_all" ON public.levels
  FOR SELECT USING (true);
