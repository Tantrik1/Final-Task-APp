# 02 — Workspaces

## Concept

Everything in Hamro Task belongs to a **workspace**. A workspace is the top-level container for projects, tasks, members, channels, and billing. Users can belong to multiple workspaces.

## Workspace Creation

- **First-time users**: A default "My Workspace" is auto-created during onboarding via the `create-workspace` edge function
- **Invited users**: Bypass workspace creation; they join the inviter's workspace directly
- **Manual creation**: Users can create additional workspaces from the workspace switcher

## Workspace Switcher

- Available in the sidebar/menu
- Switching workspaces does **not** reload the app — it updates context
- All data queries re-fetch with the new `workspace_id`

## Workspace Settings (Owner/Admin only)

| Setting | Description |
|---------|-------------|
| Name & Logo | Workspace branding with custom logo upload |
| General | Basic workspace configuration |
| Members | Invite, manage roles, remove members |
| Billing | Subscription plan, payment history |

## Database Table

```sql
workspaces (
  id UUID PK,
  name TEXT,
  logo_url TEXT,
  created_by UUID → auth.users,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

## Security

- All workspace data is protected by **Row Level Security (RLS)**
- Queries must include `workspace_id` filter
- Members can only access workspaces they belong to
- The `workspace_members` table governs access with roles

## For Project Managers

- Create separate workspaces for different clients or departments
- Each workspace has its own billing/subscription
- Workspace logo appears in the sidebar for brand identity
