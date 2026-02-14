-- Add policy for owners and admins to view invitations (re-creating with proper restriction for management UI)
CREATE POLICY "Owners and admins can manage invitations"
ON public.workspace_invitations
FOR SELECT
USING (has_workspace_role(workspace_id, auth.uid(), 'admin'::workspace_role));