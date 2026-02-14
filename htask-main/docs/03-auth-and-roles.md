# 03 — Authentication & Roles

## Authentication Flow

Hamro Task uses **Supabase Auth** with email/password authentication.

### Flow

1. User visits `/auth` → Login or Register form
2. On registration → Profile auto-created via database trigger
3. `AuthenticatedRouter` checks:
   - Is Super Admin? → Redirect to `/admin`
   - Has workspace membership? → Redirect to `/workspace/:id`
   - No workspace? → Redirect to `/onboarding`
4. PWA start URL is `/auth` for seamless mobile re-authentication

### Password Reset

- Users can request a password reset from the login screen
- Reset link sent via email → `/auth/reset-confirm` page
- Admins can also perform **administrative password resets** for members they manage

### First Login Password Prompt

- Members added by invitation may have a temporary password
- `needs_password_reset` flag on the profile triggers a mandatory password change dialog

## Role-Based Access Control (RBAC)

### Workspace Roles

| Role | Permissions |
|------|------------|
| **Owner** | Full control: settings, billing, delete workspace, manage all members |
| **Admin** | Manage members, projects, settings (no billing/delete) |
| **Member** | Create/manage own tasks, comment, chat, view projects |
| **Viewer** | Read-only access to projects and tasks |

### Role Enforcement

- **Backend**: Supabase RLS policies enforce data access per role
- **Frontend**: `useWorkspace()` hook exposes `currentRole` for UI-level gating
- **Component-level**: `canManage` checks hide admin-only buttons (settings, delete, etc.)

### Role-Based Dashboard

- **Owner/Admin** → Analytics dashboard (task velocity, activity feed, project progress)
- **Member/Viewer** → "My Tasks" view as the default landing

## Member Management

### Features

- **Tabbed view**: All, Active, Awaiting Login, Inactive
- **Member detail sheet**: Shows workspace stats (tasks created, comments, messages) + activity timeline
- **Admin actions**: Edit name, change role, reset password, remove member

### Invitation System

1. Owner/Admin invites via email from Members page
2. `send-invitation` edge function sends email with token link
3. Invitee visits `/accept-invite?token=...`
4. If new user → account created with temporary password
5. If existing user → added to workspace directly
6. Invitation expires after set period

## Database Tables

```sql
profiles (
  id UUID PK → auth.users,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  needs_password_reset BOOLEAN,
  created_at, updated_at
)

workspace_members (
  id UUID PK,
  workspace_id UUID → workspaces,
  user_id UUID → profiles,
  role ENUM('owner','admin','member','viewer'),
  invited_by UUID → profiles,
  joined_at, last_active_at
)

workspace_invitations (
  id UUID PK,
  workspace_id UUID → workspaces,
  email TEXT,
  role ENUM,
  token TEXT UNIQUE,
  invited_by UUID → profiles,
  expires_at, created_at
)
```

## For Project Managers

- **Owners** handle billing and high-level workspace config
- **Admins** manage day-to-day team operations (adding/removing members, password resets)
- **Members** are your doers — they focus on tasks and collaboration
- **Viewers** are for stakeholders who need visibility without edit access
- Use the Members page to monitor team activity and identify inactive members
