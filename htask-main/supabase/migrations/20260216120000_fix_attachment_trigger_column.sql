-- Fix handle_attachment_activity to use user_id instead of uploaded_by
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
        -- FIX: Use user_id instead of uploaded_by
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
