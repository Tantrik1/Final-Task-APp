import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSubscriptionOptional } from '@/hooks/useSubscription';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Button } from '@/components/ui/button';
import { UpgradeDialog } from './UpgradeDialog';
import { 
  AlertTriangle, 
  Clock, 
  CreditCard, 
  X,
  Sparkles 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function SubscriptionBanner() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentRole } = useWorkspace();
  const subscriptionData = useSubscriptionOptional();
  
  const [dismissed, setDismissed] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Early return if no subscription context available
  if (!subscriptionData) return null;
  
  const {
    subscription,
    daysUntilExpiry,
    isExpired,
    isTrialing,
    loading,
  } = subscriptionData;

  // Only show to owners and admins
  const canSeeBilling = currentRole === 'owner' || currentRole === 'admin';

  // Don't show if loading, dismissed, or not relevant
  if (loading || dismissed || !canSeeBilling) return null;

  // Determine banner type
  const showExpiredBanner = isExpired;
  const showTrialBanner = isTrialing && daysUntilExpiry !== null && daysUntilExpiry <= 7;
  const showExpiryWarning = !isExpired && !isTrialing && daysUntilExpiry !== null && daysUntilExpiry <= 7;
  const showPaymentPending = subscription?.status === 'grace_period';

  // No banner needed
  if (!showExpiredBanner && !showTrialBanner && !showExpiryWarning && !showPaymentPending) {
    return null;
  }

  const getBannerConfig = () => {
    if (showExpiredBanner) {
      return {
        variant: 'destructive' as const,
        icon: AlertTriangle,
        title: 'Subscription Expired',
        message: 'Your subscription has expired. Renew now to continue using all features.',
        action: 'Renew Now',
        className: 'bg-destructive/10 border-destructive/30 text-destructive',
      };
    }
    if (showTrialBanner) {
      return {
        variant: 'warning' as const,
        icon: Clock,
        title: `Trial ends in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
        message: 'Upgrade now to keep access to all features.',
        action: 'Upgrade',
        className: 'bg-warning/10 border-warning/30 text-warning-foreground',
      };
    }
    if (showExpiryWarning) {
      return {
        variant: 'warning' as const,
        icon: Clock,
        title: `Subscription expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
        message: 'Renew now to avoid service interruption.',
        action: 'Renew',
        className: 'bg-warning/10 border-warning/30 text-warning-foreground',
      };
    }
    if (showPaymentPending) {
      return {
        variant: 'info' as const,
        icon: CreditCard,
        title: 'Payment Pending Verification',
        message: 'Your payment is being reviewed. This usually takes 1-2 hours.',
        action: 'View Status',
        className: 'bg-info/10 border-info/30 text-info-foreground',
      };
    }
    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <>
      <div className={cn(
        'relative px-4 py-3 border-b flex items-center justify-between gap-4',
        config.className
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="h-5 w-5 flex-shrink-0" />
          <div className="min-w-0">
            <span className="font-medium">{config.title}</span>
            <span className="hidden sm:inline text-sm ml-2 opacity-80">
              — {config.message}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {config.variant !== 'info' ? (
            <Button 
              size="sm" 
              onClick={() => setUpgradeOpen(true)}
              className="gap-1"
            >
              <Sparkles className="h-3 w-3" />
              {config.action}
            </Button>
          ) : (
            <Link to={`/workspace/${workspaceId}/billing`}>
              <Button size="sm" variant="outline">
                {config.action}
              </Button>
            </Link>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-full hover:bg-background/50"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
