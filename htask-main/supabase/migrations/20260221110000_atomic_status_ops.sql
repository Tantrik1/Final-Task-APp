-- ============================================================
-- Migration: Atomic status operations (P-02 + P-03)
-- Created: 2026-02-21
-- 
-- Adds two RPCs to replace non-atomic multi-round-trip operations
-- in useProjectStatuses.ts:
--   1. reorder_project_statuses  — replaces N parallel UPDATEs
--   2. delete_status_and_reassign — replaces count→reassign→delete (3 steps)
-- ============================================================

-- ─── RPC 1: Reorder Project Statuses ────────────────────────
-- P-02: Atomically update all status positions in a single PL/pgSQL loop.
-- Replaces the N parallel supabase.from().update() calls in useProjectStatuses.reorderStatuses().
CREATE OR REPLACE FUNCTION public.reorder_project_statuses(
    p_project_id UUID,
    p_ordered_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id  UUID;
    v_pos INTEGER := 0;
BEGIN
    -- Verify the caller has access to this project's workspace
    -- (RLS on project_statuses still applies for the caller's role,
    --  but SECURITY DEFINER bypasses it — guard manually)
    IF NOT EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
        WHERE p.id = p_project_id
          AND wm.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied to project %', p_project_id;
    END IF;

    FOREACH v_id IN ARRAY p_ordered_ids LOOP
        UPDATE public.project_statuses
        SET    position = v_pos,
               updated_at = now()
        WHERE  id = v_id
          AND  project_id = p_project_id;
        v_pos := v_pos + 1;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_project_statuses(UUID, UUID[]) TO authenticated;

-- ─── RPC 2: Delete Status and Reassign Tasks ─────────────────
-- P-03: Atomically reassign tasks from a deleted status to a fallback status,
--       then delete the status row — all in one transaction.
-- Replaces the 3-step count→reassign→delete in useProjectStatuses.deleteStatus().
CREATE OR REPLACE FUNCTION public.delete_status_and_reassign(
    p_status_id   UUID,
    p_fallback_id UUID   -- must belong to the same project; NULL = fail with explicit error
)
RETURNS INTEGER  -- number of tasks reassigned
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project_id      UUID;
    v_fallback_project UUID;
    v_reassigned      INTEGER;
BEGIN
    -- Resolve project for the status being deleted
    SELECT project_id INTO v_project_id
    FROM   public.project_statuses
    WHERE  id = p_status_id;

    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'Status % not found', p_status_id;
    END IF;

    -- Guard: fallback must be in the same project
    SELECT project_id INTO v_fallback_project
    FROM   public.project_statuses
    WHERE  id = p_fallback_id;

    IF v_fallback_project IS NULL OR v_fallback_project != v_project_id THEN
        RAISE EXCEPTION 'Fallback status must belong to the same project';
    END IF;

    -- Guard: cannot delete the fallback itself
    IF p_status_id = p_fallback_id THEN
        RAISE EXCEPTION 'Status ID and fallback ID must be different';
    END IF;

    -- Verify the caller has access to this project
    IF NOT EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
        WHERE p.id = v_project_id
          AND wm.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied to project %', v_project_id;
    END IF;

    -- Atomically reassign all tasks that use the deleted status
    UPDATE public.tasks
    SET    custom_status_id = p_fallback_id,
           updated_at       = now()
    WHERE  custom_status_id = p_status_id;

    GET DIAGNOSTICS v_reassigned = ROW_COUNT;

    -- Delete the status row (same transaction — safe)
    DELETE FROM public.project_statuses WHERE id = p_status_id;

    RETURN COALESCE(v_reassigned, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_status_and_reassign(UUID, UUID) TO authenticated;
