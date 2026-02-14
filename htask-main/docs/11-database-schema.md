# 11 — Database Schema Reference

## Entity Relationship Overview

```
workspaces
  ├── workspace_members (user_id → profiles)
  ├── workspace_invitations
  ├── workspace_subscriptions (plan_id → subscription_plans)
  ├── projects
  │     ├── project_statuses
  │     ├── project_views
  │     ├── custom_field_definitions
  │     └── tasks
  │           ├── task_comments
  │           ├── task_attachments
  │           ├── task_links
  │           ├── task_sessions
  │           └── task_custom_field_values (field_id → custom_field_definitions)
  ├── channels
  │     ├── channel_members
  │     ├── channel_read_status
  │     └── messages
  ├── dm_conversations
  │     ├── dm_messages
  │     └── dm_read_status
  ├── notifications
  │     └── notification_logs
  └── notification_preferences

profiles (id → auth.users)
  └── push_subscriptions

super_admins (user_id → profiles)
subscription_plans
payment_methods
payment_submissions (plan_id, workspace_id, payment_method_id)
payment_history (workspace_id, payment_submission_id)
feature_flags
site_pages

project_templates (workspace_id)
  ├── template_statuses
  ├── template_tasks
  ├── template_views
  └── template_custom_fields
```

## Enums

| Enum | Values |
|------|--------|
| `workspace_role` | owner, admin, member, viewer |
| `task_status` | todo, in_progress, review, done |
| `task_priority` | low, medium, high, urgent |
| `notification_type` | task_assigned, task_completed, task_status_changed, comment_added, comment_reply, chat_mention, member_updates, project_updates, due_date_reminder |
| `entity_type` | task, project, comment, channel, dm |
| `channel_member_role` | admin, member |
| `custom_field_type` | text, number, date, select, checkbox, url, currency, user, multiselect, file |
| `payment_status` | pending, approved, rejected |
| `subscription_status` | active, inactive, trial, expired, cancelled |

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:

- **Workspace data**: Only accessible by workspace members
- **Tasks**: Accessible by members of the task's project's workspace
- **Channels/Messages**: Accessible by channel members
- **DMs**: Only accessible by the two participants
- **Notifications**: Only accessible by the recipient
- **Profiles**: Publicly readable (name, avatar), self-editable
- **Admin tables**: Only accessible by super admins

## Edge Functions

| Function | Purpose |
|----------|---------|
| `create-workspace` | Creates workspace + adds creator as owner |
| `send-invitation` | Sends email invitation with token |
| `get-invitation` | Validates invitation token |
| `remove-member` | Removes member and cleans up references |
| `reset-member-password` | Admin-triggered password reset |
| `send-push-notification` | Delivers Web Push notification |
| `get-vapid-public-key` | Returns VAPID public key for push subscription |
| `send-due-date-reminders` | Scheduled: sends reminders for upcoming due dates |
| `send-payment-notification` | Notifies admin of payment submissions |
