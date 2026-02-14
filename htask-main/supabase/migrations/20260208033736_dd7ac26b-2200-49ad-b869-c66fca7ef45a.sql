-- Create a function to trigger push notifications via HTTP
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_push_enabled BOOLEAN;
  v_has_subscription BOOLEAN;
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
    -- Use pg_notify to signal the edge function
    -- The notification payload includes the notification ID and user ID
    PERFORM pg_notify(
      'push_notification',
      json_build_object(
        'notification_id', NEW.id,
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', NEW.body,
        'workspace_id', NEW.workspace_id,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'metadata', NEW.metadata
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to call push notification function on new notifications
CREATE TRIGGER on_notification_created_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();