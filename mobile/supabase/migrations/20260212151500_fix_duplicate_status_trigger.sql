-- Fix: Drop duplicate trigger and make default status creation idempotent
-- Root cause: Two triggers (create_project_default_statuses + on_project_created_add_default_statuses)
-- both fire on project INSERT, causing double inserts. The function also lacks ON CONFLICT handling,
-- which causes unique constraint violations when template statuses overlap with defaults.

-- Drop the duplicate trigger added in migration 20260207072404
DROP TRIGGER IF EXISTS on_project_created_add_default_statuses ON public.projects;

-- Recreate the function with ON CONFLICT DO NOTHING for idempotency
CREATE OR REPLACE FUNCTION public.create_default_project_statuses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_statuses (project_id, name, color, position, is_default, is_completed)
  VALUES
    (NEW.id, 'To Do', '#94a3b8', 0, true, false),
    (NEW.id, 'In Progress', '#f97316', 1, false, false),
    (NEW.id, 'Review', '#8b5cf6', 2, false, false),
    (NEW.id, 'Done', '#22c55e', 3, false, true)
  ON CONFLICT (project_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;
