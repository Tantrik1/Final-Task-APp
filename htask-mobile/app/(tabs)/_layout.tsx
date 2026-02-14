import { Tabs } from 'expo-router';
import { View, Platform, StyleSheet } from 'react-native';
import {
    Home,
    FolderKanban,
    CheckSquare,
    MessageSquare,
    Calendar
} from 'lucide-react-native';
import { DashboardHeader } from '@/components/DashboardHeader';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function TabLayout() {
    usePushNotifications();

    return (
        <Tabs
            screenOptions={{
                headerShown: true,
                header: () => <DashboardHeader />,
                tabBarStyle: styles.tabBar,
                tabBarShowLabel: false,
                tabBarActiveTintColor: '#F97316',
                tabBarInactiveTintColor: '#94A3B8',
            }}
        >
            {/* 1. Calendar */}
            <Tabs.Screen
                name="calendar"
                options={{
                    tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
                }}
            />

            {/* 2. Dashboard */}
            <Tabs.Screen
                name="index"
                options={{
                    tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
                }}
            />

            {/* 3. My Tasks (Center Pop-up) */}
            <Tabs.Screen
                name="tasks"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View style={styles.centerButtonContainer}>
                            <View style={[styles.centerButton, focused && styles.centerButtonFocused]}>
                                <CheckSquare size={28} color="#FFFFFF" strokeWidth={2.5} />
                            </View>
                        </View>
                    ),
                }}
            />

            {/* 4. Projects */}
            <Tabs.Screen
                name="projects"
                options={{
                    tabBarIcon: ({ color, size }) => <FolderKanban size={size} color={color} />,
                }}
            />

            <Tabs.Screen
                name="chat"
                options={{
                    headerShown: false,
                    tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
                }}
            />

            {/* Hidden tabs (accessible from menu) */}
            <Tabs.Screen
                name="members"
                options={{
                    href: null,
                    // Header handled by screenOptions
                }}
            />
            <Tabs.Screen
                name="menu"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    href: null,
                    // Header handled by screenOptions
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    href: null,
                    // Header handled by screenOptions
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        height: Platform.OS === 'ios' ? 88 : 64,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    centerButtonContainer: {
        top: -16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    centerButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F97316',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    centerButtonFocused: {
        backgroundColor: '#EA580C', // Darker orange
        transform: [{ scale: 1.05 }],
    },
});
