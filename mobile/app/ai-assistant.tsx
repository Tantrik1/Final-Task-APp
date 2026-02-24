import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
    Alert, Dimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft, Send, Bot, User, Sparkles, RotateCcw,
    Mic, Volume2, VolumeX, ExternalLink, CheckCircle,
    FolderOpen, UserCheck, AlertTriangle, Zap, X,
} from 'lucide-react-native';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useAIAssistant, SmartButton } from '@/hooks/useAIAssistant';
import { useTheme } from '@/contexts/ThemeContext';

const { width } = Dimensions.get('window');

// ─── Typing Indicator ─────────────────────────────────────────────────────────

const TypingIndicator = ({ status }: { status?: string }) => {
    const { colors } = useTheme();
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const pulse = (dot: Animated.Value, delay: number) =>
            Animated.loop(Animated.sequence([
                Animated.delay(delay),
                Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
                Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
            ])).start();
        pulse(dot1, 0); pulse(dot2, 180); pulse(dot3, 360);
    }, [dot1, dot2, dot3]);

    return (
        <View style={styles.typingWrap}>
            <View style={styles.dotsRow}>
                {[dot1, dot2, dot3].map((d, i) => (
                    <Animated.View key={i} style={[styles.dot, { opacity: d, backgroundColor: colors.typingIndicator }]} />
                ))}
            </View>
            {status ? <Text style={[styles.typingStatus, { color: colors.textSecondary }]}>{status}</Text> : null}
        </View>
    );
};

// ─── Markdown Text Renderer ───────────────────────────────────────────────────

const renderInline = (text: string, isUser: boolean, colors: any): React.ReactNode[] => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <Text key={i} style={[styles.boldText, { color: isUser ? '#fff' : colors.text }]}>
                    {part.slice(2, -2)}
                </Text>
            );
        }
        return <Text key={i} style={{ color: isUser ? colors.userBubbleText : colors.text }}>{part}</Text>;
    });
};

const MessageText = ({ content, isUser }: { content: string; isUser: boolean }) => {
    const { colors } = useTheme();
    const clean = content.replace(/```[\s\S]*?```/g, '').trim();
    const lines = clean.split('\n');
    return (
        <View>
            {lines.map((line, idx) => {
                const t = line.trim();
                if (t === '') return <View key={idx} style={{ height: 5 }} />;
                if (t.startsWith('- ') || t.startsWith('• ') || t.startsWith('* ')) {
                    return (
                        <View key={idx} style={styles.bulletRow}>
                            <Text style={[styles.bullet, { color: isUser ? 'rgba(255,255,255,0.7)' : colors.primary }]}>•</Text>
                            <Text style={[styles.msgText, isUser && styles.msgTextUser, { flex: 1, color: isUser ? colors.userBubbleText : colors.text }]}>
                                {renderInline(t.replace(/^[-•*]\s/, ''), isUser, colors)}
                            </Text>
                        </View>
                    );
                }
                return (
                    <Text key={idx} style={[styles.msgText, isUser && styles.msgTextUser, { color: isUser ? colors.userBubbleText : colors.text }]}>
                        {renderInline(line, isUser, colors)}
                    </Text>
                );
            })}
        </View>
    );
};

// ─── Smart Button ─────────────────────────────────────────────────────────────

const BUTTON_CONFIGS: Record<string, { icon: React.ReactNode; colors: readonly [string, string] }> = {
    open_project: { icon: <FolderOpen size={14} color="#fff" />, colors: ['#6366F1', '#4338CA'] },
    open_task: { icon: <ExternalLink size={14} color="#fff" />, colors: ['#8B5CF6', '#6D28D9'] },
    open_member: { icon: <UserCheck size={14} color="#fff" />, colors: ['#0EA5E9', '#0284C7'] },
    view_overdue: { icon: <AlertTriangle size={14} color="#fff" />, colors: ['#F97316', '#EA580C'] },
    confirm_bulk: { icon: <CheckCircle size={14} color="#fff" />, colors: ['#10B981', '#059669'] },
    reschedule_overdue: { icon: <Zap size={14} color="#fff" />, colors: ['#F59E0B', '#D97706'] },
    add_tasks: { icon: <Sparkles size={14} color="#fff" />, colors: ['#6366F1', '#4338CA'] },
    change_priority: { icon: <AlertTriangle size={14} color="#fff" />, colors: ['#EF4444', '#DC2626'] },
    start_timer: { icon: <Zap size={14} color="#fff" />, colors: ['#10B981', '#059669'] },
    suggest_redistribution: { icon: <UserCheck size={14} color="#fff" />, colors: ['#0EA5E9', '#0284C7'] },
    notify_members: { icon: <Sparkles size={14} color="#fff" />, colors: ['#8B5CF6', '#6D28D9'] },
    undo_last_action: { icon: <RotateCcw size={14} color="#fff" />, colors: ['#64748B', '#475569'] },
    speak: { icon: <Volume2 size={14} color="#fff" />, colors: ['#22C55E', '#16A34A'] },
};

const SmartButtonRow = ({ buttons, onPress }: { buttons: SmartButton[]; onPress: (btn: SmartButton) => void }) => (
    <View style={styles.smartBtnRow}>
        {buttons.map((btn, i) => {
            const cfg = BUTTON_CONFIGS[btn.action] || BUTTON_CONFIGS['open_project'];
            return (
                <TouchableOpacity key={i} onPress={() => onPress(btn)} activeOpacity={0.8} style={styles.smartBtnWrap}>
                    <LinearGradient colors={cfg.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.smartBtn}>
                        {cfg.icon}
                        <Text style={styles.smartBtnLabel}>{btn.label}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            );
        })}
    </View>
);

// ─── Welcome Hero ─────────────────────────────────────────────────────────────

const WelcomeHero = ({ onPrompt, prompts }: { onPrompt: (p: string) => void; prompts: { label: string; prompt: string }[] }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.heroWrap, { backgroundColor: colors.background }]}>
            <LinearGradient colors={[colors.primaryDark, colors.primary, colors.primaryLight]} style={styles.heroAvatar}>
                <Bot size={36} color="#fff" />
            </LinearGradient>
            <Text style={[styles.heroTitle, { color: colors.text }]}>HamroAI</Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>Your intelligent team operations assistant</Text>
            <View style={styles.heroChips}>
                {/* BUG-13 FIX: Use the `prompts` prop instead of a duplicate hardcoded list */}
                {prompts.map((p, i) => (
                    <TouchableOpacity key={i} style={[styles.heroChip, {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        shadowColor: colors.shadow
                    }]} onPress={() => onPrompt(p.prompt)} activeOpacity={0.75}>
                        <Text style={[styles.heroChipText, { color: colors.text }]}>{p.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

// ─── Strip Markdown for TTS ───────────────────────────────────────────────────

const stripMd = (t: string) =>
    t.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/```[\s\S]*?```/g, '').replace(/\n+/g, ' ').trim();

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AIAssistantScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);
    const inputRef = useRef<TextInput>(null);

    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [showQuickPrompts, setShowQuickPrompts] = useState(true);

    const { colors } = useTheme();

    const {
        messages, isLoading, inputText, setInputText,
        sendMessage, transcribeAudio, clearMessages, stopGeneration,
        retryLastMessage, lastFailedPrompt, quickPrompts,
    } = useAIAssistant();

    useEffect(() => {
        // BUG-02 FIX: Release microphone resource when screen unmounts.
        // Without this, if the user navigates away while recording, the
        // Audio.Recording object is leaked and future recordings break.
        return () => {
            if (recording) {
                recording.stopAndUnloadAsync().catch(() => { });
            }
            Speech.stop();
        };
    }, [recording]);

    useEffect(() => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    }, [messages]);

    useEffect(() => {
        if (!voiceEnabled || isLoading) return;
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant' && last.content) {
            Speech.speak(stripMd(last.content), { rate: 1.0, language: 'en-US' });
        }
    }, [messages, voiceEnabled, isLoading]);

    const handleSend = useCallback(async () => {
        if (!inputText.trim() || isLoading) return;
        const text = inputText.trim();
        setInputText('');
        setShowQuickPrompts(false);
        await sendMessage(text);
    }, [inputText, isLoading, sendMessage, setInputText]);

    const handleQuickPrompt = useCallback(async (prompt: string) => {
        setShowQuickPrompts(false);
        await sendMessage(prompt);
    }, [sendMessage]);

    const handleSmartButton = useCallback((btn: SmartButton) => {
        switch (btn.action) {
            case 'open_project':
                if (btn.id) router.push(`/project/${btn.id}` as any);
                break;
            case 'open_task':
                if (btn.id) router.push(`/task/${btn.id}` as any);
                break;
            case 'open_member':
                if (btn.id) router.push(`/member/${btn.id}` as any);
                break;
            case 'view_overdue':
                sendMessage('Show me all overdue tasks right now.');
                break;
            case 'reschedule_overdue':
                sendMessage('Suggest how to reschedule all overdue tasks.');
                break;
            case 'suggest_redistribution':
                sendMessage('Suggest how to redistribute the team workload more evenly.');
                break;
            case 'notify_members':
                sendMessage('Draft a notification message for the responsible team members about overdue tasks.');
                break;
            case 'confirm_bulk':
                if (btn.data) sendMessage(`Confirmed. Please proceed with the bulk update: ${JSON.stringify(btn.data)}`);
                break;
            case 'undo_last_action':
                sendMessage('Please undo the last action you performed.');
                break;
            case 'add_tasks':
                sendMessage(`I want to add tasks to the project${btn.id ? ` with ID ${btn.id}` : ''}.`);
                break;
            case 'change_priority':
                sendMessage(`Change the priority of the task${btn.id ? ` with ID ${btn.id}` : ''}.`);
                break;
            case 'start_timer':
                sendMessage(`Start a timer for the task${btn.id ? ` with ID ${btn.id}` : ''}.`);
                break;
            case 'speak':
                if (btn.text) {
                    Speech.speak(btn.text, {
                        language: 'en-US',
                        pitch: 1.0,
                        rate: 0.9,
                    });
                }
                break;
            default:
                break;
        }
    }, [router, sendMessage]);

    const startRecording = async () => {
        try {
            if (recording) { await recording.stopAndUnloadAsync(); setRecording(null); }
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') { Alert.alert('Permission Denied', 'Microphone access is required.'); return; }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(rec);
            setIsRecording(true);
        } catch { Alert.alert('Error', 'Could not start recording.'); }
    };

    const stopRecording = async () => {
        if (!recording) return;
        setIsRecording(false);
        setIsTranscribing(true);
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            if (uri) {
                const text = await transcribeAudio(uri);
                if (text) setInputText(text);
            }
        } catch { /* silent */ } finally { setIsTranscribing(false); }
    };

    const handleClear = () => {
        Speech.stop();
        Alert.alert('Clear Conversation', 'Start a fresh conversation?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => { clearMessages(); setShowQuickPrompts(true); } },
        ]);
    };

    const hasMessages = messages.filter(m => m.role !== 'system').length > 0;

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
            {/* Header */}
            <LinearGradient colors={[colors.primaryDark, colors.primary, colors.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
                    <ArrowLeft size={20} color="#fff" />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.headerAvatar}>
                        <Bot size={18} color="#fff" />
                    </LinearGradient>
                    <View>
                        <Text style={styles.headerTitle}>HamroAI</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, isLoading && { backgroundColor: '#FCD34D' }]} />
                            <Text style={styles.statusText}>{isLoading ? 'Working...' : 'Ready'}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => setVoiceEnabled(v => !v)}>
                        {voiceEnabled ? <Volume2 size={18} color="#A5B4FC" /> : <VolumeX size={18} color="rgba(255,255,255,0.4)" />}
                    </TouchableOpacity>
                    {isLoading && (
                        <TouchableOpacity style={styles.headerIconBtn} onPress={stopGeneration}>
                            <X size={18} color="#FCA5A5" />
                        </TouchableOpacity>
                    )}
                    {hasMessages && (
                        <TouchableOpacity style={styles.headerIconBtn} onPress={handleClear}>
                            <RotateCcw size={18} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
                <ScrollView
                    ref={scrollRef}
                    style={styles.msgList}
                    contentContainerStyle={[styles.msgListContent, { paddingBottom: 140 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Welcome / Quick Prompts */}
                    {showQuickPrompts && !hasMessages && (
                        <WelcomeHero onPrompt={handleQuickPrompt} prompts={quickPrompts} />
                    )}

                    {/* Messages */}
                    {messages.filter(m => m.role !== 'system').map(msg => {
                        const isUser = msg.role === 'user';
                        return (
                            <View key={msg.id} style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
                                {!isUser && (
                                    <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.aiAvatar}>
                                        <Bot size={16} color="#fff" />
                                    </LinearGradient>
                                )}

                                <TouchableOpacity
                                    style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI, {
                                        maxWidth: width * 0.78,
                                        backgroundColor: isUser ? colors.userBubble : colors.aiBubble,
                                        borderColor: isUser ? colors.userBubble : colors.aiBubbleBorder
                                    }]}
                                    activeOpacity={0.9}
                                    onLongPress={async () => {
                                        if (msg.content && !msg.isLoading) {
                                            await Clipboard.setStringAsync(msg.content);
                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                            Alert.alert('✅ Copied', 'Message copied to clipboard', [{ text: 'OK' }]);
                                        }
                                    }}
                                >
                                    {msg.isLoading ? (
                                        <TypingIndicator status={msg.status} />
                                    ) : (
                                        <>
                                            <MessageText content={msg.content} isUser={isUser} />
                                            {msg.buttons && msg.buttons.length > 0 && (
                                                <SmartButtonRow buttons={msg.buttons} onPress={handleSmartButton} />
                                            )}
                                            {!isUser && msg.content.startsWith('⚠️') && lastFailedPrompt && (
                                                <TouchableOpacity
                                                    style={[styles.retryBtn, {
                                                        backgroundColor: colors.primaryBg,
                                                        borderColor: colors.primary
                                                    }]}
                                                    onPress={retryLastMessage}
                                                    activeOpacity={0.8}
                                                >
                                                    <RotateCcw size={13} color={colors.primary} />
                                                    <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
                                                </TouchableOpacity>
                                            )}
                                            <Text style={[styles.timestamp, { color: isUser ? 'rgba(255,255,255,0.55)' : colors.textTertiary }]}>
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {isUser && (
                                    <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                                        <User size={16} color="#fff" />
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>

                {/* Input Bar */}
                <View style={[styles.inputArea, {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    paddingBottom: Math.max(insets.bottom, 16) + 8
                }]}>
                    <View style={styles.inputRow}>
                        <TextInput
                            ref={inputRef}
                            style={[styles.input, {
                                backgroundColor: colors.inputBg,
                                borderColor: colors.inputBorder,
                                color: colors.inputText
                            }]}
                            placeholder={isRecording ? '🎙 Listening...' : 'Ask HamroAI anything...'}
                            placeholderTextColor={colors.inputPlaceholder}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={1000}
                            returnKeyType="send"
                            onSubmitEditing={handleSend}
                        />

                        {isTranscribing ? (
                            <View style={[styles.iconBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                                <ActivityIndicator size="small" color={colors.primary} />
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.iconBtn, isRecording && styles.iconBtnActive, {
                                    backgroundColor: colors.inputBg,
                                    borderColor: colors.inputBorder
                                }]}
                                onPressIn={startRecording}
                                onPressOut={stopRecording}
                                activeOpacity={0.8}
                            >
                                <Mic size={20} color={isRecording ? '#fff' : colors.primary} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.sendBtn, {
                                backgroundColor: colors.primary,
                                borderColor: colors.primary,
                                opacity: (!inputText.trim() || isLoading) ? 0.5 : 1
                            }]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || isLoading}
                            activeOpacity={0.85}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Send size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Quick prompt chips when input is empty */}
                    {!hasMessages && !showQuickPrompts && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                            {quickPrompts.slice(0, 4).map((p, i) => (
                                <TouchableOpacity key={i} style={[styles.chip, { backgroundColor: colors.primaryBg }]} onPress={() => handleQuickPrompt(p.prompt)}>
                                    <Text style={[styles.chipText, { color: colors.primary }]}>{p.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
    headerBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
    statusText: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
    headerActions: { flexDirection: 'row', gap: 6 },
    headerIconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

    // Messages
    msgList: { flex: 1 },
    msgListContent: { paddingHorizontal: 14, paddingTop: 16, gap: 16 },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    msgRowUser: { justifyContent: 'flex-end' },
    msgRowAI: { justifyContent: 'flex-start' },
    aiAvatar: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    userAvatar: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
    bubbleUser: { borderBottomRightRadius: 4 },
    bubbleAI: { borderBottomLeftRadius: 4 },

    // Text
    msgText: { fontSize: 15, lineHeight: 22 },
    msgTextUser: { color: '#fff' },
    boldText: { fontWeight: '700', color: '#1E293B' },
    bulletRow: { flexDirection: 'row', gap: 6, marginVertical: 1 },
    bullet: { fontSize: 15, color: '#6366F1', lineHeight: 22, width: 14 },
    timestamp: { fontSize: 10, color: '#94A3B8', marginTop: 6, alignSelf: 'flex-end' },

    // Typing
    typingWrap: { gap: 6 },
    dotsRow: { flexDirection: 'row', gap: 5, alignItems: 'center', height: 24 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366F1' },
    typingStatus: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },

    // Smart Buttons
    smartBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
    smartBtnWrap: { borderRadius: 10, overflow: 'hidden' },
    smartBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
    smartBtnLabel: { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

    // Welcome Hero
    heroWrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, gap: 12 },
    heroAvatar: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    heroTitle: { fontSize: 28, fontWeight: '900', color: '#1E1B4B', letterSpacing: 0.5 },
    heroSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
    heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center', marginTop: 8 },
    heroChip: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: '#E2E8F0', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
    heroChipText: { fontSize: 13, fontWeight: '600', color: '#334155' },

    // Input
    inputArea: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, paddingHorizontal: 14 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    input: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15, color: '#1E293B', maxHeight: 120, borderWidth: 1.5, borderColor: '#E2E8F0' },
    iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
    iconBtnActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    sendBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#4338CA', alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { backgroundColor: '#C7D2FE' },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' },
    retryText: { fontSize: 12, fontWeight: '600', color: '#6366F1' },
    chipScroll: { marginTop: 8 },
    chip: { backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
    chipText: { fontSize: 12, fontWeight: '600', color: '#4338CA' },
});
