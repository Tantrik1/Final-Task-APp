import { useEffect, useState } from 'react';
import { Check, X, Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface PaymentSubmission {
  id: string;
  workspace_id: string;
  workspace_name: string;
  plan_id: string;
  plan_name: string;
  payment_method_name: string | null;
  amount_npr: number;
  months_paid: number;
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by_email: string;
  admin_notes: string | null;
  created_at: string;
  verified_at: string | null;
}

export default function AdminPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentSubmission | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_submissions')
        .select(`
          *,
          workspace:workspaces(name),
          plan:subscription_plans(name),
          payment_method:payment_methods(name),
          submitted_by_profile:profiles!payment_submissions_submitted_by_fkey(email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformed: PaymentSubmission[] =
        data?.map((p) => ({
          id: p.id,
          workspace_id: p.workspace_id,
          workspace_name: (p.workspace as any)?.name ?? 'Unknown',
          plan_id: p.plan_id,
          plan_name: (p.plan as any)?.name ?? 'Unknown',
          payment_method_name: (p.payment_method as any)?.name ?? null,
          amount_npr: p.amount_npr,
          months_paid: p.months_paid,
          screenshot_url: p.screenshot_url,
          status: p.status as PaymentSubmission['status'],
          submitted_by_email: (p.submitted_by_profile as any)?.email ?? 'Unknown',
          admin_notes: p.admin_notes,
          created_at: p.created_at,
          verified_at: p.verified_at,
        })) ?? [];

      setPayments(transformed);
    } catch (err) {
      console.error('Error fetching payments:', err);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPayment || !user) return;

    setProcessing(true);
    try {
      // Update payment status
      const { error: paymentError } = await supabase
        .from('payment_submissions')
        .update({
          status: 'approved',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          admin_notes: adminNotes || null,
        })
        .eq('id', selectedPayment.id);

      if (paymentError) throw paymentError;

      // Get plan details
      const { data: planData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', selectedPayment.plan_id)
        .single();

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + selectedPayment.months_paid);

      // Update workspace subscription
      const { error: subError } = await supabase
        .from('workspace_subscriptions')
        .update({
          plan_id: selectedPayment.plan_id,
          status: 'active',
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('workspace_id', selectedPayment.workspace_id);

      if (subError) throw subError;

      // Send approval notification email
      supabase.functions.invoke('send-payment-notification', {
        body: {
          type: 'payment_approved',
          workspaceId: selectedPayment.workspace_id,
          paymentSubmissionId: selectedPayment.id,
        }
      }).catch(err => console.error('Failed to send approval email:', err));

      toast.success('Payment approved and subscription activated!');
      setSelectedPayment(null);
      setAdminNotes('');
      fetchPayments();
    } catch (err) {
      console.error('Error approving payment:', err);
      toast.error('Failed to approve payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !user) return;

    if (!adminNotes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('payment_submissions')
        .update({
          status: 'rejected',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          admin_notes: adminNotes,
        })
        .eq('id', selectedPayment.id);

      if (error) throw error;

      // Send rejection notification email
      supabase.functions.invoke('send-payment-notification', {
        body: {
          type: 'payment_rejected',
          workspaceId: selectedPayment.workspace_id,
          paymentSubmissionId: selectedPayment.id,
          rejectionReason: adminNotes,
        }
      }).catch(err => console.error('Failed to send rejection email:', err));

      toast.success('Payment rejected');
      setSelectedPayment(null);
      setAdminNotes('');
      fetchPayments();
    } catch (err) {
      console.error('Error rejecting payment:', err);
      toast.error('Failed to reject payment');
    } finally {
      setProcessing(false);
    }
  };

  const openReviewDialog = (payment: PaymentSubmission) => {
    setSelectedPayment(payment);
    setAdminNotes(payment.admin_notes ?? '');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const processedPayments = payments.filter((p) => p.status !== 'pending');

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const PaymentCard = ({ payment }: { payment: PaymentSubmission }) => (
    <div className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium">{payment.workspace_name}</h3>
          {getStatusBadge(payment.status)}
        </div>
        <div className="text-sm text-muted-foreground space-y-0.5">
          <p>
            <span className="font-medium text-foreground">NPR {payment.amount_npr.toLocaleString()}</span>
            {' · '}{payment.plan_name} plan{' · '}{payment.months_paid} month{payment.months_paid > 1 ? 's' : ''}
          </p>
          <p>
            {payment.payment_method_name && `via ${payment.payment_method_name} · `}
            Submitted by {payment.submitted_by_email}
          </p>
          <p>{formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => openReviewDialog(payment)}>
        <Eye className="h-4 w-4 mr-1" />
        Review
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Payment Verification</h1>
        <p className="text-muted-foreground">Review and verify payment submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</div>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {payments.filter((p) => p.status === 'approved').length}
            </div>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">
              {payments.filter((p) => p.status === 'rejected').length}
            </div>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingPayments.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                {pendingPayments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="processed">Processed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingPayments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="font-medium mb-1">All caught up!</h3>
                <p className="text-muted-foreground">No payments pending review</p>
              </CardContent>
            </Card>
          ) : (
            pendingPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))
          )}
        </TabsContent>

        <TabsContent value="processed" className="space-y-4 mt-4">
          {processedPayments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No processed payments yet
              </CardContent>
            </Card>
          ) : (
            processedPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Payment</DialogTitle>
            <DialogDescription>
              Verify the payment screenshot and approve or reject
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Workspace:</span>
                  <p className="font-medium">{selectedPayment.workspace_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Plan:</span>
                  <p className="font-medium">{selectedPayment.plan_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <p className="font-medium">NPR {selectedPayment.amount_npr.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <p className="font-medium">{selectedPayment.months_paid} month(s)</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Method:</span>
                  <p className="font-medium">{selectedPayment.payment_method_name ?? 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted:</span>
                  <p className="font-medium">{format(new Date(selectedPayment.created_at), 'PPp')}</p>
                </div>
              </div>

              {/* Screenshot */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Payment Screenshot:</p>
                <div className="border rounded-lg overflow-hidden bg-muted/50">
                  <img
                    src={selectedPayment.screenshot_url}
                    alt="Payment screenshot"
                    className="max-h-80 w-full object-contain"
                  />
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="text-sm text-muted-foreground">Admin Notes:</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this payment..."
                  disabled={selectedPayment.status !== 'pending'}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedPayment?.status === 'pending' ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={processing}
                  className="text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve & Activate
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setSelectedPayment(null)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
