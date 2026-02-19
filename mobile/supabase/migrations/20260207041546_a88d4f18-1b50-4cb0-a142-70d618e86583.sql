-- Backfill: Add all existing workspace members to their general channels
INSERT INTO public.channel_members (channel_id, user_id, role, added_by)
SELECT c.id, wm.user_id, 
  CASE WHEN wm.role IN ('owner', 'admin') THEN 'admin'::channel_member_role ELSE 'member'::channel_member_role END,
  wm.user_id
FROM public.channels c
JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
WHERE c.type = 'general'
ON CONFLICT (channel_id, user_id) DO NOTHING;