import React, { useState, useEffect } from 'react';
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
    Switch,
    StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Settings,
    Building2,
    Trash2,
    Save,
    Bell,
    Moon,
    Globe,
    ChevronRight,
    User,
    Shield,
    Check,
    ArrowLeft
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications, NotificationPreferences } from '@/hooks/useNotifications';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DashboardHeader } from '@/components/DashboardHeader';
import { GlobalTabBar } from '@/components/GlobalTabBar';

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currentWorkspace, currentRole } = useWorkspace();
    const { user } = useAuth();
    const {
        preferences,
        updatePreferences,
        isLoading: isNotifLoading
    } = useNotifications();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const isOwner = currentRole === 'owner';
    const canEdit = currentRole === 'owner' || currentRole === 'admin';

    useEffect(() => {
        if (currentWorkspace) {
            setName(currentWorkspace.name);
            setDescription(currentWorkspace.description || '');
        }
    }, [currentWorkspace]);

    const handleSaveWorkspace = async () => {
        if (!currentWorkspace?.id || !canEdit || !name.trim()) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('workspaces')
                .update({
                    name: name.trim(),
                    description: description.trim() || null,
                })
                .eq('id', currentWorkspace.id);
            if (error) throw error;
            setHasChanges(false);
            Alert.alert('Saved', 'Workspace settings updated.');
        } catch (error: any) {
            console.error('Error saving settings:', error);
            Alert.alert('Error', 'Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteWorkspace = () => {
        if (!isOwner || !currentWorkspace) return;
        Alert.alert(
            'Delete Workspace',
            `This will permanently delete "${currentWorkspace.name}" and ALL its data. This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Forever', style: 'destructive', onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('workspaces')
                                .delete()
                                .eq('id', currentWorkspace.id);
                            if (error) throw error;
                            router.replace('/' as any);
                        } catch (error: any) {
                            console.error('Error deleting workspace:', error);
                            Alert.alert('Error', error.message || 'Failed to delete workspace.');
                        }
                    }
                },
            ]
        );
    };

    const togglePreference = (key: keyof NotificationPreferences) => {
        if (!preferences) return;
        updatePreferences({ [key]: !preferences[key] });
    };

    return (
        <View style={styles.container}>
            <DashboardHeader showBack />

            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>

                {/* 1. Account & App */}
                <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
                    <Text style={styles.sectionTitle}>Account & App</Text>

                    <TouchableOpacity style={styles.row} onPress={() => router.push('/profile' as any)}>
                        <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                            <User size={18} color="#3B82F6" />
                        </View>
                        <Text style={styles.rowLabel}>Edit Profile</Text>
                        <ChevronRight size={18} color="#CBD5E1" />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.row}>
                        <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
                            <Moon size={18} color="#8B5CF6" />
                        </View>
                        <Text style={styles.rowLabel}>Dark Mode</Text>
                        <Switch trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }} thumbColor="#FFF" value={false} />
                    </TouchableOpacity>
                </Animated.View>

                {/* 2. Notification Preferences */}
                <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
                    <Text style={styles.sectionTitle}>Notifications</Text>

                    {isNotifLoading && !preferences ? (
                        <ActivityIndicator color="#F97316" style={{ margin: 20 }} />
                    ) : (
                        <>
                            <View style={styles.row}>
                                <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                                    <Bell size={18} color="#F97316" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowLabel}>Task Assignments</Text>
                                    <Text style={styles.rowSub}>When tasks are assigned to you</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: '#E2E8F0', true: '#F97316' }}
                                    thumbColor="#FFF"
                                    value={preferences?.task_assigned ?? true}
                                    onValueChange={() => togglePreference('task_assigned')}
                                />
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.row}>
                                <View style={[styles.iconBox, { backgroundColor: '#ECFEFF' }]}>
                                    <Settings size={18} color="#06B6D4" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowLabel}>Task Updates</Text>
                                    <Text style={styles.rowSub}>Status changes on your tasks</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: '#E2E8F0', true: '#06B6D4' }}
                                    thumbColor="#FFF"
                                    value={preferences?.task_status_changed ?? true}
                                    onValueChange={() => togglePreference('task_status_changed')}
                                />
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.row}>
                                <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
                                    <Shield size={18} color="#22C55E" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowLabel}>Comments</Text>
                                    <Text style={styles.rowSub}> Replies to your comments</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: '#E2E8F0', true: '#22C55E' }}
                                    thumbColor="#FFF"
                                    value={preferences?.comment_reply ?? true}
                                    onValueChange={() => togglePreference('comment_reply')}
                                />
                            </View>
                        </>
                    )}
                </Animated.View>

                {/* 3. Workspace Settings (Admin/Owner only) */}
                <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
                    <Text style={styles.sectionTitle}>Workspace Settings</Text>

                    <View style={{ padding: 16 }}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Workspace Name</Text>
                            <TextInput
                                style={[styles.input, !canEdit && styles.disabledInput]}
                                value={name}
                                onChangeText={(text) => { setName(text); setHasChanges(true); }}
                                editable={canEdit}
                                placeholder="Workspace Name"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.multilineInput, !canEdit && styles.disabledInput]}
                                value={description}
                                onChangeText={(text) => { setDescription(text); setHasChanges(true); }}
                                editable={canEdit}
                                placeholder="Description"
                                multiline
                            />
                        </View>

                        {hasChanges && canEdit && (
                            <TouchableOpacity
                                style={styles.saveBtn}
                                onPress={handleSaveWorkspace}
                                disabled={isSaving}
                            >
                                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>

                {/* 4. Danger Zone */}
                {isOwner && (
                    <Animated.View entering={FadeInDown.delay(400).springify()} style={[styles.section, { borderColor: '#FEE2E2', borderWidth: 1 }]}>
                        <View style={styles.dangerHeader}>
                            <Trash2 size={16} color="#EF4444" />
                            <Text style={styles.dangerTitle}>Danger Zone</Text>
                        </View>
                        <View style={{ padding: 16, paddingTop: 0 }}>
                            <Text style={styles.dangerText}>
                                Permanently delete this workspace and all its data.
                            </Text>
                            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteWorkspace}>
                                <Text style={styles.deleteBtnText}>Delete Workspace</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
            <GlobalTabBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

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
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 40,
    },

    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginBottom: 24,
        overflow: 'hidden',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginLeft: 16,
        marginTop: 16,
        marginBottom: 8,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    rowLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    rowSub: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 64,
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
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    multilineInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    disabledInput: {
        backgroundColor: '#F1F5F9',
        color: '#94A3B8',
    },

    saveBtn: {
        backgroundColor: '#0F172A',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    saveBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },

    dangerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#FEF2F2',
    },
    dangerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    dangerText: {
        fontSize: 14,
        color: '#64748B',
        marginVertical: 12,
    },
    deleteBtn: {
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    deleteBtnText: {
        color: '#EF4444',
        fontWeight: '700',
        fontSize: 15,
    },
});
