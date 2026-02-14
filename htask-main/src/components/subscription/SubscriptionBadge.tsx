import { Crown, Zap, Star, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';

interface SubscriptionBadgeProps {
  showUpgrade?: boolean;
  onUpgradeClick?: () => void;
  className?: string;
}

export function SubscriptionBadge({ showUpgrade = true, onUpgradeClick, className }: SubscriptionBadgeProps) {
  const { currentPlan, isLoading, daysUntilExpiry, isExpired } = useSubscription();

  if (isLoading) return null;

  const getPlanIcon = () => {
    if (!currentPlan) return null;
    switch (currentPlan.position) {
      case 0: return null; // Free
      case 1: return <Zap className="h-3 w-3" />;
      case 2: return <Star className="h-3 w-3" />;
      case 3: return <Crown className="h-3 w-3" />;
      default: return <Sparkles className="h-3 w-3" />;
    }
  };

  const getPlanColor = () => {
    if (!currentPlan) return 'bg-muted text-muted-foreground';
    if (isExpired) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    switch (currentPlan.position) {
      case 0: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 1: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 2: return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 3: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-primary/10 text-primary';
    }
  };

  if (!currentPlan) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge className={cn('gap-1', getPlanColor())}>
        {getPlanIcon()}
        {currentPlan.name}
        {isExpired && ' (Expired)'}
      </Badge>
      
      {daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0 && (
        <Badge variant="outline" className="text-yellow-600 border-yellow-500/50">
          {daysUntilExpiry}d left
        </Badge>
      )}

      {showUpgrade && currentPlan.position < 3 && !isExpired && onUpgradeClick && (
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={onUpgradeClick}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Upgrade
        </Badge>
      )}
    </div>
  );
}
