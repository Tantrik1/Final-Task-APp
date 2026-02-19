-- Create default general channel for existing workspaces that don't have one
INSERT INTO public.channels (workspace_id, name, type)
SELECT w.id, 'general', 'general'
FROM public.workspaces w
LEFT JOIN public.channels c ON c.workspace_id = w.id
WHERE c.id IS NULL;