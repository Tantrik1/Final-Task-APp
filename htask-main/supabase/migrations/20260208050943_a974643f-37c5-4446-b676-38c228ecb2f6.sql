
-- Replace the trigger function to use net.http_post instead of pg_notify
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_push_enabled BOOLEAN;
  v_has_subscription BOOLEAN;
  v_url TEXT;
  v_payload JSONB;
  v_workspace_id TEXT;
  v_entity_type TEXT;
  v_entity_id TEXT;
  v_metadata JSONB;
  v_notification_url TEXT;
  v_project_id TEXT;
  v_task_id TEXT;
BEGIN
  -- Check if user has push enabled in preferences
  SELECT push_enabled INTO v_push_enabled
  FROM public.notification_preferences
  WHERE user_id = NEW.user_id AND workspace_id = NEW.workspace_id;
  
  -- Check if user has active push subscriptions
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions
    WHERE user_id = NEW.user_id AND is_active = true
  ) INTO v_has_subscription;
  
  -- Only proceed if user has push enabled and active subscriptions
  IF COALESCE(v_push_enabled, false) AND v_has_subscription THEN
    -- Build deep-link URL based on entity type
    v_workspace_id := NEW.workspace_id::text;
    v_entity_type := NEW.entity_type::text;
    v_entity_id := NEW.entity_id::text;
    v_metadata := COALESCE(NEW.metadata, '{}'::jsonb);
    v_project_id := v_metadata->>'project_id';
    v_task_id := v_metadata->>'task_id';

    CASE v_entity_type
      WHEN 'task' THEN
        v_notification_url := '/workspace/' || v_workspace_id || '/projects/' || COALESCE(v_project_id, '') || '/tasks/' || v_entity_id;
      WHEN 'project' THEN
        v_notification_url := '/workspace/' || v_workspace_id || '/projects/' || v_entity_id;
      WHEN 'comment' THEN
        v_notification_url := '/workspace/' || v_workspace_id || '/projects/' || COALESCE(v_project_id, '') || '/tasks/' || COALESCE(v_task_id, '');
      WHEN 'chat' THEN
        IF v_metadata->>'is_dm' = 'true' AND v_metadata->>'conversation_id' IS NOT NULL THEN
          v_notification_url := '/workspace/' || v_workspace_id || '/chat?dm=' || (v_metadata->>'conversation_id');
        ELSIF v_metadata->>'channel_id' IS NOT NULL THEN
          v_notification_url := '/workspace/' || v_workspace_id || '/chat?channel=' || (v_metadata->>'channel_id');
        ELSE
          v_notification_url := '/workspace/' || v_workspace_id || '/chat';
        END IF;
      ELSE
        v_notification_url := '/workspace/' || v_workspace_id;
    END CASE;

    -- Build the payload for the edge function
    v_payload := jsonb_build_object(
      'userId', NEW.user_id,
      'notification', jsonb_build_object(
        'id', NEW.id,
        'title', NEW.title,
        'body', NEW.body,
        'url', v_notification_url,
        'tag', NEW.type::text || '-' || v_entity_id
      )
    );

    -- Build the edge function URL
    v_url := 'https://hxbkqbvmyrfggkoybugz.supabase.co/functions/v1/send-push-notification';

    -- Call the edge function via pg_net
    PERFORM net.http_post(
      url := v_url,
      body := v_payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Make sure the trigger exists on the notifications table
DROP TRIGGER IF EXISTS on_notification_created_push ON public.notifications;
CREATE TRIGGER on_notification_created_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();
