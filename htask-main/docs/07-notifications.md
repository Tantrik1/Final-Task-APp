# 07 — Notifications

## Overview

Hamro Task has a dual-layer notification system: **in-app notifications** (stored in database) and **push notifications** (via Web Push API).

## In-App Notifications

### Notification Types

| Type | Trigger |
|------|---------|
| `task_assigned` | Task assigned to a user |
| `task_completed` | A task is marked complete |
| `task_status_changed` | Task status updated |
| `comment_added` | New comment on a task |
| `comment_reply` | Reply to user's comment |
| `chat_mention` | Mentioned in a chat message |
| `member_updates` | Member added/removed/role changed |
| `project_updates` | Project created/archived/settings changed |
| `due_date_reminder` | Task due date approaching |

### Notification Bell (`NotificationBell.tsx`)

- Badge count of unread notifications in the header
- Opens `NotificationSheet` — side panel with notification list

### Notification Items (`NotificationItem.tsx`)

- Shows: icon, title, body, timestamp, read/unread state
- Click → navigates to the relevant entity (task, project, chat)
- Mark as read on click

### Data Model

```sql
notifications (
  id UUID PK,
  workspace_id UUID → workspaces,
  user_id UUID → profiles (recipient),
  actor_id UUID → profiles (who triggered it),
  type ENUM (notification types above),
  entity_type ENUM('task','project','comment','channel','dm'),
  entity_id UUID,
  title TEXT,
  body TEXT,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  pushed BOOLEAN DEFAULT false,
  pushed_at TIMESTAMPTZ,
  created_at
)
```

## Push Notifications

### Architecture

```
DB Trigger (on INSERT to notifications)
    │
    ▼
trigger_push_notification() PL/pgSQL function
    │ Checks push_subscriptions table for active subscriptions
    │ Builds payload with deep-link URL
    ▼
pg_net.http_post() → send-push-notification Edge Function
    │
    ▼
Web Push API → Browser/PWA notification
    │
    ▼
User clicks → Opens app at deep-link URL
```

### Service Worker (`custom-sw.js`)

- Handles `push` events → Shows native notification
- Handles `notificationclick` → Opens deep-link URL
- Handles `pushsubscriptionchange` → Re-subscribes with VAPID key and syncs to DB

### Push Subscription Management

```sql
push_subscriptions (
  id UUID PK,
  user_id UUID → profiles,
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT,
  platform TEXT DEFAULT 'web',
  is_active BOOLEAN DEFAULT true,
  failed_count INTEGER DEFAULT 0,
  user_agent TEXT,
  last_used_at, created_at
)
```

### VAPID Key Management

- Public key served via `get-vapid-public-key` edge function
- Private key stored as edge function secret (`VAPID_PRIVATE_KEY`)
- Subject: `mailto:` contact email

## Notification Preferences

### Access

- **All users**: Via Profile page (`/workspace/:id/profile`)
- **Admins**: Also available in workspace Settings

### Granular Controls

| Category | Toggles |
|----------|---------|
| Tasks | Assigned, Completed, Status Changed |
| Social | Comments, Replies, Chat Mentions |
| Workspace | Member Updates, Project Updates, Due Date Reminders |
| Push | Enable/Disable push notifications, Test push |
| Quiet Hours | Enable, Start time, End time, Timezone |

### Auto-Provisioning

- When a user first accesses notifications, a default preferences row is auto-created
- This prevents errors from missing preference records

## Deep Linking

Push notification payloads include contextual URLs:

| Entity Type | URL Pattern |
|-------------|-------------|
| Task | `/workspace/:wid/task/:taskId` |
| Project | `/workspace/:wid/projects/:projectId` |
| Comment | `/workspace/:wid/task/:taskId` |
| Channel | `/workspace/:wid/chat` |
| DM | `/workspace/:wid/chat` |

## Hooks

| Hook | Purpose |
|------|---------|
| `useNotifications` | Fetch notifications, mark read, preferences CRUD |
| `usePushNotifications` | Subscribe/unsubscribe push, manage subscriptions |

## For Project Managers

- **Never miss task assignments** — push notifications reach you even when the app is closed
- **Quiet Hours** prevent after-work interruptions — set your team's notification-free window
- **Granular controls** let each team member decide what's important to them
- **Deep links** take you directly to the relevant task or conversation — no hunting
