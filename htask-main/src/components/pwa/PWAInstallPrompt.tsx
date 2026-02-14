import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { 
  Download, 
  Share, 
  PlusSquare, 
  X, 
  Smartphone,
  CheckCircle2
} from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { cn } from '@/lib/utils';
import logoLight from '@/assets/logo-light.png';

interface PWAInstallPromptProps {
  showOnMount?: boolean;
  delay?: number;
}

export function PWAInstallPrompt({ showOnMount = true, delay = 3000 }: PWAInstallPromptProps) {
  const { isInstallable, isInstalled, isIOS, isStandalone, promptInstall } = usePWAInstall();
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenDismissed, setHasBeenDismissed] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setHasBeenDismissed(true);
        return;
      }
    }

    // Show prompt after delay
    if (showOnMount && !isStandalone && !isInstalled && !hasBeenDismissed) {
      const timer = setTimeout(() => {
        if (isInstallable || isIOS) {
          setIsOpen(true);
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [showOnMount, delay, isInstallable, isInstalled, isStandalone, isIOS, hasBeenDismissed]);

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      setIsOpen(false);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    setHasBeenDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or in standalone mode
  if (isInstalled || isStandalone) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8">
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-lg">
                <img src={logoLight} alt="Hamro Task" className="h-10 w-auto" />
              </div>
              <div>
                <SheetTitle className="text-lg">Install Hamro Task</SheetTitle>
                <SheetDescription className="text-sm">
                  Get the full app experience
                </SheetDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleDismiss}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {/* Benefits */}
        <div className="space-y-3 my-6">
          {[
            { icon: Smartphone, text: 'Works offline & loads instantly' },
            { icon: Download, text: 'Quick access from home screen' },
            { icon: CheckCircle2, text: 'Push notifications for updates' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                <item.icon className="h-4 w-4 text-success" />
              </div>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Install Instructions */}
        {isIOS ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-medium">
              To install on your iPhone/iPad:
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  1
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>Tap the</span>
                  <Share className="h-5 w-5 text-primary" />
                  <span className="font-medium">Share button</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  2
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>Scroll and tap</span>
                  <PlusSquare className="h-5 w-5 text-primary" />
                  <span className="font-medium">"Add to Home Screen"</span>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl mt-2"
              onClick={handleDismiss}
            >
              Got it
            </Button>
          </div>
        ) : (
          <Button 
            onClick={handleInstall}
            className="w-full h-14 rounded-2xl text-base font-semibold brand-gradient shadow-lg hover:shadow-xl transition-all"
          >
            <Download className="mr-2 h-5 w-5" />
            Install App
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Mini banner for inline prompts
export function PWAInstallBanner({ className }: { className?: string }) {
  const { isInstallable, isInstalled, isStandalone, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isInstallable || isInstalled || isStandalone || isDismissed) return null;

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20',
      className
    )}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-card flex items-center justify-center shadow-sm">
          <img src={logoLight} alt="" className="h-7 w-auto" />
        </div>
        <div>
          <p className="text-sm font-semibold">Install Hamro Task</p>
          <p className="text-xs text-muted-foreground">Add to home screen for quick access</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setIsDismissed(true)}
        >
          Later
        </Button>
        <Button
          size="sm"
          className="rounded-full brand-gradient text-xs px-4"
          onClick={promptInstall}
        >
          Install
        </Button>
      </div>
    </div>
  );
}
