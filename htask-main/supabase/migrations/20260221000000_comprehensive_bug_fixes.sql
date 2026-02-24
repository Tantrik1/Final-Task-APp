-- ============================================================================
-- COMPREHENSIVE BUG FIXES — All 12 identified issues
-- ============================================================================
-- Addresses: C-01, C-02 (helper), C-03, M-03, M-05, E-03, E-04
-- Safe to re-run: uses CREATE OR REPLACE / IF NOT EXISTS / DO $$
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- C-01: Fix toggle_task_timer_optimized to update custom_status_id, not enum
-- ═══════════════════════════════════════════════════════════════════════════
-- Previously: set tasks.status = 'in_progress' (old enum) directly.
-- This bypassed trg_sync_task_status, so custom_status_id was never updated,
-- meaning the status badge showed wrong status for ~100ms until autoMoveToActive().
-- Fix: update custom_status_id → trg_sync_task_status fires automatically,
-- which updates the enum, first_started_at, and tracks status_transitions.

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
    v_active_status_id UUID;
    v_status_changed BOOLEAN := FALSE;
    v_session_id UUID;
BEGIN
    -- 1. Stop any currently running timer for this user (atomic, single UPDATE)
    UPDATE public.task_work_sessions
    SET ended_at = v_now,
        duration_seconds = EXTRACT(EPOCH FROM (v_now - started_at))::INTEGER
    WHERE user_id = current_user_id
      AND ended_at IS NULL
    RETURNING task_id INTO v_old_task_id;

    IF v_old_task_id IS NOT NULL THEN
        -- Update old task's accumulated work time atomically, clear timer flag
        UPDATE public.tasks
        SET is_timer_running = FALSE,
            total_work_time  = COALESCE(total_work_time, 0) +
                               COALESCE(
                                   (SELECT duration_seconds FROM public.task_work_sessions
                                    WHERE task_id = v_old_task_id
                                      AND user_id = current_user_id
                                      AND ended_at = v_now
                                    ORDER BY ended_at DESC LIMIT 1),
                                   0),
            updated_at = v_now
        WHERE id = v_old_task_id;
    END IF;

    -- 2. Get target task info including its status category
    SELECT t.id,
           t.title,
           t.status,
           t.custom_status_id,
           p.name     AS project_name,
           COALESCE(t.total_work_time, 0) AS total_work_time,
           COALESCE(ps.category, 'active'::status_category) AS status_cat
    INTO v_new_task
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    LEFT JOIN public.project_statuses ps ON ps.id = t.custom_status_id
    WHERE t.id = target_task_id
      AND (t.assigned_to = current_user_id
           OR t.created_by = current_user_id
           OR EXISTS (
               SELECT 1 FROM public.task_assignees ta
               WHERE ta.task_id = target_task_id AND ta.user_id = current_user_id
           ));

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found or access denied';
    END IF;

    -- 3. Auto-transition: if in todo category, move to first active-category status.
    --    We update custom_status_id (not the enum) so trg_sync_task_status fires
    --    and keeps all derived fields (status enum, first_started_at, status_transitions) in sync.
    IF v_new_task.status_cat = 'todo'::status_category THEN
        SELECT ps.id INTO v_active_status_id
        FROM public.project_statuses ps
        JOIN public.tasks t ON t.project_id = ps.project_id
        WHERE t.id = target_task_id
          AND ps.category = 'active'
        ORDER BY ps.position ASC
        LIMIT 1;

        IF v_active_status_id IS NOT NULL THEN
            -- This UPDATE fires trg_sync_task_status (BEFORE UPDATE) which handles:
            --   • tasks.status = 'in_progress'
            --   • tasks.first_started_at (if first time)
            --   • INSERT INTO status_transitions
            UPDATE public.tasks
            SET custom_status_id = v_active_status_id,
                is_timer_running  = TRUE,
                updated_at        = v_now
            WHERE id = target_task_id;
            v_status_changed := TRUE;
        ELSE
            -- No active status found, just start timer
            UPDATE public.tasks
            SET is_timer_running = TRUE,
                updated_at       = v_now
            WHERE id = target_task_id;
        END IF;
    ELSE
        -- Task already in active/done/cancelled: just start the timer
        UPDATE public.tasks
        SET is_timer_running = TRUE,
            updated_at       = v_now
        WHERE id = target_task_id;
    END IF;

    -- 4. Create new work session
    INSERT INTO public.task_work_sessions (task_id, user_id, started_at)
    VALUES (target_task_id, current_user_id, v_now)
    RETURNING id INTO v_session_id;

    -- 5. Return rich result
    RETURN QUERY
    SELECT
        target_task_id,
        v_new_task.title,
        v_new_task.project_name,
        v_session_id,
        v_now,
        v_new_task.total_work_time,
        v_status_changed,
        v_new_task.status::TEXT,
        CASE WHEN v_status_changed THEN 'in_progress' ELSE v_new_task.status::TEXT END;

END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- C-02: Add close_task_session RPC — atomic session close + work time update
-- ═══════════════════════════════════════════════════════════════════════════
-- Replaces the 3-step read-add-write in useTaskTimer.closeOpenSession().
-- Returns the duration_seconds of the closed session (0 if none was open).

CREATE OR REPLACE FUNCTION public.close_task_session(
    p_task_id UUID,
    p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now      TIMESTAMPTZ := now();
    v_duration INTEGER := 0;
BEGIN
    -- Close the open session and capture duration in a single statement
    UPDATE public.task_work_sessions
    SET ended_at         = v_now,
        duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_now - started_at))::INTEGER)
    WHERE task_id   = p_task_id
      AND user_id   = p_user_id
      AND ended_at  IS NULL
    RETURNING duration_seconds INTO v_duration;

    -- Atomically increment total_work_time and clear timer flag
    UPDATE public.tasks
    SET is_timer_running = FALSE,
        total_work_time  = COALESCE(total_work_time, 0) + COALESCE(v_duration, 0),
        updated_at       = v_now
    WHERE id = p_task_id;

    RETURN COALESCE(v_duration, 0);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- C-02 (supplemental): add adjust_task_work_time for deleteSession in app
-- ═══════════════════════════════════════════════════════════════════════════
-- Used when deleting a past session: atomically subtracts its duration.

CREATE OR REPLACE FUNCTION public.adjust_task_work_time(
    p_task_id UUID,
    p_delta   INTEGER   -- positive to add, negative to subtract
)
RETURNS INTEGER  -- new total_work_time
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_total INTEGER;
BEGIN
    UPDATE public.tasks
    SET total_work_time = GREATEST(0, COALESCE(total_work_time, 0) + p_delta),
        updated_at      = now()
    WHERE id = p_task_id
    RETURNING total_work_time INTO v_new_total;

    RETURN COALESCE(v_new_total, 0);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- C-03: Fix trg_sync_task_status — record auth.uid() not task creator
-- ═══════════════════════════════════════════════════════════════════════════
-- Previously: status_transitions.changed_by = NEW.created_by (always task creator).
-- Now:        COALESCE(auth.uid(), NEW.created_by) — actual actor when available.

CREATE OR REPLACE FUNCTION public.sync_task_status_from_custom()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_category        status_category;
    v_old_category    status_category;
    v_now             TIMESTAMPTZ := now();
    v_time_in_prev_ms BIGINT;
    v_actor_id        UUID;
BEGIN
    -- Only act when custom_status_id actually changes
    IF NEW.custom_status_id IS NOT DISTINCT FROM OLD.custom_status_id THEN
        RETURN NEW;
    END IF;

    -- Determine the actor: use auth.uid() if available, fall back to task creator
    v_actor_id := COALESCE(auth.uid(), NEW.created_by);

    -- Look up new status category
    IF NEW.custom_status_id IS NOT NULL THEN
        SELECT category INTO v_category
        FROM public.project_statuses
        WHERE id = NEW.custom_status_id;
    ELSE
        v_category := 'todo'::status_category;
    END IF;

    -- Look up old status category
    IF OLD.custom_status_id IS NOT NULL THEN
        SELECT category INTO v_old_category
        FROM public.project_statuses
        WHERE id = OLD.custom_status_id;
    ELSE
        v_old_category := NULL;
    END IF;

    -- Derive legacy status enum from category (kept for backwards-compat queries)
    NEW.status := CASE v_category
        WHEN 'todo'      THEN 'todo'::task_status
        WHEN 'active'    THEN 'in_progress'::task_status
        WHEN 'done'      THEN 'done'::task_status
        WHEN 'cancelled' THEN 'done'::task_status
        ELSE                  'todo'::task_status
    END;

    -- Set / clear completed_at
    IF v_category IN ('done', 'cancelled') THEN
        NEW.completed_at := COALESCE(NEW.completed_at, v_now);
    ELSE
        NEW.completed_at := NULL;
    END IF;

    -- Record first_started_at when task first becomes active
    IF v_category = 'active' AND OLD.first_started_at IS NULL THEN
        NEW.first_started_at := v_now;
    END IF;

    -- Compute time spent in previous status (for cycle-time analytics)
    IF OLD.updated_at IS NOT NULL THEN
        v_time_in_prev_ms := EXTRACT(EPOCH FROM (v_now - OLD.updated_at))::BIGINT * 1000;
    END IF;

    -- Record status transition with correct actor (C-03 fix)
    INSERT INTO public.status_transitions (
        task_id, from_status_id, to_status_id,
        from_category, to_category,
        changed_by, changed_at, time_in_previous_ms
    ) VALUES (
        NEW.id,
        OLD.custom_status_id,
        NEW.custom_status_id,
        v_old_category,
        v_category,
        v_actor_id,       -- ← Was NEW.created_by; now correct actor
        v_now,
        v_time_in_prev_ms
    );

    RETURN NEW;
END;
$$;

-- Re-attach the trigger (DROP + CREATE to ensure function replacement takes effect)
DROP TRIGGER IF EXISTS trg_sync_task_status ON public.tasks;
CREATE TRIGGER trg_sync_task_status
    BEFORE UPDATE OF custom_status_id ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_task_status_from_custom();

-- Also for INSERT (new tasks arrive with a custom_status_id set)
DROP TRIGGER IF EXISTS trg_sync_task_status_insert ON public.tasks;
CREATE TRIGGER trg_sync_task_status_insert
    BEFORE INSERT ON public.tasks
    FOR EACH ROW
    WHEN (NEW.custom_status_id IS NOT NULL)
    EXECUTE FUNCTION public.sync_task_status_from_custom();


-- ═══════════════════════════════════════════════════════════════════════════
-- M-03: Fix notify_task_status_changed to also notify task_assignees members
-- ═══════════════════════════════════════════════════════════════════════════
-- Previously: only notified created_by and assigned_to (legacy single-assignee).
-- Now: also loops over task_assignees (multi-assignee table) for anyone missed.

CREATE OR REPLACE FUNCTION public.notify_task_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id      UUID;
    v_project_name      TEXT;
    v_actor_name        TEXT;
    v_notification_type notification_type;
    v_title             TEXT;
    v_body              TEXT;
    v_new_status_name   TEXT;
    v_old_status_name   TEXT;
    v_is_completed      BOOLEAN;
    v_notified          UUID[];  -- track who already received notification
    v_extra_assignee    UUID;
BEGIN
    -- Only act when custom_status_id changes
    IF (NEW.custom_status_id IS NOT DISTINCT FROM OLD.custom_status_id) THEN
        RETURN NEW;
    END IF;

    -- Get workspace and project info
    SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
    FROM public.projects p WHERE p.id = NEW.project_id;

    -- Get actor name
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name
    FROM public.profiles WHERE id = auth.uid();

    -- Get old status name
    IF OLD.custom_status_id IS NOT NULL THEN
        SELECT name INTO v_old_status_name
        FROM public.project_statuses WHERE id = OLD.custom_status_id;
    ELSE
        v_old_status_name := 'Unknown';
    END IF;

    -- Get new status name and completion flag
    IF NEW.custom_status_id IS NOT NULL THEN
        SELECT name, is_completed INTO v_new_status_name, v_is_completed
        FROM public.project_statuses WHERE id = NEW.custom_status_id;
    ELSE
        v_new_status_name := 'Unknown';
        v_is_completed := false;
    END IF;

    -- Choose notification type and message
    IF v_is_completed THEN
        v_notification_type := 'task_completed';
        v_title := COALESCE(v_actor_name, 'Someone') || ' completed ''' || NEW.title || '''';
        v_body  := 'in ' || v_project_name;
    ELSE
        v_notification_type := 'task_status_changed';
        v_title := COALESCE(v_actor_name, 'Someone') || ' updated ''' || NEW.title || ''' in ' || v_project_name;
        v_body  := 'Status: ' || COALESCE(v_old_status_name, 'Unknown') || ' → ' || v_new_status_name;
    END IF;

    -- Track notified users so we don't double-send
    v_notified := ARRAY[COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID)];

    -- Notify task creator
    IF NEW.created_by IS NOT NULL AND NOT (NEW.created_by = ANY(v_notified)) THEN
        PERFORM create_notification(
            v_workspace_id, NEW.created_by, auth.uid(),
            v_notification_type, v_title, v_body,
            'task'::entity_type, NEW.id,
            jsonb_build_object(
                'project_id', NEW.project_id, 'project_name', v_project_name,
                'task_title', NEW.title, 'old_status', v_old_status_name,
                'new_status', v_new_status_name, 'workspace_id', v_workspace_id
            )
        );
        v_notified := v_notified || NEW.created_by;
    END IF;

    -- Notify legacy single-assignee (tasks.assigned_to)
    IF NEW.assigned_to IS NOT NULL AND NOT (NEW.assigned_to = ANY(v_notified)) THEN
        PERFORM create_notification(
            v_workspace_id, NEW.assigned_to, auth.uid(),
            v_notification_type, v_title, v_body,
            'task'::entity_type, NEW.id,
            jsonb_build_object(
                'project_id', NEW.project_id, 'project_name', v_project_name,
                'task_title', NEW.title, 'old_status', v_old_status_name,
                'new_status', v_new_status_name, 'workspace_id', v_workspace_id
            )
        );
        v_notified := v_notified || NEW.assigned_to;
    END IF;

    -- M-03 FIX: Also notify everyone in task_assignees (multi-assignee table)
    FOR v_extra_assignee IN
        SELECT user_id FROM public.task_assignees
        WHERE task_id = NEW.id
          AND NOT (user_id = ANY(v_notified))
    LOOP
        PERFORM create_notification(
            v_workspace_id, v_extra_assignee, auth.uid(),
            v_notification_type, v_title, v_body,
            'task'::entity_type, NEW.id,
            jsonb_build_object(
                'project_id', NEW.project_id, 'project_name', v_project_name,
                'task_title', NEW.title, 'old_status', v_old_status_name,
                'new_status', v_new_status_name, 'workspace_id', v_workspace_id
            )
        );
        v_notified := v_notified || v_extra_assignee;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Re-attach the trigger
DROP TRIGGER IF EXISTS trigger_notify_task_status_changed ON public.tasks;
CREATE TRIGGER trigger_notify_task_status_changed
    AFTER UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_task_status_changed();


-- ═══════════════════════════════════════════════════════════════════════════
-- E-04: Decouple hardcoded push notification edge function URL
-- ═══════════════════════════════════════════════════════════════════════════
-- Stores the URL in a database GUC (config variable) so it can be changed
-- without a code migration. Falls back to the literal URL if unset.

ALTER DATABASE postgres
    SET app.push_notification_url
    TO 'https://hxbkqbvmyrfggkoybugz.supabase.co/functions/v1/send-push-notification';

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_has_subscription  BOOLEAN;
    v_url               TEXT;
    v_payload           JSONB;
    v_workspace_id      TEXT;
    v_entity_type       TEXT;
    v_entity_id         TEXT;
    v_metadata          JSONB;
    v_notification_url  TEXT;
    v_project_id        TEXT;
    v_task_id           TEXT;
BEGIN
    -- Check if user has active push subscriptions
    SELECT EXISTS (
        SELECT 1 FROM public.push_subscriptions
        WHERE user_id = NEW.user_id AND is_active = true
    ) INTO v_has_subscription;

    IF NOT v_has_subscription THEN
        RETURN NEW;
    END IF;

    -- E-04 FIX: Read URL from config GUC; fallback to hardcoded value if unset
    v_url := COALESCE(
        NULLIF(current_setting('app.push_notification_url', true), ''),
        'https://hxbkqbvmyrfggkoybugz.supabase.co/functions/v1/send-push-notification'
    );

    -- Build deep-link URL based on entity type
    v_workspace_id := NEW.workspace_id::TEXT;
    v_entity_type  := NEW.entity_type::TEXT;
    v_entity_id    := NEW.entity_id::TEXT;
    v_metadata     := COALESCE(NEW.metadata, '{}'::jsonb);
    v_project_id   := v_metadata->>'project_id';
    v_task_id      := v_metadata->>'task_id';

    CASE v_entity_type
        WHEN 'task' THEN
            v_notification_url := '/workspace/' || v_workspace_id || '/projects/' || COALESCE(v_project_id, '') || '/tasks/' || v_entity_id;
        WHEN 'project' THEN
            v_notification_url := '/workspace/' || v_workspace_id || '/projects/' || v_entity_id;
        WHEN 'comment' THEN
            v_notification_url := '/workspace/' || v_workspace_id || '/projects/' || COALESCE(v_project_id, '') || '/tasks/' || COALESCE(v_task_id, '');
        WHEN 'chat' THEN
            IF v_metadata->>'is_dm' = 'true' AND v_metadata->>'conversation_id' IS NOT NULL THEN
                v_notification_url := '/workspace/' || v_workspace_id || '/chat?dm=' || (v_metadata->>'conversation_id');
            ELSIF v_metadata->>'channel_id' IS NOT NULL THEN
                v_notification_url := '/workspace/' || v_workspace_id || '/chat?channel=' || (v_metadata->>'channel_id');
            ELSE
                v_notification_url := '/workspace/' || v_workspace_id || '/chat';
            END IF;
        ELSE
            v_notification_url := '/workspace/' || v_workspace_id;
    END CASE;

    v_payload := jsonb_build_object(
        'userId', NEW.user_id,
        'notification', jsonb_build_object(
            'id',    NEW.id,
            'title', NEW.title,
            'body',  NEW.body,
            'url',   v_notification_url,
            'tag',   NEW.type::TEXT || '-' || v_entity_id
        )
    );

    PERFORM net.http_post(
        url     := v_url,
        body    := v_payload,
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        )
    );

    RETURN NEW;
END;
$function$;


-- ═══════════════════════════════════════════════════════════════════════════
-- M-05 + E-03: pg_cron setup instructions (run once by an admin)
-- ═══════════════════════════════════════════════════════════════════════════
-- These are NOT executed automatically. Run manually in Supabase SQL editor
-- after enabling the pg_cron extension in the Supabase dashboard.
--
-- STEP 1: Enable extension (Dashboard → Database → Extensions → pg_cron)
--
-- STEP 2: Schedule due-date reminder notifications (runs daily at 08:00 UTC)
--   SELECT cron.schedule(
--     'daily-due-date-reminders',
--     '0 8 * * *',
--     $$ SELECT public.send_due_date_reminders(); $$
--   );
--
-- STEP 3: Refresh workspace stats materialized view every 5 minutes
--   SELECT cron.schedule(
--     'refresh-workspace-stats',
--     '*/5 * * * *',
--     $$ SELECT public.refresh_workspace_stats_cache(); $$
--   );
--
-- STEP 4: To view existing cron jobs:
--   SELECT * FROM cron.job;
--
-- STEP 5: To remove a job:
--   SELECT cron.unschedule('daily-due-date-reminders');
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE — Migration complete.
-- ═══════════════════════════════════════════════════════════════════════════
-- Summary of changes:
--   C-01: toggle_task_timer_optimized → updates custom_status_id (not status enum)
--   C-02: close_task_session() RPC → atomic session close + total_work_time increment
--   C-02: adjust_task_work_time() RPC → atomic decrement for session deletion
--   C-03: sync_task_status_from_custom → changed_by = auth.uid() not creator
--   M-03: notify_task_status_changed → notifies task_assignees multi-assignees
--   E-04: trigger_push_notification → URL from current_setting() not hardcoded
--   M-05 + E-03: pg_cron instructions in comments above
-- ═══════════════════════════════════════════════════════════════════════════
