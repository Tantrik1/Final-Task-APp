-- ============================================================================
-- COMPREHENSIVE STATUS SYSTEM OVERHAUL
-- ============================================================================
-- Goal: Make custom_status_id the SINGLE source of truth for task status.
--
-- Architecture modeled after ClickUp/Linear:
--   - Every status belongs to a CATEGORY: backlog | todo | active | done | cancelled
--   - Categories are the universal language for cross-project queries
--   - custom_status_id on tasks is the ONLY status field that matters
--   - tasks.status enum is kept for backward compat but auto-derived
--   - Status transitions are tracked for analytics (cycle time, SLA, velocity)
--
-- What this migration does:
--   1. Adds 'category' to project_statuses and template_statuses
--   2. Creates status_transitions table for analytics
--   3. Backfills custom_status_id for orphaned tasks (NULL → project default)
--   4. Fixes the broken task activity trigger (priority enum cast + custom_status_id tracking)
--   5. Adds auto-sync trigger: custom_status_id → status enum + completed_at
--   6. Removes duplicate task_sessions table (task_work_sessions is the canonical one)
--   7. Adds missing indexes
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 1: ADD CATEGORY TO project_statuses                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Category enum: the universal language for status
DO $$ BEGIN
  CREATE TYPE status_category AS ENUM ('backlog', 'todo', 'active', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add category column
ALTER TABLE public.project_statuses
  ADD COLUMN IF NOT EXISTS category status_category NOT NULL DEFAULT 'active';

-- Backfill from existing booleans
UPDATE public.project_statuses SET category = 'done'    WHERE is_completed = true;
UPDATE public.project_statuses SET category = 'todo'    WHERE is_default = true AND is_completed = false;
-- All others remain 'active'

-- Add to template_statuses too (mirror structure)
ALTER TABLE public.template_statuses
  ADD COLUMN IF NOT EXISTS category status_category NOT NULL DEFAULT 'active';

UPDATE public.template_statuses SET category = 'done'   WHERE is_completed = true;
UPDATE public.template_statuses SET category = 'todo'   WHERE is_default = true AND is_completed = false;

-- Index for fast cross-project queries by category
CREATE INDEX IF NOT EXISTS idx_project_statuses_category ON public.project_statuses(category);
CREATE INDEX IF NOT EXISTS idx_project_statuses_project_category ON public.project_statuses(project_id, category);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 2: STATUS TRANSITIONS TABLE (for analytics & automations)         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Tracks every status change. Enables:
--   - Cycle time: how long from todo → done?
--   - Lead time: how long from created → done?
--   - Time in status: how long did task sit in "In Review"?
--   - SLA tracking: did it breach the time limit?
--   - Automation triggers: "when task enters status X, do Y"

CREATE TABLE IF NOT EXISTS public.status_transitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  from_status_id uuid,           -- NULL = task was just created
  to_status_id uuid NOT NULL,
  from_category status_category,
  to_category status_category NOT NULL,
  changed_by uuid,               -- who made the change (NULL = system/automation)
  changed_at timestamptz NOT NULL DEFAULT now(),
  time_in_previous_ms bigint,    -- milliseconds spent in the previous status
  CONSTRAINT status_transitions_pkey PRIMARY KEY (id),
  CONSTRAINT status_transitions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
  CONSTRAINT status_transitions_from_status_id_fkey FOREIGN KEY (from_status_id) REFERENCES public.project_statuses(id) ON DELETE SET NULL,
  CONSTRAINT status_transitions_to_status_id_fkey FOREIGN KEY (to_status_id) REFERENCES public.project_statuses(id) ON DELETE SET NULL,
  CONSTRAINT status_transitions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_status_transitions_task ON public.status_transitions(task_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_status_transitions_to_category ON public.status_transitions(to_category, changed_at);

-- RLS
ALTER TABLE public.status_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transitions for tasks in their workspace projects"
  ON public.status_transitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE t.id = status_transitions.task_id
        AND wm.user_id = auth.uid()
    )
  );


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 3: BACKFILL custom_status_id FOR ORPHANED TASKS                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Any task with custom_status_id = NULL gets assigned its project's default status.
-- This ensures every task has a valid custom_status_id going forward.

UPDATE public.tasks t
SET custom_status_id = (
  SELECT ps.id FROM public.project_statuses ps
  WHERE ps.project_id = t.project_id AND ps.is_default = true
  LIMIT 1
)
WHERE t.custom_status_id IS NULL;

-- For any remaining NULLs (project has no default status), use the first status by position
UPDATE public.tasks t
SET custom_status_id = (
  SELECT ps.id FROM public.project_statuses ps
  WHERE ps.project_id = t.project_id
  ORDER BY ps.position ASC
  LIMIT 1
)
WHERE t.custom_status_id IS NULL;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 4: AUTO-SYNC TRIGGER (custom_status_id → status enum + completed) ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- When custom_status_id changes, automatically:
--   1. Derive tasks.status enum from the category
--   2. Set/clear completed_at
--   3. Record the status transition for analytics

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

  -- Fetch the new custom status details
  SELECT * INTO v_new_status FROM public.project_statuses WHERE id = NEW.custom_status_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Derive the enum status from category
  v_enum_status := CASE v_new_status.category
    WHEN 'backlog'   THEN 'todo'::task_status
    WHEN 'todo'      THEN 'todo'::task_status
    WHEN 'active'    THEN 'in_progress'::task_status
    WHEN 'done'      THEN 'done'::task_status
    WHEN 'cancelled' THEN 'done'::task_status
    ELSE 'todo'::task_status
  END;

  -- Sync the enum field
  NEW.status := v_enum_status;

  -- Sync completed_at
  IF v_new_status.category IN ('done', 'cancelled') THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;

  -- Sync first_started_at (set when first moving out of todo into active/done/cancelled)
  IF v_new_status.category NOT IN ('backlog', 'todo') AND NEW.first_started_at IS NULL THEN
    NEW.first_started_at := now();
  END IF;

  -- Record the status transition for analytics
  IF OLD.custom_status_id IS NOT NULL THEN
    SELECT * INTO v_old_status FROM public.project_statuses WHERE id = OLD.custom_status_id;
    -- Calculate time spent in previous status
    v_time_in_prev := EXTRACT(EPOCH FROM (now() - COALESCE(OLD.updated_at, OLD.created_at))) * 1000;
  END IF;

  INSERT INTO public.status_transitions (task_id, from_status_id, to_status_id, from_category, to_category, changed_by, time_in_previous_ms)
  VALUES (
    NEW.id,
    OLD.custom_status_id,
    NEW.custom_status_id,
    v_old_status.category,
    v_new_status.category,
    NEW.created_by,  -- best guess for who changed it; app should set updated_by
    COALESCE(v_time_in_prev, 0)
  );

  RETURN NEW;
END;
$$;

-- Attach trigger (BEFORE UPDATE so we can modify NEW)
DROP TRIGGER IF EXISTS trg_sync_task_status ON public.tasks;
CREATE TRIGGER trg_sync_task_status
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_status_from_custom();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 5: FIX TASK ACTIVITY TRIGGER (priority enum cast bug)             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- The old trigger used COALESCE(OLD.priority, 'None') which fails because
-- 'None' is not a valid task_priority enum value.
-- Also: now detects custom_status_id changes (not just status enum).

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
  -- Safe priority cast
  v_old_priority := CASE WHEN TG_OP IN ('UPDATE','DELETE') AND OLD.priority IS NOT NULL THEN OLD.priority::TEXT ELSE 'none' END;
  v_new_priority := CASE WHEN TG_OP IN ('INSERT','UPDATE') AND NEW.priority IS NOT NULL THEN NEW.priority::TEXT ELSE 'none' END;

  -- Get workspace_id
  SELECT p.workspace_id INTO v_workspace_id
  FROM public.projects p WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_description := 'Task "' || NEW.title || '" was created';

  ELSIF TG_OP = 'UPDATE' THEN
    -- Detect custom_status_id change (primary) or status enum change (fallback)
    IF OLD.custom_status_id IS DISTINCT FROM NEW.custom_status_id THEN
      -- Resolve status names for the description
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


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 6: REMOVE DUPLICATE task_sessions TABLE                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- task_sessions and task_work_sessions track the same thing.
-- task_work_sessions is the canonical table used by the timer system.
-- Migrate any data from task_sessions → task_work_sessions, then drop.

INSERT INTO public.task_work_sessions (task_id, user_id, started_at, ended_at, duration_seconds, created_at)
SELECT task_id, user_id, started_at, ended_at, duration_seconds, created_at
FROM public.task_sessions ts
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_work_sessions tws
  WHERE tws.task_id = ts.task_id
    AND tws.user_id = ts.user_id
    AND tws.started_at = ts.started_at
);

DROP TABLE IF EXISTS public.task_sessions;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PHASE 7: ADD MISSING INDEXES FOR PERFORMANCE                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Tasks: fast lookup by custom_status_id
CREATE INDEX IF NOT EXISTS idx_tasks_custom_status_id ON public.tasks(custom_status_id);

-- Tasks: fast lookup by project + status (for Kanban/List views)
CREATE INDEX IF NOT EXISTS idx_tasks_project_custom_status ON public.tasks(project_id, custom_status_id);

-- Tasks: fast lookup for "My Tasks" across all projects
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- Tasks: fast lookup by due_date for calendar/overdue queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;

-- Tasks: fast lookup for completed tasks
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON public.tasks(completed_at) WHERE completed_at IS NOT NULL;

-- Activity logs: fast lookup by workspace + time
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_time ON public.activity_logs(workspace_id, created_at DESC);

-- Notifications: fast unread count
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
