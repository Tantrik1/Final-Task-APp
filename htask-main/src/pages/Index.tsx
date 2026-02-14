import { AuthenticatedRouter } from '@/components/auth/AuthenticatedRouter';

/**
 * Index page - Acts as the central routing hub for authenticated users.
 * Uses AuthenticatedRouter to determine the correct destination based on:
 * 1. Super Admin status → /admin
 * 2. Workspace membership → /workspace/:id
 * 3. No workspace → /onboarding
 * 
 * Unauthenticated users are redirected to /auth
 */
export default function Index() {
  return <AuthenticatedRouter fallbackPath="/auth" />;
}
