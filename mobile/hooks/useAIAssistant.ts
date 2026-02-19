import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from './useWorkspace';
import { useAuth } from './useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: Date;
    isLoading?: boolean;
    status?: string;
    actions?: AIAction[] | null;
    buttons?: SmartButton[] | null;
}

export type AIActionType =
    | 'create_task' | 'update_task' | 'create_project' | 'update_project'
    | 'invite_member' | 'reassign_task' | 'change_member_role'
    | 'bulk_update' | 'view_tasks' | 'view_projects';

export interface AIAction {
    type: AIActionType;
    label: string;
    is_draft?: boolean;
    missing_fields?: string[];
    data?: any;
}

export type SmartButtonAction =
    | 'open_project' | 'open_task' | 'open_member'
    | 'view_overdue' | 'undo_last_action' | 'confirm_bulk'
    | 'reschedule_overdue' | 'add_tasks' | 'change_priority'
    | 'start_timer' | 'suggest_redistribution' | 'notify_members';

export interface SmartButton {
    label: string;
    action: SmartButtonAction;
    id?: string;
    icon?: string;
    data?: any;
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

// ─── Tool Type ────────────────────────────────────────────────────────────────

type ToolType =
    | 'search_tasks' | 'get_task_details' | 'search_projects' | 'get_project_details'
    | 'list_members' | 'get_member_workload' | 'get_workspace_analytics'
    | 'bulk_update_tasks' | 'get_activity_logs'
    | 'create_task' | 'update_task' | 'create_project' | 'update_project'
    | 'invite_member' | 'reassign_task' | 'change_member_role'
    | 'get_tasks_due_soon' | 'get_time_tracking' | 'get_task_comments'
    | 'manage_project_status' | 'delete_task';

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
    {
        name: 'search_tasks',
        description: 'Search workspace tasks by title, status, priority, assignee name, or project name.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search term for task title' },
                status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Filter by status' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Filter by priority' },
                assignee_name: { type: 'string', description: 'Filter by assignee full name' },
                project_name: { type: 'string', description: 'Filter by project name' },
                overdue_only: { type: 'boolean', description: 'Only return overdue tasks' },
            },
            required: [],
            additionalProperties: false,
        },
    },
    {
        name: 'get_task_details',
        description: 'Get full details for a specific task including assignee, project, comments, and activity.',
        parameters: {
            type: 'object',
            properties: {
                task_name: { type: 'string', description: 'Task title to search for' },
            },
            required: ['task_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'search_projects',
        description: 'Search workspace projects by name. Returns names, task counts, health.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Project name search term' },
            },
            required: [],
            additionalProperties: false,
        },
    },
    {
        name: 'get_project_details',
        description: 'Detailed analytics for a project: task breakdown, overdue, stuck tasks, member workload.',
        parameters: {
            type: 'object',
            properties: {
                project_name: { type: 'string', description: 'Project name to look up' },
            },
            required: ['project_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_members',
        description: 'List all workspace members with names, roles, and active task counts.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
        },
    },
    {
        name: 'get_member_workload',
        description: 'Detailed workload for a member: active tasks, overdue, completed this week.',
        parameters: {
            type: 'object',
            properties: {
                member_name: { type: 'string', description: 'Full name of the member' },
            },
            required: ['member_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_workspace_analytics',
        description: 'Workspace-wide health: total tasks, overdue, stuck, workload distribution, at-risk projects.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
        },
    },
    {
        name: 'bulk_update_tasks',
        description: 'Update multiple tasks at once. Always confirm with user before executing.',
        parameters: {
            type: 'object',
            properties: {
                task_ids: { type: 'array', items: { type: 'string' }, description: 'Array of task IDs to update' },
                status: { type: 'string', description: 'New status to set' },
                priority: { type: 'string', description: 'New priority to set' },
                due_date: { type: 'string', description: 'New due date (YYYY-MM-DD)' },
            },
            required: ['task_ids'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_activity_logs',
        description: 'Recent activity history for a task or project.',
        parameters: {
            type: 'object',
            properties: {
                task_name: { type: 'string', description: 'Task name to get logs for' },
                project_name: { type: 'string', description: 'Project name to get logs for' },
                limit: { type: 'number', description: 'Max number of logs to return' },
            },
            required: [],
            additionalProperties: false,
        },
    },
    {
        name: 'create_task',
        description: 'Create a new task in a project. Resolves project and assignee by name.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Task title' },
                project_name: { type: 'string', description: 'Project to add task to' },
                assignee_name: { type: 'string', description: 'Person to assign to' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority' },
                due_date: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
                description: { type: 'string', description: 'Task description' },
            },
            required: ['title', 'project_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_task',
        description: 'Update an existing task: status, priority, due date, assignee, or title.',
        parameters: {
            type: 'object',
            properties: {
                task_name: { type: 'string', description: 'Name of the task to update' },
                new_status: { type: 'string', description: 'New status' },
                new_priority: { type: 'string', description: 'New priority' },
                new_due_date: { type: 'string', description: 'New due date (YYYY-MM-DD)' },
                new_assignee_name: { type: 'string', description: 'New assignee name' },
                new_title: { type: 'string', description: 'New title' },
            },
            required: ['task_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'create_project',
        description: 'Create a new project with default statuses (To Do, In Progress, Done).',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Project name' },
                description: { type: 'string', description: 'Project description' },
                color: { type: 'string', description: 'Hex color e.g. #3B82F6' },
            },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_project',
        description: 'Rename or update description/color of an existing project.',
        parameters: {
            type: 'object',
            properties: {
                project_name: { type: 'string', description: 'Current project name' },
                new_name: { type: 'string', description: 'New project name' },
                new_description: { type: 'string', description: 'New description' },
                new_color: { type: 'string', description: 'New hex color' },
            },
            required: ['project_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'invite_member',
        description: 'Send a workspace invitation to an email address.',
        parameters: {
            type: 'object',
            properties: {
                email: { type: 'string', description: 'Email address to invite' },
                role: { type: 'string', enum: ['admin', 'member', 'viewer'], description: 'Role for the new member' },
            },
            required: ['email'],
            additionalProperties: false,
        },
    },
    {
        name: 'reassign_task',
        description: 'Reassign a task to a different team member.',
        parameters: {
            type: 'object',
            properties: {
                task_name: { type: 'string', description: 'Task to reassign' },
                new_assignee_name: { type: 'string', description: 'New assignee name' },
            },
            required: ['task_name', 'new_assignee_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'change_member_role',
        description: 'Change the role of a workspace member.',
        parameters: {
            type: 'object',
            properties: {
                member_name: { type: 'string', description: 'Member name' },
                new_role: { type: 'string', enum: ['admin', 'member', 'viewer'], description: 'New role' },
            },
            required: ['member_name', 'new_role'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_tasks_due_soon',
        description: 'Get tasks due today, tomorrow, this week, or next week. Use for deadline questions.',
        parameters: {
            type: 'object',
            properties: {
                range: { type: 'string', enum: ['today', 'tomorrow', 'this_week', 'next_week'], description: 'Time range' },
                assignee_name: { type: 'string', description: 'Filter by assignee name' },
            },
            required: ['range'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_time_tracking',
        description: 'Get time tracking data: hours logged per task, project, or member.',
        parameters: {
            type: 'object',
            properties: {
                task_name: { type: 'string', description: 'Filter by task name' },
                project_name: { type: 'string', description: 'Filter by project name' },
                member_name: { type: 'string', description: 'Filter by member name' },
            },
            required: [],
            additionalProperties: false,
        },
    },
    {
        name: 'get_task_comments',
        description: 'Get discussion comments on a task. Use for summarizing discussions.',
        parameters: {
            type: 'object',
            properties: {
                task_name: { type: 'string', description: 'Task to get comments for' },
            },
            required: ['task_name'],
            additionalProperties: false,
        },
    },
    {
        name: 'manage_project_status',
        description: 'Add, rename, or list custom statuses on a project (e.g. Client Review, QA).',
        parameters: {
            type: 'object',
            properties: {
                project_name: { type: 'string', description: 'Project name' },
                action: { type: 'string', enum: ['list', 'add', 'rename'], description: 'Action to perform' },
                status_name: { type: 'string', description: 'Status name (for add/rename)' },
                new_name: { type: 'string', description: 'New name (for rename)' },
                color: { type: 'string', description: 'Hex color for new status' },
                is_completed: { type: 'boolean', description: 'Whether this status means task is done' },
            },
            required: ['project_name', 'action'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_task',
        description: 'Delete a task by name. Ask for confirmation first.',
        parameters: {
            type: 'object',
            properties: {
                task_name: { type: 'string', description: 'Task to delete' },
            },
            required: ['task_name'],
            additionalProperties: false,
        },
    },
];

// ─── Workspace Context Cache ─────────────────────────────────────────────────

interface WsContext {
    wsId: string;
    projects: { id: string; name: string }[];
    projectIds: string[];
    projectMap: Record<string, string>;
    memberIds: string[];
    members: { id: string; full_name: string; email: string }[];
    memberRoles: Record<string, string>;
    profileMap: Record<string, string>;
}

async function buildWsContext(wsId: string): Promise<WsContext> {
    const { data: projs } = await supabase.from('projects').select('id, name').eq('workspace_id', wsId).eq('is_archived', false);
    const projects = (projs || []) as { id: string; name: string }[];
    const projectIds = projects.map(p => p.id);
    const projectMap: Record<string, string> = {};
    projects.forEach(p => { projectMap[p.id] = p.name; });

    const { data: ms } = await supabase.from('workspace_members').select('user_id, role').eq('workspace_id', wsId);
    const memberIds = ms?.map((m: any) => m.user_id) || [];
    const memberRoles: Record<string, string> = {};
    ms?.forEach((m: any) => { memberRoles[m.user_id] = m.role; });

    const { data: profs } = memberIds.length
        ? await supabase.from('profiles').select('id, full_name, email').in('id', memberIds)
        : { data: [] };
    const members = (profs || []) as { id: string; full_name: string; email: string }[];
    const profileMap: Record<string, string> = {};
    members.forEach(m => { profileMap[m.id] = m.full_name; });

    return { wsId, projects, projectIds, projectMap, memberIds, members, memberRoles, profileMap };
}

// ─── Name Resolution Helpers (use cached context) ────────────────────────────

function resolveProjectFromCtx(ctx: WsContext, name?: string): { id: string; name: string } | null {
    if (!name) return null;
    const lower = name.toLowerCase();
    return ctx.projects.find(p => p.name.toLowerCase().includes(lower)) || null;
}

function resolveMemberFromCtx(ctx: WsContext, name?: string): { id: string; full_name: string; email: string } | null {
    if (!name) return null;
    const lower = name.toLowerCase();
    return ctx.members.find(m => m.full_name.toLowerCase().includes(lower)) || null;
}

async function resolveTask(ctx: WsContext, name?: string): Promise<{ id: string; title: string; project_id: string } | null> {
    if (!name || !ctx.projectIds.length) return null;
    const { data } = await supabase.from('tasks').select('id, title, project_id').in('project_id', ctx.projectIds).ilike('title', `%${name}%`).limit(1).single();
    return data || null;
}

// ─── Tool Call Executor ───────────────────────────────────────────────────────

const MAX_RESULT_ITEMS = 15;

async function executeToolCall(name: ToolType, args: any, ctx: WsContext, userId: string): Promise<any> {
    const { projectIds, projectMap, profileMap } = ctx;

    switch (name) {

        case 'search_tasks': {
            let pIds = [...projectIds];
            if (args.project_name) {
                const filtered = ctx.projects.filter(p => p.name.toLowerCase().includes(args.project_name.toLowerCase()));
                if (filtered.length) pIds = filtered.map(p => p.id);
            }
            if (!pIds.length) return { tasks: [] };
            let q = supabase.from('tasks').select('title, status, priority, due_date, assigned_to, project_id').in('project_id', pIds);
            if (args.query) q = q.ilike('title', `%${args.query}%`);
            if (args.status) q = q.eq('status', args.status);
            if (args.priority) q = q.eq('priority', args.priority);
            if (args.overdue_only) { q = (q as any).lt('due_date', new Date().toISOString().split('T')[0]).neq('status', 'done'); }
            const { data: tasks } = await q.limit(MAX_RESULT_ITEMS);
            if (!tasks?.length) return { tasks: [], message: 'No tasks found.' };
            let result = tasks.map((t: any) => ({ title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, assignee: profileMap[t.assigned_to] || 'Unassigned', project: projectMap[t.project_id] || 'Unknown', days_overdue: (t.due_date && t.status !== 'done') ? Math.max(0, Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000)) : 0 }));
            if (args.assignee_name) result = result.filter((t: any) => t.assignee.toLowerCase().includes(args.assignee_name.toLowerCase()));
            return { tasks: result, total: result.length };
        }

        case 'get_task_details': {
            const task = await resolveTask(ctx, args.task_name);
            if (!task) return { error: `Task "${args.task_name}" not found.` };
            const { data: d } = await supabase.from('tasks').select('title, status, priority, due_date, description, assigned_to, created_by, updated_at').eq('id', task.id).single();
            const td = d as any;
            const { data: comments } = await supabase.from('task_comments').select('content, created_at, user_id').eq('task_id', task.id).order('created_at', { ascending: true }).limit(5);
            return { title: td?.title, status: td?.status, priority: td?.priority, due_date: td?.due_date, description: td?.description?.slice(0, 300) || null, project: projectMap[task.project_id] || 'Unknown', assignee: profileMap[td?.assigned_to] || 'Unassigned', created_by: profileMap[td?.created_by] || 'Unknown', days_overdue: (td?.due_date && td?.status !== 'done') ? Math.max(0, Math.floor((Date.now() - new Date(td.due_date).getTime()) / 86400000)) : 0, recent_comments: (comments || []).map((c: any) => ({ author: profileMap[c.user_id] || 'Unknown', content: c.content.slice(0, 150), date: new Date(c.created_at).toLocaleDateString() })) };
        }

        case 'search_projects': {
            let projects = ctx.projects;
            if (args.query) { const q = args.query.toLowerCase(); projects = projects.filter(p => p.name.toLowerCase().includes(q)); }
            if (!projects.length) return { projects: [] };
            const pIds = projects.map(p => p.id);
            const { data: tasks } = await supabase.from('tasks').select('project_id, status, due_date').in('project_id', pIds);
            const today = new Date();
            return { projects: projects.map(p => { const pt = tasks?.filter((t: any) => t.project_id === p.id) || []; const ov = pt.filter((t: any) => t.due_date && new Date(t.due_date) < today && t.status !== 'done'); return { name: p.name, total_tasks: pt.length, overdue: ov.length, done: pt.filter((t: any) => t.status === 'done').length, health: ov.length > 3 ? 'at_risk' : ov.length > 0 ? 'warning' : 'healthy' }; }) };
        }

        case 'get_project_details': {
            const proj = resolveProjectFromCtx(ctx, args.project_name);
            if (!proj) return { error: `Project "${args.project_name}" not found.` };
            const { data: tasks } = await supabase.from('tasks').select('title, status, priority, due_date, assigned_to, updated_at').eq('project_id', proj.id);
            const today = new Date();
            const overdue = tasks?.filter((t: any) => t.due_date && new Date(t.due_date) < today && t.status !== 'done') || [];
            const stuck = tasks?.filter((t: any) => t.status !== 'done' && Math.floor((Date.now() - new Date(t.updated_at || 0).getTime()) / 86400000) >= 5) || [];
            const workload: Record<string, number> = {};
            tasks?.forEach((t: any) => { if (t.assigned_to && t.status !== 'done') { const n = profileMap[t.assigned_to] || 'Unknown'; workload[n] = (workload[n] || 0) + 1; } });
            return { name: proj.name, total_tasks: tasks?.length || 0, todo: tasks?.filter((t: any) => t.status === 'todo').length || 0, in_progress: tasks?.filter((t: any) => t.status === 'in_progress').length || 0, done: tasks?.filter((t: any) => t.status === 'done').length || 0, overdue_count: overdue.length, stuck_count: stuck.length, overdue_tasks: overdue.slice(0, 5).map((t: any) => ({ title: t.title, assignee: profileMap[t.assigned_to] || 'Unassigned', days_overdue: Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000) })), workload_by_member: workload, risk_level: overdue.length > 3 || stuck.length > 2 ? 'high' : overdue.length > 0 ? 'medium' : 'low' };
        }

        case 'list_members': {
            if (!ctx.members.length) return { members: [] };
            const { data: tasks } = projectIds.length ? await supabase.from('tasks').select('assigned_to').in('project_id', projectIds).neq('status', 'done') : { data: [] };
            const tc: Record<string, number> = {};
            tasks?.forEach((t: any) => { if (t.assigned_to) tc[t.assigned_to] = (tc[t.assigned_to] || 0) + 1; });
            return { members: ctx.members.map(m => ({ name: m.full_name, email: m.email, role: ctx.memberRoles[m.id] || 'member', active_tasks: tc[m.id] || 0 })) };
        }

        case 'get_member_workload': {
            const member = resolveMemberFromCtx(ctx, args.member_name);
            if (!member) return { error: `Member "${args.member_name}" not found.` };
            const { data: tasks } = projectIds.length ? await supabase.from('tasks').select('title, status, priority, due_date, updated_at').in('project_id', projectIds).eq('assigned_to', member.id) : { data: [] };
            const today = new Date(); const weekAgo = new Date(today.getTime() - 7 * 86400000);
            const active = tasks?.filter((t: any) => t.status !== 'done') || [];
            const overdue = active.filter((t: any) => t.due_date && new Date(t.due_date) < today);
            const doneThisWeek = tasks?.filter((t: any) => t.status === 'done' && new Date(t.updated_at) >= weekAgo) || [];
            return { member_name: member.full_name, active_tasks: active.length, overdue_tasks: overdue.length, completed_this_week: doneThisWeek.length, workload_level: active.length >= 8 ? 'overloaded' : active.length >= 5 ? 'heavy' : active.length >= 2 ? 'normal' : 'light', overdue_list: overdue.slice(0, 5).map((t: any) => ({ title: t.title, priority: t.priority, days_overdue: Math.max(0, Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000)) })) };
        }

        case 'get_workspace_analytics': {
            const { data: tasks } = projectIds.length ? await supabase.from('tasks').select('title, status, due_date, assigned_to, project_id, updated_at').in('project_id', projectIds) : { data: [] };
            const today = new Date(); const weekAgo = new Date(today.getTime() - 7 * 86400000);
            const overdue = tasks?.filter((t: any) => t.due_date && new Date(t.due_date) < today && t.status !== 'done') || [];
            const stuck = tasks?.filter((t: any) => t.status !== 'done' && Math.floor((Date.now() - new Date(t.updated_at || 0).getTime()) / 86400000) >= 5) || [];
            const doneThisWeek = tasks?.filter((t: any) => t.status === 'done' && new Date(t.updated_at) >= weekAgo) || [];
            const workload: Record<string, { active: number; overdue: number }> = {};
            tasks?.forEach((t: any) => { if (!t.assigned_to) return; const n = profileMap[t.assigned_to] || 'Unknown'; if (!workload[n]) workload[n] = { active: 0, overdue: 0 }; if (t.status !== 'done') workload[n].active++; if (t.due_date && new Date(t.due_date) < today && t.status !== 'done') workload[n].overdue++; });
            const atRisk = ctx.projects.map(p => { const pt = tasks?.filter((t: any) => t.project_id === p.id) || []; const ov = pt.filter((t: any) => t.due_date && new Date(t.due_date) < today && t.status !== 'done'); return { name: p.name, overdue: ov.length, risk: ov.length > 2 ? 'high' : ov.length > 0 ? 'medium' : 'low' }; }).filter(p => p.risk !== 'low');
            return { total_tasks: tasks?.length || 0, active_tasks: tasks?.filter((t: any) => t.status !== 'done').length || 0, overdue_count: overdue.length, stuck_count: stuck.length, completed_this_week: doneThisWeek.length, workload_by_member: workload, at_risk_projects: atRisk, top_overdue: overdue.slice(0, 5).map((t: any) => ({ title: t.title, assignee: profileMap[t.assigned_to] || 'Unassigned', project: projectMap[t.project_id] || 'Unknown', days_overdue: Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000) })) };
        }

        case 'bulk_update_tasks': {
            const updates: any = {};
            if (args.status) updates.status = args.status;
            if (args.priority) updates.priority = args.priority;
            if (args.due_date) updates.due_date = args.due_date;
            if (args.status === 'done') updates.completed_at = new Date().toISOString();
            const { data, error } = await supabase.from('tasks').update(updates).in('id', args.task_ids).select('title');
            if (error) throw error;
            return { success: true, updated_count: data?.length || 0, updated_titles: data?.map((t: any) => t.title) || [] };
        }

        case 'get_activity_logs': {
            let entityId: string | null = null;
            let entityType: string | null = null;
            if (args.task_name) { const t = await resolveTask(ctx, args.task_name); if (t) { entityId = t.id; entityType = 'task'; } }
            else if (args.project_name) { const p = resolveProjectFromCtx(ctx, args.project_name); if (p) { entityId = p.id; entityType = 'project'; } }
            let q = supabase.from('notifications').select('type, title, body, actor_id, created_at').eq('workspace_id', ctx.wsId);
            if (entityId) q = q.eq('entity_id', entityId);
            const { data: logs } = await q.order('created_at', { ascending: false }).limit(args.limit || 10);
            return { logs: (logs || []).map((l: any) => ({ type: l.type, title: l.title, description: l.body, actor: profileMap[l.actor_id] || 'Unknown', date: new Date(l.created_at).toLocaleDateString(), time_ago: `${Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000)}d ago` })) };
        }

        case 'create_task': {
            const proj = resolveProjectFromCtx(ctx, args.project_name);
            if (!proj) return { error: `Project "${args.project_name}" not found.` };
            let assigneeId: string | null = null; let assigneeName = 'Unassigned';
            if (args.assignee_name) { const m = resolveMemberFromCtx(ctx, args.assignee_name); if (m) { assigneeId = m.id; assigneeName = m.full_name; } }
            const { data: et } = await supabase.from('tasks').select('position').eq('project_id', proj.id).order('position', { ascending: false }).limit(1);
            const maxPos = (et?.[0] as any)?.position ?? -1;
            const { data, error } = await supabase.from('tasks').insert({ title: args.title, description: args.description || null, priority: args.priority || 'medium', due_date: args.due_date || null, project_id: proj.id, assigned_to: assigneeId, created_by: userId, status: 'todo', position: maxPos + 1 }).select('title').single();
            if (error) throw error;
            return { success: true, task_title: (data as any).title, project_name: proj.name, assignee_name: assigneeName };
        }

        case 'update_task': {
            const task = await resolveTask(ctx, args.task_name);
            if (!task) return { error: `Task "${args.task_name}" not found.` };
            const updates: any = {};
            if (args.new_status) {
                updates.status = args.new_status;
                if (args.new_status === 'done') updates.completed_at = new Date().toISOString();
            }
            if (args.new_priority) updates.priority = args.new_priority;
            if (args.new_due_date) updates.due_date = args.new_due_date;
            if (args.new_title) updates.title = args.new_title;
            if (args.new_assignee_name) { const m = resolveMemberFromCtx(ctx, args.new_assignee_name); if (m) updates.assigned_to = m.id; }
            if (!Object.keys(updates).length) return { error: 'No updates provided.' };
            const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
            if (error) throw error;
            return { success: true, task_title: task.title, updates_applied: Object.keys(updates) };
        }

        case 'create_project': {
            const { data, error } = await supabase.from('projects').insert({ name: args.name, description: args.description || null, color: args.color || '#3B82F6', workspace_id: ctx.wsId, created_by: userId, is_archived: false }).select('name').single();
            if (error) throw error;
            await supabase.from('project_statuses').insert([
                { project_id: (data as any).id, name: 'To Do', color: '#64748B', position: 0, is_default: true, is_completed: false },
                { project_id: (data as any).id, name: 'In Progress', color: '#3B82F6', position: 1, is_default: false, is_completed: false },
                { project_id: (data as any).id, name: 'Done', color: '#22C55E', position: 2, is_default: false, is_completed: true },
            ]);
            return { success: true, project_name: (data as any).name };
        }

        case 'update_project': {
            const proj = resolveProjectFromCtx(ctx, args.project_name);
            if (!proj) return { error: `Project "${args.project_name}" not found.` };
            const updates: any = {};
            if (args.new_name) updates.name = args.new_name;
            if (args.new_description) updates.description = args.new_description;
            if (args.new_color) updates.color = args.new_color;
            if (!Object.keys(updates).length) return { error: 'No updates provided.' };
            const { error } = await supabase.from('projects').update(updates).eq('id', proj.id);
            if (error) throw error;
            return { success: true, old_name: proj.name, new_name: updates.name || proj.name };
        }

        case 'invite_member': {
            const { data: existing } = await supabase.from('profiles').select('id, full_name').eq('email', args.email).single();
            if (existing) {
                const { error } = await supabase.from('workspace_members').insert({ workspace_id: ctx.wsId, user_id: (existing as any).id, role: args.role || 'member' });
                if (error && error.code !== '23505') throw error;
                return { success: true, email: args.email, name: (existing as any).full_name, role: args.role || 'member', status: 'added_directly' };
            }
            const { error } = await supabase.from('workspace_invitations').insert({ workspace_id: ctx.wsId, email: args.email, role: args.role || 'member', invited_by: userId });
            if (error) throw error;
            return { success: true, email: args.email, role: args.role || 'member', status: 'invitation_sent' };
        }

        case 'reassign_task': {
            const task = await resolveTask(ctx, args.task_name);
            if (!task) return { error: `Task "${args.task_name}" not found.` };
            const member = resolveMemberFromCtx(ctx, args.new_assignee_name);
            if (!member) return { error: `Member "${args.new_assignee_name}" not found.` };
            const { error } = await supabase.from('tasks').update({ assigned_to: member.id }).eq('id', task.id);
            if (error) throw error;
            return { success: true, task_title: task.title, new_assignee: member.full_name };
        }

        case 'change_member_role': {
            const member = resolveMemberFromCtx(ctx, args.member_name);
            if (!member) return { error: `Member "${args.member_name}" not found.` };
            const { error } = await supabase.from('workspace_members').update({ role: args.new_role }).eq('workspace_id', ctx.wsId).eq('user_id', member.id);
            if (error) throw error;
            return { success: true, member_name: member.full_name, new_role: args.new_role };
        }

        case 'get_tasks_due_soon': {
            if (!projectIds.length) return { tasks: [] };
            const now = new Date();
            let startDate: string; let endDate: string;
            const fmt = (d: Date) => d.toISOString().split('T')[0];
            if (args.range === 'today') { startDate = fmt(now); endDate = fmt(now); }
            else if (args.range === 'tomorrow') { const t = new Date(now); t.setDate(t.getDate() + 1); startDate = fmt(t); endDate = fmt(t); }
            else if (args.range === 'this_week') { startDate = fmt(now); const e = new Date(now); e.setDate(e.getDate() + (7 - e.getDay())); endDate = fmt(e); }
            else { const s = new Date(now); s.setDate(s.getDate() + (7 - s.getDay()) + 1); startDate = fmt(s); const e = new Date(s); e.setDate(e.getDate() + 6); endDate = fmt(e); }
            const { data: tasks } = await supabase.from('tasks').select('title, status, priority, due_date, assigned_to, project_id').in('project_id', projectIds).gte('due_date', startDate).lte('due_date', endDate).neq('status', 'done').limit(MAX_RESULT_ITEMS);
            if (!tasks?.length) return { tasks: [], message: `No tasks due ${args.range.replace('_', ' ')}.` };
            let result = tasks.map((t: any) => ({ title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, assignee: profileMap[t.assigned_to] || 'Unassigned', project: projectMap[t.project_id] || 'Unknown' }));
            if (args.assignee_name) result = result.filter((t: any) => t.assignee.toLowerCase().includes(args.assignee_name.toLowerCase()));
            return { tasks: result, total: result.length, range: args.range };
        }

        case 'get_time_tracking': {
            let taskFilter: string[] | null = null;
            if (args.task_name) { const t = await resolveTask(ctx, args.task_name); if (t) taskFilter = [t.id]; else return { error: `Task "${args.task_name}" not found.` }; }
            else if (args.project_name) { const p = resolveProjectFromCtx(ctx, args.project_name); if (p) { const { data: pt } = await supabase.from('tasks').select('id').eq('project_id', p.id); taskFilter = pt?.map((t: any) => t.id) || []; } }
            let memberFilter: string | null = null;
            if (args.member_name) { const m = resolveMemberFromCtx(ctx, args.member_name); if (m) memberFilter = m.id; else return { error: `Member "${args.member_name}" not found.` }; }
            let sq = supabase.from('task_work_sessions').select('task_id, user_id, started_at, ended_at, duration_seconds');
            if (taskFilter) sq = sq.in('task_id', taskFilter);
            if (memberFilter) sq = sq.eq('user_id', memberFilter);
            const { data: sessions } = await sq.order('started_at', { ascending: false }).limit(100);
            if (!sessions?.length) return { total_hours: '0', message: 'No time tracking data found.' };
            const taskIds = [...new Set(sessions.map((s: any) => s.task_id))];
            const { data: taskData } = await supabase.from('tasks').select('id, title').in('id', taskIds);
            const tMap: Record<string, string> = {};
            taskData?.forEach((t: any) => { tMap[t.id] = t.title; });
            let totalSeconds = 0;
            const byTask: Record<string, number> = {};
            const byMember: Record<string, number> = {};
            sessions.forEach((s: any) => {
                const dur = s.duration_seconds || (s.ended_at ? Math.floor((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000) : 0);
                totalSeconds += dur;
                byTask[tMap[s.task_id] || 'Unknown'] = (byTask[tMap[s.task_id] || 'Unknown'] || 0) + dur;
                byMember[profileMap[s.user_id] || 'Unknown'] = (byMember[profileMap[s.user_id] || 'Unknown'] || 0) + dur;
            });
            const fmtH = (s: number) => (s / 3600).toFixed(1);
            return { total_hours: fmtH(totalSeconds), by_task: Object.fromEntries(Object.entries(byTask).map(([k, v]) => [k, fmtH(v) + 'h'])), by_member: Object.fromEntries(Object.entries(byMember).map(([k, v]) => [k, fmtH(v) + 'h'])), session_count: sessions.length };
        }

        case 'get_task_comments': {
            const task = await resolveTask(ctx, args.task_name);
            if (!task) return { error: `Task "${args.task_name}" not found.` };
            const { data: comments } = await supabase.from('task_comments').select('content, created_at, user_id, parent_id').eq('task_id', task.id).order('created_at', { ascending: true }).limit(20);
            if (!comments?.length) return { task_title: task.title, comments: [], message: 'No comments found.' };
            return { task_title: task.title, comments: comments.map((c: any) => ({ author: profileMap[c.user_id] || 'Unknown', content: c.content.slice(0, 200), created_at: c.created_at, is_reply: !!c.parent_id })), total: comments.length };
        }

        case 'manage_project_status': {
            const proj = resolveProjectFromCtx(ctx, args.project_name);
            if (!proj) return { error: `Project "${args.project_name}" not found.` };
            if (args.action === 'list') {
                const { data } = await supabase.from('project_statuses').select('name, color, position, is_default, is_completed').eq('project_id', proj.id).order('position');
                return { project_name: proj.name, statuses: data || [] };
            }
            if (args.action === 'add') {
                if (!args.status_name) return { error: 'Status name is required.' };
                const { data: existing } = await supabase.from('project_statuses').select('position').eq('project_id', proj.id).order('position', { ascending: false }).limit(1);
                const maxPos = (existing?.[0] as any)?.position ?? -1;
                const { error } = await supabase.from('project_statuses').insert({ project_id: proj.id, name: args.status_name, color: args.color || '#6366F1', position: maxPos + 1, is_default: false, is_completed: args.is_completed || false });
                if (error) throw error;
                return { success: true, project_name: proj.name, added_status: args.status_name };
            }
            if (args.action === 'rename') {
                if (!args.status_name || !args.new_name) return { error: 'Both status_name and new_name are required.' };
                const { data: st } = await supabase.from('project_statuses').select('id').eq('project_id', proj.id).ilike('name', `%${args.status_name}%`).limit(1).single();
                if (!st) return { error: `Status "${args.status_name}" not found in project.` };
                const { error } = await supabase.from('project_statuses').update({ name: args.new_name }).eq('id', (st as any).id);
                if (error) throw error;
                return { success: true, project_name: proj.name, old_name: args.status_name, new_name: args.new_name };
            }
            return { error: 'Invalid action. Use list, add, or rename.' };
        }

        case 'delete_task': {
            const task = await resolveTask(ctx, args.task_name);
            if (!task) return { error: `Task "${args.task_name}" not found.` };
            const { error } = await supabase.from('tasks').delete().eq('id', task.id);
            if (error) throw error;
            return { success: true, deleted_task: task.title };
        }

        default:
            return { error: 'Tool not found' };
    }
}

// ─── RAG Context Builder ──────────────────────────────────────────────────────

async function buildWorkspaceBriefing(wsId: string, userId: string): Promise<string> {
    try {
        const today = new Date();
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
        const userName = (profile as any)?.full_name || 'Unknown';
        const { data: wsProjects } = await supabase.from('projects').select('id').eq('workspace_id', wsId);
        const projIds = wsProjects?.map((p: any) => p.id) || [];
        let taskCount = 0;
        if (projIds.length) {
            const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).in('project_id', projIds);
            taskCount = count || 0;
        }
        const { count: memberCount } = await supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', wsId);
        return `WORKSPACE BRIEFING\nCurrent user: ${userName} (use this name for "my tasks", "I", "me" queries)\nProjects: ${projIds.length} | Tasks: ${taskCount} | Members: ${memberCount}\nToday: ${today.toDateString()}\nALWAYS use tools to fetch data before responding.\n`;
    } catch { return 'Briefing unavailable.'; }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are HamroAI — the intelligent workspace operations assistant.

## RULE 1: ALWAYS USE TOOLS FIRST
- NEVER guess or make up data. ALWAYS call a tool before answering questions about tasks, projects, members, time, or workspace.
- If a tool returns no data, say "I couldn't find any matching results." Do NOT invent results.
- The briefing tells you the current user's name — use it when they say "my", "I", "me".

## RULE 2: TOOL ROUTING GUIDE
Map user questions to the right tool(s):

**Tasks:** "my tasks" / "overdue" / "what's pending" / "assigned to X" → search_tasks
**Deadlines:** "due today" / "due tomorrow" / "due this week" / "what's urgent" → get_tasks_due_soon
**Task details:** "summarize task X" / "what happened in task X" → get_task_details
**Projects:** "project summary" / "show projects" / "project health" → search_projects or get_project_details
**Members:** "who is overloaded" / "team workload" / "show members" → list_members + get_member_workload or get_workspace_analytics
**Workspace:** "workspace summary" / "overall progress" / "are we on track" → get_workspace_analytics
**Time:** "hours logged" / "time spent" / "who logged most" → get_time_tracking
**Discussion:** "summarize discussion" / "what did team say" → get_task_comments
**Activity:** "what happened today" / "recent activity" / "what changed" → get_activity_logs
**Statuses:** "add status" / "rename status" / "list statuses" → manage_project_status
**Create:** "create task" / "create project" → create_task / create_project
**Update:** "move task" / "change priority" / "mark done" / "assign to" → update_task / reassign_task
**Bulk:** "mark all overdue as high" → search first, then bulk_update_tasks (confirm if >3 tasks)
**Delete:** "delete task X" → delete_task (always confirm first)
**Invite:** "invite member" → invite_member
**Role:** "change role" / "make admin" → change_member_role
**Smart:** "what should I work on" → search_tasks(assignee=current_user, overdue) + get_tasks_due_soon(today)
**Risk:** "what's at risk" / "why delayed" → get_workspace_analytics + get_project_details → infer reasons from data
**Prediction:** "when will project finish" → get_project_details → estimate from velocity (completed_this_week vs remaining)

## RULE 3: RESPONSE FORMAT
- Use names, NEVER UUIDs/IDs in replies
- Use emojis, bullet points, **bold** for key info
- Never show raw JSON, "null", "undefined", "database"
- When relevant, end with buttons block:
\`\`\`buttons
[{"label":"View Project","action":"open_project","id":"<id>","variant":"primary"}]
\`\`\`

## RULE 4: UNSUPPORTED FEATURES
If asked about these, say "This isn't available yet" and suggest an alternative:
- Automation / recurring tasks / auto-assign rules
- Multi-workspace comparison
- Setting reminders or notifications
- Switching workspaces

## PERSONALITY
Proactive, warm, concise. Offer follow-up suggestions. Never be robotic.`;

// ─── Response Parser ──────────────────────────────────────────────────────────

function parseButtonsFromResponse(content: string): { text: string; buttons: SmartButton[] | null } {
    const buttonRegex = /```buttons\s*([\s\S]*?)```/;
    const match = content.match(buttonRegex);
    if (!match) return { text: content, buttons: null };
    try {
        const buttons: SmartButton[] = JSON.parse(match[1].trim());
        const text = content.replace(buttonRegex, '').trim();
        return { text, buttons };
    } catch {
        return { text: content.replace(buttonRegex, '').trim(), buttons: null };
    }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GROQ_API_URL = (process.env.EXPO_PUBLIC_GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
const AI_MODEL = 'llama-3.3-70b-versatile';
const WHISPER_MODEL = 'whisper-large-v3';
const MAX_TOOL_ROUNDS = 6;

const QUICK_PROMPTS = [
    { label: '📊 Workspace summary', prompt: 'Give me a full workspace summary with overdue tasks and at-risk projects.' },
    { label: '🔴 Overdue tasks', prompt: 'What tasks are overdue right now?' },
    { label: '📋 My projects', prompt: 'Show me all my projects and their health status.' },
    { label: '👥 Team workload', prompt: 'Who is overloaded on the team right now?' },
    { label: '⚠️ Risk detection', prompt: 'Are there any projects at risk of delay?' },
    { label: '✅ Create a task', prompt: 'I want to create a new task.' },
    { label: '📁 Create a project', prompt: 'I want to create a new project.' },
    { label: '📩 Invite member', prompt: 'I want to invite a new team member.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _msgCounter = 0;
function makeId(): string { return `msg_${Date.now()}_${++_msgCounter}`; }

const STORAGE_KEY_PREFIX = 'hamroai_conv_';

const TOOL_LABELS: Record<string, string> = {
    search_tasks: '🔍 Searching tasks',
    get_task_details: '📋 Fetching task details',
    search_projects: '📁 Searching projects',
    get_project_details: '📊 Analyzing project',
    list_members: '👥 Loading members',
    get_member_workload: '📊 Checking workload',
    get_workspace_analytics: '📊 Analyzing workspace',
    bulk_update_tasks: '⚡ Updating tasks',
    get_activity_logs: '📜 Fetching activity',
    create_task: '✅ Creating task',
    update_task: '🔄 Updating task',
    create_project: '📁 Creating project',
    update_project: '🔄 Updating project',
    invite_member: '📩 Sending invitation',
    reassign_task: '👤 Reassigning task',
    change_member_role: '🔐 Changing role',
    get_tasks_due_soon: '📅 Checking deadlines',
    get_time_tracking: '⏱ Loading time data',
    get_task_comments: '💬 Loading discussion',
    manage_project_status: '🔄 Managing statuses',
    delete_task: '🗑 Deleting task',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIAssistant() {
    const { currentWorkspace } = useWorkspace();
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [inputText, setInputText] = useState('');
    const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
    const abortRef = useRef<boolean>(false);
    const messagesRef = useRef<ChatMessage[]>([]);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const wsId = currentWorkspace?.id || '';
    const userId = user?.id || '';
    const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
    const storageKey = wsId ? `${STORAGE_KEY_PREFIX}${wsId}` : '';

    // Keep messagesRef in sync
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    // Fix 3: Load conversation from AsyncStorage on mount
    useEffect(() => {
        if (!storageKey) return;
        AsyncStorage.getItem(storageKey).then(raw => {
            if (!raw) return;
            try {
                const saved = JSON.parse(raw) as any[];
                const restored: ChatMessage[] = saved.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp),
                    isLoading: false,
                    status: undefined,
                }));
                setMessages(restored);
            } catch { /* corrupt data, ignore */ }
        });
    }, [storageKey]);

    // Fix 3: Persist messages to AsyncStorage (debounced 1s to avoid rapid writes during tool rounds)
    useEffect(() => {
        if (!storageKey || messages.length === 0) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            const toSave = messages.filter(m => !m.isLoading && m.content);
            AsyncStorage.setItem(storageKey, JSON.stringify(toSave)).catch(() => {});
        }, 1000);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [messages, storageKey]);

    const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const full: ChatMessage = { ...msg, id: makeId(), timestamp: new Date() };
        setMessages(prev => [...prev, full]);
        return full.id;
    }, []);

    const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    }, []);

    const sendMessage = useCallback(async (userText: string) => {
        if (!userText.trim() || isLoading || !wsId) return;
        abortRef.current = false;
        setIsLoading(true);
        setLastFailedPrompt(null);

        addMessage({ role: 'user', content: userText });
        const loadingId = addMessage({ role: 'assistant', content: '', isLoading: true, status: 'Thinking...' });

        if (!apiKey) {
            updateMessage(loadingId, {
                content: '⚠️ HamroAI is not configured yet. Please add your `EXPO_PUBLIC_GROQ_API_KEY` to the `.env` file and restart the app.',
                isLoading: false, status: undefined,
            });
            setIsLoading(false);
            return;
        }

        try {
            // Build workspace context cache once — shared across all tool calls
            const ctx = await buildWsContext(wsId);

            let briefing = '';
            try { briefing = await buildWorkspaceBriefing(wsId, userId); } catch { briefing = ''; }

            // Fix 1: Use messagesRef for fresh state, filter out loading/empty messages
            const history = messagesRef.current
                .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.isLoading && m.content.trim())
                .slice(-10)
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

            // Remove the userText we just added (it's explicitly appended below)
            const lastHistoryMsg = history[history.length - 1];
            if (lastHistoryMsg?.role === 'user' && lastHistoryMsg.content === userText) {
                history.pop();
            }

            const apiMessages: any[] = [
                { role: 'system', content: SYSTEM_PROMPT + (briefing ? '\n\n' + briefing : '') },
                ...history,
                { role: 'user', content: userText },
            ];

            const toolDefs = TOOLS.map(t => ({
                type: 'function' as const,
                function: { name: t.name, description: t.description, parameters: t.parameters },
            }));

            let round = 0;
            let finalContent = '';

            while (round < MAX_TOOL_ROUNDS) {
                if (abortRef.current) break;
                round++;

                updateMessage(loadingId, { status: round === 1 ? 'Analyzing...' : `Using tools (round ${round})...` });

                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 30000);

                const url = `${GROQ_API_URL}/chat/completions`;
                const reqBody = JSON.stringify({
                    model: AI_MODEL,
                    messages: apiMessages,
                    tools: toolDefs,
                    tool_choice: 'auto',
                    max_tokens: 2048,
                    temperature: 0.4,
                });

                if (round === 1 && __DEV__) console.log('[HamroAI] URL:', url, '| Body size:', reqBody.length);

                let response: Response;
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                        body: reqBody,
                        signal: controller.signal as any,
                    });
                } catch (fetchErr: any) {
                    clearTimeout(timeout);
                    if (fetchErr?.name === 'AbortError') throw new Error('Request timed out. Please check your internet connection and try again.');
                    throw new Error(`Network error: ${fetchErr?.message || 'Could not connect to AI service.'}`);
                } finally {
                    clearTimeout(timeout);
                }

                if (!response.ok) {
                    const err = await response.text().catch(() => 'unknown');
                    throw new Error(`API error ${response.status}: ${err.slice(0, 200)}`);
                }

                const data = await response.json() as any;
                const choice = data.choices?.[0];
                const msg = choice?.message;

                if (!msg) throw new Error('No response from AI');

                const sanitized: any = { role: msg.role, content: msg.content || '' };
                if (msg.tool_calls?.length) sanitized.tool_calls = msg.tool_calls;
                apiMessages.push(sanitized);

                if (msg.tool_calls?.length) {
                    // Fix 4: Show human-readable tool names
                    const toolNames = msg.tool_calls.map((tc: any) => TOOL_LABELS[tc.function.name] || tc.function.name);
                    updateMessage(loadingId, { status: toolNames.join(', ') + '...' });

                    for (const tc of msg.tool_calls) {
                        const toolName = tc.function.name as ToolType;
                        let toolArgs: any = {};
                        try { toolArgs = JSON.parse(tc.function.arguments || '{}'); } catch { toolArgs = {}; }

                        let toolResult: any;
                        try {
                            toolResult = await executeToolCall(toolName, toolArgs, ctx, userId);
                        } catch (e: any) {
                            toolResult = { error: e?.message || 'Tool execution failed' };
                        }

                        apiMessages.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: JSON.stringify(toolResult),
                        });
                    }
                    continue;
                }

                finalContent = msg.content || '';
                break;
            }

            if (!finalContent) finalContent = "I wasn't able to complete that request. Please try again.";

            const { text, buttons } = parseButtonsFromResponse(finalContent);
            updateMessage(loadingId, { content: text, buttons, isLoading: false, status: undefined });

        } catch (e: any) {
            // Fix 5: Store failed prompt for retry
            setLastFailedPrompt(userText);
            updateMessage(loadingId, {
                content: `⚠️ Something went wrong: ${e?.message || 'Unknown error'}. Please try again.`,
                isLoading: false,
                status: undefined,
            });
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, wsId, userId, apiKey, addMessage, updateMessage]);

    // Fix 5: Retry function
    const retryLastMessage = useCallback(() => {
        if (lastFailedPrompt) {
            // Remove the failed assistant message
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && last.content.startsWith('⚠️')) return prev.slice(0, -1);
                return prev;
            });
            // Remove the user message too (sendMessage will re-add it)
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'user' && last.content === lastFailedPrompt) return prev.slice(0, -1);
                return prev;
            });
            sendMessage(lastFailedPrompt);
        }
    }, [lastFailedPrompt, sendMessage]);

    const transcribeAudio = useCallback(async (audioUri: string): Promise<string> => {
        const formData = new FormData();
        formData.append('file', { uri: audioUri, type: 'audio/m4a', name: 'recording.m4a' } as any);
        formData.append('model', WHISPER_MODEL);
        formData.append('language', 'en');

        const response = await fetch(`${GROQ_API_URL}/audio/transcriptions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData as any,
        });

        if (!response.ok) throw new Error('Transcription failed');
        const data = await response.json() as any;
        return data.text || '';
    }, [apiKey]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setLastFailedPrompt(null);
        if (storageKey) AsyncStorage.removeItem(storageKey).catch(() => {});
    }, [storageKey]);

    const stopGeneration = useCallback(() => {
        abortRef.current = true;
        setIsLoading(false);
    }, []);

    return {
        messages,
        isLoading,
        isRecording,
        inputText,
        setInputText,
        setIsRecording,
        sendMessage,
        transcribeAudio,
        clearMessages,
        stopGeneration,
        retryLastMessage,
        lastFailedPrompt,
        quickPrompts: QUICK_PROMPTS,
    };
}
