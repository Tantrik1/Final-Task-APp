import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  AlignLeft,
  ChevronRight,
  Trash2,
  X,
  Paperclip,
  Link2,
  ExternalLink,
  Upload,
  Plus,
  FileText,
  Image as ImageIcon,
  File,
  FolderOpen,
  Camera,
} from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';

const getFileIcon = (fileType: string) => {
  if (fileType?.startsWith('image/')) return ImageIcon;
  if (fileType?.includes('pdf') || fileType?.includes('document') || fileType?.includes('text')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface TaskDetailsTabProps {
  taskId: string;
  task: any;
  attachments: any[];
  links: any[];
  userId: string;
  onTaskUpdated: () => void;
  onDelete: () => void;
  onAttachmentsRefresh: () => void;
  onLinksRefresh: () => void;
}

export function TaskDetailsTab({ taskId, task, attachments, links, userId, onTaskUpdated, onDelete, onAttachmentsRefresh, onLinksRefresh }: TaskDetailsTabProps) {
  const [description, setDescription] = useState(task?.description || '');
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(true);
  const [linksExpanded, setLinksExpanded] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state when task prop changes
  useEffect(() => {
    if (task) {
      setDescription(task.description || '');
    }
  }, [task?.id, task?.description]);

  const syncField = useCallback(async (field: string, value: any, extra?: Record<string, any>) => {
    try {
      const update: Record<string, any> = { [field]: value, ...extra };
      const { error } = await supabase.from('tasks').update(update).eq('id', taskId);
      if (error) throw error;
      onTaskUpdated();
    } catch (err: any) {
      console.error(`[TaskDetailTab] Error syncing ${field}:`, err);
    }
  }, [taskId, onTaskUpdated]);

  const handleDescChange = (text: string) => {
    setDescription(text);
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(() => {
      syncField('description', text.trim() || null);
    }, 800);
  };

  const handleDeleteTask = () => {
    Alert.alert('Delete Task', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
            onDelete();
          } catch (err: any) {
            console.error('Error deleting task:', err);
            Alert.alert('Error', 'Failed to delete task');
          }
        }
      },
    ]);
  };

  // ─── Attachment handlers ───
  const uploadFile = async (uri: string, fileName: string, fileType: string, fileSize: number) => {
    setIsUploading(true);
    try {
      const filePath = `task-attachments/${taskId}/${Date.now()}_${fileName}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, blob, { contentType: fileType });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);
      const { error: dbError } = await supabase.from('task_attachments').insert({
        task_id: taskId, user_id: userId, file_name: fileName, file_type: fileType, file_size: fileSize, file_url: urlData.publicUrl,
      });
      if (dbError) throw dbError;
      onAttachmentsRefresh();
    } catch (error: any) {
      console.error('[TaskDetailTab] Upload failed:', error);
      Alert.alert('Upload Failed', error.message || 'Could not upload file');
    } finally {
      setIsUploading(false);
      setShowUploadOptions(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      await uploadFile(file.uri, file.name || 'document', file.mimeType || 'application/octet-stream', file.size || 0);
    } catch (error) { console.error('[TaskDetailTab] Error picking document:', error); }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Please grant photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      await uploadFile(a.uri, a.fileName || `image_${Date.now()}.jpg`, a.mimeType || 'image/jpeg', a.fileSize || 0);
    } catch (error) { console.error('[TaskDetailTab] Error picking image:', error); }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Please grant camera access.'); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      await uploadFile(a.uri, a.fileName || `photo_${Date.now()}.jpg`, a.mimeType || 'image/jpeg', a.fileSize || 0);
    } catch (error) { console.error('[TaskDetailTab] Error taking photo:', error); }
  };

  const handleDeleteAttachment = (attId: string, fileName: string) => {
    Alert.alert('Delete Attachment', `Remove "${fileName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await supabase.from('task_attachments').delete().eq('id', attId); onAttachmentsRefresh(); } catch (e) { console.error('[TaskDetailTab] Delete attachment error:', e); }
        }
      },
    ]);
  };

  // ─── Link handlers ───
  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) return;
    setIsSubmittingLink(true);
    try {
      const { error } = await supabase.from('task_links').insert({
        task_id: taskId, user_id: userId, title: newLinkTitle.trim() || newLinkUrl.trim(), url: newLinkUrl.trim(),
      });
      if (error) throw error;
      setNewLinkTitle(''); setNewLinkUrl(''); setShowAddLinkForm(false);
      onLinksRefresh();
    } catch (error: any) {
      console.error('[TaskDetailTab] Add link error:', error);
      Alert.alert('Error', 'Failed to add link');
    } finally { setIsSubmittingLink(false); }
  };

  const handleDeleteLink = (linkId: string) => {
    Alert.alert('Remove Link', 'Remove this link?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try { await supabase.from('task_links').delete().eq('id', linkId); onLinksRefresh(); } catch (e) { console.error('[TaskDetailTab] Delete link error:', e); }
        }
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
      {/* ─── Description ─── */}
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <AlignLeft size={14} color="#94A3B8" />
          <Text style={styles.label}>Description</Text>
        </View>
        <TextInput
          style={styles.descInput}
          placeholder="Add details..."
          placeholderTextColor="#CBD5E1"
          value={description}
          onChangeText={handleDescChange}
          multiline
          blurOnSubmit={true}
          returnKeyType="done"
        />
      </View>

      {/* ─── Attachments (inline) ─── */}
      <View style={styles.divider} />
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setAttachmentsExpanded(!attachmentsExpanded)}>
        <View style={styles.sectionHeaderLeft}>
          <Paperclip size={14} color="#64748B" />
          <Text style={styles.sectionTitle}>Attachments</Text>
          {attachments.length > 0 && (
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{attachments.length}</Text></View>
          )}
        </View>
        <ChevronRight size={16} color="#94A3B8" style={{ transform: [{ rotate: attachmentsExpanded ? '90deg' : '0deg' }] }} />
      </TouchableOpacity>

      {attachmentsExpanded && (
        <View style={styles.sectionContent}>
          {attachments.length === 0 && !isUploading ? (
            <Text style={styles.emptyText}>No attachments yet</Text>
          ) : (
            attachments.map(att => {
              const FileIcon = getFileIcon(att.file_type);
              const isImage = att.file_type?.startsWith('image/');
              return (
                <View key={att.id} style={styles.fileCard}>
                  <View style={[styles.fileIconWrap, isImage && { backgroundColor: '#FFF7ED' }]}>
                    <FileIcon size={16} color={isImage ? '#F97316' : '#64748B'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{att.file_name}</Text>
                    <Text style={styles.fileMeta}>{formatFileSize(att.file_size)} · {formatDistanceToNow(new Date(att.created_at), { addSuffix: true })}</Text>
                  </View>
                  {att.user_id === userId && (
                    <TouchableOpacity onPress={() => handleDeleteAttachment(att.id, att.file_name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Trash2 size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
          {isUploading && (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color="#F97316" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}
          {showUploadOptions ? (
            <View style={styles.uploadOptions}>
              <TouchableOpacity style={styles.uploadOption} onPress={handlePickDocument}>
                <FolderOpen size={15} color="#3B82F6" /><Text style={styles.uploadOptionText}>Files</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadOption} onPress={handlePickImage}>
                <ImageIcon size={15} color="#22C55E" /><Text style={styles.uploadOptionText}>Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadOption} onPress={handleTakePhoto}>
                <Camera size={15} color="#F97316" /><Text style={styles.uploadOptionText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowUploadOptions(false)}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.inlineAddBtn} onPress={() => setShowUploadOptions(true)}>
              <Upload size={13} color="#F97316" /><Text style={styles.inlineAddText}>Upload file</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ─── Links (inline) ─── */}
      <View style={styles.divider} />
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setLinksExpanded(!linksExpanded)}>
        <View style={styles.sectionHeaderLeft}>
          <Link2 size={14} color="#64748B" />
          <Text style={styles.sectionTitle}>Links</Text>
          {links.length > 0 && (
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{links.length}</Text></View>
          )}
        </View>
        <ChevronRight size={16} color="#94A3B8" style={{ transform: [{ rotate: linksExpanded ? '90deg' : '0deg' }] }} />
      </TouchableOpacity>

      {linksExpanded && (
        <View style={styles.sectionContent}>
          {links.length === 0 && !showAddLinkForm ? (
            <Text style={styles.emptyText}>No links yet</Text>
          ) : (
            links.map(link => (
              <TouchableOpacity key={link.id} style={styles.linkCard} onPress={() => Linking.openURL(link.url)}>
                <View style={styles.linkIconWrap}><ExternalLink size={14} color="#3B82F6" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkTitle} numberOfLines={1}>{link.title}</Text>
                  <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                </View>
                {link.user_id === userId && (
                  <TouchableOpacity onPress={() => handleDeleteLink(link.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
          {showAddLinkForm ? (
            <View style={styles.addLinkForm}>
              <TextInput style={styles.addLinkInput} placeholder="Title (optional)" placeholderTextColor="#94A3B8" value={newLinkTitle} onChangeText={setNewLinkTitle} />
              <TextInput style={styles.addLinkInput} placeholder="https://..." placeholderTextColor="#94A3B8" value={newLinkUrl} onChangeText={setNewLinkUrl} autoCapitalize="none" keyboardType="url" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.addLinkCancel} onPress={() => { setShowAddLinkForm(false); setNewLinkTitle(''); setNewLinkUrl(''); }}>
                  <Text style={styles.addLinkCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.addLinkSave, (!newLinkUrl.trim() || isSubmittingLink) && { opacity: 0.4 }]} onPress={handleAddLink} disabled={!newLinkUrl.trim() || isSubmittingLink}>
                  <Text style={styles.addLinkSaveText}>{isSubmittingLink ? 'Adding...' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.inlineAddBtn} onPress={() => setShowAddLinkForm(true)}>
              <Plus size={13} color="#F97316" /><Text style={styles.inlineAddText}>Add link</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ─── Meta info ─── */}
      <View style={styles.divider} />
      <View style={styles.metaSection}>
        {task?.creator?.full_name && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Created by</Text>
            <Text style={styles.metaValue}>{task.creator.full_name}</Text>
          </View>
        )}
        {task?.created_at && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</Text>
          </View>
        )}
      </View>

      {/* ─── Delete ─── */}
      <View style={styles.divider} />
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteTask}>
        <Trash2 size={16} color="#EF4444" />
        <Text style={styles.deleteBtnText}>Delete Task</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  inputGroup: { marginBottom: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  descInput: { fontSize: 15, color: '#334155', padding: 0, minHeight: 36, textAlignVertical: 'top', lineHeight: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  sectionBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, minWidth: 18, alignItems: 'center' },
  sectionBadgeText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  sectionContent: { marginTop: 8, gap: 6 },
  emptyText: { fontSize: 13, color: '#CBD5E1', paddingVertical: 8 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FAFAFA' },
  fileIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  fileMeta: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFF7ED' },
  uploadingText: { fontSize: 12, fontWeight: '600', color: '#F97316' },
  uploadOptions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  uploadOption: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  uploadOptionText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  inlineAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8 },
  inlineAddText: { fontSize: 13, fontWeight: '600', color: '#F97316' },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FAFAFA' },
  linkIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  linkTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  linkUrl: { fontSize: 11, color: '#3B82F6', marginTop: 1 },
  addLinkForm: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FAFAFA', gap: 8 },
  addLinkInput: { fontSize: 13, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF' },
  addLinkCancel: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  addLinkCancelText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  addLinkSave: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F97316' },
  addLinkSaveText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  metaSection: { gap: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { fontSize: 13, color: '#94A3B8' },
  metaValue: { fontSize: 13, color: '#475569', fontWeight: '500' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FEF2F2', marginTop: 8 },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
});
