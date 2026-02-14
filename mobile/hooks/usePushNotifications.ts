import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';

let Notifications: any = null;
let Device: any = null;
let Constants: any = null;

// Lazy-load expo-notifications so the app doesn't crash if it's unavailable
try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
    Constants = require('expo-constants');
} catch (e) {
    console.log('[Push] expo-notifications not available');
}

// Configure how notifications appear when the app is in the foreground
if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
}

export function usePushNotifications() {
    const { user } = useAuth();
    const router = useRouter();
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [isRegistered, setIsRegistered] = useState(false);
    const notificationResponseRef = useRef<any>(null);
    const notificationReceivedRef = useRef<any>(null);

    // Register for push notifications
    const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
        if (!Notifications || !Device || !Constants) {
            console.log('[Push] Push notification modules not available');
            return null;
        }

        if (!Device.isDevice) {
            console.log('[Push] Must use physical device for push notifications');
            return null;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('[Push] Permission not granted');
                return null;
            }

            // Get project ID — gracefully handle missing config
            const projectId =
                Constants.expoConfig?.extra?.eas?.projectId ??
                Constants.default?.expoConfig?.extra?.eas?.projectId ??
                null;

            if (!projectId) {
                console.log('[Push] No projectId found — push notifications require an EAS build. Skipping registration.');
                return null;
            }

            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            const token = tokenData.data;

            // Android notification channels
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#F97316',
                    sound: 'default',
                    enableVibrate: true,
                    showBadge: true,
                });

                await Notifications.setNotificationChannelAsync('chat', {
                    name: 'Chat Messages',
                    description: 'Notifications for chat messages',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 100, 200, 100],
                    lightColor: '#3B82F6',
                    sound: 'default',
                    enableVibrate: true,
                    showBadge: true,
                });
            }

            return token;
        } catch (error) {
            console.log('[Push] Error registering (expected in Expo Go):', error);
            return null;
        }
    }, []);

    // Store token in Supabase
    const storeTokenInDatabase = useCallback(async (token: string) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: token,
                    is_active: true,
                }, {
                    onConflict: 'user_id,endpoint',
                });

            if (error) {
                console.log('[Push] Error storing token:', error.message);
            } else {
                console.log('[Push] Token stored successfully');
                setIsRegistered(true);
            }
        } catch (error) {
            console.log('[Push] Error storing token:', error);
        }
    }, [user]);

    // Handle notification tap (deep linking)
    const handleNotificationResponse = useCallback((response: any) => {
        try {
            const data = response?.notification?.request?.content?.data;
            if (!data?.url) return;

            const url = data.url as string;

            if (url.includes('/chat')) {
                if (url.includes('dm=')) {
                    const dmId = url.split('dm=')[1];
                    router.push({
                        pathname: '/(tabs)/chat',
                        params: { dm: dmId },
                    } as any);
                } else if (url.includes('channel=')) {
                    const channelId = url.split('channel=')[1];
                    router.push({
                        pathname: '/(tabs)/chat',
                        params: { channel: channelId },
                    } as any);
                } else {
                    router.push('/(tabs)/chat');
                }
            } else if (url.includes('/tasks/')) {
                const taskId = url.split('/tasks/')[1];
                if (taskId) {
                    router.push(`/task/${taskId}` as any);
                }
            } else {
                router.push('/(tabs)');
            }
        } catch (error) {
            console.log('[Push] Error handling notification response:', error);
        }
    }, [router]);

    // Initialize push notifications
    useEffect(() => {
        if (!user || !Notifications) return;

        const setup = async () => {
            const token = await registerForPushNotifications();
            if (token) {
                setExpoPushToken(token);
                await storeTokenInDatabase(token);
            }
        };

        setup();

        // Listen for incoming notifications (foreground)
        if (Notifications.addNotificationReceivedListener) {
            notificationReceivedRef.current = Notifications.addNotificationReceivedListener(
                (notification: any) => {
                    console.log('[Push] Notification received:', notification?.request?.content?.title);
                }
            );
        }

        // Listen for notification taps
        if (Notifications.addNotificationResponseReceivedListener) {
            notificationResponseRef.current = Notifications.addNotificationResponseReceivedListener(
                handleNotificationResponse
            );
        }

        return () => {
            // Safely remove subscriptions
            try {
                if (notificationReceivedRef.current?.remove) {
                    notificationReceivedRef.current.remove();
                }
                if (notificationResponseRef.current?.remove) {
                    notificationResponseRef.current.remove();
                }
            } catch (e) {
                // Silently ignore cleanup errors
            }
        };
    }, [user, registerForPushNotifications, storeTokenInDatabase, handleNotificationResponse]);

    // Deactivate token on sign out
    const deactivateToken = useCallback(async () => {
        if (!user || !expoPushToken) return;

        try {
            await supabase
                .from('push_subscriptions')
                .update({ is_active: false })
                .eq('user_id', user.id)
                .eq('endpoint', expoPushToken);
        } catch (error) {
            console.log('[Push] Error deactivating token:', error);
        }
    }, [user, expoPushToken]);

    return {
        expoPushToken,
        isRegistered,
        registerForPushNotifications,
        deactivateToken,
    };
}
