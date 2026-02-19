-- ============================================================================
-- FINAL COMPREHENSIVE DATABASE FIX
-- ============================================================================
-- Run this ONCE on your Supabase database (SQL Editor → New Query → Run).
-- This script is IDEMPOTENT — safe to run multiple times.
--
-- What it fixes:
--   1. Status category system (backlog/todo/active/done/cancelled)
--   2. Status transitions table for analytics
--   3. Backfills orphaned tasks (NULL custom_status_id)
--   4. Auto-sync trigger: custom_status_id → status enum + completed_at (UPDATE)
--   5. Auto-sync trigger: custom_status_id → status enum + completed_at (INSERT)
--   6. Fixes broken task activity trigger (priority enum cast bug)
--   7. ON DELETE CASCADE for ALL parent→child FK relationships (30+)
--   8. UNIQUE constraints for all upsert-dependent tables (8 tables)
--   9. Removes duplicate task_sessions table
--  10. Performance indexes
--  11. ai_messages.timestamp → NOT NULL
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 1: STATUS CATEGORY SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

-- 1a. Create the status_category enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE status_category AS ENUM ('backlog', 'todo', 'active', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1b. Add category column to project_statuses
ALTER TABLE public.project_statuses
  ADD COLUMN IF NOT EXISTS category status_category NOT NULL DEFAULT 'active';

-- 1c. Backfill categories from existing booleans
UPDATE public.project_statuses SET category = 'done'  WHERE is_completed = true AND category = 'active';
UPDATE public.project_statuses SET category = 'todo'  WHERE is_default = true AND is_completed = false AND category = 'active';

-- 1d. Add category to template_statuses too
ALTER TABLE public.template_statuses
  ADD COLUMN IF NOT EXISTS category status_category NOT NULL DEFAULT 'active';

UPDATE public.template_statuses SET category = 'done'  WHERE is_completed = true AND category = 'active';
UPDATE public.template_statuses SET category = 'todo'  WHERE is_default = true AND is_completed = false AND category = 'active';

-- 1e. Indexes for category queries
CREATE INDEX IF NOT EXISTS idx_project_statuses_category ON public.project_statuses(category);
CREATE INDEX IF NOT EXISTS idx_project_statuses_project_category ON public.project_statuses(project_id, category);


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 2: STATUS TRANSITIONS TABLE (analytics: cycle time, lead time)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.status_transitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  from_status_id uuid,
  to_status_id uuid NOT NULL,
  from_category status_category,
  to_category status_category NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  time_in_previous_ms bigint,
  CONSTRAINT status_transitions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_status_transitions_task ON public.status_transitions(task_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_status_transitions_to_category ON public.status_transitions(to_category, changed_at);

ALTER TABLE public.status_transitions ENABLE ROW LEVEL SECURITY;

-- RLS policy (safe to recreate)
DROP POLICY IF EXISTS "Users can view transitions for tasks in their workspace projects" ON public.status_transitions;
CREATE POLICY "Users can view transitions for tasks in their workspace projects"
  ON public.status_transitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE t.id = status_transitions.task_id AND wm.user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 3: BACKFILL custom_status_id FOR ORPHANED TASKS
-- ═══════════════════════════════════════════════════════════════════════════

-- Assign project's default status to tasks with NULL custom_status_id
UPDATE public.tasks t
SET custom_status_id = (
  SELECT ps.id FROM public.project_statuses ps
  WHERE ps.project_id = t.project_id AND ps.is_default = true
  LIMIT 1
)
WHERE t.custom_status_id IS NULL;

-- Fallback: first status by position for any remaining NULLs
UPDATE public.tasks t
SET custom_status_id = (
  SELECT ps.id FROM public.project_statuses ps
  WHERE ps.project_id = t.project_id
  ORDER BY ps.position ASC
  LIMIT 1
)
WHERE t.custom_status_id IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 4: AUTO-SYNC TRIGGER — custom_status_id → enum + completed_at (UPDATE)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_task_status_from_custom()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_status public.project_statuses%ROWTYPE;
  v_old_status public.project_statuses%ROWTYPE;
  v_enum_status task_status;
  v_time_in_prev bigint;
BEGIN
  -- Only act when custom_status_id actually changes
  IF OLD.custom_status_id IS NOT DISTINCT FROM NEW.custom_status_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_new_status FROM public.project_statuses WHERE id = NEW.custom_status_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Derive enum from category
  v_enum_status := CASE v_new_status.category
    WHEN 'backlog'   THEN 'todo'::task_status
    WHEN 'todo'      THEN 'todo'::task_status
    WHEN 'active'    THEN 'in_progress'::task_status
    WHEN 'done'      THEN 'done'::task_status
    WHEN 'cancelled' THEN 'done'::task_status
    ELSE 'todo'::task_status
  END;

  NEW.status := v_enum_status;

  -- Sync completed_at
  IF v_new_status.category IN ('done', 'cancelled') THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;

  -- Sync first_started_at
  IF v_new_status.category NOT IN ('backlog', 'todo') AND NEW.first_started_at IS NULL THEN
    NEW.first_started_at := now();
  END IF;

  -- Record status transition for analytics
  IF OLD.custom_status_id IS NOT NULL THEN
    SELECT * INTO v_old_status FROM public.project_statuses WHERE id = OLD.custom_status_id;
    v_time_in_prev := EXTRACT(EPOCH FROM (now() - COALESCE(OLD.updated_at, OLD.created_at))) * 1000;
  END IF;

  INSERT INTO public.status_transitions (task_id, from_status_id, to_status_id, from_category, to_category, changed_by, time_in_previous_ms)
  VALUES (
    NEW.id,
    OLD.custom_status_id,
    NEW.custom_status_id,
    v_old_status.category,
    v_new_status.category,
    NEW.created_by,
    COALESCE(v_time_in_prev, 0)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_status ON public.tasks;
CREATE TRIGGER trg_sync_task_status
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_status_from_custom();


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 5: AUTO-SYNC TRIGGER — custom_status_id → enum + completed_at (INSERT)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_task_status_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status public.project_statuses%ROWTYPE;
  v_enum_status task_status;
BEGIN
  IF NEW.custom_status_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_status FROM public.project_statuses WHERE id = NEW.custom_status_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_enum_status := CASE v_status.category
    WHEN 'backlog'   THEN 'todo'::task_status
    WHEN 'todo'      THEN 'todo'::task_status
    WHEN 'active'    THEN 'in_progress'::task_status
    WHEN 'done'      THEN 'done'::task_status
    WHEN 'cancelled' THEN 'done'::task_status
    ELSE 'todo'::task_status
  END;

  NEW.status := v_enum_status;

  IF v_status.category IN ('done', 'cancelled') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_status_insert ON public.tasks;
CREATE TRIGGER trg_sync_task_status_insert
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_status_on_insert();


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 6: FIX TASK ACTIVITY TRIGGER (priority 'None' enum cast bug)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_task_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action TEXT;
  v_description TEXT;
  v_workspace_id UUID;
  v_old_priority TEXT;
  v_new_priority TEXT;
  v_old_status_name TEXT;
  v_new_status_name TEXT;
BEGIN
  -- Safe priority cast (never use 'None' — it's not a valid enum value)
  v_old_priority := CASE WHEN TG_OP IN ('UPDATE','DELETE') AND OLD.priority IS NOT NULL THEN OLD.priority::TEXT ELSE 'none' END;
  v_new_priority := CASE WHEN TG_OP IN ('INSERT','UPDATE') AND NEW.priority IS NOT NULL THEN NEW.priority::TEXT ELSE 'none' END;

  SELECT p.workspace_id INTO v_workspace_id
  FROM public.projects p WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_description := 'Task "' || NEW.title || '" was created';

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.custom_status_id IS DISTINCT FROM NEW.custom_status_id THEN
      SELECT name INTO v_old_status_name FROM public.project_statuses WHERE id = OLD.custom_status_id;
      SELECT name INTO v_new_status_name FROM public.project_statuses WHERE id = NEW.custom_status_id;
      v_action := 'status_changed';
      v_description := 'Task "' || NEW.title || '" moved from "' || COALESCE(v_old_status_name, 'Unknown') || '" to "' || COALESCE(v_new_status_name, 'Unknown') || '"';
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'status_changed';
      v_description := 'Task "' || NEW.title || '" status: ' || OLD.status::TEXT || ' → ' || NEW.status::TEXT;
    ELSIF v_old_priority IS DISTINCT FROM v_new_priority THEN
      v_action := 'priority_changed';
      v_description := 'Task "' || NEW.title || '" priority: ' || v_old_priority || ' → ' || v_new_priority;
    ELSIF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      v_action := 'assigned';
      v_description := 'Task "' || NEW.title || '" was reassigned';
    ELSE
      v_action := 'updated';
      v_description := 'Task "' || NEW.title || '" was updated';
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_description := 'Task "' || OLD.title || '" was deleted';
  END IF;

  IF v_workspace_id IS NOT NULL AND v_action IS NOT NULL THEN
    INSERT INTO public.activity_logs (workspace_id, project_id, task_id, actor_id, action_type, entity_type, description, entity_id)
    VALUES (
      v_workspace_id,
      COALESCE(NEW.project_id, OLD.project_id),
      COALESCE(NEW.id, OLD.id),
      COALESCE(NEW.created_by, OLD.created_by),
      v_action, 'task', v_description,
      COALESCE(NEW.id, OLD.id)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 7: ON DELETE CASCADE — ALL parent→child FK relationships
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 7a. Tasks → children ───
ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_task_id_fkey;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_parent_id_fkey;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES public.task_comments(id) ON DELETE SET NULL;

ALTER TABLE public.task_attachments DROP CONSTRAINT IF EXISTS task_attachments_task_id_fkey;
ALTER TABLE public.task_attachments ADD CONSTRAINT task_attachments_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_work_sessions DROP CONSTRAINT IF EXISTS task_work_sessions_task_id_fkey;
ALTER TABLE public.task_work_sessions ADD CONSTRAINT task_work_sessions_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_assignees DROP CONSTRAINT IF EXISTS task_assignees_task_id_fkey;
ALTER TABLE public.task_assignees ADD CONSTRAINT task_assignees_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_links DROP CONSTRAINT IF EXISTS task_links_task_id_fkey;
ALTER TABLE public.task_links ADD CONSTRAINT task_links_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_custom_field_values DROP CONSTRAINT IF EXISTS task_custom_field_values_task_id_fkey;
ALTER TABLE public.task_custom_field_values ADD CONSTRAINT task_custom_field_values_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.task_custom_field_values DROP CONSTRAINT IF EXISTS task_custom_field_values_field_id_fkey;
ALTER TABLE public.task_custom_field_values ADD CONSTRAINT task_custom_field_values_field_id_fkey
  FOREIGN KEY (field_id) REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE;

ALTER TABLE public.status_transitions DROP CONSTRAINT IF EXISTS status_transitions_task_id_fkey;
ALTER TABLE public.status_transitions ADD CONSTRAINT status_transitions_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.status_transitions DROP CONSTRAINT IF EXISTS status_transitions_from_status_id_fkey;
ALTER TABLE public.status_transitions ADD CONSTRAINT status_transitions_from_status_id_fkey
  FOREIGN KEY (from_status_id) REFERENCES public.project_statuses(id) ON DELETE SET NULL;

ALTER TABLE public.status_transitions DROP CONSTRAINT IF EXISTS status_transitions_to_status_id_fkey;
ALTER TABLE public.status_transitions ADD CONSTRAINT status_transitions_to_status_id_fkey
  FOREIGN KEY (to_status_id) REFERENCES public.project_statuses(id) ON DELETE SET NULL;

ALTER TABLE public.status_transitions DROP CONSTRAINT IF EXISTS status_transitions_changed_by_fkey;
ALTER TABLE public.status_transitions ADD CONSTRAINT status_transitions_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ─── 7b. Projects → children ───
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_statuses DROP CONSTRAINT IF EXISTS project_statuses_project_id_fkey;
ALTER TABLE public.project_statuses ADD CONSTRAINT project_statuses_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_views DROP CONSTRAINT IF EXISTS project_views_project_id_fkey;
ALTER TABLE public.project_views ADD CONSTRAINT project_views_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.custom_field_definitions DROP CONSTRAINT IF EXISTS custom_field_definitions_project_id_fkey;
ALTER TABLE public.custom_field_definitions ADD CONSTRAINT custom_field_definitions_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Activity logs: SET NULL (preserve history after project/task deletion)
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_project_id_fkey;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_task_id_fkey;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

-- ─── 7c. Channels & DMs ───
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_channel_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_reply_to_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_reply_to_id_fkey
  FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.channel_members DROP CONSTRAINT IF EXISTS channel_members_channel_id_fkey;
ALTER TABLE public.channel_members ADD CONSTRAINT channel_members_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;

ALTER TABLE public.channel_read_status DROP CONSTRAINT IF EXISTS channel_read_status_channel_id_fkey;
ALTER TABLE public.channel_read_status ADD CONSTRAINT channel_read_status_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;

ALTER TABLE public.dm_messages DROP CONSTRAINT IF EXISTS dm_messages_conversation_id_fkey;
ALTER TABLE public.dm_messages ADD CONSTRAINT dm_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id) ON DELETE CASCADE;

ALTER TABLE public.dm_read_status DROP CONSTRAINT IF EXISTS dm_read_status_conversation_id_fkey;
ALTER TABLE public.dm_read_status ADD CONSTRAINT dm_read_status_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id) ON DELETE CASCADE;

ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_workspace_id_fkey;
ALTER TABLE public.channels ADD CONSTRAINT channels_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.dm_conversations DROP CONSTRAINT IF EXISTS dm_conversations_workspace_id_fkey;
ALTER TABLE public.dm_conversations ADD CONSTRAINT dm_conversations_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ─── 7d. Workspace → children ───
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_workspace_id_fkey;
ALTER TABLE public.projects ADD CONSTRAINT projects_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_workspace_id_fkey;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_workspace_id_fkey;
ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_subscriptions DROP CONSTRAINT IF EXISTS workspace_subscriptions_workspace_id_fkey;
ALTER TABLE public.workspace_subscriptions ADD CONSTRAINT workspace_subscriptions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_workspace_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_workspace_id_fkey;
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_workspace_id_fkey;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_workspace_id_fkey;
ALTER TABLE public.ai_conversations ADD CONSTRAINT ai_conversations_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.ai_messages DROP CONSTRAINT IF EXISTS ai_messages_conversation_id_fkey;
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;

ALTER TABLE public.payment_history DROP CONSTRAINT IF EXISTS payment_history_workspace_id_fkey;
ALTER TABLE public.payment_history ADD CONSTRAINT payment_history_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.payment_submissions DROP CONSTRAINT IF EXISTS payment_submissions_workspace_id_fkey;
ALTER TABLE public.payment_submissions ADD CONSTRAINT payment_submissions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.project_templates DROP CONSTRAINT IF EXISTS project_templates_workspace_id_fkey;
ALTER TABLE public.project_templates ADD CONSTRAINT project_templates_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ─── 7e. Templates → children ───
ALTER TABLE public.template_statuses DROP CONSTRAINT IF EXISTS template_statuses_template_id_fkey;
ALTER TABLE public.template_statuses ADD CONSTRAINT template_statuses_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE CASCADE;

ALTER TABLE public.template_tasks DROP CONSTRAINT IF EXISTS template_tasks_template_id_fkey;
ALTER TABLE public.template_tasks ADD CONSTRAINT template_tasks_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE CASCADE;

ALTER TABLE public.template_views DROP CONSTRAINT IF EXISTS template_views_template_id_fkey;
ALTER TABLE public.template_views ADD CONSTRAINT template_views_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE CASCADE;

ALTER TABLE public.template_custom_fields DROP CONSTRAINT IF EXISTS template_custom_fields_template_id_fkey;
ALTER TABLE public.template_custom_fields ADD CONSTRAINT template_custom_fields_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE CASCADE;

-- ─── 7f. Notification logs → notifications ───
ALTER TABLE public.notification_logs DROP CONSTRAINT IF EXISTS notification_logs_notification_id_fkey;
ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_notification_id_fkey
  FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 8: UNIQUE CONSTRAINTS — Prevent duplicates, enable upserts
-- ═══════════════════════════════════════════════════════════════════════════

-- 8a. channel_members(channel_id, user_id)
DELETE FROM public.channel_members a USING public.channel_members b
WHERE a.id > b.id AND a.channel_id = b.channel_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_members_unique
  ON public.channel_members(channel_id, user_id);

-- 8b. channel_read_status(channel_id, user_id) — useChat.ts upsert
DELETE FROM public.channel_read_status a USING public.channel_read_status b
WHERE a.id > b.id AND a.channel_id = b.channel_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_read_status_unique
  ON public.channel_read_status(channel_id, user_id);

-- 8c. dm_read_status(conversation_id, user_id) — useDirectMessages.ts upsert
DELETE FROM public.dm_read_status a USING public.dm_read_status b
WHERE a.id > b.id AND a.conversation_id = b.conversation_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_read_status_unique
  ON public.dm_read_status(conversation_id, user_id);

-- 8d. task_assignees(task_id, user_id)
DELETE FROM public.task_assignees a USING public.task_assignees b
WHERE a.id > b.id AND a.task_id = b.task_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_assignees_unique
  ON public.task_assignees(task_id, user_id);

-- 8e. workspace_members(workspace_id, user_id)
DELETE FROM public.workspace_members a USING public.workspace_members b
WHERE a.id > b.id AND a.workspace_id = b.workspace_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_unique
  ON public.workspace_members(workspace_id, user_id);

-- 8f. notification_preferences(user_id, workspace_id)
DELETE FROM public.notification_preferences a USING public.notification_preferences b
WHERE a.id > b.id AND a.user_id = b.user_id AND a.workspace_id = b.workspace_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_unique
  ON public.notification_preferences(user_id, workspace_id);

-- 8g. push_subscriptions(user_id, endpoint) — usePushNotifications.ts upsert
DELETE FROM public.push_subscriptions a USING public.push_subscriptions b
WHERE a.id > b.id AND a.user_id = b.user_id AND a.endpoint = b.endpoint;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_endpoint
  ON public.push_subscriptions(user_id, endpoint);

-- 8h. dm_conversations — prevent duplicate A↔B pairs
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_conversations_pair
  ON public.dm_conversations(workspace_id, LEAST(participant_1, participant_2), GREATEST(participant_1, participant_2));


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 9: REMOVE DUPLICATE task_sessions TABLE
-- ═══════════════════════════════════════════════════════════════════════════

-- Migrate any data from task_sessions → task_work_sessions, then drop
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_sessions') THEN
    INSERT INTO public.task_work_sessions (task_id, user_id, started_at, ended_at, duration_seconds, created_at)
    SELECT task_id, user_id, started_at, ended_at, duration_seconds, created_at
    FROM public.task_sessions ts
    WHERE NOT EXISTS (
      SELECT 1 FROM public.task_work_sessions tws
      WHERE tws.task_id = ts.task_id AND tws.user_id = ts.user_id AND tws.started_at = ts.started_at
    );
    DROP TABLE public.task_sessions;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 10: PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tasks_custom_status_id ON public.tasks(custom_status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_custom_status ON public.tasks(project_id, custom_status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON public.tasks(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_time ON public.activity_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 11: FIX ai_messages.timestamp → NOT NULL
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.ai_messages SET "timestamp" = now() WHERE "timestamp" IS NULL;
ALTER TABLE public.ai_messages ALTER COLUMN "timestamp" SET NOT NULL;
ALTER TABLE public.ai_messages ALTER COLUMN "timestamp" SET DEFAULT now();


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Your database is now fully fixed.
-- ═══════════════════════════════════════════════════════════════════════════
