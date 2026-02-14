# 04 — Projects

## Overview

Projects are the primary organizational unit within a workspace. Each project contains tasks, custom statuses, custom fields, and configurable views.

## Project CRUD

| Action | Who Can Do It | Details |
|--------|---------------|---------|
| Create | Owner, Admin, Member | Choose blank or from template |
| Edit | Owner, Admin | Name, description, color, icon |
| Archive | Owner, Admin | Soft-delete, removes from active list |
| Delete | Owner, Admin | Via project settings dialog |

## Project Templates

Hamro Task includes **8 industry-specific system templates** that pre-configure statuses, custom fields, and views:

| Template | Statuses | Key Fields | Best For |
|----------|----------|------------|----------|
| **Marketing Team** | Ideation → Content Planning → Creating → Approval → Scheduled → Published → Rework | Platform (multiselect), Content Type, Campaign, Publish Date, Designer, Copywriter | Content teams |
| **Sales / CRM** | Lead → Contacted → Qualified → Proposal Sent → Negotiation → Won / Lost | Lead Source, Deal Value, Company, Phone, Follow-up Date, Sales Owner | Sales pipelines |
| **Software Development** | Backlog → Ready → In Progress → Code Review → Testing → Deployment → Done | Module, Priority, Environment, Estimated Hours, Type | Dev teams |
| **IT / Support** | Reported → Investigating → Working → Waiting for User → Resolved → Closed | Severity, System, IP/Server, Issue Type, Logs | IT helpdesks |
| **Operations** | Planned → In Progress → Waiting → Completed → Recurring | Department, Frequency, SOP Link, Approved By | Ops teams |
| **Finance** | Recorded → Verification → Approved → Paid → Archived | Expense Type, Amount, Vendor, Invoice, Payment Date | Finance teams |
| **Project Management** | Planned → In Progress → Blocked → Review → Completed | Phase, Risk, Client, Deadline | General PM |
| **Simple** | To Do → Doing → Done | Priority | Personal tasks |

### Custom Templates

Users can also create **workspace-level custom templates** that save:
- Status configurations
- Custom field definitions
- View configurations
- Pre-defined tasks

## Custom Workflow Statuses

Each project has its own status pipeline:

- **Default statuses** (created via DB trigger): To Do, In Progress, Review, Done
- **Customizable**: Name, color, position, `is_default` flag, `is_completed` flag
- **Status integrity**: If a status is deleted, all tasks using it are reassigned to the project's default status
- **Status management UI**: Drag-and-drop reordering via the Status Manager component

```sql
project_statuses (
  id UUID PK,
  project_id UUID → projects,
  name TEXT,
  color TEXT,
  position INT,
  is_default BOOLEAN,
  is_completed BOOLEAN,
  created_at, updated_at
)
```

## Custom Fields

Projects support **10 field types** for extending task data:

| Type | Description | Example |
|------|-------------|---------|
| `text` | Free-form text | Client name |
| `number` | Numeric value | Story points |
| `date` | Date picker | Deadline |
| `select` | Single-choice dropdown | Priority |
| `multiselect` | Multi-choice tags | Platforms |
| `checkbox` | Boolean toggle | Approved? |
| `url` | Clickable link | Figma link |
| `currency` | Monetary value | Deal value |
| `user` | Workspace member picker | Reviewer |
| `file` | File attachment | Invoice |

Custom field values are stored separately:

```sql
custom_field_definitions (
  id, project_id, name, field_type, options JSONB, is_required, position
)

task_custom_field_values (
  id, task_id, field_id,
  value_text, value_number, value_date, value_boolean
)
```

## Project Views

Each project supports three view modes:

### 1. Kanban Board
- Columns = custom statuses
- Drag-and-drop tasks between columns (uses `@hello-pangea/dnd`)
- Mobile: vertical stacked layout with swipeable cards
- Desktop: horizontal scrollable columns

### 2. List View
- Tabular layout with inline-editable fields
- Sortable columns
- Status badges with color coding

### 3. Calendar View
- Month navigation with day-level task display
- Tasks shown by `due_date`
- Mobile: bottom-drawer sheet for task details
- Click on a day to add tasks

## Project Settings Dialog

Accessible via the ⚙️ icon on project detail page (Owner/Admin only):

- **General**: Edit name, description, color
- **Statuses**: Manage workflow statuses (add, edit, reorder, delete)
- **Custom Fields**: Manage field definitions
- **Templates**: Save current project config as a reusable template
- **Danger Zone**: Archive or delete project

## Database Table

```sql
projects (
  id UUID PK,
  workspace_id UUID → workspaces,
  name TEXT,
  description TEXT,
  color TEXT,
  icon TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_by UUID → profiles,
  created_at, updated_at
)
```

## For Project Managers

- **Use templates** to standardize workflows across your team (e.g., all marketing projects use the Marketing template)
- **Custom statuses** let you model any workflow — from simple 3-step to complex 7-step pipelines
- **Custom fields** eliminate the need for external spreadsheets — track deal values, deadlines, links directly on tasks
- **Views** give flexibility: Kanban for visual workflow, List for detailed tracking, Calendar for deadline management
- **Archive** completed projects to keep the workspace clean without losing data
