-- =============================================================================
-- Migration 003: Functions and Triggers
-- OnlyPlans — AI accountability partner app
--
-- Contents:
--   1. handle_new_user          — creates users + user_stats row on auth signup
--   2. award_xp                 — awards XP and updates level/milestones/week_days
--   3. handle_task_completion   — trigger: fires when tasks.status → 'done'
--   4. update_due_orders        — recalculates due/due_order from due_date (pg_cron)
--   5. update_streak            — updates streak daily at midnight (pg_cron)
--   6. rebuild_week_days        — rebuilds week_days JSONB for current week
-- =============================================================================


-- =============================================================================
-- 1. HANDLE NEW USER
-- Runs after a new row is inserted into auth.users (Supabase signup).
-- Creates the matching public.users row and a blank user_stats row.
--
-- The frontend sends: { phone, name } in user_metadata when signing up.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create public user profile
  INSERT INTO public.users (id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '')
  );

  -- Create empty stats row
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- 2. COMPUTE LEVEL
-- Pure function — given a points value, returns (level, name, next_level_points).
-- Used inside award_xp to keep level in sync.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.compute_level(p_points INTEGER)
RETURNS TABLE(level INTEGER, level_name TEXT, next_level_points INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT
    l.level,
    l.name,
    COALESCE(
      (SELECT xp_required FROM public.levels WHERE level = l.level + 1),
      l.xp_required  -- already at max level — use same threshold
    ) AS next_level_points
  FROM public.levels l
  WHERE l.xp_required <= p_points
  ORDER BY l.xp_required DESC
  LIMIT 1;
$$;


-- =============================================================================
-- 3. CHECK MILESTONES
-- Returns the milestones JSONB array with any newly-unlocked entries updated.
-- Called inside award_xp after stats are updated.
--
-- Milestone unlock conditions:
--   ms_1: completed_total >= 1
--   ms_2: streak >= 3
--   ms_3: completed_total >= 10
--   ms_4: streak >= 7
--   ms_5: completed_total >= 50
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_milestones(
  p_milestones    JSONB,
  p_completed     INTEGER,
  p_streak        INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(
    CASE
      WHEN (m->>'id') = 'ms_1' AND p_completed >= 1   THEN jsonb_set(m, '{unlocked}', 'true')
      WHEN (m->>'id') = 'ms_2' AND p_streak   >= 3    THEN jsonb_set(m, '{unlocked}', 'true')
      WHEN (m->>'id') = 'ms_3' AND p_completed >= 10  THEN jsonb_set(m, '{unlocked}', 'true')
      WHEN (m->>'id') = 'ms_4' AND p_streak   >= 7    THEN jsonb_set(m, '{unlocked}', 'true')
      WHEN (m->>'id') = 'ms_5' AND p_completed >= 50  THEN jsonb_set(m, '{unlocked}', 'true')
      ELSE m
    END
  )
  INTO result
  FROM jsonb_array_elements(p_milestones) AS m;

  RETURN COALESCE(result, p_milestones);
END;
$$;


-- =============================================================================
-- 4. REBUILD WEEK_DAYS
-- Recomputes the week_days JSONB for the current Monday–Sunday week for a user.
-- Returns an array of 7 objects: [{day, done, total}, ...]
-- Called inside handle_task_completion and by the daily cron job.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rebuild_week_days(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH
  week_start AS (
    SELECT date_trunc('week', now())::DATE AS monday
  ),
  days AS (
    SELECT
      (monday + i)            AS day_date,
      to_char(monday + i, 'Dy') AS day_label   -- 'Mon', 'Tue', etc.
    FROM week_start, generate_series(0, 6) AS i
  ),
  task_counts AS (
    SELECT
      due_date,
      COUNT(*) FILTER (WHERE status = 'done') AS done_count,
      COUNT(*)                                 AS total_count
    FROM public.tasks
    WHERE user_id = p_user_id
      AND due_date >= (SELECT monday FROM week_start)
      AND due_date <  (SELECT monday FROM week_start) + 7
    GROUP BY due_date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'day',   d.day_label,
      'done',  COALESCE(tc.done_count,  0),
      'total', COALESCE(tc.total_count, 0)
    )
    ORDER BY d.day_date
  )
  FROM days d
  LEFT JOIN task_counts tc ON tc.due_date = d.day_date;
$$;


-- =============================================================================
-- 5. AWARD XP
-- Awards XP and runs all side-effects atomically:
--   - Increments points + completed_total
--   - Updates level, level_name, next_level_points
--   - Unlocks milestones
--   - Rebuilds week_days
--   - Awards daily goal bonus if this task hits the daily target
--
-- Called by the handle_task_completion trigger.
--
-- XP scale:
--   due_order = 0 (overdue task completed):  +5 XP
--   due_order = 1/2/3 (on time):            +20 XP
--   Daily goal bonus (≥ weekly_goal done today): +50 XP
--   7-day streak bonus (hit exactly 7):     +100 XP
-- =============================================================================
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id  UUID,
  p_due_order INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp_earned       INTEGER;
  v_daily_bonus      INTEGER := 0;
  v_streak_bonus     INTEGER := 0;
  v_new_points       INTEGER;
  v_new_total        INTEGER;
  v_new_streak       INTEGER;
  v_lvl              INTEGER;
  v_lvl_name         TEXT;
  v_next_lvl_pts     INTEGER;
  v_milestones       JSONB;
  v_week_days        JSONB;
  v_weekly_goal      INTEGER;
  v_tasks_done_today INTEGER;
BEGIN
  -- Base XP
  v_xp_earned := CASE WHEN p_due_order = 0 THEN 5 ELSE 20 END;

  -- Load current stats
  SELECT points, completed_total, streak, milestones, weekly_goal
  INTO v_new_points, v_new_total, v_new_streak, v_milestones, v_weekly_goal
  FROM public.user_stats
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Increment totals
  v_new_points := v_new_points + v_xp_earned;
  v_new_total  := v_new_total  + 1;

  -- Check if daily goal is hit (after this completion)
  SELECT COUNT(*) INTO v_tasks_done_today
  FROM public.tasks
  WHERE user_id = p_user_id
    AND status   = 'done'
    AND due_date = CURRENT_DATE;

  IF v_tasks_done_today >= v_weekly_goal THEN
    v_daily_bonus   := 50;
    v_new_points    := v_new_points + v_daily_bonus;
  END IF;

  -- 7-day streak bonus
  IF v_new_streak = 7 THEN
    v_streak_bonus := 100;
    v_new_points   := v_new_points + v_streak_bonus;
  END IF;

  -- Compute new level
  SELECT l.level, l.level_name, l.next_level_points
  INTO v_lvl, v_lvl_name, v_next_lvl_pts
  FROM public.compute_level(v_new_points) l;

  -- Update milestones
  v_milestones := public.check_milestones(v_milestones, v_new_total, v_new_streak);

  -- Rebuild week_days
  v_week_days := public.rebuild_week_days(p_user_id);

  -- Persist
  UPDATE public.user_stats SET
    points            = v_new_points,
    completed_total   = v_new_total,
    level             = v_lvl,
    level_name        = v_lvl_name,
    next_level_points = v_next_lvl_pts,
    milestones        = v_milestones,
    week_days         = v_week_days,
    updated_at        = now()
  WHERE user_id = p_user_id;
END;
$$;


-- =============================================================================
-- 6. HANDLE TASK COMPLETION TRIGGER
-- Fires AFTER UPDATE on tasks when status changes to 'done'.
-- Awards XP and triggers a Realtime event on user_stats.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only run when transitioning TO 'done'
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    PERFORM public.award_xp(NEW.user_id, NEW.due_order);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_completed
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  WHEN (NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done')
  EXECUTE FUNCTION public.handle_task_completion();


-- =============================================================================
-- 7. UPDATE DUE ORDERS
-- Recalculates due and due_order for all incomplete tasks based on due_date.
-- Run daily by pg_cron at midnight UTC.
--
-- due_order values:
--   0 = overdue   (due_date < today)
--   1 = today     (due_date = today)
--   2 = tomorrow  (due_date = today + 1)
--   3 = later / no due_date
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_due_orders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tasks SET
    due_order = CASE
      WHEN due_date IS NULL                       THEN 3
      WHEN due_date < CURRENT_DATE                THEN 0
      WHEN due_date = CURRENT_DATE                THEN 1
      WHEN due_date = CURRENT_DATE + INTERVAL '1 day' THEN 2
      ELSE 3
    END,
    due = CASE
      WHEN due_date IS NULL                       THEN due  -- keep existing label
      WHEN due_date < CURRENT_DATE                THEN 'Overdue'
      WHEN due_date = CURRENT_DATE                THEN 'Today'
      WHEN due_date = CURRENT_DATE + INTERVAL '1 day' THEN 'Tomorrow'
      ELSE to_char(due_date, 'Mon DD')
    END
  WHERE status <> 'done';
END;
$$;

-- Schedule daily at midnight UTC
SELECT cron.schedule(
  'update-due-orders',    -- job name
  '0 0 * * *',            -- every day at 00:00 UTC
  $$SELECT public.update_due_orders();$$
);


-- =============================================================================
-- 8. UPDATE STREAK
-- Increments streak if the user completed at least one task yesterday.
-- Resets streak to 0 if they completed none.
-- Run daily at 00:05 UTC (after due orders update).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_streaks()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT user_id FROM public.user_stats
  LOOP
    -- Check if user completed any task yesterday
    IF EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = v_user.user_id
        AND status   = 'done'
        AND due_date = CURRENT_DATE - INTERVAL '1 day'
    ) THEN
      UPDATE public.user_stats SET
        streak     = streak + 1,
        updated_at = now()
      WHERE user_id = v_user.user_id;
    ELSE
      UPDATE public.user_stats SET
        streak     = 0,
        updated_at = now()
      WHERE user_id = v_user.user_id;
    END IF;
  END LOOP;
END;
$$;

-- Schedule daily at 00:05 UTC (5 minutes after due_order update)
SELECT cron.schedule(
  'update-streaks',
  '5 0 * * *',
  $$SELECT public.update_streaks();$$
);


-- =============================================================================
-- 9. ALSO TRIGGER: set due_order on INSERT/UPDATE of tasks.due_date
-- Keeps due_order in sync whenever the agent sets/changes a task's due_date
-- without waiting for the nightly cron job.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_due_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.due_date IS NULL THEN
    NEW.due_order := 3;
  ELSIF NEW.due_date < CURRENT_DATE THEN
    NEW.due_order := 0;
    NEW.due := 'Overdue';
  ELSIF NEW.due_date = CURRENT_DATE THEN
    NEW.due_order := 1;
    -- Preserve custom labels like 'Today, 5:30 PM' if already set
    IF NEW.due IS NULL OR NEW.due NOT LIKE 'Today%' THEN
      NEW.due := 'Today';
    END IF;
  ELSIF NEW.due_date = CURRENT_DATE + INTERVAL '1 day' THEN
    NEW.due_order := 2;
    IF NEW.due IS NULL THEN NEW.due := 'Tomorrow'; END IF;
  ELSE
    NEW.due_order := 3;
    IF NEW.due IS NULL THEN NEW.due := to_char(NEW.due_date, 'Mon DD'); END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_due_date_change
  BEFORE INSERT OR UPDATE OF due_date ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_due_order();
