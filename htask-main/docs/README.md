# Hamro Task — Documentation

Welcome to the official documentation for **Hamro Task**, a PWA-first team project management and collaboration platform.

## Table of Contents

| Document | Description |
|----------|-------------|
| [Overview](./01-overview.md) | Platform overview, tech stack, and architecture |
| [Workspaces](./02-workspaces.md) | Workspace creation, switching, and settings |
| [Authentication & Roles](./03-auth-and-roles.md) | Auth flow, RBAC, and member management |
| [Projects](./04-projects.md) | Project CRUD, templates, custom statuses & fields |
| [Tasks](./05-tasks.md) | Task management, views, time tracking, and collaboration |
| [Chat & Communication](./06-chat.md) | Channels, DMs, typing indicators, and unread tracking |
| [Notifications](./07-notifications.md) | In-app and push notification system |
| [Dashboard & Analytics](./08-dashboard.md) | Role-based dashboard, stats, and charts |
| [Subscription & Billing](./09-subscription.md) | Plans, payments, and feature gating |
| [Admin Panel](./10-admin.md) | Super admin CMS, workspace management, and feature flags |
| [Database Schema](./11-database-schema.md) | Full entity-relationship reference |
| [PWA & Performance](./12-pwa.md) | Service worker, offline support, and install prompts |

---

## Quick Start (For Project Managers)

1. **Sign up** → Auto-creates "My Workspace"
2. **Create a Project** → Choose from 8 industry templates or start blank
3. **Add Tasks** → Use Kanban, List, or Calendar view
4. **Invite Team** → Assign roles (Owner, Admin, Member, Viewer)
5. **Collaborate** → Chat, comment on tasks, attach files
6. **Track Progress** → Dashboard analytics, time tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| UI Library | shadcn/ui + Radix primitives |
| State | React Query (TanStack), React Context |
| Animation | Framer Motion |
| Backend | Supabase (Auth, PostgreSQL, Storage, Edge Functions) |
| Realtime | Supabase Realtime (channels, presence) |
| PWA | vite-plugin-pwa, custom service worker |
| Charts | Recharts |
| DnD | @hello-pangea/dnd |
