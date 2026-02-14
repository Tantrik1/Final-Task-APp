-- Allow all workspace members to create channels (not just admins)
DROP POLICY IF EXISTS "Admins can create channels" ON public.channels;
CREATE POLICY "Members can create channels"
ON public.channels
FOR INSERT
WITH CHECK (has_workspace_role(workspace_id, auth.uid(), 'member'::workspace_role));