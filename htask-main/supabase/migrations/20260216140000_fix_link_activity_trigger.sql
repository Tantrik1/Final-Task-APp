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
        -- FIX: Use user_id instead of created_by since the table uses user_id
        v_actor_id := NEW.user_id;
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
