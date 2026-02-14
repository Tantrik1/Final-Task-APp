import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AuthForm } from '@/components/auth/AuthForm';
import { FirstLoginPasswordPrompt } from '@/components/auth/FirstLoginPasswordPrompt';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle2, Users, Zap, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { PWAInstallPrompt, PWAInstallBanner } from '@/components/pwa/PWAInstallPrompt';
import logoLight from '@/assets/logo-light.png';

const features = [
  { icon: CheckCircle2, text: 'Kanban & List Views' },
  { icon: Users, text: 'Team Collaboration' },
  { icon: Zap, text: 'Real-time Sync' },
  { icon: Shield, text: 'Secure & Private' },
];

// Session storage key for "remind me later"
const REMIND_LATER_KEY = 'hamrotask_password_remind_later';

export default function Auth() {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectStatus, setRedirectStatus] = useState('Redirecting...');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  // Get the intended destination from state or query params
  const redirectPath = searchParams.get('redirect');
  const from = redirectPath || 
    (location.state as { from?: { pathname: string } })?.from?.pathname;

  // Role-based redirect for authenticated users
  useEffect(() => {
    const handleAuthenticatedRedirect = async () => {
      if (!user || isRedirecting) return;
      
      setIsRedirecting(true);
      setRedirectStatus('Checking your account...');

      try {
        // Parallel fetch: super admin status, workspace membership, and password reset status
        const [superAdminResult, workspaceResult, profileResult] = await Promise.all([
          supabase
            .from('super_admins')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .limit(1),
          supabase
            .from('profiles')
            .select('needs_password_reset')
            .eq('id', user.id)
            .single()
        ]);

        // Check if user was reminded later this session
        const remindLaterSession = sessionStorage.getItem(REMIND_LATER_KEY);

        // Check if needs password reset and hasn't been reminded this session
        const needsPasswordReset = profileResult.data?.needs_password_reset === true && !remindLaterSession;

        // Determine redirect path first
        let targetPath = '/onboarding';
        
        // Priority 1: Super Admin → /admin
        if (superAdminResult.data) {
          targetPath = '/admin';
        }
        // Priority 2: Has Workspace
        else if (workspaceResult.data && workspaceResult.data.length > 0) {
          const workspaceId = workspaceResult.data[0].workspace_id;
          
          // Handle specific redirect paths
          if (redirectPath && redirectPath !== '/' && redirectPath !== '/auth') {
            targetPath = `/workspace/${workspaceId}${redirectPath}`;
          } else if (from && from !== '/' && from !== '/auth' && !from.startsWith('/admin')) {
            targetPath = from;
          } else {
            targetPath = `/workspace/${workspaceId}`;
          }
        }
        // Priority 3: No Workspace → /onboarding (already set as default)

        // If needs password reset, show prompt before redirect
        if (needsPasswordReset) {
          setRedirectStatus('Almost there...');
          setPendingRedirect(targetPath);
          setShowPasswordPrompt(true);
          setIsRedirecting(false);
          return;
        }

        // Continue with redirect
        setRedirectStatus(
          superAdminResult.data ? 'Welcome, Super Admin!' :
          workspaceResult.data?.length ? 'Opening your workspace...' :
          'Setting up your workspace...'
        );
        
        setTimeout(() => navigate(targetPath, { replace: true }), 300);
      } catch (error) {
        console.error('Error during redirect:', error);
        navigate('/onboarding', { replace: true });
      }
    };

    if (!isLoading && user) {
      handleAuthenticatedRedirect();
    }
  }, [user, isLoading, navigate, from, redirectPath, isRedirecting]);

  // Handle password prompt completion
  const handlePasswordComplete = () => {
    setShowPasswordPrompt(false);
    if (pendingRedirect) {
      navigate(pendingRedirect, { replace: true });
    }
  };

  // Handle "Skip" - clear flag and redirect
  const handlePasswordSkip = () => {
    setShowPasswordPrompt(false);
    if (pendingRedirect) {
      navigate(pendingRedirect, { replace: true });
    }
  };

  // Handle "Remind Me Later" - set session flag and redirect
  const handleRemindLater = () => {
    sessionStorage.setItem(REMIND_LATER_KEY, 'true');
    setShowPasswordPrompt(false);
    if (pendingRedirect) {
      navigate(pendingRedirect, { replace: true });
    }
  };

  if (isLoading || (isRedirecting && !showPasswordPrompt)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <motion.img 
            src={logoLight} 
            alt="Hamro Task" 
            className="h-16 w-auto"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">{redirectStatus}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* First Login Password Prompt */}
      <FirstLoginPasswordPrompt
        open={showPasswordPrompt}
        onComplete={handlePasswordComplete}
        onSkip={handlePasswordSkip}
        onRemindLater={handleRemindLater}
      />

      <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-background via-secondary/20 to-background overflow-hidden">
        {/* Left side - Branding (hidden on mobile) */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-gradient-to-br from-primary/10 via-accent/5 to-background p-12 flex-col justify-between"
        >
          {/* Background Effects */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-20 left-20 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-20 right-20 w-[300px] h-[300px] bg-accent/20 rounded-full blur-[80px]" />
          </div>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 w-fit">
            <img 
              src={logoLight} 
              alt="Hamro Task" 
              className="h-12 w-auto"
            />
          </Link>

          {/* Content */}
          <div className="max-w-lg">
            <Badge className="mb-6 px-4 py-2 rounded-full bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-4 w-4 mr-2" />
              #1 Task Manager in Nepal
            </Badge>
            
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight mb-6">
              Manage Tasks
              <span className="block brand-gradient-text">Like Never Before</span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Join thousands of teams using Hamro Task to streamline their workflow, 
              collaborate better, and deliver projects on time.
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature) => (
                <div 
                  key={feature.text}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
            <p className="text-sm italic text-muted-foreground mb-4">
              "Hamro Task transformed how our team works. We're now 40% more productive!"
            </p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-semibold">
                SP
              </div>
              <div>
                <p className="text-sm font-semibold">Suman Pradhan</p>
                <p className="text-xs text-muted-foreground">CEO, TechStart Nepal</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right side - Auth Form */}
        <div className="flex-1 flex flex-col min-h-screen lg:min-h-0">
          {/* Mobile Header */}
          <header className="lg:hidden p-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={logoLight} 
                alt="Hamro Task" 
                className="h-10 w-auto"
              />
            </Link>
            <Badge variant="outline" className="text-xs">
              Free to start
            </Badge>
          </header>

          {/* Main Auth Content */}
          <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="w-full max-w-md"
            >
              {/* PWA Install Banner */}
              <PWAInstallBanner className="mb-6" />

              <Card className="shadow-2xl border-0 bg-card/90 backdrop-blur-sm">
                <CardHeader className="text-center space-y-2 pb-4">
                  <CardTitle className="text-2xl font-bold">
                    {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
                  </CardTitle>
                  <CardDescription>
                    {activeTab === 'login'
                      ? 'Sign in to access your workspaces'
                      : 'Start managing tasks for free'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
                    <TabsList className="grid w-full grid-cols-2 mb-6 h-12 rounded-xl">
                      <TabsTrigger value="login" className="rounded-lg text-sm font-medium">
                        Sign In
                      </TabsTrigger>
                      <TabsTrigger value="signup" className="rounded-lg text-sm font-medium">
                        Sign Up
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="login">
                      <AuthForm mode="login" />
                    </TabsContent>
                    <TabsContent value="signup">
                      <AuthForm mode="signup" />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Mobile Features */}
              <div className="lg:hidden mt-8 grid grid-cols-2 gap-3">
                {features.map((feature) => (
                  <div 
                    key={feature.text}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <feature.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs">{feature.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </main>

          {/* Footer */}
          <footer className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our{' '}
              <a href="#" className="underline hover:text-foreground">Terms</a>
              {' '}and{' '}
              <a href="#" className="underline hover:text-foreground">Privacy Policy</a>
            </p>
          </footer>
        </div>

        {/* PWA Install Prompt */}
        <PWAInstallPrompt showOnMount delay={5000} />
      </div>
    </>
  );
}
