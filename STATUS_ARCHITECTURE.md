# Status Architecture — Deep Database Analysis & Scalable Plan

## Current Schema Audit

### 🔴 CRITICAL: The Dual Status Problem

```
tasks table:
├── status          (enum: todo | in_progress | review | done)  ← REDUNDANT
├── custom_status_id (FK → project_statuses.id)                 ← SOURCE OF TRUTH
├── completed_at     (timestamp)                                ← SHOULD BE AUTO-DERIVED
├── first_started_at (timestamp)                                ← SHOULD BE AUTO-DERIVED
├── is_timer_running (boolean)                                  ← DENORMALIZED, DRIFTS
└── total_work_time  (integer)                                  ← DENORMALIZED, DRIFTS
```

**Two systems for the same concept = guaranteed data drift.**

---

## Full Problem Map (10 Issues Found)

### Issue 1: `tasks.status` enum is REDUNDANT
- **What:** Hardcoded to 4 values (todo, in_progress, review, done)
- **Why bad:** Custom statuses make this meaningless. A project with "Backlog → Design → Dev → QA → Staging → Production" can't map to 4 enum values.
- **Fix:** Keep for backward compat but auto-derive via DB trigger from `custom_status_id`

### Issue 2: `tasks.custom_status_id` is NULLABLE
- **What:** Tasks can exist with `custom_status_id = NULL`
- **Why bad:** Orphaned tasks with no real status. Forces every query to handle NULL fallback.
- **Fix:** Backfill all NULLs → project default status. Then make NOT NULL.

### Issue 3: `project_statuses` has no CATEGORY
- **What:** Only has `is_default` and `is_completed` booleans
- **Why bad:** No universal language for cross-project queries. Can't ask "show me all active tasks" without knowing every project's custom status names.
- **How ClickUp/Linear solve it:** Every status has a `category` (backlog, todo, active, done, cancelled). Categories are the universal query language.
- **Fix:** Add `category` enum column. Backfill from existing booleans.

### Issue 4: `task_sessions` and `task_work_sessions` are DUPLICATES
- **What:** Two tables tracking the same thing (work sessions on tasks)
- `task_sessions`: has `session_type` (start/resume)
- `task_work_sessions`: simpler, used by the actual timer system
- **Fix:** Migrate data from `task_sessions` → `task_work_sessions`, drop `task_sessions`

### Issue 5: `tasks.is_timer_running` is DENORMALIZED incorrectly
- **What:** Boolean on task row tracking if timer is running
- **Why bad:** Can go out of sync with `task_work_sessions` (e.g., app crash, network failure)
- **Fix:** Derive from `task_work_sessions` — timer is running if latest session has `ended_at IS NULL`

### Issue 6: `tasks.total_work_time` is DENORMALIZED
- **What:** Integer on task row tracking total seconds worked
- **Why bad:** Drifts out of sync with actual `task_work_sessions` sum
- **Fix:** Compute from `SUM(duration_seconds)` on `task_work_sessions` or keep as cache but add a resync mechanism

### Issue 7: `tasks.first_started_at` is AMBIGUOUS
- **What:** Timestamp — but when exactly? First timer start? First status change from todo?
- **Fix:** Auto-set via trigger when task first moves out of backlog/todo category

### Issue 8: No STATUS TRANSITION HISTORY
- **What:** No table tracking status changes over time
- **Why critical:** Without this, you CANNOT build:
  - Cycle time analytics (how long from todo → done?)
  - Lead time analytics (how long from created → done?)
  - Time-in-status reports (how long did task sit in "In Review"?)
  - SLA tracking (did it breach the time limit?)
  - Automation triggers ("when task enters status X, do Y")
- **How ClickUp/Linear solve it:** Both track every single status transition with timestamps
- **Fix:** Create `status_transitions` table

### Issue 9: `activity_logs.action_type` is free-text
- **What:** No enum constraint — could be anything
- **Why bad:** Can't reliably filter/query by action type for automations
- **Note:** Low priority, keep as-is for flexibility but document expected values

### Issue 10: No AUTOMATION RULES table
- **What:** No way to define "when status changes to X, do Y"
- **Fix:** Future phase — create `automation_rules` table

---

## How ClickUp, Linear, and Asana Handle Status

### ClickUp's Model
```
Space → Folder → List → Task
                   ↓
            List has Statuses[]
            Each status has:
              - name, color, orderindex
              - type: "open" | "custom" | "closed" | "done"
            
            Task has ONE status field → points to the status
            NO enum. NO dual system. Just one field.
            
            Cross-list views use "type" to categorize:
              "open"   = not started
              "custom" = in progress (any custom state)
              "closed" = done
              "done"   = completed
```

### Linear's Model
```
Team → Project → Issue
         ↓
   WorkflowState (= status)
   Each state has:
     - name, color, position
     - type: "backlog" | "unstarted" | "started" | "completed" | "cancelled"
   
   Issue has ONE stateId → points to WorkflowState
   
   Cross-project views filter by type:
     "backlog"    = not prioritized
     "unstarted"  = ready to start
     "started"    = in progress
     "completed"  = done
     "cancelled"  = won't do
```

### Asana's Model
```
Project → Section (= status column)
Task belongs to one or more Projects
In each Project, task is in one Section

"Completed" is a separate boolean flag on the task
Sections are purely organizational
```

### **Our Model (After Fix)**
```
Workspace → Project → Task
               ↓
         ProjectStatus (= custom status)
         Each status has:
           - name, color, position
           - category: "backlog" | "todo" | "active" | "done" | "cancelled"
           - is_default (first status for new tasks)
           - is_completed (legacy compat, derived from category='done')
         
         Task has ONE custom_status_id → points to ProjectStatus
         tasks.status enum = auto-derived from category (backward compat)
         completed_at = auto-set when category is 'done'/'cancelled'
         
         Status transitions tracked in status_transitions table
```

---

## The Migration (7 Phases)

All in `20260219150000_add_status_category.sql`:

### Phase 1: Add `category` enum to `project_statuses` + `template_statuses`
```
status_category: backlog | todo | active | done | cancelled
```
- Backfilled from existing `is_default` and `is_completed` flags
- Indexed for fast cross-project queries

### Phase 2: Create `status_transitions` table
- Tracks every status change with timestamps
- Records `from_status_id`, `to_status_id`, `from_category`, `to_category`
- Records `time_in_previous_ms` for analytics
- RLS enabled — users can only see transitions for their workspace

### Phase 3: Backfill `custom_status_id` for orphaned tasks
- Any task with `custom_status_id = NULL` → assigned project's default status
- Fallback: first status by position if no default exists

### Phase 4: Auto-sync trigger (`custom_status_id` → `status` + `completed_at`)
- **BEFORE UPDATE trigger** on `tasks`
- When `custom_status_id` changes:
  1. Derives `tasks.status` enum from the category
  2. Sets/clears `completed_at` automatically
  3. Sets `first_started_at` when first moving to active
  4. Records the transition in `status_transitions`
- **This means the app only needs to write `custom_status_id`** — everything else is auto-derived!

### Phase 5: Fix broken `handle_task_activity` trigger
- Fixes the `COALESCE(priority, 'None')` → 22P02 enum cast error
- Now detects `custom_status_id` changes (resolves actual status names for descriptions)
- Falls back to `status` enum change detection

### Phase 6: Remove duplicate `task_sessions` table
- Migrates all data to `task_work_sessions`
- Drops `task_sessions`

### Phase 7: Add missing performance indexes
- `idx_tasks_custom_status_id` — fast status lookups
- `idx_tasks_project_custom_status` — Kanban/List views
- `idx_tasks_assigned_to` — My Tasks queries
- `idx_tasks_due_date` — Calendar/overdue queries
- `idx_tasks_completed` — Completed tasks
- `idx_activity_logs_workspace_time` — Activity feed
- `idx_notifications_user_unread` — Notification badge count

---

## Column Audit: What to Keep, Remove, Derive

### `tasks` table

| Column | Verdict | Reason |
|--------|---------|--------|
| `status` | **KEEP (auto-derived)** | Backward compat. Auto-set by trigger from category. |
| `custom_status_id` | **KEEP (source of truth)** | The ONE status field. Should become NOT NULL after backfill. |
| `completed_at` | **KEEP (auto-derived)** | Auto-set by trigger when category = done/cancelled. |
| `first_started_at` | **KEEP (auto-derived)** | Auto-set by trigger when first moving to active. |
| `is_timer_running` | **DEPRECATE (future)** | Should derive from task_work_sessions. Keep for now. |
| `total_work_time` | **DEPRECATE (future)** | Should compute from task_work_sessions. Keep as cache. |

### `project_statuses` table

| Column | Verdict | Reason |
|--------|---------|--------|
| `category` | **NEW** | The universal language. backlog/todo/active/done/cancelled. |
| `is_default` | **KEEP** | Still useful for "which status do new tasks get?" |
| `is_completed` | **KEEP (derived)** | Legacy compat. Should always match `category IN ('done','cancelled')`. |
| All others | **KEEP** | name, color, position are all needed. |

### Tables

| Table | Verdict | Reason |
|-------|---------|--------|
| `task_sessions` | **REMOVE** | Duplicate of `task_work_sessions`. Data migrated. |
| `task_work_sessions` | **KEEP** | Canonical timer/work session table. |
| `status_transitions` | **NEW** | Analytics, cycle time, SLA, automations. |

---

## Future Roadmap

### Phase A: Automation Rules (next sprint)
```sql
CREATE TABLE automation_rules (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects(id),
  trigger_type text,       -- 'status_entered', 'status_exited', 'due_date_passed'
  trigger_status_id uuid,  -- which status triggers this
  trigger_category status_category,  -- or trigger on category
  action_type text,        -- 'assign_to', 'move_to_status', 'send_notification', 'webhook'
  action_config jsonb,     -- { "assign_to": "user_id", "webhook_url": "..." }
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
```

### Phase B: Workspace-Level Status Templates
Instead of each project defining statuses from scratch, define status sets at workspace level:
```sql
CREATE TABLE workspace_status_sets (
  id uuid PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id),
  name text,              -- "Software Development", "Marketing", "Simple"
  is_default boolean
);

CREATE TABLE workspace_status_set_items (
  id uuid PRIMARY KEY,
  set_id uuid REFERENCES workspace_status_sets(id),
  name text,
  color text,
  category status_category,
  position integer
);
```
When creating a project, pick a status set → copies items to `project_statuses`.

### Phase C: Multi-Project Task Status (Asana-style)
A task can belong to multiple projects with different statuses in each:
```sql
CREATE TABLE task_project_statuses (
  task_id uuid REFERENCES tasks(id),
  project_id uuid REFERENCES projects(id),
  status_id uuid REFERENCES project_statuses(id),
  PRIMARY KEY (task_id, project_id)
);
```

### Phase D: SLA Rules
```sql
CREATE TABLE sla_rules (
  id uuid PRIMARY KEY,
  project_id uuid,
  from_category status_category,  -- 'todo'
  to_category status_category,    -- 'done'
  max_hours integer,              -- 48 hours
  breach_action text              -- 'notify_manager', 'escalate'
);
```

---

## App-Side Rules (for all developers)

### Rule 1: Only write `custom_status_id`
```typescript
// ✅ CORRECT: Only set custom_status_id, trigger handles the rest
await supabase.from('tasks').update({
  custom_status_id: newStatusId
}).eq('id', taskId);

// ❌ WRONG: Don't manually set status, completed_at, first_started_at
await supabase.from('tasks').update({
  status: 'done',
  completed_at: new Date().toISOString(),
  custom_status_id: completedStatusId
}).eq('id', taskId);
```

### Rule 2: Read status from `project_statuses` join
```typescript
// ✅ CORRECT: Join to get real status
const { data } = await supabase
  .from('tasks')
  .select('*, project_statuses!custom_status_id(name, color, category)')
  .eq('project_id', projectId);

// ❌ WRONG: Don't read tasks.status for display
const isActive = task.status === 'in_progress'; // STALE
```

### Rule 3: Use `category` for cross-project queries
```typescript
// ✅ CORRECT: Filter by category
const completedStatusIds = allStatuses
  .filter(s => s.category === 'done' || s.category === 'cancelled')
  .map(s => s.id);

// ❌ WRONG: Don't check is_completed boolean
const completedStatusIds = allStatuses.filter(s => s.is_completed).map(s => s.id);
// (is_completed will eventually be removed)
```
