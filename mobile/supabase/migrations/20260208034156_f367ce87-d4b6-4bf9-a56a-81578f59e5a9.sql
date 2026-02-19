-- Function to notify channel members when a message is sent
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
      COALESCE(v_sender_name, 'Someone') || ' in #' || v_channel_name,
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

-- Function to notify DM recipient when a message is sent
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
  
  -- Notify recipient
  PERFORM create_notification(
    v_workspace_id,
    v_recipient_id,
    NEW.sender_id,
    'chat_mention'::notification_type,
    'New message from ' || COALESCE(v_sender_name, 'Someone'),
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

-- Trigger for channel messages
CREATE TRIGGER on_channel_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_channel_message();

-- Trigger for DM messages  
CREATE TRIGGER on_dm_message_notify
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dm_message();