import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image,
    StyleSheet, ScrollView, KeyboardAvoidingView,
    Platform, ActivityIndicator, Alert, ActionSheetIOS,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Building2, Sparkles, Camera, X, Pencil } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

const ACCENT_COLOR = '#6366F1';

export default function CreateWorkspaceScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { createWorkspace, setCurrentWorkspaceId } = useWorkspace();
    const { user } = useAuth();
    const { colors, colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [logoUri, setLogoUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [nameFocused, setNameFocused] = useState(false);
    const [descFocused, setDescFocused] = useState(false);

    const nameError = name.trim().length > 0 && name.trim().length < 2;
    const canSubmit = name.trim().length >= 2 && !isLoading;
    const initial = name.trim().charAt(0).toUpperCase() || '?';

    // ─── Image Picker ────────────────────────────────────────────
    const pickFromGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant photo library access to upload a logo.');
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
        }
    };

    const pickFromCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera access to take a photo.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setLogoUri(result.assets[0].uri);
        }
    };

    const showImageOptions = () => {
        if (Platform.OS === 'ios') {
            const options = logoUri
                ? ['Choose from Library', 'Take Photo', 'Remove Logo', 'Cancel']
                : ['Choose from Library', 'Take Photo', 'Cancel'];
            ActionSheetIOS.showActionSheetWithOptions(
                { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: logoUri ? 2 : undefined },
                (idx) => {
                    if (idx === 0) pickFromGallery();
                    else if (idx === 1) pickFromCamera();
                    else if (idx === 2 && logoUri) setLogoUri(null);
                },
            );
        } else {
            Alert.alert('Workspace Logo', 'Choose an option', [
                { text: 'Choose from Library', onPress: pickFromGallery },
                { text: 'Take Photo', onPress: pickFromCamera },
                ...(logoUri ? [{ text: 'Remove Logo', style: 'destructive' as const, onPress: () => setLogoUri(null) }] : []),
                { text: 'Cancel', style: 'cancel' as const },
            ]);
        }
    };

    // ─── Upload Logo to Supabase Storage ─────────────────────────
    const uploadLogo = async (workspaceId: string): Promise<string | null> => {
        if (!logoUri) return null;
        try {
            setIsUploading(true);
            const ext = logoUri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${workspaceId}/logo_${Date.now()}.${ext}`;
            const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

            // Fetch blob from local URI
            const response = await fetch(logoUri);
            const blob = await response.blob();

            // Convert blob to ArrayBuffer for Supabase upload
            const arrayBuffer = await new Response(blob).arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from('workspace-logos')
                .upload(fileName, arrayBuffer, {
                    contentType: mimeType,
                    upsert: true,
                });

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

    // ─── Create Handler ──────────────────────────────────────────
    const handleCreate = async () => {
        if (!canSubmit) return;
        setIsLoading(true);
        try {
            // WS-03: Uniqueness check — prevent duplicate workspace names for this user
            const { count, error: checkError } = await supabase
                .from('workspaces')
                .select('id', { count: 'exact', head: true })
                .ilike('name', name.trim())
                .eq('created_by', user?.id ?? '');

            if (checkError) throw checkError;
            if (count && count > 0) {
                Alert.alert(
                    'Name Already Used',
                    `You already have a workspace called "${name.trim()}". Please choose a different name.`
                );
                return;
            }

            const { data, error } = await createWorkspace(name.trim(), description.trim() || undefined);
            if (error) throw error;
            if (data) {
                // WS-02: Upload logo and surface failure to user with retry/continue options
                if (logoUri) {
                    const logoUrl = await uploadLogo(data.id);
                    if (logoUrl) {
                        await supabase.from('workspaces').update({ logo_url: logoUrl }).eq('id', data.id);
                    } else {
                        // Logo upload silently failed — ask user if they want to retry
                        await new Promise<void>((resolve) => {
                            Alert.alert(
                                'Logo Upload Failed',
                                'The workspace was created but the logo could not be uploaded. You can add it later from workspace settings.',
                                [
                                    {
                                        text: 'Retry Upload',
                                        onPress: async () => {
                                            const retryUrl = await uploadLogo(data.id);
                                            if (retryUrl) {
                                                await supabase.from('workspaces').update({ logo_url: retryUrl }).eq('id', data.id);
                                            }
                                            resolve();
                                        },
                                    },
                                    { text: 'Continue Without Logo', style: 'cancel', onPress: () => resolve() },
                                ]
                            );
                        });
                    }
                }
                setCurrentWorkspaceId(data.id);
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to create workspace. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.root, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <View style={[
                styles.header,
                {
                    paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0),
                    backgroundColor: colors.card,
                    borderBottomColor: colors.border,
                }
            ]}>
                <TouchableOpacity
                    style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => router.back()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <ArrowLeft size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>New Workspace</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Logo upload */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity
                        style={[styles.avatarPreview, { backgroundColor: isDark ? colors.surface : '#F1F5F9', borderColor: colors.border }]}
                        onPress={showImageOptions}
                        activeOpacity={0.8}
                    >
                        {logoUri ? (
                            <Image source={{ uri: logoUri }} style={styles.logoImage} />
                        ) : (
                            <View style={styles.logoPlaceholder}>
                                {name.trim() ? (
                                    <Text style={[styles.logoInitial, { color: ACCENT_COLOR }]}>{initial}</Text>
                                ) : (
                                    <Building2 size={32} color={colors.textTertiary} />
                                )}
                            </View>
                        )}
                        {/* Edit badge */}
                        <View style={[styles.editBadge, { backgroundColor: ACCENT_COLOR }]}>
                            {logoUri ? (
                                <Pencil size={11} color="#FFF" strokeWidth={2.5} />
                            ) : (
                                <Camera size={11} color="#FFF" strokeWidth={2.5} />
                            )}
                        </View>
                    </TouchableOpacity>

                    <Text style={[styles.avatarHint, { color: colors.textTertiary }]}>
                        {logoUri ? 'Tap to change logo' : 'Tap to upload workspace logo'}
                    </Text>

                    {logoUri && (
                        <TouchableOpacity
                            style={[styles.removeLogo, { backgroundColor: isDark ? '#2D1515' : '#FEF2F2', borderColor: isDark ? '#7F1D1D' : '#FECACA' }]}
                            onPress={() => setLogoUri(null)}
                        >
                            <X size={12} color="#EF4444" />
                            <Text style={styles.removeLogoText}>Remove</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Name input */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WORKSPACE NAME</Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                color: colors.text,
                                backgroundColor: isDark ? colors.surface : '#F8FAFC',
                                borderColor: nameError ? colors.error : nameFocused ? ACCENT_COLOR : colors.border,
                            },
                        ]}
                        placeholder="e.g. Acme Corp, My Team..."
                        placeholderTextColor={colors.textMuted}
                        value={name}
                        onChangeText={setName}
                        onFocus={() => setNameFocused(true)}
                        onBlur={() => setNameFocused(false)}
                        maxLength={50}
                        autoCapitalize="words"
                        returnKeyType="next"
                    />
                    {nameError && (
                        <Text style={[styles.errorText, { color: colors.error }]}>
                            Name must be at least 2 characters
                        </Text>
                    )}
                    <Text style={[styles.charCount, { color: colors.textMuted }]}>{name.length}/50</Text>
                </View>

                {/* Description input */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DESCRIPTION <Text style={{ fontWeight: '400' }}>(optional)</Text></Text>
                    <TextInput
                        style={[
                            styles.input,
                            styles.textArea,
                            {
                                color: colors.text,
                                backgroundColor: isDark ? colors.surface : '#F8FAFC',
                                borderColor: descFocused ? ACCENT_COLOR : colors.border,
                            },
                        ]}
                        placeholder="What is this workspace for?"
                        placeholderTextColor={colors.textMuted}
                        value={description}
                        onChangeText={setDescription}
                        onFocus={() => setDescFocused(true)}
                        onBlur={() => setDescFocused(false)}
                        maxLength={200}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        returnKeyType="done"
                    />
                    <Text style={[styles.charCount, { color: colors.textMuted }]}>{description.length}/200</Text>
                </View>

                {/* Info box */}
                <View style={[styles.infoBox, { backgroundColor: ACCENT_COLOR + '12', borderColor: ACCENT_COLOR + '30' }]}>
                    <Sparkles size={16} color={ACCENT_COLOR} />
                    <Text style={[styles.infoText, { color: isDark ? colors.textSecondary : '#475569' }]}>
                        You'll be the <Text style={{ fontWeight: '700', color: ACCENT_COLOR }}>owner</Text> of this workspace. You can invite team members after creation.
                    </Text>
                </View>

                {/* Create button */}
                <TouchableOpacity
                    style={[
                        styles.createBtn,
                        { backgroundColor: ACCENT_COLOR },
                        !canSubmit && { opacity: 0.5 },
                    ]}
                    onPress={handleCreate}
                    disabled={!canSubmit}
                    activeOpacity={0.85}
                >
                    {isLoading ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator color="#FFF" size="small" />
                            {isUploading && <Text style={styles.loadingText}>Uploading logo...</Text>}
                        </View>
                    ) : (
                        <>
                            <Building2 size={18} color="#FFF" />
                            <Text style={styles.createBtnText}>Create Workspace</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    content: {
        padding: 16,
        gap: 12,
    },
    avatarSection: {
        alignItems: 'center',
        paddingVertical: 16,
        gap: 10,
    },
    avatarPreview: {
        width: 96,
        height: 96,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    logoImage: {
        width: '100%',
        height: '100%',
        borderRadius: 26,
    },
    logoPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoInitial: {
        fontSize: 36,
        fontWeight: '800',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
        borderColor: '#FFF',
    },
    avatarHint: {
        fontSize: 13,
        fontWeight: '500',
    },
    removeLogo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
    },
    removeLogoText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EF4444',
    },
    card: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        gap: 10,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    input: {
        height: 44,
        borderRadius: 10,
        borderWidth: 1.5,
        paddingHorizontal: 12,
        fontSize: 15,
        fontWeight: '500',
    },
    textArea: {
        height: 88,
        paddingTop: 12,
    },
    errorText: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: -4,
    },
    charCount: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'right',
        marginTop: -4,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 14,
        marginTop: 4,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
            android: { elevation: 4 },
        }),
    },
    createBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
