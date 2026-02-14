import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SYSTEM_TEMPLATES, SystemTemplate } from '@/data/systemTemplates';

export type ExtendedFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url' | 'currency' | 'user' | 'multiselect' | 'file';

export interface ProjectTemplate {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  is_public: boolean;
  is_system?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateStatus {
  id: string;
  template_id: string;
  name: string;
  color: string;
  position: number;
  is_default: boolean;
  is_completed: boolean;
}

export interface TemplateCustomField {
  id: string;
  template_id: string;
  name: string;
  field_type: ExtendedFieldType;
  options: Array<{ label: string; value: string; color?: string }>;
  is_required: boolean;
  position: number;
}

export interface TemplateTask {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status_position: number;
  position: number;
  days_offset: number;
}

export interface TemplateView {
  id: string;
  template_id: string;
  name: string;
  view_type: 'kanban' | 'list' | 'calendar';
  config: Record<string, string>;
  position: number;
  is_default: boolean;
}

export interface TemplateWithDetails extends ProjectTemplate {
  statuses: TemplateStatus[];
  custom_fields: TemplateCustomField[];
  tasks: TemplateTask[];
  views: TemplateView[];
}

export function useProjectTemplates(workspaceId: string | undefined) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    statuses?: Omit<TemplateStatus, 'id' | 'template_id'>[];
    custom_fields?: Omit<TemplateCustomField, 'id' | 'template_id'>[];
    tasks?: Omit<TemplateTask, 'id' | 'template_id'>[];
  }) => {
    if (!workspaceId || !user) return null;

    try {
      // Create template
      const { data: template, error: templateError } = await supabase
        .from('project_templates')
        .insert([{
          workspace_id: workspaceId,
          name: data.name,
          description: data.description || null,
          icon: data.icon || 'folder',
          color: data.color || '#6366f1',
          created_by: user.id,
        }])
        .select()
        .single();

      if (templateError) throw templateError;

      // Create statuses if provided
      if (data.statuses && data.statuses.length > 0) {
        const { error } = await supabase
          .from('template_statuses')
          .insert(data.statuses.map(s => ({
            ...s,
            template_id: template.id,
          })));
        if (error) throw error;
      }

      // Create custom fields if provided  
      if (data.custom_fields && data.custom_fields.length > 0) {
        const { error } = await supabase
          .from('template_custom_fields')
          .insert(data.custom_fields.map(f => ({
            ...f,
            template_id: template.id,
            options: JSON.parse(JSON.stringify(f.options || [])),
          })));
        if (error) throw error;
      }

      // Create tasks if provided
      if (data.tasks && data.tasks.length > 0) {
        const { error } = await supabase
          .from('template_tasks')
          .insert(data.tasks.map(t => ({
            ...t,
            template_id: template.id,
          })));
        if (error) throw error;
      }

      toast({ title: '✅ Template created' });
      fetchTemplates();
      return template;
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  const getTemplateDetails = async (templateId: string): Promise<TemplateWithDetails | null> => {
    try {
      const [templateResult, statusesResult, fieldsResult, tasksResult] = await Promise.all([
        supabase.from('project_templates').select('*').eq('id', templateId).single(),
        supabase.from('template_statuses').select('*').eq('template_id', templateId).order('position'),
        supabase.from('template_custom_fields').select('*').eq('template_id', templateId).order('position'),
        supabase.from('template_tasks').select('*').eq('template_id', templateId).order('position'),
      ]);

      if (templateResult.error) throw templateResult.error;

      return {
        ...templateResult.data,
        statuses: statusesResult.data || [],
        custom_fields: (fieldsResult.data || []).map(f => ({
          ...f,
          options: (Array.isArray(f.options) ? f.options : []) as TemplateCustomField['options'],
        })),
        tasks: tasksResult.data || [],
      } as TemplateWithDetails;
    } catch (error) {
      console.error('Error fetching template details:', error);
      return null;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: '🗑️ Template deleted' });
      fetchTemplates();
      return true;
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  // Create project from a database template
  const createProjectFromTemplate = async (templateId: string, projectName: string): Promise<string | null> => {
    if (!workspaceId || !user) return null;

    try {
      const template = await getTemplateDetails(templateId);
      if (!template) throw new Error('Template not found');

      return await applyTemplateToProject(template, projectName);
    } catch (error: any) {
      console.error('Error creating project from template:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  // Create project from a system template (hardcoded)
  const createProjectFromSystemTemplate = async (systemTemplate: SystemTemplate, projectName: string): Promise<string | null> => {
    if (!workspaceId || !user) return null;

    try {
      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([{
          workspace_id: workspaceId,
          name: projectName,
          description: systemTemplate.description,
          icon: systemTemplate.icon,
          color: systemTemplate.color,
          created_by: user.id,
        }])
        .select()
        .single();

      if (projectError) throw projectError;

      // Delete auto-created default statuses (trigger creates them automatically)
      await supabase
        .from('project_statuses')
        .delete()
        .eq('project_id', project.id);

      // Create template statuses
      const { error: statusError } = await supabase
        .from('project_statuses')
        .insert(systemTemplate.statuses.map(s => ({
          project_id: project.id,
          name: s.name,
          color: s.color,
          position: s.position,
          is_default: s.is_default || false,
          is_completed: s.is_completed || false,
        })));
      if (statusError) throw statusError;

      // Create custom fields with proper options format
      if (systemTemplate.fields.length > 0) {
        const { error: fieldError } = await supabase
          .from('custom_field_definitions')
          .insert(systemTemplate.fields.map((f, index) => ({
            project_id: project.id,
            name: f.name,
            field_type: f.field_type as any,
            options: f.options ? f.options.map(opt => ({ label: opt, value: opt.toLowerCase().replace(/\s+/g, '-') })) : [],
            is_required: f.is_required || false,
            position: index,
          })));
        if (fieldError) throw fieldError;
      }

      // Create project views
      if (systemTemplate.views.length > 0) {
        const { error: viewError } = await supabase
          .from('project_views')
          .insert(systemTemplate.views.map((v, index) => ({
            project_id: project.id,
            name: v.name,
            view_type: v.view_type,
            config: v.config || {},
            position: index,
            is_default: v.is_default || false,
          })));
        if (viewError) throw viewError;
      }

      toast({ title: '🎉 Project created from template' });
      return project.id;
    } catch (error: any) {
      console.error('Error creating project from system template:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  // Helper to apply template data to a new project
  const applyTemplateToProject = async (template: TemplateWithDetails, projectName: string): Promise<string | null> => {
    if (!workspaceId || !user) return null;

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert([{
        workspace_id: workspaceId,
        name: projectName,
        description: template.description,
        icon: template.icon,
        color: template.color,
        created_by: user.id,
      }])
      .select()
      .single();

    if (projectError) throw projectError;

    // Delete auto-created default statuses if template has custom ones
    if (template.statuses.length > 0) {
      await supabase
        .from('project_statuses')
        .delete()
        .eq('project_id', project.id);

      // Create template statuses
      const { error } = await supabase
        .from('project_statuses')
        .insert(template.statuses.map(s => ({
          project_id: project.id,
          name: s.name,
          color: s.color,
          position: s.position,
          is_default: s.is_default,
          is_completed: s.is_completed,
        })));
      if (error) throw error;
    }

    // Create custom fields
    if (template.custom_fields.length > 0) {
      const { error } = await supabase
        .from('custom_field_definitions')
        .insert(template.custom_fields.map(f => ({
          project_id: project.id,
          name: f.name,
          field_type: f.field_type as any,
          options: JSON.parse(JSON.stringify(f.options || [])),
          is_required: f.is_required,
          position: f.position,
        })));
      if (error) throw error;
    }

    // Create views
    if (template.views && template.views.length > 0) {
      const { error } = await supabase
        .from('project_views')
        .insert(template.views.map(v => ({
          project_id: project.id,
          name: v.name,
          view_type: v.view_type,
          config: v.config || {},
          position: v.position,
          is_default: v.is_default,
        })));
      if (error) throw error;
    }

    // Create tasks
    if (template.tasks.length > 0) {
      const today = new Date();
      const { error } = await supabase
        .from('tasks')
        .insert(template.tasks.map(t => {
          const dueDate = t.days_offset
            ? new Date(today.getTime() + t.days_offset * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : null;
          return {
            project_id: project.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            position: t.position,
            due_date: dueDate,
            created_by: user.id,
          };
        }));
      if (error) throw error;
    }

    toast({ title: '🎉 Project created from template' });
    return project.id;
  };

  const saveProjectAsTemplate = async (projectId: string, templateName: string): Promise<string | null> => {
    if (!workspaceId || !user) return null;

    try {
      // Fetch project data
      const [projectResult, statusesResult, fieldsResult, tasksResult] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_statuses').select('*').eq('project_id', projectId).order('position'),
        supabase.from('custom_field_definitions').select('*').eq('project_id', projectId).order('position'),
        supabase.from('tasks').select('*').eq('project_id', projectId).order('position'),
      ]);

      if (projectResult.error) throw projectResult.error;
      const project = projectResult.data;

      // Create template
      const { data: template, error: templateError } = await supabase
        .from('project_templates')
        .insert([{
          workspace_id: workspaceId,
          name: templateName,
          description: project.description,
          icon: project.icon,
          color: project.color,
          created_by: user.id,
        }])
        .select()
        .single();

      if (templateError) throw templateError;

      // Copy statuses
      if (statusesResult.data && statusesResult.data.length > 0) {
        await supabase
          .from('template_statuses')
          .insert(statusesResult.data.map(s => ({
            template_id: template.id,
            name: s.name,
            color: s.color,
            position: s.position,
            is_default: s.is_default,
            is_completed: s.is_completed,
          })));
      }

      // Copy custom fields
      if (fieldsResult.data && fieldsResult.data.length > 0) {
        await supabase
          .from('template_custom_fields')
          .insert(fieldsResult.data.map(f => ({
            template_id: template.id,
            name: f.name,
            field_type: f.field_type,
            options: f.options,
            is_required: f.is_required,
            position: f.position,
          })));
      }

      // Copy tasks (without dates)
      if (tasksResult.data && tasksResult.data.length > 0) {
        await supabase
          .from('template_tasks')
          .insert(tasksResult.data.map(t => ({
            template_id: template.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            position: t.position,
            days_offset: 0,
          })));
      }

      toast({ title: '✅ Project saved as template' });
      fetchTemplates();
      return template.id;
    } catch (error: any) {
      console.error('Error saving project as template:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  return {
    templates,
    systemTemplates: SYSTEM_TEMPLATES,
    isLoading,
    createTemplate,
    getTemplateDetails,
    deleteTemplate,
    createProjectFromTemplate,
    createProjectFromSystemTemplate,
    saveProjectAsTemplate,
    refresh: fetchTemplates,
  };
}
