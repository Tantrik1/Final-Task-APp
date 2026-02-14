-- =============================================
-- COMPREHENSIVE NOTIFICATION SYSTEM OVERHAUL
-- =============================================

-- Part 1: Create notification_logs table for activity tracking
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'push_attempted', 'push_success', 'push_failed', 'read'
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_id ON public.notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_type ON public.notification_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_logs
CREATE POLICY "Users can view own notification logs"
ON public.notification_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.notifications n
  WHERE n.id = notification_logs.notification_id AND n.user_id = auth.uid()
));

CREATE POLICY "System can insert notification logs"
ON public.notification_logs FOR INSERT
WITH CHECK (true);

-- Part 2: Create log_notification_event helper function
CREATE OR REPLACE FUNCTION public.log_notification_event(
  p_notification_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.notification_logs (notification_id, event_type, event_data)
  VALUES (p_notification_id, p_event_type, p_event_data)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

-- Part 3: Update create_notification to log creation event
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

-- Part 4: Enhanced notify_task_assigned function
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_id UUID;
  v_project_name TEXT;
  v_actor_name TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Only trigger if assigned_to changed and is not null
  IF NEW.assigned_to IS NOT NULL AND (OLD IS NULL OR OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to) THEN
    -- Get workspace_id from project
    SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
    FROM public.projects p WHERE p.id = NEW.project_id;
    
    -- Get actor name
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name
    FROM public.profiles WHERE id = auth.uid();
    
    -- Build enhanced title and body
    v_title := COALESCE(v_actor_name, 'Someone') || ' assigned you a task in ' || v_project_name;
    v_body := NEW.title || CASE 
      WHEN NEW.due_date IS NOT NULL AND NEW.priority != 'medium' THEN 
        ' • Due ' || to_char(NEW.due_date, 'Mon DD') || ' • ' || initcap(NEW.priority::text) || ' priority'
      WHEN NEW.due_date IS NOT NULL THEN 
        ' • Due ' || to_char(NEW.due_date, 'Mon DD')
      WHEN NEW.priority != 'medium' THEN 
        ' • ' || initcap(NEW.priority::text) || ' priority'
      ELSE ''
    END;
    
    PERFORM create_notification(
      v_workspace_id,
      NEW.assigned_to,
      auth.uid(),
      'task_assigned'::notification_type,
      v_title,
      v_body,
      'task'::entity_type,
      NEW.id,
      jsonb_build_object(
        'project_id', NEW.project_id, 
        'project_name', v_project_name, 
        'task_title', NEW.title,
        'due_date', NEW.due_date,
        'priority', NEW.priority,
        'workspace_id', v_workspace_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Part 5: Enhanced notify_task_status_changed function
CREATE OR REPLACE FUNCTION public.notify_task_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_id UUID;
  v_project_name TEXT;
  v_actor_name TEXT;
  v_notification_type notification_type;
  v_title TEXT;
  v_body TEXT;
  v_new_status_name TEXT;
  v_old_status_name TEXT;
  v_is_completed BOOLEAN;
BEGIN
  -- Check if custom_status_id changed
  IF (NEW.custom_status_id IS DISTINCT FROM OLD.custom_status_id) THEN
    -- Get workspace_id from project
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
    
    -- Get new status name and completion state
    IF NEW.custom_status_id IS NOT NULL THEN
      SELECT name, is_completed INTO v_new_status_name, v_is_completed
      FROM public.project_statuses WHERE id = NEW.custom_status_id;
    ELSE
      v_new_status_name := 'Unknown';
      v_is_completed := false;
    END IF;
    
    -- Determine notification type and message
    IF v_is_completed THEN
      v_notification_type := 'task_completed';
      v_title := COALESCE(v_actor_name, 'Someone') || ' completed ''' || NEW.title || '''';
      v_body := 'in ' || v_project_name;
    ELSE
      v_notification_type := 'task_status_changed';
      v_title := COALESCE(v_actor_name, 'Someone') || ' updated ''' || NEW.title || ''' in ' || v_project_name;
      v_body := 'Status: ' || COALESCE(v_old_status_name, 'Unknown') || ' → ' || v_new_status_name;
    END IF;
    
    -- Notify task creator if not the actor
    IF NEW.created_by IS NOT NULL AND NEW.created_by != auth.uid() THEN
      PERFORM create_notification(
        v_workspace_id,
        NEW.created_by,
        auth.uid(),
        v_notification_type,
        v_title,
        v_body,
        'task'::entity_type,
        NEW.id,
        jsonb_build_object(
          'project_id', NEW.project_id, 
          'project_name', v_project_name, 
          'task_title', NEW.title, 
          'old_status', v_old_status_name,
          'new_status', v_new_status_name,
          'workspace_id', v_workspace_id
        )
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
        jsonb_build_object(
          'project_id', NEW.project_id, 
          'project_name', v_project_name, 
          'task_title', NEW.title, 
          'old_status', v_old_status_name,
          'new_status', v_new_status_name,
          'workspace_id', v_workspace_id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Part 6: Enhanced notify_comment_added function
CREATE OR REPLACE FUNCTION public.notify_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_id UUID;
  v_project_id UUID;
  v_project_name TEXT;
  v_task_title TEXT;
  v_task_creator UUID;
  v_task_assignee UUID;
  v_actor_name TEXT;
  v_parent_author UUID;
  v_comment_preview TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Get task info
  SELECT t.project_id, t.title, t.created_by, t.assigned_to
  INTO v_project_id, v_task_title, v_task_creator, v_task_assignee
  FROM public.tasks t WHERE t.id = NEW.task_id;
  
  -- Get workspace_id from project
  SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
  FROM public.projects p WHERE p.id = v_project_id;
  
  -- Get actor name
  SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name
  FROM public.profiles WHERE id = NEW.user_id;
  
  -- Create comment preview (first 50 chars)
  v_comment_preview := CASE 
    WHEN length(NEW.content) > 50 THEN substring(NEW.content from 1 for 50) || '...'
    ELSE NEW.content
  END;
  
  -- If this is a reply, notify the parent comment author
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author
    FROM public.task_comments WHERE id = NEW.parent_id;
    
    IF v_parent_author IS NOT NULL AND v_parent_author != NEW.user_id THEN
      v_title := COALESCE(v_actor_name, 'Someone') || ' replied to your comment in ' || v_project_name;
      v_body := 'on "' || v_task_title || '": "' || v_comment_preview || '"';
      
      PERFORM create_notification(
        v_workspace_id,
        v_parent_author,
        NEW.user_id,
        'comment_reply'::notification_type,
        v_title,
        v_body,
        'comment'::entity_type,
        NEW.id,
        jsonb_build_object(
          'project_id', v_project_id, 
          'project_name', v_project_name,
          'task_id', NEW.task_id, 
          'task_title', v_task_title,
          'workspace_id', v_workspace_id
        )
      );
    END IF;
  END IF;
  
  -- Enhanced title and body for comment notifications
  v_title := COALESCE(v_actor_name, 'Someone') || ' commented on ''' || v_task_title || ''' in ' || v_project_name;
  v_body := '"' || v_comment_preview || '"';
  
  -- Notify task creator
  IF v_task_creator IS NOT NULL AND v_task_creator != NEW.user_id AND (v_parent_author IS NULL OR v_task_creator != v_parent_author) THEN
    PERFORM create_notification(
      v_workspace_id,
      v_task_creator,
      NEW.user_id,
      'comment_added'::notification_type,
      v_title,
      v_body,
      'comment'::entity_type,
      NEW.id,
      jsonb_build_object(
        'project_id', v_project_id, 
        'project_name', v_project_name,
        'task_id', NEW.task_id, 
        'task_title', v_task_title,
        'workspace_id', v_workspace_id
      )
    );
  END IF;
  
  -- Notify task assignee if different
  IF v_task_assignee IS NOT NULL AND v_task_assignee != NEW.user_id AND v_task_assignee != v_task_creator AND (v_parent_author IS NULL OR v_task_assignee != v_parent_author) THEN
    PERFORM create_notification(
      v_workspace_id,
      v_task_assignee,
      NEW.user_id,
      'comment_added'::notification_type,
      v_title,
      v_body,
      'comment'::entity_type,
      NEW.id,
      jsonb_build_object(
        'project_id', v_project_id, 
        'project_name', v_project_name,
        'task_id', NEW.task_id, 
        'task_title', v_task_title,
        'workspace_id', v_workspace_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Part 7: Enhanced notify_channel_message function
CREATE OR REPLACE FUNCTION public.notify_channel_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_id UUID;
  v_channel_name TEXT;
  v_sender_name TEXT;
  v_message_preview TEXT;
  v_member_id UUID;
BEGIN
  -- Get channel info
  SELECT c.workspace_id, c.name INTO v_workspace_id, v_channel_name
  FROM public.channels c WHERE c.id = NEW.channel_id;
  
  -- Get sender name
  SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;
  
  -- Create message preview (first 50 chars)
  v_message_preview := CASE 
    WHEN length(NEW.content) > 50 THEN substring(NEW.content from 1 for 50) || '...'
    ELSE NEW.content
  END;
  
  -- Notify all channel members except sender
  FOR v_member_id IN
    SELECT user_id FROM public.channel_members
    WHERE channel_id = NEW.channel_id AND user_id != NEW.sender_id
  LOOP
    PERFORM create_notification(
      v_workspace_id,
      v_member_id,
      NEW.sender_id,
      'chat_mention'::notification_type,
      COALESCE(v_sender_name, 'Someone') || ' messaged in #' || v_channel_name,
      v_message_preview,
      'chat'::entity_type,
      NEW.channel_id,
      jsonb_build_object(
        'channel_id', NEW.channel_id,
        'channel_name', v_channel_name,
        'message_id', NEW.id,
        'workspace_id', v_workspace_id
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Part 8: Enhanced notify_dm_message function
CREATE OR REPLACE FUNCTION public.notify_dm_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_id UUID;
  v_recipient_id UUID;
  v_sender_name TEXT;
  v_message_preview TEXT;
BEGIN
  -- Get conversation info and recipient
  SELECT 
    dc.workspace_id,
    CASE WHEN dc.participant_1 = NEW.sender_id THEN dc.participant_2 ELSE dc.participant_1 END
  INTO v_workspace_id, v_recipient_id
  FROM public.dm_conversations dc WHERE dc.id = NEW.conversation_id;
  
  -- Get sender name
  SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;
  
  -- Create message preview
  v_message_preview := CASE 
    WHEN length(NEW.content) > 50 THEN substring(NEW.content from 1 for 50) || '...'
    ELSE NEW.content
  END;
  
  -- Notify recipient with enhanced wording
  PERFORM create_notification(
    v_workspace_id,
    v_recipient_id,
    NEW.sender_id,
    'chat_mention'::notification_type,
    COALESCE(v_sender_name, 'Someone') || ' messaged you directly',
    v_message_preview,
    'chat'::entity_type,
    NEW.conversation_id,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'is_dm', true,
      'message_id', NEW.id,
      'workspace_id', v_workspace_id
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Part 9: Enhanced notify_member_joined function
CREATE OR REPLACE FUNCTION public.notify_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_name TEXT;
  v_new_member_name TEXT;
  v_admin_id UUID;
BEGIN
  -- Get workspace name
  SELECT name INTO v_workspace_name
  FROM public.workspaces WHERE id = NEW.workspace_id;
  
  -- Get new member name
  SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_new_member_name
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
      COALESCE(v_new_member_name, 'Someone') || ' joined your workspace',
      'as ' || initcap(NEW.role::text) || ' in ' || v_workspace_name,
      'workspace'::entity_type,
      NEW.workspace_id,
      jsonb_build_object(
        'member_id', NEW.user_id, 
        'member_name', v_new_member_name, 
        'role', NEW.role,
        'workspace_id', NEW.workspace_id
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Part 10: Create send_due_date_reminders function
CREATE OR REPLACE FUNCTION public.send_due_date_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_count INTEGER := 0;
  v_title TEXT;
  v_body TEXT;
  v_days_overdue INTEGER;
BEGIN
  FOR v_task IN
    SELECT t.id, t.title, t.due_date, t.assigned_to, t.project_id,
           p.name as project_name, p.workspace_id
    FROM public.tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.due_date IS NOT NULL
    AND t.assigned_to IS NOT NULL
    AND t.completed_at IS NULL
    AND (t.due_date = CURRENT_DATE OR t.due_date < CURRENT_DATE)
  LOOP
    -- Check if user has reminders enabled
    IF should_notify(v_task.assigned_to, v_task.workspace_id, 'due_date_reminders') THEN
      
      IF v_task.due_date < CURRENT_DATE THEN
        v_days_overdue := CURRENT_DATE - v_task.due_date;
        v_title := 'Overdue: Task needs attention';
        v_body := '"' || v_task.title || '" in ' || v_task.project_name || 
          CASE WHEN v_days_overdue = 1 THEN ' was due yesterday'
               ELSE ' was due ' || v_days_overdue || ' days ago'
          END;
      ELSE
        v_title := 'Reminder: Task due today';
        v_body := '"' || v_task.title || '" in ' || v_task.project_name || ' is due today';
      END IF;
      
      PERFORM create_notification(
        v_task.workspace_id,
        v_task.assigned_to,
        NULL,
        'due_date_reminder'::notification_type,
        v_title,
        v_body,
        'task'::entity_type,
        v_task.id,
        jsonb_build_object(
          'project_id', v_task.project_id,
          'project_name', v_task.project_name,
          'task_title', v_task.title,
          'due_date', v_task.due_date,
          'is_overdue', v_task.due_date < CURRENT_DATE,
          'workspace_id', v_task.workspace_id
        )
      );
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$function$;