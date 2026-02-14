import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckSquare, Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ResetFormData = z.infer<typeof resetSchema>;

export default function AuthReset() {
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const form = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ResetFormData) => {
    setIsLoading(true);

    try {
      const { error } = await resetPassword(data.email);
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Reset failed',
          description: error.message,
        });
        return;
      }

      setIsEmailSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <header className="p-6">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <CheckSquare className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-xl">TaskFlow</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            {isEmailSent ? (
              <>
                <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                <CardDescription>
                  We've sent a password reset link to your email address. Please check your inbox.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
                <CardDescription>
                  Enter your email address and we'll send you a link to reset your password.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {isEmailSent ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsEmailSent(false)}
                >
                  Try again
                </Button>
                <Link to="/auth" className="block">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to sign in
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      {...form.register('email')}
                    />
                  </div>
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>

                <Link to="/auth" className="block">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to sign in
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} TaskFlow. All rights reserved.</p>
      </footer>
    </div>
  );
}
