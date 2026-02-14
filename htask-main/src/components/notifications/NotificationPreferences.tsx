import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  BellRing,
  BellOff,
  CheckSquare,
  MessageSquare,
  FolderKanban,
  UserPlus,
  Clock,
  ArrowRight,
  Moon,
  Smartphone,
  Globe,
  Send,
  Loader2,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useNotifications, NotificationPreferences as PrefsType } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// Timezone options
const TIMEZONES = [
  { value: 'Asia/Kathmandu', label: 'Nepal (UTC+5:45)' },
  { value: 'Asia/Kolkata', label: 'India (UTC+5:30)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (UTC+6)' },
  { value: 'Asia/Shanghai', label: 'China (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Japan (UTC+9)' },
  { value: 'Asia/Dubai', label: 'UAE (UTC+4)' },
  { value: 'Europe/London', label: 'London (UTC+0)' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+1)' },
  { value: 'America/New_York', label: 'New York (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8)' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+11)' },
];

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

interface ToggleRowProps {
  icon: typeof Bell;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  iconColor: string;
  disabled?: boolean;
}

function ToggleRow({ icon: Icon, label, description, checked, onCheckedChange, iconColor, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3 px-3 sm:px-4 rounded-xl hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <Label className="text-sm font-medium cursor-pointer">{label}</Label>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function NotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { preferences, updatePreferences, isLoading } = useNotifications();
  const {
    permission,
    isSubscribed,
    canRequestPermission,
    isIOS,
    isStandalone,
    isLoading: pushLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();
  const [isSendingTest, setIsSendingTest] = useState(false);

  const prefs = preferences || {
    id: '', user_id: '', workspace_id: '',
    task_assigned: true, task_status_changed: true, task_completed: true,
    comment_added: true, comment_reply: true, project_updates: true,
    member_updates: false, chat_mentions: true, due_date_reminders: true,
    push_enabled: false, quiet_hours_enabled: true,
    quiet_hours_start: 22, quiet_hours_end: 7,
    timezone: 'Asia/Kathmandu',
    created_at: '', updated_at: '',
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      await subscribe();
    } else {
      await unsubscribe();
    }
  };

  const handleSendTestPush = async () => {
    if (!user) return;
    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          notification: {
            title: '🔔 Test Notification',
            body: 'Push notifications are working! You\'ll receive alerts like this.',
            url: '/',
            tag: 'test-notification',
          },
        },
      });
      if (error) throw error;
      toast({ title: 'Test push sent!', description: 'Check your notification tray.' });
    } catch (err: any) {
      toast({ title: 'Failed to send test', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const canShowPush = canRequestPermission || isSubscribed || permission === 'denied';

  const taskNotifications = [
    { key: 'task_assigned', icon: CheckSquare, label: 'Task Assigned', description: 'When a task is assigned to you', color: 'bg-primary/10 text-primary' },
    { key: 'task_status_changed', icon: ArrowRight, label: 'Status Changed', description: 'When task status is updated', color: 'bg-blue-500/10 text-blue-500' },
    { key: 'task_completed', icon: CheckSquare, label: 'Task Completed', description: 'When a task is marked done', color: 'bg-green-500/10 text-green-500' },
    { key: 'due_date_reminders', icon: Clock, label: 'Due Date Reminders', description: 'Daily reminders for overdue & due-today tasks', color: 'bg-amber-500/10 text-amber-500' },
  ];

  const socialNotifications = [
    { key: 'comment_added', icon: MessageSquare, label: 'New Comments', description: 'Comments on your tasks', color: 'bg-sky-500/10 text-sky-500' },
    { key: 'comment_reply', icon: MessageSquare, label: 'Replies', description: 'Replies to your comments', color: 'bg-purple-500/10 text-purple-500' },
    { key: 'chat_mentions', icon: MessageSquare, label: 'Chat Messages', description: 'DMs and channel messages', color: 'bg-pink-500/10 text-pink-500' },
  ];

  const workspaceNotifications = [
    { key: 'project_updates', icon: FolderKanban, label: 'Project Updates', description: 'Project creation & changes', color: 'bg-emerald-500/10 text-emerald-500' },
    { key: 'member_updates', icon: UserPlus, label: 'Member Updates', description: 'When members join or leave', color: 'bg-violet-500/10 text-violet-500' },
  ];

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="space-y-1"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-40" /></div>
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Push Notifications Card */}
      {canShowPush && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              Push Notifications
              {isSubscribed && (
                <Badge variant="secondary" className="ml-auto text-xs bg-green-500/10 text-green-600 border-green-500/20">
                  Active
                </Badge>
              )}
              {permission === 'denied' && (
                <Badge variant="destructive" className="ml-auto text-xs">
                  Blocked
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Receive native notifications even when the app is closed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main push toggle */}
            <div className={cn(
              'flex items-center justify-between p-4 rounded-2xl border transition-colors',
              isSubscribed
                ? 'bg-green-500/5 border-green-500/20'
                : 'bg-muted/30 border-border'
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center',
                  isSubscribed ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'
                )}>
                  {isSubscribed ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {isSubscribed ? 'Push enabled on this device' : 'Enable push notifications'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {permission === 'denied'
                      ? 'Unblock in your browser/device settings'
                      : isSubscribed
                        ? 'You\'ll get alerts for tasks, comments & more'
                        : 'Tap to allow browser notifications'}
                  </p>
                </div>
              </div>
              <Switch
                checked={isSubscribed}
                onCheckedChange={handlePushToggle}
                disabled={pushLoading || permission === 'denied'}
              />
            </div>

            {/* iOS install warning */}
            {isIOS && !isStandalone && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">📱 Install for push support</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add Hamro Task to your Home Screen (Share → Add to Home Screen) to receive push notifications on iOS.
                </p>
              </div>
            )}

            {/* Test push button */}
            {isSubscribed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendTestPush}
                disabled={isSendingTest}
                className="w-full rounded-xl"
              >
                {isSendingTest ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Send Test Notification</>
                )}
              </Button>
            )}

            {/* Quiet Hours */}
            {isSubscribed && (
              <>
                <Separator />
                <div className="space-y-3">
                  <ToggleRow
                    icon={Moon}
                    label="Quiet Hours"
                    description="Mute push notifications during set hours"
                    checked={prefs.quiet_hours_enabled ?? true}
                    onCheckedChange={(v) => updatePreferences({ quiet_hours_enabled: v })}
                    iconColor="bg-indigo-500/10 text-indigo-500"
                  />
                  {prefs.quiet_hours_enabled && (
                    <div className="pl-12 pr-4 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                          <Select
                            value={String(prefs.quiet_hours_start ?? 22)}
                            onValueChange={(v) => updatePreferences({ quiet_hours_start: parseInt(v) })}
                          >
                            <SelectTrigger className="w-[120px] h-9 rounded-lg text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>{formatHour(i)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <span className="text-xs text-muted-foreground">to</span>
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <Select
                            value={String(prefs.quiet_hours_end ?? 7)}
                            onValueChange={(v) => updatePreferences({ quiet_hours_end: parseInt(v) })}
                          >
                            <SelectTrigger className="w-[120px] h-9 rounded-lg text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>{formatHour(i)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Timezone */}
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Select
                          value={prefs.timezone ?? 'Asia/Kathmandu'}
                          onValueChange={(v) => updatePreferences({ timezone: v } as any)}
                        >
                          <SelectTrigger className="h-9 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* In-App Notification Types */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
              <Bell className="h-5 w-5 text-sky-600" />
            </div>
            Notification Types
          </CardTitle>
          <CardDescription>
            Choose which events trigger notifications in this workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Tasks Section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">Tasks</h4>
            <div className="space-y-0.5">
              {taskNotifications.map((item) => (
                <ToggleRow
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  checked={prefs[item.key as keyof typeof prefs] as boolean}
                  onCheckedChange={(v) => updatePreferences({ [item.key]: v })}
                  iconColor={item.color}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* Social Section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">Comments & Chat</h4>
            <div className="space-y-0.5">
              {socialNotifications.map((item) => (
                <ToggleRow
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  checked={prefs[item.key as keyof typeof prefs] as boolean}
                  onCheckedChange={(v) => updatePreferences({ [item.key]: v })}
                  iconColor={item.color}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* Workspace Section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">Workspace</h4>
            <div className="space-y-0.5">
              {workspaceNotifications.map((item) => (
                <ToggleRow
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  checked={prefs[item.key as keyof typeof prefs] as boolean}
                  onCheckedChange={(v) => updatePreferences({ [item.key]: v })}
                  iconColor={item.color}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
