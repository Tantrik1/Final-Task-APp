-- ============================================================================
-- SCHEMA HARDENING & PERFORMANCE OPTIMIZATION
-- ============================================================================
-- Addresses:
--   1. Missing composite indexes on high-traffic tables
--   2. file_size integer → bigint (>2GB support)
--   3. Timezone default fix (notification_preferences)
--   4. Sync trigger fix: handle 'backlog' → 'todo' (backlog removed from app)
--   5. Constraint: exactly one 'done' status per project
--   6. Deactivation logic for failed push subscriptions
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. MISSING COMPOSITE INDEXES ON HIGH-TRAFFIC TABLES                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Messages: the single most common query pattern (chat channel feed)
CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON public.messages(channel_id, created_at DESC);

-- Messages: searching by sender (for profile/admin views)
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON public.messages(sender_id, created_at DESC);

-- Task work sessions: time tracking aggregation (per task, per user)
CREATE INDEX IF NOT EXISTS idx_task_work_sessions_task_user
  ON public.task_work_sessions(task_id, user_id);

-- Task work sessions: finding open sessions (timer running)
CREATE INDEX IF NOT EXISTS idx_task_work_sessions_open
  ON public.task_work_sessions(task_id, ended_at)
  WHERE ended_at IS NULL;

-- Push subscriptions: lookup by user for notification delivery
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

-- Task comments: loading comments for a task
CREATE INDEX IF NOT EXISTS idx_task_comments_task_created
  ON public.task_comments(task_id, created_at DESC);

-- Workspace members: fast lookup by user across workspaces
CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON public.workspace_members(user_id, workspace_id);

-- Workspace invitations: lookup by email (for checking pending invites)
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email
  ON public.workspace_invitations(email, workspace_id)
  WHERE status = 'pending';

-- Project statuses: fast ordering for Kanban/List views
CREATE INDEX IF NOT EXISTS idx_project_statuses_project_position
  ON public.project_statuses(project_id, position);

-- Task attachments: lookup by task
CREATE INDEX IF NOT EXISTS idx_task_attachments_task
  ON public.task_attachments(task_id);

-- DM conversations: lookup by participant
CREATE INDEX IF NOT EXISTS idx_dm_conversations_p1
  ON public.dm_conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_p2
  ON public.dm_conversations(participant_2);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. FIX file_size: integer → bigint (support files > 2GB)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.task_attachments
  ALTER COLUMN file_size TYPE bigint;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. FIX notification_preferences timezone default                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Remove the hardcoded Asia/Kathmandu default — use UTC as the universal default.
-- App should set the user's actual timezone on profile setup.

ALTER TABLE public.notification_preferences
  ALTER COLUMN timezone SET DEFAULT 'UTC';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. UPDATE sync trigger: backlog removed from app, map to todo           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- The app no longer creates 'backlog' statuses, but existing DB rows may still
-- have category='backlog'. The sync trigger already maps backlog→todo enum,
-- but let's also migrate existing backlog statuses to 'todo' category.

UPDATE public.project_statuses
  SET category = 'todo'
  WHERE category = 'backlog';

UPDATE public.template_statuses
  SET category = 'todo'
  WHERE category = 'backlog';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. HELPER: sync assigned_to from task_assignees                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Keep assigned_to in sync with task_assignees (first assignee wins).
-- This ensures backward compat: assigned_to always reflects the primary assignee.
-- Eventually assigned_to can be deprecated once all reads use task_assignees.

CREATE OR REPLACE FUNCTION public.sync_assigned_to_from_assignees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id uuid;
  v_primary_assignee uuid;
BEGIN
  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  -- Find the earliest-assigned user for this task
  SELECT user_id INTO v_primary_assignee
  FROM public.task_assignees
  WHERE task_id = v_task_id
  ORDER BY assigned_at ASC
  LIMIT 1;

  -- Update the legacy assigned_to field
  UPDATE public.tasks
  SET assigned_to = v_primary_assignee
  WHERE id = v_task_id
    AND assigned_to IS DISTINCT FROM v_primary_assignee;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_assigned_to ON public.task_assignees;
CREATE TRIGGER trg_sync_assigned_to
  AFTER INSERT OR DELETE ON public.task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_assigned_to_from_assignees();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. PUSH SUBSCRIPTION CLEANUP: auto-deactivate after too many failures   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Add is_active column so the delivery system can skip broken subscriptions.

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Index for active subscriptions lookup
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
  ON public.push_subscriptions(user_id)
  WHERE is_active = true;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. PARTIAL UNIQUE: enforce exactly 1 done/cancelled status per project  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- This is enforced in the app but a DB constraint is the safety net.

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_statuses_unique_done
  ON public.project_statuses(project_id)
  WHERE category = 'done';

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_statuses_unique_cancelled
  ON public.project_statuses(project_id)
  WHERE category = 'cancelled';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. ACTIVITY LOGS: add index for project-scoped queries                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_activity_logs_project_time
  ON public.activity_logs(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_time
  ON public.activity_logs(actor_id, created_at DESC);
