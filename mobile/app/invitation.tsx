import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Mail,
    Shield,
    User,
    Eye,
    Crown,
    CheckCircle,
    XCircle,
    Building2,
    Clock,
    ArrowRight,
    Sparkles,
} from 'lucide-react-native';
import { usePendingInvitations, PendingInvitation } from '@/hooks/usePendingInvitations';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatDistanceToNow } from 'date-fns';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
    owner: { label: 'Owner', color: '#F59E0B', bg: '#FEF3C7', Icon: Crown },
    admin: { label: 'Admin', color: '#8B5CF6', bg: '#EDE9FE', Icon: Shield },
    member: { label: 'Member', color: '#3B82F6', bg: '#DBEAFE', Icon: User },
    viewer: { label: 'Viewer', color: '#64748B', bg: '#F1F5F9', Icon: Eye },
};

export default function InvitationScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { invitations, isLoading, acceptInvitation, declineInvitation } = usePendingInvitations();
    const { workspaces, setCurrentWorkspaceId } = useWorkspace();
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Redirect when no invitations (must be in useEffect, not render body)
    useEffect(() => {
        if (!isLoading && invitations.length === 0) {
            if (workspaces.length > 0) {
                router.replace('/(tabs)' as any);
            } else {
                router.replace('/onboarding' as any);
            }
        }
    }, [isLoading, invitations.length, workspaces.length]);

    const handleAccept = async (invitation: PendingInvitation) => {
        setProcessingId(invitation.id);
        try {
            await acceptInvitation(invitation);
            // Switch to the new workspace and go to dashboard
            setCurrentWorkspaceId(invitation.workspace_id);
            router.replace('/(tabs)' as any);
        } catch (error: any) {
            console.error('Error accepting invitation:', error);
            Alert.alert('Error', error.message || 'Failed to accept invitation.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDecline = async (invitation: PendingInvitation) => {
        Alert.alert(
            'Decline Invitation',
            `Are you sure you want to decline the invitation to "${invitation.workspace_name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingId(invitation.id);
                        try {
                            await declineInvitation(invitation);
                            // If no more invitations and user has workspaces, go to tabs
                            if (invitations.length <= 1) {
                                if (workspaces.length > 0) {
                                    router.replace('/(tabs)' as any);
                                } else {
                                    router.replace('/onboarding' as any);
                                }
                            }
                        } catch (error: any) {
                            console.error('Error declining invitation:', error);
                            Alert.alert('Error', error.message || 'Failed to decline invitation.');
                        } finally {
                            setProcessingId(null);
                        }
                    },
                },
            ]
        );
    };

    const handleSkip = () => {
        if (workspaces.length > 0) {
            router.replace('/(tabs)' as any);
        } else {
            router.replace('/onboarding' as any);
        }
    };

    if (isLoading) {
        return (
            <View style={[s.container, s.center, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={s.loadingText}>Checking invitations...</Text>
            </View>
        );
    }

    if (invitations.length === 0) {
        return null;
    }

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={s.header}>
                    <View style={s.headerIconWrap}>
                        <Mail size={28} color="#F97316" />
                    </View>
                    <Text style={s.headerTitle}>You've Been Invited!</Text>
                    <Text style={s.headerSub}>
                        {invitations.length === 1
                            ? 'You have a workspace invitation waiting for you.'
                            : `You have ${invitations.length} workspace invitations waiting.`}
                    </Text>
                </View>

                {/* Invitation Cards */}
                {invitations.map((inv) => {
                    const roleConfig = ROLE_CONFIG[inv.role] || ROLE_CONFIG.member;
                    const isProcessing = processingId === inv.id;

                    return (
                        <View key={inv.id} style={s.card}>
                            {/* Workspace Info */}
                            <View style={s.cardHeader}>
                                <View style={s.wsIcon}>
                                    {inv.workspace_logo_url ? (
                                        <Image source={{ uri: inv.workspace_logo_url }} style={s.wsLogo} />
                                    ) : (
                                        <Building2 size={22} color="#F97316" />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.wsName}>{inv.workspace_name}</Text>
                                    {inv.workspace_description && (
                                        <Text style={s.wsDesc} numberOfLines={1}>{inv.workspace_description}</Text>
                                    )}
                                </View>
                            </View>

                            {/* Details */}
                            <View style={s.detailsRow}>
                                <View style={s.detailItem}>
                                    <User size={13} color="#94A3B8" />
                                    <Text style={s.detailText}>Invited by <Text style={s.detailBold}>{inv.inviter_name}</Text></Text>
                                </View>
                                <View style={s.detailItem}>
                                    <Clock size={13} color="#94A3B8" />
                                    <Text style={s.detailText}>{formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}</Text>
                                </View>
                            </View>

                            {/* Role Badge */}
                            <View style={s.roleRow}>
                                <Text style={s.roleLabel}>Your Role:</Text>
                                <View style={[s.roleBadge, { backgroundColor: roleConfig.bg }]}>
                                    <roleConfig.Icon size={12} color={roleConfig.color} />
                                    <Text style={[s.roleBadgeText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
                                </View>
                            </View>

                            {/* Actions */}
                            <View style={s.actions}>
                                <TouchableOpacity
                                    style={s.declineBtn}
                                    onPress={() => handleDecline(inv)}
                                    disabled={isProcessing}
                                >
                                    <XCircle size={16} color="#EF4444" />
                                    <Text style={s.declineBtnText}>Decline</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[s.acceptBtn, isProcessing && { opacity: 0.5 }]}
                                    onPress={() => handleAccept(inv)}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <>
                                            <CheckCircle size={16} color="#FFF" />
                                            <Text style={s.acceptBtnText}>Accept & Join</Text>
                                            <ArrowRight size={14} color="#FFF" />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}

                {/* Skip Link */}
                {workspaces.length > 0 && (
                    <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
                        <Text style={s.skipText}>Skip for now</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { alignItems: 'center', justifyContent: 'center' },
    loadingText: { fontSize: 14, color: '#94A3B8', marginTop: 12, fontWeight: '500' },

    header: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
    headerIconWrap: {
        width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFF7ED',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        borderWidth: 1, borderColor: '#FFEDD5',
        ...Platform.select({
            ios: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
            android: { elevation: 4 },
        }),
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
    headerSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

    card: {
        backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 16,
        borderWidth: 1, borderColor: '#F1F5F9',
        ...Platform.select({
            ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
            android: { elevation: 2 },
        }),
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
    wsIcon: {
        width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFF7ED',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#FFEDD5',
    },
    wsLogo: { width: 48, height: 48, borderRadius: 14 },
    wsName: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    wsDesc: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

    detailsRow: { gap: 8, marginBottom: 14 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { fontSize: 13, color: '#64748B' },
    detailBold: { fontWeight: '600', color: '#1E293B' },

    roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
    roleLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
    roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    roleBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

    actions: { flexDirection: 'row', gap: 10 },
    declineBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 14, borderRadius: 14, backgroundColor: '#FEF2F2',
        borderWidth: 1, borderColor: '#FEE2E2',
    },
    declineBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
    acceptBtn: {
        flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 14, borderRadius: 14, backgroundColor: '#F97316',
        ...Platform.select({
            ios: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
            android: { elevation: 4 },
        }),
    },
    acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

    skipBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
    skipText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
});
