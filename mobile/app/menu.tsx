import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    LayoutDashboard,
    FolderKanban,
    CheckSquare,
    Calendar,
    MessageSquare,
    Users,
    User,
    Settings,
    LogOut,
    ChevronRight,
    Briefcase,
    Zap,
    ArrowLeft
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';

import { DashboardHeader } from '@/components/DashboardHeader';
import { GlobalTabBar } from '@/components/GlobalTabBar';

const { width } = Dimensions.get('window');
const COLUMN_count = 2;
const GAP = 16;
const ITEM_WIDTH = (width - 40 - (GAP * (COLUMN_count - 1))) / COLUMN_count;

const MENU_ITEMS = [
    { id: 'dashboard', title: 'Dashboard', subtitle: 'Overview & Stats', icon: LayoutDashboard, route: '/(tabs)', color: '#3B82F6', bg: '#EFF6FF' },
    { id: 'projects', title: 'Projects', subtitle: 'Manage Work', icon: FolderKanban, route: '/(tabs)/projects', color: '#8B5CF6', bg: '#F5F3FF' },
    { id: 'tasks', title: 'My Tasks', subtitle: 'To-Do List', icon: CheckSquare, route: '/(tabs)/tasks', color: '#F97316', bg: '#FFF7ED' },
    { id: 'chat', title: 'Chat', subtitle: 'Team Comms', icon: MessageSquare, route: '/(tabs)/chat', color: '#10B981', bg: '#ECFDF5' },
    { id: 'calendar', title: 'Calendar', subtitle: 'Schedule', icon: Calendar, route: '/(tabs)/calendar', color: '#6366F1', bg: '#EEF2FF' },
    { id: 'members', title: 'Startups', subtitle: 'Manage Team', icon: Users, route: '/members', color: '#EC4899', bg: '#FDF2F8' },
    { id: 'profile', title: 'Profile', subtitle: 'Account Info', icon: User, route: '/profile', color: '#06B6D4', bg: '#ECFEFF' },
    { id: 'activity', title: 'Activity Log', subtitle: 'Team Updates', icon: Zap, route: '/activity-log', color: '#F97316', bg: '#FFF7ED' },
    { id: 'settings', title: 'Settings', subtitle: 'App Prefs', icon: Settings, route: '/settings', color: '#64748B', bg: '#F1F5F9' },
];

export default function MenuScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { currentWorkspace, currentRole } = useWorkspace();

    const handlePress = (route: string) => {
        if (route === '/(tabs)') {
            router.push('/(tabs)');
        } else {
            router.push(route as any);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        router.replace('/auth');
    };

    return (
        <View style={styles.container}>
            <DashboardHeader showBack />

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Grid Menu */}
                <View style={styles.gridContainer}>
                    {MENU_ITEMS.map((item, index) => (
                        <Animated.View
                            key={item.id}
                            entering={FadeInDown.delay(100 + (index * 50)).springify()}
                            layout={Layout.springify()}
                        >
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => handlePress(item.route)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
                                    <item.icon size={28} color={item.color} />
                                </View>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    ))}
                </View>

                {/* Footer Section */}
                <Animated.View
                    entering={FadeInDown.delay(500).springify()}
                    style={styles.footer}
                >
                    <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                        <LogOut size={20} color="#EF4444" />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>

                    <Text style={styles.versionText}>v1.0.0 • Hamro Task</Text>
                </Animated.View>
            </ScrollView>

            <GlobalTabBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        zIndex: 10,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    scrollContent: {
        paddingTop: 24,
        paddingBottom: 40,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: GAP,
    },
    card: {
        width: ITEM_WIDTH,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
    },
    footer: {
        paddingHorizontal: 20,
        marginTop: 32,
        alignItems: 'center',
        gap: 16,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 100,
        backgroundColor: '#FEF2F2',
        width: '100%',
        justifyContent: 'center',
    },
    signOutText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    versionText: {
        fontSize: 12,
        color: '#CBD5E1',
    },
});
