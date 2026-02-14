import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Mail, User, Lock, Shield, Eye, Send, Info, 
  EyeOff, Eye as EyeIcon, Users, Crown
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type WorkspaceRole = Database['public']['Enums']['workspace_role'];

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InviteFormData) => Promise<void>;
  isSubmitting: boolean;
}

export interface InviteFormData {
  email: string;
  fullName: string;
  password?: string;
  role: WorkspaceRole;
  credentialEmail?: string;
}

const roleDescriptions: Record<Exclude<WorkspaceRole, 'owner'>, string> = {
  admin: 'Full access to manage workspace',
  member: 'Can create & edit tasks',
  viewer: 'Read-only access',
};

const roleIcons: Record<Exclude<WorkspaceRole, 'owner'>, typeof Shield> = {
  admin: Shield,
  member: User,
  viewer: Eye,
};

export function InviteMemberDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isSubmitting 
}: InviteMemberDialogProps) {
  // Form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [useDefaultPassword, setUseDefaultPassword] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [credentialDelivery, setCredentialDelivery] = useState<'same' | 'different'>('same');
  const [credentialEmail, setCredentialEmail] = useState('');

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    // At least 8 chars, contains letter and number
    return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email.trim())) {
      newErrors.email = 'Invalid email format';
    }

    // Full name validation
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    // Password validation (if custom)
    if (!useDefaultPassword && password) {
      if (!validatePassword(password)) {
        newErrors.password = 'Password must be 8+ chars with letters and numbers';
      }
    }

    // Credential email validation (if different)
    if (credentialDelivery === 'different') {
      if (!credentialEmail.trim()) {
        newErrors.credentialEmail = 'Recipient email is required';
      } else if (!validateEmail(credentialEmail.trim())) {
        newErrors.credentialEmail = 'Invalid email format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const formData: InviteFormData = {
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      role,
      ...((!useDefaultPassword && password) && { password }),
      ...(credentialDelivery === 'different' && { credentialEmail: credentialEmail.trim().toLowerCase() }),
    };

    await onSubmit(formData);
    
    // Reset form on success
    resetForm();
  };

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setPassword('');
    setUseDefaultPassword(true);
    setShowPassword(false);
    setRole('member');
    setCredentialDelivery('same');
    setCredentialEmail('');
    setErrors({});
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const isValid = email.trim() && fullName.trim() && 
    (useDefaultPassword || !password || validatePassword(password)) &&
    (credentialDelivery === 'same' || validateEmail(credentialEmail.trim()));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl mx-4 sm:mx-auto max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Invite Team Member</DialogTitle>
              <DialogDescription className="text-sm">
                Add a new member to your workspace
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Account Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
              }}
              className={cn("rounded-xl", errors.email && "border-destructive")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="invite-name" className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invite-name"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
              }}
              className={cn("rounded-xl", errors.fullName && "border-destructive")}
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName}</p>
            )}
          </div>

          {/* Password Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Initial Password
            </Label>
            
            <RadioGroup 
              value={useDefaultPassword ? 'default' : 'custom'}
              onValueChange={(v) => {
                setUseDefaultPassword(v === 'default');
                if (v === 'default') {
                  setPassword('');
                  setErrors(prev => ({ ...prev, password: '' }));
                }
              }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="default" id="password-default" />
                <Label htmlFor="password-default" className="flex-1 cursor-pointer text-sm">
                  <span className="font-medium">Use default password</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Hamrotask123! (user will change on first login)
                  </span>
                </Label>
              </div>
              
              <div className={cn(
                "flex items-start space-x-3 p-3 rounded-xl border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors",
                !useDefaultPassword && "bg-muted/30"
              )}>
                <RadioGroupItem value="custom" id="password-custom" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="password-custom" className="cursor-pointer text-sm font-medium">
                    Set custom password
                  </Label>
                  {!useDefaultPassword && (
                    <div className="mt-2 relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                        }}
                        className={cn("rounded-xl pr-10", errors.password && "border-destructive")}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <EyeIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  )}
                  {!useDefaultPassword && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Min 8 chars with letters and numbers
                    </p>
                  )}
                  {errors.password && (
                    <p className="text-xs text-destructive mt-1">{errors.password}</p>
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Crown className="h-4 w-4 text-muted-foreground" />
              Role
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(['admin', 'member', 'viewer'] as const).map((r) => {
                  const Icon = roleIcons[r];
                  return (
                    <SelectItem key={r} value={r} className="rounded-lg">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="capitalize">{r}</span>
                        <span className="text-xs text-muted-foreground">- {roleDescriptions[r]}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Credential Delivery */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/50">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              Credential Delivery
            </Label>
            
            <RadioGroup 
              value={credentialDelivery}
              onValueChange={(v) => {
                setCredentialDelivery(v as 'same' | 'different');
                if (v === 'same') {
                  setCredentialEmail('');
                  setErrors(prev => ({ ...prev, credentialEmail: '' }));
                }
              }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 cursor-pointer">
                <RadioGroupItem value="same" id="delivery-same" />
                <Label htmlFor="delivery-same" className="cursor-pointer text-sm">
                  Send to account email
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 cursor-pointer">
                <RadioGroupItem value="different" id="delivery-different" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="delivery-different" className="cursor-pointer text-sm">
                    Send to different email
                  </Label>
                  {credentialDelivery === 'different' && (
                    <div className="mt-2">
                      <Input
                        type="email"
                        placeholder="manager@company.com"
                        value={credentialEmail}
                        onChange={(e) => {
                          setCredentialEmail(e.target.value);
                          if (errors.credentialEmail) setErrors(prev => ({ ...prev, credentialEmail: '' }));
                        }}
                        className={cn("rounded-xl", errors.credentialEmail && "border-destructive")}
                      />
                      {errors.credentialEmail && (
                        <p className="text-xs text-destructive mt-1">{errors.credentialEmail}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Info Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              The invited user will receive their login credentials via email and will be prompted to change their password on first login.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={() => handleOpenChange(false)} 
              className="rounded-xl"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="rounded-xl"
            >
              <Mail className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
