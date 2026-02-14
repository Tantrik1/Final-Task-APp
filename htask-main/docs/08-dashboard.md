# 08 — Dashboard & Analytics

## Overview

The workspace dashboard (`/workspace/:id`) provides role-based entry behavior with analytics for leaders and a focused task view for contributors.

## Role-Based Routing

| Role | Default View |
|------|-------------|
| Owner, Admin | Analytics dashboard |
| Member, Viewer | "My Tasks" view |

## Analytics Components

### 1. Stats Grid (`DashboardStatsGrid.tsx`)

Top-level KPI cards showing:
- Total tasks in workspace
- Tasks completed this week/month
- Overdue tasks count
- Active team members

### 2. Task Completion Chart (`TaskCompletionChart.tsx`)

- **Recharts** area/line chart
- Shows task completion velocity over time
- Customizable time range (7d, 30d, 90d)
- Skeleton loader during data fetch

### 3. Project Progress (`ProjectProgress.tsx`)

- List of active projects with progress bars
- Completion percentage = completed tasks / total tasks
- Color-coded by project color
- Links to project detail page
- Shows up to 6 most recent projects

### 4. Team Activity Feed (`TeamActivityFeed.tsx`)

- Chronological feed of recent workspace activities
- Shows: who did what, when
- Activity types: task created, completed, commented, status changed
- Links to relevant entities

### 5. Top Performers (`TopPerformers.tsx`)

- Leaderboard of most productive team members
- Ranked by tasks completed in the current period
- Shows avatar, name, task count

## Data Fetching

- All analytics data is fetched directly from Supabase via SQL queries
- No separate analytics backend — uses aggregate queries on existing tables
- Skeleton loaders shown during loading states
- Data refreshes on page mount (not polling)

## For Project Managers

- **At-a-glance health check** — see if the team is on track without opening individual projects
- **Activity feed** — spot blockers or stalled tasks early
- **Top performers** — recognize productive team members
- **Project progress** — quickly identify which projects need attention
