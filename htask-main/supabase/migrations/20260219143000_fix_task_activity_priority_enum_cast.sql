-- Fix enum cast error when logging task priority updates.
--
-- Root cause:
-- handle_task_activity() used COALESCE(OLD.priority, 'None') and
-- COALESCE(NEW.priority, 'None') where priority is task_priority enum.
-- PostgreSQL attempted to cast 'None' to task_priority and threw:
--   22P02 invalid input value for enum task_priority: "None"
--
-- This patch rewrites those expressions to cast enum values to text first.

DO $$
DECLARE
  fn_def text;
BEGIN
  SELECT pg_get_functiondef('public.handle_task_activity()'::regprocedure)
  INTO fn_def;

  IF fn_def IS NULL THEN
    RAISE NOTICE 'Function public.handle_task_activity() not found. Skipping patch.';
    RETURN;
  END IF;

  fn_def := replace(
    fn_def,
    'COALESCE(OLD.priority, ''None'')',
    'COALESCE(OLD.priority::text, ''None'')'
  );

  fn_def := replace(
    fn_def,
    'COALESCE(NEW.priority, ''None'')',
    'COALESCE(NEW.priority::text, ''None'')'
  );

  EXECUTE fn_def;
END;
$$;
