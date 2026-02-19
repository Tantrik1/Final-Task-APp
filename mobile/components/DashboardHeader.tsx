import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Bell,
    ChevronDown,
    LogOut,
    Settings,
    User,
    Building2,
    Plus,
    Check,
    Menu,
    ArrowLeft
} from 'lucide-react-native';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

export function DashboardHeader({ showBack = false }: { showBack?: boolean }) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currentWorkspace, workspaces, setCurrentWorkspaceId } = useWorkspace();
    const { signOut, user } = useAuth();
    const { unreadCount } = useNotifications();
    const { colors, colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.id) return;
        supabase.from('profiles').select('avatar_url, full_name').eq('id', user.id).single()
            .then(({ data }) => {
                if (data) {
                    setUserAvatar(data.avatar_url);
                    setUserName(data.full_name);
                }
            });
    }, [user?.id]);

    const handleSignOut = async () => {
        setShowProfileMenu(false);
        await signOut();
        router.replace('/auth');
    };

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const InitialsAvatar = ({ name, size = 32 }: { name: string, size?: number }) => {
        const { colors } = useTheme();
        return (
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2.8,
                    backgroundColor: colors.accentBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: colors.accent + '25',
                }}
            >
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: size * 0.44 }}>
                    {name?.charAt(0).toUpperCase() || '?'}
                </Text>
            </View>
        );
    };

    return (
        <View style={[styles.container, {
            paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 4),
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
        }]}>
            {/* Top row: workspace + actions */}
            <View style={styles.topRow}>
                {/* Left: Back or Workspace */}
                {showBack ? (
                    <TouchableOpacity
                        style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => router.back()}
                    >
                        <ArrowLeft size={20} color={colors.text} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.workspaceButton, { backgroundColor: isDark ? colors.surface : colors.background, borderColor: colors.border }]}
                        onPress={() => setShowWorkspaceMenu(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.workspaceLogoWrap}>
                            {currentWorkspace?.logo_url ? (
                                <Image source={{ uri: currentWorkspace.logo_url }} style={styles.workspaceLogo} />
                            ) : (
                                <InitialsAvatar name={currentWorkspace?.name || 'W'} size={32} />
                            )}
                        </View>
                        <View style={styles.workspaceTextBlock}>
                            <Text style={[styles.workspaceGreeting, { color: colors.textTertiary }]}>
                                {getGreeting()}
                            </Text>
                            <Text style={[styles.workspaceUserName, { color: colors.text }]} numberOfLines={1}>
                                {userName || user?.email?.split('@')[0] || 'User'}
                            </Text>
                        </View>
                        <ChevronDown size={14} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                )}

                {/* Right: Actions */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: isDark ? colors.surface : colors.background, shadowColor: isDark ? '#000' : colors.shadow }]}
                        onPress={() => router.push('/notifications' as any)}
                        activeOpacity={0.8}
                    >
                        <Bell size={19} color={unreadCount > 0 ? colors.accent : colors.textTertiary} />
                        {unreadCount > 0 && (
                            <View style={[styles.notifBadge, { borderColor: colors.card }]}>
                                <Text style={styles.notifBadgeText}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.profileBtn, { shadowColor: isDark ? '#000' : colors.shadow }]}
                        onPress={() => setShowProfileMenu(true)}
                        activeOpacity={0.8}
                    >
                        {userAvatar ? (
                            <Image source={{ uri: userAvatar }} style={styles.profileAvatarImg} />
                        ) : (
                            <View style={[styles.profileAvatar, { backgroundColor: colors.accentBg }]}>
                                <User size={10} color={colors.accent} />
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: isDark ? colors.surface : colors.background, shadowColor: isDark ? '#000' : colors.shadow }]}
                        onPress={() => router.push('/menu' as any)}
                        activeOpacity={0.8}
                    >
                        <Menu size={19} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Workspace Menu Modal */}
            <Modal
                visible={showWorkspaceMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowWorkspaceMenu(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowWorkspaceMenu(false)}
                >
                    <View style={[styles.menuContainer, {
                        top: insets.top + 70,
                        left: 20,
                        backgroundColor: colors.card,
                        shadowColor: isDark ? '#000' : '#64748B',
                        borderColor: colors.border,
                    }]}>
                        <Text style={[styles.menuHeader, { color: colors.textTertiary }]}>Switch Workspace</Text>

                        {workspaces.map(ws => (
                            <TouchableOpacity
                                key={ws.id}
                                style={[
                                    styles.menuItem,
                                    currentWorkspace?.id === ws.id && { backgroundColor: colors.accentBg }
                                ]}
                                onPress={() => {
                                    setCurrentWorkspaceId(ws.id);
                                    setShowWorkspaceMenu(false);
                                }}
                            >
                                <View style={styles.menuItemLeft}>
                                    {ws.logo_url ? (
                                        <Image source={{ uri: ws.logo_url }} style={styles.smallLogo} />
                                    ) : (
                                        <View style={[styles.smallLogoPlaceholder, {
                                            backgroundColor: colors.surface,
                                            borderColor: colors.border,
                                        }]}>
                                            <Text style={[styles.smallLogoText, { color: colors.textTertiary }]}>{ws.name.charAt(0)}</Text>
                                        </View>
                                    )}
                                    <Text style={[
                                        styles.menuItemText,
                                        { color: currentWorkspace?.id === ws.id ? colors.accent : colors.text }
                                    ]}>
                                        {ws.name}
                                    </Text>
                                </View>
                                {currentWorkspace?.id === ws.id && <Check size={16} color={colors.accent} />}
                            </TouchableOpacity>
                        ))}

                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setShowWorkspaceMenu(false);
                                router.push('/create-workspace' as any);
                            }}
                        >
                            <View style={styles.menuItemLeft}>
                                <View style={[styles.smallLogoPlaceholder, {
                                    backgroundColor: colors.accentBg,
                                    borderColor: colors.accent + '30',
                                }]}>
                                    <Plus size={14} color={colors.accent} />
                                </View>
                                <Text style={[styles.menuItemText, { color: colors.accent }]}>Create Workspace</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Profile Menu Modal */}
            <Modal
                visible={showProfileMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowProfileMenu(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowProfileMenu(false)}
                >
                    <View style={[styles.menuContainer, {
                        top: insets.top + 70,
                        right: 20,
                        backgroundColor: colors.card,
                        shadowColor: isDark ? '#000' : '#64748B',
                        borderColor: colors.border,
                    }]}>
                        <View style={styles.profileHeader}>
                            {userAvatar ? (
                                <Image source={{ uri: userAvatar }} style={styles.profileAvatarLargeImg} />
                            ) : (
                                <View style={[styles.profileAvatarLarge, { backgroundColor: colors.accentBg }]}>
                                    <Text style={[styles.profileInitialsLarge, { color: colors.accent }]}>
                                        {(userName || user?.email)?.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>{userName || user?.email?.split('@')[0]}</Text>
                                <Text style={[styles.profileEmail, { color: colors.textTertiary }]} numberOfLines={1}>{user?.email}</Text>
                            </View>
                        </View>

                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

                        <TouchableOpacity style={styles.menuItem} onPress={() => { setShowProfileMenu(false); router.push('/settings' as any); }}>
                            <View style={styles.menuItemLeft}>
                                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? colors.surface : '#EFF6FF' }]}>
                                    <Settings size={16} color={isDark ? colors.textSecondary : '#3B82F6'} />
                                </View>
                                <Text style={[styles.menuItemText, { color: colors.text }]}>Settings</Text>
                            </View>
                            <ChevronDown size={14} color={colors.textTertiary} style={{ transform: [{ rotate: '-90deg' }] }} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuItem, { marginTop: 2 }]}
                            onPress={handleSignOut}
                        >
                            <View style={styles.menuItemLeft}>
                                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? '#2D1515' : '#FEF2F2' }]}>
                                    <LogOut size={16} color="#EF4444" />
                                </View>
                                <Text style={[styles.menuItemText, { color: colors.error }]}>Log Out</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        zIndex: 50,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    // ─── Back button ──────────────────────
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    // ─── Workspace selector ───────────────
    workspaceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
        paddingRight: 10,
        borderRadius: 14,
        borderWidth: 1,
    },
    workspaceLogoWrap: {
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
            android: { elevation: 1 },
        }),
    },
    workspaceLogo: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
    },
    workspaceTextBlock: {
        justifyContent: 'center',
    },
    workspaceGreeting: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.3,
        marginBottom: 1,
    },
    workspaceUserName: {
        fontSize: 15,
        fontWeight: '700',
        maxWidth: 140,
    },
    // ─── Action buttons ───────────────────
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    actionBtn: {
        position: 'relative',
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
            android: { elevation: 2 },
        }),
    },
    notifBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#056805ff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
        paddingHorizontal: 4,
    },
    notifBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    profileBtn: {
        borderRadius: 21,
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
            android: { elevation: 2 },
        }),
    },
    profileAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileAvatarImg: {
        width: 42,
        height: 42,
        borderRadius: 21,
    },
    // ─── Modal styles ─────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.25)',
    },
    menuContainer: {
        position: 'absolute',
        width: 290,
        borderRadius: 20,
        padding: 6,
        borderWidth: 1,
        ...Platform.select({
            ios: { shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24 },
            android: { elevation: 12 },
        }),
    },
    menuHeader: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 6,
        marginLeft: 12,
        marginTop: 10,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 14,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    menuIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    smallLogo: {
        width: 28,
        height: 28,
        borderRadius: 8,
    },
    smallLogoPlaceholder: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    smallLogoText: {
        fontSize: 13,
        fontWeight: '700',
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '600',
    },
    menuDivider: {
        height: 1,
        marginVertical: 4,
        marginHorizontal: 10,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        paddingBottom: 10,
    },
    profileAvatarLarge: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileAvatarLargeImg: {
        width: 48,
        height: 48,
        borderRadius: 16,
    },
    profileInitialsLarge: {
        fontSize: 20,
        fontWeight: '800',
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
    },
    profileEmail: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 1,
    },
});
