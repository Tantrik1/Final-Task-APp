import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';

const resetConfirmSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetConfirmFormData = z.infer<typeof resetConfirmSchema>;

export default function AuthResetConfirm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessingLink, setIsProcessingLink] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const { updatePassword, session, clearRecoveryMode } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<ResetConfirmFormData>({
    resolver: zodResolver(resetConfirmSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Process the recovery link hash on mount
  useEffect(() => {
    const processRecoveryLink = async () => {
      const hash = window.location.hash;
      
      if (!hash || !hash.includes('access_token')) {
        // No recovery token in URL - might be a direct visit or already processed
        if (!session) {
          setLinkError('No valid recovery link found. Please request a new password reset.');
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
          setLinkError('Invalid link. Please request a new password reset.');
          setIsProcessingLink(false);
          return;
        }

        // Set the session using the tokens from the URL
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          setLinkError('This link has expired. Please request a new password reset.');
          setIsProcessingLink(false);
          return;
        }

        // Clear the hash from URL for cleaner appearance
        window.history.replaceState(null, '', window.location.pathname);
        setIsProcessingLink(false);
      } catch (error) {
        console.error('Error processing recovery link:', error);
        setLinkError('Failed to process the link. Please try again.');
        setIsProcessingLink(false);
      }
    };

    processRecoveryLink();
  }, [session]);

  const onSubmit = async (data: ResetConfirmFormData) => {
    setIsLoading(true);

    try {
      const { error } = await updatePassword(data.password);
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error.message,
        });
        return;
      }

      setIsSuccess(true);
      clearRecoveryMode();
      
      toast({
        title: 'Password updated!',
        description: 'Your password has been successfully changed.',
      });
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while processing link
  if (isProcessingLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Processing your reset link...</p>
        </div>
      </div>
    );
  }

  // If there was a link error or no session, show error
  if (linkError || !session) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-secondary/20 to-background">
        <header className="p-6">
          <Link to="/" className="flex items-center gap-2 w-fit">
            <img src={logoLight} alt="Hamro Task" className="h-9 dark:hidden" />
            <img src={logoDark} alt="Hamro Task" className="h-9 hidden dark:block" />
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md shadow-lg border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold">Link Expired</CardTitle>
              <CardDescription>
                {linkError || 'This password reset link has expired. Please request a new one.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => navigate('/auth/reset')} className="w-full">
                Request New Link
              </Button>
              <Button variant="outline" onClick={() => navigate('/auth')} className="w-full">
                Back to Sign In
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <header className="p-6">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <img src={logoLight} alt="Hamro Task" className="h-9 dark:hidden" />
          <img src={logoDark} alt="Hamro Task" className="h-9 hidden dark:block" />
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            {isSuccess ? (
              <>
                <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <CardTitle className="text-2xl font-bold">Password updated!</CardTitle>
                <CardDescription>
                  Your password has been successfully updated. Redirecting you to the app...
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
                <CardDescription>
                  Enter your new password below.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      {...form.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10"
                      {...form.register('confirmPassword')}
                    />
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Hamro Task. All rights reserved.</p>
      </footer>
    </div>
  );
}
