-- ============================================================================
-- OPTIMIZED TIMER TOGGLE FUNCTION
-- ============================================================================

-- ─── toggle_task_timer_optimized RPC ─────────────────────────────────────
-- Atomic operation: stop previous timer, start new timer, update status
CREATE OR REPLACE FUNCTION public.toggle_task_timer_optimized(
    target_task_id UUID,
    current_user_id UUID
)
RETURNS TABLE (
    task_id UUID,
    task_title TEXT,
    project_name TEXT,
    session_id UUID,
    started_at TIMESTAMPTZ,
    total_work_time INTEGER,
    status_changed BOOLEAN,
    old_status TEXT,
    new_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_old_task_id UUID;
    v_new_task RECORD;
    v_old_status TEXT;
    v_new_status TEXT;
    v_status_changed BOOLEAN := FALSE;
    v_session_id UUID;
BEGIN
    -- 1. Stop any currently running timer for this user
    UPDATE public.task_work_sessions
    SET ended_at = v_now,
        duration_seconds = EXTRACT(EPOCH FROM (v_now - started_at))::INTEGER
    WHERE user_id = current_user_id
      AND ended_at IS NULL
    RETURNING task_id INTO v_old_task_id;

    IF v_old_task_id IS NOT NULL THEN
        -- Update the old task's timer flag
        UPDATE public.tasks
        SET is_timer_running = FALSE,
            updated_at = v_now
        WHERE id = v_old_task_id;
    END IF;

    -- 2. Get target task info and determine status change
    SELECT t.id, t.title, t.status, p.name as project_name, COALESCE(t.total_work_time, 0)
    INTO v_new_task
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = target_task_id
      AND (t.assigned_to = current_user_id OR t.created_by = current_user_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found or access denied';
    END IF;

    -- 3. Determine if status should change (todo → in_progress)
    v_old_status := v_new_task.status;
    IF v_new_task.status = 'todo'::task_status THEN
        v_new_status := 'in_progress'::task_status;
        v_status_changed := TRUE;
    ELSE
        v_new_status := v_new_task.status;
    END IF;

    -- 4. Start new timer and update status if needed
    UPDATE public.tasks
    SET is_timer_running = TRUE,
        status = v_new_status,
        updated_at = v_now
    WHERE id = target_task_id;

    -- 5. Create new work session
    INSERT INTO public.task_work_sessions (task_id, user_id, started_at)
    VALUES (target_task_id, current_user_id, v_now)
    RETURNING id INTO v_session_id;

    -- 6. Return the result
    RETURN QUERY
    SELECT
        target_task_id,
        v_new_task.title,
        v_new_task.project_name,
        v_session_id,
        v_now,
        v_new_task.total_work_time,
        v_status_changed,
        v_old_status,
        v_new_status::TEXT;

END;
$$;

-- ─── stop_task_timer_optimized RPC ───────────────────────────────────────
-- Optimized stop function that closes session and updates timer flag
CREATE OR REPLACE FUNCTION public.stop_task_timer_optimized(
    target_task_id UUID,
    current_user_id UUID
)
RETURNS TABLE (
    task_id UUID,
    task_title TEXT,
    project_name TEXT,
    session_duration INTEGER,
    total_work_time INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_task RECORD;
    v_session_duration INTEGER := 0;
BEGIN
    -- 1. Get task info
    SELECT t.id, t.title, p.name as project_name, COALESCE(t.total_work_time, 0)
    INTO v_task
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = target_task_id
      AND (t.assigned_to = current_user_id OR t.created_by = current_user_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found or access denied';
    END IF;

    -- 2. Close any open session for this task
    UPDATE public.task_work_sessions
    SET ended_at = v_now,
        duration_seconds = EXTRACT(EPOCH FROM (v_now - started_at))::INTEGER
    WHERE task_id = target_task_id
      AND user_id = current_user_id
      AND ended_at IS NULL
    RETURNING duration_seconds INTO v_session_duration;

    -- 3. Update task timer flag
    UPDATE public.tasks
    SET is_timer_running = FALSE,
        total_work_time = COALESCE(total_work_time, 0) + v_session_duration,
        updated_at = v_now
    WHERE id = target_task_id;

    -- 4. Return the result
    RETURN QUERY
    SELECT
        target_task_id,
        v_task.title,
        v_task.project_name,
        v_session_duration,
        v_task.total_work_time + v_session_duration;

END;
$$;
