import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import {
  Link2,
  ExternalLink,
  Trash2,
  Plus,
} from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface TaskLinksTabProps {
  taskId: string;
  userId: string;
  links: any[];
  onRefresh: () => void;
}

export function TaskLinksTab({ taskId, userId, links, onRefresh }: TaskLinksTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('task_links').insert({
        task_id: taskId,
        user_id: userId,
        title: newTitle.trim() || newUrl.trim(),
        url: newUrl.trim(),
      });
      if (error) throw error;
      setNewTitle('');
      setNewUrl('');
      setShowAddForm(false);
      onRefresh();
    } catch (error: any) {
      console.error('Error adding link:', error);
      Alert.alert('Error', 'Failed to add link');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (linkId: string) => {
    Alert.alert('Remove Link', 'Remove this link?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('task_links').delete().eq('id', linkId);
            onRefresh();
          } catch (error) { console.error('Error deleting link:', error); }
        }
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={140}>
      <ScrollView contentContainerStyle={styles.scrollContent} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {links.length === 0 && !showAddForm ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Link2 size={28} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No links</Text>
            <Text style={styles.emptySub}>Add relevant links to this task</Text>
          </View>
        ) : (
          links.map(link => (
            <View key={link.id} style={styles.card}>
              <View style={styles.iconWrap}>
                <ExternalLink size={16} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle} numberOfLines={1}>{link.title}</Text>
                <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                <Text style={styles.linkMeta}>
                  {link.creator?.full_name || 'Unknown'} · {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
                </Text>
              </View>
              {link.user_id === userId && (
                <TouchableOpacity onPress={() => handleDelete(link.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={15} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.addFormTitle}>Add Link</Text>
            <TextInput
              style={styles.addInput}
              placeholder="Link title (optional)"
              placeholderTextColor="#94A3B8"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={styles.addInput}
              placeholder="https://..."
              placeholderTextColor="#94A3B8"
              value={newUrl}
              onChangeText={setNewUrl}
              autoCapitalize="none"
              keyboardType="url"
              autoFocus
            />
            <View style={styles.addFormActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowAddForm(false); setNewTitle(''); setNewUrl(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!newUrl.trim() || isSubmitting) && { opacity: 0.4 }]}
                onPress={handleAdd}
                disabled={!newUrl.trim() || isSubmitting}
              >
                <Text style={styles.saveBtnText}>{isSubmitting ? 'Adding...' : 'Add Link'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {!showAddForm && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowAddForm(true)}>
          <Plus size={16} color="#FFF" />
          <Text style={styles.fabText}>Add Link</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 20 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94A3B8' },
  emptySub: { fontSize: 13, color: '#CBD5E1' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8, backgroundColor: '#FFF' },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  linkTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  linkUrl: { fontSize: 12, color: '#3B82F6', marginTop: 1 },
  linkMeta: { fontSize: 11, color: '#94A3B8', marginTop: 3 },

  addForm: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FAFAFA', gap: 12, marginTop: 12 },
  addFormTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  addInput: { fontSize: 14, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFF' },
  addFormActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F1F5F9' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F97316' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  fab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginHorizontal: 16, marginBottom: 14, borderRadius: 14, backgroundColor: '#F97316', shadowColor: '#F97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  fabText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
