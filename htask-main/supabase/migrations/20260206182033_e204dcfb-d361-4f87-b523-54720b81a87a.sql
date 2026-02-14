-- Add RLS policy to allow invited users to accept their own invitation
-- This is a backup policy in case the edge function approach fails

CREATE POLICY "Invited users can accept their invitation"
ON public.workspace_members FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.workspace_invitations wi
    WHERE wi.workspace_id = workspace_members.workspace_id
    AND wi.email = auth.email()
    AND wi.expires_at > now()
  )
);

-- Also add a function to cleanup expired invitations
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.workspace_invitations 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;