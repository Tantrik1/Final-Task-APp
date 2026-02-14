import { useState, useEffect } from 'react';
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
  User, Lock, Shield, Eye, Save, Send, Info,
  EyeOff, Eye as EyeIcon, Crown, Settings, KeyRound
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type WorkspaceRole = Database['public']['Enums']['workspace_role'];

interface MemberWithProfile {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    needs_password_reset: boolean | null;
  };
}

interface ManageMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberWithProfile | null;
  workspaceId: string;
  workspaceName: string;
  currentUserId: string;
  onMemberUpdated: () => void;
}

const roleDescriptions: Record<Exclude<WorkspaceRole, 'owner'>, string> = {
  admin: 'Full access to manage workspace',
  member: 'Can create & edit tasks',
  viewer: 'Read-only access',
};

const roleIcons: Record<WorkspaceRole, typeof Shield> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

export function ManageMemberDialog({ 
  open, 
  onOpenChange,
  member,
  workspaceId,
  workspaceName,
  currentUserId,
  onMemberUpdated,
}: ManageMemberDialogProps) {
  const { toast } = useToast();
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  
  // Password section
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sendCredentialsAfterReset, setSendCredentialsAfterReset] = useState(true);
  const [credentialEmail, setCredentialEmail] = useState('');
  const [useAlternateEmail, setUseAlternateEmail] = useState(false);
  
  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSendingCredentials, setIsSendingCredentials] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when member changes
  useEffect(() => {
    if (member) {
      setFullName(member.profiles.full_name || '');
      setRole(member.role);
      setCredentialEmail('');
      setUseAlternateEmail(false);
      setNewPassword('');
      setShowPassword(false);
      setSendCredentialsAfterReset(true);
      setErrors({});
    }
  }, [member]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
  };

  const handleSaveDetails = async () => {
    if (!member) return;

    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) {
      newErrors.fullName = 'Name is required';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      // Update profile name
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', member.user_id);

      if (profileError) throw profileError;

      // Update role if changed
      if (role !== member.role) {
        const { error: roleError } = await supabase
          .from('workspace_members')
          .update({ role })
          .eq('id', member.id);

        if (roleError) throw roleError;
      }

      toast({
        title: 'Details updated',
        description: `${fullName}'s details have been saved.`,
      });

      onMemberUpdated();
    } catch (error) {
      console.error('Error saving member details:', error);
      toast({
        title: 'Error',
        description: 'Failed to save member details.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!member || !newPassword) return;

    if (!validatePassword(newPassword)) {
      setErrors({ ...errors, password: 'Password must be 8+ chars with letters and numbers' });
      return;
    }

    if (useAlternateEmail && !validateEmail(credentialEmail.trim())) {
      setErrors({ ...errors, credentialEmail: 'Invalid email format' });
      return;
    }

    setIsResettingPassword(true);
    try {
      // Get inviter name
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', currentUserId)
        .single();

      const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'An admin';

      const { data, error } = await supabase.functions.invoke('reset-member-password', {
        body: {
          userId: member.user_id,
          newPassword,
          sendCredentials: sendCredentialsAfterReset,
          credentialEmail: useAlternateEmail ? credentialEmail.trim() : member.profiles.email,
          memberName: fullName || member.profiles.full_name || member.profiles.email.split('@')[0],
          workspaceName,
          adminName: inviterName,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reset password');
      }

      const sentTo = useAlternateEmail ? credentialEmail.trim() : member.profiles.email;
      toast({
        title: 'Password reset',
        description: sendCredentialsAfterReset 
          ? `New credentials sent to ${sentTo}` 
          : `Password has been changed for ${member.profiles.full_name || member.profiles.email}`,
      });

      setNewPassword('');
      setShowPassword(false);
      onMemberUpdated();
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset password.',
        variant: 'destructive',
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSendCredentials = async () => {
    if (!member) return;

    if (useAlternateEmail && !validateEmail(credentialEmail.trim())) {
      setErrors({ ...errors, credentialEmail: 'Invalid email format' });
      return;
    }

    setIsSendingCredentials(true);
    try {
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', currentUserId)
        .single();

      const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'An admin';

      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: member.profiles.email,
          fullName: fullName || member.profiles.full_name,
          workspaceId,
          workspaceName,
          inviterName,
          role: member.role,
          credentialEmail: useAlternateEmail ? credentialEmail.trim() : undefined,
        },
      });

      if (error) throw error;

      const sentTo = useAlternateEmail ? credentialEmail.trim() : member.profiles.email;
      toast({
        title: 'Credentials sent',
        description: `Login credentials have been sent to ${sentTo}`,
      });
    } catch (error) {
      console.error('Error sending credentials:', error);
      toast({
        title: 'Error',
        description: 'Failed to send credentials.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingCredentials(false);
    }
  };

  if (!member) return null;

  const needsSetup = member.profiles.needs_password_reset === true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl mx-4 sm:mx-auto max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Manage Member</DialogTitle>
              <DialogDescription className="text-sm">
                {member.profiles.email}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Profile Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <User className="h-4 w-4" />
              Profile Details
            </h3>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="member-name" className="text-sm">
                  Full Name
                </Label>
                <Input
                  id="member-name"
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

              <div className="space-y-2">
                <Label className="text-sm">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)} disabled={member.role === 'owner'}>
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

              <Button 
                onClick={handleSaveDetails} 
                disabled={isSaving}
                className="w-full rounded-xl"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Details'}
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Password Management Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <KeyRound className="h-4 w-4" />
              Password Management
            </h3>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm">
                  Set New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
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
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Min 8 chars with letters and numbers
                </p>
              </div>

              {newPassword && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="send-after-reset"
                    checked={sendCredentialsAfterReset}
                    onChange={(e) => setSendCredentialsAfterReset(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="send-after-reset" className="text-sm cursor-pointer">
                    Send new credentials via email
                  </Label>
                </div>
              )}

              <Button 
                onClick={handleResetPassword} 
                disabled={!newPassword || isResettingPassword}
                variant="outline"
                className="w-full rounded-xl"
              >
                <Lock className="h-4 w-4 mr-2" />
                {isResettingPassword ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Send Credentials Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Send className="h-4 w-4" />
              Send Credentials
              {needsSetup && (
                <span className="text-[10px] font-normal text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                  Setup pending
                </span>
              )}
            </h3>

            <div className="space-y-3">
              <RadioGroup 
                value={useAlternateEmail ? 'different' : 'same'}
                onValueChange={(v) => {
                  setUseAlternateEmail(v === 'different');
                  if (v === 'same') {
                    setCredentialEmail('');
                    setErrors(prev => ({ ...prev, credentialEmail: '' }));
                  }
                }}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 cursor-pointer">
                  <RadioGroupItem value="same" id="cred-same" />
                  <Label htmlFor="cred-same" className="cursor-pointer text-sm">
                    Send to {member.profiles.email}
                  </Label>
                </div>
                
                <div className="flex items-start space-x-3 cursor-pointer">
                  <RadioGroupItem value="different" id="cred-different" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="cred-different" className="cursor-pointer text-sm">
                      Send to different email
                    </Label>
                    {useAlternateEmail && (
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

              <Button 
                onClick={handleSendCredentials} 
                disabled={isSendingCredentials || (useAlternateEmail && !credentialEmail.trim())}
                className="w-full rounded-xl"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSendingCredentials ? 'Sending...' : 'Send Credentials Now'}
              </Button>

              {/* Info Notice */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {needsSetup 
                    ? "This user hasn't logged in yet. Sending credentials will help them get started."
                    : "This will send the user their current email and a reminder to contact admin for password if forgotten."
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
