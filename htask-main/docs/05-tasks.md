# 05 — Tasks

## Overview

Tasks are the core work items in Hamro Task. Every task belongs to a project and uses that project's custom status workflow.

## Task Properties

| Property | Type | Description |
|----------|------|-------------|
| `title` | Text | Task name (required) |
| `description` | Text | Rich text description |
| `status` | Enum | Legacy status field (todo/in_progress/review/done) |
| `custom_status_id` | UUID | Links to project's custom status (primary status mechanism) |
| `priority` | Enum | low, medium, high, urgent |
| `assigned_to` | UUID | Single member assignment |
| `due_date` | Date | Deadline |
| `position` | Integer | Order within status column |
| `is_timer_running` | Boolean | Active time tracking flag |
| `total_work_time` | Integer | Accumulated work seconds |
| `first_started_at` | Timestamp | When work first began |
| `completed_at` | Timestamp | When marked as completed |
| Custom fields | Various | Project-specific fields (see Projects doc) |

## Task Creation

Tasks can be created from:

1. **"Add Task" button** on project detail page → Opens TaskSheet (slide-up panel)
2. **Kanban column** → Auto-assigns the column's status
3. **Calendar view** → Auto-assigns the clicked date as due date
4. **"My Tasks" view** → Quick task creation

### TaskSheet

The TaskSheet is the primary task creation/editing interface:

- **Mobile**: Full-screen slide-up sheet
- **Desktop**: Centered card dialog
- Fields: title, description, status, priority, assignee, due date, custom fields
- Tabs for: Details, Comments, Attachments, Links

## Task Views

### Kanban Board (`KanbanBoard.tsx`)

- Columns represent project statuses (ordered by `position`)
- Drag-and-drop between columns updates `custom_status_id` and `position`
- Cards show: title, priority badge, assignee avatar, due date, comment count
- **Mobile**: Vertical stacked columns with `MobileKanbanCard` and `MobileKanbanColumn`
- **Desktop**: Horizontal scrollable layout

### List View (`TaskList.tsx`)

- Rows with inline-editable fields via `InlineEditable*` components
- Editable inline: title, assignee, status, priority, due date
- Click row → Opens TaskSheet for full edit

### Calendar View (`ProjectCalendarView.tsx`)

- Monthly grid showing tasks by `due_date`
- Day cells show task count badges
- Click day → Bottom drawer with task list for that day
- Navigation: previous/next month buttons

## Task Detail Page (`WorkspaceTaskDetail.tsx`)

Dedicated full-page view for a task, accessible via `/workspace/:id/task/:taskId`:

- Timer controls prominently displayed
- Full task metadata editing
- Comments section
- Attachments section
- Links section
- Activity timeline

## Collaboration Features

### Comments (`TaskComments.tsx`)

- Threaded comments displayed as chat-style bubbles
- Support for replies (parent-child relationship)
- Real-time updates via Supabase subscriptions
- Each comment shows author avatar, name, timestamp

### Attachments (`TaskAttachments.tsx`)

- Upload any file type to Supabase Storage
- File metadata stored in `task_attachments` table
- Shows file name, size, type, uploader
- Click to download

### Links (`TaskLinks.tsx`)

- Add external URLs with custom titles
- Stored in `task_links` table
- Clickable links open in new tab

## Time Tracking

### Dual-Tier System

1. **Calendar Duration**: Time from `first_started_at` to `completed_at` (overall task lifespan)
2. **Work Sessions**: Precise tracked work time via start/pause/resume/complete controls

### Timer State Machine

```
                    ┌──────────┐
        ┌──────────►│  Paused  │──────────┐
        │           └──────────┘          │
     Pause                             Resume
        │           ┌──────────┐          │
        └───────────│ Running  │◄─────────┘
                    └──────────┘
                    Start │ Complete
                          ▼
                    ┌──────────┐
                    │Completed │
                    └──────────┘
```

### Timer Status Dialog

When pausing a timer, the `TimerStatusDialog` prompts the user to update the task's status:
- Select from project's custom statuses
- Encourages workflow discipline (e.g., move from "In Progress" to "Review")
- Completing a timer auto-sets status to the project's completed status

### Session Storage

```sql
task_sessions (
  id UUID PK,
  task_id UUID → tasks,
  user_id UUID → profiles,
  session_type TEXT DEFAULT 'work',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at
)
```

## Assignee Picker

- Search workspace members by name
- Shows avatar + full name
- Single assignment per task
- Assigning a task triggers a notification to the assignee

## "My Tasks" View (`WorkspaceMyTasks.tsx`)

A personal, cross-project view of all tasks assigned to the current user:

- **Mobile**: Horizontal swipable stats bar at top (total, overdue, in progress, completed)
- Groups: Today, This Week, Later
- High-density list optimized for quick scanning
- Default view on mobile for Member/Viewer roles

## Inline Editing

The List view supports inline editing via specialized components:

| Component | What it edits |
|-----------|--------------|
| `InlineEditableText` | Task title |
| `InlineEditableTextarea` | Description |
| `InlineEditableSelect` | Status, Priority |
| `InlineEditableDatePicker` | Due date |
| `InlineEditableAssignee` | Assigned member |

Click to edit → Save on blur/enter → Optimistic UI update

## Database Table

```sql
tasks (
  id UUID PK,
  project_id UUID → projects,
  title TEXT NOT NULL,
  description TEXT,
  status ENUM('todo','in_progress','review','done'),
  custom_status_id UUID → project_statuses,
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  assigned_to UUID → profiles,
  due_date DATE,
  position INTEGER DEFAULT 0,
  is_timer_running BOOLEAN DEFAULT false,
  total_work_time INTEGER DEFAULT 0,
  first_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID → profiles,
  created_at, updated_at
)
```

## For Project Managers

- **Kanban** for visual workflow management — see bottlenecks at a glance
- **List view** for detailed task tracking with inline editing — no need to open each task
- **Calendar** for deadline-driven planning — spot overdue tasks instantly
- **Time tracking** gives real data on how long work actually takes vs. estimates
- **"My Tasks"** keeps individual contributors focused without project-level noise
- **Comments & attachments** keep all context on the task — no more searching Slack or email
- **Custom statuses** mean your board reflects your actual workflow, not a generic template
