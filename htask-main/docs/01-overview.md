# 01 — Platform Overview

## What is Hamro Task?

Hamro Task is a **mobile-first, PWA-optimized** team project management platform designed for startups, agencies, and small teams. It provides workspace-driven task management, real-time chat, time tracking, and role-based collaboration — all in a Gen-Z-friendly, colorful UI.

## Architecture

```
┌─────────────────────────────────────────────┐
│                 Frontend (React SPA)        │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │  Pages   │ │Components│ │   Hooks      │ │
│  │ (Routes) │ │ (shadcn) │ │ (Data Layer) │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
└────────────────────┬────────────────────────┘
                     │ Supabase JS Client
┌────────────────────▼────────────────────────┐
│              Supabase Backend               │
│  ┌──────┐ ┌────────┐ ┌───────┐ ┌────────┐  │
│  │ Auth │ │ Postgres│ │Storage│ │Edge Fns│  │
│  └──────┘ └────────┘ └───────┘ └────────┘  │
│  ┌──────────┐ ┌──────────────────────────┐  │
│  │ Realtime │ │  Row Level Security (RLS)│  │
│  └──────────┘ └──────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Key Design Principles

1. **Mobile-first** — Every screen designed at 375px first, desktop is the enhancement
2. **Workspace-driven** — Every entity belongs to a workspace; queries always filter by `workspace_id`
3. **Role-based UI** — Components render differently based on user role (Owner/Admin/Member/Viewer)
4. **Simple state** — Minimal global state; data fetched per-page via hooks
5. **PWA performance** — Lazy-loaded routes, skeleton loaders, offline task viewing

## Routing Structure

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/auth` | Public | Login/Register (PWA start URL) |
| `/onboarding` | Authenticated | First-time workspace setup wizard |
| `/workspace/:id` | Authenticated | Dashboard (role-based) |
| `/workspace/:id/projects` | Authenticated | Projects list |
| `/workspace/:id/projects/:pid` | Authenticated | Project detail (Kanban/List/Calendar) |
| `/workspace/:id/my-tasks` | Authenticated | Personal task view |
| `/workspace/:id/chat` | Authenticated | Channels & DMs |
| `/workspace/:id/members` | Authenticated | Team management |
| `/workspace/:id/settings` | Owner/Admin | Workspace settings |
| `/workspace/:id/profile` | Authenticated | User profile & notification prefs |
| `/workspace/:id/notifications` | Authenticated | Notification center |
| `/workspace/:id/billing` | Owner/Admin | Subscription & payments |
| `/workspace/:id/menu` | Authenticated | Mobile menu hub |
| `/admin/*` | Super Admin | Admin panel |

## Navigation

- **Desktop**: Collapsible sidebar (persistent state via localStorage)
- **Mobile**: Bottom navigation bar (5 items: Menu, Home, Tasks, Projects, Chat) with floating pill design and unread badges
