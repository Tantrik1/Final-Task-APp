import { useState } from 'react';
import { 
  Users, FolderKanban, Calendar, CreditCard, Mail, 
  Shield, X, Crown, Zap, Star, Sparkles 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface WorkspaceDetail {
  id: string;
  name: string;
  created_at: string;
  owner_email: string;
  member_count: number;
  project_count: number;
  subscription: {
    plan_id: string;
    plan_name: string;
    status: string;
    starts_at: string;
    expires_at: string | null;
  } | null;
}

interface Plan {
  id: string;
  name: string;
  price_npr: number;
}

interface WorkspaceDetailDialogProps {
  workspace: WorkspaceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: Plan[];
  onRefresh: () => void;
}

export function WorkspaceDetailDialog({ 
  workspace, 
  open, 
  onOpenChange, 
  plans,
  onRefresh 
}: WorkspaceDetailDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [extensionMonths, setExtensionMonths] = useState('1');
  const [updating, setUpdating] = useState(false);

  if (!workspace) return null;

  const handleChangePlan = async () => {
    if (!selectedPlan) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('workspace_subscriptions')
        .update({ plan_id: selectedPlan })
        .eq('workspace_id', workspace.id);

      if (error) throw error;
      toast.success('Plan updated!');
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update plan');
    } finally {
      setUpdating(false);
    }
  };

  const handleExtendSubscription = async () => {
    if (!workspace.subscription) return;
    
    setUpdating(true);
    try {
      const currentExpiry = workspace.subscription.expires_at 
        ? new Date(workspace.subscription.expires_at)
        : new Date();
      
      currentExpiry.setMonth(currentExpiry.getMonth() + parseInt(extensionMonths));

      const { error } = await supabase
        .from('workspace_subscriptions')
        .update({ 
          expires_at: currentExpiry.toISOString(),
          status: 'active'
        })
        .eq('workspace_id', workspace.id);

      if (error) throw error;
      toast.success(`Extended by ${extensionMonths} month(s)!`);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to extend subscription');
    } finally {
      setUpdating(false);
    }
  };

  const handleSuspend = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('workspace_subscriptions')
        .update({ status: 'cancelled' })
        .eq('workspace_id', workspace.id);

      if (error) throw error;
      toast.success('Workspace suspended');
      onRefresh();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to suspend workspace');
    } finally {
      setUpdating(false);
    }
  };

  const handleReactivate = async () => {
    setUpdating(true);
    try {
      const newExpiry = new Date();
      newExpiry.setMonth(newExpiry.getMonth() + 1);

      const { error } = await supabase
        .from('workspace_subscriptions')
        .update({ 
          status: 'active',
          expires_at: newExpiry.toISOString()
        })
        .eq('workspace_id', workspace.id);

      if (error) throw error;
      toast.success('Workspace reactivated!');
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reactivate');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'trial': return 'bg-blue-100 text-blue-700';
      case 'expired': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-gray-100 text-gray-700';
      case 'grace_period': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName?.toLowerCase()) {
      case 'free': return null;
      case 'basic': return <Zap className="h-4 w-4" />;
      case 'standard': return <Star className="h-4 w-4" />;
      case 'premium': return <Crown className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {workspace.name}
          </DialogTitle>
          <DialogDescription>
            Manage workspace subscription and settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Workspace Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> Owner
              </p>
              <p className="font-medium">{workspace.owner_email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </p>
              <p className="font-medium">{formatDistanceToNow(new Date(workspace.created_at), { addSuffix: true })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Members
              </p>
              <p className="font-medium">{workspace.member_count}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1">
                <FolderKanban className="h-3 w-3" /> Projects
              </p>
              <p className="font-medium">{workspace.project_count}</p>
            </div>
          </div>

          <Separator />

          {/* Subscription Info */}
          {workspace.subscription && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getPlanIcon(workspace.subscription.plan_name)}
                  <span className="font-medium">{workspace.subscription.plan_name} Plan</span>
                </div>
                <Badge className={getStatusColor(workspace.subscription.status)}>
                  {workspace.subscription.status}
                </Badge>
              </div>

              {workspace.subscription.expires_at && (
                <p className="text-sm text-muted-foreground">
                  Expires: {format(new Date(workspace.subscription.expires_at), 'PPP')}
                </p>
              )}

              {/* Change Plan */}
              <div className="space-y-2">
                <Label>Change Plan</Label>
                <div className="flex gap-2">
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select new plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} (NPR {plan.price_npr})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleChangePlan} 
                    disabled={!selectedPlan || updating}
                  >
                    Apply
                  </Button>
                </div>
              </div>

              {/* Extend Subscription */}
              <div className="space-y-2">
                <Label>Extend Subscription</Label>
                <div className="flex gap-2">
                  <Select value={extensionMonths} onValueChange={setExtensionMonths}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 3, 6, 12].map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {m} month{m > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    onClick={handleExtendSubscription}
                    disabled={updating}
                    className="flex-1"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Extend Free
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-3">
            {workspace.subscription?.status === 'cancelled' || workspace.subscription?.status === 'expired' ? (
              <Button 
                className="flex-1" 
                onClick={handleReactivate}
                disabled={updating}
              >
                Reactivate Workspace
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="flex-1 text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                onClick={handleSuspend}
                disabled={updating}
              >
                <X className="h-4 w-4 mr-2" />
                Suspend Workspace
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
