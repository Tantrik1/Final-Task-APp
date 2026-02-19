-- Drop ALL existing notification triggers on tasks table (using CASCADE to handle dependencies)
DROP TRIGGER IF EXISTS on_task_assigned ON public.tasks;
DROP TRIGGER IF EXISTS on_task_status_changed ON public.tasks;
DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON public.tasks;
DROP TRIGGER IF EXISTS trigger_notify_task_status_changed ON public.tasks;

-- Drop ALL existing notification triggers on task_comments table
DROP TRIGGER IF EXISTS on_comment_added ON public.task_comments;
DROP TRIGGER IF EXISTS trigger_notify_comment_added ON public.task_comments;

-- Drop ALL existing notification triggers on workspace_members table
DROP TRIGGER IF EXISTS on_member_joined ON public.workspace_members;
DROP TRIGGER IF EXISTS trigger_notify_member_joined ON public.workspace_members;

-- Now drop and recreate functions with CASCADE
DROP FUNCTION IF EXISTS public.notify_task_assigned() CASCADE;
DROP FUNCTION IF EXISTS public.notify_task_status_changed() CASCADE;
DROP FUNCTION IF EXISTS public.notify_comment_added() CASCADE;
DROP FUNCTION IF EXISTS public.notify_member_joined() CASCADE;

-- Create improved notify_task_assigned function with better titles/body
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
  v_due_info TEXT := '';
BEGIN
  -- Only trigger if assigned_to changed and is not null
  IF NEW.assigned_to IS NOT NULL AND (OLD IS NULL OR OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to) THEN
    -- Get workspace_id from project
    SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
    FROM public.projects p WHERE p.id = NEW.project_id;
    
    -- Get actor name
    SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_actor_name
    FROM public.profiles WHERE id = auth.uid();
    
    -- Build due date info
    IF NEW.due_date IS NOT NULL THEN
      v_due_info := ' • Due ' || to_char(NEW.due_date, 'Mon DD');
    END IF;
    
    PERFORM create_notification(
      v_workspace_id,
      NEW.assigned_to,
      auth.uid(),
      'task_assigned'::notification_type,
      'New task from ' || COALESCE(v_actor_name, 'a teammate'),
      NEW.title || v_due_info,
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

-- Create improved notify_task_status_changed function that handles custom_status_id
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
      v_title := '✅ Task completed';
      v_body := '"' || NEW.title || '" in ' || v_project_name;
    ELSE
      v_notification_type := 'task_status_changed';
      v_title := COALESCE(v_actor_name, 'Someone') || ' moved a task';
      v_body := '"' || NEW.title || '" → ' || v_new_status_name;
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
          'new_status', v_new_status_name,
          'workspace_id', v_workspace_id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create improved notify_comment_added function
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
      PERFORM create_notification(
        v_workspace_id,
        v_parent_author,
        NEW.user_id,
        'comment_reply'::notification_type,
        COALESCE(v_actor_name, 'Someone') || ' replied',
        v_task_title || ': "' || v_comment_preview || '"',
        'comment'::entity_type,
        NEW.id,
        jsonb_build_object(
          'project_id', v_project_id, 
          'task_id', NEW.task_id, 
          'task_title', v_task_title,
          'workspace_id', v_workspace_id
        )
      );
    END IF;
  END IF;
  
  -- Notify task creator
  IF v_task_creator IS NOT NULL AND v_task_creator != NEW.user_id AND (v_parent_author IS NULL OR v_task_creator != v_parent_author) THEN
    PERFORM create_notification(
      v_workspace_id,
      v_task_creator,
      NEW.user_id,
      'comment_added'::notification_type,
      COALESCE(v_actor_name, 'Someone') || ' commented',
      v_task_title || ': "' || v_comment_preview || '"',
      'comment'::entity_type,
      NEW.id,
      jsonb_build_object(
        'project_id', v_project_id, 
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
      COALESCE(v_actor_name, 'Someone') || ' commented',
      v_task_title || ': "' || v_comment_preview || '"',
      'comment'::entity_type,
      NEW.id,
      jsonb_build_object(
        'project_id', v_project_id, 
        'task_id', NEW.task_id, 
        'task_title', v_task_title,
        'workspace_id', v_workspace_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create improved notify_member_joined function
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
      'New team member joined',
      COALESCE(v_new_member_name, 'Someone') || ' joined ' || v_workspace_name,
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

-- Create new triggers
CREATE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();

CREATE TRIGGER on_task_status_changed
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_status_changed();

CREATE TRIGGER on_comment_added
  AFTER INSERT ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_added();

CREATE TRIGGER on_member_joined
  AFTER INSERT ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_member_joined();