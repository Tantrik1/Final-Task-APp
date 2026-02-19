-- Create notification_type enum
CREATE TYPE public.notification_type AS ENUM (
  'task_assigned',
  'task_status_changed',
  'task_completed',
  'comment_added',
  'comment_reply',
  'project_created',
  'project_updated',
  'member_joined',
  'member_invited',
  'chat_mention',
  'due_date_reminder'
);

-- Create entity_type enum
CREATE TYPE public.entity_type AS ENUM (
  'task',
  'project',
  'comment',
  'chat',
  'workspace'
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_type public.entity_type NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_assigned BOOLEAN NOT NULL DEFAULT true,
  task_status_changed BOOLEAN NOT NULL DEFAULT true,
  task_completed BOOLEAN NOT NULL DEFAULT true,
  comment_added BOOLEAN NOT NULL DEFAULT true,
  comment_reply BOOLEAN NOT NULL DEFAULT true,
  project_updates BOOLEAN NOT NULL DEFAULT true,
  member_updates BOOLEAN NOT NULL DEFAULT false,
  chat_mentions BOOLEAN NOT NULL DEFAULT true,
  due_date_reminders BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_workspace_id ON public.notifications(workspace_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notification_preferences_user_workspace ON public.notification_preferences(user_id, workspace_id);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, user_id));

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view own preferences"
ON public.notification_preferences FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update own preferences"
ON public.notification_preferences FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own preferences"
ON public.notification_preferences FOR DELETE
USING (user_id = auth.uid());

-- Trigger for updated_at on notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check user notification preferences
CREATE OR REPLACE FUNCTION public.should_notify(
  p_user_id UUID,
  p_workspace_id UUID,
  p_notification_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_notify BOOLEAN;
BEGIN
  -- If no preferences exist, default to true
  EXECUTE format(
    'SELECT COALESCE((SELECT %I FROM public.notification_preferences WHERE user_id = $1 AND workspace_id = $2), true)',
    p_notification_type
  ) INTO v_should_notify USING p_user_id, p_workspace_id;
  
  RETURN COALESCE(v_should_notify, true);
END;
$$;

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_workspace_id UUID,
  p_user_id UUID,
  p_actor_id UUID,
  p_type public.notification_type,
  p_title TEXT,
  p_body TEXT,
  p_entity_type public.entity_type,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_pref_column TEXT;
BEGIN
  -- Map notification type to preference column
  v_pref_column := CASE p_type
    WHEN 'task_assigned' THEN 'task_assigned'
    WHEN 'task_status_changed' THEN 'task_status_changed'
    WHEN 'task_completed' THEN 'task_completed'
    WHEN 'comment_added' THEN 'comment_added'
    WHEN 'comment_reply' THEN 'comment_reply'
    WHEN 'project_created' THEN 'project_updates'
    WHEN 'project_updated' THEN 'project_updates'
    WHEN 'member_joined' THEN 'member_updates'
    WHEN 'member_invited' THEN 'member_updates'
    WHEN 'chat_mention' THEN 'chat_mentions'
    WHEN 'due_date_reminder' THEN 'due_date_reminders'
    ELSE 'task_assigned'
  END;
  
  -- Check if user wants this notification
  IF NOT should_notify(p_user_id, p_workspace_id, v_pref_column) THEN
    RETURN NULL;
  END IF;
  
  -- Don't notify the actor about their own action
  IF p_user_id = p_actor_id THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO public.notifications (
    workspace_id, user_id, actor_id, type, title, body, entity_type, entity_id, metadata
  ) VALUES (
    p_workspace_id, p_user_id, p_actor_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_metadata
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Trigger function for task assignment
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_project_name TEXT;
  v_actor_name TEXT;
BEGIN
  -- Only trigger if assigned_to changed and is not null
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to) THEN
    -- Get workspace_id from project
    SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
    FROM public.projects p WHERE p.id = NEW.project_id;
    
    -- Get actor name
    SELECT COALESCE(full_name, email) INTO v_actor_name
    FROM public.profiles WHERE id = auth.uid();
    
    PERFORM create_notification(
      v_workspace_id,
      NEW.assigned_to,
      auth.uid(),
      'task_assigned'::notification_type,
      'Task assigned to you',
      COALESCE(v_actor_name, 'Someone') || ' assigned "' || NEW.title || '" to you',
      'task'::entity_type,
      NEW.id,
      jsonb_build_object('project_id', NEW.project_id, 'project_name', v_project_name, 'task_title', NEW.title)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for task status change
CREATE OR REPLACE FUNCTION public.notify_task_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_project_name TEXT;
  v_actor_name TEXT;
  v_notify_user UUID;
  v_notification_type notification_type;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Only trigger if status changed
  IF NEW.status != OLD.status THEN
    -- Get workspace_id from project
    SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
    FROM public.projects p WHERE p.id = NEW.project_id;
    
    -- Get actor name
    SELECT COALESCE(full_name, email) INTO v_actor_name
    FROM public.profiles WHERE id = auth.uid();
    
    -- Determine notification type and message
    IF NEW.status = 'done' THEN
      v_notification_type := 'task_completed';
      v_title := 'Task completed';
      v_body := '"' || NEW.title || '" was marked as done';
    ELSE
      v_notification_type := 'task_status_changed';
      v_title := 'Task status updated';
      v_body := COALESCE(v_actor_name, 'Someone') || ' moved "' || NEW.title || '" to ' || 
        CASE NEW.status 
          WHEN 'in_progress' THEN 'In Progress'
          WHEN 'review' THEN 'Review'
          WHEN 'todo' THEN 'To Do'
          ELSE NEW.status::text
        END;
    END IF;
    
    -- Notify task creator if not the actor
    IF NEW.created_by != auth.uid() THEN
      PERFORM create_notification(
        v_workspace_id,
        NEW.created_by,
        auth.uid(),
        v_notification_type,
        v_title,
        v_body,
        'task'::entity_type,
        NEW.id,
        jsonb_build_object('project_id', NEW.project_id, 'project_name', v_project_name, 'task_title', NEW.title, 'new_status', NEW.status)
      );
    END IF;
    
    -- Notify assignee if different from creator and actor
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() AND NEW.assigned_to != NEW.created_by THEN
      PERFORM create_notification(
        v_workspace_id,
        NEW.assigned_to,
        auth.uid(),
        v_notification_type,
        v_title,
        v_body,
        'task'::entity_type,
        NEW.id,
        jsonb_build_object('project_id', NEW.project_id, 'project_name', v_project_name, 'task_title', NEW.title, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for comment added
CREATE OR REPLACE FUNCTION public.notify_comment_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_project_id UUID;
  v_project_name TEXT;
  v_task_title TEXT;
  v_task_creator UUID;
  v_task_assignee UUID;
  v_actor_name TEXT;
  v_parent_author UUID;
BEGIN
  -- Get task info
  SELECT t.project_id, t.title, t.created_by, t.assigned_to
  INTO v_project_id, v_task_title, v_task_creator, v_task_assignee
  FROM public.tasks t WHERE t.id = NEW.task_id;
  
  -- Get workspace_id from project
  SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
  FROM public.projects p WHERE p.id = v_project_id;
  
  -- Get actor name
  SELECT COALESCE(full_name, email) INTO v_actor_name
  FROM public.profiles WHERE id = NEW.user_id;
  
  -- If this is a reply, notify the parent comment author
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author
    FROM public.task_comments WHERE id = NEW.parent_id;
    
    IF v_parent_author IS NOT NULL AND v_parent_author != NEW.user_id THEN
      PERFORM create_notification(
        v_workspace_id,
        v_parent_author,
        NEW.user_id,
        'comment_reply'::notification_type,
        'Reply to your comment',
        COALESCE(v_actor_name, 'Someone') || ' replied to your comment on "' || v_task_title || '"',
        'comment'::entity_type,
        NEW.id,
        jsonb_build_object('project_id', v_project_id, 'task_id', NEW.task_id, 'task_title', v_task_title)
      );
    END IF;
  END IF;
  
  -- Notify task creator
  IF v_task_creator IS NOT NULL AND v_task_creator != NEW.user_id AND v_task_creator != v_parent_author THEN
    PERFORM create_notification(
      v_workspace_id,
      v_task_creator,
      NEW.user_id,
      'comment_added'::notification_type,
      'New comment',
      COALESCE(v_actor_name, 'Someone') || ' commented on "' || v_task_title || '"',
      'comment'::entity_type,
      NEW.id,
      jsonb_build_object('project_id', v_project_id, 'task_id', NEW.task_id, 'task_title', v_task_title)
    );
  END IF;
  
  -- Notify task assignee if different
  IF v_task_assignee IS NOT NULL AND v_task_assignee != NEW.user_id AND v_task_assignee != v_task_creator AND v_task_assignee != v_parent_author THEN
    PERFORM create_notification(
      v_workspace_id,
      v_task_assignee,
      NEW.user_id,
      'comment_added'::notification_type,
      'New comment',
      COALESCE(v_actor_name, 'Someone') || ' commented on "' || v_task_title || '"',
      'comment'::entity_type,
      NEW.id,
      jsonb_build_object('project_id', v_project_id, 'task_id', NEW.task_id, 'task_title', v_task_title)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for member joined
CREATE OR REPLACE FUNCTION public.notify_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_name TEXT;
  v_new_member_name TEXT;
  v_admin_id UUID;
BEGIN
  -- Get workspace name
  SELECT name INTO v_workspace_name
  FROM public.workspaces WHERE id = NEW.workspace_id;
  
  -- Get new member name
  SELECT COALESCE(full_name, email) INTO v_new_member_name
  FROM public.profiles WHERE id = NEW.user_id;
  
  -- Notify all admins and owners about new member
  FOR v_admin_id IN
    SELECT user_id FROM public.workspace_members
    WHERE workspace_id = NEW.workspace_id
    AND role IN ('owner', 'admin')
    AND user_id != NEW.user_id
  LOOP
    PERFORM create_notification(
      NEW.workspace_id,
      v_admin_id,
      NEW.user_id,
      'member_joined'::notification_type,
      'New team member',
      COALESCE(v_new_member_name, 'Someone') || ' joined "' || v_workspace_name || '"',
      'workspace'::entity_type,
      NEW.workspace_id,
      jsonb_build_object('member_id', NEW.user_id, 'member_name', v_new_member_name, 'role', NEW.role)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create the triggers
CREATE TRIGGER trigger_notify_task_assigned
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assigned();

CREATE TRIGGER trigger_notify_task_status_changed
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_status_changed();

CREATE TRIGGER trigger_notify_comment_added
AFTER INSERT ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_comment_added();

CREATE TRIGGER trigger_notify_member_joined
AFTER INSERT ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_member_joined();

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;