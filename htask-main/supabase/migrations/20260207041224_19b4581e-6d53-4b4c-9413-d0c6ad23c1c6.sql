-- Create enum for channel member roles
CREATE TYPE public.channel_member_role AS ENUM ('admin', 'member');

-- Create channel_members table
CREATE TABLE public.channel_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role channel_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  added_by UUID REFERENCES public.profiles(id),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX idx_channel_members_channel_id ON public.channel_members(channel_id);
CREATE INDEX idx_channel_members_user_id ON public.channel_members(user_id);

-- Function to check if user is channel member
CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id AND user_id = p_user_id
  )
$$;

-- Function to check if user is channel admin
CREATE OR REPLACE FUNCTION public.is_channel_admin(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id 
      AND user_id = p_user_id 
      AND role = 'admin'
  )
$$;

-- Function to get channel's workspace_id (for RLS)
CREATE OR REPLACE FUNCTION public.get_channel_workspace(p_channel_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.channels WHERE id = p_channel_id
$$;

-- RLS Policies for channel_members

-- Users can view members of channels they're in (and workspace members can see general channel members)
CREATE POLICY "Channel members can view other members"
ON public.channel_members
FOR SELECT
USING (
  is_channel_member(channel_id, auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM public.channels c 
      WHERE c.id = channel_id 
        AND c.type = 'general'
        AND is_workspace_member(c.workspace_id, auth.uid())
    )
  )
);

-- Channel admins can add members
CREATE POLICY "Channel admins can add members"
ON public.channel_members
FOR INSERT
WITH CHECK (
  (is_channel_admin(channel_id, auth.uid()) OR 
   -- Creator of a new channel can add themselves
   (added_by = auth.uid() AND user_id = auth.uid()))
  AND is_workspace_member(get_channel_workspace(channel_id), user_id)
);

-- Channel admins can remove members (but not themselves if they're the only admin)
CREATE POLICY "Channel admins can remove members"
ON public.channel_members
FOR DELETE
USING (
  is_channel_admin(channel_id, auth.uid())
  AND user_id != auth.uid()
);

-- Channel admins can update member roles
CREATE POLICY "Channel admins can update member roles"
ON public.channel_members
FOR UPDATE
USING (is_channel_admin(channel_id, auth.uid()))
WITH CHECK (is_channel_admin(channel_id, auth.uid()));

-- Update messages RLS to check channel membership (for non-general channels)
DROP POLICY IF EXISTS "Workspace members can view messages" ON public.messages;
CREATE POLICY "Channel members can view messages"
ON public.messages
FOR SELECT
USING (
  is_channel_member(channel_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.channels c 
    WHERE c.id = channel_id 
      AND c.type = 'general'
      AND is_workspace_member(c.workspace_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Workspace members can send messages" ON public.messages;
CREATE POLICY "Channel members can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND (
    is_channel_member(channel_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.channels c 
      WHERE c.id = channel_id 
        AND c.type = 'general'
        AND is_workspace_member(c.workspace_id, auth.uid())
    )
  )
);

-- Update channel_read_status to check membership
DROP POLICY IF EXISTS "Users can insert own read status" ON public.channel_read_status;
CREATE POLICY "Users can insert own read status"
ON public.channel_read_status
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    is_channel_member(channel_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.channels c 
      WHERE c.id = channel_id 
        AND c.type = 'general'
        AND is_workspace_member(c.workspace_id, auth.uid())
    )
  )
);

-- Trigger to auto-add channel creator as admin
CREATE OR REPLACE FUNCTION public.add_channel_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id, role, added_by)
    VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by)
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_channel_created
AFTER INSERT ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.add_channel_creator_as_admin();

-- Auto-add all workspace members to general channel
CREATE OR REPLACE FUNCTION public.add_workspace_member_to_general_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.channel_members (channel_id, user_id, role, added_by)
  SELECT c.id, NEW.user_id, 'member', NEW.user_id
  FROM public.channels c
  WHERE c.workspace_id = NEW.workspace_id AND c.type = 'general'
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_workspace_member_added
AFTER INSERT ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.add_workspace_member_to_general_channel();