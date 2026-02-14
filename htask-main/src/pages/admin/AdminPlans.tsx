import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_npr: number;
  max_members: number | null;
  max_projects: number | null;
  features: Record<string, boolean>;
  badge_text: string | null;
  is_active: boolean;
  position: number;
}

const defaultFeatures = {
  chat: true,
  kanban: true,
  list_view: true,
  basic_templates: true,
  all_templates: false,
  file_uploads: false,
  time_tracking: false,
  calendar: false,
  custom_fields: false,
  reports: false,
  activity_logs: false,
  roles: false,
  exports: false,
  automation: false,
  api_access: false,
  priority_support: false,
};

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_npr: 0,
    max_members: '',
    max_projects: '',
    badge_text: '',
    features: { ...defaultFeatures },
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('position');

    if (error) {
      toast.error('Failed to fetch plans');
    } else {
      setPlans(data as Plan[]);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      description: '',
      price_npr: 0,
      max_members: '',
      max_projects: '',
      badge_text: '',
      features: { ...defaultFeatures },
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description ?? '',
      price_npr: plan.price_npr,
      max_members: plan.max_members?.toString() ?? '',
      max_projects: plan.max_projects?.toString() ?? '',
      badge_text: plan.badge_text ?? '',
      features: { ...defaultFeatures, ...plan.features },
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    setSaving(true);
    try {
      const planData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price_npr: formData.price_npr,
        max_members: formData.max_members ? parseInt(formData.max_members) : null,
        max_projects: formData.max_projects ? parseInt(formData.max_projects) : null,
        badge_text: formData.badge_text.trim() || null,
        features: formData.features,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        toast.success('Plan updated');
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert([{ ...planData, position: plans.length }]);

        if (error) throw error;
        toast.success('Plan created');
      }

      setIsDialogOpen(false);
      fetchPlans();
    } catch (err) {
      toast.error('Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: !plan.is_active })
      .eq('id', plan.id);

    if (error) {
      toast.error('Failed to update plan');
    } else {
      fetchPlans();
    }
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;

    const { error } = await supabase
      .from('subscription_plans')
      .delete()
      .eq('id', deletingPlan.id);

    if (error) {
      toast.error('Failed to delete plan. It may be in use.');
    } else {
      toast.success('Plan deleted');
      fetchPlans();
    }
    setDeletingPlan(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">Manage pricing and features</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Plan
        </Button>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={!plan.is_active ? 'opacity-50' : ''}
          >
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-1 cursor-move">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {plan.name}
                    {plan.badge_text && (
                      <Badge variant="secondary">{plan.badge_text}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={plan.is_active}
                  onCheckedChange={() => handleToggleActive(plan)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Price */}
                <div>
                  <span className="text-2xl font-bold">NPR {plan.price_npr}</span>
                  {plan.price_npr > 0 && (
                    <span className="text-muted-foreground">/member/month</span>
                  )}
                </div>

                {/* Limits */}
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Members: </span>
                    <span className="font-medium">{plan.max_members ?? 'Unlimited'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Projects: </span>
                    <span className="font-medium">{plan.max_projects ?? 'Unlimited'}</span>
                  </div>
                </div>

                {/* Features count */}
                <div className="text-sm text-muted-foreground">
                  {Object.values(plan.features).filter(Boolean).length} features enabled
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditDialog(plan)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setDeletingPlan(plan)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
            <DialogDescription>Configure plan details and features</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Basic"
                />
              </div>
              <div className="space-y-2">
                <Label>Badge Text (optional)</Label>
                <Input
                  value={formData.badge_text}
                  onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                  placeholder="e.g., Most Popular"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief plan description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Price (NPR)</Label>
                <Input
                  type="number"
                  value={formData.price_npr}
                  onChange={(e) => setFormData({ ...formData, price_npr: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Members (empty = unlimited)</Label>
                <Input
                  type="number"
                  value={formData.max_members}
                  onChange={(e) => setFormData({ ...formData, max_members: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Projects (empty = unlimited)</Label>
                <Input
                  type="number"
                  value={formData.max_projects}
                  onChange={(e) => setFormData({ ...formData, max_projects: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Features</Label>
              <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg">
                {Object.keys(defaultFeatures).map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                    <Switch
                      checked={formData.features[key]}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          features: { ...formData.features, [key]: checked },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPlan} onOpenChange={() => setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPlan?.name}"? This action cannot be undone.
              Workspaces using this plan will need to be migrated first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
