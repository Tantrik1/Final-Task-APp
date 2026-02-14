import { Outlet, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { SubscriptionBanner } from '@/components/subscription/SubscriptionBanner';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import WorkspaceLayout from './WorkspaceLayout';

export function ResponsiveWorkspaceLayout() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const location = useLocation();

  // Chat page manages its own scroll — skip pull-to-refresh there
  const isChatPage = location.pathname.includes('/chat');

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  // On mobile, use the mobile-optimized layout with fixed header/footer
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        {/* Fixed Header */}
        <MobileHeader />
        
        {/* Subscription Banner - shrinks when not needed */}
        <SubscriptionBanner />
        
        {/* Scrollable Content Area with proper padding for fixed elements */}
        {isChatPage ? (
          <main 
            className="flex-1 overflow-hidden"
            style={{ 
              paddingTop: 'var(--mobile-content-top)',
              paddingBottom: 'var(--mobile-content-bottom)'
            }}
          >
            <div className="h-full overflow-hidden">
              <Outlet />
            </div>
          </main>
        ) : (
          <main 
            className="flex-1 overflow-hidden"
            style={{ 
              paddingTop: 'var(--mobile-content-top)',
              paddingBottom: 'var(--mobile-content-bottom)'
            }}
          >
            <PullToRefresh onRefresh={handleRefresh} className="h-full">
              <Outlet />
            </PullToRefresh>
          </main>
        )}
        
        {/* Fixed Bottom Nav */}
        <BottomNav />
      </div>
    );
  }

  // On desktop, use the standard workspace layout
  return <WorkspaceLayout />;
}
