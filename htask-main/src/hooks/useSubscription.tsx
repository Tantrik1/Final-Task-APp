import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

interface Plan {
  id: string;
  name: string;
  price_npr: number;
  max_members: number | null;
  max_projects: number | null;
  features: Record<string, boolean>;
  position: number;
  badge_text?: string | null;
  description?: string | null;
}

interface Subscription {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'cancelled' | 'trial' | 'grace_period';
  starts_at: string;
  expires_at: string | null;
  trial_ends_at: string | null;
  member_count: number;
}

interface SubscriptionContextValue {
  plan: Plan | null;
  currentPlan: Plan | null; // Alias for plan
  subscription: Subscription | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading
  hasFeature: (featureKey: string) => boolean;
  canAddMember: boolean;
  canCreateProject: boolean;
  memberCount: number;
  memberLimit: number | null;
  projectCount: number;
  projectLimit: number | null;
  daysUntilExpiry: number | null;
  isExpired: boolean;
  isTrialing: boolean;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { currentWorkspace } = useWorkspace();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectCount, setProjectCount] = useState(0);
  const [actualMemberCount, setActualMemberCount] = useState(0);

  const fetchSubscription = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setPlan(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch subscription with plan
      const { data: subData, error: subError } = await supabase
        .from('workspace_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
      } else if (subData) {
        setSubscription({
          id: subData.id,
          workspace_id: subData.workspace_id,
          plan_id: subData.plan_id,
          status: subData.status as Subscription['status'],
          starts_at: subData.starts_at,
          expires_at: subData.expires_at,
          trial_ends_at: subData.trial_ends_at,
          member_count: subData.member_count,
        });
        
        if (subData.plan) {
          const planData = subData.plan as unknown as Plan;
          setPlan(planData);
        }
      }

      // Fetch project count
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_archived', false);

      setProjectCount(count ?? 0);

      // Fetch actual member count from workspace_members as fallback
      const { count: actualMemberCount } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);

      setActualMemberCount(actualMemberCount ?? 0);
    } catch (err) {
      console.error('Error in subscription fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const channel = supabase
      .channel(`subscription:${currentWorkspace.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_subscriptions',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace?.id, fetchSubscription]);

  const hasFeature = useCallback((featureKey: string): boolean => {
    if (!plan) return false;
    return plan.features[featureKey] === true;
  }, [plan]);

  const memberLimit = plan?.max_members ?? null;
  const projectLimit = plan?.max_projects ?? null;
  const memberCount = actualMemberCount || subscription?.member_count || 0;

  const canAddMember = memberLimit === null || memberCount < memberLimit;
  const canCreateProject = projectLimit === null || projectCount < projectLimit;

  const daysUntilExpiry = subscription?.expires_at
    ? Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpired = subscription?.status === 'expired' || (daysUntilExpiry !== null && daysUntilExpiry < 0);
  const isTrialing = subscription?.status === 'trial';

  const value: SubscriptionContextValue = {
    plan,
    currentPlan: plan, // Alias
    subscription,
    loading,
    isLoading: loading, // Alias
    hasFeature,
    canAddMember,
    canCreateProject,
    memberCount,
    memberLimit,
    projectCount,
    projectLimit,
    daysUntilExpiry,
    isExpired,
    isTrialing,
    refetch: fetchSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// Optional version that returns null instead of throwing
export function useSubscriptionOptional(): SubscriptionContextValue | null {
  const context = useContext(SubscriptionContext);
  return context ?? null;
}
