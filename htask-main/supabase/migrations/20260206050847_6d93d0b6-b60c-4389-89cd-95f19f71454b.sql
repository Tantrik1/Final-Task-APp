-- Allow anyone to read workspace invitations by token (for accepting invites)
CREATE POLICY "Anyone can read invitations by token"
ON public.workspace_invitations
FOR SELECT
USING (true);

-- Drop the old restrictive select policy for admins
DROP POLICY IF EXISTS "Owners and admins can view invitations" ON public.workspace_invitations;