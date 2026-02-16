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
    UIManager,
    KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
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
    Smile,
    User,
    MessageSquare,
    Copy,
    MoreHorizontal
} from 'lucide-react-native';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import EmojiPicker from 'rn-emoji-keyboard';
import { useLocalSearchParams } from 'expo-router';

import { useChat, Channel } from '@/hooks/useChat';
import { useChatMessages, Message } from '@/hooks/useChatMessages';
import { useDirectMessages, DMConversation } from '@/hooks/useDirectMessages';
import { useDMMessages } from '@/hooks/useDMMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Responsive breakpoints
const useResponsive = () => {
    const { width, height } = useWindowDimensions();
    const isTablet = width >= 768;
    const isLandscape = width > height;

    return {
        isTablet,
        isLandscape,
        inputFontSize: isTablet ? 17 : 16,
        inputMinHeight: isTablet ? 50 : 44,
        inputMaxHeight: isTablet ? 160 : 120,
        inputPaddingH: 18,
        sendBtnSize: 42,
        inputBorderRadius: 24,
        containerPaddingH: isTablet ? 24 : 16,
        emojiBtnSize: 40,
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

    // Hooks
    const {
        channels, activeChannel, setActiveChannel,
        isLoading: channelsLoading, createChannel, markChannelAsRead,
    } = useChat(currentWorkspace?.id);

    const {
        conversations, activeConversation, setActiveConversation,
        isLoading: dmsLoading, startConversation, markAsRead: markDMAsRead,
        totalUnreadCount: dmUnreadCount,
    } = useDirectMessages(currentWorkspace?.id);

    const {
        messages: channelMessages, isLoading: channelMessagesLoading, isSending: channelSending,
        hasMore: channelHasMore, loadMore: channelLoadMore,
        sendMessage: sendChannelMessage, editMessage: editChannelMessage,
        deleteMessage: deleteChannelMessage, replyingTo, setReplyingTo,
    } = useChatMessages(activeTab === 'channels' ? activeChannel?.id : undefined);

    const {
        messages: dmMessages, isLoading: dmMessagesLoading, isSending: dmSending,
        hasMore: dmHasMore, loadMore: dmLoadMore,
        sendMessage: sendDMMessage, editMessage: editDMMessage,
        deleteMessage: deleteDMMessage,
    } = useDMMessages(activeTab === 'dms' ? activeConversation?.id : undefined);

    // Unified accessors
    const currentChatId = activeTab === 'channels' ? activeChannel?.id : activeConversation?.id;
    const { typingText, startTyping, stopTyping } = useTypingIndicator(currentChatId);
    const { onlineCount, isUserOnline } = useOnlinePresence(currentWorkspace?.id);

    const messages = activeTab === 'channels' ? channelMessages : dmMessages as any[];
    const hasMore = activeTab === 'channels' ? channelHasMore : dmHasMore;
    const loadMore = activeTab === 'channels' ? channelLoadMore : dmLoadMore;
    const sendMessage = activeTab === 'channels' ? sendChannelMessage : sendDMMessage;
    const editMessage = activeTab === 'channels' ? editChannelMessage : editDMMessage;
    const deleteMessage = activeTab === 'channels' ? deleteChannelMessage : deleteDMMessage;
    const isSending = activeTab === 'channels' ? channelSending : dmSending;

    // UI State
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

    // Animation for send button
    const sendBtnScale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const hasText = messageText.trim().length > 0;
        Animated.spring(sendBtnScale, {
            toValue: hasText ? 1 : 0.8,
            useNativeDriver: true,
        }).start();
    }, [messageText]);

    // Selection Logic
    useEffect(() => {
        if (activeChannel && activeTab === 'channels') markChannelAsRead(activeChannel.id);
    }, [activeChannel?.id, activeTab]);

    useEffect(() => {
        if (activeConversation && activeTab === 'dms') markDMAsRead(activeConversation.id);
    }, [activeConversation?.id, activeTab]);

    // Deep Linking
    useEffect(() => {
        if (params.dm && conversations.length > 0) {
            const conv = conversations.find(c => c.id === params.dm);
            if (conv) handleSelectDM(conv);
        } else if (params.channel && channels.length > 0) {
            const chan = channels.find(c => c.id === params.channel);
            if (chan) handleSelectChannel(chan);
        }
    }, [params.dm, params.channel, conversations, channels]);

    const handleSelectChannel = (channel: Channel) => {
        setActiveChannel(channel); setActiveConversation(null); setActiveTab('channels');
        markChannelAsRead(channel.id); setShowChannelList(false);
    };

    const handleSelectDM = (conv: DMConversation) => {
        setActiveConversation(conv); setActiveChannel(null); setActiveTab('dms');
        markDMAsRead(conv.id); setShowChannelList(false);
    };

    const handleStartDM = async (otherUserId: string) => {
        const conv = await startConversation(otherUserId);
        if (conv) { setActiveTab('dms'); setShowStartDM(false); setShowChannelList(false); }
    };

    const fetchWorkspaceMembers = async () => {
        if (!currentWorkspace?.id || !user) return;
        setMembersLoading(true);
        try {
            const { data } = await supabase.from('workspace_members')
                .select('user_id, role, profiles:user_id(id, email, full_name, avatar_url)')
                .eq('workspace_id', currentWorkspace.id);
            const members = (data || [])
                .filter((m: any) => m.user_id !== user.id)
                .map((m: any) => ({ ...(Array.isArray(m.profiles) ? m.profiles[0] : m.profiles), role: m.role }));
            setWorkspaceMembers(members);
        } catch (e) {
            console.error(e);
        } finally {
            setMembersLoading(false);
        }
    };

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) return;
        const ch = await createChannel(newChannelName.trim());
        if (ch) { setActiveChannel(ch); setNewChannelName(''); setShowCreateChannel(false); }
    };

    const handleSend = async () => {
        if (editingMessage) {
            if (messageText.trim() && messageText.trim() !== editingMessage.content) {
                await editMessage(editingMessage.id, messageText.trim());
            }
            setEditingMessage(null); setMessageText(''); return;
        }
        if (!messageText.trim() || isSending) return;
        const text = messageText;
        setMessageText('');
        stopTyping();
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const success = await sendMessage(text);
        if (!success) { setMessageText(text); Alert.alert('Error', 'Failed to send message'); }
    };

    const handleLongPress = (message: any) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedMessage(message);
    };

    const handleReply = (message: Message) => {
        if (!message) return;
        setReplyingTo(message); setSelectedMessage(null); inputRef.current?.focus();
    };

    const handleEdit = (message: Message) => {
        setEditingMessage(message); setMessageText(message.content);
        setSelectedMessage(null); inputRef.current?.focus();
    };

    const handleCopy = async (message: Message) => {
        await Clipboard.setStringAsync(message.content);
        setSelectedMessage(null);
    };

    const handleDeleteMessage = (message: Message) => {
        setSelectedMessage(null);
        Alert.alert('Delete Message', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(message.id) },
        ]);
    };

    // Render Logic
    const shouldShowDate = (msg: Message, prevMsg?: Message) => {
        if (!prevMsg) return true;
        return !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));
    };

    const isGrouped = (msg: Message, prevMsg?: Message) => {
        if (!prevMsg) return false;
        if (msg.sender_id !== prevMsg.sender_id) return false;
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

        return (
            <View>
                {showDate && (
                    <View style={s.dateDivider}>
                        <View style={s.dateLine} />
                        <Text style={s.dateText}>{
                            isToday(new Date(item.created_at)) ? 'Today' :
                                isYesterday(new Date(item.created_at)) ? 'Yesterday' :
                                    format(new Date(item.created_at), 'EEE, MMM d')
                        }</Text>
                        <View style={s.dateLine} />
                    </View>
                )}
                <TouchableOpacity
                    style={[s.msgRow, isOwn && s.msgRowOwn, groupedTop && { marginTop: 2 }]}
                    onLongPress={() => handleLongPress(item)}
                    activeOpacity={0.9}
                >
                    {!isOwn && (
                        <View style={s.avatarContainer}>
                            {!groupedBottom ? (
                                item.sender?.avatar_url ? (
                                    <Image source={{ uri: item.sender.avatar_url }} style={s.avatarImage} />
                                ) : (
                                    <View style={[s.avatar, { backgroundColor: '#F1F5F9' }]}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>
                                            {senderName.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )
                            ) : <View style={s.avatarSpacer} />}
                        </View>
                    )}

                    <View style={{ maxWidth: '82%' }}>
                        {!isOwn && !groupedTop && (
                            <Text style={s.senderName}>{senderName}</Text>
                        )}

                        {/* Message Bubble */}
                        {isOwn ? (
                            <LinearGradient
                                colors={['#F97316', '#FB923C']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[
                                    s.bubble,
                                    s.bubbleOwn,
                                    groupedTop && s.bubbleGroupTopOwn,
                                    groupedBottom && s.bubbleGroupBottomOwn,
                                    item.reply_to && { borderTopLeftRadius: 16 }
                                ]}
                            >
                                {renderBubbleContent(item, isOwn)}
                            </LinearGradient>
                        ) : (
                            <View style={[
                                s.bubble,
                                s.bubbleOther,
                                groupedTop && s.bubbleGroupTopOther,
                                groupedBottom && s.bubbleGroupBottomOther,
                                item.reply_to && { borderTopRightRadius: 16 }
                            ]}>
                                {renderBubbleContent(item, isOwn)}
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const renderBubbleContent = (item: Message, isOwn: boolean) => (
        <>
            {item.reply_to && (
                <View style={[s.replyPreview, isOwn ? s.replyPreviewOwn : s.replyPreviewOther]}>
                    <View style={[s.replyBar, { backgroundColor: isOwn ? 'rgba(255,255,255,0.7)' : '#3B82F6' }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={[s.replyName, isOwn ? { color: 'rgba(255,255,255,0.9)' } : { color: '#3B82F6' }]}>
                            {item.reply_to.sender?.full_name || 'User'}
                        </Text>
                        <Text style={[s.replyContent, isOwn ? { color: 'rgba(255,255,255,0.8)' } : { color: '#64748B' }]} numberOfLines={1}>
                            {item.reply_to.content}
                        </Text>
                    </View>
                </View>
            )}
            <Text style={[s.msgText, isOwn && s.msgTextOwn]}>{item.content}</Text>
            <View style={s.msgMeta}>
                <Text style={[s.msgTime, isOwn && { color: 'rgba(255,255,255,0.7)' }]}>
                    {format(new Date(item.created_at), 'h:mm a')}
                </Text>
                {item.is_edited && (
                    <Text style={[s.editedTag, isOwn && { color: 'rgba(255,255,255,0.6)' }]}>edited</Text>
                )}
            </View>
        </>
    );

    const headerTitle = activeTab === 'channels'
        ? (activeChannel?.name || 'Messages')
        : (activeConversation?.other_user?.full_name || activeConversation?.other_user?.email?.split('@')[0] || 'Chat');

    return (
        <View style={s.container}>
            <StatusBar style="dark" />

            {/* Header - Modern Fun Look */}
            <View style={[s.header, { paddingTop: Math.max(insets.top, 10) + 4 }]}>
                <TouchableOpacity onPress={() => setShowChannelList(true)} style={s.headerTitleBtn}>
                    <View style={s.headerIconContainer}>
                        <LinearGradient
                            colors={activeTab === 'channels' ? ['#FFF7ED', '#FFEDD5'] : ['#EDE9FE', '#DDD6FE']}
                            style={[s.headerAvatarPlaceholder]}
                        >
                            {activeTab === 'dms' && activeConversation?.other_user?.avatar_url ? (
                                <Image source={{ uri: activeConversation.other_user.avatar_url }} style={s.headerAvatar} />
                            ) : (
                                activeTab === 'channels' ? <Hash size={22} color="#F97316" /> : <User size={22} color="#8B5CF6" />
                            )}
                        </LinearGradient>
                        {activeTab === 'dms' && activeConversation?.other_user && isUserOnline(activeConversation.other_user.id) && (
                            <View style={s.onlineBadge} />
                        )}
                    </View>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={s.headerTitle}>{headerTitle}</Text>
                            <ChevronDown size={16} color="#94A3B8" />
                        </View>
                        <Text style={s.headerSub}>{activeTab === 'channels' ? `${onlineCount} online` : 'Active now'}</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={s.searchBtn}>
                    <Search size={22} color="#64748B" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} // Adjust if necessary
            >
                {/* Message List */}
                <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
                    <FlatList
                        ref={flatListRef}
                        data={invertedMessages}
                        renderItem={renderMessage}
                        keyExtractor={m => m.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, paddingTop: 10 }}
                        showsVerticalScrollIndicator={false}
                        onEndReached={() => { if (hasMore) loadMore(); }}
                        onEndReachedThreshold={0.3}
                        inverted
                    />
                </View>

                {/* Typing & Input Area */}
                <View style={[s.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) + 100 }]}>
                    {/* Typing Indicator moved here for visibility */}
                    {typingText && (
                        <View style={s.typingFloat}>
                            <View style={s.typingDot} /><View style={s.typingDot} /><View style={s.typingDot} />
                            <Text style={s.typingText}>{typingText}</Text>
                        </View>
                    )}

                    {(replyingTo || editingMessage) && (
                        <View style={s.replyBarFloat}>
                            <View style={[s.replyBarLine, { backgroundColor: replyingTo ? '#F97316' : '#3B82F6' }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.replyBarTitle}>{replyingTo ? `Replying to ${replyingTo.sender?.full_name || 'User'}` : 'Editing Message'}</Text>
                                <Text style={s.replyBarText} numberOfLines={1}>{replyingTo?.content || editingMessage?.content}</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setReplyingTo(null); setEditingMessage(null); setMessageText(''); }}>
                                <X size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={s.inputWrapper}>
                        <View style={s.inputField}>
                            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowEmojiPicker(true); }} style={s.emojiBtn}>
                                <Smile size={24} color="#94A3B8" />
                            </TouchableOpacity>
                            <TextInput
                                ref={inputRef}
                                style={s.textInput}
                                placeholder="Type a message..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                value={messageText}
                                onChangeText={(t) => { setMessageText(t); t.trim() ? startTyping() : stopTyping(); }}
                            />
                        </View>
                        <Animated.View style={{ transform: [{ scale: sendBtnScale }] }}>
                            <TouchableOpacity
                                style={[s.sendBtn, messageText.trim() && s.sendBtnActive]}
                                onPress={handleSend}
                                disabled={!messageText.trim()}
                            >
                                <Send size={20} color={messageText.trim() ? '#FFF' : '#CBD5E1'} />
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <EmojiPicker
                onEmojiSelected={(e: any) => setMessageText(prev => prev + e.emoji)}
                open={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
            />

            {/* Channel/DM Switcher Modal */}
            <Modal visible={showChannelList} transparent animationType="slide" onRequestClose={() => setShowChannelList(false)}>
                <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowChannelList(false)}>
                    <View style={s.sheetContainer} onStartShouldSetResponder={() => true}>
                        <View style={s.sheetHandle} />
                        <View style={s.tabSwitcher}>
                            <TouchableOpacity onPress={() => setActiveTab('channels')} style={[s.tabBtn, activeTab === 'channels' && s.tabBtnActive]}>
                                <Text style={[s.tabText, activeTab === 'channels' && s.tabTextActive]}>Channels</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setActiveTab('dms')} style={[s.tabBtn, activeTab === 'dms' && s.tabBtnActive]}>
                                <Text style={[s.tabText, activeTab === 'dms' && s.tabTextActive]}>Direct Messages</Text>
                                {dmUnreadCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{dmUnreadCount}</Text></View>}
                            </TouchableOpacity>
                        </View>

                        <View style={s.sheetHeader}>
                            <Text style={s.sheetTitle}>{activeTab === 'channels' ? 'All Channels' : 'Conversations'}</Text>
                            <TouchableOpacity style={s.addBtn} onPress={() => {
                                if (activeTab === 'channels') { setShowChannelList(false); setShowCreateChannel(true); }
                                else { fetchWorkspaceMembers(); setShowStartDM(true); }
                            }}>
                                <Plus size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ paddingHorizontal: 20 }}>
                            {activeTab === 'channels' ? channels.map(ch => (
                                <TouchableOpacity key={ch.id} style={[s.listItem, activeChannel?.id === ch.id && s.listItemActive]} onPress={() => handleSelectChannel(ch)}>
                                    <View style={[s.listIcon, activeChannel?.id === ch.id && { backgroundColor: '#F97316' }]}>
                                        <Hash size={18} color={activeChannel?.id === ch.id ? '#FFF' : '#64748B'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.listTitle, activeChannel?.id === ch.id && { color: '#F97316' }]}>{ch.name}</Text>
                                        <Text style={s.listSub} numberOfLines={1}>{ch.description || 'Public Channel'}</Text>
                                    </View>
                                    {(ch.unread_count || 0) > 0 && <View style={s.badge}><Text style={s.badgeText}>{ch.unread_count}</Text></View>}
                                </TouchableOpacity>
                            )) : conversations.map(c => (
                                <TouchableOpacity key={c.id} style={[s.listItem, activeConversation?.id === c.id && s.listItemActive]} onPress={() => handleSelectDM(c)}>
                                    <View style={s.listAvatar}>
                                        {c.other_user?.avatar_url ? (
                                            <Image source={{ uri: c.other_user.avatar_url }} style={s.listImg} />
                                        ) : (
                                            <Text style={s.listInitials}>{c.other_user?.full_name?.charAt(0) || 'U'}</Text>
                                        )}
                                        {c.other_user && isUserOnline(c.other_user.id) && <View style={s.listOnline} />}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.listTitle, activeConversation?.id === c.id && { color: '#8B5CF6' }]}>{c.other_user?.full_name || 'User'}</Text>
                                        <Text style={s.listSub} numberOfLines={1}>{c.last_message?.content || 'No messages'}</Text>
                                    </View>
                                    {(c.unread_count || 0) > 0 && <View style={[s.badge, { backgroundColor: '#8B5CF6' }]}><Text style={s.badgeText}>{c.unread_count}</Text></View>}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Custom Action Sheet */}
            <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={() => setSelectedMessage(null)}>
                <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setSelectedMessage(null)}>
                    <View style={s.actionSheet}>
                        <TouchableOpacity style={s.actionRow} onPress={() => selectedMessage && handleReply(selectedMessage)}>
                            <Reply size={20} color="#3B82F6" />
                            <Text style={s.actionText}>Reply</Text>
                        </TouchableOpacity>
                        <View style={s.div} />
                        <TouchableOpacity style={s.actionRow} onPress={() => selectedMessage && handleCopy(selectedMessage)}>
                            <Copy size={20} color="#64748B" />
                            <Text style={s.actionText}>Copy Text</Text>
                        </TouchableOpacity>
                        {selectedMessage?.sender_id === user?.id && (
                            <>
                                <View style={s.div} />
                                <TouchableOpacity style={s.actionRow} onPress={() => selectedMessage && handleEdit(selectedMessage)}>
                                    <Edit3 size={20} color="#F97316" />
                                    <Text style={s.actionText}>Edit Message</Text>
                                </TouchableOpacity>
                                <View style={s.div} />
                                <TouchableOpacity style={s.actionRow} onPress={() => selectedMessage && handleDeleteMessage(selectedMessage)}>
                                    <Trash2 size={20} color="#EF4444" />
                                    <Text style={[s.actionText, { color: '#EF4444' }]}>Delete</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Modals for Create Channel & Start DM */}
            <Modal visible={showCreateChannel} transparent animationType="fade" onRequestClose={() => setShowCreateChannel(false)}>
                <View style={s.centerOverlay}>
                    <View style={s.dialogBox}>
                        <Text style={s.dialogTitle}>New Channel</Text>
                        <TextInput style={s.dialogInput} placeholder="Channel Name" value={newChannelName} onChangeText={setNewChannelName} autoFocus />
                        <View style={s.dialogButtons}>
                            <TouchableOpacity onPress={() => setShowCreateChannel(false)} style={s.dialogBtn}><Text style={s.dialogBtnText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateChannel} style={[s.dialogBtn, s.dialogBtnPrimary]}><Text style={[s.dialogBtnText, { color: '#FFF' }]}>Create</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal visible={showStartDM} transparent animationType="fade" onRequestClose={() => setShowStartDM(false)}>
                <View style={s.centerOverlay}>
                    <View style={[s.dialogBox, { maxHeight: 400 }]}>
                        <Text style={s.dialogTitle}>New Message</Text>
                        {membersLoading ? <ActivityIndicator color="#F97316" /> : (
                            <ScrollView>
                                {workspaceMembers.map(m => (
                                    <TouchableOpacity key={m.user_id} style={s.memberItem} onPress={() => handleStartDM(m.user_id)}>
                                        <View style={s.memberAvatar}><Text style={{ fontWeight: '700', color: '#FFF' }}>{m.full_name?.charAt(0)}</Text></View>
                                        <Text style={s.memberName}>{m.full_name || m.email}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                        <TouchableOpacity onPress={() => setShowStartDM(false)} style={[s.dialogBtn, { marginTop: 16, width: '100%' }]}><Text style={s.dialogBtnText}>Cancel</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 2, zIndex: 10 },
    headerTitleBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerIconContainer: { position: 'relative' },
    headerAvatar: { width: 44, height: 44, borderRadius: 16 },
    headerAvatarPlaceholder: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', letterSpacing: -0.5 },
    headerSub: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    onlineBadge: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2.5, borderColor: '#FFF' },
    searchBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },

    // Message List
    dateDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, justifyContent: 'center' },
    dateLine: { width: 40, height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 12 },
    dateText: { fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14, gap: 10 },
    msgRowOwn: { flexDirection: 'row-reverse' },
    avatarContainer: { width: 32 },
    avatarImage: { width: 32, height: 32, borderRadius: 12 },
    avatar: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    avatarSpacer: { width: 32 },
    senderName: { fontSize: 11, color: '#64748B', marginBottom: 4, marginLeft: 4, fontWeight: '600' },

    // Bubbles
    bubble: { paddingHorizontal: 16, paddingVertical: 12, maxWidth: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    bubbleOwn: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#F1F5F9' },
    bubbleGroupTopOwn: { borderBottomRightRadius: 4 },
    bubbleGroupBottomOwn: { borderTopRightRadius: 4 },
    bubbleGroupTopOther: { borderBottomLeftRadius: 4 },
    bubbleGroupBottomOther: { borderTopLeftRadius: 4 },

    msgText: { fontSize: 16, lineHeight: 24, color: '#1E293B' },
    msgTextOwn: { color: '#FFF' },
    msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
    msgTime: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
    editedTag: { fontSize: 10, color: '#94A3B8', fontStyle: 'italic' },

    replyPreview: { backgroundColor: 'rgba(0,0,0,0.03)', padding: 10, borderRadius: 12, flexDirection: 'row', gap: 10, marginBottom: 8 },
    replyPreviewOwn: { backgroundColor: 'rgba(255,255,255,0.2)' },
    replyPreviewOther: { backgroundColor: '#F8FAFC' },
    replyBar: { width: 3, borderRadius: 2 },
    replyName: { fontSize: 12, fontWeight: '700' },
    replyContent: { fontSize: 13 },

    // Input
    inputContainer: { width: '100%', paddingHorizontal: 16, backgroundColor: 'transparent' },
    inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    inputField: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 28, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, minHeight: 52, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    textInput: { flex: 1, fontSize: 16, maxHeight: 120, color: '#0F172A', paddingVertical: 10 },
    emojiBtn: { marginRight: 8 },
    sendBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    sendBtnActive: { backgroundColor: '#F97316', shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    replyBarFloat: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 16, marginBottom: 8, marginHorizontal: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
    replyBarLine: { width: 4, height: 36, borderRadius: 2, marginRight: 12 },
    replyBarTitle: { fontSize: 13, fontWeight: '700', color: '#64748B' },
    replyBarText: { fontSize: 14, color: '#1E293B' },

    // Typing Indicator Floating
    typingFloat: { position: 'absolute', top: -30, left: 24, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    typingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#F97316' },
    typingText: { fontSize: 12, fontWeight: '600', color: '#64748B', marginLeft: 4 },

    // Sheets & Dialogs
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheetContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 40 },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
    tabSwitcher: { flexDirection: 'row', padding: 16, gap: 12 },
    tabBtn: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', flexDirection: 'row', gap: 8 },
    tabBtnActive: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5' },
    tabText: { fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#F97316' },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
    sheetTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    addBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
    listItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14, borderRadius: 18, marginBottom: 4 },
    listItemActive: { backgroundColor: '#FFF7ED' },
    listIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    listTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    listSub: { fontSize: 13, color: '#94A3B8' },
    badge: { backgroundColor: '#F97316', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    badgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },

    // Action Sheet
    actionSheet: { backgroundColor: '#FFF', borderRadius: 24, margin: 20, padding: 8, marginBottom: 40 },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 },
    actionText: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
    div: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },

    // Dialogs
    centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    dialogBox: { backgroundColor: '#FFF', borderRadius: 28, padding: 24 },
    dialogTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
    dialogInput: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 14, fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    dialogButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
    dialogBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
    dialogBtnPrimary: { backgroundColor: '#F97316' },
    dialogBtnText: { fontWeight: '700', color: '#64748B', fontSize: 15 },
    memberItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    memberAvatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
    memberName: { fontSize: 16, fontWeight: '600' }
});
