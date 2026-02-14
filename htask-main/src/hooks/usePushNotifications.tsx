import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

interface PushNotificationState {
  permission: PermissionState;
  isSubscribed: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  canRequestPermission: boolean;
  softDeclinedRecently: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UsePushNotificationsReturn extends PushNotificationState {
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

// VAPID public key endpoint
const VAPID_ENDPOINT = 'https://hxbkqbvmyrfggkoybugz.supabase.co/functions/v1/get-vapid-public-key';

// Convert base64 to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Detect platform
function detectPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/mac/.test(ua)) return 'macos';
  if (/win/.test(ua)) return 'windows';
  if (/linux/.test(ua)) return 'linux';
  return 'unknown';
}

// Check if running as standalone PWA
function isStandalonePWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// Check if iOS
function isIOSDevice(): boolean {
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}

// Check if push is supported
function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSubscribed: false,
    isStandalone: false,
    isIOS: false,
    canRequestPermission: false,
    softDeclinedRecently: false,
    isLoading: true,
    error: null,
  });

  // Initialize state
  useEffect(() => {
    const isStandalone = isStandalonePWA();
    const isIOS = isIOSDevice();
    const supported = isPushSupported();
    
    let permission: PermissionState = 'unsupported';
    if (supported) {
      permission = Notification.permission as PermissionState;
    }

    // Check soft decline cooldown (7 days)
    let softDeclinedRecently = false;
    const softDeclinedAt = localStorage.getItem('push-soft-declined-at');
    if (softDeclinedAt) {
      const declinedTime = parseInt(softDeclinedAt, 10);
      softDeclinedRecently = Date.now() - declinedTime < 7 * 24 * 60 * 60 * 1000;
    }

    // Can request if:
    // - Push is supported
    // - Not already denied
    // - For iOS: must be standalone PWA
    const canRequest = 
      supported && 
      permission !== 'denied' &&
      (!isIOS || isStandalone);

    setState(prev => ({
      ...prev,
      permission,
      isStandalone,
      isIOS,
      canRequestPermission: canRequest,
      softDeclinedRecently,
      isLoading: false,
    }));
  }, []);

  // Check if already subscribed
  const checkSubscription = useCallback(async () => {
    if (!user || !isPushSupported()) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Verify subscription exists in database
        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .eq('is_active', true)
          .single();

        setState(prev => ({
          ...prev,
          isSubscribed: !!data,
        }));
      } else {
        setState(prev => ({ ...prev, isSubscribed: false }));
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'User not authenticated' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      setState(prev => ({ 
        ...prev, 
        permission: permission as PermissionState,
        canRequestPermission: permission !== 'denied',
      }));

      if (permission !== 'granted') {
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          error: permission === 'denied' ? 'Notifications blocked' : 'Permission not granted'
        }));
        return false;
      }

      // Get VAPID public key from edge function
      const vapidResponse = await fetch(VAPID_ENDPOINT);
      if (!vapidResponse.ok) {
        throw new Error('Failed to get VAPID key');
      }
      const { publicKey } = await vapidResponse.json();

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push manager
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Extract subscription details
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');

      if (!p256dhKey || !authKey) {
        throw new Error('Failed to get subscription keys');
      }

      // Convert keys to base64
      const p256dhArray = new Uint8Array(p256dhKey);
      const authArray = new Uint8Array(authKey);
      const p256dhBase64 = btoa(String.fromCharCode.apply(null, Array.from(p256dhArray)));
      const authBase64 = btoa(String.fromCharCode.apply(null, Array.from(authArray)));

      const platform = detectPlatform();

      // Deactivate stale subscriptions on the same platform (endpoint rotation cleanup)
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('platform', platform)
        .neq('endpoint', subscription.endpoint);

      // Save to database
      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: p256dhBase64,
          auth: authBase64,
          platform,
          user_agent: navigator.userAgent,
          is_active: true,
          failed_count: 0,
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (dbError) throw dbError;

      // Update push_enabled on ALL notification_preferences rows for this user
      await supabase
        .from('notification_preferences')
        .update({ push_enabled: true })
        .eq('user_id', user.id);

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        error: null,
      }));

      console.log('Push subscription successful');
      return true;
    } catch (error: any) {
      console.error('Push subscription error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to subscribe to notifications',
      }));
      return false;
    }
  }, [user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      // Check if user has any remaining active subscriptions
      const { data: remaining } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      // If no remaining subscriptions, disable push_enabled on all preferences
      if (!remaining || remaining.length === 0) {
        await supabase
          .from('notification_preferences')
          .update({ push_enabled: false })
          .eq('user_id', user.id);
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      console.log('Push unsubscription successful');
    } catch (error: any) {
      console.error('Push unsubscription error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to unsubscribe',
      }));
    }
  }, [user]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    checkSubscription,
  };
}

// Helper hook to record soft decline
export function useSoftDecline() {
  const recordSoftDecline = useCallback(async (userId?: string) => {
    localStorage.setItem('push-soft-declined-at', Date.now().toString());
    
    if (userId) {
      // Also save to database for cross-device sync
      await supabase
        .from('notification_preferences')
        .update({ push_soft_declined_at: new Date().toISOString() })
        .eq('user_id', userId);
    }
  }, []);

  return { recordSoftDecline };
}
