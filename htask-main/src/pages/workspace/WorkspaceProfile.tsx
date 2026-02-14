import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileAvatarUpload } from '@/components/profile/ProfileAvatarUpload';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import {
  User,
  Mail,
  Download,
  LogOut,
  Loader2,
  Save,
} from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export default function WorkspaceProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);

  // PWA install detection
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredPrompt(null);
    };

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPwaInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setProfile(data);
      setFullName(data.full_name || '');
      setIsLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() || null })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Profile updated!' });
      setProfile((prev) => prev && { ...prev, full_name: fullName.trim() || null });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast({ title: 'Hamro Task installed!' });
    }
    setDeferredPrompt(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto lg:pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="pb-4">
          <ProfileAvatarUpload
            avatarUrl={profile?.avatar_url || null}
            fullName={profile?.full_name || null}
            email={profile?.email || ''}
            onAvatarChange={(url) => setProfile(prev => prev ? { ...prev, avatar_url: url } : null)}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Full Name
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your name"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input value={profile?.email || ''} disabled className="bg-muted rounded-xl" />
          </div>
          <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full sm:w-auto rounded-xl">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>


      {/* Notification Preferences */}
      <NotificationPreferences />

      {/* Install PWA */}
      {!isPwaInstalled && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 rounded-2xl">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Install Hamro Task</p>
                <p className="text-sm text-muted-foreground">Add to your home screen</p>
              </div>
            </div>
            <Button onClick={handleInstallPwa} disabled={!deferredPrompt} className="w-full sm:w-auto rounded-xl">
              Install
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sign Out */}
      <Card className="border-destructive/30 rounded-2xl">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <LogOut className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-destructive">Sign Out</p>
              <p className="text-sm text-muted-foreground">Log out of your account</p>
            </div>
          </div>
          <Button variant="destructive" onClick={handleSignOut} className="w-full sm:w-auto rounded-xl">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
