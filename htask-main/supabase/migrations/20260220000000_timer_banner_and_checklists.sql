-- ============================================================================
-- TIMER BANNER + TASK CHECKLISTS
-- ============================================================================

-- ─── 1. task_checklists table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_checklists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    is_checked  BOOLEAN NOT NULL DEFAULT false,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_checklists_task_id ON public.task_checklists(task_id);

ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage checklists"
ON public.task_checklists
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
        WHERE t.id = task_checklists.task_id
          AND wm.user_id = auth.uid()
    )
);

-- ─── 2. start_task_timer RPC ─────────────────────────────────────────────────
-- Stops any other running timer for this user, then starts the target task.
CREATE OR REPLACE FUNCTION public.start_task_timer(target_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now     TIMESTAMPTZ := now();
    v_session RECORD;
    v_duration INTEGER;
BEGIN
    -- 1. Find and stop any other running timer for this user
    FOR v_session IN
        SELECT tws.id, tws.started_at, tws.task_id
        FROM public.task_work_sessions tws
        JOIN public.tasks t ON t.id = tws.task_id
        WHERE tws.user_id = v_user_id
          AND tws.ended_at IS NULL
          AND tws.task_id != target_task_id
    LOOP
        v_duration := EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER;

        -- Close the session
        UPDATE public.task_work_sessions
        SET ended_at = v_now,
            duration_seconds = v_duration
        WHERE id = v_session.id;

        -- Update total_work_time and clear is_timer_running on the old task
        UPDATE public.tasks
        SET is_timer_running = false,
            total_work_time = COALESCE(total_work_time, 0) + v_duration
        WHERE id = v_session.task_id;
    END LOOP;

    -- 2. Close any open session on the target task itself (resume case)
    FOR v_session IN
        SELECT tws.id, tws.started_at
        FROM public.task_work_sessions tws
        WHERE tws.task_id = target_task_id
          AND tws.user_id = v_user_id
          AND tws.ended_at IS NULL
    LOOP
        v_duration := EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER;
        UPDATE public.task_work_sessions
        SET ended_at = v_now, duration_seconds = v_duration
        WHERE id = v_session.id;

        UPDATE public.tasks
        SET total_work_time = COALESCE(total_work_time, 0) + v_duration
        WHERE id = target_task_id;
    END LOOP;

    -- 3. Start new session for target task
    INSERT INTO public.task_work_sessions (task_id, user_id, started_at)
    VALUES (target_task_id, v_user_id, v_now);

    -- 4. Mark target task as running
    UPDATE public.tasks
    SET is_timer_running = true,
        first_started_at = COALESCE(first_started_at, v_now)
    WHERE id = target_task_id;
END;
$$;

-- ─── 3. stop_task_timer RPC ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stop_task_timer(target_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now     TIMESTAMPTZ := now();
    v_session RECORD;
    v_duration INTEGER;
BEGIN
    FOR v_session IN
        SELECT tws.id, tws.started_at
        FROM public.task_work_sessions tws
        WHERE tws.task_id = target_task_id
          AND tws.user_id = v_user_id
          AND tws.ended_at IS NULL
    LOOP
        v_duration := EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER;
        UPDATE public.task_work_sessions
        SET ended_at = v_now, duration_seconds = v_duration
        WHERE id = v_session.id;

        UPDATE public.tasks
        SET is_timer_running = false,
            total_work_time = COALESCE(total_work_time, 0) + v_duration
        WHERE id = target_task_id;
    END LOOP;
END;
$$;

-- ─── 4. get_active_timer RPC ─────────────────────────────────────────────────
-- Returns the currently running task + session for the calling user.
CREATE OR REPLACE FUNCTION public.get_active_timer()
RETURNS TABLE (
    task_id         UUID,
    task_title      TEXT,
    project_name    TEXT,
    session_id      UUID,
    started_at      TIMESTAMPTZ,
    total_work_time INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id            AS task_id,
        t.title         AS task_title,
        p.name          AS project_name,
        tws.id          AS session_id,
        tws.started_at  AS started_at,
        COALESCE(t.total_work_time, 0) AS total_work_time
    FROM public.task_work_sessions tws
    JOIN public.tasks t ON t.id = tws.task_id
    JOIN public.projects p ON p.id = t.project_id
    WHERE tws.user_id = auth.uid()
      AND tws.ended_at IS NULL
    ORDER BY tws.started_at DESC
    LIMIT 1;
END;
$$;
