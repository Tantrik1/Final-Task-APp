
# Fix Push Notifications and Notification Preferences Access

## Problems Found

1. **Notification preferences are locked behind Settings (admin/owner only)** -- Regular members and viewers see "Access Denied" and can never configure their notification preferences or enable push notifications.

2. **Service Worker re-subscription broken** -- When push tokens rotate (common on iOS), the `pushsubscriptionchange` handler lacks the VAPID `applicationServerKey`, causing silent re-subscription failure and lost push delivery.

3. **Test push sends `null` notification ID** -- The edge function wastes cycles trying to log events and mark a non-existent notification as pushed.

4. **No auto-creation of preferences row** -- New users who never visited settings have no `notification_preferences` row, so `updatePreferences` tries to insert without knowing the workspace_id context properly.

5. **Stale push subscriptions accumulate** -- When iOS rotates endpoints, old entries remain `is_active = true` until they fail 3 times. No cleanup mechanism exists.

---

## Plan

### 1. Move Notification Preferences to be accessible by ALL users

- Extract `NotificationPreferences` out of the admin-only Settings page
- Add a dedicated route `/workspace/:workspaceId/notification-settings` accessible to all roles
- OR: Move notification preferences into the Profile page (accessible to everyone)
- Keep it in Settings too for admins, but ensure non-admins can access it from Profile or a dedicated page

**Recommended approach**: Add notification preferences to the **Profile page** since every user can access it. This avoids creating a new route.

### 2. Fix Service Worker `pushsubscriptionchange` handler

Update `public/custom-sw.js` to:
- Fetch the VAPID public key from the edge function
- Include `applicationServerKey` when re-subscribing
- POST the new subscription details to Supabase to update the database

### 3. Fix Test Push in NotificationPreferences

Update `handleSendTestPush` to not pass `id: null`. Instead pass a generated UUID or omit the `id` field entirely. Update the edge function to handle missing notification ID gracefully (skip logging and marking as pushed).

### 4. Auto-create notification preferences on first access

In `useNotifications` hook's `fetchPreferences`:
- If no preferences row exists, auto-create one with defaults using `workspace_id` from `currentWorkspace`
- This ensures `updatePreferences` always has an existing row to update

### 5. Clean up stale push subscriptions

Add a cleanup step in `usePushNotifications.subscribe()`:
- Before registering a new subscription, deactivate any existing subscriptions for the same user on the same platform that have different endpoints
- This prevents endpoint rotation from leaving orphaned active entries

---

## Technical Details

### Files to modify:

| File | Change |
|------|--------|
| `src/pages/workspace/WorkspaceProfile.tsx` | Add `NotificationPreferences` component |
| `public/custom-sw.js` | Fix `pushsubscriptionchange` with VAPID key fetch and DB sync |
| `src/components/notifications/NotificationPreferences.tsx` | Fix test push (remove `id: null`), add auto-create logic |
| `src/hooks/useNotifications.tsx` | Auto-create preferences row if missing |
| `src/hooks/usePushNotifications.tsx` | Deactivate stale same-platform subscriptions on subscribe |
| `supabase/functions/send-push-notification/index.ts` | Guard against null notification ID in logging/marking |

### No database changes needed -- all fixes are frontend and edge function level.
