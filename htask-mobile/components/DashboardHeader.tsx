import React, { useState } from 'react';
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
    Menu
} from 'lucide-react-native';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';

export function DashboardHeader() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currentWorkspace, workspaces, setCurrentWorkspaceId } = useWorkspace();
    const { signOut, user } = useAuth();

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const handleSignOut = async () => {
        setShowProfileMenu(false);
        await signOut();
        router.replace('/auth');
    };

    const InitialsAvatar = ({ name, size = 32 }: { name: string, size?: number }) => (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 3,
                backgroundColor: '#FFF7ED',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#FFEDD5'
            }}
        >
            <Text style={{ color: '#F97316', fontWeight: '700', fontSize: size / 2 }}>
                {name?.charAt(0).toUpperCase() || '?'}
            </Text>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>

            {/* Left: Workspace Selector */}
            <TouchableOpacity
                style={styles.workspaceButton}
                onPress={() => setShowWorkspaceMenu(true)}
            >
                <View style={styles.workspaceLogoContainer}>
                    {currentWorkspace?.logo_url ? (
                        <Image source={{ uri: currentWorkspace.logo_url }} style={styles.workspaceLogo} />
                    ) : (
                        <InitialsAvatar name={currentWorkspace?.name || 'W'} size={36} />
                    )}
                </View>
                <View>
                    <Text style={styles.workspaceLabel}>Workspace</Text>
                    <View style={styles.workspaceNameContainer}>
                        <Text style={styles.workspaceName} numberOfLines={1}>
                            {currentWorkspace?.name || 'Select Workspace'}
                        </Text>
                        <ChevronDown size={14} color="#64748B" />
                    </View>
                </View>
            </TouchableOpacity>

            {/* Right: Actions */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/notifications' as any)}>
                    <Bell size={24} color="#64748B" />
                    <View style={styles.badge} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowProfileMenu(true)}>
                    <View style={styles.profileContainer}>
                        <View style={styles.profileAvatar}>
                            <User size={20} color="#F97316" />
                        </View>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => router.push('/(tabs)/menu' as any)}
                >
                    <Menu size={24} color="#64748B" />
                </TouchableOpacity>
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
                    <View style={[styles.menuContainer, { top: insets.top + 60, left: 20 }]}>
                        <Text style={styles.menuHeader}>Switch Workspace</Text>

                        {workspaces.map(ws => (
                            <TouchableOpacity
                                key={ws.id}
                                style={[
                                    styles.menuItem,
                                    currentWorkspace?.id === ws.id && styles.activeMenuItem
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
                                        <View style={styles.smallLogoPlaceholder}>
                                            <Text style={styles.smallLogoText}>{ws.name.charAt(0)}</Text>
                                        </View>
                                    )}
                                    <Text style={[
                                        styles.menuItemText,
                                        currentWorkspace?.id === ws.id && styles.activeMenuItemText
                                    ]}>
                                        {ws.name}
                                    </Text>
                                </View>
                                {currentWorkspace?.id === ws.id && <Check size={16} color="#F97316" />}
                            </TouchableOpacity>
                        ))}

                        <View style={styles.menuDivider} />

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setShowWorkspaceMenu(false);
                                // Navigate to create workspace
                                router.push('/onboarding'); // Or specific create screen
                            }}
                        >
                            <View style={[styles.smallLogoPlaceholder, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                                <Plus size={16} color="#64748B" />
                            </View>
                            <Text style={styles.menuItemText}>Create Workspace</Text>
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
                    <View style={[styles.menuContainer, { top: insets.top + 60, right: 20 }]}>
                        <View style={styles.profileHeader}>
                            <View style={styles.profileAvatarLarge}>
                                <Text style={styles.profileInitialsLarge}>
                                    {user?.email?.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <View>
                                <Text style={styles.profileName}>{user?.email?.split('@')[0]}</Text>
                                <Text style={styles.profileEmail}>{user?.email}</Text>
                            </View>
                        </View>

                        <View style={styles.menuDivider} />

                        <TouchableOpacity style={styles.menuItem} onPress={() => { setShowProfileMenu(false); router.push('/(tabs)/settings' as any); }}>
                            <Settings size={20} color="#64748B" />
                            <Text style={[styles.menuItemText, { marginLeft: 12 }]}>Settings</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuItem, { marginTop: 8 }]}
                            onPress={handleSignOut}
                        >
                            <LogOut size={20} color="#EF4444" />
                            <Text style={[styles.menuItemText, { marginLeft: 12, color: '#EF4444' }]}>Log Out</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        zIndex: 50,
    },
    workspaceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    workspaceLogoContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    workspaceLogo: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
    },
    workspaceLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    workspaceNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    workspaceName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        maxWidth: 160,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconButton: {
        position: 'relative',
        padding: 4,
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F97316',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    profileContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    profileAvatar: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.2)',
    },
    menuContainer: {
        position: 'absolute',
        width: 280,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 8,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    menuHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        marginBottom: 8,
        marginLeft: 8,
        marginTop: 8,
        textTransform: 'uppercase',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    activeMenuItem: {
        backgroundColor: '#FFF7ED',
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    smallLogo: {
        width: 24,
        height: 24,
        borderRadius: 6,
    },
    smallLogoPlaceholder: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    smallLogoText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    menuItemText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    activeMenuItemText: {
        color: '#F97316',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 4,
        marginHorizontal: 8,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        paddingBottom: 8,
    },
    profileAvatarLarge: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInitialsLarge: {
        fontSize: 20,
        fontWeight: '700',
        color: '#64748B',
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    profileEmail: {
        fontSize: 12,
        color: '#64748B',
    },
});
