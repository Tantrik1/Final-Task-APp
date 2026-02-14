# 06 — Chat & Communication

## Overview

Hamro Task includes a built-in real-time chat system with **Channels** (group conversations) and **Direct Messages** (1:1 private conversations), eliminating the need for external tools like Slack.

## Channels

### Features

- **Public channels** within a workspace (all members can see and join)
- **Channel membership** with roles: Admin (creator) and Member
- **Channel settings**: Name, description, member management
- **Any workspace member can create channels**

### Channel Operations

| Action | Who | UI |
|--------|-----|----|
| Create channel | Any member | `CreateChannelDialog` |
| Edit channel | Channel admin | `ChannelSettingsDialog` |
| Add members | Channel admin | `AddMemberDialog` |
| View members | Any member | Channel settings |
| Leave channel | Any member | Channel settings |

### Data Model

```sql
channels (
  id UUID PK,
  workspace_id UUID → workspaces,
  name TEXT,
  description TEXT,
  type TEXT DEFAULT 'public',
  created_by UUID → profiles,
  created_at
)

channel_members (
  id UUID PK,
  channel_id UUID → channels,
  user_id UUID → profiles,
  role ENUM('admin','member'),
  added_by UUID → profiles,
  joined_at
)
```

## Direct Messages (DMs)

### Features

- **1:1 private conversations** between workspace members
- **Start DM** from the DM list via `StartDMDialog`
- Conversations are workspace-scoped (same two people can have different DM threads in different workspaces)

### Data Model

```sql
dm_conversations (
  id UUID PK,
  workspace_id UUID → workspaces,
  participant_1 UUID → profiles,
  participant_2 UUID → profiles,
  created_at, updated_at
)

dm_messages (
  id UUID PK,
  conversation_id UUID → dm_conversations,
  sender_id UUID → profiles,
  content TEXT,
  is_edited BOOLEAN,
  edited_at TIMESTAMPTZ,
  created_at
)
```

## Messaging Features

### Message Bubbles (`MessageBubble.tsx`)

- Chat-style bubbles (own messages right-aligned, others left-aligned)
- Shows sender avatar, name, timestamp
- Edit indicator for modified messages
- Reply threading support (via `reply_to_id` on channel messages)

### Typing Indicators (`TypingIndicator.tsx`)

- Real-time "X is typing..." display
- Uses Supabase Realtime presence
- Auto-clears after inactivity timeout

### Unread Tracking

| Table | Purpose |
|-------|---------|
| `channel_read_status` | Tracks last read timestamp per user per channel |
| `dm_read_status` | Tracks last read timestamp per user per DM conversation |

- Unread count badges appear on:
  - Bottom navigation Chat icon
  - Individual channel/DM list items
  - Channel sidebar

### Message Input (`ChatInput.tsx`)

- Auto-expanding textarea
- Send on Enter (Shift+Enter for new line)
- Mobile keyboard-aware layout (uses `visualViewport` listeners to adjust padding)

## UI Layout

### Desktop
- Left panel: Channel list + DM list (collapsible sidebar sections)
- Right panel: Active conversation messages + input

### Mobile
- `MobileChannelSheet` — Swipeable sheet to browse channels/DMs
- Compact header (`ChatHeader.tsx`) optimized for small screens
- Full-screen message view when a conversation is selected

## Real-Time Architecture

```
Browser A                    Supabase Realtime                    Browser B
   │                              │                                  │
   │── INSERT message ──────────► │                                  │
   │                              │ ──── Broadcast to channel ──────►│
   │                              │                                  │
   │── Typing event ────────────► │                                  │
   │                              │ ──── Presence update ───────────►│
```

- Messages use Supabase Realtime subscriptions on the `messages` and `dm_messages` tables
- Typing indicators use Supabase Realtime Presence channels
- Unread counts update in real-time

## Hooks

| Hook | Purpose |
|------|---------|
| `useChat` | Channel CRUD, channel list, unread counts |
| `useChatMessages` | Channel message fetching, sending, realtime subscription |
| `useDirectMessages` | DM conversation list, creation |
| `useDMMessages` | DM message fetching, sending, realtime subscription |
| `useChannelMembers` | Channel member management |
| `useTypingIndicator` | Typing state broadcast and display |
| `useOnlinePresence` | User online/offline status tracking |

## For Project Managers

- **Channels** replace the need for separate Slack/Teams — keep all project communication in one place
- **DMs** for private 1:1 conversations (e.g., performance discussions, sensitive topics)
- **Unread badges** ensure nothing gets missed — visible on mobile bottom nav
- **No external tool switching** — team stays in the same app they manage tasks in
- **Typing indicators** create a sense of real-time presence and responsiveness
