-- ============================================================================
-- DEEP SCHEMA FIXES — Cascades, Unique Constraints, FK Corrections
-- ============================================================================
-- Addresses:
--   1. ON DELETE CASCADE for all parent→child FK relationships
--   2. Missing UNIQUE constraints (prevent duplicate rows, enable upserts)
--   3. Fix status_transitions FK cascades
--   4. Fix ai_messages.timestamp → NOT NULL
--   5. Ensure sync trigger fires on INSERT too (not just UPDATE)
--   6. DM conversation dedup constraint
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. ON DELETE CASCADE — Tasks and their children                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- When a task is deleted, all child rows must be cleaned up automatically.

-- task_comments → tasks
ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_task_id_fkey;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- task_comments self-ref (parent_id) → SET NULL on parent delete
ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_parent_id_fkey;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES public.task_comments(id) ON DELETE SET NULL;

-- task_attachments → tasks
ALTER TABLE public.task_attachments DROP CONSTRAINT IF EXISTS task_attachments_task_id_fkey;
ALTER TABLE public.task_attachments ADD CONSTRAINT task_attachments_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- task_work_sessions → tasks
ALTER TABLE public.task_work_sessions DROP CONSTRAINT IF EXISTS task_work_sessions_task_id_fkey;
ALTER TABLE public.task_work_sessions ADD CONSTRAINT task_work_sessions_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- task_assignees → tasks
ALTER TABLE public.task_assignees DROP CONSTRAINT IF EXISTS task_assignees_task_id_fkey;
ALTER TABLE public.task_assignees ADD CONSTRAINT task_assignees_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- task_links → tasks
ALTER TABLE public.task_links DROP CONSTRAINT IF EXISTS task_links_task_id_fkey;
ALTER TABLE public.task_links ADD CONSTRAINT task_links_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- task_custom_field_values → tasks
ALTER TABLE public.task_custom_field_values DROP CONSTRAINT IF EXISTS task_custom_field_values_task_id_fkey;
ALTER TABLE public.task_custom_field_values ADD CONSTRAINT task_custom_field_values_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- task_custom_field_values → field definitions
ALTER TABLE public.task_custom_field_values DROP CONSTRAINT IF EXISTS task_custom_field_values_field_id_fkey;
ALTER TABLE public.task_custom_field_values ADD CONSTRAINT task_custom_field_values_field_id_fkey
  FOREIGN KEY (field_id) REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE;

-- status_transitions → tasks
ALTER TABLE public.status_transitions DROP CONSTRAINT IF EXISTS status_transitions_task_id_fkey;
ALTER TABLE public.status_transitions ADD CONSTRAINT status_transitions_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- status_transitions → project_statuses (SET NULL — preserve history even if status deleted)
ALTER TABLE public.status_transitions DROP CONSTRAINT IF EXISTS status_transitions_from_status_id_fkey;
ALTER TABLE public.status_transitions ADD CONSTRAINT status_transitions_from_status_id_fkey
  FOREIGN KEY (from_status_id) REFERENCES public.project_statuses(id) ON DELETE SET NULL;

ALTER TABLE public.status_transitions DROP CONSTRAINT IF EXISTS status_transitions_to_status_id_fkey;
ALTER TABLE public.status_transitions ADD CONSTRAINT status_transitions_to_status_id_fkey
  FOREIGN KEY (to_status_id) REFERENCES public.project_statuses(id) ON DELETE SET NULL;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. ON DELETE CASCADE — Projects and their children                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- tasks → projects (cascade: deleting project deletes all tasks)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- project_statuses → projects
ALTER TABLE public.project_statuses DROP CONSTRAINT IF EXISTS project_statuses_project_id_fkey;
ALTER TABLE public.project_statuses ADD CONSTRAINT project_statuses_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- project_views → projects
ALTER TABLE public.project_views DROP CONSTRAINT IF EXISTS project_views_project_id_fkey;
ALTER TABLE public.project_views ADD CONSTRAINT project_views_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- custom_field_definitions → projects
ALTER TABLE public.custom_field_definitions DROP CONSTRAINT IF EXISTS custom_field_definitions_project_id_fkey;
ALTER TABLE public.custom_field_definitions ADD CONSTRAINT custom_field_definitions_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- activity_logs → projects (SET NULL — preserve logs after project deletion)
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_project_id_fkey;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- activity_logs → tasks (SET NULL — preserve logs after task deletion)
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_task_id_fkey;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. ON DELETE CASCADE — Channels / DMs                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- messages → channels
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_channel_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;

-- messages self-ref (reply_to) → SET NULL
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_reply_to_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_reply_to_id_fkey
  FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL;

-- channel_members → channels
ALTER TABLE public.channel_members DROP CONSTRAINT IF EXISTS channel_members_channel_id_fkey;
ALTER TABLE public.channel_members ADD CONSTRAINT channel_members_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;

-- channel_read_status → channels
ALTER TABLE public.channel_read_status DROP CONSTRAINT IF EXISTS channel_read_status_channel_id_fkey;
ALTER TABLE public.channel_read_status ADD CONSTRAINT channel_read_status_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;

-- dm_messages → dm_conversations
ALTER TABLE public.dm_messages DROP CONSTRAINT IF EXISTS dm_messages_conversation_id_fkey;
ALTER TABLE public.dm_messages ADD CONSTRAINT dm_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id) ON DELETE CASCADE;

-- dm_read_status → dm_conversations
ALTER TABLE public.dm_read_status DROP CONSTRAINT IF EXISTS dm_read_status_conversation_id_fkey;
ALTER TABLE public.dm_read_status ADD CONSTRAINT dm_read_status_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.dm_conversations(id) ON DELETE CASCADE;

-- channels → workspaces
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_workspace_id_fkey;
ALTER TABLE public.channels ADD CONSTRAINT channels_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- dm_conversations → workspaces
ALTER TABLE public.dm_conversations DROP CONSTRAINT IF EXISTS dm_conversations_workspace_id_fkey;
ALTER TABLE public.dm_conversations ADD CONSTRAINT dm_conversations_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. ON DELETE CASCADE — Workspace children                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- projects → workspaces
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_workspace_id_fkey;
ALTER TABLE public.projects ADD CONSTRAINT projects_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- workspace_members → workspaces
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_workspace_id_fkey;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- workspace_invitations → workspaces
ALTER TABLE public.workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_workspace_id_fkey;
ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- workspace_subscriptions → workspaces
ALTER TABLE public.workspace_subscriptions DROP CONSTRAINT IF EXISTS workspace_subscriptions_workspace_id_fkey;
ALTER TABLE public.workspace_subscriptions ADD CONSTRAINT workspace_subscriptions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- notifications → workspaces
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_workspace_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- notification_preferences → workspaces
ALTER TABLE public.notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_workspace_id_fkey;
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- activity_logs → workspaces
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_workspace_id_fkey;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ai_conversations → workspaces
ALTER TABLE public.ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_workspace_id_fkey;
ALTER TABLE public.ai_conversations ADD CONSTRAINT ai_conversations_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ai_messages → ai_conversations
ALTER TABLE public.ai_messages DROP CONSTRAINT IF EXISTS ai_messages_conversation_id_fkey;
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;

-- payment_history → workspaces
ALTER TABLE public.payment_history DROP CONSTRAINT IF EXISTS payment_history_workspace_id_fkey;
ALTER TABLE public.payment_history ADD CONSTRAINT payment_history_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- payment_submissions → workspaces
ALTER TABLE public.payment_submissions DROP CONSTRAINT IF EXISTS payment_submissions_workspace_id_fkey;
ALTER TABLE public.payment_submissions ADD CONSTRAINT payment_submissions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- project_templates → workspaces
ALTER TABLE public.project_templates DROP CONSTRAINT IF EXISTS project_templates_workspace_id_fkey;
ALTER TABLE public.project_templates ADD CONSTRAINT project_templates_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- template_statuses → project_templates
ALTER TABLE public.template_statuses DROP CONSTRAINT IF EXISTS template_statuses_template_id_fkey;
ALTER TABLE public.template_statuses ADD CONSTRAINT template_statuses_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE CASCADE;

-- template_tasks → project_templates
ALTER TABLE public.template_tasks DROP CONSTRAINT IF EXISTS template_tasks_template_id_fkey;
ALTER TABLE public.template_tasks ADD CONSTRAINT template_tasks_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE CASCADE;

-- template_views → project_templates
ALTER TABLE public.template_views DROP CONSTRAINT IF EXISTS template_views_template_id_fkey;
ALTER TABLE public.template_views ADD CONSTRAINT template_views_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE CASCADE;

-- template_custom_fields → project_templates
ALTER TABLE public.template_custom_fields DROP CONSTRAINT IF EXISTS template_custom_fields_template_id_fkey;
ALTER TABLE public.template_custom_fields ADD CONSTRAINT template_custom_fields_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE CASCADE;

-- notification_logs → notifications
ALTER TABLE public.notification_logs DROP CONSTRAINT IF EXISTS notification_logs_notification_id_fkey;
ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_notification_id_fkey
  FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. UNIQUE CONSTRAINTS — Prevent duplicate rows, enable upserts          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Channel members: one membership per user per channel
-- First, remove any duplicates
DELETE FROM public.channel_members a USING public.channel_members b
WHERE a.id > b.id AND a.channel_id = b.channel_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_members_unique
  ON public.channel_members(channel_id, user_id);

-- Channel read status: one read status per user per channel (required for upsert to work)
DELETE FROM public.channel_read_status a USING public.channel_read_status b
WHERE a.id > b.id AND a.channel_id = b.channel_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_read_status_unique
  ON public.channel_read_status(channel_id, user_id);

-- DM read status: one per user per conversation
DELETE FROM public.dm_read_status a USING public.dm_read_status b
WHERE a.id > b.id AND a.conversation_id = b.conversation_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_read_status_unique
  ON public.dm_read_status(conversation_id, user_id);

-- Task assignees: one assignment per user per task
DELETE FROM public.task_assignees a USING public.task_assignees b
WHERE a.id > b.id AND a.task_id = b.task_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_assignees_unique
  ON public.task_assignees(task_id, user_id);

-- Workspace members: one membership per user per workspace
DELETE FROM public.workspace_members a USING public.workspace_members b
WHERE a.id > b.id AND a.workspace_id = b.workspace_id AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_unique
  ON public.workspace_members(workspace_id, user_id);

-- Notification preferences: one per user per workspace
DELETE FROM public.notification_preferences a USING public.notification_preferences b
WHERE a.id > b.id AND a.user_id = b.user_id AND a.workspace_id = b.workspace_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_unique
  ON public.notification_preferences(user_id, workspace_id);

-- Push subscriptions: one per user per endpoint (required for upsert in usePushNotifications.ts)
DELETE FROM public.push_subscriptions a USING public.push_subscriptions b
WHERE a.id > b.id AND a.user_id = b.user_id AND a.endpoint = b.endpoint;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_endpoint
  ON public.push_subscriptions(user_id, endpoint);

-- DM conversations: prevent duplicate A↔B conversations
-- Normalize: smaller UUID first
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_conversations_pair
  ON public.dm_conversations(workspace_id, LEAST(participant_1, participant_2), GREATEST(participant_1, participant_2));


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. FIX ai_messages.timestamp → NOT NULL                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

UPDATE public.ai_messages SET "timestamp" = now() WHERE "timestamp" IS NULL;
ALTER TABLE public.ai_messages ALTER COLUMN "timestamp" SET NOT NULL;
ALTER TABLE public.ai_messages ALTER COLUMN "timestamp" SET DEFAULT now();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Extend sync trigger to also fire on INSERT (not just UPDATE)         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Currently the trigger is BEFORE UPDATE only. On INSERT, the app must
-- manually set the status enum. This trigger will auto-derive it on INSERT too.

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

  -- Derive enum status from category
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
