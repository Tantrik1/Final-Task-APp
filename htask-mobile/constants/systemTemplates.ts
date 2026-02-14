// System templates - pre-built industry templates available to all workspaces
// These are hardcoded for performance and versioning, not stored in DB

export type SystemFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url' | 'currency' | 'user' | 'multiselect' | 'file';

export interface SystemTemplateStatus {
    name: string;
    color: string;
    position: number;
    is_default?: boolean;
    is_completed?: boolean;
}

export interface SystemTemplateField {
    name: string;
    field_type: SystemFieldType;
    options?: string[];
    is_required?: boolean;
}

export interface SystemTemplateView {
    name: string;
    view_type: 'kanban' | 'list' | 'calendar';
    config?: Record<string, string>;
    is_default?: boolean;
}

export interface SystemTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    statuses: SystemTemplateStatus[];
    fields: SystemTemplateField[];
    views: SystemTemplateView[];
    is_system?: boolean;
    tasks?: any[];
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
    // 1. Marketing Team Template
    // 8. Simple / Personal Template
    {
        id: 'simple',
        name: 'Simple',
        description: 'Simple to-do workflow for personal tasks or beginners',
        icon: 'check-square',
        color: '#22c55e',
        is_system: true,
        tasks: [],
        statuses: [
            { name: 'To Do', color: '#94a3b8', position: 0, is_default: true },
            { name: 'Doing', color: '#f97316', position: 1 },
            { name: 'Done', color: '#22c55e', position: 2, is_completed: true },
        ],
        fields: [
            { name: 'Priority', field_type: 'select', options: ['Low', 'Medium', 'High'] },
        ],
        views: [
            { name: 'Kanban', view_type: 'kanban', is_default: true },
        ],
    },

    {
        id: 'marketing',
        name: 'Marketing Team',
        description: 'Content planning, campaigns, and publishing workflow for marketing teams',
        icon: 'megaphone',
        color: '#ec4899',
        is_system: true,
        tasks: [],
        statuses: [
            { name: 'Ideation', color: '#94a3b8', position: 0, is_default: true },
            { name: 'Content Planning', color: '#3b82f6', position: 1 },
            { name: 'Content Creating', color: '#f97316', position: 2 },
            { name: 'Content Approval', color: '#8b5cf6', position: 3 },
            { name: 'Scheduled', color: '#14b8a6', position: 4 },
            { name: 'Published', color: '#22c55e', position: 5, is_completed: true },
            { name: 'Rework', color: '#ef4444', position: 6 },
        ],
        fields: [
            { name: 'Platform', field_type: 'multiselect', options: ['Facebook', 'Instagram', 'TikTok', 'Website', 'Email'] },
            { name: 'Content Type', field_type: 'select', options: ['Post', 'Reel', 'Blog', 'Ad', 'Story'] },
            { name: 'Campaign', field_type: 'text' },
            { name: 'Publish Date', field_type: 'date' },
            { name: 'Designer', field_type: 'user' },
            { name: 'Copywriter', field_type: 'user' },
        ],
        views: [
            { name: 'Kanban', view_type: 'kanban', is_default: true },
            { name: 'Content Calendar', view_type: 'calendar', config: { date_field: 'Publish Date' } },
            { name: 'By Platform', view_type: 'list', config: { group_by: 'Platform' } },
        ],
    },

    // 2. Sales / CRM Team Template
    {
        id: 'sales-crm',
        name: 'Sales / CRM',
        description: 'Sales pipeline management from lead to close',
        icon: 'briefcase',
        color: '#10b981',
        is_system: true,
        tasks: [],
        statuses: [
            { name: 'Lead', color: '#94a3b8', position: 0, is_default: true },
            { name: 'Contacted', color: '#3b82f6', position: 1 },
            { name: 'Qualified', color: '#8b5cf6', position: 2 },
            { name: 'Proposal Sent', color: '#f97316', position: 3 },
            { name: 'Negotiation', color: '#eab308', position: 4 },
            { name: 'Won', color: '#22c55e', position: 5, is_completed: true },
            { name: 'Lost', color: '#ef4444', position: 6, is_completed: true },
        ],
        fields: [
            { name: 'Lead Source', field_type: 'select', options: ['Website', 'Referral', 'Cold Call', 'Event', 'LinkedIn', 'Other'] },
            { name: 'Deal Value', field_type: 'currency' },
            { name: 'Company', field_type: 'text' },
            { name: 'Phone', field_type: 'text' },
            { name: 'Follow-up Date', field_type: 'date' },
            { name: 'Sales Owner', field_type: 'user' },
        ],
        views: [
            { name: 'Pipeline', view_type: 'kanban', is_default: true },
            { name: 'Follow-ups', view_type: 'list', config: { sort_by: 'Follow-up Date' } },
        ],
    },

    // 3. Website / Software Development Template
    {
        id: 'software-dev',
        name: 'Software Development',
        description: 'Agile development workflow from backlog to deployment',
        icon: 'code',
        color: '#6366f1',
        is_system: true,
        tasks: [],
        statuses: [
            { name: 'Backlog', color: '#94a3b8', position: 0, is_default: true },
            { name: 'Ready', color: '#3b82f6', position: 1 },
            { name: 'In Progress', color: '#f97316', position: 2 },
            { name: 'Code Review', color: '#8b5cf6', position: 3 },
            { name: 'Testing', color: '#eab308', position: 4 },
            { name: 'Deployment', color: '#14b8a6', position: 5 },
            { name: 'Done', color: '#22c55e', position: 6, is_completed: true },
        ],
        fields: [
            { name: 'Module', field_type: 'text' },
            { name: 'Priority', field_type: 'select', options: ['Critical', 'High', 'Medium', 'Low'] },
            { name: 'Environment', field_type: 'select', options: ['Dev', 'Staging', 'Production'] },
            { name: 'Estimated Hours', field_type: 'number' },
            { name: 'Type', field_type: 'select', options: ['Bug', 'Feature', 'Enhancement', 'Refactor'] },
        ],
        views: [
            { name: 'Kanban', view_type: 'kanban', is_default: true },
            { name: 'By Priority', view_type: 'list', config: { group_by: 'Priority' } },
        ],
    },

    // 4. IT / Support / DevOps Template
    {
        id: 'it-support',
        name: 'IT / Support',
        description: 'IT support and incident management workflow',
        icon: 'headphones',
        color: '#f59e0b',
        is_system: true,
        tasks: [],
        statuses: [
            { name: 'Reported', color: '#94a3b8', position: 0, is_default: true },
            { name: 'Investigating', color: '#3b82f6', position: 1 },
            { name: 'Working', color: '#f97316', position: 2 },
            { name: 'Waiting for User', color: '#eab308', position: 3 },
            { name: 'Resolved', color: '#22c55e', position: 4, is_completed: true },
            { name: 'Closed', color: '#6b7280', position: 5, is_completed: true },
        ],
        fields: [
            { name: 'Severity', field_type: 'select', options: ['Critical', 'High', 'Medium', 'Low'] },
            { name: 'System', field_type: 'text' },
            { name: 'IP / Server', field_type: 'text' },
            { name: 'Issue Type', field_type: 'select', options: ['Hardware', 'Software', 'Network', 'Security', 'Other'] },
            { name: 'Logs', field_type: 'file' },
        ],
        views: [
            { name: 'Kanban', view_type: 'kanban', is_default: true },
            { name: 'By Severity', view_type: 'list', config: { group_by: 'Severity' } },
        ],
    },

    // 5. Operations Team Template
    {
        id: 'operations',
        name: 'Operations',
        description: 'Operations and process management with recurring tasks',
        icon: 'settings',
        color: '#8b5cf6',
        is_system: true,
        tasks: [],
        statuses: [
            { name: 'Planned', color: '#94a3b8', position: 0, is_default: true },
            { name: 'In Progress', color: '#f97316', position: 1 },
            { name: 'Waiting', color: '#eab308', position: 2 },
            { name: 'Completed', color: '#22c55e', position: 3, is_completed: true },
            { name: 'Recurring', color: '#3b82f6', position: 4 },
        ],
        fields: [
            { name: 'Department', field_type: 'select', options: ['HR', 'Finance', 'IT', 'Marketing', 'Sales', 'Operations'] },
            { name: 'Frequency', field_type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually'] },
            { name: 'SOP Link', field_type: 'url' },
            { name: 'Approved By', field_type: 'user' },
        ],
        views: [
            { name: 'By Department', view_type: 'list', config: { group_by: 'Department' }, is_default: true },
            { name: 'Kanban', view_type: 'kanban' },
        ],
    },

    // 6. Finance Team Template
    {
        id: 'finance',
        name: 'Finance',
        description: 'Financial tracking and expense management workflow',
        icon: 'dollar-sign',
        color: '#14b8a6',
        is_system: true,
        tasks: [],
        statuses: [
            { name: 'Recorded', color: '#94a3b8', position: 0, is_default: true },
            { name: 'Verification', color: '#3b82f6', position: 1 },
            { name: 'Approved', color: '#8b5cf6', position: 2 },
            { name: 'Paid', color: '#22c55e', position: 3, is_completed: true },
            { name: 'Archived', color: '#6b7280', position: 4, is_completed: true },
        ],
        fields: [
            { name: 'Expense Type', field_type: 'select', options: ['Travel', 'Software', 'Hardware', 'Marketing', 'Payroll', 'Office', 'Other'] },
            { name: 'Amount', field_type: 'currency' },
            { name: 'Vendor', field_type: 'text' },
            { name: 'Invoice', field_type: 'file' },
            { name: 'Payment Date', field_type: 'date' },
        ],
        views: [
            { name: 'By Payment Date', view_type: 'list', config: { sort_by: 'Payment Date' }, is_default: true },
            { name: 'By Vendor', view_type: 'list', config: { group_by: 'Vendor' } },
            { name: 'Kanban', view_type: 'kanban' },
        ],
    },

    // 7. Generic Project Management Template
    {
        id: 'generic-pm',
        name: 'Project Management',
        description: 'General-purpose project management workflow',
        icon: 'folder-kanban',
        color: '#0ea5e9',
        is_system: true,
        tasks: [],
        statuses: [
            { name: 'Planned', color: '#94a3b8', position: 0, is_default: true },
            { name: 'In Progress', color: '#f97316', position: 1 },
            { name: 'Blocked', color: '#ef4444', position: 2 },
            { name: 'Review', color: '#8b5cf6', position: 3 },
            { name: 'Completed', color: '#22c55e', position: 4, is_completed: true },
        ],
        fields: [
            { name: 'Phase', field_type: 'select', options: ['Planning', 'Execution', 'Monitoring', 'Closure'] },
            { name: 'Risk', field_type: 'select', options: ['Low', 'Medium', 'High'] },
            { name: 'Client', field_type: 'text' },
            { name: 'Deadline', field_type: 'date' },
        ],
        views: [
            { name: 'Kanban', view_type: 'kanban', is_default: true },
            { name: 'Timeline', view_type: 'calendar', config: { date_field: 'Deadline' } },
            { name: 'List', view_type: 'list' },
        ],
    },
];
