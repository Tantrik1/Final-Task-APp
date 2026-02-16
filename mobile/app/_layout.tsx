import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef } from 'react';
import 'react-native-reanimated';
import '../global.css';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { FirstLoginPasswordPrompt } from '@/components/FirstLoginPasswordPrompt';
import { WorkspaceProvider } from '@/hooks/useWorkspace';

import { useColorScheme } from '@/components/useColorScheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Keep global for initial sync catch if needed, but better inside component for view controller safety
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  // Gracefully handle if already shown/prevented
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch (e) {
        // Silently handle if already shown
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, isLoading: authLoading, isRecoveryMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const lastCheckedUserId = useRef<string | null>(null);

  useEffect(() => {
    const handleNavigation = async () => {
      if (authLoading || isCheckingProfile) return;

      const inAuthGroup = segments[0] === "auth";
      const inInvitation = segments[0] === "invitation";

      if (!user) {
        lastCheckedUserId.current = null;
        if (!inAuthGroup) {
          router.replace("/auth");
        }
      } else {
        // Recovery Mode Check (Invitation links)
        if (isRecoveryMode) {
          setShowPasswordPrompt(true);
        }

        // Only run full check once per user session (not on every segment change)
        if (lastCheckedUserId.current === user.id) {
          // Already checked — only handle auth/onboarding redirects
          if (inAuthGroup) {
            router.replace("/(tabs)");
          }
          return;
        }

        // Authenticated - Check profile, invitations, and memberships
        setIsCheckingProfile(true);
        try {
          // 1. Check for needs_password_reset flag
          const { data: profile } = await supabase
            .from('profiles')
            .select('needs_password_reset')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.needs_password_reset) {
            setShowPasswordPrompt(true);
          }

          // 2. Check for pending invitations
          const { data: pendingInvitations } = await supabase
            .from('workspace_invitations')
            .select('id')
            .ilike('email', user.email || '')
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .limit(1);

          if (pendingInvitations && pendingInvitations.length > 0 && !inInvitation) {
            lastCheckedUserId.current = user.id;
            router.replace("/invitation" as any);
            return;
          }

          // 3. Check for workspace memberships (Onboarding check)
          const { data: memberships, error: memError } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .limit(1);

          lastCheckedUserId.current = user.id;

          if (!memError && (!memberships || memberships.length === 0)) {
            // No workspaces - go to onboarding
            if (segments[0] !== "onboarding") {
              router.replace("/onboarding");
            }
          } else if (inAuthGroup || segments[0] === "onboarding") {
            // Has workspaces and is in auth/onboarding - go to dashboard/tabs
            router.replace("/(tabs)");
          }
        } catch (error) {
          console.error("Profile/Membership check failed:", error);
          lastCheckedUserId.current = user.id;
          if (inAuthGroup) router.replace("/(tabs)");
        } finally {
          setIsCheckingProfile(false);
        }
      }
    };

    handleNavigation();
  }, [user, authLoading, segments, isRecoveryMode]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#FF5C00" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <WorkspaceProvider>
        <FirstLoginPasswordPrompt
          visible={showPasswordPrompt}
          onComplete={() => setShowPasswordPrompt(false)}
          onSkip={() => setShowPasswordPrompt(false)}
        />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth/index" options={{ headerShown: false }} />
          <Stack.Screen name="auth/reset" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="invitation" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="project/[id]" options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }} />
          <Stack.Screen name="task/[id]" options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }} />
          <Stack.Screen name="notifications" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }} />
          <Stack.Screen name="profile" options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }} />
          <Stack.Screen name="menu" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="activity-log" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', gestureEnabled: true, fullScreenGestureEnabled: true }} />
        </Stack>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
