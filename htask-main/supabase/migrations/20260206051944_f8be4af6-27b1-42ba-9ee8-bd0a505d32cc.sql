-- Create channels table for workspace chat
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_channels_workspace ON public.channels(workspace_id);
CREATE INDEX idx_messages_channel ON public.messages(channel_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Channels policies
CREATE POLICY "Workspace members can view channels"
ON public.channels FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can create channels"
ON public.channels FOR INSERT
WITH CHECK (has_workspace_role(workspace_id, auth.uid(), 'admin'::workspace_role));

CREATE POLICY "Admins can update channels"
ON public.channels FOR UPDATE
USING (has_workspace_role(workspace_id, auth.uid(), 'admin'::workspace_role));

CREATE POLICY "Admins can delete channels"
ON public.channels FOR DELETE
USING (has_workspace_role(workspace_id, auth.uid(), 'admin'::workspace_role));

-- Messages policies
CREATE POLICY "Workspace members can view messages"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.channels c 
    WHERE c.id = channel_id 
    AND is_workspace_member(c.workspace_id, auth.uid())
  )
);

CREATE POLICY "Workspace members can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.channels c 
    WHERE c.id = channel_id 
    AND is_workspace_member(c.workspace_id, auth.uid())
  )
);

CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE
USING (sender_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Function to create default general channel when workspace is created
CREATE OR REPLACE FUNCTION public.create_default_channel()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.channels (workspace_id, name, type)
  VALUES (NEW.id, 'general', 'general');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create default channel
CREATE TRIGGER on_workspace_created_channel
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_channel();