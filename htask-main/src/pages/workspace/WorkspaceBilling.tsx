import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { UpgradeDialog } from '@/components/subscription/UpgradeDialog';
import {
  CreditCard,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  Receipt,
  Sparkles,
  Crown,
  Shield,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface PaymentHistoryItem {
  id: string;
  amount_npr: number;
  plan_name: string;
  months_paid: number;
  paid_at: string;
  payment_method: string | null;
}

export default function WorkspaceBilling() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentWorkspace, currentRole } = useWorkspace();
  const {
    plan,
    subscription,
    memberCount,
    memberLimit,
    projectCount,
    projectLimit,
    daysUntilExpiry,
    isExpired,
    isTrialing,
    loading,
  } = useSubscription();

  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Only owners and admins can access billing
  const canAccessBilling = currentRole === 'owner' || currentRole === 'admin';

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      if (!workspaceId || !canAccessBilling) return;

      try {
        const { data, error } = await supabase
          .from('payment_history')
          .select('id, amount_npr, plan_name, months_paid, paid_at, payment_method')
          .eq('workspace_id', workspaceId)
          .order('paid_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching payment history:', error);
          // Also try to fetch from payment_submissions as fallback
          const { data: submissions } = await supabase
            .from('payment_submissions')
            .select(`
              id,
              amount_npr,
              months_paid,
              created_at,
              status,
              plan:subscription_plans(name)
            `)
            .eq('workspace_id', workspaceId)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(10);

          if (submissions) {
            const formattedHistory = submissions.map((s: any) => ({
              id: s.id,
              amount_npr: s.amount_npr,
              plan_name: s.plan?.name || 'Unknown',
              months_paid: s.months_paid,
              paid_at: s.created_at,
              payment_method: null,
            }));
            setPaymentHistory(formattedHistory);
          }
        } else {
          setPaymentHistory(data || []);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchPaymentHistory();
  }, [workspaceId, canAccessBilling]);

  if (!canAccessBilling) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center rounded-2xl">
          <CardContent className="pt-8 pb-8">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Only workspace owners and admins can access billing information.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthlyTotal = plan ? plan.price_npr * memberCount : 0;
  const memberUsagePercent = memberLimit ? (memberCount / memberLimit) * 100 : 0;
  const projectUsagePercent = projectLimit ? (projectCount / projectLimit) * 100 : 0;

  const getExpiryStatusColor = () => {
    if (isExpired) return 'destructive';
    if (daysUntilExpiry !== null && daysUntilExpiry <= 7) return 'warning';
    return 'default';
  };

  const getExpiryStatusText = () => {
    if (isExpired) return 'Expired';
    if (isTrialing) return 'Trial';
    if (daysUntilExpiry !== null) {
      if (daysUntilExpiry <= 0) return 'Expired';
      if (daysUntilExpiry === 1) return '1 day left';
      return `${daysUntilExpiry} days left`;
    }
    return 'Active';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto lg:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Billing & Plan</h1>
            <p className="text-muted-foreground text-sm sm:text-base truncate">
              Manage subscription for <span className="font-medium text-foreground">{currentWorkspace?.name}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Current Plan Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 p-1">
          <div className="bg-card rounded-t-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Crown className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {loading ? (
                        <Skeleton className="h-6 w-24" />
                      ) : (
                        <>
                          {plan?.name || 'Free'} Plan
                          {plan?.badge_text && (
                            <Badge variant="secondary" className="text-xs">
                              {plan.badge_text}
                            </Badge>
                          )}
                        </>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {loading ? (
                        <Skeleton className="h-4 w-40 mt-1" />
                      ) : (
                        <>
                          NPR {plan?.price_npr || 0}/member/month
                        </>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <Badge 
                  variant={getExpiryStatusColor() as any}
                  className={cn(
                    'text-sm px-3 py-1',
                    isExpired && 'bg-destructive text-destructive-foreground'
                  )}
                >
                  {loading ? <Skeleton className="h-4 w-16" /> : getExpiryStatusText()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Usage Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Members */}
                <div className="p-4 rounded-xl bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Team Members
                    </div>
                    <span className="text-sm font-semibold">
                      {memberCount} {memberLimit ? `/ ${memberLimit}` : ''}
                    </span>
                  </div>
                  {memberLimit && (
                    <Progress 
                      value={memberUsagePercent} 
                      className={cn(
                        'h-2',
                        memberUsagePercent >= 90 && 'bg-destructive/20'
                      )}
                    />
                  )}
                </div>

                {/* Projects */}
                <div className="p-4 rounded-xl bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      Projects
                    </div>
                    <span className="text-sm font-semibold">
                      {projectCount} {projectLimit ? `/ ${projectLimit}` : ''}
                    </span>
                  </div>
                  {projectLimit && (
                    <Progress 
                      value={projectUsagePercent} 
                      className={cn(
                        'h-2',
                        projectUsagePercent >= 90 && 'bg-destructive/20'
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Monthly Cost */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Total</p>
                  <p className="text-2xl font-bold">
                    NPR {monthlyTotal.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {memberCount} member{memberCount !== 1 ? 's' : ''} × NPR {plan?.price_npr || 0}
                  </p>
                </div>
                {subscription?.expires_at && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Next billing</p>
                    <p className="font-semibold">
                      {format(new Date(subscription.expires_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
              </div>

              {/* Expiry Warning */}
              {(isExpired || (daysUntilExpiry !== null && daysUntilExpiry <= 7)) && (
                <div className={cn(
                  'p-4 rounded-xl flex items-start gap-3',
                  isExpired ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning-foreground'
                )}>
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">
                      {isExpired ? 'Your subscription has expired' : 'Your subscription is expiring soon'}
                    </p>
                    <p className="text-sm opacity-80">
                      {isExpired
                        ? 'Please renew to continue using all features.'
                        : `Renew now to avoid service interruption.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => setUpgradeOpen(true)}
                  className="gap-2"
                  variant={isExpired ? 'default' : 'gradient'}
                >
                  <Sparkles className="h-4 w-4" />
                  {isExpired ? 'Renew Subscription' : 'Upgrade Plan'}
                </Button>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Payment History</CardTitle>
          </div>
          <CardDescription>Recent payments for this workspace</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : paymentHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No payment history yet</p>
              <p className="text-sm">Your payments will appear here after verification.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentHistory.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">{payment.plan_name} Plan</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.months_paid} month{payment.months_paid !== 1 ? 's' : ''}
                        {payment.payment_method && ` • ${payment.payment_method}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">NPR {payment.amount_npr.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(payment.paid_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Dialog */}
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
