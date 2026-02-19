import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { SYSTEM_TEMPLATES, SystemTemplate } from '@/constants/systemTemplates';

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
    id?: string;
    template_id?: string;
    name: string;
    color: string;
    position: number;
    is_default: boolean;
    is_completed: boolean;
    category?: 'todo' | 'active' | 'done' | 'cancelled';
}

export interface TemplateCustomField {
    id?: string;
    template_id?: string;
    name: string;
    field_type: ExtendedFieldType;
    options: Array<{ label: string; value: string; color?: string }>;
    is_required: boolean;
    position: number;
}

export interface TemplateTask {
    id?: string;
    template_id?: string;
    title: string;
    description: string | null;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status_position: number;
    position: number;
    days_offset: number;
}

export interface TemplateView {
    id?: string;
    template_id?: string;
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
    const { user } = useAuth();
    const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTemplates = useCallback(async () => {
        if (!workspaceId) {
            setIsLoading(false);
            return;
        }

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

    const createTemplate = useCallback(async (data: {
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

            if (data.statuses && data.statuses.length > 0) {
                const { error } = await supabase
                    .from('template_statuses')
                    .insert(data.statuses.map(s => ({
                        ...s,
                        template_id: template.id,
                    })));
                if (error) throw error;
            }

            if (data.custom_fields && data.custom_fields.length > 0) {
                const { error } = await supabase
                    .from('template_custom_fields')
                    .insert(data.custom_fields.map(f => ({
                        ...f,
                        template_id: template.id,
                    })));
                if (error) throw error;
            }

            if (data.tasks && data.tasks.length > 0) {
                const { error } = await supabase
                    .from('template_tasks')
                    .insert(data.tasks.map(t => ({
                        ...t,
                        template_id: template.id,
                    })));
                if (error) throw error;
            }

            fetchTemplates();
            return template;
        } catch (error: any) {
            console.error('Error creating template:', error);
            return null;
        }
    }, [workspaceId, user, fetchTemplates]);

    const getTemplateDetails = useCallback(async (templateId: string): Promise<TemplateWithDetails | null> => {
        if (!templateId) return null;

        // 1. Check if it's a system template first (case-insensitive check for robustness)
        const systemTemplate = SYSTEM_TEMPLATES.find(t => t.id.toLowerCase() === templateId.toLowerCase());
        if (systemTemplate) {
            return {
                ...systemTemplate,
                workspace_id: '',
                is_public: true,
                created_by: 'system',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                statuses: systemTemplate.statuses.map((s, idx) => ({
                    ...s,
                    id: `system-status-${idx}`,
                    is_default: s.is_default || false,
                    is_completed: s.is_completed || false,
                    category: (s as any).category || (s.is_completed ? 'done' : s.is_default ? 'todo' : 'active'),
                })),
                custom_fields: systemTemplate.fields.map((f, i) => ({
                    name: f.name,
                    field_type: f.field_type as any,
                    options: f.options?.map(o => ({ label: o, value: o.toLowerCase().replace(/\s+/g, '-') })) || [],
                    is_required: f.is_required || false,
                    position: i
                })),
                tasks: (systemTemplate as any).tasks || [],
                views: systemTemplate.views.map((v, i) => ({
                    name: v.name,
                    view_type: v.view_type,
                    config: v.config || {},
                    position: i,
                    is_default: v.is_default || false
                }))
            } as unknown as TemplateWithDetails;
        }

        // 2. Validate UUID format to avoid Postgres error 22P02
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(templateId)) {
            console.warn('Skipping DB fetch for non-UUID template legacy/system ID:', templateId);
            return null;
        }

        try {
            const [templateResult, statusesResult, fieldsResult, tasksResult, viewsResult] = await Promise.all([
                supabase.from('project_templates').select('*').eq('id', templateId).single(),
                supabase.from('template_statuses').select('*').eq('template_id', templateId).order('position'),
                supabase.from('template_custom_fields').select('*').eq('template_id', templateId).order('position'),
                supabase.from('template_tasks').select('*').eq('template_id', templateId).order('position'),
                supabase.from('project_views').select('*').eq('project_id', templateId).order('position'), // Note: templates might not have views yet
            ]);

            if (templateResult.error) throw templateResult.error;

            return {
                ...templateResult.data,
                statuses: statusesResult.data || [],
                custom_fields: fieldsResult.data || [],
                tasks: tasksResult.data || [],
                views: viewsResult.data || [],
            } as TemplateWithDetails;
        } catch (error) {
            console.error('Error fetching template details:', error);
            return null;
        }
    }, []);

    const deleteTemplate = useCallback(async (id: string) => {
        try {
            const { error } = await supabase
                .from('project_templates')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchTemplates();
            return true;
        } catch (error: any) {
            console.error('Error deleting template:', error);
            return false;
        }
    }, [fetchTemplates]);

    const applyTemplateToProject = useCallback(async (template: TemplateWithDetails | SystemTemplate, projectName: string, projectMetaOverrides?: any): Promise<string | null> => {
        if (!workspaceId || !user) return null;

        try {
            // Create project
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .insert([{
                    workspace_id: workspaceId,
                    name: projectName,
                    description: projectMetaOverrides?.description || (template as any).description,
                    icon: projectMetaOverrides?.icon || (template as any).icon,
                    color: projectMetaOverrides?.color || (template as any).color,
                    created_by: user.id,
                }])
                .select()
                .single();

            if (projectError) throw projectError;

            // Force delete auto-generated defaults (triggers create them)
            const { data: deleted } = await supabase
                .from('project_statuses')
                .delete()
                .eq('project_id', project.id)
                .select();

            // If delete returned nothing, retry after a brief wait (trigger may not have fired yet)
            if (!deleted || deleted.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 300));
                await supabase
                    .from('project_statuses')
                    .delete()
                    .eq('project_id', project.id);
            }

            // Create statuses from template
            const statuses = 'statuses' in template ? template.statuses : (template as any).statuses;
            if (statuses && statuses.length > 0) {
                const { error: statusError } = await supabase
                    .from('project_statuses')
                    .insert(statuses.map((s: any) => ({
                        project_id: project.id,
                        name: s.name,
                        color: s.color,
                        position: s.position,
                        is_default: s.is_default || false,
                        is_completed: s.is_completed || false,
                        category: s.category || (s.is_completed ? 'done' : s.is_default ? 'todo' : 'active'),
                    })));
                if (statusError) throw statusError;
            }

            // Create custom fields
            const fields = 'fields' in template ? (template as any).fields : (template as any).custom_fields;
            if (fields && fields.length > 0) {
                const { error: fieldError } = await supabase
                    .from('custom_field_definitions')
                    .insert(fields.map((f: any, index: number) => ({
                        project_id: project.id,
                        name: f.name,
                        field_type: f.field_type as any,
                        options: f.options ? (Array.isArray(f.options) && typeof f.options[0] === 'string'
                            ? f.options.map((opt: string) => ({ label: opt, value: opt.toLowerCase().replace(/\s+/g, '-') }))
                            : f.options) : [],
                        is_required: f.is_required || false,
                        position: f.position ?? index,
                    })));
                if (fieldError) throw fieldError;
            }

            // Create project views
            const views = 'views' in template ? template.views : (template as any).views;
            if (views && views.length > 0) {
                const { error: viewError } = await supabase
                    .from('project_views')
                    .insert(views.map((v: any, index: number) => ({
                        project_id: project.id,
                        name: v.name,
                        view_type: v.view_type,
                        config: v.config || {},
                        position: v.position ?? index,
                        is_default: v.is_default || false,
                    })));
                if (viewError) throw viewError;
            }

            // Create tasks
            const tasks = (template as any).tasks;
            if (tasks && tasks.length > 0) {
                const today = new Date();
                const { error: taskError } = await supabase
                    .from('tasks')
                    .insert(tasks.map((t: any) => {
                        const dueDate = t.days_offset
                            ? new Date(today.getTime() + t.days_offset * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                            : null;
                        return {
                            project_id: project.id,
                            workspace_id: workspaceId,
                            title: t.title,
                            description: t.description,
                            priority: t.priority || 'medium',
                            position: t.position,
                            due_date: dueDate,
                            created_by: user.id,
                            status: statuses[0]?.name || 'todo' // Use first status from template
                        };
                    }));
                if (taskError) throw taskError;
            }

            return project.id;
        } catch (error) {
            console.error('Error applying template to project:', error);
            return null;
        }
    }, [workspaceId, user]);

    const createProjectFromTemplate = useCallback(async (templateId: string, projectName: string) => {
        const template = await getTemplateDetails(templateId);
        if (!template) return null;
        return applyTemplateToProject(template, projectName);
    }, [getTemplateDetails, applyTemplateToProject]);

    const createProjectFromSystemTemplate = useCallback(async (systemTemplate: SystemTemplate, projectName: string) => {
        return applyTemplateToProject(systemTemplate, projectName);
    }, [applyTemplateToProject]);

    const createProjectWithStatuses = useCallback(async (
        projectMeta: { name: string; description: string | null; icon: string; color: string },
        statuses: { name: string; color: string; position: number; is_default?: boolean; is_completed?: boolean }[]
    ): Promise<{ data: any; error: any }> => {
        if (!workspaceId || !user) return { data: null, error: 'Missing workspace or user' };

        try {
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .insert([{
                    workspace_id: workspaceId,
                    name: projectMeta.name,
                    description: projectMeta.description,
                    icon: projectMeta.icon,
                    color: projectMeta.color,
                    created_by: user.id,
                }])
                .select()
                .single();

            if (projectError) throw projectError;

            // Force delete auto-generated defaults (triggers create them)
            const { data: deleted } = await supabase
                .from('project_statuses')
                .delete()
                .eq('project_id', project.id)
                .select();

            // If delete returned nothing, retry after a brief wait (trigger may not have fired yet)
            if (!deleted || deleted.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 300));
                await supabase
                    .from('project_statuses')
                    .delete()
                    .eq('project_id', project.id);
            }

            if (statuses.length > 0) {
                const { error: statusError } = await supabase
                    .from('project_statuses')
                    .insert(statuses.map((s, idx) => ({
                        project_id: project.id,
                        name: s.name,
                        color: s.color,
                        position: s.position ?? idx,
                        is_default: s.is_default || false,
                        is_completed: s.is_completed || false,
                        category: (s as any).category || (s.is_completed ? 'done' : s.is_default ? 'todo' : 'active'),
                    })));
                if (statusError) throw statusError;
            }

            return { data: project, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }, [workspaceId, user]);

    const saveProjectAsTemplate = useCallback(async (projectId: string, templateName: string): Promise<string | null> => {
        if (!workspaceId || !user) return null;

        try {
            const [projectResult, statusesResult, fieldsResult, tasksResult] = await Promise.all([
                supabase.from('projects').select('*').eq('id', projectId).single(),
                supabase.from('project_statuses').select('*').eq('project_id', projectId).order('position'),
                supabase.from('custom_field_definitions').select('*').eq('project_id', projectId).order('position'),
                supabase.from('tasks').select('*').eq('project_id', projectId).order('position'),
            ]);

            if (projectResult.error) throw projectResult.error;
            const project = projectResult.data;

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

            if (statusesResult.data && statusesResult.data.length > 0) {
                await supabase
                    .from('template_statuses')
                    .insert(statusesResult.data.map((s: any) => ({
                        template_id: template.id,
                        name: s.name,
                        color: s.color,
                        position: s.position,
                        is_default: s.is_default,
                        is_completed: s.is_completed,
                        category: s.category || (s.is_completed ? 'done' : s.is_default ? 'todo' : 'active'),
                    })));
            }

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

            fetchTemplates();
            return template.id;
        } catch (error: any) {
            console.error('Error saving project as template:', error);
            return null;
        }
    }, [workspaceId, user, fetchTemplates]);

    return useMemo(() => ({
        templates,
        systemTemplates: SYSTEM_TEMPLATES,
        isLoading,
        createTemplate,
        getTemplateDetails,
        deleteTemplate,
        createProjectFromTemplate,
        createProjectFromSystemTemplate,
        createProjectWithStatuses,
        saveProjectAsTemplate,
        refresh: fetchTemplates,
    }), [templates, isLoading, createTemplate, getTemplateDetails, deleteTemplate, createProjectFromTemplate, createProjectFromSystemTemplate, createProjectWithStatuses, saveProjectAsTemplate, fetchTemplates]);
}
