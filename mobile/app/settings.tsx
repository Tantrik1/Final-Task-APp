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
    StatusBar,
    Image,
    ActionSheetIOS,
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
    ArrowLeft,
    Camera,
    Pencil,
    X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications, NotificationPreferences } from '@/hooks/useNotifications';
import { useTheme } from '@/contexts/ThemeContext';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DashboardHeader } from '@/components/DashboardHeader';
import { GlobalTabBar } from '@/components/GlobalTabBar';

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currentWorkspace, currentRole, refreshWorkspaces } = useWorkspace();
    const { user } = useAuth();
    const { colors } = useTheme();
    const {
        preferences,
        updatePreferences,
        isLoading: isNotifLoading
    } = useNotifications();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [logoUri, setLogoUri] = useState<string | null>(null);
    const [originalLogoUrl, setOriginalLogoUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [logoRemoved, setLogoRemoved] = useState(false);

    const isOwner = currentRole === 'owner';
    const canEdit = currentRole === 'owner' || currentRole === 'admin';

    useEffect(() => {
        if (currentWorkspace) {
            setName(currentWorkspace.name);
            setDescription(currentWorkspace.description || '');
            setOriginalLogoUrl(currentWorkspace.logo_url || null);
            setLogoUri(null);
            setLogoRemoved(false);
        }
    }, [currentWorkspace]);

    // ─── Logo Picker ──────────────────────────────────────────────
    const pickFromGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant photo library access.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setLogoUri(result.assets[0].uri);
            setLogoRemoved(false);
            setHasChanges(true);
        }
    };

    const pickFromCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera access.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setLogoUri(result.assets[0].uri);
            setLogoRemoved(false);
            setHasChanges(true);
        }
    };

    const showLogoOptions = () => {
        if (!canEdit) return;
        const hasLogo = logoUri || (originalLogoUrl && !logoRemoved);
        if (Platform.OS === 'ios') {
            const options = hasLogo
                ? ['Choose from Library', 'Take Photo', 'Remove Logo', 'Cancel']
                : ['Choose from Library', 'Take Photo', 'Cancel'];
            ActionSheetIOS.showActionSheetWithOptions(
                { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: hasLogo ? 2 : undefined },
                (idx) => {
                    if (idx === 0) pickFromGallery();
                    else if (idx === 1) pickFromCamera();
                    else if (idx === 2 && hasLogo) { setLogoUri(null); setLogoRemoved(true); setHasChanges(true); }
                },
            );
        } else {
            Alert.alert('Workspace Logo', 'Choose an option', [
                { text: 'Choose from Library', onPress: pickFromGallery },
                { text: 'Take Photo', onPress: pickFromCamera },
                ...(hasLogo ? [{ text: 'Remove Logo', style: 'destructive' as const, onPress: () => { setLogoUri(null); setLogoRemoved(true); setHasChanges(true); } }] : []),
                { text: 'Cancel', style: 'cancel' as const },
            ]);
        }
    };

    // ─── Upload Logo ──────────────────────────────────────────────
    const uploadLogo = async (workspaceId: string): Promise<string | null> => {
        if (!logoUri) return null;
        try {
            setIsUploading(true);
            const ext = logoUri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${workspaceId}/logo_${Date.now()}.${ext}`;
            const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

            const response = await fetch(logoUri);
            const blob = await response.blob();
            const arrayBuffer = await new Response(blob).arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from('workspace-logos')
                .upload(fileName, arrayBuffer, { contentType: mimeType, upsert: true });

            if (uploadError) {
                console.error('Logo upload error:', uploadError);
                return null;
            }

            const { data: urlData } = supabase.storage
                .from('workspace-logos')
                .getPublicUrl(fileName);

            return urlData?.publicUrl || null;
        } catch (err) {
            console.error('Logo upload failed:', err);
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    // ─── Save Handler ─────────────────────────────────────────────
    const handleSaveWorkspace = async () => {
        if (!currentWorkspace?.id || !canEdit || !name.trim()) return;
        setIsSaving(true);
        try {
            const updates: any = {
                name: name.trim(),
                description: description.trim() || null,
            };

            // Handle logo changes
            if (logoUri) {
                const logoUrl = await uploadLogo(currentWorkspace.id);
                if (logoUrl) updates.logo_url = logoUrl;
            } else if (logoRemoved) {
                updates.logo_url = null;
            }

            const { error } = await supabase
                .from('workspaces')
                .update(updates)
                .eq('id', currentWorkspace.id);
            if (error) throw error;

            setHasChanges(false);
            setLogoRemoved(false);
            if (updates.logo_url !== undefined) setOriginalLogoUrl(updates.logo_url);
            if (logoUri) setLogoUri(null);
            // Refresh workspace context so header/other screens see updated name/logo
            await refreshWorkspaces();
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
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <DashboardHeader showBack />

            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>

                {/* 1. Account & App */}
                <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Account & App</Text>

                    <TouchableOpacity style={styles.row} onPress={() => router.push('/profile' as any)}>
                        <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                            <User size={18} color="#3B82F6" />
                        </View>
                        <Text style={[styles.rowLabel, { color: colors.text }]}>Edit Profile</Text>
                        <ChevronRight size={18} color={colors.textTertiary} />
                    </TouchableOpacity>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <TouchableOpacity style={styles.row}>
                        <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
                            <Moon size={18} color="#8B5CF6" />
                        </View>
                        <Text style={[styles.rowLabel, { color: colors.text }]}>Dark Mode</Text>
                        <Switch trackColor={{ false: colors.border, true: '#8B5CF6' }} thumbColor="#FFF" value={false} />
                    </TouchableOpacity>
                </Animated.View>

                {/* 2. Notification Preferences */}
                <Animated.View entering={FadeInDown.delay(200).springify()} style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Notifications</Text>

                    {isNotifLoading && !preferences ? (
                        <ActivityIndicator color={colors.primary} style={{ margin: 20 }} />
                    ) : (
                        <>
                            <View style={styles.row}>
                                <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                                    <Bell size={18} color="#F97316" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.rowLabel, { color: colors.text }]}>Task Assignments</Text>
                                    <Text style={[styles.rowSub, { color: colors.textTertiary }]}>When tasks are assigned to you</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: colors.border, true: '#F97316' }}
                                    thumbColor="#FFF"
                                    value={preferences?.task_assigned ?? true}
                                    onValueChange={() => togglePreference('task_assigned')}
                                />
                            </View>

                            <View style={[styles.divider, { backgroundColor: colors.border }]} />

                            <View style={styles.row}>
                                <View style={[styles.iconBox, { backgroundColor: '#ECFEFF' }]}>
                                    <Settings size={18} color="#06B6D4" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.rowLabel, { color: colors.text }]}>Task Updates</Text>
                                    <Text style={[styles.rowSub, { color: colors.textTertiary }]}>Status changes on your tasks</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: colors.border, true: '#06B6D4' }}
                                    thumbColor="#FFF"
                                    value={preferences?.task_status_changed ?? true}
                                    onValueChange={() => togglePreference('task_status_changed')}
                                />
                            </View>

                            <View style={[styles.divider, { backgroundColor: colors.border }]} />

                            <View style={styles.row}>
                                <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
                                    <Shield size={18} color="#22C55E" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.rowLabel, { color: colors.text }]}>Comments</Text>
                                    <Text style={[styles.rowSub, { color: colors.textTertiary }]}> Replies to your comments</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: colors.border, true: '#22C55E' }}
                                    thumbColor="#FFF"
                                    value={preferences?.comment_reply ?? true}
                                    onValueChange={() => togglePreference('comment_reply')}
                                />
                            </View>
                        </>
                    )}
                </Animated.View>

                {/* 3. Workspace Settings (Admin/Owner only) */}
                <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Workspace Settings</Text>

                    <View style={{ padding: 16 }}>
                        {/* Logo */}
                        <View style={styles.logoSection}>
                            <TouchableOpacity
                                style={[styles.logoPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                onPress={showLogoOptions}
                                activeOpacity={canEdit ? 0.7 : 1}
                                disabled={!canEdit}
                            >
                                {logoUri ? (
                                    <Image source={{ uri: logoUri }} style={styles.logoImg} />
                                ) : originalLogoUrl && !logoRemoved ? (
                                    <Image source={{ uri: originalLogoUrl }} style={styles.logoImg} />
                                ) : (
                                    <View style={styles.logoEmpty}>
                                        <Building2 size={28} color={colors.textTertiary} />
                                    </View>
                                )}
                                {canEdit && (
                                    <View style={[styles.logoBadge, { backgroundColor: colors.primary || '#6366F1' }]}>
                                        {(logoUri || (originalLogoUrl && !logoRemoved)) ? (
                                            <Pencil size={10} color="#FFF" strokeWidth={2.5} />
                                        ) : (
                                            <Camera size={10} color="#FFF" strokeWidth={2.5} />
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                            <View style={{ flex: 1, gap: 4 }}>
                                <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>Workspace Logo</Text>
                                <Text style={[styles.logoHint, { color: colors.textTertiary }]}>
                                    {canEdit ? 'Tap to upload or change' : 'Only admins can change'}
                                </Text>
                                {canEdit && (logoUri || (originalLogoUrl && !logoRemoved)) && (
                                    <TouchableOpacity
                                        style={styles.removeBtn}
                                        onPress={() => { setLogoUri(null); setLogoRemoved(true); setHasChanges(true); }}
                                    >
                                        <X size={11} color="#EF4444" />
                                        <Text style={styles.removeBtnText}>Remove</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Name */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Workspace Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, !canEdit && styles.disabledInput]}
                                value={name}
                                onChangeText={(text) => { setName(text); setHasChanges(true); }}
                                editable={canEdit}
                                placeholder="Workspace Name"
                                placeholderTextColor={colors.textTertiary}
                                maxLength={50}
                            />
                            <Text style={[styles.charCounter, { color: colors.textTertiary }]}>{name.length}/50</Text>
                        </View>

                        {/* Description */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.multilineInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }, !canEdit && styles.disabledInput]}
                                value={description}
                                onChangeText={(text) => { setDescription(text); setHasChanges(true); }}
                                editable={canEdit}
                                placeholder="What is this workspace for?"
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                maxLength={200}
                            />
                            <Text style={[styles.charCounter, { color: colors.textTertiary }]}>{description.length}/200</Text>
                        </View>

                        {/* Workspace ID */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textTertiary }]}>Workspace ID</Text>
                            <View style={[styles.readOnlyField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Text style={[styles.readOnlyText, { color: colors.textTertiary }]} numberOfLines={1}>
                                    {currentWorkspace?.id || '—'}
                                </Text>
                            </View>
                        </View>

                        {/* Save button */}
                        {hasChanges && canEdit && (
                            <TouchableOpacity
                                style={[styles.saveBtn, (isSaving || isUploading) && { opacity: 0.7 }]}
                                onPress={handleSaveWorkspace}
                                disabled={isSaving || isUploading}
                            >
                                {isSaving || isUploading ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <ActivityIndicator color="#FFF" size="small" />
                                        <Text style={styles.saveBtnText}>{isUploading ? 'Uploading...' : 'Saving...'}</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>

                {/* 4. Danger Zone */}
                {isOwner && (
                    <Animated.View entering={FadeInDown.delay(400).springify()} style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow, borderColor: '#FEE2E2', borderWidth: 1 }]}>
                        <View style={styles.dangerHeader}>
                            <Trash2 size={16} color="#EF4444" />
                            <Text style={styles.dangerTitle}>Danger Zone</Text>
                        </View>
                        <View style={{ padding: 16, paddingTop: 0 }}>
                            <Text style={[styles.dangerText, { color: colors.textSecondary }]}>
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

    logoSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    logoPreview: {
        width: 72,
        height: 72,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        overflow: 'hidden',
    },
    logoImg: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
    },
    logoEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoBadge: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    logoHint: {
        fontSize: 12,
        fontWeight: '500',
    },
    removeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: '#FEF2F2',
    },
    removeBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#EF4444',
    },
    charCounter: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'right',
        marginTop: 4,
    },
    readOnlyField: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
    },
    readOnlyText: {
        fontSize: 13,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
