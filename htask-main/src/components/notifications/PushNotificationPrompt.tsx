import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Bell, BellRing, X, Smartphone, Clock, Zap } from 'lucide-react';
import { usePushNotifications, useSoftDecline } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface PushNotificationPromptProps {
  /** Trigger to show the prompt - can be controlled externally */
  trigger?: 'pwa_install' | 'first_task' | 'task_assigned' | 'settings' | 'manual';
  /** Force show the prompt (overrides automatic logic) */
  forceShow?: boolean;
  onClose?: () => void;
}

export function PushNotificationPrompt({
  trigger,
  forceShow = false,
  onClose,
}: PushNotificationPromptProps) {
  const { user } = useAuth();
  const {
    permission,
    isSubscribed,
    isStandalone,
    isIOS,
    canRequestPermission,
    softDeclinedRecently,
    isLoading,
    subscribe,
  } = usePushNotifications();
  const { recordSoftDecline } = useSoftDecline();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Determine if we should show the prompt
  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      return;
    }

    // Don't show if already subscribed or permission denied
    if (isSubscribed || permission === 'denied' || permission === 'granted') {
      return;
    }

    // Don't show if recently soft-declined
    if (softDeclinedRecently && trigger !== 'settings') {
      return;
    }

    // Don't show if can't request permission
    if (!canRequestPermission) {
      return;
    }

    // Show based on trigger
    if (trigger === 'pwa_install' && isStandalone) {
      // Delay slightly after PWA install
      const timer = setTimeout(() => setIsOpen(true), 2000);
      return () => clearTimeout(timer);
    }

    if (trigger === 'first_task' || trigger === 'task_assigned') {
      setIsOpen(true);
    }

    if (trigger === 'settings' || trigger === 'manual') {
      setIsOpen(true);
    }
  }, [
    trigger,
    forceShow,
    isSubscribed,
    permission,
    softDeclinedRecently,
    canRequestPermission,
    isStandalone,
  ]);

  const handleEnable = async () => {
    setIsSubscribing(true);
    const success = await subscribe();
    setIsSubscribing(false);

    if (success) {
      setIsOpen(false);
      onClose?.();
    }
  };

  const handleDismiss = () => {
    recordSoftDecline(user?.id);
    setIsOpen(false);
    onClose?.();
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  // iOS Safari (not standalone) - show install prompt instead
  if (isIOS && !isStandalone && !forceShow) {
    return null;
  }

  // Can't show if permission not available
  if (!canRequestPermission && !forceShow) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl px-6 pb-8 bg-gradient-to-b from-background to-muted/30"
      >
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center shadow-lg ring-1 ring-primary/20">
                <BellRing className="h-7 w-7 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold">
                  Enable Notifications
                </SheetTitle>
                <SheetDescription className="text-sm">
                  Stay on top of your tasks
                </SheetDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-muted"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {/* Benefits */}
        <div className="space-y-3 my-6">
          {[
            {
              icon: Zap,
              text: 'Instant alerts when tasks are assigned',
              color: 'bg-yellow-500/10 text-yellow-600',
            },
            {
              icon: Clock,
              text: 'Deadline reminders so you never miss due dates',
              color: 'bg-blue-500/10 text-blue-600',
            },
            {
              icon: Smartphone,
              text: 'Works even when the app is closed',
              color: 'bg-green-500/10 text-green-600',
            },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div
                className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                  item.color
                )}
              >
                <item.icon className="h-4 w-4" />
              </div>
              <span className="text-muted-foreground">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Permission denied state */}
        {permission === 'denied' && (
          <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">
            <p className="font-medium">Notifications are blocked</p>
            <p className="text-xs mt-1 opacity-80">
              You'll need to enable them in your browser settings to receive notifications.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleEnable}
            disabled={isLoading || isSubscribing || permission === 'denied'}
            className="w-full h-14 rounded-2xl text-base font-semibold brand-gradient shadow-lg hover:shadow-xl transition-all"
          >
            {isSubscribing ? (
              <>
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Enabling...
              </>
            ) : (
              <>
                <Bell className="mr-2 h-5 w-5" />
                Enable Notifications
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="w-full h-12 rounded-xl text-muted-foreground hover:text-foreground"
          >
            Maybe Later
          </Button>
        </div>

        {/* Privacy note */}
        <p className="text-xs text-center text-muted-foreground mt-4">
          You can change this anytime in Settings → Notifications
        </p>
      </SheetContent>
    </Sheet>
  );
}

// Minimal inline banner for settings page
export function PushNotificationBanner({ className }: { className?: string }) {
  const {
    permission,
    isSubscribed,
    canRequestPermission,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleToggle = async () => {
    setIsProcessing(true);
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
    setIsProcessing(false);
  };

  if (!canRequestPermission && !isSubscribed) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 p-4 rounded-2xl',
        isSubscribed
          ? 'bg-gradient-to-r from-success/10 to-success/5 border border-success/20'
          : 'bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center',
            isSubscribed ? 'bg-success/20' : 'bg-primary/20'
          )}
        >
          {isSubscribed ? (
            <BellRing className="h-5 w-5 text-success" />
          ) : (
            <Bell className="h-5 w-5 text-primary" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold">
            {isSubscribed ? 'Push Notifications Enabled' : 'Enable Push Notifications'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isSubscribed
              ? "You'll receive alerts on this device"
              : 'Get instant task updates'}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={isSubscribed ? 'outline' : 'default'}
        className={cn(
          'rounded-full px-4',
          !isSubscribed && 'brand-gradient'
        )}
        onClick={handleToggle}
        disabled={isLoading || isProcessing || permission === 'denied'}
      >
        {isProcessing ? (
          <div className="h-4 w-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        ) : isSubscribed ? (
          'Disable'
        ) : (
          'Enable'
        )}
      </Button>
    </div>
  );
}
