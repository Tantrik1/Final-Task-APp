-- =============================================
-- 1. CREATE TASK_ASSIGNEES TABLE (run this FIRST)
-- =============================================
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON public.task_assignees(user_id);

-- RLS policies for task_assignees
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task assignees in their workspace"
  ON public.task_assignees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
      WHERE t.id = task_assignees.task_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage task assignees in their workspace"
  ON public.task_assignees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
      WHERE t.id = task_assignees.task_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove task assignees in their workspace"
  ON public.task_assignees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON t.project_id = p.id
      JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
      WHERE t.id = task_assignees.task_id AND wm.user_id = auth.uid()
    )
  );

-- Migrate existing assigned_to data into task_assignees
INSERT INTO public.task_assignees (task_id, user_id, assigned_by)
SELECT id, assigned_to, created_by
FROM public.tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- =============================================
-- 2. ENABLE SUPABASE REALTIME ON ALL PROJECT/TASK TABLES
-- =============================================

-- Core tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_statuses;

-- Task detail tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_work_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;

-- Notifications / activity
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Optional: workspace-level tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
