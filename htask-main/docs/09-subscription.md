# 09 — Subscription & Billing

## Overview

Hamro Task uses a **manual payment verification** model (suited for NPR/local currency markets) with plan-based feature gating.

## Subscription Plans

Plans are managed by Super Admins via the admin panel and stored in `subscription_plans`:

| Field | Description |
|-------|-------------|
| `name` | Plan name (e.g., Free, Starter, Pro, Enterprise) |
| `price_npr` | Monthly price in NPR |
| `max_members` | Member limit (null = unlimited) |
| `max_projects` | Project limit (null = unlimited) |
| `features` | JSONB array of feature descriptions |
| `badge_text` | Display badge (e.g., "Popular", "Best Value") |
| `position` | Display order |

## Payment Flow

```
User selects plan → Submits payment screenshot
    │
    ▼
payment_submissions (status: 'pending')
    │
    ▼
Super Admin reviews in Admin Panel
    │
    ├── Approve → Creates payment_history + activates subscription
    │
    └── Reject → Sends rejection notice with admin notes
```

### Payment Methods

Configured by Super Admin (e.g., bank transfer, eSewa, Khalti):
- Name, instructions, QR code image
- Active/inactive toggle
- Position ordering

## Workspace Subscription State

```sql
workspace_subscriptions (
  id UUID PK,
  workspace_id UUID → workspaces,
  plan_id UUID → subscription_plans,
  status ENUM('active','inactive','trial','expired','cancelled'),
  starts_at, expires_at, trial_ends_at,
  member_count INTEGER,
  created_at, updated_at
)
```

## Feature Gating

### Feature Flags (`feature_flags` table)

- `key`: Unique feature identifier
- `min_plan_position`: Minimum plan tier required
- `is_enabled`: Global toggle

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `SubscriptionBadge` | Shows current plan name/badge |
| `SubscriptionBanner` | Upgrade prompt banner |
| `SubscriptionCard` | Plan comparison card |
| `UpgradeDialog` | Payment submission dialog |
| `LimitWarning` | Warning when approaching member/project limits |

### Hook: `useSubscription`

- Returns: current plan, limits, usage counts, `canAddMember()`, `canAddProject()`
- Drives all frontend limit checks

## For Project Managers

- Check your plan's limits before inviting new members
- Upgrade via the Billing page with screenshot-based payment
- Plan features are enforced at both UI and database level
