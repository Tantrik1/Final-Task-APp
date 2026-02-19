-- =============================================
-- FIX: Duplicate Triggers & Missing Activity Logs
-- =============================================
-- This migration:
-- 1. Drops OLD notification triggers that conflict with the activity system
-- 2. Adds missing activity logs (project statuses, description changes, comment replies/edits/deletes)
-- 3. Fixes the activity system's handle_task_activity to use create_notification properly
-- 4. Adds project_statuses activity trigger 
-- 5. Adds INSERT policy for activity_logs
-- =============================================


-- ══════════════════════════════════════════════
-- STEP 1: Drop OLD duplicate notification triggers
-- These triggers from migration 20260207070011 conflict with 20260213000000
-- ══════════════════════════════════════════════

-- Old task triggers (handled by on_task_activity now)
DROP TRIGGER IF EXISTS on_task_assigned ON public.tasks;
DROP TRIGGER IF EXISTS on_task_status_changed ON public.tasks;

-- Old comment trigger (handled by on_comment_activity now)
DROP TRIGGER IF EXISTS on_comment_added ON public.task_comments;

-- Old member trigger (handled by on_workspace_member_activity now)
DROP TRIGGER IF EXISTS on_member_joined ON public.workspace_members;

-- Also drop even older triggers from migration 20260206063550 if they somehow survived
DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON public.tasks;
DROP TRIGGER IF EXISTS trigger_notify_task_status_changed ON public.tasks;
DROP TRIGGER IF EXISTS trigger_notify_comment_added ON public.task_comments;
DROP TRIGGER IF EXISTS trigger_notify_member_joined ON public.workspace_members;


-- ══════════════════════════════════════════════
-- STEP 2: Ensure notification_type enum has all needed values
-- ══════════════════════════════════════════════

-- The activity system uses TEXT for notification type in inserts, 
-- but the original table uses the notification_type enum.
-- However, since the activity system creates notifications table with TEXT type (line 115 of 20260213),
-- and the original table uses enum, there may be a conflict.
-- The 20260213 migration uses CREATE TABLE IF NOT EXISTS, so the original enum-based table persists.
-- The activity system inserts text values like 'task_assigned', 'task_status_changed' etc.
-- which match the enum values, so this works fine.
-- But 'task_updated', 'workspace_invite_accepted', 'role_changed' are NOT in the original enum.

-- Add missing enum values if they don't exist
DO $$
BEGIN
    -- Check if the type column uses enum
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'type' 
        AND udt_name = 'notification_type'
    ) THEN
        -- Add missing enum values
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task_updated'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'workspace_invite_accepted'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'role_changed'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'subscription_expiring'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
    
    -- Same for entity_type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications'
        AND column_name = 'entity_type'
        AND udt_name = 'entity_type'
    ) THEN
        BEGIN ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'member'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'attachment'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'session'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
END $$;


-- ══════════════════════════════════════════════
-- STEP 3: Add INSERT policy for activity_logs (needed for direct inserts) 
-- ══════════════════════════════════════════════

DROP POLICY IF EXISTS "System and triggers can insert activity logs" ON public.activity_logs;
CREATE POLICY "System and triggers can insert activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (true);


-- ══════════════════════════════════════════════
-- STEP 4: Rewrite handle_task_activity with proper notifications
-- Fixes: description change, comment reply notifications, proper create_notification usage
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_task_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_workspace_id UUID;
    v_project_name TEXT;
BEGIN
    -- Get current user (actor)
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Get actor name
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name
    FROM public.profiles WHERE id = v_actor_id;

    -- ════════ INSERT ════════
    IF (TG_OP = 'INSERT') THEN
        SELECT workspace_id, name INTO v_workspace_id, v_project_name
        FROM public.projects WHERE id = NEW.project_id;

        PERFORM public.log_activity(
            v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
            'create', 'task', NEW.id,
            COALESCE(v_actor_name, 'Someone') || ' created task "' || NEW.title || '"',
            jsonb_build_object('title', NEW.title, 'project_name', v_project_name)
        );

        -- NOTIFICATION: Notify assignee on create
        IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_actor_id THEN
            PERFORM create_notification(
                v_workspace_id,
                NEW.assigned_to,
                v_actor_id,
                'task_assigned'::notification_type,
                'New task from ' || COALESCE(v_actor_name, 'a teammate'),
                NEW.title || CASE WHEN NEW.due_date IS NOT NULL THEN ' • Due ' || to_char(NEW.due_date, 'Mon DD') ELSE '' END,
                'task'::entity_type,
                NEW.id,
                jsonb_build_object('project_id', NEW.project_id, 'project_name', v_project_name, 'task_title', NEW.title)
            );
        END IF;

        RETURN NEW;

    -- ════════ UPDATE ════════
    ELSIF (TG_OP = 'UPDATE') THEN
        SELECT workspace_id, name INTO v_workspace_id, v_project_name
        FROM public.projects WHERE id = NEW.project_id;

        -- 1. Status Change (custom_status_id or status field)
        IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.custom_status_id IS DISTINCT FROM NEW.custom_status_id) THEN
            DECLARE
                v_old_status TEXT := OLD.status;
                v_new_status TEXT := NEW.status;
                v_is_completed BOOLEAN := false;
            BEGIN
                IF OLD.custom_status_id IS NOT NULL THEN
                    SELECT name INTO v_old_status FROM public.project_statuses WHERE id = OLD.custom_status_id;
                END IF;
                IF NEW.custom_status_id IS NOT NULL THEN
                    SELECT name, is_completed INTO v_new_status, v_is_completed FROM public.project_statuses WHERE id = NEW.custom_status_id;
                END IF;

                PERFORM public.log_activity(
                    v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                    'update', 'task', NEW.id,
                    COALESCE(v_actor_name, 'Someone') || ' updated task status from "' || COALESCE(v_old_status, 'Unknown') || '" to "' || COALESCE(v_new_status, 'Unknown') || '"',
                    jsonb_build_object('field', 'status', 'old_value', v_old_status, 'new_value', v_new_status)
                );

                -- Notify creator
                IF NEW.created_by IS NOT NULL AND NEW.created_by != v_actor_id THEN
                    PERFORM create_notification(
                        v_workspace_id, NEW.created_by, v_actor_id,
                        CASE WHEN v_is_completed THEN 'task_completed'::notification_type ELSE 'task_status_changed'::notification_type END,
                        CASE WHEN v_is_completed THEN '✅ Task completed' ELSE COALESCE(v_actor_name, 'Someone') || ' moved a task' END,
                        '"' || NEW.title || '" → ' || COALESCE(v_new_status, 'Unknown'),
                        'task'::entity_type, NEW.id,
                        jsonb_build_object('project_id', NEW.project_id, 'project_name', v_project_name, 'task_title', NEW.title, 'new_status', v_new_status)
                    );
                END IF;

                -- Notify assignee (if different from creator and actor)
                IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_actor_id AND (NEW.created_by IS NULL OR NEW.assigned_to != NEW.created_by) THEN
                    PERFORM create_notification(
                        v_workspace_id, NEW.assigned_to, v_actor_id,
                        CASE WHEN v_is_completed THEN 'task_completed'::notification_type ELSE 'task_status_changed'::notification_type END,
                        CASE WHEN v_is_completed THEN '✅ Task completed' ELSE COALESCE(v_actor_name, 'Someone') || ' moved a task' END,
                        '"' || NEW.title || '" → ' || COALESCE(v_new_status, 'Unknown'),
                        'task'::entity_type, NEW.id,
                        jsonb_build_object('project_id', NEW.project_id, 'project_name', v_project_name, 'task_title', NEW.title, 'new_status', v_new_status)
                    );
                END IF;
            END;
        END IF;

        -- 2. Priority Change
        IF (OLD.priority IS DISTINCT FROM NEW.priority) THEN
            PERFORM public.log_activity(
                v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                'update', 'task', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated task priority from "' || COALESCE(OLD.priority, 'None') || '" to "' || COALESCE(NEW.priority, 'None') || '"',
                jsonb_build_object('field', 'priority', 'old_value', OLD.priority, 'new_value', NEW.priority)
            );
        END IF;

        -- 3. Due Date Change
        IF (OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
            PERFORM public.log_activity(
                v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                'update', 'task', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated task due date' || 
                    CASE WHEN OLD.due_date IS NOT NULL THEN ' from ' || to_char(OLD.due_date, 'Mon DD') ELSE '' END ||
                    CASE WHEN NEW.due_date IS NOT NULL THEN ' to ' || to_char(NEW.due_date, 'Mon DD') ELSE ' (removed)' END,
                jsonb_build_object('field', 'due_date', 'old_value', OLD.due_date, 'new_value', NEW.due_date)
            );

            -- Notify assignee
            IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_actor_id THEN
                PERFORM create_notification(
                    v_workspace_id, NEW.assigned_to, v_actor_id,
                    'task_status_changed'::notification_type,
                    'Due date updated for "' || NEW.title || '"',
                    CASE WHEN NEW.due_date IS NOT NULL THEN 'New date: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'Due date removed' END,
                    'task'::entity_type, NEW.id,
                    jsonb_build_object('project_id', NEW.project_id, 'project_name', v_project_name)
                );
            END IF;
        END IF;

        -- 4. Title Change
        IF (OLD.title IS DISTINCT FROM NEW.title) THEN
            PERFORM public.log_activity(
                v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                'update', 'task', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated task title from "' || OLD.title || '" to "' || NEW.title || '"',
                jsonb_build_object('field', 'title', 'old_value', OLD.title, 'new_value', NEW.title)
            );
        END IF;

        -- 5. Description Change
        IF (OLD.description IS DISTINCT FROM NEW.description) THEN
            PERFORM public.log_activity(
                v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                'update', 'task', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated task description',
                jsonb_build_object('field', 'description')
            );
        END IF;

        -- 6. Assignee Change
        IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
            DECLARE
                v_old_assignee_name TEXT;
                v_new_assignee_name TEXT;
            BEGIN
                IF OLD.assigned_to IS NOT NULL THEN
                    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_old_assignee_name FROM public.profiles WHERE id = OLD.assigned_to;
                END IF;
                IF NEW.assigned_to IS NOT NULL THEN
                    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_new_assignee_name FROM public.profiles WHERE id = NEW.assigned_to;
                END IF;

                IF OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NOT NULL THEN
                    -- Reassignment
                    PERFORM public.log_activity(
                        v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                        'assign', 'task', NEW.id,
                        COALESCE(v_actor_name, 'Someone') || ' reassigned task from ' || COALESCE(v_old_assignee_name, 'someone') || ' to ' || COALESCE(v_new_assignee_name, 'someone'),
                        jsonb_build_object('field', 'assigned_to', 'old_value', OLD.assigned_to, 'new_value', NEW.assigned_to, 'old_name', v_old_assignee_name, 'new_name', v_new_assignee_name)
                    );
                ELSIF NEW.assigned_to IS NOT NULL THEN
                    -- New assignment
                    PERFORM public.log_activity(
                        v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                        'assign', 'task', NEW.id,
                        COALESCE(v_actor_name, 'Someone') || ' assigned task to ' || COALESCE(v_new_assignee_name, 'someone'),
                        jsonb_build_object('field', 'assigned_to', 'old_value', OLD.assigned_to, 'new_value', NEW.assigned_to)
                    );
                ELSE
                    -- Unassignment
                    PERFORM public.log_activity(
                        v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                        'unassign', 'task', NEW.id,
                        COALESCE(v_actor_name, 'Someone') || ' removed ' || COALESCE(v_old_assignee_name, 'someone') || ' from assignees',
                        jsonb_build_object('field', 'assigned_to', 'old_value', OLD.assigned_to, 'new_value', NULL)
                    );
                END IF;

                -- Notify NEW assignee
                IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_actor_id THEN
                    PERFORM create_notification(
                        v_workspace_id, NEW.assigned_to, v_actor_id,
                        'task_assigned'::notification_type,
                        'You were assigned to "' || NEW.title || '"',
                        'by ' || COALESCE(v_actor_name, 'someone') || ' in ' || COALESCE(v_project_name, 'a project'),
                        'task'::entity_type, NEW.id,
                        jsonb_build_object('project_id', NEW.project_id, 'project_name', v_project_name, 'task_title', NEW.title)
                    );
                END IF;
            END;
        END IF;

        -- 7. Task Movement (Project Change)
        IF (OLD.project_id IS DISTINCT FROM NEW.project_id) THEN
            DECLARE
                v_old_project_name TEXT;
            BEGIN
                SELECT name INTO v_old_project_name FROM public.projects WHERE id = OLD.project_id;
                PERFORM public.log_activity(
                    v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                    'move', 'task', NEW.id,
                    COALESCE(v_actor_name, 'Someone') || ' moved task from "' || COALESCE(v_old_project_name, 'Unknown') || '" to "' || COALESCE(v_project_name, 'Unknown') || '"',
                    jsonb_build_object('field', 'project_id', 'old_value', OLD.project_id, 'new_value', NEW.project_id)
                );
            END;
        END IF;

        RETURN NEW;

    -- ════════ DELETE ════════
    ELSIF (TG_OP = 'DELETE') THEN
        SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = OLD.project_id;

        PERFORM public.log_activity(
            v_workspace_id, OLD.project_id, NULL, v_actor_id,
            'delete', 'task', OLD.id,
            COALESCE(v_actor_name, 'Someone') || ' deleted task "' || OLD.title || '"',
            jsonb_build_object('title', OLD.title, 'project_id', OLD.project_id)
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;


-- ══════════════════════════════════════════════
-- STEP 5: Rewrite handle_comment_activity with reply support
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_comment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_task_title TEXT;
    v_project_id UUID;
    v_workspace_id UUID;
    v_task_assignee UUID;
    v_task_creator UUID;
    v_parent_author UUID;
    v_comment_preview TEXT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_actor_id := NEW.user_id;
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

        -- Get task info
        SELECT title, project_id, assigned_to, created_by INTO v_task_title, v_project_id, v_task_assignee, v_task_creator
        FROM public.tasks WHERE id = NEW.task_id;

        SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;

        v_comment_preview := CASE 
            WHEN length(NEW.content) > 50 THEN substring(NEW.content, 1, 50) || '...'
            ELSE NEW.content
        END;

        -- Is this a reply?
        IF NEW.parent_id IS NOT NULL THEN
            SELECT user_id INTO v_parent_author FROM public.task_comments WHERE id = NEW.parent_id;

            PERFORM public.log_activity(
                v_workspace_id, v_project_id, NEW.task_id, v_actor_id,
                'comment_reply', 'comment', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' replied to a comment on "' || v_task_title || '"',
                jsonb_build_object('content', v_comment_preview, 'parent_id', NEW.parent_id)
            );

            -- Notify parent comment author
            IF v_parent_author IS NOT NULL AND v_parent_author != v_actor_id THEN
                PERFORM create_notification(
                    v_workspace_id, v_parent_author, v_actor_id,
                    'comment_reply'::notification_type,
                    COALESCE(v_actor_name, 'Someone') || ' replied to your comment',
                    v_task_title || ': "' || v_comment_preview || '"',
                    'task'::entity_type, NEW.task_id,
                    jsonb_build_object('project_id', v_project_id, 'task_id', NEW.task_id, 'comment_id', NEW.id)
                );
            END IF;
        ELSE
            -- Top-level comment
            PERFORM public.log_activity(
                v_workspace_id, v_project_id, NEW.task_id, v_actor_id,
                'comment', 'comment', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' commented on "' || v_task_title || '"',
                jsonb_build_object('content', v_comment_preview)
            );
        END IF;

        -- Notify assignee (if not actor and not already notified as parent author)
        IF v_task_assignee IS NOT NULL AND v_task_assignee != v_actor_id AND (v_parent_author IS NULL OR v_task_assignee != v_parent_author) THEN
            PERFORM create_notification(
                v_workspace_id, v_task_assignee, v_actor_id,
                'comment_added'::notification_type,
                COALESCE(v_actor_name, 'Someone') || ' commented on "' || v_task_title || '"',
                v_comment_preview,
                'task'::entity_type, NEW.task_id,
                jsonb_build_object('project_id', v_project_id, 'task_id', NEW.task_id, 'comment_id', NEW.id)
            );
        END IF;

        -- Notify creator (if different from assignee, actor, and parent author)
        IF v_task_creator IS NOT NULL AND v_task_creator != v_actor_id 
            AND (v_task_assignee IS NULL OR v_task_creator != v_task_assignee) 
            AND (v_parent_author IS NULL OR v_task_creator != v_parent_author) THEN
            PERFORM create_notification(
                v_workspace_id, v_task_creator, v_actor_id,
                'comment_added'::notification_type,
                COALESCE(v_actor_name, 'Someone') || ' commented on "' || v_task_title || '"',
                v_comment_preview,
                'task'::entity_type, NEW.task_id,
                jsonb_build_object('project_id', v_project_id, 'task_id', NEW.task_id, 'comment_id', NEW.id)
            );
        END IF;

        RETURN NEW;

    -- Comment Updated (edit)
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.content IS DISTINCT FROM NEW.content) THEN
            v_actor_id := auth.uid();
            IF v_actor_id IS NULL THEN v_actor_id := NEW.user_id; END IF;
            SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
            SELECT title, project_id INTO v_task_title, v_project_id FROM public.tasks WHERE id = NEW.task_id;
            SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;

            PERFORM public.log_activity(
                v_workspace_id, v_project_id, NEW.task_id, v_actor_id,
                'edit_comment', 'comment', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' edited a comment on "' || v_task_title || '"',
                jsonb_build_object('content', substring(NEW.content, 1, 50))
            );
        END IF;
        RETURN NEW;

    -- Comment Deleted
    ELSIF (TG_OP = 'DELETE') THEN
        v_actor_id := auth.uid();
        IF v_actor_id IS NOT NULL THEN
            SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
        END IF;
        SELECT title, project_id INTO v_task_title, v_project_id FROM public.tasks WHERE id = OLD.task_id;
        SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;

        PERFORM public.log_activity(
            v_workspace_id, v_project_id, OLD.task_id, v_actor_id,
            'delete_comment', 'comment', OLD.id,
            COALESCE(v_actor_name, 'Someone') || ' deleted a comment on "' || v_task_title || '"',
            '{}'
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

-- Recreate comment trigger to handle INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS on_comment_activity ON public.task_comments;
CREATE TRIGGER on_comment_activity
AFTER INSERT OR UPDATE OR DELETE ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_activity();


-- ══════════════════════════════════════════════
-- STEP 6: Rewrite handle_workspace_member_activity with DELETE support
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_workspace_member_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_target_user_name TEXT;
    v_workspace_id UUID;
    v_workspace_name TEXT;
BEGIN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
    v_actor_id := auth.uid();

    SELECT name INTO v_workspace_name FROM public.workspaces WHERE id = v_workspace_id;
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
    END IF;

    -- INSERT (Member Joined)
    IF (TG_OP = 'INSERT') THEN
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_target_user_name FROM public.profiles WHERE id = NEW.user_id;

        PERFORM public.log_activity(
            v_workspace_id, NULL, NULL, NEW.user_id,
            'join', 'member', NEW.user_id,
            COALESCE(v_target_user_name, 'Someone') || ' joined the workspace',
            jsonb_build_object('role', NEW.role)
        );

        -- Notify all admins/owners
        DECLARE
            v_admin_id UUID;
        BEGIN
            FOR v_admin_id IN
                SELECT user_id FROM public.workspace_members
                WHERE workspace_id = v_workspace_id
                AND role IN ('owner', 'admin')
                AND user_id != NEW.user_id
            LOOP
                PERFORM create_notification(
                    v_workspace_id, v_admin_id, NEW.user_id,
                    'member_joined'::notification_type,
                    'New team member joined',
                    COALESCE(v_target_user_name, 'Someone') || ' joined ' || v_workspace_name,
                    'workspace'::entity_type, v_workspace_id,
                    jsonb_build_object('member_id', NEW.user_id, 'member_name', v_target_user_name, 'role', NEW.role)
                );
            END LOOP;
        END;

        RETURN NEW;

    -- UPDATE (Role Change)
    ELSIF (TG_OP = 'UPDATE') AND (OLD.role IS DISTINCT FROM NEW.role) THEN
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_target_user_name FROM public.profiles WHERE id = NEW.user_id;

        PERFORM public.log_activity(
            v_workspace_id, NULL, NULL, v_actor_id,
            'update_role', 'member', NEW.user_id,
            COALESCE(v_actor_name, 'Someone') || ' changed ' || COALESCE(v_target_user_name, 'user') || '''s role from ' || OLD.role || ' to ' || NEW.role,
            jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role, 'target_user', v_target_user_name)
        );

        -- Notify the user whose role changed
        PERFORM create_notification(
            v_workspace_id, NEW.user_id, v_actor_id,
            'role_changed'::notification_type,
            'Your role was updated',
            'You are now a ' || NEW.role || ' in ' || v_workspace_name,
            'workspace'::entity_type, v_workspace_id,
            jsonb_build_object('role', NEW.role, 'old_role', OLD.role)
        );

        RETURN NEW;

    -- DELETE (Member Removed)
    ELSIF (TG_OP = 'DELETE') THEN
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_target_user_name FROM public.profiles WHERE id = OLD.user_id;

        PERFORM public.log_activity(
            v_workspace_id, NULL, NULL, v_actor_id,
            'remove_member', 'member', OLD.user_id,
            COALESCE(v_actor_name, 'Someone') || ' removed ' || COALESCE(v_target_user_name, 'a member') || ' from the workspace',
            jsonb_build_object('member_name', v_target_user_name, 'role', OLD.role)
        );

        RETURN OLD;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate member trigger to also handle DELETE
DROP TRIGGER IF EXISTS on_workspace_member_activity ON public.workspace_members;
CREATE TRIGGER on_workspace_member_activity
AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_member_activity();


-- ══════════════════════════════════════════════
-- STEP 7: Add Project Statuses Activity Trigger (Workflow Changes)
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_project_status_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_workspace_id UUID;
    v_project_name TEXT;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    -- Get project info
    IF (TG_OP = 'DELETE') THEN
        SELECT workspace_id, name INTO v_workspace_id, v_project_name FROM public.projects WHERE id = OLD.project_id;
    ELSE
        SELECT workspace_id, name INTO v_workspace_id, v_project_name FROM public.projects WHERE id = NEW.project_id;
    END IF;

    -- INSERT (New status added)
    IF (TG_OP = 'INSERT') THEN
        -- Skip default statuses created during project creation
        -- (they are created by trigger, where auth.uid() might not be the actor)
        IF NEW.name NOT IN ('To Do', 'In Progress', 'Done') THEN
            PERFORM public.log_activity(
                v_workspace_id, NEW.project_id, NULL, v_actor_id,
                'add_status', 'project', NEW.project_id,
                COALESCE(v_actor_name, 'Someone') || ' added new status "' || NEW.name || '" to project "' || COALESCE(v_project_name, 'Unknown') || '"',
                jsonb_build_object('status_name', NEW.name, 'project_name', v_project_name)
            );
        END IF;
        RETURN NEW;

    -- UPDATE (Status renamed or reordered)
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.name IS DISTINCT FROM NEW.name) THEN
            PERFORM public.log_activity(
                v_workspace_id, NEW.project_id, NULL, v_actor_id,
                'rename_status', 'project', NEW.project_id,
                COALESCE(v_actor_name, 'Someone') || ' renamed status from "' || OLD.name || '" to "' || NEW.name || '" in project "' || COALESCE(v_project_name, 'Unknown') || '"',
                jsonb_build_object('old_name', OLD.name, 'new_name', NEW.name, 'project_name', v_project_name)
            );
        END IF;

        IF (OLD.position IS DISTINCT FROM NEW.position) THEN
            PERFORM public.log_activity(
                v_workspace_id, NEW.project_id, NULL, v_actor_id,
                'reorder_status', 'project', NEW.project_id,
                COALESCE(v_actor_name, 'Someone') || ' reordered project workflow in "' || COALESCE(v_project_name, 'Unknown') || '"',
                jsonb_build_object('status_name', NEW.name, 'old_position', OLD.position, 'new_position', NEW.position)
            );
        END IF;
        RETURN NEW;

    -- DELETE (Status removed)
    ELSIF (TG_OP = 'DELETE') THEN
        PERFORM public.log_activity(
            v_workspace_id, OLD.project_id, NULL, v_actor_id,
            'delete_status', 'project', OLD.project_id,
            COALESCE(v_actor_name, 'Someone') || ' deleted status "' || OLD.name || '" from project "' || COALESCE(v_project_name, 'Unknown') || '"',
            jsonb_build_object('status_name', OLD.name, 'project_name', v_project_name)
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_project_status_activity ON public.project_statuses;
CREATE TRIGGER on_project_status_activity
AFTER INSERT OR UPDATE OR DELETE ON public.project_statuses
FOR EACH ROW EXECUTE FUNCTION public.handle_project_status_activity();


-- ══════════════════════════════════════════════
-- STEP 8: Improve Workspace Activity (add description tracking)
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_workspace_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RETURN NEW; END IF;
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    IF (TG_OP = 'UPDATE') THEN
        -- Name change
        IF (OLD.name IS DISTINCT FROM NEW.name) THEN
            PERFORM public.log_activity(
                NEW.id, NULL, NULL, v_actor_id,
                'update', 'workspace', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated workspace name from "' || OLD.name || '" to "' || NEW.name || '"',
                jsonb_build_object('field', 'name', 'old_name', OLD.name, 'new_name', NEW.name)
            );
        END IF;

        -- Logo change
        IF (OLD.logo_url IS DISTINCT FROM NEW.logo_url) THEN
            PERFORM public.log_activity(
                NEW.id, NULL, NULL, v_actor_id,
                'update', 'workspace', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated workspace logo',
                jsonb_build_object('field', 'logo_url')
            );
        END IF;

        -- Description change
        IF (OLD.description IS DISTINCT FROM NEW.description) THEN
            PERFORM public.log_activity(
                NEW.id, NULL, NULL, v_actor_id,
                'update', 'workspace', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated workspace description',
                jsonb_build_object('field', 'description')
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════
-- STEP 9: Improve Project Activity (add DELETE support)
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    -- INSERT
    IF (TG_OP = 'INSERT') THEN
        PERFORM public.log_activity(
            NEW.workspace_id, NEW.id, NULL, v_actor_id,
            'create', 'project', NEW.id,
            COALESCE(v_actor_name, 'Someone') || ' created project "' || NEW.name || '"',
            jsonb_build_object('name', NEW.name)
        );

        -- Notify workspace owners/admins about new project
        DECLARE
            v_admin_id UUID;
        BEGIN
            FOR v_admin_id IN
                SELECT user_id FROM public.workspace_members
                WHERE workspace_id = NEW.workspace_id
                AND role IN ('owner', 'admin')
                AND user_id != v_actor_id
            LOOP
                PERFORM create_notification(
                    NEW.workspace_id, v_admin_id, v_actor_id,
                    'project_created'::notification_type,
                    'New project created',
                    COALESCE(v_actor_name, 'Someone') || ' created project "' || NEW.name || '"',
                    'project'::entity_type, NEW.id,
                    jsonb_build_object('project_name', NEW.name)
                );
            END LOOP;
        END;

        RETURN NEW;

    -- UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Rename
        IF (OLD.name IS DISTINCT FROM NEW.name) THEN
            PERFORM public.log_activity(
                NEW.workspace_id, NEW.id, NULL, v_actor_id,
                'rename', 'project', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' renamed project from "' || OLD.name || '" to "' || NEW.name || '"',
                jsonb_build_object('old_name', OLD.name, 'new_name', NEW.name)
            );
        END IF;

        -- Archive/Restore
        IF (OLD.is_archived IS DISTINCT FROM NEW.is_archived) THEN
            IF NEW.is_archived THEN
                PERFORM public.log_activity(
                    NEW.workspace_id, NEW.id, NULL, v_actor_id,
                    'archive', 'project', NEW.id,
                    COALESCE(v_actor_name, 'Someone') || ' archived project "' || NEW.name || '"',
                    '{}'
                );
            ELSE
                PERFORM public.log_activity(
                    NEW.workspace_id, NEW.id, NULL, v_actor_id,
                    'restore', 'project', NEW.id,
                    COALESCE(v_actor_name, 'Someone') || ' restored project "' || NEW.name || '"',
                    '{}'
                );
            END IF;
        END IF;

        -- Color change
        IF (OLD.color IS DISTINCT FROM NEW.color) THEN
            PERFORM public.log_activity(
                NEW.workspace_id, NEW.id, NULL, v_actor_id,
                'update', 'project', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated project "' || NEW.name || '" color',
                jsonb_build_object('field', 'color')
            );
        END IF;

        RETURN NEW;

    -- DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        PERFORM public.log_activity(
            OLD.workspace_id, NULL, NULL, v_actor_id,
            'delete', 'project', OLD.id,
            COALESCE(v_actor_name, 'Someone') || ' deleted project "' || OLD.name || '"',
            jsonb_build_object('name', OLD.name)
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

-- Recreate project trigger to also handle DELETE
DROP TRIGGER IF EXISTS on_project_activity ON public.projects;
CREATE TRIGGER on_project_activity
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.handle_project_activity();


-- ══════════════════════════════════════════════
-- STEP 10: Update create_notification to handle new types
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_notification(
  p_workspace_id uuid, 
  p_user_id uuid, 
  p_actor_id uuid, 
  p_type notification_type, 
  p_title text, 
  p_body text, 
  p_entity_type entity_type, 
  p_entity_id uuid, 
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification_id UUID;
  v_pref_column TEXT;
BEGIN
  -- Map notification type to preference column
  v_pref_column := CASE p_type
    WHEN 'task_assigned' THEN 'task_assigned'
    WHEN 'task_status_changed' THEN 'task_status_changed'
    WHEN 'task_completed' THEN 'task_completed'
    WHEN 'task_updated' THEN 'task_status_changed' -- Falls under task status changes
    WHEN 'comment_added' THEN 'comment_added'
    WHEN 'comment_reply' THEN 'comment_reply'
    WHEN 'project_created' THEN 'project_updates'
    WHEN 'project_updated' THEN 'project_updates'
    WHEN 'member_joined' THEN 'member_updates'
    WHEN 'member_invited' THEN 'member_updates'
    WHEN 'role_changed' THEN 'member_updates'
    WHEN 'workspace_invite_accepted' THEN 'member_updates'
    WHEN 'chat_mention' THEN 'chat_mentions'
    WHEN 'due_date_reminder' THEN 'due_date_reminders'
    WHEN 'subscription_expiring' THEN 'task_assigned' -- Always send subscription alerts
    ELSE 'task_assigned'
  END;
  
  -- Check if user wants this notification
  IF NOT should_notify(p_user_id, p_workspace_id, v_pref_column) THEN
    RETURN NULL;
  END IF;
  
  -- Don't notify the actor about their own action (skip for system notifications where actor is NULL)
  IF p_actor_id IS NOT NULL AND p_user_id = p_actor_id THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO public.notifications (
    workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata
  ) VALUES (
    p_workspace_id, p_user_id, p_actor_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_metadata
  ) RETURNING id INTO v_notification_id;
  
  -- Log the creation event
  PERFORM log_notification_event(v_notification_id, 'created', jsonb_build_object(
    'type', p_type,
    'title', p_title,
    'workspace_id', p_workspace_id
  ));
  
  RETURN v_notification_id;
END;
$function$;
