-- =============================================
-- CUSTOM STATUSES PER PROJECT
-- =============================================

-- Table for custom workflow statuses per project
CREATE TABLE public.project_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false, -- marks tasks as "done" when moved here
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Enable RLS
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view project statuses"
ON public.project_statuses FOR SELECT
USING (is_workspace_member(get_project_workspace(project_id), auth.uid()));

CREATE POLICY "Admins can manage project statuses"
ON public.project_statuses FOR INSERT
WITH CHECK (has_workspace_role(get_project_workspace(project_id), auth.uid(), 'admin'::workspace_role));

CREATE POLICY "Admins can update project statuses"
ON public.project_statuses FOR UPDATE
USING (has_workspace_role(get_project_workspace(project_id), auth.uid(), 'admin'::workspace_role));

CREATE POLICY "Admins can delete project statuses"
ON public.project_statuses FOR DELETE
USING (has_workspace_role(get_project_workspace(project_id), auth.uid(), 'admin'::workspace_role));

-- =============================================
-- CUSTOM FIELDS FOR TASKS
-- =============================================

-- Custom field types enum
CREATE TYPE public.custom_field_type AS ENUM ('text', 'number', 'date', 'select', 'checkbox', 'url');

-- Custom field definitions per project
CREATE TABLE public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type custom_field_type NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb, -- for select type: [{label, value, color}]
  is_required BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Custom field values for tasks
CREATE TABLE public.task_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number DECIMAL,
  value_date DATE,
  value_boolean BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, field_id)
);

-- Enable RLS
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_custom_field_values ENABLE ROW LEVEL SECURITY;

-- RLS for custom field definitions
CREATE POLICY "Users can view custom field definitions"
ON public.custom_field_definitions FOR SELECT
USING (is_workspace_member(get_project_workspace(project_id), auth.uid()));

CREATE POLICY "Admins can create custom field definitions"
ON public.custom_field_definitions FOR INSERT
WITH CHECK (has_workspace_role(get_project_workspace(project_id), auth.uid(), 'admin'::workspace_role));

CREATE POLICY "Admins can update custom field definitions"
ON public.custom_field_definitions FOR UPDATE
USING (has_workspace_role(get_project_workspace(project_id), auth.uid(), 'admin'::workspace_role));

CREATE POLICY "Admins can delete custom field definitions"
ON public.custom_field_definitions FOR DELETE
USING (has_workspace_role(get_project_workspace(project_id), auth.uid(), 'admin'::workspace_role));

-- Helper function for task custom fields
CREATE OR REPLACE FUNCTION public.get_task_project(p_task_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.tasks WHERE id = p_task_id
$$;

-- RLS for custom field values
CREATE POLICY "Users can view custom field values"
ON public.task_custom_field_values FOR SELECT
USING (is_workspace_member(get_project_workspace(get_task_project(task_id)), auth.uid()));

CREATE POLICY "Members can create custom field values"
ON public.task_custom_field_values FOR INSERT
WITH CHECK (has_workspace_role(get_project_workspace(get_task_project(task_id)), auth.uid(), 'member'::workspace_role));

CREATE POLICY "Members can update custom field values"
ON public.task_custom_field_values FOR UPDATE
USING (has_workspace_role(get_project_workspace(get_task_project(task_id)), auth.uid(), 'member'::workspace_role));

CREATE POLICY "Admins can delete custom field values"
ON public.task_custom_field_values FOR DELETE
USING (has_workspace_role(get_project_workspace(get_task_project(task_id)), auth.uid(), 'admin'::workspace_role));

-- =============================================
-- PROJECT TEMPLATES
-- =============================================

-- Template definitions (workspace level)
CREATE TABLE public.project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6366f1',
  is_public BOOLEAN NOT NULL DEFAULT false, -- visible to all workspaces if true
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Template statuses (workflow stages in template)
CREATE TABLE public.template_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false
);

-- Template custom field definitions
CREATE TABLE public.template_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type custom_field_type NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0
);

-- Template task definitions
CREATE TABLE public.template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status_position INTEGER NOT NULL DEFAULT 0, -- which status in workflow
  position INTEGER NOT NULL DEFAULT 0,
  days_offset INTEGER DEFAULT 0 -- days after project start for due date
);

-- Enable RLS
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_tasks ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.get_template_workspace(p_template_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.project_templates WHERE id = p_template_id
$$;

-- RLS for project_templates
CREATE POLICY "Users can view workspace templates"
ON public.project_templates FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()) OR is_public = true);

CREATE POLICY "Admins can create templates"
ON public.project_templates FOR INSERT
WITH CHECK (has_workspace_role(workspace_id, auth.uid(), 'admin'::workspace_role) AND created_by = auth.uid());

CREATE POLICY "Admins can update templates"
ON public.project_templates FOR UPDATE
USING (has_workspace_role(workspace_id, auth.uid(), 'admin'::workspace_role));

CREATE POLICY "Admins can delete templates"
ON public.project_templates FOR DELETE
USING (has_workspace_role(workspace_id, auth.uid(), 'admin'::workspace_role));

-- RLS for template_statuses
CREATE POLICY "Users can view template statuses"
ON public.template_statuses FOR SELECT
USING (is_workspace_member(get_template_workspace(template_id), auth.uid()));

CREATE POLICY "Admins can manage template statuses"
ON public.template_statuses FOR ALL
USING (has_workspace_role(get_template_workspace(template_id), auth.uid(), 'admin'::workspace_role));

-- RLS for template_custom_fields
CREATE POLICY "Users can view template fields"
ON public.template_custom_fields FOR SELECT
USING (is_workspace_member(get_template_workspace(template_id), auth.uid()));

CREATE POLICY "Admins can manage template fields"
ON public.template_custom_fields FOR ALL
USING (has_workspace_role(get_template_workspace(template_id), auth.uid(), 'admin'::workspace_role));

-- RLS for template_tasks
CREATE POLICY "Users can view template tasks"
ON public.template_tasks FOR SELECT
USING (is_workspace_member(get_template_workspace(template_id), auth.uid()));

CREATE POLICY "Admins can manage template tasks"
ON public.template_tasks FOR ALL
USING (has_workspace_role(get_template_workspace(template_id), auth.uid(), 'admin'::workspace_role));

-- =============================================
-- ADD CUSTOM STATUS REFERENCE TO TASKS
-- =============================================

-- Add custom_status_id to tasks table
ALTER TABLE public.tasks ADD COLUMN custom_status_id UUID REFERENCES public.project_statuses(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_tasks_custom_status ON public.tasks(custom_status_id);
CREATE INDEX idx_project_statuses_project ON public.project_statuses(project_id);
CREATE INDEX idx_custom_field_definitions_project ON public.custom_field_definitions(project_id);
CREATE INDEX idx_task_custom_field_values_task ON public.task_custom_field_values(task_id);
CREATE INDEX idx_project_templates_workspace ON public.project_templates(workspace_id);

-- Function to create default statuses for a new project
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
    (NEW.id, 'Done', '#22c55e', 3, false, true);
  RETURN NEW;
END;
$$;

-- Trigger to auto-create default statuses for new projects
CREATE TRIGGER create_project_default_statuses
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.create_default_project_statuses();

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE project_statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE custom_field_definitions;
ALTER PUBLICATION supabase_realtime ADD TABLE task_custom_field_values;