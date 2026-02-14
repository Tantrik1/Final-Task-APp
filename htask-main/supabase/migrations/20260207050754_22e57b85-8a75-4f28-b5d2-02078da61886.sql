-- Add new custom field types
ALTER TYPE public.custom_field_type ADD VALUE IF NOT EXISTS 'currency';
ALTER TYPE public.custom_field_type ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE public.custom_field_type ADD VALUE IF NOT EXISTS 'multiselect';
ALTER TYPE public.custom_field_type ADD VALUE IF NOT EXISTS 'file';

-- Add is_system flag to project_templates
ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Create template_views table
CREATE TABLE IF NOT EXISTS public.template_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  view_type TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false
);

-- Create project_views table
CREATE TABLE IF NOT EXISTS public.project_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  view_type TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.template_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_views ENABLE ROW LEVEL SECURITY;

-- RLS policies for template_views
CREATE POLICY "Users can view template views"
ON public.template_views FOR SELECT
USING (is_workspace_member(get_template_workspace(template_id), auth.uid()));

CREATE POLICY "Admins can manage template views"
ON public.template_views FOR ALL
USING (has_workspace_role(get_template_workspace(template_id), auth.uid(), 'admin'::workspace_role));

-- RLS policies for project_views
CREATE POLICY "Users can view project views"
ON public.project_views FOR SELECT
USING (is_workspace_member(get_project_workspace(project_id), auth.uid()));

CREATE POLICY "Members can create project views"
ON public.project_views FOR INSERT
WITH CHECK (has_workspace_role(get_project_workspace(project_id), auth.uid(), 'member'::workspace_role));

CREATE POLICY "Members can update project views"
ON public.project_views FOR UPDATE
USING (has_workspace_role(get_project_workspace(project_id), auth.uid(), 'member'::workspace_role));

CREATE POLICY "Admins can delete project views"
ON public.project_views FOR DELETE
USING (has_workspace_role(get_project_workspace(project_id), auth.uid(), 'admin'::workspace_role));

-- Add trigger for updated_at on project_views
CREATE TRIGGER update_project_views_updated_at
  BEFORE UPDATE ON public.project_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for project_views
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_views;