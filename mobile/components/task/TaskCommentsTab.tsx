import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Keyboard,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Send,
  Reply,
  Trash2,
  ChevronUp,
  ChevronDown,
  CornerDownRight,
  MessageCircle,
} from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  user?: { full_name: string | null; email: string };
  replies?: Comment[];
}

interface TaskCommentsTabProps {
  taskId: string;
  userId: string;
  comments: Comment[];
  onRefresh: () => void;
}

// Responsive sizing hook
const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;

  return {
    isTablet,
    isLandscape,
    inputFontSize: isTablet ? 17 : 15,
    inputMinHeight: isTablet ? 48 : 40,
    inputMaxHeight: isTablet ? 160 : (isLandscape ? 72 : 100),
    sendBtnSize: isTablet ? 44 : 38,
    inputBorderRadius: isTablet ? 22 : 18,
    containerPaddingH: isTablet ? 20 : 12,
  };
};

export function TaskCommentsTab({ taskId, userId, comments, onRefresh }: TaskCommentsTabProps) {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();

  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Animated values
  const inputHeight = useRef(new Animated.Value(responsive.inputMinHeight)).current;
  const sendBtnScale = useRef(new Animated.Value(0.85)).current;
  const sendBtnOpacity = useRef(new Animated.Value(0.5)).current;
  const [inputContentHeight, setInputContentHeight] = useState(responsive.inputMinHeight);
  const scrollRef = useRef<ScrollView>(null);

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Animate send button
  useEffect(() => {
    const hasText = newComment.trim().length > 0;
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
  }, [newComment]);

  // Auto-grow input
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

  // Reset input height when text cleared
  useEffect(() => {
    if (newComment === '') {
      setInputContentHeight(responsive.inputMinHeight);
      Animated.spring(inputHeight, {
        toValue: responsive.inputMinHeight,
        friction: 10,
        tension: 120,
        useNativeDriver: false,
      }).start();
    }
  }, [newComment, responsive.inputMinHeight]);

  const handleSubmit = async (parentId: string | null = null) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim() || !userId || !taskId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('task_comments').insert({
        task_id: taskId, user_id: userId, parent_id: parentId, content: content.trim(),
      });
      if (error) throw error;
      if (parentId) {
        setReplyContent('');
        setReplyingTo(null);
        setExpandedReplies(prev => new Set([...prev, parentId]));
      } else {
        setNewComment('');
      }
      onRefresh();
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('task_comments').delete().eq('id', commentId);
            onRefresh();
          } catch (error) { console.error('Error deleting comment:', error); }
        }
      },
    ]);
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const n = new Set(prev);
      if (n.has(commentId)) n.delete(commentId);
      else n.add(commentId);
      return n;
    });
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const initials = comment.user?.full_name
      ? comment.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : comment.user?.email?.[0]?.toUpperCase() || 'U';

    return (
      <View key={comment.id} style={[isReply && styles.replyIndent]}>
        <View style={styles.commentRow}>
          <View style={[styles.avatar, isReply && styles.avatarSmall]}>
            <Text style={[styles.avatarText, isReply && { fontSize: 9 }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.commentHeader}>
              <Text style={styles.authorName}>
                {comment.user?.full_name || comment.user?.email?.split('@')[0] || 'User'}
              </Text>
              <Text style={styles.timeText}>
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </Text>
            </View>
            <Text style={styles.commentBody}>{comment.content}</Text>
            <View style={styles.actions}>
              {!isReply && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                >
                  <Reply size={12} color={replyingTo === comment.id ? '#F97316' : '#94A3B8'} />
                  <Text style={[styles.actionText, replyingTo === comment.id && { color: '#F97316' }]}>Reply</Text>
                </TouchableOpacity>
              )}
              {hasReplies && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleReplies(comment.id)}>
                  {isExpanded ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
                  <Text style={styles.actionText}>
                    {comment.replies?.length} {comment.replies?.length === 1 ? 'reply' : 'replies'}
                  </Text>
                </TouchableOpacity>
              )}
              {comment.user_id === userId && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(comment.id)}>
                  <Trash2 size={12} color="#EF4444" />
                  <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Reply input */}
            {replyingTo === comment.id && (
              <View style={styles.replyInputRow}>
                <CornerDownRight size={14} color="#CBD5E1" />
                <TextInput
                  style={styles.replyInput}
                  placeholder="Write a reply..."
                  placeholderTextColor="#CBD5E1"
                  value={replyContent}
                  onChangeText={setReplyContent}
                  multiline
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => handleSubmit(comment.id)}
                  disabled={!replyContent.trim() || isSubmitting}
                  style={[styles.replySendBtn, (!replyContent.trim() || isSubmitting) && { opacity: 0.4 }]}
                >
                  <Send size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        {hasReplies && isExpanded && comment.replies?.map(r => renderComment(r, true))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {comments.length === 0 ? (
          <View style={styles.empty}>
            <MessageCircle size={36} color="#E2E8F0" />
            <Text style={styles.emptyTitle}>No comments yet</Text>
            <Text style={styles.emptySub}>Be the first to start the conversation</Text>
          </View>
        ) : (
          comments.map(c => renderComment(c))
        )}
      </ScrollView>

      {/* Messenger-style comment input bar */}
      <View style={[
        styles.inputBar,
        {
          paddingBottom: keyboardVisible ? 6 : Math.max(insets.bottom, 6),
          paddingHorizontal: responsive.containerPaddingH,
        },
      ]}>
        <View style={[
          styles.inputWrapper,
          {
            borderRadius: responsive.inputBorderRadius,
            minHeight: responsive.inputMinHeight,
          },
        ]}>
          <Animated.View style={{ flex: 1, height: inputHeight }}>
            <TextInput
              style={[
                styles.input,
                {
                  fontSize: responsive.inputFontSize,
                  maxHeight: responsive.inputMaxHeight,
                },
              ]}
              placeholder="Write a comment..."
              placeholderTextColor="#94A3B8"
              value={newComment}
              onChangeText={setNewComment}
              onContentSizeChange={handleContentSizeChange}
              multiline
              maxLength={2000}
              textAlignVertical="center"
              scrollEnabled={inputContentHeight >= responsive.inputMaxHeight}
            />
          </Animated.View>
        </View>
        <Animated.View style={{
          transform: [{ scale: sendBtnScale }],
          opacity: sendBtnOpacity,
        }}>
          <TouchableOpacity
            onPress={() => handleSubmit(null)}
            disabled={!newComment.trim() || isSubmitting}
            activeOpacity={0.7}
            style={[
              styles.sendBtn,
              {
                width: responsive.sendBtnSize,
                height: responsive.sendBtnSize,
                borderRadius: responsive.sendBtnSize / 2,
              },
              (!newComment.trim() || isSubmitting) && styles.sendBtnDisabled,
            ]}
          >
            <Send size={responsive.isTablet ? 18 : 16} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 20 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94A3B8' },
  emptySub: { fontSize: 13, color: '#CBD5E1' },

  commentRow: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  avatarSmall: { width: 26, height: 26, borderRadius: 8 },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  authorName: { fontSize: 13, fontWeight: '700', color: '#334155' },
  timeText: { fontSize: 11, color: '#CBD5E1' },
  commentBody: { fontSize: 14, color: '#1E293B', lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  replyIndent: { marginLeft: 20, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: '#F1F5F9' },
  replyInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 10, paddingLeft: 4 },
  replyInput: {
    flex: 1, fontSize: 14, color: '#1E293B',
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    minHeight: 38, maxHeight: 80,
    textAlignVertical: 'top', backgroundColor: '#FAFAFA',
  },
  replySendBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },

  // Messenger-style input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#94A3B8',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  input: {
    flex: 1,
    color: '#1E293B',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontWeight: '400',
    lineHeight: 20,
  },
  sendBtn: {
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
});
