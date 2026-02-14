import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    ActivityIndicator,
    Alert,
    Platform,
    Modal,
    ScrollView,
    Image,
    Keyboard,
    Animated,
    useWindowDimensions,
    LayoutAnimation,
    UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
    Hash,
    Send,
    Plus,
    X,
    Reply,
    Edit3,
    Trash2,
    MessageCircle,
    ChevronDown,
    Search,
    MoreHorizontal,

    Smile,
    ArrowLeft,
    Users,
    User,
    MessageSquare,
} from 'lucide-react-native';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { useChat, Channel } from '@/hooks/useChat';
import { useChatMessages, Message } from '@/hooks/useChatMessages';
import { useDirectMessages, DMConversation } from '@/hooks/useDirectMessages';
import { useDMMessages, DMMessage } from '@/hooks/useDMMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import EmojiPicker from 'rn-emoji-keyboard';
import { useLocalSearchParams } from 'expo-router';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Responsive breakpoints
const useResponsive = () => {
    const { width, height } = useWindowDimensions();
    const isTablet = width >= 768;
    const isLandscape = width > height;
    const scale = Math.min(width / 390, 1.3); // 390 = iPhone 14 baseline

    return {
        isTablet,
        isLandscape,
        scale,
        inputFontSize: isTablet ? 18 : 16,
        inputMinHeight: isTablet ? 52 : 44,
        inputMaxHeight: isTablet ? 180 : (isLandscape ? 80 : 120),
        inputPaddingH: isTablet ? 20 : 16,
        sendBtnSize: isTablet ? 48 : 40,
        inputBorderRadius: isTablet ? 28 : 22,
        containerPaddingH: isTablet ? 24 : 12,
        emojiBtnSize: isTablet ? 40 : 34,
    };
};

export default function ChatScreen() {
    const insets = useSafeAreaInsets();
    const { currentWorkspace } = useWorkspace();
    const { user } = useAuth();
    const params = useLocalSearchParams();
    const responsive = useResponsive();

    // Active tab: 'channels' or 'dms'
    const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');

    // Channel hooks
    const {
        channels, activeChannel, setActiveChannel,
        isLoading: channelsLoading, createChannel, markChannelAsRead,
    } = useChat(currentWorkspace?.id);

    // DM hooks
    const {
        conversations, activeConversation, setActiveConversation,
        isLoading: dmsLoading, startConversation, markAsRead: markDMAsRead,
        totalUnreadCount: dmUnreadCount,
    } = useDirectMessages(currentWorkspace?.id);

    // Channel messages
    const {
        messages: channelMessages, isLoading: channelMessagesLoading, isSending: channelSending,
        hasMore: channelHasMore, loadMore: channelLoadMore,
        sendMessage: sendChannelMessage, editMessage: editChannelMessage,
        deleteMessage: deleteChannelMessage, replyingTo, setReplyingTo,
    } = useChatMessages(activeTab === 'channels' ? activeChannel?.id : undefined);

    // DM messages
    const {
        messages: dmMessages, isLoading: dmMessagesLoading, isSending: dmSending,
        hasMore: dmHasMore, loadMore: dmLoadMore,
        sendMessage: sendDMMessage, editMessage: editDMMessage,
        deleteMessage: deleteDMMessage,
    } = useDMMessages(activeTab === 'dms' ? activeConversation?.id : undefined);

    // Typing indicator & presence
    const currentChatId = activeTab === 'channels' ? activeChannel?.id : activeConversation?.id;
    const { typingText, startTyping, stopTyping } = useTypingIndicator(currentChatId);
    const { onlineCount, isUserOnline } = useOnlinePresence(currentWorkspace?.id);

    // Unified accessors
    const messages = activeTab === 'channels' ? channelMessages : dmMessages as any[];
    const messagesLoading = activeTab === 'channels' ? channelMessagesLoading : dmMessagesLoading;
    const isSending = activeTab === 'channels' ? channelSending : dmSending;
    const hasMore = activeTab === 'channels' ? channelHasMore : dmHasMore;
    const loadMore = activeTab === 'channels' ? channelLoadMore : dmLoadMore;
    const sendMessage = activeTab === 'channels' ? sendChannelMessage : sendDMMessage;
    const editMessage = activeTab === 'channels' ? editChannelMessage : editDMMessage;
    const deleteMessage = activeTab === 'channels' ? deleteChannelMessage : deleteDMMessage;

    // Start DM state
    const [showStartDM, setShowStartDM] = useState(false);
    const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    const [showChannelList, setShowChannelList] = useState(false);
    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [messageText, setMessageText] = useState('');
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    // ─── Advanced Keyboard Handling (Messenger-like) ───
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const keyboardHeight = useRef(new Animated.Value(0)).current;
    const inputHeight = useRef(new Animated.Value(responsive.inputMinHeight)).current;
    const sendBtnScale = useRef(new Animated.Value(0)).current;
    const sendBtnOpacity = useRef(new Animated.Value(0.5)).current;
    const [inputContentHeight, setInputContentHeight] = useState(responsive.inputMinHeight);

    // Animate send button based on messageText
    useEffect(() => {
        const hasText = messageText.trim().length > 0;
        Animated.parallel([
            Animated.spring(sendBtnScale, {
                toValue: hasText ? 1 : 0.85,
                friction: 8,
                tension: 100,
                useNativeDriver: true,
            }),
            Animated.timing(sendBtnOpacity, {
                toValue: hasText ? 1 : 0.5,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start();
    }, [messageText]);

    // Smooth keyboard animation
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (e) => {
            setKeyboardVisible(true);
            Animated.timing(keyboardHeight, {
                toValue: e.endCoordinates.height,
                duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
                useNativeDriver: false,
            }).start();
        });

        const hideSub = Keyboard.addListener(hideEvent, (e) => {
            setKeyboardVisible(false);
            Animated.timing(keyboardHeight, {
                toValue: 0,
                duration: Platform.OS === 'ios' ? (e.duration || 250) : 150,
                useNativeDriver: false,
            }).start();
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Auto-grow input smoothly
    const handleContentSizeChange = useCallback((e: any) => {
        const newHeight = Math.min(
            Math.max(e.nativeEvent.contentSize.height, responsive.inputMinHeight),
            responsive.inputMaxHeight
        );
        if (newHeight !== inputContentHeight) {
            setInputContentHeight(newHeight);
            Animated.spring(inputHeight, {
                toValue: newHeight,
                friction: 10,
                tension: 120,
                useNativeDriver: false,
            }).start();
        }
    }, [inputContentHeight, responsive.inputMinHeight, responsive.inputMaxHeight]);

    // Reset input height when text is cleared
    useEffect(() => {
        if (messageText === '') {
            setInputContentHeight(responsive.inputMinHeight);
            Animated.spring(inputHeight, {
                toValue: responsive.inputMinHeight,
                friction: 10,
                tension: 120,
                useNativeDriver: false,
            }).start();
        }
    }, [messageText, responsive.inputMinHeight]);

    // Mark channel/DM as read when switching
    useEffect(() => {
        if (activeChannel && activeTab === 'channels') markChannelAsRead(activeChannel.id);
    }, [activeChannel?.id, activeTab]);

    useEffect(() => {
        if (activeConversation && activeTab === 'dms') markDMAsRead(activeConversation.id);
    }, [activeConversation?.id, activeTab]);

    // Handle deep linking params
    useEffect(() => {
        if (params.dm && conversations.length > 0) {
            const conversationId = params.dm as string;
            const conversation = conversations.find(c => c.id === conversationId);
            if (conversation) {
                setActiveConversation(conversation);
                setActiveChannel(null);
                setActiveTab('dms');
            }
        } else if (params.channel && channels.length > 0) {
            const channelId = params.channel as string;
            const channel = channels.find(c => c.id === channelId);
            if (channel) {
                setActiveChannel(channel);
                setActiveConversation(null);
                setActiveTab('channels');
            }
        }
    }, [params.dm, params.channel, conversations, channels]);

    const handleSelectChannel = (channel: Channel) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveChannel(channel);
        setActiveConversation(null);
        setActiveTab('channels');
        markChannelAsRead(channel.id);
        setShowChannelList(false);
    };

    const handleSelectDM = (conv: DMConversation) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveConversation(conv);
        setActiveChannel(null);
        setActiveTab('dms');
        markDMAsRead(conv.id);
        setShowChannelList(false);
    };

    const handleStartDM = async (otherUserId: string) => {
        const conv = await startConversation(otherUserId);
        if (conv) {
            setActiveTab('dms');
            setShowStartDM(false);
            setShowChannelList(false);
        }
    };

    // Fetch workspace members for Start DM modal
    const fetchWorkspaceMembers = useCallback(async () => {
        if (!currentWorkspace?.id || !user) return;
        setMembersLoading(true);
        try {
            const { data } = await supabase
                .from('workspace_members')
                .select('user_id, role, profiles:user_id(id, email, full_name, avatar_url)')
                .eq('workspace_id', currentWorkspace.id);
            const members = (data || []).filter((m: any) => m.user_id !== user.id).map((m: any) => ({
                ...(Array.isArray(m.profiles) ? m.profiles[0] : m.profiles),
                role: m.role,
            }));
            setWorkspaceMembers(members);
        } catch (e) {
            console.error('Error fetching members:', e);
        } finally {
            setMembersLoading(false);
        }
    }, [currentWorkspace?.id, user]);

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) return;
        const ch = await createChannel(newChannelName.trim());
        if (ch) {
            setActiveChannel(ch);
            setNewChannelName('');
            setShowCreateChannel(false);
        }
    };

    const handleSend = async () => {
        if (editingMessage) {
            if (messageText.trim() && messageText.trim() !== editingMessage.content) {
                await editMessage(editingMessage.id, messageText.trim());
            }
            setEditingMessage(null);
            setMessageText('');
            return;
        }
        if (!messageText.trim() || isSending) return;
        const text = messageText;
        setMessageText('');
        stopTyping();
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        const success = await sendMessage(text);
        if (!success) {
            // Restore the message text so the user doesn't lose their input
            setMessageText(text);
            Alert.alert('Send Failed', 'Network request failed. Please check your connection and try again.');
        }
    };

    const handleTextChange = (text: string) => {
        setMessageText(text);
        if (text.trim()) {
            startTyping();
        } else {
            stopTyping();
        }
    };

    const handleLongPress = (message: any) => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        setSelectedMessage(message);
    };

    const handleReply = (message: Message) => {
        setReplyingTo(message);
        setSelectedMessage(null);
        inputRef.current?.focus();
    };

    const handleEdit = (message: Message) => {
        setEditingMessage(message);
        setMessageText(message.content);
        setSelectedMessage(null);
        inputRef.current?.focus();
    };

    const handleDeleteMessage = (message: Message) => {
        setSelectedMessage(null);
        Alert.alert('Delete Message', 'Delete this message for everyone?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(message.id) },
        ]);
    };

    const cancelEdit = () => {
        setEditingMessage(null);
        setMessageText('');
    };

    // Date divider logic
    const shouldShowDate = (msg: Message, prevMsg?: Message) => {
        if (!prevMsg) return true;
        return !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));
    };

    const formatDateLabel = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isToday(d)) return 'Today';
        if (isYesterday(d)) return 'Yesterday';
        return format(d, 'EEEE, MMM d');
    };

    // Group consecutive messages
    const isGrouped = (msg: Message, prevMsg?: Message) => {
        if (!prevMsg) return false;
        if (msg.sender_id !== prevMsg.sender_id) return false;
        // Also check date divider or reply_to - if either present, don't group
        if (shouldShowDate(msg, prevMsg)) return false;
        if (msg.reply_to_id) return false;
        return new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;
    };

    const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const prevMsg = index < invertedMessages.length - 1 ? invertedMessages[index + 1] : undefined;
        const nextMsg = index > 0 ? invertedMessages[index - 1] : undefined;

        const showDate = shouldShowDate(item, prevMsg);
        const groupedTop = isGrouped(item, prevMsg);
        const groupedBottom = nextMsg ? isGrouped(nextMsg, item) : false;

        const isOwn = item.sender_id === user?.id;
        const senderName = item.sender?.full_name || item.sender?.email?.split('@')[0] || 'User';
        const initials = senderName.charAt(0).toUpperCase();

        return (
            <View>
                {showDate && (
                    <View style={s.dateDivider}>
                        <View style={s.dateLine} />
                        <View style={s.dateTextContainer}>
                            <Text style={s.dateText}>{formatDateLabel(item.created_at)}</Text>
                        </View>
                        <View style={s.dateLine} />
                    </View>
                )}
                <TouchableOpacity
                    style={[
                        s.msgRow,
                        isOwn && s.msgRowOwn,
                        groupedTop && { marginTop: 2 }
                    ]}
                    onLongPress={() => handleLongPress(item)}
                    activeOpacity={0.8}
                >
                    {/* Avatar Logic */}
                    {!isOwn && (
                        <View style={s.avatarContainer}>
                            {!groupedBottom ? (
                                item.sender?.avatar_url ? (
                                    <Image source={{ uri: item.sender.avatar_url }} style={s.avatarImage} />
                                ) : (
                                    <View style={[s.avatar, { backgroundColor: getColor(item.sender_id) }]}>
                                        <Text style={s.avatarText}>{initials}</Text>
                                    </View>
                                )
                            ) : (
                                <View style={s.avatarSpacer} />
                            )}
                        </View>
                    )}

                    <View style={[
                        s.bubble,
                        isOwn ? s.bubbleOwn : s.bubbleOther,
                        groupedTop && (isOwn ? s.bubbleGroupTopOwn : s.bubbleGroupTopOther),
                        groupedBottom && (isOwn ? s.bubbleGroupBottomOwn : s.bubbleGroupBottomOther),
                        item.reply_to && { borderTopLeftRadius: 16, borderTopRightRadius: 16 }
                    ]}>
                        {/* Sender name for other users */}
                        {!isOwn && !groupedTop && (
                            <Text style={[s.senderName, { color: getColor(item.sender_id) }]}>{senderName}</Text>
                        )}

                        {/* Reply preview */}
                        {item.reply_to && (
                            <View style={[s.replyPreview, isOwn ? s.replyPreviewOwn : s.replyPreviewOther]}>
                                <View style={[s.replyBar, { backgroundColor: isOwn ? '#FFF' : getColor(item.reply_to.sender?.id || '') }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.replyName, { color: isOwn ? '#FFF' : getColor(item.reply_to.sender?.id || '') }]} numberOfLines={1}>
                                        {item.reply_to.sender?.full_name || 'User'}
                                    </Text>
                                    <Text style={[s.replyContent, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748B' }]} numberOfLines={1}>
                                        {item.reply_to.content}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <Text style={[s.msgText, isOwn && s.msgTextOwn]}>{item.content}</Text>

                        <View style={s.msgMeta}>
                            {item.is_edited && <Text style={[s.editedTag, isOwn && { color: 'rgba(255,255,255,0.5)' }]}>edited</Text>}
                            <Text style={[s.msgTime, isOwn && { color: 'rgba(255,255,255,0.6)' }]}>
                                {format(new Date(item.created_at), 'h:mm a')}
                            </Text>
                        </View>
                    </View>

                    {/* Success tick for own messages */}
                    {isOwn && !groupedBottom && (
                        <View style={s.statusTick}>
                            <View style={s.tickDot} />
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    if (channelsLoading && dmsLoading) {
        return (
            <View style={[s.container, { backgroundColor: '#FFF' }]}>
                <View style={s.loadingCenter}>
                    <ActivityIndicator size="large" color="#F97316" />
                </View>
            </View>
        );
    }

    const headerTitle = activeTab === 'channels'
        ? (activeChannel?.name || 'Messages')
        : (activeConversation?.other_user?.full_name || activeConversation?.other_user?.email?.split('@')[0] || 'Direct Message');

    const headerSubtitle = activeTab === 'channels'
        ? `${onlineCount} online · ${channels.length} channels`
        : (activeConversation?.other_user && isUserOnline(activeConversation.other_user.id) ? '● Online' : 'Offline');

    const isShowingDM = activeTab === 'dms' && activeConversation;
    const dmUserOnline = isShowingDM && activeConversation?.other_user && isUserOnline(activeConversation.other_user.id);

    // Bottom padding: when keyboard is up, use a small gap; when down, use safe area
    const bottomPadding = keyboardHeight.interpolate({
        inputRange: [0, 1],
        outputRange: [Math.max(insets.bottom, 12), 6],
        extrapolate: 'clamp',
    });

    // On Android we don't use the animated keyboard offset because android:windowSoftInputMode handles it
    // On iOS we drive the input container up with the animated keyboardHeight minus the tab bar
    const tabBarHeight = Platform.OS === 'ios' ? 88 : 64;
    const keyboardOffset = Platform.OS === 'ios'
        ? Animated.subtract(keyboardHeight, new Animated.Value(tabBarHeight)).interpolate({
            inputRange: [-999, 0, 9999],
            outputRange: [0, 0, 9999],
            extrapolate: 'clamp',
        })
        : 0;

    return (
        <View style={s.container}>
            <StatusBar style="dark" />

            {/* ─── MESSENGER-STYLE HEADER ─── */}
            <View style={[s.header, { paddingTop: Math.max(insets.top, 10) + 4 }]}>
                <TouchableOpacity
                    style={s.headerChannelBtn}
                    onPress={() => setShowChannelList(true)}
                    activeOpacity={0.7}
                >
                    <View style={[s.headerAvatar, isShowingDM && { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' }]}>
                        {isShowingDM ? (
                            activeConversation?.other_user?.avatar_url ? (
                                <Image source={{ uri: activeConversation.other_user.avatar_url }} style={{ width: 44, height: 44, borderRadius: 16 }} />
                            ) : (
                                <User size={22} color="#8B5CF6" strokeWidth={2.5} />
                            )
                        ) : (
                            <Hash size={22} color="#F97316" strokeWidth={2.5} />
                        )}
                        {dmUserOnline && (
                            <View style={s.headerOnlineBadge} />
                        )}
                    </View>
                    <View style={s.headerTitleArea}>
                        <View style={s.headerTitleRow}>
                            <Text style={s.headerTitle} numberOfLines={1}>{headerTitle}</Text>
                            <ChevronDown size={14} color="#64748B" style={{ marginLeft: 2 }} />
                        </View>
                        <View style={s.headerStatusRow}>
                            <View style={[s.onlineDot, isShowingDM && !dmUserOnline && { backgroundColor: '#94A3B8' }]} />
                            <Text style={s.headerStatus}>{headerSubtitle}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={s.headerActions}>
                    <TouchableOpacity style={s.headerActionBtn}>
                        <Search size={22} color="#475569" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ─── Messages ─── */}
            <View style={{ flex: 1, backgroundColor: '#FAFAFB' }}>
                {messagesLoading ? (
                    <View style={s.loadingCenter}>
                        <ActivityIndicator size="small" color="#F97316" />
                    </View>
                ) : messages.length === 0 ? (
                    <View style={s.emptyCenter}>
                        <View style={s.emptyIllustration}>
                            <MessageCircle size={40} color="#F97316" opacity={0.2} />
                        </View>
                        <Text style={s.emptyTitle}>New conversation</Text>
                        <Text style={s.emptySub}>{activeTab === 'channels' ? 'Send a message to start the channel' : 'Send a message to start chatting'}</Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={invertedMessages}
                        renderItem={renderMessage}
                        keyExtractor={m => m.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: 10 }}
                        showsVerticalScrollIndicator={false}
                        onEndReached={() => { if (hasMore) loadMore(); }}
                        onEndReachedThreshold={0.3}
                        inverted={true}
                    />
                )}
                {/* Typing indicator */}
                {typingText && (
                    <View style={s.typingContainer}>
                        <View style={s.typingDots}>
                            <View style={[s.typingDot, { opacity: 0.4 }]} />
                            <View style={[s.typingDot, { opacity: 0.7 }]} />
                            <View style={s.typingDot} />
                        </View>
                        <Text style={s.typingText}>{typingText}</Text>
                    </View>
                )}
            </View>

            {/* ─── Messenger-Style Input Area ─── */}
            <Animated.View style={[
                s.inputContainer,
                {
                    paddingBottom: bottomPadding,
                    paddingHorizontal: responsive.containerPaddingH,
                    ...(Platform.OS === 'ios' ? { transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] } : {}),
                },
            ]}>
                {/* Reply / Edit bar */}
                {(replyingTo || editingMessage) && (
                    <View style={s.accessoryBar}>
                        <View style={[s.accessoryIndicator, { backgroundColor: replyingTo ? '#F97316' : '#3B82F6' }]} />
                        <View style={{ flex: 1, paddingLeft: 10 }}>
                            <Text style={[s.accessoryTitle, { color: replyingTo ? '#F97316' : '#3B82F6' }]}>
                                {replyingTo ? `Replying to ${replyingTo.sender?.full_name}` : 'Editing message'}
                            </Text>
                            <Text style={s.accessoryContent} numberOfLines={1}>
                                {replyingTo?.content || editingMessage?.content}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => { setReplyingTo(null); cancelEdit(); }} style={s.accessoryClose}>
                            <X size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={[s.inputWrapper, { gap: responsive.isTablet ? 12 : 8 }]}>
                    <View style={[
                        s.inputFieldContainer,
                        {
                            borderRadius: responsive.inputBorderRadius,
                            paddingLeft: responsive.inputPaddingH,
                            minHeight: responsive.inputMinHeight,
                        },
                    ]}>
                        <Animated.View style={{ flex: 1, height: inputHeight }}>
                            <TextInput
                                ref={inputRef}
                                style={[
                                    s.input,
                                    {
                                        fontSize: responsive.inputFontSize,
                                        maxHeight: responsive.inputMaxHeight,
                                    },
                                ]}
                                placeholder="Type a message..."
                                placeholderTextColor="#94A3B8"
                                value={messageText}
                                onChangeText={handleTextChange}
                                onContentSizeChange={handleContentSizeChange}
                                multiline
                                maxLength={2000}
                                textAlignVertical="center"
                                scrollEnabled={inputContentHeight >= responsive.inputMaxHeight}
                            />
                        </Animated.View>
                        <TouchableOpacity
                            style={[s.emojiBtn, { width: responsive.emojiBtnSize, height: responsive.inputMinHeight }]}
                            onPress={() => { Keyboard.dismiss(); setShowEmojiPicker(true); }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Smile size={responsive.isTablet ? 24 : 20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <Animated.View style={{
                        transform: [{ scale: sendBtnScale }],
                        opacity: sendBtnOpacity,
                    }}>
                        <TouchableOpacity
                            style={[
                                s.sendBtn,
                                {
                                    width: responsive.sendBtnSize,
                                    height: responsive.sendBtnSize,
                                    borderRadius: responsive.sendBtnSize / 2,
                                },
                                messageText.trim() ? s.sendBtnActive : {},
                            ]}
                            onPress={handleSend}
                            disabled={!messageText.trim() || (!editingMessage && isSending)}
                            activeOpacity={0.7}
                        >
                            <Send size={responsive.isTablet ? 20 : 17} color={messageText.trim() ? '#FFF' : '#CBD5E1'} />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Animated.View>

            {/* Emoji Picker */}
            <EmojiPicker
                onEmojiSelected={(emoji: any) => {
                    setMessageText(prev => prev + emoji.emoji);
                }}
                open={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                theme={{
                    backdrop: 'rgba(0,0,0,0.5)',
                    knob: '#E2E8F0',
                    container: '#FFFFFF',
                    header: '#F97316',
                    category: {
                        icon: '#94A3B8',
                        iconActive: '#F97316',
                        container: '#F8FAFC',
                        containerActive: '#FFF7ED',
                    },
                }}
            />

            {/* ─── CHANNEL / DM LIST MODAL ─── */}
            <Modal visible={showChannelList} transparent animationType="slide" onRequestClose={() => setShowChannelList(false)}>
                <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowChannelList(false)}>
                    <View style={s.channelSheet} onStartShouldSetResponder={() => true}>
                        <View style={s.modalHandle} />

                        {/* Tab switcher */}
                        <View style={s.sheetTabs}>
                            <TouchableOpacity
                                style={[s.sheetTab, activeTab === 'channels' && s.sheetTabActive]}
                                onPress={() => setActiveTab('channels')}
                            >
                                <Hash size={14} color={activeTab === 'channels' ? '#F97316' : '#64748B'} />
                                <Text style={[s.sheetTabText, activeTab === 'channels' && s.sheetTabTextActive]}>Channels</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.sheetTab, activeTab === 'dms' && s.sheetTabActive]}
                                onPress={() => setActiveTab('dms')}
                            >
                                <MessageSquare size={14} color={activeTab === 'dms' ? '#8B5CF6' : '#64748B'} />
                                <Text style={[s.sheetTabText, activeTab === 'dms' && s.sheetTabTextActive]}>Direct Messages</Text>
                                {dmUnreadCount > 0 && (
                                    <View style={[s.unreadBadge, { backgroundColor: '#8B5CF6', marginLeft: 4 }]}>
                                        <Text style={s.unreadText}>{dmUnreadCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Header with action */}
                        <View style={s.channelSheetHeader}>
                            <Text style={s.modalTitle}>{activeTab === 'channels' ? 'Channels' : 'Messages'}</Text>
                            <TouchableOpacity
                                style={[s.addChannelBtn, activeTab === 'dms' && { backgroundColor: '#8B5CF6' }]}
                                onPress={() => {
                                    if (activeTab === 'channels') {
                                        setShowChannelList(false);
                                        setShowCreateChannel(true);
                                    } else {
                                        fetchWorkspaceMembers();
                                        setShowStartDM(true);
                                    }
                                }}
                            >
                                <Plus size={18} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={s.channelList} showsVerticalScrollIndicator={false}>
                            {activeTab === 'channels' ? (
                                channels.map(ch => {
                                    const isActive = activeChannel?.id === ch.id && activeTab === 'channels';
                                    return (
                                        <TouchableOpacity
                                            key={ch.id}
                                            style={[s.channelItem, isActive && s.channelItemActive]}
                                            onPress={() => handleSelectChannel(ch)}
                                        >
                                            <View style={[s.channelIcon, isActive && s.channelIconActive]}>
                                                <Hash size={16} color={isActive ? '#FFF' : '#64748B'} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[s.channelName, isActive && s.channelNameActive]}>{ch.name}</Text>
                                                <Text style={s.channelMeta} numberOfLines={1}>
                                                    {ch.description || `Discussion for ${ch.name}`}
                                                </Text>
                                            </View>
                                            {(ch.unread_count || 0) > 0 && (
                                                <View style={s.unreadBadge}>
                                                    <Text style={s.unreadText}>{ch.unread_count}</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                conversations.length === 0 ? (
                                    <View style={{ padding: 30, alignItems: 'center' }}>
                                        <User size={32} color="#94A3B8" />
                                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#64748B', marginTop: 12 }}>No conversations yet</Text>
                                        <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Tap + to start a direct message</Text>
                                    </View>
                                ) : (
                                    conversations.map(conv => {
                                        const isActive = activeConversation?.id === conv.id && activeTab === 'dms';
                                        const otherName = conv.other_user?.full_name || conv.other_user?.email?.split('@')[0] || 'User';
                                        const initials = otherName.charAt(0).toUpperCase();
                                        const online = conv.other_user ? isUserOnline(conv.other_user.id) : false;
                                        return (
                                            <TouchableOpacity
                                                key={conv.id}
                                                style={[s.channelItem, isActive && { backgroundColor: '#F3F0FF' }]}
                                                onPress={() => handleSelectDM(conv)}
                                            >
                                                <View style={{ position: 'relative' }}>
                                                    <View style={[s.channelIcon, { backgroundColor: isActive ? '#8B5CF6' : '#EDE9FE' }]}>
                                                        {conv.other_user?.avatar_url ? (
                                                            <Image source={{ uri: conv.other_user.avatar_url }} style={{ width: 44, height: 44, borderRadius: 14 }} />
                                                        ) : (
                                                            <Text style={{ fontSize: 16, fontWeight: '800', color: isActive ? '#FFF' : '#8B5CF6' }}>{initials}</Text>
                                                        )}
                                                    </View>
                                                    {online && <View style={s.dmOnlineDot} />}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[s.channelName, isActive && { color: '#8B5CF6' }]}>{otherName}</Text>
                                                    <Text style={s.channelMeta} numberOfLines={1}>
                                                        {conv.last_message ? conv.last_message.content : 'No messages yet'}
                                                    </Text>
                                                </View>
                                                {(conv.unread_count || 0) > 0 && (
                                                    <View style={[s.unreadBadge, { backgroundColor: '#8B5CF6' }]}>
                                                        <Text style={s.unreadText}>{conv.unread_count}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                )
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Start DM Modal */}
            <Modal visible={showStartDM} transparent animationType="fade" onRequestClose={() => setShowStartDM(false)}>
                <View style={s.createModalOverlay}>
                    <View style={s.createModalContent}>
                        <Text style={s.createModalTitle}>New Message</Text>
                        <Text style={s.createModalSub}>Choose a team member to start a conversation.</Text>
                        {membersLoading ? (
                            <ActivityIndicator size="small" color="#8B5CF6" style={{ marginTop: 20 }} />
                        ) : (
                            <ScrollView style={{ maxHeight: 300, marginTop: 16 }}>
                                {workspaceMembers.map((member: any) => {
                                    const name = member.full_name || member.email?.split('@')[0] || 'User';
                                    const online = isUserOnline(member.id);
                                    return (
                                        <TouchableOpacity
                                            key={member.id}
                                            style={s.channelItem}
                                            onPress={() => handleStartDM(member.id)}
                                        >
                                            <View style={{ position: 'relative' }}>
                                                <View style={[s.channelIcon, { backgroundColor: '#EDE9FE' }]}>
                                                    {member.avatar_url ? (
                                                        <Image source={{ uri: member.avatar_url }} style={{ width: 44, height: 44, borderRadius: 14 }} />
                                                    ) : (
                                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#8B5CF6' }}>{name.charAt(0).toUpperCase()}</Text>
                                                    )}
                                                </View>
                                                {online && <View style={s.dmOnlineDot} />}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.channelName}>{name}</Text>
                                                <Text style={s.channelMeta}>{member.email} · {member.role}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}
                        <TouchableOpacity style={[s.createModalCancel, { marginTop: 16 }]} onPress={() => setShowStartDM(false)}>
                            <Text style={s.createModalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Create Channel Modal */}
            <Modal visible={showCreateChannel} transparent animationType="fade" onRequestClose={() => setShowCreateChannel(false)}>
                <View style={s.createModalOverlay}>
                    <View style={s.createModalContent}>
                        <Text style={s.createModalTitle}>New Channel</Text>
                        <Text style={s.createModalSub}>Create a space for your team to collaborate.</Text>
                        <TextInput
                            style={s.createModalInput}
                            placeholder="Channel name (e.g. design-squad)"
                            placeholderTextColor="#94A3B8"
                            value={newChannelName}
                            onChangeText={setNewChannelName}
                            autoFocus
                        />
                        <View style={s.createModalActions}>
                            <TouchableOpacity style={s.createModalCancel} onPress={() => setShowCreateChannel(false)}>
                                <Text style={s.createModalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.createModalSubmit, !newChannelName.trim() && { opacity: 0.5 }]}
                                onPress={handleCreateChannel}
                                disabled={!newChannelName.trim()}
                            >
                                <Text style={s.createModalSubmitText}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Message Actions */}
            <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={() => setSelectedMessage(null)}>
                <TouchableOpacity style={s.actionsOverlay} activeOpacity={1} onPress={() => setSelectedMessage(null)}>
                    <View style={s.actionsMenu}>
                        <TouchableOpacity style={s.actionBtn} onPress={() => selectedMessage && handleReply(selectedMessage)}>
                            <View style={[s.actionIcon, { backgroundColor: '#F0F7FF' }]}><Reply size={18} color="#3B82F6" /></View>
                            <Text style={s.actionLabel}>Reply</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.actionBtn} onPress={() => selectedMessage && handleEdit(selectedMessage)}>
                            <View style={[s.actionIcon, { backgroundColor: '#FFF7ED' }]}><Edit3 size={18} color="#F97316" /></View>
                            <Text style={s.actionLabel}>Edit Message</Text>
                        </TouchableOpacity>
                        <View style={s.menuDivider} />
                        <TouchableOpacity style={s.actionBtn} onPress={() => selectedMessage && handleDeleteMessage(selectedMessage)}>
                            <View style={[s.actionIcon, { backgroundColor: '#FEF2F2' }]}><Trash2 size={18} color="#EF4444" /></View>
                            <Text style={[s.actionLabel, { color: '#EF4444' }]}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

function getColor(str: string) {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#22C55E', '#14B8A6', '#EF4444', '#6366F1'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerChannelBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    headerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 16,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FFEDD5'
    },
    headerTitleArea: { flex: 1 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    headerStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    headerStatus: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    headerActionBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },

    // Message Rows
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 12, gap: 8 },
    msgRowOwn: { flexDirection: 'row-reverse' },
    avatarContainer: { width: 32 },
    avatar: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    avatarImage: { width: 32, height: 32, borderRadius: 12 },
    avatarText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
    avatarSpacer: { width: 32 },

    // Bubbles (Glassmorphism & iOS feel)
    bubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    bubbleOther: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
            android: { elevation: 1 }
        })
    },
    bubbleOwn: {
        backgroundColor: '#F97316',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 4,
    },

    // Grouping modifications
    bubbleGroupTopOther: { borderTopLeftRadius: 6 },
    bubbleGroupBottomOther: { borderBottomLeftRadius: 6 },
    bubbleGroupTopOwn: { borderTopRightRadius: 6 },
    bubbleGroupBottomOwn: { borderBottomRightRadius: 6 },

    senderName: { fontSize: 12, fontWeight: '700', marginBottom: 4, letterSpacing: 0.2 },
    msgText: { fontSize: 15, color: '#1E293B', lineHeight: 22 },
    msgTextOwn: { color: '#FFF', fontWeight: '500' },

    msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, justifyContent: 'flex-end' },
    msgTime: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
    editedTag: { fontSize: 10, color: '#94A3B8', fontStyle: 'italic' },

    statusTick: { marginLeft: 4, marginBottom: 4 },
    tickDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },

    // Reply Box inside bubble
    replyPreview: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 8, marginBottom: 8 },
    replyPreviewOther: { backgroundColor: '#F8FAFC' },
    replyPreviewOwn: { backgroundColor: 'rgba(255,255,255,0.15)' },
    replyBar: { width: 3, borderRadius: 2 },
    replyName: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
    replyContent: { fontSize: 12 },

    // Date Divider
    dateDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
    dateLine: { flex: 1, height: 1, backgroundColor: '#F1F5F9' },
    dateTextContainer: { backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    dateText: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },

    // Empty State
    emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyIllustration: { width: 80, height: 80, borderRadius: 30, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 4 },

    // Input Area — Messenger-level responsive
    inputContainer: {
        backgroundColor: '#FFF',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E2E8F0',
        paddingTop: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    inputFieldContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        paddingRight: 6,
        ...Platform.select({
            ios: {
                shadowColor: '#94A3B8',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
            },
            android: { elevation: 1 },
        }),
    },
    input: {
        flex: 1,
        color: '#0F172A',
        paddingTop: Platform.OS === 'ios' ? 10 : 8,
        paddingBottom: Platform.OS === 'ios' ? 10 : 8,
        fontWeight: '400',
        lineHeight: 22,
    },
    emojiBtn: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtn: {
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnActive: {
        backgroundColor: '#F97316',
        ...Platform.select({
            ios: {
                shadowColor: '#F97316',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.35,
                shadowRadius: 5,
            },
            android: { elevation: 4 },
        }),
    },

    // Accessory/Reply Bar
    accessoryBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#FAFBFC',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 8
    },
    accessoryIndicator: { width: 3, height: '80%', borderRadius: 2 },
    accessoryTitle: { fontSize: 13, fontWeight: '800' },
    accessoryContent: { fontSize: 13, color: '#64748B', marginTop: 1 },
    accessoryClose: { padding: 4 },

    // Channel Drawer
    channelSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        maxHeight: '85%',
        paddingBottom: 40,
    },
    modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 20 },
    channelSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 15 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    addChannelBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
    channelList: { paddingHorizontal: 16 },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 12,
        borderRadius: 20,
        marginBottom: 4
    },
    channelItemActive: { backgroundColor: '#FFF7ED' },
    channelIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    channelIconActive: { backgroundColor: '#F97316' },
    channelName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    channelNameActive: { color: '#F97316' },
    channelMeta: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
    unreadBadge: { backgroundColor: '#F97316', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, minWidth: 24, alignItems: 'center' },
    unreadText: { fontSize: 11, fontWeight: '900', color: '#FFF' },

    // Actions Menu (Futuristic popup)
    actionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    actionsMenu: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        width: '75%',
        padding: 10,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }
        })
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 15, borderRadius: 16 },
    actionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    actionLabel: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
    menuDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 15 },
    actionsOverlay2: { flex: 1 },

    // Create Modal (Advanced feel)
    createModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', padding: 24 },
    createModalContent: { backgroundColor: '#FFF', borderRadius: 30, padding: 24 },
    createModalTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    createModalSub: { fontSize: 14, color: '#64748B', marginTop: 8, lineHeight: 20 },
    createModalInput: {
        height: 56,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#0F172A',
        marginTop: 20
    },
    createModalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
    createModalCancel: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
    createModalCancelText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
    createModalSubmit: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F97316' },
    createModalSubmitText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },

    // Typing indicator
    typingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
    typingDots: { flexDirection: 'row', gap: 3 },
    typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#94A3B8' },
    typingText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', fontWeight: '500' },

    // Header online badge
    headerOnlineBadge: {
        position: 'absolute', bottom: -1, right: -1,
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: '#22C55E', borderWidth: 2.5, borderColor: '#FFF',
    },

    // DM online dot in list
    dmOnlineDot: {
        position: 'absolute', bottom: 0, right: 0,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFF',
    },

    // Sheet tabs
    sheetTabs: {
        flexDirection: 'row', gap: 4,
        paddingHorizontal: 16, marginBottom: 16,
    },
    sheetTab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 14,
        backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9',
    },
    sheetTabActive: {
        backgroundColor: '#FFF7ED', borderColor: '#FFEDD5',
    },
    sheetTabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    sheetTabTextActive: { color: '#F97316', fontWeight: '700' },
});
