-- =====================================================
-- PHASE 1: CHAT SYSTEM DATABASE SCHEMA UPDATES
-- =====================================================

-- 1. Add reply support and editing to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- 2. Enhance channels table
ALTER TABLE public.channels
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- 3. Create channel_read_status table for tracking unread messages
CREATE TABLE IF NOT EXISTS public.channel_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS on channel_read_status
ALTER TABLE public.channel_read_status ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for channel_read_status
CREATE POLICY "Users can view own read status"
ON public.channel_read_status
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own read status"
ON public.channel_read_status
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_read_status.channel_id
    AND is_workspace_member(c.workspace_id, auth.uid())
  )
);

CREATE POLICY "Users can update own read status"
ON public.channel_read_status
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own read status"
ON public.channel_read_status
FOR DELETE
USING (user_id = auth.uid());

-- 5. Add UPDATE policy to messages for editing own messages
CREATE POLICY "Users can update own messages"
ON public.messages
FOR UPDATE
USING (sender_id = auth.uid());

-- 6. Create index for faster message queries
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_read_status_user ON public.channel_read_status(user_id, channel_id);

-- 7. Function to get unread count for a channel
CREATE OR REPLACE FUNCTION public.get_channel_unread_count(p_channel_id UUID, p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.messages m
  WHERE m.channel_id = p_channel_id
    AND m.sender_id != p_user_id
    AND m.created_at > COALESCE(
      (SELECT last_read_at FROM public.channel_read_status 
       WHERE channel_id = p_channel_id AND user_id = p_user_id),
      '1970-01-01'::timestamp with time zone
    )
$$;