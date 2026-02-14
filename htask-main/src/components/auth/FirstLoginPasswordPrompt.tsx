import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Eye, EyeOff, Check, X, AlertTriangle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

interface FirstLoginPasswordPromptProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onRemindLater: () => void;
}

// Password strength checker
const calculatePasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  if (score <= 2) return { score: (score / 6) * 100, label: 'Weak', color: 'bg-destructive' };
  if (score <= 4) return { score: (score / 6) * 100, label: 'Medium', color: 'bg-yellow-500' };
  return { score: (score / 6) * 100, label: 'Strong', color: 'bg-green-500' };
};

export function FirstLoginPasswordPrompt({
  open,
  onComplete,
  onSkip,
  onRemindLater,
}: FirstLoginPasswordPromptProps) {
  const [showForm, setShowForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const passwordStrength = calculatePasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid = newPassword.length >= 8;
  const canSubmit = isPasswordValid && passwordsMatch && !isSubmitting;

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowForm(false);
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setIsSubmitting(false);
      setIsSuccess(false);
    }
  }, [open]);

  const handleUpdatePassword = async () => {
    if (!canSubmit) return;
    
    setIsSubmitting(true);
    try {
      // Update password using Supabase auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Clear the needs_password_reset flag
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ needs_password_reset: false })
          .eq('id', user.id);
      }

      setIsSuccess(true);
      toast.success('Password updated successfully!');
      
      // Delay before completing to show success animation
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      // Clear the flag permanently
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ needs_password_reset: false })
          .eq('id', user.id);
      }
      onSkip();
    } catch (error) {
      console.error('Error clearing password reset flag:', error);
      onSkip();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md border-0 shadow-2xl overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        
        <AnimatePresence mode="wait">
          {!showForm && !isSuccess && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader className="text-center pb-4">
                {/* Animated shield icon */}
                <motion.div 
                  className="mx-auto mb-4 relative"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                  <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                    <Shield className="h-8 w-8 text-primary-foreground" />
                  </div>
                  {/* Pulsing ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/40"
                    animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                </motion.div>
                
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  Secure Your Account
                </DialogTitle>
                <DialogDescription className="text-base mt-2">
                  You're using a temporary password. For your security, we recommend changing it now.
                </DialogDescription>
              </DialogHeader>
              
              {/* Security badge */}
              <div className="flex items-center justify-center gap-2 py-4">
                <div className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600">Security Step 1 of 1</span>
                </div>
              </div>
              
              <div className="space-y-3 mt-4">
                <Button 
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={() => setShowForm(true)}
                >
                  <Lock className="mr-2 h-5 w-5" />
                  Set New Password
                </Button>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="h-11"
                    onClick={onRemindLater}
                  >
                    Remind Me Later
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="h-11 text-muted-foreground hover:text-foreground"
                    onClick={handleSkip}
                  >
                    Skip <span className="text-xs ml-1">(Not Recommended)</span>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {showForm && !isSuccess && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader className="text-center pb-2">
                <DialogTitle className="text-xl font-bold">
                  Create New Password
                </DialogTitle>
                <DialogDescription>
                  Choose a strong password to protect your account
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-medium">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-12 pr-12 text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  
                  {/* Password strength indicator */}
                  {newPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-1.5"
                    >
                      <Progress value={passwordStrength.score} className="h-2" />
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${
                          passwordStrength.label === 'Weak' ? 'text-destructive' :
                          passwordStrength.label === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {passwordStrength.label}
                        </span>
                        <span className="text-muted-foreground">
                          {newPassword.length >= 8 ? '✓' : '○'} 8+ characters
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
                
                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`h-12 pr-12 text-base ${
                        confirmPassword && !passwordsMatch ? 'border-destructive' : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  
                  {/* Match indicator */}
                  {confirmPassword && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`flex items-center gap-1.5 text-xs ${
                        passwordsMatch ? 'text-green-600' : 'text-destructive'
                      }`}
                    >
                      {passwordsMatch ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </motion.div>
                  )}
                </div>
                
                {/* Submit button */}
                <div className="pt-2 space-y-2">
                  <Button 
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 shadow-lg"
                    onClick={handleUpdatePassword}
                    disabled={!canSubmit}
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                      />
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Set New Password
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => setShowForm(false)}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {isSuccess && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg"
              >
                <Check className="h-8 w-8 text-white" />
              </motion.div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                Password Updated!
              </h3>
              <p className="text-muted-foreground">
                Your account is now secured with your new password.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
