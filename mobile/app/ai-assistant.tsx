import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    Dimensions,
    Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Send,
    Bot,
    User,
    Sparkles,
    RefreshCw,
    Trash2,
    Zap,
    CheckSquare,
    FolderKanban,
    Users,
    MessageSquare,
    ChevronRight,
    X,
    RotateCcw,
    Mic,
    MicOff,
    Volume2,
    VolumeX,
    History,
} from 'lucide-react-native';

import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useAIAssistant, AIAction } from '@/hooks/useAIAssistant';
import { GlobalTabBar } from '@/components/GlobalTabBar';

const { width } = Dimensions.get('window');

// ─── Typing Indicator ─────────────────────────────────────────────────────────

const TypingIndicator = ({ status }: { status?: string }) => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = (dot: Animated.Value, delay: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
                ])
            ).start();
        };
        animate(dot1, 0);
        animate(dot2, 200);
        animate(dot3, 400);
    }, [dot1, dot2, dot3]);

    return (
        <View style={styles.typingContainer}>
            <View style={styles.dotsRow}>
                <Animated.View style={[styles.dot, { opacity: dot1 }]} />
                <Animated.View style={[styles.dot, { opacity: dot2 }]} />
                <Animated.View style={[styles.dot, { opacity: dot3 }]} />
            </View>
            {status && <Text style={styles.typingStatus}>{status}</Text>}
        </View>
    );
};

// ─── Markdown-like Text Renderer ──────────────────────────────────────────────

const MessageText = ({ content, isUser }: { content: string; isUser: boolean }) => {
    // Safety check: strip any leftover code blocks that the parser might have missed
    const cleanContent = content.replace(/```[\s\S]*?```/g, '').trim();
    const lines = cleanContent.split('\n');

    return (
        <View style={styles.messageContentContainer}>

            {lines.map((line, idx) => {
                const trimmedLine = line.trim();

                if (trimmedLine.startsWith('•') || trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                    const bulletText = trimmedLine.replace(/^[•\-*]\s*/, '');
                    return (
                        <View key={idx} style={styles.bulletRow}>
                            <Text style={[styles.bulletPoint, isUser && styles.messageTextUser]}>•</Text>
                            <Text style={[styles.messageText, isUser && styles.messageTextUser, { flex: 1 }]}>
                                {renderFormattedText(bulletText, isUser)}
                            </Text>
                        </View>
                    );
                }

                if (/^\d+\.\s/.test(trimmedLine)) {
                    const [num, ...rest] = trimmedLine.split('.');
                    const listText = rest.join('.').trim();
                    return (
                        <View key={idx} style={styles.bulletRow}>
                            <Text style={[styles.bulletPoint, isUser && styles.messageTextUser, { fontSize: 13 }]}>{num}.</Text>
                            <Text style={[styles.messageText, isUser && styles.messageTextUser, { flex: 1 }]}>
                                {renderFormattedText(listText, isUser)}
                            </Text>
                        </View>
                    );
                }

                if (trimmedLine === '') return <View key={idx} style={{ height: 6 }} />;

                return (
                    <Text key={idx} style={[styles.messageText, isUser && styles.messageTextUser]}>
                        {renderFormattedText(line, isUser)}
                    </Text>
                );
            })}
        </View>
    );
};

// ─── Deep Link Component ──────────────────────────────────────────────────────

const DeepLink = ({ type, id, label, isUser }: { type: 'task' | 'project'; id: string; label: string; isUser: boolean }) => {
    const router = useRouter();

    const handlePress = () => {
        if (type === 'task') {
            router.push(`/task/${id}`);
        } else {
            router.push(`/project/${id}`);
        }
    };

    return (
        <Text
            onPress={handlePress}
            style={[
                styles.deepLinkText,
                type === 'task' ? styles.taskLinkText : styles.projectLinkText,
                isUser && { color: '#BAE6FD', textDecorationLine: 'underline' }
            ]}
        >
            {type === 'task' ? '⚑ ' : '📁 '}
            {label}
        </Text>
    );
};


// Helper for stripping markdown for speech
const stripMarkdown = (text: string): string => {
    return text
        .replace(/\[\[task:.*?:(.*?)\]\]/g, '$1') // Extract title from deep links
        .replace(/\[\[project:.*?:(.*?)\]\]/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1') // Italics
        .replace(/`{1,3}[\s\S]*?`{1,3}/g, '') // Code blocks (using [\s\S] instead of /s flag)
        .replace(/#+\s/g, '') // Headers
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
        .replace(/\n\s*[-*]\s/g, '. ') // Bullet points to sentences
        .replace(/\n\s*\d+\.\s/g, '. ') // Numbered lists to sentences
        .replace(/\n+/g, ' ') // Multiple newlines to space
        .trim();
};

// Helper for formatted text with bold and deep links
const renderFormattedText = (text: string, isUser: boolean) => {
    // Regex to find: 
    // 1. Bold: **text**
    // 2. Deep links: [[type:id:label]]
    const parts = text.split(/(\*\*.*?\*\*|\[\[(?:task|project):.*?:.*?\]\])/g);

    return parts.map((part, pIdx) => {
        // Handle Bold
        if (part.startsWith('**') && part.endsWith('**')) {
            const boldText = part.slice(2, -2);
            return (
                <Text key={pIdx} style={[styles.boldText, isUser && { color: '#FFFFFF' }]}>
                    {boldText}
                </Text>
            );
        }

        // Handle Deep Links
        const deepLinkMatch = part.match(/^\[\[(task|project):(.*):(.*)\]\]$/);
        if (deepLinkMatch) {
            const [, type, id, label] = deepLinkMatch;
            return (
                <DeepLink key={pIdx} type={type as 'task' | 'project'} id={id} label={label} isUser={isUser} />
            );
        }

        return part;
    });
};


// ─── Action Button ────────────────────────────────────────────────────────────

const ActionButton = ({ action, onExecute }: { action: AIAction; onExecute: (action: AIAction) => void }) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [isDone, setIsDone] = useState(false);

    const getActionIcon = () => {
        switch (action.type) {
            case 'create_task': return <CheckSquare size={16} color="#FFFFFF" />;
            case 'create_project': return <FolderKanban size={16} color="#FFFFFF" />;
            case 'update_task': return <Zap size={16} color="#FFFFFF" />;
            case 'invite_member': return <Users size={16} color="#FFFFFF" />;
            default: return <Sparkles size={16} color="#FFFFFF" />;
        }
    };

    const getActionColor = () => {
        switch (action.type) {
            case 'create_task': return ['#6366F1', '#4338CA'] as const;
            case 'create_project': return ['#8B5CF6', '#6D28D9'] as const;
            case 'update_task': return ['#F97316', '#EA580C'] as const;
            case 'invite_member': return ['#10B981', '#059669'] as const;
            default: return ['#4F46E5', '#3730A3'] as const;
        }
    };

    const handlePress = async () => {
        if (isDone || isExecuting) return;
        setIsExecuting(true);
        await onExecute(action);
        setIsExecuting(false);
        setIsDone(true);
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={isDone || isExecuting}
            activeOpacity={0.8}
            style={styles.actionButtonWrapper}
        >
            <LinearGradient
                colors={isDone ? ['#10B981', '#059669'] : getActionColor()}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButton}
            >
                <View style={styles.actionIconContainer}>
                    {isExecuting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        getActionIcon()
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.actionButtonLabel}>RECOMENDED ACTION</Text>
                    <Text style={styles.actionButtonText}>
                        {isDone ? 'Action Completed' : isExecuting ? 'Processing...' : action.label}
                    </Text>
                </View>
                {!isDone && !isExecuting && <ChevronRight size={18} color="rgba(255,255,255,0.7)" />}
            </LinearGradient>
        </TouchableOpacity>
    );
};

// ─── Quick Prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
    { label: '� Strategic Audit', prompt: 'Perform a comprehensive health audit of the workspace. Identify stuck tasks, workload imbalances, and strategic bottlenecks.' },
    { label: '📈 Velocity Report', prompt: 'Analyze our production velocity for the last 7 days. Compare created vs completed tasks and identify trends.' },
    { label: '⚡ Action Planning', prompt: 'Suggest a high-impact plan to clear current bottlenecks and optimize team performance.' },
    { label: '� Workload Review', prompt: 'Review team workload distribution. Are there any members overloaded or under-capacity?' },
];


// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AIAssistantScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);
    const inputRef = useRef<TextInput>(null);
    const [inputText, setInputText] = useState('');
    const [showQuickPrompts, setShowQuickPrompts] = useState(true);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [showHistory, setShowHistory] = useState(false);


    const {
        messages,
        isLoading,
        isContextLoading,
        sendMessage,
        executeAction,
        clearChat,
        loadContext,
        transcribeAudio,
        isTranscribing,
        conversations,
        activeConversationId,
        loadConversation,
    } = useAIAssistant();


    useEffect(() => {
        loadContext();
    }, [loadContext]);

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && isVoiceEnabled && !isLoading) {
            const cleanText = stripMarkdown(lastMessage.content);
            Speech.speak(cleanText, {
                rate: 1.0,
                pitch: 1.0,
                language: 'en-US'
            });
        }
    }, [messages, isVoiceEnabled, isLoading]);

    useEffect(() => {
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages]);

    const handleSend = useCallback(async () => {
        if (!inputText.trim() || isLoading) return;
        const text = inputText.trim();
        setInputText('');
        setShowQuickPrompts(false);
        await sendMessage(text);
    }, [inputText, isLoading, sendMessage]);

    const handleQuickPrompt = useCallback(async (prompt: string) => {
        setShowQuickPrompts(false);
        await sendMessage(prompt);
    }, [sendMessage]);

    const startRecording = async () => {
        try {
            // Ensure any previous recording is unloaded
            if (recording) {
                await recording.stopAndUnloadAsync();
                setRecording(null);
            }

            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Microphone access is required for voice commands.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(newRecording);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Microphone Error', 'Could not start recording. Please try again.');
        }
    };


    const stopRecording = async () => {
        if (!recording) return;
        setIsRecording(false);
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            if (uri) {
                const text = await transcribeAudio(uri);
                if (text) {
                    setInputText(text);
                    // Optionally auto-send
                    // await sendMessage(text);
                }
            }
        } catch (err) {
            console.error('Failed to stop recording', err);
        }
    };

    const handleClear = () => {
        Speech.stop();
        Alert.alert(
            'Clear Conversation',
            'This will reset the intelligence stream. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => {
                        clearChat();
                        setShowQuickPrompts(true);
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <LinearGradient
                colors={['#1E1B4B', '#312E81', '#4338CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={22} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <View style={styles.aiAvatarSmall}>
                        <Bot size={20} color="#FFFFFF" />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>HamroAI Intelligence</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, isContextLoading && { backgroundColor: '#FCD34D' }]} />
                            <Text style={styles.statusText}>
                                {isContextLoading ? 'Analyzing Workspace...' : 'Active Intelligence'}
                            </Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => setIsVoiceEnabled(!isVoiceEnabled)}
                >
                    {isVoiceEnabled ? <Volume2 size={20} color="#FFFFFF" /> : <VolumeX size={20} color="rgba(255,255,255,0.5)" />}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => setShowHistory(!showHistory)}
                >
                    <History size={20} color={showHistory ? "#6366F1" : "rgba(255,255,255,0.7)"} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={handleClear}
                >
                    <RotateCcw size={18} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>

            </LinearGradient>

            {isContextLoading && (
                <View style={styles.contextBanner}>
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <Text style={styles.contextBannerText}>Synchronizing with live workspace data...</Text>
                </View>
            )}

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    ref={scrollRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={[
                        styles.messagesContent,
                        { paddingBottom: 160 }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {showQuickPrompts && messages.length <= 1 && (
                        <View style={styles.quickPromptsContainer}>
                            <Text style={styles.quickPromptsTitle}>Command Center</Text>
                            <View style={styles.quickPromptsGrid}>
                                {QUICK_PROMPTS.map((qp, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.quickPromptChip}
                                        onPress={() => handleQuickPrompt(qp.prompt)}
                                    >
                                        <Text style={styles.quickPromptText}>{qp.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {messages.map((message) => (
                        <View
                            key={message.id}
                            style={[
                                styles.messageRow,
                                message.role === 'user' ? styles.messageRowUser : styles.messageRowAI,
                            ]}
                        >
                            {message.role === 'assistant' && (
                                <LinearGradient
                                    colors={['#4338CA', '#6366F1']}
                                    style={styles.aiAvatar}
                                >
                                    <Bot size={18} color="#FFFFFF" />
                                </LinearGradient>
                            )}

                            <View style={[
                                styles.messageBubble,
                                message.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleAI,
                            ]}>
                                {message.isLoading ? (
                                    <TypingIndicator status={message.status} />
                                ) : (
                                    <>
                                        <MessageText
                                            content={message.content}
                                            isUser={message.role === 'user'}
                                        />
                                        {message.actions && message.actions.map((action, actionIdx) => (
                                            <ActionButton
                                                key={actionIdx}
                                                action={action}
                                                onExecute={executeAction}
                                            />
                                        ))}
                                        <Text style={[
                                            styles.timestamp,
                                            message.role === 'user' && { color: 'rgba(255,255,255,0.6)' }
                                        ]}>
                                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>

                                    </>
                                )}
                            </View>

                            {message.role === 'user' && (
                                <View style={styles.userAvatar}>
                                    <User size={18} color="#FFFFFF" />
                                </View>
                            )}
                        </View>
                    ))}
                </ScrollView>

                <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>

                    <View style={styles.inputContainer}>
                        <TextInput
                            ref={inputRef}
                            style={styles.textInput}
                            placeholder={isRecording ? "Listening..." : "Deploy a command or query..."}
                            placeholderTextColor="#94A3B8"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={1000}
                            onSubmitEditing={handleSend}
                        />

                        {isTranscribing ? (
                            <View style={styles.transcribingContainer}>
                                <ActivityIndicator size="small" color="#6366F1" />
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.micButton,
                                    isRecording && styles.micButtonActive
                                ]}
                                onPressIn={startRecording}
                                onPressOut={stopRecording}
                            >
                                {isRecording ? (
                                    <Mic size={20} color="#FFFFFF" />
                                ) : (
                                    <Mic size={20} color="#6366F1" />
                                )}
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
                            ]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Send size={20} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* History Panel Overlay */}
            {showHistory && (
                <View style={styles.historyOverlay}>
                    <TouchableOpacity
                        style={styles.historyBackdrop}
                        onPress={() => setShowHistory(false)}
                        activeOpacity={1}
                    />
                    <View style={styles.historyPanel}>
                        <View style={styles.historyHeader}>
                            <Text style={styles.historyTitle}>Strategic History</Text>
                            <TouchableOpacity onPress={() => setShowHistory(false)}>
                                <X size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.newChatBtn}
                            onPress={() => {
                                clearChat();
                                setShowHistory(false);
                            }}
                        >
                            <Sparkles size={16} color="#6366F1" />
                            <Text style={styles.newChatBtnText}>Start New Strategic Stream</Text>
                        </TouchableOpacity>

                        <ScrollView style={styles.historyList}>

                            {conversations.map((conv) => (
                                <TouchableOpacity
                                    key={conv.id}
                                    style={[
                                        styles.historyItem,
                                        activeConversationId === conv.id && styles.historyItemActive
                                    ]}
                                    onPress={() => {
                                        loadConversation(conv.id);
                                        setShowHistory(false);
                                    }}
                                >
                                    <MessageSquare size={16} color={activeConversationId === conv.id ? "#6366F1" : "#94A3B8"} />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[
                                            styles.historyItemTitle,
                                            activeConversationId === conv.id && styles.historyItemTitleActive
                                        ]} numberOfLines={1}>
                                            {conv.title}
                                        </Text>
                                        <Text style={styles.historyItemDate}>
                                            {new Date(conv.updated_at).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <ChevronRight size={16} color="#E2E8F0" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            )
            }
        </View >
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    aiAvatarSmall: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 1,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4ADE80',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    statusText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contextBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(99, 102, 241, 0.2)',
    },
    contextBannerText: {
        fontSize: 12,
        color: '#4F46E5',
        fontWeight: '600',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
        gap: 20,
    },
    quickPromptsContainer: {
        marginBottom: 10,
    },
    quickPromptsTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 12,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    quickPromptsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
    },
    quickPromptChip: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    quickPromptText: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        marginBottom: 4,
    },
    messageRowUser: {
        justifyContent: 'flex-end',
    },
    messageRowAI: {
        justifyContent: 'flex-start',
    },
    aiAvatar: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        shadowColor: '#4338CA',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    userAvatar: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#F97316',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    messageBubble: {
        maxWidth: width * 0.78,
        borderRadius: 20,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    messageBubbleUser: {
        backgroundColor: '#4338CA',
        borderBottomRightRadius: 4,
    },
    messageBubbleAI: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    messageContentContainer: {
        gap: 4,
    },
    messageText: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 22,
    },
    messageTextUser: {
        color: '#FFFFFF',
    },
    bulletRow: {
        flexDirection: 'row',
        gap: 8,
        marginVertical: 2,
    },
    bulletPoint: {
        fontSize: 16,
        color: '#6366F1',
        fontWeight: 'bold',
    },
    boldText: {
        fontWeight: '800',
        color: '#1E293B',
    },
    deepLinkText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4338CA',
    },
    taskLinkText: {
        color: '#4338CA',
        fontWeight: '800',
    },
    projectLinkText: {
        color: '#7C3AED',
        fontWeight: '800',
    },
    timestamp: {


        fontSize: 10,
        color: '#94A3B8',
        marginTop: 8,
        textAlign: 'right',
        fontWeight: '600',
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    typingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6366F1',
    },
    actionButtonWrapper: {
        marginTop: 15,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    actionIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 1,
        marginBottom: 2,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    inputArea: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingHorizontal: 16,
        paddingTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#1E293B',
        maxHeight: 120,
        paddingVertical: 4,
        lineHeight: 22,
    },
    micButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    micButtonActive: {
        backgroundColor: '#EF4444',
    },
    transcribingContainer: {
        width: 42,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButton: {

        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#4338CA',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        shadowColor: '#4338CA',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    sendButtonDisabled: {
        backgroundColor: '#E2E8F0',
        shadowOpacity: 0,
    },
    inputHint: {
        fontSize: 11,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 4,
        fontWeight: '500',
    },
    // History Styles
    historyOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    historyBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
    },
    historyPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 24,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 20,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    historyTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1E293B',
    },
    newChatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderRadius: 16,
        paddingVertical: 14,
        gap: 10,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
    },
    newChatBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4338CA',
    },
    historyList: {
        flex: 1,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    historyItemActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    historyItemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155',
    },
    historyItemTitleActive: {
        color: '#4338CA',
        fontWeight: '700',
    },
    historyItemDate: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 8,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6366F1',
    },
    typingStatus: {
        fontSize: 12,
        color: '#64748B',
        fontStyle: 'italic',
    },
});

