import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
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
    Zap,
    Bot,
    Sun,
    Moon,
    Monitor,
    Sparkles,
    ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

import { DashboardHeader } from '@/components/DashboardHeader';
import { GlobalTabBar } from '@/components/GlobalTabBar';

const { width } = Dimensions.get('window');
const COLS = 4;
const H_PAD = 20;
const GAP = 12;
const ITEM_W = (width - H_PAD * 2 - GAP * (COLS - 1)) / COLS;

const GRID_ITEMS = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard, route: '/(tabs)', color: '#3B82F6', bg: '#EFF6FF' },
    { id: 'projects', label: 'Projects', icon: FolderKanban, route: '/(tabs)/projects', color: '#8B5CF6', bg: '#F5F3FF' },
    { id: 'tasks', label: 'My Tasks', icon: CheckSquare, route: '/(tabs)/tasks', color: '#F97316', bg: '#FFF7ED' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, route: '/(tabs)/chat', color: '#10B981', bg: '#ECFDF5' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, route: '/(tabs)/calendar', color: '#6366F1', bg: '#EEF2FF' },
    { id: 'members', label: 'Team', icon: Users, route: '/members', color: '#EC4899', bg: '#FDF2F8' },
    { id: 'profile', label: 'Profile', icon: User, route: '/profile', color: '#06B6D4', bg: '#ECFEFF' },
    { id: 'activity', label: 'Activity', icon: Zap, route: '/activity-log', color: '#F59E0B', bg: '#FFFBEB' },
];

export default function MenuScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { signOut } = useAuth();
    const { theme, colorScheme, setTheme, colors } = useTheme();

    const nav = (route: string) => router.push(route as any);

    const handleSignOut = async () => {
        await signOut();
        router.replace('/auth');
    };

    const cycleTheme = () => {
        setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system');
    };

    const ThemeIcon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;
    const themeLabel = theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark';
    const isDark = colorScheme === 'dark';

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <DashboardHeader showBack />

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* ─── AI Assistant — Subtle Inline Card ─── */}
                <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.aiSection}>
                    <TouchableOpacity
                        style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => nav('/ai-assistant')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.aiIconWrap, isDark && { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                            <Bot size={20} color={isDark ? '#FFFFFF' : '#6366F1'} />
                        </View>
                        <View style={styles.aiTextCol}>
                            <Text style={[styles.aiTitle, { color: colors.text }]}>AI Assistant</Text>
                            <Text style={[styles.aiSub, { color: colors.textTertiary }]}>Ask anything about your workspace</Text>
                        </View>
                        <View style={[styles.aiBadge, isDark && { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                            <Sparkles size={10} color={isDark ? '#A5B4FC' : '#6366F1'} />
                            <Text style={[styles.aiBadgeText, isDark && { color: '#A5B4FC' }]}>NEW</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                </Animated.View>

                {/* ─── 4-Column Grid ─── */}
                <View style={styles.grid}>
                    {GRID_ITEMS.map((item, i) => (
                        <Animated.View key={item.id} entering={FadeInDown.delay(80 + i * 40).springify()}>
                            <TouchableOpacity
                                style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
                                onPress={() => nav(item.route)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.gridIcon, { backgroundColor: isDark ? item.color + '15' : item.bg }]}>
                                    <item.icon size={22} color={isDark ? '#FFFFFF' : item.color} />
                                </View>
                                <Text style={[styles.gridLabel, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    ))}
                </View>

                {/* ─── Fixed Bottom Row: Theme · Settings · Logout ─── */}
                <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.bottomSection}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>QUICK ACTIONS</Text>
                    <View style={[styles.bottomRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {/* Theme */}
                        <TouchableOpacity style={styles.bottomItem} onPress={cycleTheme} activeOpacity={0.7}>
                            <View style={[styles.bottomIcon, { backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : '#F5F3FF' }]}>
                                <ThemeIcon size={18} color={isDark ? '#FFFFFF' : '#8B5CF6'} />
                            </View>
                            <Text style={[styles.bottomLabel, { color: colors.text }]}>{themeLabel}</Text>
                            <Text style={[styles.bottomHint, { color: colors.textTertiary }]}>Theme</Text>
                        </TouchableOpacity>

                        <View style={[styles.bottomDivider, { backgroundColor: colors.border }]} />

                        {/* Settings */}
                        <TouchableOpacity style={styles.bottomItem} onPress={() => nav('/settings')} activeOpacity={0.7}>
                            <View style={[styles.bottomIcon, { backgroundColor: isDark ? 'rgba(100,116,139,0.15)' : '#F1F5F9' }]}>
                                <Settings size={18} color={isDark ? '#FFFFFF' : '#64748B'} />
                            </View>
                            <Text style={[styles.bottomLabel, { color: colors.text }]}>Settings</Text>
                            <Text style={[styles.bottomHint, { color: colors.textTertiary }]}>Prefs</Text>
                        </TouchableOpacity>

                        <View style={[styles.bottomDivider, { backgroundColor: colors.border }]} />

                        {/* Logout */}
                        <TouchableOpacity style={styles.bottomItem} onPress={handleSignOut} activeOpacity={0.7}>
                            <View style={[styles.bottomIcon, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }]}>
                                <LogOut size={18} color={isDark ? '#FCA5A5' : '#EF4444'} />
                            </View>
                            <Text style={[styles.bottomLabel, { color: '#EF4444' }]}>Log Out</Text>
                            <Text style={[styles.bottomHint, { color: colors.textTertiary }]}>Exit</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Version */}
                <Text style={[styles.versionText, { color: colors.textMuted }]}>v1.0.0 • Hamro Task</Text>
            </ScrollView>

            <GlobalTabBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 16,
        paddingBottom: 40,
    },

    // ─── AI Card ───
    aiSection: {
        paddingHorizontal: H_PAD,
        marginBottom: 20,
    },
    aiCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
            android: { elevation: 2 },
        }),
    },
    aiIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiTextCol: {
        flex: 1,
    },
    aiTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    aiSub: {
        fontSize: 12,
        fontWeight: '400',
        marginTop: 1,
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8,
    },
    aiBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#6366F1',
        letterSpacing: 0.5,
    },

    // ─── Grid ───
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: H_PAD,
        gap: GAP,
    },
    gridItem: {
        width: ITEM_W,
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 4,
        borderRadius: 18,
        borderWidth: 1,
        ...Platform.select({
            ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
            android: { elevation: 1 },
        }),
    },
    gridIcon: {
        width: 46,
        height: 46,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    gridLabel: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },

    // ─── Bottom Fixed Row ───
    bottomSection: {
        paddingHorizontal: H_PAD,
        marginTop: 24,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 10,
        marginLeft: 4,
    },
    bottomRow: {
        flexDirection: 'row',
        borderRadius: 18,
        borderWidth: 1,
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
            android: { elevation: 2 },
        }),
    },
    bottomItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        gap: 6,
    },
    bottomIcon: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    bottomHint: {
        fontSize: 10,
        fontWeight: '500',
    },
    bottomDivider: {
        width: 1,
        marginVertical: 12,
    },

    // ─── Version ───
    versionText: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 24,
    },
});
