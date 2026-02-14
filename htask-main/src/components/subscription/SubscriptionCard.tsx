import { useParams, useNavigate } from 'react-router-dom';
import { Crown, Sparkles, Users, FolderKanban, Clock, CreditCard, ChevronRight, AlertTriangle, Infinity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeDialog } from '@/components/subscription/UpgradeDialog';
import { useState } from 'react';

interface SubscriptionCardProps {
  variant?: 'compact' | 'expanded';
  onClose?: () => void;
}

export function SubscriptionCard({ variant = 'compact', onClose }: SubscriptionCardProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  
  const {
    plan,
    subscription,
    isLoading,
    memberCount,
    memberLimit,
    projectCount,
    projectLimit,
    daysUntilExpiry,
    isExpired,
    isTrialing,
  } = useSubscription();

  if (isLoading || !plan) {
    return (
      <Card className={cn(
        'bg-gradient-to-br from-muted/50 to-muted/30 border-border/50',
        variant === 'compact' ? 'mx-3' : ''
      )}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-2 bg-muted rounded w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Status color logic
  const getStatusColor = () => {
    if (isExpired) return 'destructive';
    if (isTrialing) return 'default';
    if (daysUntilExpiry !== null && daysUntilExpiry <= 7) return 'warning';
    return 'success';
  };

  const getStatusBadge = () => {
    if (isExpired) return { text: 'Expired', variant: 'destructive' as const };
    if (isTrialing) return { text: 'Trial', variant: 'secondary' as const };
    if (daysUntilExpiry !== null && daysUntilExpiry <= 7) return { text: `${daysUntilExpiry}d left`, variant: 'outline' as const };
    if (subscription?.status === 'grace_period') return { text: 'Grace Period', variant: 'outline' as const };
    return { text: 'Active', variant: 'default' as const };
  };

  const statusBadge = getStatusBadge();
  const statusColor = getStatusColor();

  // Usage percentages
  const memberUsage = memberLimit ? (memberCount / memberLimit) * 100 : 0;
  const projectUsage = projectLimit ? (projectCount / projectLimit) * 100 : 0;

  const handleNavigateBilling = () => {
    onClose?.();
    navigate(`/workspace/${workspaceId}/billing`);
  };

  const handleUpgradeClick = () => {
    setUpgradeOpen(true);
  };

  // Compact variant for desktop sidebar
  if (variant === 'compact') {
    return (
      <>
        <Card className={cn(
          'mx-3 overflow-hidden transition-all duration-300 hover:shadow-md',
          'bg-gradient-to-br from-primary/5 via-background to-accent/5',
          'border-border/50 hover:border-primary/20',
          statusColor === 'destructive' && 'border-destructive/30 bg-gradient-to-br from-destructive/5 via-background to-destructive/5',
          statusColor === 'warning' && 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-amber-500/5'
        )}>
          <CardContent className="p-3 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center',
                  'bg-gradient-to-br from-primary/20 to-primary/10'
                )}>
                  <Crown className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{plan.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    NPR {plan.price_npr}/member
                  </p>
                </div>
              </div>
              <Badge 
                variant={statusBadge.variant}
                className={cn(
                  'text-[10px] px-1.5 py-0',
                  statusColor === 'success' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                  statusColor === 'warning' && 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                )}
              >
                {statusBadge.text}
              </Badge>
            </div>

            {/* Usage bars */}
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Members
                  </span>
                  <span className="font-medium">
                    {memberCount}/{memberLimit ?? <Infinity className="h-3 w-3 inline" />}
                  </span>
                </div>
                <Progress 
                  value={memberLimit ? memberUsage : 0} 
                  className="h-1.5" 
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <FolderKanban className="h-3 w-3" /> Projects
                  </span>
                  <span className="font-medium">
                    {projectCount}/{projectLimit ?? <Infinity className="h-3 w-3 inline" />}
                  </span>
                </div>
                <Progress 
                  value={projectLimit ? projectUsage : 0} 
                  className="h-1.5" 
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="flex-1 h-8 text-xs rounded-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                onClick={handleUpgradeClick}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Upgrade
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 w-8 p-0 rounded-lg"
                onClick={handleNavigateBilling}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </>
    );
  }

  // Expanded variant for mobile menu
  return (
    <>
      <Card className={cn(
        'overflow-hidden transition-all duration-300',
        'bg-gradient-to-br from-primary/5 via-background to-accent/10',
        'border-border/50',
        statusColor === 'destructive' && 'border-destructive/30 bg-gradient-to-br from-destructive/5 via-background to-destructive/5',
        statusColor === 'warning' && 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-amber-500/5'
      )}>
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center',
                'bg-gradient-to-br from-primary/20 to-primary/10',
                'shadow-lg shadow-primary/10'
              )}>
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-lg">{plan.name}</p>
                  {plan.badge_text && (
                    <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      {plan.badge_text}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  NPR {plan.price_npr}/member/month
                </p>
              </div>
            </div>
            <Badge 
              variant={statusBadge.variant}
              className={cn(
                'text-xs',
                statusColor === 'success' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                statusColor === 'warning' && 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              )}
            >
              {statusBadge.text}
            </Badge>
          </div>

          {/* Expiry warning */}
          {(isExpired || (daysUntilExpiry !== null && daysUntilExpiry <= 7)) && (
            <div className={cn(
              'flex items-center gap-2 p-3 rounded-xl text-sm',
              isExpired 
                ? 'bg-destructive/10 text-destructive' 
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            )}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {isExpired 
                  ? 'Your subscription has expired. Upgrade to continue.' 
                  : `Your plan expires in ${daysUntilExpiry} days.`
                }
              </span>
            </div>
          )}

          {/* Usage stats */}
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Team Members
                </span>
                <span className="font-semibold">
                  {memberCount} / {memberLimit ?? '∞'}
                </span>
              </div>
              <Progress 
                value={memberLimit ? memberUsage : 0} 
                className={cn(
                  'h-2',
                  memberUsage >= 90 && '[&>div]:bg-amber-500',
                  memberUsage >= 100 && '[&>div]:bg-destructive'
                )}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" /> Projects
                </span>
                <span className="font-semibold">
                  {projectCount} / {projectLimit ?? '∞'}
                </span>
              </div>
              <Progress 
                value={projectLimit ? projectUsage : 0} 
                className={cn(
                  'h-2',
                  projectUsage >= 90 && '[&>div]:bg-amber-500',
                  projectUsage >= 100 && '[&>div]:bg-destructive'
                )}
              />
            </div>

            {daysUntilExpiry !== null && daysUntilExpiry > 7 && (
              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Next billing
                </span>
                <span className="font-medium text-emerald-600">
                  in {daysUntilExpiry} days
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button 
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
              onClick={handleUpgradeClick}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
            <Button 
              variant="outline" 
              className="h-11 rounded-xl"
              onClick={handleNavigateBilling}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Billing
            </Button>
          </div>
        </CardContent>
      </Card>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
