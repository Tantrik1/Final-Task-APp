import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingShowcase } from '@/components/landing/LandingShowcase';
import { LandingStats } from '@/components/landing/LandingStats';
import { LandingTestimonials } from '@/components/landing/LandingTestimonials';
import { LandingPricing } from '@/components/landing/LandingPricing';
import { LandingCTA } from '@/components/landing/LandingCTA';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingNav } from '@/components/landing/LandingNav';

export default function Landing() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Smart redirect for authenticated users
    const handleAuthenticatedRedirect = async () => {
      if (!user) return;

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

        // Priority 1: Super Admin → /admin
        if (superAdminResult.data) {
          navigate('/admin', { replace: true });
          return;
        }

        // Priority 2: Has Workspace → /workspace/:id
        if (workspaceResult.data && workspaceResult.data.length > 0) {
          navigate(`/workspace/${workspaceResult.data[0].workspace_id}`, { replace: true });
          return;
        }

        // Priority 3: No Workspace → /onboarding
        navigate('/onboarding', { replace: true });
      } catch (error) {
        console.error('Error during redirect:', error);
        // Fallback to dashboard which will handle routing
        navigate('/dashboard', { replace: true });
      }
    };

    if (!isLoading && user) {
      handleAuthenticatedRedirect();
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <LandingShowcase />
        <LandingPricing />
        <LandingTestimonials />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
