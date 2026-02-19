-- Add time tracking fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS first_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_work_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_timer_running BOOLEAN DEFAULT false;

-- Create task_sessions table for work sessions
CREATE TABLE public.task_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  session_type TEXT NOT NULL DEFAULT 'start' CHECK (session_type IN ('start', 'resume')),
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_task_sessions_task_id ON public.task_sessions(task_id);
CREATE INDEX idx_task_sessions_user_id ON public.task_sessions(user_id);

-- Enable RLS
ALTER TABLE public.task_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_sessions
CREATE POLICY "Users can view sessions on workspace tasks"
ON public.task_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_sessions.task_id
    AND is_workspace_member(get_project_workspace(t.project_id), auth.uid())
  )
);

CREATE POLICY "Members can create sessions"
ON public.task_sessions
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_sessions.task_id
    AND has_workspace_role(get_project_workspace(t.project_id), auth.uid(), 'member'::workspace_role)
  )
);

CREATE POLICY "Users can update own sessions"
ON public.task_sessions
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
ON public.task_sessions
FOR DELETE
USING (user_id = auth.uid());