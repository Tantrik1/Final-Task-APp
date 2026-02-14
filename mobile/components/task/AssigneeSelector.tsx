import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import {
  Check,
  X,
  UserPlus,
  Search,
  Trash2,
  User,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface Member {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url?: string | null;
}

interface Assignee {
  id: string;
  user_id: string;
  assigned_at: string;
  profile?: Member;
}

interface AssigneeSelectorProps {
  taskId: string;
  userId: string;
  assignees: Assignee[];
  members: Member[];
  onRefresh: () => void;
  showInlineList?: boolean;
}

export interface AssigneeSelectorHandle {
  openPicker: () => void;
}

// Swipable chip — swipe up to remove
function SwipableChip({ name, initials, color, onRemove }: { name: string; initials: string; color: string; onRemove: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy < 0) {
          translateY.setValue(gs.dy);
          opacity.setValue(1 + gs.dy / 80);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -40) {
          Animated.parallel([
            Animated.timing(translateY, { toValue: -60, duration: 150, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
          ]).start(() => onRemove());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          Animated.spring(opacity, { toValue: 1, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.chip, { transform: [{ translateY }], opacity }]} {...panResponder.panHandlers}>
      <View style={[styles.chipAvatar, { backgroundColor: color + '20' }]}>
        <Text style={[styles.chipAvatarText, { color }]}>{initials}</Text>
      </View>
      <Text style={styles.chipName} numberOfLines={1}>{name}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={styles.chipRemove}>
        <X size={12} color="#94A3B8" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export const AssigneeSelector = forwardRef<AssigneeSelectorHandle, AssigneeSelectorProps>(({ taskId, userId, assignees, members, onRefresh, showInlineList = true }, ref) => {
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    openPicker: () => setShowPicker(true)
  }));

  const assignedUserIds = new Set(assignees.map(a => a.user_id));

  const filteredMembers = members.filter(m => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (m.full_name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  });

  const handleAdd = async (memberId: string) => {
    setIsLoading(true);
    const member = members.find(m => m.id === memberId);
    console.log(`[Activity] Adding assignee: ${member?.full_name || member?.email || memberId} to task ${taskId}`);
    try {
      // Try task_assignees table first
      const { error } = await supabase.from('task_assignees').insert({
        task_id: taskId,
        user_id: memberId,
        assigned_by: userId,
      });
      if (error && error.code !== '23505') {
        // Table may not exist — fall back to assigned_to only
        await supabase.from('tasks').update({ assigned_to: memberId }).eq('id', taskId);
      } else if (!error && assignees.length === 0) {
        // Also update legacy assigned_to field for backwards compat
        await supabase.from('tasks').update({ assigned_to: memberId }).eq('id', taskId);
      }
      console.log(`[Activity] ✓ Assignee added: ${member?.full_name || memberId}`);
      onRefresh();
    } catch (error: any) {
      console.error('[Activity] ✗ Error adding assignee:', error);
      Alert.alert('Error', 'Failed to add assignee');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (assigneeId: string, assigneeUserId: string) => {
    const assignee = assignees.find(a => a.id === assigneeId);
    console.log(`[Activity] Removing assignee: ${assignee?.profile?.full_name || assigneeUserId} from task ${taskId}`);
    try {
      // Try task_assignees table
      await supabase.from('task_assignees').delete().eq('id', assigneeId);
      // Update legacy assigned_to
      const remaining = assignees.filter(a => a.id !== assigneeId);
      if (remaining.length > 0) {
        await supabase.from('tasks').update({ assigned_to: remaining[0].user_id }).eq('id', taskId);
      } else {
        await supabase.from('tasks').update({ assigned_to: null }).eq('id', taskId);
      }
      console.log(`[Activity] ✓ Assignee removed: ${assignee?.profile?.full_name || assigneeUserId}`);
      onRefresh();
    } catch (error) {
      console.error('[Activity] ✗ Error removing assignee:', error);
    }
  };

  const handleClearAll = () => {
    if (assignees.length === 0) return;
    Alert.alert('Clear All Assignees', `Remove all ${assignees.length} assignees?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive', onPress: async () => {
          console.log(`[Activity] Clearing all ${assignees.length} assignees from task ${taskId}`);
          try {
            // Try task_assignees table (may not exist)
            await supabase.from('task_assignees').delete().eq('task_id', taskId);
          } catch (_) { /* table may not exist */ }
          try {
            await supabase.from('tasks').update({ assigned_to: null }).eq('id', taskId);
            console.log('[Activity] ✓ All assignees cleared');
            onRefresh();
          } catch (error) {
            console.error('[Activity] ✗ Error clearing assignees:', error);
          }
        }
      },
    ]);
  };

  const handleToggle = (member: Member) => {
    if (assignedUserIds.has(member.id)) {
      const assignee = assignees.find(a => a.user_id === member.id);
      if (assignee) handleRemove(assignee.id, assignee.user_id);
    } else {
      handleAdd(member.id);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email[0].toUpperCase();
  };

  const getColor = (str: string) => {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#22C55E', '#14B8A6', '#EF4444', '#6366F1'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <View>
      {/* Assignee chips — conditionally rendered */}
      {showInlineList && (
        <View style={styles.container}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Assignees</Text>
            {assignees.length > 1 && (
              <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAll}>
                <Trash2 size={11} color="#EF4444" />
                <Text style={styles.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>
          {assignees.length === 0 ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)}>
              <UserPlus size={14} color="#94A3B8" />
              <Text style={styles.addBtnText}>Add assignee</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {assignees.map(a => {
                const name = a.profile?.full_name || a.profile?.email?.split('@')[0] || 'User';
                const initials = getInitials(a.profile?.full_name || null, a.profile?.email || 'U');
                const color = getColor(a.user_id);
                return (
                  <SwipableChip
                    key={a.id}
                    name={name}
                    initials={initials}
                    color={color}
                    onRemove={() => handleRemove(a.id, a.user_id)}
                  />
                );
              })}
              <TouchableOpacity style={styles.addChip} onPress={() => setShowPicker(true)}>
                <UserPlus size={13} color="#F97316" />
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}

      {/* Picker Modal */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => { }}>
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Assignees</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.closeBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <Search size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search members..."
                placeholderTextColor="#94A3B8"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Assign to me shortcut */}
            {!assignedUserIds.has(userId) && (
              <TouchableOpacity style={styles.assignMeBtn} onPress={() => handleAdd(userId)}>
                <User size={16} color="#F97316" />
                <Text style={styles.assignMeText}>Assign to me</Text>
                {isLoading && <ActivityIndicator size="small" color="#F97316" style={{ marginLeft: 8 }} />}
              </TouchableOpacity>
            )}

            {/* Members list */}
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {filteredMembers.map(member => {
                const isAssigned = assignedUserIds.has(member.id);
                const initials = getInitials(member.full_name, member.email);
                const color = getColor(member.id);
                const name = member.full_name || member.email.split('@')[0];

                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.memberRow, isAssigned && styles.memberRowActive]}
                    onPress={() => handleToggle(member)}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.memberAvatarText, { color }]}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, isAssigned && { color: '#F97316', fontWeight: '700' }]}>{name}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>
                    <View style={[styles.checkBox, isAssigned && styles.checkBoxActive]}>
                      {isAssigned && <Check size={14} color="#FFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {filteredMembers.length === 0 && (
                <Text style={styles.noResults}>No members found</Text>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.sheetFooter}>
              <Text style={styles.footerCount}>{assignees.length} assigned</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={() => setShowPicker(false)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal >
    </View >
  );
});

const styles = StyleSheet.create({
  container: { paddingVertical: 8, paddingHorizontal: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '500', color: '#64748B' },
  chipsScroll: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 20, paddingLeft: 3, paddingRight: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  chipAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { fontSize: 10, fontWeight: '700' },
  chipName: { fontSize: 13, fontWeight: '500', color: '#334155', maxWidth: 100 },
  chipRemove: { padding: 2 },
  addChip: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#FFEDD5', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  addBtnText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearAllText: { fontSize: 11, color: '#EF4444', fontWeight: '600' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, maxHeight: '80%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  closeBtn: { padding: 4 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', padding: 0 },

  assignMeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#FFF7ED', borderRadius: 12, marginBottom: 8 },
  assignMeText: { fontSize: 14, fontWeight: '600', color: '#F97316' },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  memberRowActive: { backgroundColor: '#FFF7ED' },
  memberAvatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 13, fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '500', color: '#1E293B' },
  memberEmail: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: '#F97316', borderColor: '#F97316' },

  noResults: { textAlign: 'center', color: '#94A3B8', fontSize: 14, paddingVertical: 20 },

  sheetFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 8 },
  footerCount: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  doneBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#F97316' },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
