
-- Phase 1a: Backfill missing subscriptions with Free plan
INSERT INTO public.workspace_subscriptions (workspace_id, plan_id, status, member_count)
SELECT w.id, 
  (SELECT id FROM public.subscription_plans WHERE position = 0 LIMIT 1),
  'active',
  (SELECT COUNT(*) FROM public.workspace_members WHERE workspace_id = w.id)
FROM public.workspaces w
LEFT JOIN public.workspace_subscriptions ws ON ws.workspace_id = w.id
WHERE ws.id IS NULL
  AND (SELECT id FROM public.subscription_plans WHERE position = 0 LIMIT 1) IS NOT NULL;

-- Phase 1b: Sync existing member_count values
UPDATE public.workspace_subscriptions ws
SET member_count = sub.cnt
FROM (
  SELECT workspace_id, COUNT(*)::int AS cnt
  FROM public.workspace_members
  GROUP BY workspace_id
) sub
WHERE sub.workspace_id = ws.workspace_id;

-- Phase 1c: Create trigger to auto-sync member_count
CREATE OR REPLACE FUNCTION public.sync_workspace_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_count INTEGER;
BEGIN
  v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  SELECT COUNT(*) INTO v_count 
  FROM public.workspace_members WHERE workspace_id = v_workspace_id;
  
  UPDATE public.workspace_subscriptions 
  SET member_count = v_count, updated_at = now()
  WHERE workspace_id = v_workspace_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER on_member_change_sync_count
  AFTER INSERT OR DELETE ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_workspace_member_count();

-- Phase 1d: Fix storage RLS for payment-screenshots bucket
DO $$
BEGIN
  -- Drop existing policies if they exist
  BEGIN
    DROP POLICY IF EXISTS "Users can upload payment screenshots" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS "Users can view their payment screenshots" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS "Workspace members can view payment screenshots" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

-- Allow authenticated users to upload to payment-screenshots
CREATE POLICY "Authenticated users can upload payment screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-screenshots'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to view payment screenshots
CREATE POLICY "Authenticated users can view payment screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-screenshots'
  AND auth.role() = 'authenticated'
);
