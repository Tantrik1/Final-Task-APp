import { useState, useEffect, useRef } from 'react';
import { Check, Upload, CreditCard, QrCode, ArrowRight, Sparkles } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  price_npr: number;
  max_members: number | null;
  max_projects: number | null;
  features: Record<string, boolean>;
  badge_text: string | null;
  description: string | null;
}

interface PaymentMethod {
  id: string;
  name: string;
  qr_image_url: string | null;
  instructions: string | null;
}

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId?: string;
}

type Step = 'select-plan' | 'payment' | 'upload';

export function UpgradeDialog({ open, onOpenChange, currentPlanId }: UpgradeDialogProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [step, setStep] = useState<Step>('select-plan');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [monthsCount, setMonthsCount] = useState('1');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchData();
      setStep('select-plan');
      setSelectedPlan(null);
      setSelectedPaymentMethod(null);
      setScreenshotUrl(null);
      setMonthsCount('1');
    }
  }, [open]);

  const fetchData = async () => {
    const [plansRes, methodsRes] = await Promise.all([
      supabase.from('subscription_plans').select('*').eq('is_active', true).order('position'),
      supabase.from('payment_methods').select('*').eq('is_active', true).order('position'),
    ]);

    if (plansRes.data) setPlans(plansRes.data as Plan[]);
    if (methodsRes.data) setPaymentMethods(methodsRes.data as PaymentMethod[]);
  };

  const handlePlanSelect = (plan: Plan) => {
    if (plan.price_npr === 0) {
      toast.info("You're already on the Free plan!");
      return;
    }
    setSelectedPlan(plan);
    setStep('payment');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentWorkspace) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${currentWorkspace.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from('payment-screenshots')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData, error: signedUrlError } = await supabase.storage
        .from('payment-screenshots')
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (signedUrlError || !urlData?.signedUrl) throw signedUrlError || new Error('Failed to get signed URL');
      setScreenshotUrl(urlData.signedUrl);
      toast.success('Screenshot uploaded!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload screenshot');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!selectedPlan || !selectedPaymentMethod || !screenshotUrl || !currentWorkspace || !user) {
      toast.error('Please complete all steps');
      return;
    }

    setSubmitting(true);
    try {
      const totalAmount = selectedPlan.price_npr * parseInt(monthsCount);

      const { data: insertedPayment, error } = await supabase.from('payment_submissions').insert({
        workspace_id: currentWorkspace.id,
        plan_id: selectedPlan.id,
        payment_method_id: selectedPaymentMethod.id,
        amount_npr: totalAmount,
        months_paid: parseInt(monthsCount),
        screenshot_url: screenshotUrl,
        submitted_by: user.id,
      }).select('id').single();

      if (error) throw error;

      // Send confirmation email to user
      supabase.functions.invoke('send-payment-notification', {
        body: {
          type: 'payment_submitted_confirmation',
          workspaceId: currentWorkspace.id,
          paymentSubmissionId: insertedPayment.id,
          planName: selectedPlan.name,
          amountNpr: totalAmount,
        }
      }).catch(err => console.error('Failed to send confirmation email:', err));

      // Notify super admins about new payment
      supabase.functions.invoke('send-payment-notification', {
        body: {
          type: 'payment_submitted',
          workspaceId: currentWorkspace.id,
          paymentSubmissionId: insertedPayment.id,
        }
      }).catch(err => console.error('Failed to notify admins:', err));

      toast.success('Payment submitted for verification!');
      onOpenChange(false);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = selectedPlan ? selectedPlan.price_npr * parseInt(monthsCount || '1') : 0;

  const featureLabels: Record<string, string> = {
    chat: 'Team Chat',
    kanban: 'Kanban Board',
    list_view: 'List View',
    basic_templates: 'Basic Templates',
    all_templates: 'All Templates',
    file_uploads: 'File Uploads',
    time_tracking: 'Time Tracking',
    calendar: 'Calendar View',
    custom_fields: 'Custom Fields',
    reports: 'Reports & Analytics',
    activity_logs: 'Activity Logs',
    roles: 'Roles & Permissions',
    exports: 'Data Export',
    automation: 'Automation',
    api_access: 'API Access',
    priority_support: 'Priority Support',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {step === 'select-plan' && 'Choose Your Plan'}
            {step === 'payment' && 'Complete Payment'}
            {step === 'upload' && 'Upload Payment Screenshot'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-plan' && 'Select a plan that fits your team'}
            {step === 'payment' && 'Scan the QR code and make the payment'}
            {step === 'upload' && 'Upload a screenshot of your payment confirmation'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Plan */}
        {step === 'select-plan' && (
          <div className="grid gap-4 md:grid-cols-2 py-4">
            {plans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlanId;
              const enabledFeatures = Object.entries(plan.features || {})
                .filter(([, enabled]) => enabled)
                .map(([key]) => key);

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'relative border rounded-2xl p-5 transition-all cursor-pointer hover:border-primary/50 hover:shadow-lg',
                    isCurrentPlan && 'border-primary bg-primary/5',
                    plan.badge_text && 'ring-2 ring-primary/20'
                  )}
                  onClick={() => !isCurrentPlan && handlePlanSelect(plan)}
                >
                  {plan.badge_text && (
                    <Badge className="absolute -top-2 right-4 bg-primary text-primary-foreground">
                      {plan.badge_text}
                    </Badge>
                  )}
                  
                  <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
                  <div className="mb-3">
                    <span className="text-2xl font-bold">NPR {plan.price_npr}</span>
                    {plan.price_npr > 0 && (
                      <span className="text-muted-foreground text-sm">/member/month</span>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                  
                  <div className="text-xs space-y-1 mb-4">
                    <p className="font-medium text-muted-foreground">
                      {plan.max_members ? `Up to ${plan.max_members} members` : 'Unlimited members'}
                    </p>
                    <p className="font-medium text-muted-foreground">
                      {plan.max_projects ? `${plan.max_projects} projects` : 'Unlimited projects'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {enabledFeatures.slice(0, 5).map((key) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <Check className="h-3 w-3 text-green-500" />
                        <span>{featureLabels[key] || key}</span>
                      </div>
                    ))}
                    {enabledFeatures.length > 5 && (
                      <p className="text-xs text-muted-foreground pl-5">
                        +{enabledFeatures.length - 5} more features
                      </p>
                    )}
                  </div>

                  {isCurrentPlan ? (
                    <Badge variant="outline" className="mt-4 w-full justify-center">
                      Current Plan
                    </Badge>
                  ) : (
                    <Button className="mt-4 w-full" variant={plan.badge_text ? 'default' : 'outline'}>
                      {plan.price_npr === 0 ? 'Downgrade' : 'Select'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 2: Payment */}
        {step === 'payment' && selectedPlan && (
          <div className="py-4 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
              <div>
                <p className="font-medium">{selectedPlan.name} Plan</p>
                <p className="text-sm text-muted-foreground">
                  NPR {selectedPlan.price_npr}/member/month
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep('select-plan')}>
                Change
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Duration (months)</Label>
                <Select value={monthsCount} onValueChange={setMonthsCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 3, 6, 12].map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {m} {m === 1 ? 'month' : 'months'}
                        {m >= 6 && ' (recommended)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-primary">
                  NPR {totalAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Select Payment Method</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={cn(
                      'border rounded-xl p-4 cursor-pointer transition-all hover:border-primary/50',
                      selectedPaymentMethod?.id === method.id && 'border-primary bg-primary/5'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <QrCode className="h-5 w-5 text-primary" />
                      <span className="font-medium">{method.name}</span>
                    </div>
                    {method.qr_image_url && (
                      <div className="aspect-square max-w-[150px] mx-auto rounded-lg overflow-hidden bg-card p-2 border">
                        <img
                          src={method.qr_image_url}
                          alt={`${method.name} QR`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    {method.instructions && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        {method.instructions}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!selectedPaymentMethod}
              onClick={() => setStep('upload')}
            >
              I've Made the Payment
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 3: Upload Screenshot */}
        {step === 'upload' && selectedPlan && (
          <div className="py-4 space-y-6">
            <div className="p-4 rounded-xl bg-muted/50 border">
              <div className="flex justify-between items-center mb-2">
                <p className="font-medium">{selectedPlan.name} Plan</p>
                <Badge>NPR {totalAmount.toLocaleString()}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {monthsCount} month(s) via {selectedPaymentMethod?.name}
              </p>
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />

            {screenshotUrl ? (
              <div className="space-y-3">
                <div className="border rounded-xl overflow-hidden bg-muted/50">
                  <img
                    src={screenshotUrl}
                    alt="Payment screenshot"
                    className="max-h-60 w-full object-contain"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Change Screenshot
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium mb-1">Upload Payment Screenshot</p>
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('payment')} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!screenshotUrl || submitting}
                onClick={handleSubmitPayment}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {submitting ? 'Submitting...' : 'Submit for Verification'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Your subscription will be activated once our team verifies the payment (usually within 24 hours)
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
