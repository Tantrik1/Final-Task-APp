import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Upload, GripVertical, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentMethod {
  id: string;
  name: string;
  qr_image_url: string | null;
  instructions: string | null;
  is_active: boolean;
  position: number;
}

export default function AdminPaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethod | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    instructions: '',
    qr_image_url: '',
  });

  useEffect(() => {
    fetchMethods();
  }, []);

  const fetchMethods = async () => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('position');

    if (error) {
      toast.error('Failed to fetch payment methods');
    } else {
      setMethods(data as PaymentMethod[]);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingMethod(null);
    setFormData({
      name: '',
      instructions: '',
      qr_image_url: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (method: PaymentMethod) => {
    setEditingMethod(method);
    setFormData({
      name: method.name,
      instructions: method.instructions ?? '',
      qr_image_url: method.qr_image_url ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('payment-qr-codes')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('payment-qr-codes')
        .getPublicUrl(fileName);

      setFormData({ ...formData, qr_image_url: urlData.publicUrl });
      toast.success('QR code uploaded');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload QR code');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Payment method name is required');
      return;
    }

    setSaving(true);
    try {
      const methodData = {
        name: formData.name.trim(),
        instructions: formData.instructions.trim() || null,
        qr_image_url: formData.qr_image_url || null,
      };

      if (editingMethod) {
        const { error } = await supabase
          .from('payment_methods')
          .update(methodData)
          .eq('id', editingMethod.id);

        if (error) throw error;
        toast.success('Payment method updated');
      } else {
        const { error } = await supabase
          .from('payment_methods')
          .insert([{ ...methodData, position: methods.length }]);

        if (error) throw error;
        toast.success('Payment method created');
      }

      setIsDialogOpen(false);
      fetchMethods();
    } catch (err) {
      toast.error('Failed to save payment method');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (method: PaymentMethod) => {
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_active: !method.is_active })
      .eq('id', method.id);

    if (error) {
      toast.error('Failed to update payment method');
    } else {
      fetchMethods();
    }
  };

  const handleDelete = async () => {
    if (!deletingMethod) return;

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', deletingMethod.id);

    if (error) {
      toast.error('Failed to delete payment method');
    } else {
      toast.success('Payment method deleted');
      fetchMethods();
    }
    setDeletingMethod(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
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
          <h1 className="text-2xl font-bold">Payment Methods</h1>
          <p className="text-muted-foreground">Manage QR codes for manual payments</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Method
        </Button>
      </div>

      {/* Methods Grid */}
      {methods.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <QrCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-1">No payment methods</h3>
            <p className="text-muted-foreground mb-4">Add QR codes for eSewa, Khalti, or bank transfer</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {methods.map((method) => (
            <Card
              key={method.id}
              className={!method.is_active ? 'opacity-50' : ''}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground mt-1 cursor-move" />
                  <div>
                    <CardTitle className="text-lg">{method.name}</CardTitle>
                    {method.instructions && (
                      <CardDescription className="line-clamp-2">
                        {method.instructions}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <Switch
                  checked={method.is_active}
                  onCheckedChange={() => handleToggleActive(method)}
                />
              </CardHeader>
              <CardContent>
                {/* QR Code Preview */}
                {method.qr_image_url ? (
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-4">
                    <img
                      src={method.qr_image_url}
                      alt={`${method.name} QR Code`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center mb-4">
                    <QrCode className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditDialog(method)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setDeletingMethod(method)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}</DialogTitle>
            <DialogDescription>Configure payment method with QR code</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., eSewa, Khalti, Bank Transfer"
              />
            </div>

            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="e.g., Scan QR and pay to this account. Include your email in remarks."
              />
            </div>

            <div className="space-y-2">
              <Label>QR Code Image</Label>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              {formData.qr_image_url ? (
                <div className="space-y-2">
                  <div className="w-40 h-40 rounded-lg overflow-hidden bg-muted mx-auto">
                    <img
                      src={formData.qr_image_url}
                      alt="QR Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Change Image
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload QR Code'}
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingMethod ? 'Save Changes' : 'Add Method'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMethod} onOpenChange={() => setDeletingMethod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingMethod?.name}"? This action cannot be undone.
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
