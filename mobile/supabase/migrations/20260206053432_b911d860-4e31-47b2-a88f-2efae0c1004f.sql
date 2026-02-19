-- Create task_comments table with replies support
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  parent_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_attachments table
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_links table
CREATE TABLE public.task_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_parent_id ON public.task_comments(parent_id);
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX idx_task_links_task_id ON public.task_links(task_id);

-- RLS Policies for task_comments
CREATE POLICY "Users can view comments on workspace tasks"
ON public.task_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND is_workspace_member(get_project_workspace(t.project_id), auth.uid())
  )
);

CREATE POLICY "Members can create comments"
ON public.task_comments FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND has_workspace_role(get_project_workspace(t.project_id), auth.uid(), 'member'::workspace_role)
  )
);

CREATE POLICY "Users can update own comments"
ON public.task_comments FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments or admins"
ON public.task_comments FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND has_workspace_role(get_project_workspace(t.project_id), auth.uid(), 'admin'::workspace_role)
  )
);

-- RLS Policies for task_attachments
CREATE POLICY "Users can view attachments on workspace tasks"
ON public.task_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND is_workspace_member(get_project_workspace(t.project_id), auth.uid())
  )
);

CREATE POLICY "Members can create attachments"
ON public.task_attachments FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND has_workspace_role(get_project_workspace(t.project_id), auth.uid(), 'member'::workspace_role)
  )
);

CREATE POLICY "Users can delete own attachments or admins"
ON public.task_attachments FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
    AND has_workspace_role(get_project_workspace(t.project_id), auth.uid(), 'admin'::workspace_role)
  )
);

-- RLS Policies for task_links
CREATE POLICY "Users can view links on workspace tasks"
ON public.task_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_links.task_id
    AND is_workspace_member(get_project_workspace(t.project_id), auth.uid())
  )
);

CREATE POLICY "Members can create links"
ON public.task_links FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_links.task_id
    AND has_workspace_role(get_project_workspace(t.project_id), auth.uid(), 'member'::workspace_role)
  )
);

CREATE POLICY "Users can delete own links or admins"
ON public.task_links FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_links.task_id
    AND has_workspace_role(get_project_workspace(t.project_id), auth.uid(), 'admin'::workspace_role)
  )
);

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', false);

-- Storage policies for task-attachments bucket
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view attachments they have access to"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

-- Trigger for updated_at on comments
CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();