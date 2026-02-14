import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import logoLight from '@/assets/logo-light.png';

interface AuthenticatedRouterProps {
  fallbackPath?: string;
  children?: React.ReactNode;
}

type RouteDestination = {
  path: string;
  status: string;
};

/**
 * Checks if the current URL contains a recovery/invitation token in the hash.
 * This is a backup detection for when the PASSWORD_RECOVERY event might be missed.
 */
const hasRecoveryTokenInUrl = (): boolean => {
  const hash = window.location.hash;
  if (!hash) return false;
  
  try {
    const hashParams = new URLSearchParams(hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    
    // Recovery tokens indicate the user clicked a password reset/setup link
    return type === 'recovery' && !!accessToken;
  } catch {
    return false;
  }
};

/**
 * Centralized authentication router that handles role-based routing.
 * Priority order: Recovery Mode > Super Admin > Workspace Member > Onboarding
 * 
 * This component queries the database to determine user roles
 * and redirects accordingly. All role checks are server-side
 * via RLS-protected queries.
 */
export function AuthenticatedRouter({ fallbackPath = '/auth', children }: AuthenticatedRouterProps) {
  const { user, isLoading: authLoading, isRecoveryMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Loading...');
  const [isResolving, setIsResolving] = useState(true);

  // Check for recovery token in URL as backup detection
  const hasUrlRecoveryToken = hasRecoveryTokenInUrl();

  useEffect(() => {
    let mounted = true;

    const resolveDestination = async (): Promise<RouteDestination | null> => {
      // Not authenticated - redirect to fallback
      if (!user) {
        return { path: fallbackPath, status: 'Redirecting to login...' };
      }

      // PRIORITY 1: Recovery mode detection (multiple sources)
      // Check both the auth context flag AND the URL hash as a backup
      // This ensures invited users always go to password setup
      if (isRecoveryMode || hasUrlRecoveryToken) {
        console.log('[AuthRouter] Recovery mode detected, redirecting to setup', { 
          isRecoveryMode, 
          hasUrlRecoveryToken 
        });
        return { path: '/auth/setup-account', status: 'Setting up your account...' };
      }

      try {
        // Parallel fetch: super admin status AND workspace membership
        const [superAdminResult, workspaceResult] = await Promise.all([
          supabase
            .from('super_admins')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .limit(1)
        ]);

        // Check for errors
        if (superAdminResult.error && superAdminResult.error.code !== 'PGRST116') {
          console.error('Super admin check error:', superAdminResult.error);
        }
        if (workspaceResult.error) {
          console.error('Workspace check error:', workspaceResult.error);
          throw workspaceResult.error;
        }

        // Priority 2: Super Admin → /admin
        if (superAdminResult.data) {
          return { path: '/admin', status: 'Welcome, Super Admin!' };
        }

        // Priority 3: Has Workspace → /workspace/:id
        if (workspaceResult.data && workspaceResult.data.length > 0) {
          const workspaceId = workspaceResult.data[0].workspace_id;
          return { path: `/workspace/${workspaceId}`, status: 'Opening your workspace...' };
        }

        // Priority 4: No Workspace → /onboarding
        return { path: '/onboarding', status: 'Setting up your workspace...' };
      } catch (error) {
        console.error('Error resolving destination:', error);
        // Fallback to onboarding on error
        return { path: '/onboarding', status: 'Setting up...' };
      }
    };

    const performRedirect = async () => {
      if (authLoading) return;

      const destination = await resolveDestination();
      
      if (!mounted) return;
      
      if (destination) {
        setStatus(destination.status);
        // Small delay for UX - shows the status message
        setTimeout(() => {
          if (mounted) {
            navigate(destination.path, { replace: true });
          }
        }, 300);
      } else {
        setIsResolving(false);
      }
    };

    performRedirect();

    return () => {
      mounted = false;
    };
  }, [user, authLoading, isRecoveryMode, hasUrlRecoveryToken, navigate, fallbackPath]);

  // Show loading screen while resolving
  if (authLoading || isResolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <motion.img 
            src={logoLight} 
            alt="Hamro Task" 
            className="h-16 w-auto"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">{status}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render children if provided (for cases where we want to show content)
  return children ? <>{children}</> : null;
}

export default AuthenticatedRouter;
