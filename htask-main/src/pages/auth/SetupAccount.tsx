import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, User, Eye, EyeOff, Mail, Sparkles } from 'lucide-react';
import SetupAvatarUpload from '@/components/auth/SetupAvatarUpload';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';

export default function SetupAccount() {
  const navigate = useNavigate();
  const { session, updatePassword, isLoading: authLoading, clearRecoveryMode } = useAuth();
  const { toast } = useToast();
  
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingLink, setIsProcessingLink] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Create preview URL for avatar
  const avatarPreviewUrl = useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile);
    }
    return null;
  }, [avatarFile]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  // Process the recovery link hash on mount
  useEffect(() => {
    const processRecoveryLink = async () => {
      const hash = window.location.hash;
      
      if (!hash || !hash.includes('access_token')) {
        if (!session) {
          setLinkError('No valid recovery link found. Please use the link from your email.');
        }
        setIsProcessingLink(false);
        return;
      }

      try {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (type !== 'recovery' || !accessToken) {
          setLinkError('Invalid link. Please request a new invitation.');
          setIsProcessingLink(false);
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          setLinkError('This link has expired. Please request a new invitation.');
          setIsProcessingLink(false);
          return;
        }

        window.history.replaceState(null, '', window.location.pathname);
        setIsProcessingLink(false);
      } catch (error) {
        console.error('Error processing recovery link:', error);
        setLinkError('Failed to process the link. Please try again.');
        setIsProcessingLink(false);
      }
    };

    processRecoveryLink();
  }, []);

  // Pre-fill name from user metadata once session is available
  useEffect(() => {
    if (session?.user) {
      const metadataName = session.user.user_metadata?.full_name;
      if (metadataName && !fullName) {
        setFullName(metadataName);
      }
    }
  }, [session, fullName]);

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return null;

    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(fileName, avatarFile, { upsert: true });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user) {
      toast({
        title: 'Session expired',
        description: 'Please click the link in your email again.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Update password
      const { error: passwordError } = await updatePassword(password);
      if (passwordError) {
        throw passwordError;
      }

      // Upload avatar if selected
      const avatarUrl = await uploadAvatar(session.user.id);

      // Update profile with full name and avatar URL
      const profileUpdate: { full_name?: string; avatar_url?: string } = {};
      if (fullName.trim()) {
        profileUpdate.full_name = fullName.trim();
      }
      if (avatarUrl) {
        profileUpdate.avatar_url = avatarUrl;
      }

      if (Object.keys(profileUpdate).length > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', session.user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      // Clear recovery mode so AuthenticatedRouter won't redirect back here
      clearRecoveryMode();

      toast({
        title: 'Account setup complete!',
        description: 'Welcome to Hamro Task. Your account is ready.',
      });

      // Find user's workspace and redirect
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.workspace_id) {
        navigate(`/workspace/${membership.workspace_id}`, { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    } catch (error) {
      console.error('Error setting up account:', error);
      toast({
        title: 'Error',
        description: 'Failed to set up your account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while processing link or checking auth state
  if (authLoading || isProcessingLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
        <motion.div 
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <Sparkles className="h-4 w-4 text-primary absolute -top-1 -right-1 animate-pulse" />
          </div>
          <p className="text-muted-foreground font-medium">
            {isProcessingLink ? 'Processing your invitation...' : 'Loading...'}
          </p>
        </motion.div>
      </div>
    );
  }

  // If there was a link error or no session, show error
  if (linkError || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <img src={logoLight} alt="Hamro Task" className="h-10 dark:hidden" />
                <img src={logoDark} alt="Hamro Task" className="h-10 hidden dark:block" />
              </div>
              <CardTitle className="text-xl">Link Expired or Invalid</CardTitle>
              <CardDescription className="text-base">
                {linkError || 'This password setup link has expired or is invalid.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please ask your team administrator to send you a new invitation, or use the "Forgot Password" option.
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => navigate('/auth')} className="w-full">
                    Go to Login
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/auth/reset')} className="w-full">
                    Reset Password
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="flex justify-center mb-4">
              <img src={logoLight} alt="Hamro Task" className="h-10 dark:hidden" />
              <img src={logoDark} alt="Hamro Task" className="h-10 hidden dark:block" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Complete Your Profile
            </CardTitle>
            <CardDescription className="text-base">
              Set up your account to get started
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-6 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Upload Section */}
              <div className="py-4">
                <SetupAvatarUpload
                  file={avatarFile}
                  onFileChange={setAvatarFile}
                  previewUrl={avatarPreviewUrl}
                  name={fullName}
                  email={session?.user?.email || ''}
                />
              </div>

              {/* Name Input */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Display Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="How should your team see you?"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className="h-11 rounded-xl bg-background/50 border-muted-foreground/20 focus:border-primary transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  This is how your teammates will see you
                </p>
              </div>

              {/* Email Input (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={session?.user?.email || ''}
                    disabled
                    className="h-11 rounded-xl bg-muted/50 border-muted-foreground/10 pr-10 cursor-not-allowed"
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground">
                  This is the email you were invited with
                </p>
              </div>
              
              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Create Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-11 rounded-xl bg-background/50 border-muted-foreground/20 pr-10 focus:border-primary transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              {/* Confirm Password Input */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-11 rounded-xl bg-background/50 border-muted-foreground/20 focus:border-primary transition-colors"
                  required
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-lg shadow-primary/20"
                disabled={isSubmitting || !password || !confirmPassword}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Complete Setup
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
