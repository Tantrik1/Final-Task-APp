-- =============================================
-- Activity Log & Notification System Expansion
-- =============================================

-- 0. Ensure Missing Tables Exist (Attachments, Links, Sessions)
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_work_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for new tables
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_work_sessions ENABLE ROW LEVEL SECURITY;

-- Policies (simplify for now: workspace members can view/edit)
DROP POLICY IF EXISTS "Workspace members can view attachments" ON public.task_attachments;
CREATE POLICY "Workspace members can view attachments" ON public.task_attachments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Workspace members can upload attachments" ON public.task_attachments;
CREATE POLICY "Workspace members can upload attachments" ON public.task_attachments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Workspace members can delete attachments" ON public.task_attachments;
CREATE POLICY "Workspace members can delete attachments" ON public.task_attachments FOR DELETE USING (true);


DROP POLICY IF EXISTS "Workspace members can view links" ON public.task_links;
CREATE POLICY "Workspace members can view links" ON public.task_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Workspace members can add links" ON public.task_links;
CREATE POLICY "Workspace members can add links" ON public.task_links FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Workspace members can delete links" ON public.task_links;
CREATE POLICY "Workspace members can delete links" ON public.task_links FOR DELETE USING (true);


DROP POLICY IF EXISTS "Workspace members can view sessions" ON public.task_work_sessions;
CREATE POLICY "Workspace members can view sessions" ON public.task_work_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.task_work_sessions;
CREATE POLICY "Users can manage their own sessions" ON public.task_work_sessions FOR ALL USING (auth.uid() = user_id);


-- 1. Create activity_logs table (Global Audit)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- create, update, delete, archive, restore, upload, etc.
    entity_type TEXT NOT NULL, -- task, project, workspace, member, comment, etc.
    entity_id UUID NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_id ON public.activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON public.activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON public.activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view logs for their workspaces
DROP POLICY IF EXISTS "Users can view workspace activity logs" ON public.activity_logs;
CREATE POLICY "Users can view workspace activity logs"
ON public.activity_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = activity_logs.workspace_id
    AND wm.user_id = auth.uid()
  )
);

-- 2. Enhanced Notifications Table (User Request Structure)
-- Note: Dropping existing to ensure schema match if needed, or using IF NOT EXISTS
-- In a real prod env, we'd alter. For this task, we assume we can create/ensure it exists.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid not null default gen_random_uuid (),
  workspace_id uuid not null,
  user_id uuid not null,
  actor_id uuid null,
  type text not null, -- Changed to text to avoid enum strictness issues during dev, or use specific enum
  title text not null,
  body text not null,
  entity_type text not null, -- Changed to text
  entity_id uuid not null,
  metadata jsonb null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  pushed boolean null default false,
  pushed_at timestamp with time zone null,
  constraint notifications_pkey primary key (id),
  constraint notifications_actor_id_fkey foreign KEY (actor_id) references profiles (id) on delete set null,
  constraint notifications_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint notifications_workspace_id_fkey foreign KEY (workspace_id) references workspaces (id) on delete CASCADE
);

-- Indexes for notifications
create index IF not exists idx_notifications_user_id on public.notifications using btree (user_id);
create index IF not exists idx_notifications_workspace_id on public.notifications using btree (workspace_id);
create index IF not exists idx_notifications_created_at on public.notifications using btree (created_at desc);
create index IF not exists idx_notifications_is_read on public.notifications using btree (is_read);
create index IF not exists idx_notifications_not_pushed on public.notifications using btree (user_id, pushed, created_at) where (pushed = false);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);


-- 3. Helper Function: log_activity
CREATE OR REPLACE FUNCTION public.log_activity(
    p_workspace_id UUID,
    p_project_id UUID,
    p_task_id UUID,
    p_actor_id UUID,
    p_action_type TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_description TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.activity_logs (
        workspace_id, project_id, task_id, actor_id,
        action_type, entity_type, entity_id, description, metadata
    ) VALUES (
        p_workspace_id, p_project_id, p_task_id, p_actor_id,
        p_action_type, p_entity_type, p_entity_id, p_description, p_metadata
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


-- 4. Triggers for TASKS
CREATE OR REPLACE FUNCTION public.handle_task_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_workspace_id UUID;
    v_project_name TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
    v_changes JSONB;
BEGIN
    -- Get current user (actor)
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        -- Fallback for system actions if needed, or return
        RETURN NEW;
    END IF;

    -- Get actor name
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name
    FROM public.profiles WHERE id = v_actor_id;

    -- INSERT
    IF (TG_OP = 'INSERT') THEN
         -- Get workspace info
        SELECT workspace_id, name INTO v_workspace_id, v_project_name
        FROM public.projects WHERE id = NEW.project_id;

        PERFORM public.log_activity(
            v_workspace_id,
            NEW.project_id,
            NEW.id,
            v_actor_id,
            'create',
            'task',
            NEW.id,
            COALESCE(v_actor_name, 'Someone') || ' created task "' || NEW.title || '"',
            jsonb_build_object('title', NEW.title)
        );

        -- NOTIFICATION: Notify assignee
        IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_actor_id THEN
             INSERT INTO public.notifications (workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
             VALUES (
                v_workspace_id,
                NEW.assigned_to,
                v_actor_id,
                'task_assigned',
                'You were assigned to "' || NEW.title || '"',
                'in ' || v_project_name,
                'task',
                NEW.id,
                jsonb_build_object('project_id', NEW.project_id)
             );
        END IF;

        RETURN NEW;

    -- UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        SELECT workspace_id, name INTO v_workspace_id, v_project_name
        FROM public.projects WHERE id = NEW.project_id;

        -- 1. Status Change
        IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.custom_status_id IS DISTINCT FROM NEW.custom_status_id) THEN
            -- Get status names if custom_status_id is used
             DECLARE
                v_old_status TEXT := OLD.status;
                v_new_status TEXT := NEW.status;
            BEGIN
                IF OLD.custom_status_id IS NOT NULL THEN
                    SELECT name INTO v_old_status FROM public.project_statuses WHERE id = OLD.custom_status_id;
                END IF;
                IF NEW.custom_status_id IS NOT NULL THEN
                    SELECT name INTO v_new_status FROM public.project_statuses WHERE id = NEW.custom_status_id;
                END IF;
                
                 PERFORM public.log_activity(
                    v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                    'update', 'task', NEW.id,
                    COALESCE(v_actor_name, 'Someone') || ' updated task status from "' || COALESCE(v_old_status, 'Unknown') || '" to "' || COALESCE(v_new_status, 'Unknown') || '"',
                    jsonb_build_object('field', 'status', 'old_value', v_old_status, 'new_value', v_new_status)
                );

                -- NOTIFICATION: Assignee & Creator
                -- Notify Assignee
                IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_actor_id THEN
                    INSERT INTO public.notifications (workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
                    VALUES (v_workspace_id, NEW.assigned_to, v_actor_id, 'task_status_changed', 'Task "' || NEW.title || '" moved to ' || v_new_status, 'by ' || v_actor_name, 'task', NEW.id, jsonb_build_object('project_id', NEW.project_id));
                END IF;
            END;
        END IF;

        -- 2. Priority Change
        IF (OLD.priority IS DISTINCT FROM NEW.priority) THEN
            PERFORM public.log_activity(
                v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                'update', 'task', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated task priority from "' || OLD.priority || '" to "' || NEW.priority || '"',
                jsonb_build_object('field', 'priority', 'old_value', OLD.priority, 'new_value', NEW.priority)
            );
        END IF;

        -- 3. Due Date Change
        IF (OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
             PERFORM public.log_activity(
                v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                'update', 'task', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated task due date to ' || COALESCE(NEW.due_date::text, 'No Date'),
                jsonb_build_object('field', 'due_date', 'old_value', OLD.due_date, 'new_value', NEW.due_date)
            );
             -- Notify Assignee
            IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_actor_id THEN
                INSERT INTO public.notifications (workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
                VALUES (v_workspace_id, NEW.assigned_to, v_actor_id, 'task_updated', 'Due date updated for "' || NEW.title || '"', 'New date: ' || NEW.due_date, 'task', NEW.id, jsonb_build_object('project_id', NEW.project_id));
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

        -- 5. Assignee Change
        IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
            DECLARE
                v_old_assignee_name TEXT;
                v_new_assignee_name TEXT;
            BEGIN
                IF OLD.assigned_to IS NOT NULL THEN
                    SELECT full_name INTO v_old_assignee_name FROM public.profiles WHERE id = OLD.assigned_to;
                END IF;
                IF NEW.assigned_to IS NOT NULL THEN
                     SELECT full_name INTO v_new_assignee_name FROM public.profiles WHERE id = NEW.assigned_to;
                END IF;

                IF NEW.assigned_to IS NOT NULL THEN
                    PERFORM public.log_activity(
                        v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                        'assign', 'task', NEW.id,
                        COALESCE(v_actor_name, 'Someone') || ' assigned task to ' || COALESCE(v_new_assignee_name, 'someone'),
                        jsonb_build_object('field', 'assigned_to', 'old_value', OLD.assigned_to, 'new_value', NEW.assigned_to)
                    );
                     -- Notify New Assignee
                     IF NEW.assigned_to != v_actor_id THEN
                        INSERT INTO public.notifications (workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
                        VALUES (v_workspace_id, NEW.assigned_to, v_actor_id, 'task_assigned', 'You were assigned to "' || NEW.title || '"', 'by ' || v_actor_name, 'task', NEW.id, jsonb_build_object('project_id', NEW.project_id));
                     END IF;
                ELSE
                    PERFORM public.log_activity(
                        v_workspace_id, NEW.project_id, NEW.id, v_actor_id,
                        'unassign', 'task', NEW.id,
                        COALESCE(v_actor_name, 'Someone') || ' removed ' || COALESCE(v_old_assignee_name, 'someone') || ' from assignees',
                        jsonb_build_object('field', 'assigned_to', 'old_value', OLD.assigned_to, 'new_value', NULL)
                    );
                END IF;
            END;
        END IF;

         -- 6. Task Movement (Project Change)
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

    -- DELETE
    ELSIF (TG_OP = 'DELETE') THEN
         -- Fetch workspace_id
         SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = OLD.project_id;

         PERFORM public.log_activity(
            v_workspace_id,
            OLD.project_id,
            NULL, -- task_id is gone
            v_actor_id,
            'delete',
            'task',
            OLD.id,
            COALESCE(v_actor_name, 'Someone') || ' deleted task "' || OLD.title || '"',
            jsonb_build_object('title', OLD.title, 'project_id', OLD.project_id)
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_task_activity ON public.tasks;
CREATE TRIGGER on_task_activity
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.handle_task_activity();


-- 5. Trigger for COMMENTS
CREATE OR REPLACE FUNCTION public.handle_comment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_task_title TEXT;
    v_project_id UUID;
    v_workspace_id UUID;
    v_task_assignee UUID;
    v_task_creator UUID;
BEGIN
    v_actor_id := NEW.user_id;
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
    
    -- Get task info
    SELECT title, project_id, assigned_to, created_by INTO v_task_title, v_project_id, v_task_assignee, v_task_creator
    FROM public.tasks WHERE id = NEW.task_id;
    
    -- Get workspace info
    SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;

    -- Log Activity
    PERFORM public.log_activity(
        v_workspace_id, v_project_id, NEW.task_id, v_actor_id,
        'comment', 'comment', NEW.id,
        COALESCE(v_actor_name, 'Someone') || ' commented on the task',
        jsonb_build_object('content', substring(NEW.content, 1, 50))
    );

    -- Notifications
    -- Notify Assignee (if not actor)
    IF v_task_assignee IS NOT NULL AND v_task_assignee != v_actor_id THEN
         INSERT INTO public.notifications (workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
         VALUES (v_workspace_id, v_task_assignee, v_actor_id, 'comment_added', v_actor_name || ' commented on "' || v_task_title || '"', substring(NEW.content, 1, 100), 'task', NEW.task_id, jsonb_build_object('project_id', v_project_id, 'comment_id', NEW.id));
    END IF;

    -- Notify Creator (if not actor and not assignee)
    IF v_task_creator IS NOT NULL AND v_task_creator != v_actor_id AND (v_task_assignee IS NULL OR v_task_creator != v_task_assignee) THEN
         INSERT INTO public.notifications (workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
         VALUES (v_workspace_id, v_task_creator, v_actor_id, 'comment_added', v_actor_name || ' commented on "' || v_task_title || '"', substring(NEW.content, 1, 100), 'task', NEW.task_id, jsonb_build_object('project_id', v_project_id, 'comment_id', NEW.id));
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_activity ON public.task_comments;
CREATE TRIGGER on_comment_activity
AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_activity();


-- 6. Trigger for WORKSPACE MEMBERS
CREATE OR REPLACE FUNCTION public.handle_workspace_member_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_target_user_name TEXT;
    v_workspace_id UUID;
    v_workspace_name TEXT;
BEGIN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
    v_actor_id := auth.uid(); -- The admin who performed the action
    
    SELECT name INTO v_workspace_name FROM public.workspaces WHERE id = v_workspace_id;
    
    -- INSERT (Join)
    IF (TG_OP = 'INSERT') THEN
         SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_target_user_name FROM public.profiles WHERE id = NEW.user_id;
         
         PERFORM public.log_activity(
            v_workspace_id, NULL, NULL, NEW.user_id, -- Actor is the user joining
            'join', 'member', NEW.id,
            COALESCE(v_target_user_name, 'Someone') || ' joined the workspace',
            jsonb_build_object('role', NEW.role)
        );
        
        -- Notification to user
        INSERT INTO public.notifications (workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
        VALUES (v_workspace_id, NEW.user_id, NULL, 'workspace_invite_accepted', 'Welcome to ' || v_workspace_name, 'You have joined the workspace.', 'workspace', v_workspace_id, '{}'); 

        RETURN NEW;

    -- UPDATE (Role Change)
    ELSIF (TG_OP = 'UPDATE') AND (OLD.role IS DISTINCT FROM NEW.role) THEN
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_target_user_name FROM public.profiles WHERE id = NEW.user_id;
        
        PERFORM public.log_activity(
            v_workspace_id, NULL, NULL, v_actor_id,
            'update_role', 'member', NEW.id,
            'Changed ' || COALESCE(v_target_user_name, 'user') || '''s role from ' || OLD.role || ' to ' || NEW.role,
            jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role)
        );

         -- Notification to user
        INSERT INTO public.notifications (workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
        VALUES (v_workspace_id, NEW.user_id, v_actor_id, 'role_changed', 'Your role was updated', 'You are now a ' || NEW.role || ' in ' || v_workspace_name, 'workspace', v_workspace_id, jsonb_build_object('role', NEW.role));

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_workspace_member_activity ON public.workspace_members;
CREATE TRIGGER on_workspace_member_activity
AFTER INSERT OR UPDATE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_member_activity();


-- 7. Trigger for PROJECTS
CREATE OR REPLACE FUNCTION public.handle_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
BEGIN
    v_actor_id := auth.uid();
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    -- INSERT
    IF (TG_OP = 'INSERT') THEN
         PERFORM public.log_activity(
            NEW.workspace_id, NEW.id, NULL, v_actor_id,
            'create', 'project', NEW.id,
            COALESCE(v_actor_name, 'Someone') || ' created project "' || NEW.name || '"',
            jsonb_build_object('name', NEW.name)
        );
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
        
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_project_activity ON public.projects;
CREATE TRIGGER on_project_activity
AFTER INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.handle_project_activity();


-- 8. Trigger for WORKSPACES
CREATE OR REPLACE FUNCTION public.handle_workspace_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
BEGIN
    v_actor_id := auth.uid();
     SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.name IS DISTINCT FROM NEW.name) THEN
            PERFORM public.log_activity(
                NEW.id, NULL, NULL, v_actor_id,
                'update', 'workspace', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated workspace name to "' || NEW.name || '"',
                jsonb_build_object('old_name', OLD.name, 'new_name', NEW.name)
            );
        END IF;
        IF (OLD.logo_url IS DISTINCT FROM NEW.logo_url) THEN
             PERFORM public.log_activity(
                NEW.id, NULL, NULL, v_actor_id,
                'update', 'workspace', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' updated workspace logo',
                '{}'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workspace_activity ON public.workspaces;
CREATE TRIGGER on_workspace_activity
AFTER UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_activity();

-- 9. Trigger for ATTACHMENTS
CREATE OR REPLACE FUNCTION public.handle_attachment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_workspace_id UUID;
    v_project_id UUID;
    v_task_title TEXT;
BEGIN
    -- Handle DELETE (OLD) vs INSERT (NEW)
    IF (TG_OP = 'DELETE') THEN
        v_actor_id := auth.uid(); -- Might be null if system deletion, but usually user
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
        
        -- Get task info to find workspace
        SELECT project_id, title INTO v_project_id, v_task_title FROM public.tasks WHERE id = OLD.task_id;
        SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;

        PERFORM public.log_activity(
            v_workspace_id, v_project_id, OLD.task_id, v_actor_id,
            'delete_file', 'attachment', OLD.id,
            COALESCE(v_actor_name, 'Someone') || ' removed attachment "' || OLD.file_name || '"',
            jsonb_build_object('file_name', OLD.file_name)
        );
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        v_actor_id := NEW.user_id;
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
        
        SELECT project_id, title INTO v_project_id, v_task_title FROM public.tasks WHERE id = NEW.task_id;
        SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;

        PERFORM public.log_activity(
            v_workspace_id, v_project_id, NEW.task_id, v_actor_id,
            'upload', 'attachment', NEW.id,
            COALESCE(v_actor_name, 'Someone') || ' attached file "' || NEW.file_name || '"',
            jsonb_build_object('file_name', NEW.file_name, 'file_type', NEW.file_type)
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_attachment_activity ON public.task_attachments;
CREATE TRIGGER on_attachment_activity
AFTER INSERT OR DELETE ON public.task_attachments
FOR EACH ROW EXECUTE FUNCTION public.handle_attachment_activity();


-- 10. Trigger for LINKS
CREATE OR REPLACE FUNCTION public.handle_link_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_workspace_id UUID;
    v_project_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_actor_id := auth.uid();
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
        
        SELECT project_id INTO v_project_id FROM public.tasks WHERE id = OLD.task_id;
        SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;

        PERFORM public.log_activity(
            v_workspace_id, v_project_id, OLD.task_id, v_actor_id,
            'remove_link', 'link', OLD.id,
            COALESCE(v_actor_name, 'Someone') || ' removed link "' || COALESCE(OLD.title, OLD.url) || '"',
            jsonb_build_object('url', OLD.url)
        );
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        v_actor_id := NEW.created_by;
        SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
        
        SELECT project_id INTO v_project_id FROM public.tasks WHERE id = NEW.task_id;
        SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;

        PERFORM public.log_activity(
            v_workspace_id, v_project_id, NEW.task_id, v_actor_id,
            'add_link', 'link', NEW.id,
            COALESCE(v_actor_name, 'Someone') || ' added link "' || COALESCE(NEW.title, NEW.url) || '"',
            jsonb_build_object('url', NEW.url, 'title', NEW.title)
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_link_activity ON public.task_links;
CREATE TRIGGER on_link_activity
AFTER INSERT OR DELETE ON public.task_links
FOR EACH ROW EXECUTE FUNCTION public.handle_link_activity();


-- 11. Trigger for WORK SESSIONS (Timer)
CREATE OR REPLACE FUNCTION public.handle_session_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_workspace_id UUID;
    v_project_id UUID;
    v_duration TEXT;
    v_seconds INT;
    v_minutes INT;
    v_hours INT;
BEGIN
    v_actor_id := auth.uid(); -- Usually the person starting/stopping the timer
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

    -- INSERT (Start)
    IF (TG_OP = 'INSERT') THEN
         SELECT project_id INTO v_project_id FROM public.tasks WHERE id = NEW.task_id;
         SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;
         
         PERFORM public.log_activity(
            v_workspace_id, v_project_id, NEW.task_id, NEW.user_id, -- user_id is the person working
            'timer_start', 'session', NEW.id,
            COALESCE(v_actor_name, 'Someone') || ' started working',
            jsonb_build_object('started_at', NEW.started_at)
        );
        RETURN NEW;

    -- UPDATE (Stop/Pause - ended_at set)
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL) THEN
            SELECT project_id INTO v_project_id FROM public.tasks WHERE id = NEW.task_id;
            SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = v_project_id;
            
            -- Calculate duration string for niceness
            v_seconds := NEW.duration_seconds;
            v_minutes := FLOOR(v_seconds / 60);
            v_hours := FLOOR(v_minutes / 60);
            
            IF v_hours > 0 THEN
                v_duration := v_hours || 'h ' || (v_minutes % 60) || 'm';
            ELSE
                v_duration := v_minutes || 'm ' || (v_seconds % 60) || 's';
            END IF;

            PERFORM public.log_activity(
                v_workspace_id, v_project_id, NEW.task_id, NEW.user_id,
                'timer_pause', 'session', NEW.id,
                COALESCE(v_actor_name, 'Someone') || ' stopped working (Duration: ' || v_duration || ')',
                jsonb_build_object('duration_seconds', NEW.duration_seconds, 'duration_text', v_duration)
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_session_activity ON public.task_work_sessions;
CREATE TRIGGER on_session_activity
AFTER INSERT OR UPDATE ON public.task_work_sessions
FOR EACH ROW EXECUTE FUNCTION public.handle_session_activity();
