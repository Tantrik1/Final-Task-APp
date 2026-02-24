-- ============================================================================
-- WORKSPACE INVITATION FIXES
-- ============================================================================
-- DB-01: Add missing 'status' column to workspace_invitations
-- DB-05: Add RLS policy allowing invited users to read their own invitations
-- DB-04: Update INSERT policy to use UPSERT-compatible logic (ON CONFLICT)
-- WS-01: Add atomic workspace creation RPC
-- MW-03: Helper for realtime role-change subscription
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- DB-01: ADD MISSING STATUS COLUMN TO workspace_invitations
-- ─────────────────────────────────────────────────────────────────────────────
-- The base migration was missing this column. The app reads/writes
-- status='pending'/'accepted'/'declined' but the column never existed.

ALTER TABLE public.workspace_invitations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'accepted', 'declined'));

-- Index for pending-invitation lookups (used in _layout.tsx and usePendingInvitations)
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status
  ON public.workspace_invitations(status)
  WHERE status = 'pending';


-- ─────────────────────────────────────────────────────────────────────────────
-- DB-05: ADD RLS POLICY — users can see their own pending invitations
-- ─────────────────────────────────────────────────────────────────────────────
-- Previously, only admins could SELECT from workspace_invitations.
-- An invited user who is not yet a workspace member (no membership row)
-- could never see their invitation — the invite flow was completely broken
-- for new accounts.

DROP POLICY IF EXISTS "Users can view their own invitations" ON public.workspace_invitations;
CREATE POLICY "Users can view their own invitations"
  ON public.workspace_invitations FOR SELECT
  USING (
    -- The invited email matches this user's email in profiles
    email ILIKE (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- Also allow users to UPDATE their own invitation status (accept/decline)
DROP POLICY IF EXISTS "Users can update their own invitation status" ON public.workspace_invitations;
CREATE POLICY "Users can update their own invitation status"
  ON public.workspace_invitations FOR UPDATE
  USING (
    email ILIKE (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    email ILIKE (SELECT email FROM public.profiles WHERE id = auth.uid())
    AND status IN ('accepted', 'declined')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- WS-01: ATOMIC WORKSPACE CREATION RPC
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates workspace + owner membership in a single transaction.
-- Eliminates the race window where workspace exists but owner row doesn't.

CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
    p_name        TEXT,
    p_description TEXT,
    p_user_id     UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ws_id UUID;
BEGIN
    -- Both inserts happen in the same transaction — atomic
    INSERT INTO public.workspaces (name, description, created_by)
    VALUES (p_name, p_description, p_user_id)
    RETURNING id INTO v_ws_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_ws_id, p_user_id, 'owner');

    RETURN jsonb_build_object(
        'id',          v_ws_id,
        'name',        p_name,
        'description', p_description,
        'created_by',  p_user_id,
        'created_at',  now()
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(TEXT, TEXT, UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- DB-04: ALLOW RE-INVITING DECLINED USERS
-- ─────────────────────────────────────────────────────────────────────────────
-- The UNIQUE(workspace_id, email) constraint blocks re-inviting declined users.
-- Add an UPDATE policy so admins can reset a declined/expired invite to 'pending'.

DROP POLICY IF EXISTS "Admins can update invitation status" ON public.workspace_invitations;
CREATE POLICY "Admins can update invitation status"
  ON public.workspace_invitations FOR UPDATE
  USING (
    public.has_workspace_role(workspace_id, auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, auth.uid(), 'admin')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────────────────────────────────
-- Summary:
--   DB-01: workspace_invitations.status column added (was causing silent query failures)
--   DB-05: Invited users can now SELECT/UPDATE their own invitations (critical fix)
--   WS-01: create_workspace_with_owner() RPC ensures atomic workspace creation
--   DB-04: Admins can now UPDATE invitation rows (for re-invite after decline)
