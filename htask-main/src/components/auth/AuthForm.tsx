import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

interface AuthFormProps {
  mode: 'login' | 'signup';
  defaultEmail?: string;
  /** Called after successful auth - use for custom flows like invitations */
  onSuccess?: () => void;
  /** If true, prevents automatic navigation after auth */
  skipRedirect?: boolean;
}

export function AuthForm({ mode, defaultEmail = '', onSuccess, skipRedirect = false }: AuthFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: '' },
  });

  const {
    register: signUpRegister,
    handleSubmit: handleSignUpSubmit,
    formState: { errors: signUpErrors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: defaultEmail, password: '', confirmPassword: '' },
  });

  const onLoginSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            variant: 'destructive',
            title: 'Invalid credentials',
            description: 'Please check your email and password and try again.',
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast({
            variant: 'destructive',
            title: 'Email not verified',
            description: 'Please check your email and click the verification link.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Login failed',
            description: error.message,
          });
        }
        return;
      }
      
      toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Only navigate if skipRedirect is false
      if (!skipRedirect) {
        navigate('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to parse rate limit wait time from error message
  const parseRateLimitWait = (message: string): number | null => {
    const match = message.match(/(\d+)\s*second/i);
    return match ? parseInt(match[1], 10) : null;
  };

  const onSignUpSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(data.email, data.password, data.fullName);
      if (error) {
        // Handle rate limiting (429)
        if (error.message.includes('security purposes') || error.message.includes('rate') || error.message.includes('Too Many')) {
          const waitSeconds = parseRateLimitWait(error.message) || 60;
          toast({
            variant: 'destructive',
            title: 'Sign up failed',
            description: `For security purposes, you can only request this after ${waitSeconds} seconds.`,
          });
        } else if (error.message.includes('already registered')) {
          toast({
            variant: 'destructive',
            title: 'Account exists',
            description: 'An account with this email already exists. Please log in instead.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Sign up failed',
            description: error.message,
          });
        }
        return;
      }
      
      toast({
        title: 'Account created!',
        description: 'Please check your email to verify your account.',
      });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'login') {
    return (
      <form onSubmit={handleLoginSubmit(onLoginSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              className="pl-10"
              {...loginRegister('email')}
            />
          </div>
          {loginErrors.email && (
            <p className="text-sm text-destructive">{loginErrors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link to="/auth/reset" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="pl-10 pr-10"
              {...loginRegister('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {loginErrors.password && (
            <p className="text-sm text-destructive">{loginErrors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSignUpSubmit(onSignUpSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-fullName">Full Name</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-fullName"
            type="text"
            placeholder="John Doe"
            className="pl-10"
            {...signUpRegister('fullName')}
          />
        </div>
        {signUpErrors.fullName && (
          <p className="text-sm text-destructive">{signUpErrors.fullName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            className="pl-10"
            {...signUpRegister('email')}
          />
        </div>
        {signUpErrors.email && (
          <p className="text-sm text-destructive">{signUpErrors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="pl-10 pr-10"
            {...signUpRegister('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {signUpErrors.password && (
          <p className="text-sm text-destructive">{signUpErrors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-confirmPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="pl-10"
            {...signUpRegister('confirmPassword')}
          />
        </div>
        {signUpErrors.confirmPassword && (
          <p className="text-sm text-destructive">{signUpErrors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          'Create Account'
        )}
      </Button>
    </form>
  );
}
