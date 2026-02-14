-- =============================================
-- 1. VIEW ALL MEMBERS OF YOUR WORKSPACE
-- =============================================
-- Run this first to verify your members:
SELECT 
  wm.user_id,
  p.full_name,
  p.email,
  wm.role
FROM public.workspace_members wm
JOIN public.profiles p ON p.id = wm.user_id
WHERE wm.workspace_id = '4aa567a3-64b0-47e9-93d1-5d05fb49fdda'
ORDER BY wm.role, p.full_name;

-- =============================================
-- 2. VIEW ALL TASKS IN THIS WORKSPACE'S PROJECTS
-- =============================================
-- Run this to verify your tasks:
SELECT 
  t.id AS task_id,
  t.title,
  t.assigned_to,
  pr.name AS project_name
FROM public.tasks t
JOIN public.projects pr ON pr.id = t.project_id
WHERE pr.workspace_id = '4aa567a3-64b0-47e9-93d1-5d05fb49fdda'
ORDER BY pr.name, t.title;

-- =============================================
-- 3. INSERT ALL MEMBERS AS ASSIGNEES FOR ALL TASKS
-- =============================================
-- This cross-joins every task in the workspace with every member,
-- inserting into task_assignees. ON CONFLICT skips duplicates.
INSERT INTO public.task_assignees (task_id, user_id, assigned_by)
SELECT 
  t.id AS task_id,
  wm.user_id AS user_id,
  (SELECT user_id FROM public.workspace_members 
   WHERE workspace_id = '4aa567a3-64b0-47e9-93d1-5d05fb49fdda' 
   AND role = 'owner' LIMIT 1) AS assigned_by
FROM public.tasks t
JOIN public.projects pr ON pr.id = t.project_id
CROSS JOIN public.workspace_members wm
WHERE pr.workspace_id = '4aa567a3-64b0-47e9-93d1-5d05fb49fdda'
  AND wm.workspace_id = '4aa567a3-64b0-47e9-93d1-5d05fb49fdda'
ON CONFLICT (task_id, user_id) DO NOTHING;

-- =============================================
-- 4. UPDATE assigned_to ON TASKS (set first member for legacy compat)
-- =============================================
-- Sets assigned_to to the first assignee for each task (for backward compatibility)
UPDATE public.tasks t
SET assigned_to = (
  SELECT ta.user_id 
  FROM public.task_assignees ta 
  WHERE ta.task_id = t.id 
  ORDER BY ta.assigned_at ASC 
  LIMIT 1
)
WHERE t.project_id IN (
  SELECT id FROM public.projects 
  WHERE workspace_id = '4aa567a3-64b0-47e9-93d1-5d05fb49fdda'
);

-- =============================================
-- 5. REMOVE the old assigned_to column (OPTIONAL - DO NOT RUN YET)
-- =============================================
-- Only run this AFTER confirming everything works with task_assignees:
-- ALTER TABLE public.tasks DROP COLUMN IF EXISTS assigned_to;
