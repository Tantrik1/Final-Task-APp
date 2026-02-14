import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';

/**
 * This page handles legacy invitation links.
 * The new invitation flow creates users immediately and sends them 
 * to /auth/setup-account via password reset link.
 * 
 * This page now just redirects appropriately:
 * - If user is logged in: redirect to their workspace
 * - If not logged in: redirect to login with a message
 */
export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is logged in, redirect to dashboard or their workspace
    if (!isLoading && user) {
      // Give a moment for the UI to show, then redirect
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is logged in, show success message while redirecting
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logoLight} alt="Hamro Task" className="h-10 dark:hidden" />
              <img src={logoDark} alt="Hamro Task" className="h-10 hidden dark:block" />
            </div>
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Already Signed In</CardTitle>
            <CardDescription>
              Redirecting you to your workspace...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in - inform them about the new flow
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoLight} alt="Hamro Task" className="h-10 dark:hidden" />
            <img src={logoDark} alt="Hamro Task" className="h-10 hidden dark:block" />
          </div>
          <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-warning" />
          </div>
          <CardTitle className="text-2xl">Invitation Link</CardTitle>
          <CardDescription>
            This link format is no longer used. If you were invited to a workspace, please check your email for a "Set Your Password" link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            If you already have an account, you can sign in to access your workspaces.
          </p>
          <div className="flex flex-col gap-2">
            <Link to="/auth">
              <Button className="w-full">
                Sign In
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full">
                Go to Homepage
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
