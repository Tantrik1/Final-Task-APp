# 10 — Admin Panel (Super Admin)

## Access

Only users in the `super_admins` table can access `/admin/*` routes. The `AuthenticatedRouter` checks Super Admin status and redirects accordingly.

## Admin Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/admin` | Overview stats (workspaces, users, revenue) |
| Workspaces | `/admin/workspaces` | View/manage all workspaces, drill-in detail |
| Plans | `/admin/plans` | CRUD subscription plans |
| Payments | `/admin/payments` | Review/approve/reject payment submissions |
| Payment Methods | `/admin/payment-methods` | Configure payment channels (bank, eSewa, etc.) |
| Templates | `/admin/templates` | Manage system-wide project templates |
| Feature Flags | `/admin/feature-flags` | Toggle features and set plan requirements |
| Pages (CMS) | `/admin/pages` | Edit content for company/legal pages |
| Settings | `/admin/settings` | Global application settings |

## CMS System

### How It Works

- **Company & Legal pages** (About, Careers, Blog, Contact, Privacy, Terms, Cookies) are managed via the admin CMS
- Content stored as **structured JSONB blocks** in the `site_pages` table
- **Product & Resource pages** (Features, Pricing, Docs, etc.) are static React components for SEO and performance

### Site Pages Schema

```sql
site_pages (
  id UUID PK,
  slug TEXT UNIQUE,
  title TEXT,
  category TEXT,
  icon TEXT,
  content JSONB,
  meta_description TEXT,
  is_published BOOLEAN,
  position INTEGER,
  updated_by UUID → profiles,
  created_at, updated_at
)
```

## Workspace Detail Dialog

Admins can drill into any workspace to see:
- Workspace metadata (name, logo, created date)
- Member list with roles
- Subscription status
- Project count
- Recent activity

## For Project Managers

The admin panel is for **platform operators** (SaaS owners), not workspace-level project managers. If you're managing a team, use the workspace-level settings instead.
