import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from './useWorkspace';
import { useAuth } from './useAuth';
import OpenAI from 'openai';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: Date;
    isLoading?: boolean;
    status?: string;
    actions?: AIAction[] | null;
}

export interface AIAction {
    type: 'create_task' | 'update_task' | 'create_project' | 'update_project' | 'invite_member' | 'view_tasks' | 'view_projects' | 'bulk_update';
    label: string;
    is_draft?: boolean;
    missing_fields?: string[];
    data?: any;
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

type ToolType = 'search_tasks' | 'get_task_details' | 'search_projects' | 'list_members' | 'get_workspace_analytics' | 'bulk_update_tasks' | 'get_activity_logs';

interface ToolDefinition {
    name: ToolType;
    description: string;
    parameters: any;
}

const TOOLS: ToolDefinition[] = [
    {
        name: 'search_tasks',
        description: 'Search for tasks in the current workspace by title, status, or assignee.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search term (title, description, etc.)' },
                status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
                assignee_id: { type: 'string', description: 'UUID of the member to filter by' }
            }
        }
    },
    {
        name: 'get_task_details',
        description: 'Get full details for a specific task including comments and metadata.',
        parameters: {
            type: 'object',
            properties: {
                task_id: { type: 'string', description: 'The UUID of the task.' }
            },
            required: ['task_id']
        }
    },
    {
        name: 'search_projects',
        description: 'Search for projects in the current workspace.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string' }
            }
        }
    },
    {
        name: 'list_members',
        description: 'Get a list of all members in the current workspace.',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'get_workspace_analytics',
        description: 'Retrieve statistical data about workspace health, including overdue tasks, workload imbalances, and bottleneck analysis.',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'bulk_update_tasks',
        description: 'Update multiple tasks at once. Useful for priority shifts or status moves.',
        parameters: {
            type: 'object',
            properties: {
                task_ids: { type: 'array', items: { type: 'string' } },
                updates: { type: 'object', properties: { status: { type: 'string' }, priority: { type: 'string' }, due_date: { type: 'string' } } }
            },
            required: ['task_ids', 'updates']
        }
    },
    {
        name: 'get_activity_logs',
        description: 'Retrieve recent activity logs for a specific task or project.',
        parameters: {
            type: 'object',
            properties: {
                task_id: { type: 'string' },
                project_id: { type: 'string' },
                limit: { type: 'number', default: 10 }
            }
        }
    }
];

// ─── Tool Call Executor ──────────────────────────────────────────────────────

async function executeToolCall(
    name: ToolType,
    args: any,
    workspaceId: string,
    userId: string
): Promise<any> {
    switch (name) {
        case 'search_tasks': {
            const { data: projects } = await supabase.from('projects').select('id').eq('workspace_id', workspaceId);
            const pIds = projects?.map((p: any) => p.id) || [];

            let q = supabase.from('tasks').select('id, title, status, priority, due_date, assigned_to').in('project_id', pIds);
            if (args.query) q = q.ilike('title', `%${args.query}%`);
            if (args.status) q = q.eq('status', args.status);
            if (args.assignee_id) q = q.eq('assigned_to', args.assignee_id);

            const { data } = await q.limit(10);
            return data || [];
        }
        case 'get_task_details': {
            const { data } = await supabase.from('tasks').select('*, profiles:assigned_to(full_name), project:project_id(name)').eq('id', args.task_id).single();
            const { data: comments } = await supabase.from('task_comments').select('*, profiles:user_id(full_name)').eq('task_id', args.task_id).order('created_at', { ascending: true });
            return { ...data, comments };
        }
        case 'search_projects': {
            let q = supabase.from('projects').select('*').eq('workspace_id', workspaceId);
            if (args.query) q = q.ilike('name', `%${args.query}%`);
            const { data } = await q;
            return data || [];
        }
        case 'list_members': {
            const { data: memberships } = await supabase.from('workspace_members').select('user_id, role').eq('workspace_id', workspaceId);
            const mIds = memberships?.map((m: any) => m.user_id) || [];
            const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', mIds);
            return profiles?.map((p: any) => ({ ...p, role: memberships?.find((m: any) => m.user_id === p.id)?.role })) || [];
        }
        case 'get_workspace_analytics': {
            const { data: projects } = await supabase.from('projects').select('id').eq('workspace_id', workspaceId);
            const pIds = projects?.map((p: any) => p.id) || [];
            const { data: tasks } = await supabase.from('tasks').select('*').in('project_id', pIds);

            const today = new Date();
            const overdue = tasks?.filter((t: any) => t.due_date && new Date(t.due_date) < today && t.status !== 'done') || [];
            const stuck = tasks?.filter((t: any) => {
                const updatedAt = new Date(t.updated_at || t.created_at);
                const fiveDaysAgo = new Date();
                fiveDaysAgo.setDate(today.getDate() - 5);
                return t.status !== 'done' && updatedAt < fiveDaysAgo;
            }) || [];

            const workload: Record<string, number> = {};
            tasks?.forEach((t: any) => {
                if (t.assigned_to && t.status !== 'done') {
                    workload[t.assigned_to] = (workload[t.assigned_to] || 0) + 1;
                }
            });

            return {
                total_tasks: tasks?.length || 0,
                overdue_count: overdue.length,
                stuck_count: stuck.length,
                workload_analysis: workload,
                critical_tasks: overdue.slice(0, 5)
            };
        }
        case 'bulk_update_tasks': {
            const { data, error } = await supabase.from('tasks').update(args.updates).in('id', args.task_ids).select();
            if (error) throw error;
            return { success: true, updated_count: data?.length || 0 };
        }
        case 'get_activity_logs': {
            let q = supabase.from('task_activity_logs').select('*, profiles:user_id(full_name)').order('created_at', { ascending: false });
            if (args.task_id) q = q.eq('task_id', args.task_id);
            if (args.project_id) {
                // Activity logs usually linked to tasks, so we fetch tasks for project first
                const { data: tasks } = await supabase.from('tasks').select('id').eq('project_id', args.project_id);
                const tIds = tasks?.map((t: any) => t.id) || [];
                q = q.in('task_id', tIds);
            }
            const { data } = await q.limit(args.limit || 10);
            return data || [];
        }
        default:
            return { error: 'Tool not found' };
    }
}

// ─── RAG Context Builder ──────────────────────────────────────────────────────

async function buildWorkspaceBriefing(workspaceId: string, userId: string): Promise<string> {
    try {
        const today = new Date();

        // Brief summary instead of full dump
        const { count: taskCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
        const { count: projectCount } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId);
        const { count: memberCount } = await supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId);

        let ctx = `=== EXECUTIVE WORKSPACE BRIEFING ===\n`;
        ctx += `Workspace Stats: ${projectCount} Projects | ${taskCount} Tasks | ${memberCount} Members\n`;
        ctx += `Today is: ${today.toDateString()}\n\n`;
        ctx += `You have autonomous access to tools to search and retrieve specific details. Start by analyzing the user query and using tools if you need more data.\n`;

        return ctx;
    } catch (error) {
        return 'Briefing unavailable.';
    }
}


// ─── Action Executor ──────────────────────────────────────────────────────────

export async function executeAIAction(
    action: AIAction,
    workspaceId: string,
    userId: string
): Promise<{ success: boolean; message: string; data?: any }> {
    try {
        switch (action.type) {
            case 'create_task': {
                const { title, description, priority, due_date, project_id, assigned_to } = action.data;

                // Get max position
                const { data: existingTasks } = await supabase
                    .from('tasks')
                    .select('position')
                    .eq('project_id', project_id)
                    .order('position', { ascending: false })
                    .limit(1);

                const maxPos = existingTasks?.[0]?.position ?? -1;

                const { data, error } = await supabase
                    .from('tasks')
                    .insert({
                        title,
                        description: description || null,
                        priority: priority || 'medium',
                        due_date: due_date || null,
                        project_id,
                        assigned_to: assigned_to || null,
                        created_by: userId,
                        status: 'todo',
                        position: maxPos + 1,
                    })
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, message: `✅ Task "${title}" created successfully!`, data };
            }

            case 'update_task': {
                const { task_id, updates } = action.data;
                const { error } = await supabase
                    .from('tasks')
                    .update(updates)
                    .eq('id', task_id);

                if (error) throw error;
                return { success: true, message: `✅ Task updated successfully!` };
            }

            case 'create_project': {
                const { name, description, color } = action.data;
                const { data, error } = await supabase
                    .from('projects')
                    .insert({
                        name,
                        description: description || null,
                        color: color || '#3B82F6',
                        workspace_id: workspaceId,
                        created_by: userId,
                        is_archived: false,
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Create default statuses
                await supabase.from('project_statuses').insert([
                    { project_id: data.id, name: 'To Do', color: '#64748B', position: 0, is_default: true, is_completed: false },
                    { project_id: data.id, name: 'In Progress', color: '#3B82F6', position: 1, is_default: false, is_completed: false },
                    { project_id: data.id, name: 'Done', color: '#22C55E', position: 2, is_default: false, is_completed: true },
                ]);

                return { success: true, message: `✅ Project "${name}" created successfully!`, data };
            }

            default:
                return { success: false, message: 'Unknown action type' };
        }
    } catch (error: any) {
        return { success: false, message: `❌ Error: ${error.message}` };
    }
}

// ─── Main Hook ────────────────────────────────────────────────────────────────


// ─── Main Hook ────────────────────────────────────────────────────────────────

const AI_MODEL = "llama-3.1-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1";
const WHISPER_MODEL = "whisper-large-v3";

const groq = new OpenAI({
    apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY || '',
    baseURL: GROQ_API_URL,
    dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `You are HamroAI, the Strategic Workspace Brain and autonomous intelligence for this workspace. 
Your tone is Gen-Z modern: friendly, smart, clear, and slightly edgy but professional. You are here to help the user CRUSH their goals.

CORE COMPETENCIES:
- **Strategic Analyst**: You don't just list tasks; you analyze bottlenecks (stuck tasks), workload imbalances, and delay risks.
- **Proactive Coordinator**: If something is overdue or a project hasn't been updated in 7 days, POINT IT OUT.
- **Execution Engine**: You can search, summarize, create, update, and bulk-manage workspace data.

AGENTIC PROTOCOL:
1. **TOOL USAGE**: Use tools to fetch data. Don't guess. If you need details on a task, use \`get_task_details\`.
2. **VERIFICATION**: If creating a task, ensure it has a Description, Priority, and Due Date. If missing, ask the user or provide a "DRAFT" action.
3. **BULK ACTIONS**: You can move/update groups of tasks. Suggest this when you see bottlenecks.
4. **ROLE AWARENESS**: Respect that Owners/Admins have full control, while Members have restricted access.

CONSTRAINTS:
1. ALWAYS provide **Strategic Insights** and **Bottleneck Analysis**.
2. **MANDATORY DEEP LINKS**: Every project or task mention MUST use: [[task:ID:TITLE]] or [[project:ID:NAME]].
3. **ACTION FORMAT**: Action buttons for user-initiated changes MUST be in a valid JSON block labeled with \`\`\`action.

MULTI-ACTION JSON SCHEMA:
{
  "actions": [
    {
      "type": "create_task" | "update_task" | "create_project" | "bulk_update",
      "label": "Action Button Label",
      "data": { ... }
    }
  ],
  "strategic_rationale": "Why are you suggesting this?"
}

WORKSPACE CONTEXT:
{{CONTEXT}}

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: ${new Date().toLocaleTimeString()}
`;





export function useAIAssistant() {
    const { currentWorkspace } = useWorkspace();
    const { user } = useAuth();

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: `🚀 **HamroAI Agent Online.**\n\nI can autonomously search your workspace and manage tasks on command.\n\nHow can I assist you today?`,
            timestamp: new Date(),
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isContextLoading, setIsContextLoading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const contextRef = useRef<string>('');
    const contextLoadedRef = useRef(false);


    const transcribeAudio = async (audioUri: string): Promise<string | null> => {
        if (!process.env.EXPO_PUBLIC_GROQ_API_KEY) return null;
        setIsTranscribing(true);
        try {
            const formData = new FormData();
            // @ts-ignore
            formData.append('file', {
                uri: audioUri,
                type: 'audio/m4a',
                name: 'audio.m4a',
            });
            formData.append('model', WHISPER_MODEL);

            const response = await fetch(`${GROQ_API_URL}/audio/transcriptions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,
                },
                body: formData as any,
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(err);
            }

            const data = await response.json() as any;
            return data.text || null;

        } catch (error) {
            console.error('Transcription failed:', error);
            return null;
        } finally {
            setIsTranscribing(false);
        }
    };

    const loadContext = useCallback(async () => {
        if (!currentWorkspace?.id || !user?.id) return;
        if (contextLoadedRef.current) return;

        setIsContextLoading(true);
        try {
            contextRef.current = await buildWorkspaceBriefing(currentWorkspace.id, user.id);
            contextLoadedRef.current = true;
        } finally {
            setIsContextLoading(false);
        }
    }, [currentWorkspace?.id, user?.id]);

    const refreshContext = useCallback(async () => {
        if (!currentWorkspace?.id || !user?.id) return;
        contextLoadedRef.current = false;
        setIsContextLoading(true);
        try {
            contextRef.current = await buildWorkspaceBriefing(currentWorkspace.id, user.id);
            contextLoadedRef.current = true;
        } finally {
            setIsContextLoading(false);
        }
    }, [currentWorkspace?.id, user?.id]);

    const fetchConversations = useCallback(async () => {
        if (!currentWorkspace?.id || !user?.id) return;
        const { data, error } = await supabase
            .from('ai_conversations')
            .select('*')
            .eq('workspace_id', currentWorkspace.id)
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (!error && data) {
            setConversations(data);
        }
    }, [currentWorkspace?.id, user?.id]);

    const loadConversation = useCallback(async (convId: string) => {
        const { data, error } = await supabase
            .from('ai_messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('timestamp', { ascending: true });

        if (!error && data) {
            setMessages(data.map(m => ({
                id: m.id,
                role: m.role as any,
                content: m.content,
                timestamp: new Date(m.timestamp),
                actions: m.actions
            })));
            setActiveConversationId(convId);
        }
    }, []);


    const parseActionFromResponse = (content: string): { cleanContent: string; actions: AIAction[] | null } => {
        const actionRegex = /```(?:action|json)\s*([\s\S]*?)\s*```/g;
        let actions: AIAction[] = [];
        let cleanContent = content;
        let match;

        while ((match = actionRegex.exec(content)) !== null) {
            try {
                const rawData = JSON.parse(match[1].trim());
                cleanContent = cleanContent.replace(match[0], '');

                if (rawData.actions && Array.isArray(rawData.actions)) {
                    actions = [...actions, ...rawData.actions];
                } else if (rawData.type) {
                    actions.push(rawData as AIAction);
                }
            } catch (e) {
                cleanContent = cleanContent.replace(match[0], '');
            }
        }

        return {
            cleanContent: cleanContent.replace(/\n{3,}/g, '\n\n').trim(),
            actions: actions.length > 0 ? actions : null
        };
    };




    const sendMessage = useCallback(async (userInput: string) => {
        if (!userInput.trim() || isLoading) return;
        if (!currentWorkspace?.id || !user?.id) return;

        if (!contextLoadedRef.current) await loadContext();

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: userInput.trim(),
            timestamp: new Date(),
        };

        const loadingId = `loading-${Date.now()}`;
        const loadingMessage: ChatMessage = {
            id: loadingId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true,
            status: 'Thinking...'
        };

        setMessages(prev => [...prev, userMessage, loadingMessage]);
        setIsLoading(true);

        try {
            let convId = activeConversationId;
            if (!convId) {
                const { data: newConv } = await supabase
                    .from('ai_conversations')
                    .insert({
                        user_id: user.id,
                        workspace_id: currentWorkspace.id,
                        title: userInput.trim().substring(0, 40) + '...',
                    })
                    .select().single();
                convId = (newConv as any).id;
                setActiveConversationId(convId);
                fetchConversations();
            }

            await supabase.from('ai_messages').insert({
                conversation_id: convId,
                role: 'user',
                content: userInput.trim(),
            });

            const chatMessages: any[] = [
                { role: 'system', content: SYSTEM_PROMPT.replace('{{CONTEXT}}', contextRef.current) },
                ...messages.filter(m => !m.isLoading && m.id !== 'welcome').slice(-6).map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: userInput.trim() }
            ];

            let toolCallsCount = 0;
            const MAX_TOOL_CALLS = 5;

            while (toolCallsCount < MAX_TOOL_CALLS) {
                const response = await groq.chat.completions.create({
                    model: AI_MODEL,
                    messages: chatMessages,
                    tools: TOOLS.map(t => ({
                        type: 'function',
                        function: {
                            name: t.name,
                            description: t.description,
                            parameters: t.parameters
                        }
                    })),
                    tool_choice: 'auto',
                });

                const msg = response.choices[0].message;
                chatMessages.push(msg);

                if (msg.tool_calls) {
                    toolCallsCount++;
                    const toolCalls = msg.tool_calls;
                    for (const tc of toolCalls) {
                        const call = tc as any;
                        if (call.function) {
                            // Update status indicator
                            const toolName = call.function.name;
                            const statusLabel = toolName.split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
                            setMessages(prev => prev.map(m => m.id === loadingId ? { ...m, status: `Agent: ${statusLabel}...` } : m));

                            const result = await executeToolCall(
                                toolName as ToolType,
                                JSON.parse(call.function.arguments),
                                currentWorkspace.id,
                                user.id
                            );
                            chatMessages.push({
                                role: 'tool',
                                tool_call_id: call.id,
                                content: JSON.stringify(result)
                            });
                        }
                    }
                    // Reset to Thinking after tools
                    setMessages(prev => prev.map(m => m.id === loadingId ? { ...m, status: 'Thinking...' } : m));
                } else {
                    break;
                }
            }

            const finalContent = chatMessages[chatMessages.length - 1].content || 'No response generated.';
            const { cleanContent, actions } = parseActionFromResponse(finalContent);

            const { data: savedMsg } = await supabase
                .from('ai_messages')
                .insert({
                    conversation_id: convId,
                    role: 'assistant',
                    content: cleanContent,
                    actions,
                })
                .select().single();

            const assistantMessage: ChatMessage = {
                id: (savedMsg as any).id,
                role: 'assistant',
                content: cleanContent,
                timestamp: new Date((savedMsg as any).timestamp),
                actions,
            };

            setMessages(prev => prev.filter(m => m.id !== loadingId).concat(assistantMessage));
            await supabase.from('ai_conversations').update({ updated_at: new Date() }).eq('id', convId);

        } catch (error: any) {
            console.error('Agent Loop Error:', error);
            setMessages(prev => prev.filter(m => !m.isLoading).concat({
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: `❌ **Agent Error:** ${error.message}`,
                timestamp: new Date(),
            }));
        } finally {
            setIsLoading(false);
        }
    }, [messages, isLoading, currentWorkspace?.id, user?.id, loadContext, activeConversationId, fetchConversations]);



    const executeAction = useCallback(async (action: AIAction): Promise<void> => {
        if (!currentWorkspace?.id || !user?.id) return;
        const result = await executeAIAction(action, currentWorkspace.id, user.id);
        setMessages(prev => [...prev, {
            id: `result-${Date.now()}`,
            role: 'assistant',
            content: result.message,
            timestamp: new Date(),
        }]);
        if (result.success) await refreshContext();
    }, [currentWorkspace?.id, user?.id, refreshContext]);

    const clearChat = useCallback(() => {
        contextLoadedRef.current = false;
        setActiveConversationId(null);
        setMessages([
            {
                id: 'welcome',
                role: 'assistant',
                content: `🚀 **HamroAI Agent Online.**\n\nI can autonomously search your workspace and manage tasks on command.`,
                timestamp: new Date(),
            }
        ]);
    }, []);


    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    return {
        messages,
        isLoading,
        isContextLoading,
        sendMessage,
        executeAction,
        clearChat,
        loadContext,
        refreshContext,
        transcribeAudio,
        isTranscribing,
        conversations,
        activeConversationId,
        loadConversation,
        fetchConversations,
    };
}
