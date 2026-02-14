-- Create dm_conversations table for 1:1 direct messages
CREATE TABLE public.dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, participant_1, participant_2)
);

-- Create dm_messages table for direct messages
CREATE TABLE public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dm_read_status table for tracking read messages
CREATE TABLE public.dm_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_dm_conversations_workspace ON public.dm_conversations(workspace_id);
CREATE INDEX idx_dm_conversations_participants ON public.dm_conversations(participant_1, participant_2);
CREATE INDEX idx_dm_messages_conversation ON public.dm_messages(conversation_id, created_at DESC);
CREATE INDEX idx_dm_read_status_user ON public.dm_read_status(user_id);

-- Helper function to check if user is a participant in a DM conversation
CREATE OR REPLACE FUNCTION is_dm_participant(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.dm_conversations
    WHERE id = p_conversation_id
    AND (participant_1 = p_user_id OR participant_2 = p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function to get DM workspace
CREATE OR REPLACE FUNCTION get_dm_workspace(p_conversation_id UUID)
RETURNS UUID AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.dm_conversations
  WHERE id = p_conversation_id;
  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function to get unread DM count
CREATE OR REPLACE FUNCTION get_dm_unread_count(p_conversation_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_last_read TIMESTAMP WITH TIME ZONE;
  v_count INTEGER;
BEGIN
  SELECT last_read_at INTO v_last_read
  FROM public.dm_read_status
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
  
  IF v_last_read IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.dm_messages
    WHERE conversation_id = p_conversation_id AND sender_id != p_user_id;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM public.dm_messages
    WHERE conversation_id = p_conversation_id 
      AND sender_id != p_user_id
      AND created_at > v_last_read;
  END IF;
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable RLS on all DM tables
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_read_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dm_conversations
CREATE POLICY "Users can view their DM conversations"
ON public.dm_conversations FOR SELECT
USING (
  (participant_1 = auth.uid() OR participant_2 = auth.uid())
  AND is_workspace_member(workspace_id, auth.uid())
);

CREATE POLICY "Users can create DM conversations with workspace members"
ON public.dm_conversations FOR INSERT
WITH CHECK (
  (participant_1 = auth.uid() OR participant_2 = auth.uid())
  AND is_workspace_member(workspace_id, auth.uid())
  AND is_workspace_member(workspace_id, participant_1)
  AND is_workspace_member(workspace_id, participant_2)
);

CREATE POLICY "Users can delete their DM conversations"
ON public.dm_conversations FOR DELETE
USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- RLS Policies for dm_messages
CREATE POLICY "DM participants can view messages"
ON public.dm_messages FOR SELECT
USING (is_dm_participant(conversation_id, auth.uid()));

CREATE POLICY "DM participants can send messages"
ON public.dm_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND is_dm_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can edit own DM messages"
ON public.dm_messages FOR UPDATE
USING (sender_id = auth.uid());

CREATE POLICY "Users can delete own DM messages"
ON public.dm_messages FOR DELETE
USING (sender_id = auth.uid());

-- RLS Policies for dm_read_status
CREATE POLICY "Users can view own DM read status"
ON public.dm_read_status FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own DM read status"
ON public.dm_read_status FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND is_dm_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can update own DM read status"
ON public.dm_read_status FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own DM read status"
ON public.dm_read_status FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime for DM tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;