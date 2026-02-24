import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    Alert,
    Platform,
    Modal,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
    Users,
    Search,
    Crown,
    Shield,
    User,
    Eye,
    MoreHorizontal,
    Trash2,
    X,
    UserCheck,
    UserMinus,
    Plus,
    Mail,
    Lock,
    Send,
    Eye as EyeIcon,
    EyeOff,
    Check,
    UserPlus,
    ArrowLeft
} from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { MembersSkeleton } from '@/components/ui/Skeleton';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DashboardHeader } from '@/components/DashboardHeader';
import { GlobalTabBar } from '@/components/GlobalTabBar';

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

interface MemberWithProfile {
    id: string;
    user_id: string;
    role: WorkspaceRole;
    joined_at: string;
    last_active_at: string | null;
    profiles: {
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
        needs_password_reset: boolean | null;
    };
}

type TabValue = 'all' | 'active' | 'inactive';

const ROLE_CONFIG: Record<WorkspaceRole, { Icon: any; color: string; bg: string; label: string }> = {
    owner: { Icon: Crown, color: '#F59E0B', bg: '#FEF3C7', label: 'Owner' },
    admin: { Icon: Shield, color: '#6366F1', bg: '#EEF2FF', label: 'Admin' },
    member: { Icon: User, color: '#3B82F6', bg: '#EFF6FF', label: 'Member' },
    viewer: { Icon: Eye, color: '#94A3B8', bg: '#F1F5F9', label: 'Viewer' },
};

const TABS: { id: TabValue; label: string; Icon: any }[] = [
    { id: 'all', label: 'All', Icon: Users },
    { id: 'active', label: 'Active', Icon: UserCheck },
    { id: 'inactive', label: 'Inactive', Icon: UserMinus },
];

export default function MembersScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currentWorkspace, currentRole } = useWorkspace();
    const { user } = useAuth();
    const { colors } = useTheme();

    const [members, setMembers] = useState<MemberWithProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabValue>('all');
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedMember, setSelectedMember] = useState<MemberWithProfile | null>(null);
    const hasMounted = useRef(false);

    // Invite member state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteStep, setInviteStep] = useState<'email' | 'existing' | 'new'>('email');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteFullName, setInviteFullName] = useState('');
    // Generate a random secure temp password (never hardcode a default)
    const [invitePassword, setInvitePassword] = useState(() => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
        return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    });
    const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
    const [inviteShowPassword, setInviteShowPassword] = useState(false);
    const [inviteChecking, setInviteChecking] = useState(false);
    const [inviteSubmitting, setInviteSubmitting] = useState(false);
    const [inviteFoundUser, setInviteFoundUser] = useState<{ name: string; email: string } | null>(null);

    // INV-07: Pending invitations for admin/owner view
    const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    const canManageMembers = currentRole === 'owner' || currentRole === 'admin';

    const fetchMembers = useCallback(async () => {
        if (!currentWorkspace?.id) return;
        try {
            const { data, error } = await supabase
                .from('workspace_members')
                .select(`
                    id, user_id, role, joined_at, last_active_at,
                    profiles!workspace_members_user_id_fkey (
                        id, email, full_name, avatar_url, needs_password_reset
                    )
                `)
                .eq('workspace_id', currentWorkspace.id)
                .order('joined_at', { ascending: true });

            if (error) throw error;
            setMembers((data as unknown as MemberWithProfile[]) || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [currentWorkspace?.id]);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);

    // INV-07: Fetch pending invitations (admins/owners only)
    const fetchPendingInvitations = useCallback(async () => {
        if (!currentWorkspace?.id || !canManageMembers) return;
        try {
            const { data, error } = await supabase
                .from('workspace_invitations')
                .select('id, email, role, expires_at, created_at, invited_by')
                .eq('workspace_id', currentWorkspace.id)
                .eq('status', 'pending')
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });
            if (!error) setPendingInvitations(data || []);
        } catch { /* non-critical */ }
    }, [currentWorkspace?.id, canManageMembers]);

    useEffect(() => { fetchPendingInvitations(); }, [fetchPendingInvitations]);

    // INV-07: Revoke (cancel) a pending invitation
    const handleRevokeInvitation = async (invId: string, email: string) => {
        Alert.alert('Revoke Invitation', `Remove the pending invitation for ${email}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Revoke', style: 'destructive', onPress: async () => {
                    setRevokingId(invId);
                    try {
                        const { error } = await supabase
                            .from('workspace_invitations')
                            .delete()
                            .eq('id', invId);
                        if (error) throw error;
                        fetchPendingInvitations();
                    } catch (err: any) {
                        Alert.alert('Error', err.message || 'Failed to revoke invitation');
                    } finally {
                        setRevokingId(null);
                    }
                },
            },
        ]);
    };

    useFocusEffect(
        useCallback(() => {
            if (hasMounted.current) {
                fetchMembers();
            } else {
                hasMounted.current = true;
            }
        }, [fetchMembers])
    );

    const onRefresh = () => { setRefreshing(true); fetchMembers(); };

    const isActiveMember = (m: MemberWithProfile): boolean => {
        if (!m.last_active_at) return false;
        const lastActive = new Date(m.last_active_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return lastActive > sevenDaysAgo;
    };

    const getMemberStatus = (m: MemberWithProfile): 'active' | 'awaiting' | 'inactive' => {
        if (m.profiles.needs_password_reset === true) return 'awaiting';
        if (isActiveMember(m)) return 'active';
        return 'inactive';
    };

    const filteredMembers = useMemo(() => {
        const q = searchQuery.toLowerCase();
        let filtered = members.filter(m => {
            if (!q) return true;
            return (
                m.profiles.email.toLowerCase().includes(q) ||
                (m.profiles.full_name?.toLowerCase().includes(q) ?? false)
            );
        });

        if (activeTab === 'active') {
            filtered = filtered.filter(isActiveMember);
        } else if (activeTab === 'inactive') {
            filtered = filtered.filter(m => !isActiveMember(m) && m.profiles.needs_password_reset !== true);
        }

        return filtered;
    }, [members, searchQuery, activeTab]);

    const handleRoleChange = async (member: MemberWithProfile, newRole: WorkspaceRole) => {
        if (!currentWorkspace?.id || newRole === member.role) return;
        // Prevent demoting the workspace owner
        if (member.role === 'owner') {
            Alert.alert('Not Allowed', 'The workspace owner role cannot be changed.');
            return;
        }
        try {
            const { error } = await supabase
                .from('workspace_members')
                .update({ role: newRole })
                .eq('workspace_id', currentWorkspace.id)
                .eq('user_id', member.user_id);
            if (error) throw error;
            setShowRoleModal(false);
            setSelectedMember(null);
            fetchMembers();
        } catch (error: any) {
            console.error('Error changing role:', error);
            Alert.alert('Error', 'Failed to update role: ' + error.message);
        }
    };

    const handleRemoveMember = async (member: MemberWithProfile) => {
        if (!currentWorkspace?.id) return;
        // Prevent removing the workspace owner or another admin unless you are the owner
        if (member.role === 'owner') {
            Alert.alert('Not Allowed', 'The workspace owner cannot be removed.');
            return;
        }
        if (member.role === 'admin' && currentRole !== 'owner') {
            Alert.alert('Not Allowed', 'Only the workspace owner can remove an admin.');
            return;
        }
        Alert.alert(
            'Remove Member',
            `Remove ${member.profiles.full_name || member.profiles.email} from this workspace?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive', onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('workspace_members')
                                .delete()
                                .eq('workspace_id', currentWorkspace.id)
                                .eq('user_id', member.user_id);
                            if (error) throw error;
                            setShowRoleModal(false);
                            setSelectedMember(null);
                            fetchMembers();
                        } catch (error: any) {
                            console.error('Error removing member:', error);
                            Alert.alert('Error', 'Failed to remove member: ' + error.message);
                        }
                    }
                },
            ]
        );
    };

    const handleCheckEmail = async () => {
        if (!inviteEmail.trim() || !currentWorkspace?.id) return;
        setInviteChecking(true);
        try {
            // Check if email already belongs to a workspace member
            const { data: existing } = await supabase
                .from('workspace_members')
                .select('user_id, profiles!workspace_members_user_id_fkey(email, full_name)')
                .eq('workspace_id', currentWorkspace.id);
            const alreadyMember = (existing || []).some((m: any) => m.profiles?.email === inviteEmail.trim());
            if (alreadyMember) {
                Alert.alert('Already a Member', 'This person is already in your workspace.');
                return;
            }
            // Check if user exists in profiles
            const { data: profileData } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('email', inviteEmail.trim())
                .maybeSingle();
            if (profileData) {
                setInviteFoundUser({ name: profileData.full_name || profileData.email, email: profileData.email });
                setInviteStep('existing');
            } else {
                setInviteStep('new');
            }
        } catch (e) {
            console.error('Error checking email:', e);
        } finally {
            setInviteChecking(false);
        }
    };

    const handleSendInvite = async () => {
        if (!currentWorkspace?.id || !user) return;
        setInviteSubmitting(true);
        try {
            // INV-05: Invoke the existing send-invitation Edge Function.
            // It handles both paths:
            //   - Existing user → adds to workspace_members + sends "you've been added" email
            //   - New user → creates account, adds to workspace_members, sends credentials email
            const inviterProfile = members.find(m => m.user_id === user.id);
            const inviterName = inviterProfile?.profiles.full_name || inviterProfile?.profiles.email.split('@')[0] || 'A team member';

            const { data: fnData, error: fnError } = await supabase.functions.invoke('send-invitation', {
                body: {
                    email: inviteEmail.trim(),
                    workspaceId: currentWorkspace.id,
                    workspaceName: currentWorkspace.name,
                    inviterName,
                    role: inviteRole,
                },
            });

            if (fnError) throw fnError;
            if (fnData && !fnData.success) throw new Error(fnData.error || 'Failed to send invitation');

            // Also write to workspace_invitations so the pending list (INV-07) reflects this invite.
            // For existing users the function already added them as members, so this is just a record.
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            await supabase.from('workspace_invitations').upsert({
                workspace_id: currentWorkspace.id,
                email: inviteEmail.trim(),
                role: inviteRole,
                invited_by: user.id,
                status: 'pending',
                expires_at: expiresAt.toISOString(),
            }, { onConflict: 'workspace_id,email' });

            Alert.alert('Invitation Sent', fnData?.message || `An invitation has been sent to ${inviteEmail}.`);
            setShowInviteModal(false);
            setInviteEmail('');
            setInviteStep('email');
            setInviteFoundUser(null);
            // INV-07: Refresh pending list so the new invite appears immediately
            fetchPendingInvitations();
            // Refresh member list (existing users are added directly by the function)
            fetchMembers();
        } catch (error: any) {
            console.error('Error sending invite:', error);
            Alert.alert('Error', error.message || 'Failed to send invitation');
        } finally {
            setInviteSubmitting(false);
        }
    };

    const renderMemberCard = (member: MemberWithProfile, index: number) => {
        const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
        const isCurrentUser = member.user_id === user?.id;
        const canModify = canManageMembers && !isCurrentUser && member.role !== 'owner';
        const status = getMemberStatus(member);

        const name = member.profiles.full_name || member.profiles.email.split('@')[0];
        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

        // Dynamic consistent color based on user ID
        const getColor = (str: string) => {
            const palette = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#22C55E'];
            let hash = 0;
            for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
            return palette[Math.abs(hash) % palette.length];
        };
        const avatarColor = getColor(member.user_id);

        return (
            <Animated.View key={member.id} entering={FadeInDown.delay(index * 50).springify()} style={[s.memberCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                <View style={[s.avatar, { backgroundColor: avatarColor + '20' }]}>
                    {member.profiles.avatar_url ? (
                        <Image source={{ uri: member.profiles.avatar_url }} style={s.avatarImg} />
                    ) : (
                        <Text style={[s.avatarText, { color: avatarColor }]}>{initials}</Text>
                    )}
                    <View style={[
                        s.statusDot, { borderColor: colors.card },
                        status === 'active' && { backgroundColor: '#22C55E' },
                        status === 'awaiting' && { backgroundColor: '#F59E0B' },
                        status === 'inactive' && { backgroundColor: colors.textTertiary }
                    ]} />
                </View>

                <View style={s.info}>
                    <View style={s.nameRow}>
                        <Text style={[s.name, { color: colors.text }]}>{name}</Text>
                        {isCurrentUser && <View style={[s.youBadge, { backgroundColor: colors.surface }]}><Text style={[s.youText, { color: colors.textSecondary }]}>YOU</Text></View>}
                    </View>
                    <Text style={[s.email, { color: colors.textSecondary }]}>{member.profiles.email}</Text>
                </View>

                <View style={s.metaCol}>
                    <View style={[s.roleBadge, { backgroundColor: roleConfig.bg }]}>
                        <roleConfig.Icon size={10} color={roleConfig.color} />
                        <Text style={[s.roleText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
                    </View>
                    {canModify && (
                        <TouchableOpacity style={s.moreBtn} onPress={() => { setSelectedMember(member); setShowRoleModal(true); }}>
                            <MoreHorizontal size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={[s.container, { backgroundColor: colors.background }]}>
            <DashboardHeader showBack />

            {/* 1. Statistics / Header Summary (Below DashboardHeader) */}
            <View style={[s.summaryRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <View style={s.summaryItem}>
                    <Text style={[s.summaryVal, { color: colors.text }]}>{members.length}</Text>
                    <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Total Members</Text>
                </View>
                <View style={[s.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={s.summaryItem}>
                    <Text style={[s.summaryVal, { color: colors.text }]}>{members.filter(isActiveMember).length}</Text>
                    <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Active Now</Text>
                </View>
                {canManageMembers && (
                    <TouchableOpacity style={s.inviteBtn} onPress={() => setShowInviteModal(true)}>
                        <UserPlus size={18} color="#FFF" />
                        <Text style={s.inviteText}>Invite</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* 2. Search & Filter Bar */}
            <View style={s.filterBar}>
                <View style={[s.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Search size={16} color={colors.textTertiary} />
                    <TextInput
                        style={[s.input, { color: colors.text }]}
                        placeholder="Search team..."
                        placeholderTextColor={colors.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                    {TABS.map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[s.tab, { backgroundColor: colors.card, borderColor: colors.border }, activeTab === tab.id && s.tabActive]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === tab.id && s.tabTextActive]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* 3. Members List */}
            {isLoading ? (
                <MembersSkeleton />
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                >
                    {/* INV-07: Pending invitations section for admins/owners */}
                    {canManageMembers && pendingInvitations.length > 0 && (
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.6, marginBottom: 8 }}>
                                PENDING INVITATIONS ({pendingInvitations.length})
                            </Text>
                            {pendingInvitations.map(inv => (
                                <View
                                    key={inv.id}
                                    style={[s.memberCard, { backgroundColor: colors.card, shadowColor: colors.shadow, borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}
                                >
                                    <View style={[s.avatar, { backgroundColor: '#FEF3C720' }]}>
                                        <Mail size={18} color="#F59E0B" />
                                    </View>
                                    <View style={s.info}>
                                        <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{inv.email}</Text>
                                        <Text style={[s.email, { color: colors.textSecondary }]}>
                                            {ROLE_CONFIG[inv.role as WorkspaceRole]?.label || inv.role} · expires {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}
                                        onPress={() => handleRevokeInvitation(inv.id, inv.email)}
                                        disabled={revokingId === inv.id}
                                    >
                                        {revokingId === inv.id
                                            ? <ActivityIndicator size="small" color="#EF4444" />
                                            : <Text style={{ fontSize: 12, fontWeight: '600', color: '#EF4444' }}>Revoke</Text>
                                        }
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {filteredMembers.length === 0 ? (
                        <View style={s.emptyState}>
                            <Users size={48} color={colors.textTertiary} />
                            <Text style={[s.emptyText, { color: colors.textTertiary }]}>No members found</Text>
                        </View>
                    ) : (
                        filteredMembers.map((m, i) => renderMemberCard(m, i))
                    )}
                </ScrollView>
            )}

            {/* ─── Invite Member Modal ─── */}
            <Modal visible={showInviteModal} transparent animationType="slide" onRequestClose={() => { setShowInviteModal(false); setInviteStep('email'); setInviteFoundUser(null); }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
                        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 }}>Invite Member</Text>

                        {inviteStep === 'email' && (
                            <>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>EMAIL ADDRESS</Text>
                                <TextInput
                                    style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}
                                    placeholder="colleague@example.com"
                                    placeholderTextColor={colors.textTertiary}
                                    value={inviteEmail}
                                    onChangeText={setInviteEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>ROLE</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                                    {(['member', 'admin', 'viewer'] as WorkspaceRole[]).map(r => (
                                        <TouchableOpacity key={r} onPress={() => setInviteRole(r)}
                                            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: inviteRole === r ? '#0F172A' : colors.surface, borderWidth: 1, borderColor: inviteRole === r ? '#0F172A' : colors.border }}>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: inviteRole === r ? '#FFF' : colors.text, textTransform: 'capitalize' }}>{r}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#0F172A', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                                    onPress={handleCheckEmail}
                                    disabled={inviteChecking || !inviteEmail.trim()}
                                >
                                    {inviteChecking ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Continue</Text>}
                                </TouchableOpacity>
                            </>
                        )}

                        {inviteStep === 'existing' && inviteFoundUser && (
                            <>
                                <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{inviteFoundUser.name}</Text>
                                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>{inviteFoundUser.email}</Text>
                                </View>
                                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>This user already has an account. An invitation will be sent for them to join your workspace.</Text>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#F97316', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                                    onPress={handleSendInvite}
                                    disabled={inviteSubmitting}
                                >
                                    {inviteSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Send Invitation</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setInviteStep('email'); setInviteFoundUser(null); }} style={{ alignItems: 'center', marginTop: 12 }}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Back</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {inviteStep === 'new' && (
                            <>
                                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>No account found for <Text style={{ fontWeight: '700', color: colors.text }}>{inviteEmail}</Text>. An invitation link will be sent to this email.</Text>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#F97316', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                                    onPress={handleSendInvite}
                                    disabled={inviteSubmitting}
                                >
                                    {inviteSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Send Invitation</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setInviteStep('email'); }} style={{ alignItems: 'center', marginTop: 12 }}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Back</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ─── Role Change Modal ─── */}
            <Modal visible={showRoleModal} transparent animationType="slide" onRequestClose={() => { setShowRoleModal(false); setSelectedMember(null); }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
                        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Change Role</Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20 }}>{selectedMember?.profiles.full_name || selectedMember?.profiles.email}</Text>
                        {(['admin', 'member', 'viewer'] as WorkspaceRole[]).map(r => (
                            <TouchableOpacity key={r} onPress={() => selectedMember && handleRoleChange(selectedMember, r)}
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>{r}</Text>
                                {selectedMember?.role === r && <Check size={18} color="#F97316" />}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            onPress={() => selectedMember && handleRemoveMember(selectedMember)}
                            style={{ marginTop: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FEF2F2', alignItems: 'center' }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>Remove from Workspace</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setShowRoleModal(false); setSelectedMember(null); }} style={{ alignItems: 'center', marginTop: 12 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <GlobalTabBar />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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

    summaryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    summaryItem: { alignItems: 'center' },
    summaryVal: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    summaryLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' },
    summaryDivider: { width: 1, height: 24, backgroundColor: '#E2E8F0', marginHorizontal: 20 },

    inviteBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
    inviteText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

    filterBar: { padding: 16, gap: 12 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    input: { flex: 1, fontSize: 14, color: '#0F172A' },

    tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
    tabActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#FFF' },

    memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 16, marginBottom: 8, ...Platform.select({ ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 1 } }) },
    avatar: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' as const },
    avatarImg: { width: 44, height: 44, borderRadius: 16 },
    avatarText: { fontSize: 16, fontWeight: '700' },
    statusDot: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFF' },

    info: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    youBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
    youText: { fontSize: 9, fontWeight: '800', color: '#64748B' },
    email: { fontSize: 13, color: '#64748B' },

    metaCol: { alignItems: 'flex-end', gap: 4 },
    roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    roleText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    moreBtn: { padding: 4 },

    emptyState: { alignItems: 'center', marginTop: 40, gap: 12 },
    emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
});
