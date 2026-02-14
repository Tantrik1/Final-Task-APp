import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    Image,
    StatusBar,
    Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    User,
    Mail,
    Save,
    LogOut,
    Shield,
    Clock,
    Briefcase,
    Camera,
    ChevronRight,
    Bell,
    Lock,
    HelpCircle
} from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
}

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { currentWorkspace, currentRole } = useWorkspace();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [fullName, setFullName] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    // Stats
    const [taskCount, setTaskCount] = useState(0);
    const [completedCount, setCompletedCount] = useState(0);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            setProfile(data);
            setFullName(data.full_name || '');
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const fetchStats = useCallback(async () => {
        if (!user || !currentWorkspace?.id) return;
        try {
            const { data: projects } = await supabase
                .from('projects')
                .select('id')
                .eq('workspace_id', currentWorkspace.id)
                .eq('is_archived', false);
            if (!projects || projects.length === 0) return;

            const projectIds = projects.map(p => p.id);

            const { data: statusData } = await supabase
                .from('project_statuses')
                .select('id, is_completed')
                .in('project_id', projectIds)
                .eq('is_completed', true);
            const completedIds = new Set((statusData || []).map(s => s.id));

            const { data: taskData } = await supabase
                .from('tasks')
                .select('id, status, custom_status_id')
                .in('project_id', projectIds)
                .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);

            const allTasks = taskData || [];
            const doneCount = allTasks.filter(t =>
                t.status === 'done' || (t.custom_status_id && completedIds.has(t.custom_status_id))
            ).length;

            setTaskCount(allTasks.length);
            setCompletedCount(doneCount);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }, [user, currentWorkspace?.id]);

    useEffect(() => { fetchProfile(); fetchStats(); }, [fetchProfile, fetchStats]);

    const handleSave = async () => {
        if (!user || !fullName.trim()) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName.trim() })
                .eq('id', user.id);
            if (error) throw error;
            setProfile(prev => prev ? { ...prev, full_name: fullName.trim() } : prev);
            setHasChanges(false);
            Alert.alert('Saved', 'Profile updated successfully.');
        } catch (error: any) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to save profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out', style: 'destructive', onPress: async () => {
                    await signOut();
                    router.replace('/auth' as any);
                }
            },
        ]);
    };

    const getInitials = () => {
        if (profile?.full_name) return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        if (profile?.email) return profile.email[0].toUpperCase();
        return 'U';
    };

    if (isLoading) {
        return (
            <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color="#F97316" />
            </View>
        );
    }

    return (
        <View style={s.container}>
            <ScrollView
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Card */}
                <Animated.View entering={FadeInUp.springify()} style={s.profileCard}>
                    <View style={s.avatarContainer}>
                        <View style={s.avatarWrapper}>
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} style={s.avatarImage} />
                            ) : (
                                <View style={s.avatarPlaceholder}>
                                    <Text style={s.avatarText}>{getInitials()}</Text>
                                </View>
                            )}
                            <TouchableOpacity style={s.editAvatarBtn}>
                                <Camera size={14} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={s.nameText}>{profile?.full_name || 'Designation Needed'}</Text>
                    <Text style={s.emailText}>{profile?.email}</Text>

                    <View style={s.badgesRow}>
                        {currentRole && (
                            <View style={[s.badge, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                                <Shield size={12} color="#F97316" />
                                <Text style={[s.badgeText, { color: '#F97316' }]}>{currentRole}</Text>
                            </View>
                        )}
                        <View style={[s.badge, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                            <Briefcase size={12} color="#0EA5E9" />
                            <Text style={[s.badgeText, { color: '#0EA5E9' }]}>{currentWorkspace?.name || 'No Workspace'}</Text>
                        </View>
                    </View>

                    {/* Quick Stats */}
                    <View style={s.statsContainer}>
                        <View style={s.statItem}>
                            <Text style={s.statValue}>{taskCount}</Text>
                            <Text style={s.statLabel}>Total Tasks</Text>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.statItem}>
                            <Text style={s.statValue}>{completedCount}</Text>
                            <Text style={s.statLabel}>Completed</Text>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.statItem}>
                            <Text style={s.statValue}>{profile?.created_at ? formatDistanceToNow(new Date(profile.created_at)).replace('about ', '') : '-'}</Text>
                            <Text style={s.statLabel}>Tenure</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Account Details Form */}
                <Animated.View entering={FadeInDown.delay(100).springify()} style={s.section}>
                    <Text style={s.sectionHeader}>Account Details</Text>

                    <View style={s.inputGroup}>
                        <Text style={s.label}>Full Name</Text>
                        <TextInput
                            style={s.input}
                            value={fullName}
                            onChangeText={(text) => {
                                setFullName(text);
                                setHasChanges(true);
                            }}
                            placeholder="Your full name"
                        />
                    </View>

                    <View style={s.inputGroup}>
                        <Text style={s.label}>Email Address</Text>
                        <View style={[s.input, s.disabledInput]}>
                            <Text style={s.disabledText}>{profile?.email}</Text>
                            <Lock size={16} color="#94A3B8" />
                        </View>
                    </View>

                    <View style={s.inputGroup}>
                        <Text style={s.label}>Company / Workspace</Text>
                        <View style={[s.input, s.disabledInput]}>
                            <Text style={s.disabledText}>{currentWorkspace?.name}</Text>
                            <Briefcase size={16} color="#94A3B8" />
                        </View>
                    </View>

                    {hasChanges && (
                        <TouchableOpacity
                            style={s.saveButton}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Save size={18} color="#FFF" />
                                    <Text style={s.saveButtonText}>Save Changes</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </Animated.View>

                {/* Additional Options */}
                <Animated.View entering={FadeInDown.delay(200).springify()} style={s.optionsSection}>
                    <TouchableOpacity style={s.optionRow} onPress={() => router.push('/(tabs)/notifications' as any)}>
                        <View style={[s.optionIcon, { backgroundColor: '#F0F9FF' }]}>
                            <Bell size={20} color="#0EA5E9" />
                        </View>
                        <Text style={s.optionText}>Notifications</Text>
                        <ChevronRight size={20} color="#94A3B8" />
                    </TouchableOpacity>

                    <TouchableOpacity style={s.optionRow} onPress={() => Linking.openURL('https://htask.com/help')}>
                        <View style={[s.optionIcon, { backgroundColor: '#F5F3FF' }]}>
                            <HelpCircle size={20} color="#8B5CF6" />
                        </View>
                        <Text style={s.optionText}>Help & Support</Text>
                        <ChevronRight size={20} color="#94A3B8" />
                    </TouchableOpacity>

                    <TouchableOpacity style={s.optionRow} onPress={handleSignOut}>
                        <View style={[s.optionIcon, { backgroundColor: '#FEF2F2' }]}>
                            <LogOut size={20} color="#EF4444" />
                        </View>
                        <Text style={[s.optionText, { color: '#EF4444' }]}>Log Out</Text>
                    </TouchableOpacity>
                </Animated.View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 40, // Added padding to clear header nicely
        paddingBottom: 40,
    },

    profileCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        paddingTop: 40, // Extra top padding for avatar overlap feel
        alignItems: 'center',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 24,
        marginTop: 20,
    },
    avatarContainer: {
        marginTop: -80, // Negative margin to pull avatar up
        marginBottom: 16,
    },
    avatarWrapper: {
        width: 100,
        height: 100,
        borderRadius: 40,
        backgroundColor: '#FFFFFF',
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 36,
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 36,
        backgroundColor: '#F97316',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    editAvatarBtn: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },

    nameText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
        textAlign: 'center',
    },
    emailText: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 16,
    },

    badgesRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 24,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'capitalize',
    },

    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#F1F5F9',
    },

    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    disabledInput: {
        backgroundColor: '#F1F5F9',
        borderColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    disabledText: {
        color: '#94A3B8',
        fontSize: 15,
    },
    saveButton: {
        backgroundColor: '#F97316',
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },

    optionsSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 8,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 16,
    },
    optionIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
});
