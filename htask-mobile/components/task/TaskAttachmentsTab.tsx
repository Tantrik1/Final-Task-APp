import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Paperclip,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Upload,
  Camera,
  FolderOpen,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface TaskAttachmentsTabProps {
  taskId: string;
  userId: string;
  attachments: any[];
  onRefresh: () => void;
}

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

export function TaskAttachmentsTab({ taskId, userId, attachments, onRefresh }: TaskAttachmentsTabProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);

  const uploadFile = async (uri: string, fileName: string, fileType: string, fileSize: number) => {
    setIsUploading(true);
    try {
      const filePath = `task-attachments/${taskId}/${Date.now()}_${fileName}`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, blob, { contentType: fileType });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        user_id: userId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_url: urlData.publicUrl,
      });

      if (dbError) throw dbError;
      onRefresh();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      Alert.alert('Upload Failed', error.message || 'Could not upload file');
    } finally {
      setIsUploading(false);
      setShowUploadOptions(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      await uploadFile(
        file.uri,
        file.name || 'document',
        file.mimeType || 'application/octet-stream',
        file.size || 0,
      );
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library access to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const fileName = asset.fileName || `image_${Date.now()}.jpg`;
      const fileType = asset.mimeType || 'image/jpeg';
      const fileSize = asset.fileSize || 0;

      await uploadFile(asset.uri, fileName, fileType, fileSize);
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera access to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
      const fileType = asset.mimeType || 'image/jpeg';
      const fileSize = asset.fileSize || 0;

      await uploadFile(asset.uri, fileName, fileType, fileSize);
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  const handleDelete = (attachmentId: string, fileName: string) => {
    Alert.alert('Delete Attachment', `Remove "${fileName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('task_attachments').delete().eq('id', attachmentId);
            onRefresh();
          } catch (error) { console.error('Error deleting attachment:', error); }
        }
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContent} style={{ flex: 1 }}>
        {attachments.length === 0 && !isUploading ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Paperclip size={28} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No attachments</Text>
            <Text style={styles.emptySub}>Upload files, images or documents</Text>
          </View>
        ) : (
          attachments.map(att => {
            const FileIcon = getFileIcon(att.file_type);
            const isImage = att.file_type?.startsWith('image/');
            return (
              <View key={att.id} style={styles.card}>
                <View style={[styles.iconWrap, isImage && { backgroundColor: '#FFF7ED' }]}>
                  <FileIcon size={18} color={isImage ? '#F97316' : '#64748B'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{att.file_name}</Text>
                  <Text style={styles.fileMeta}>
                    {formatFileSize(att.file_size)} · {att.uploader?.full_name || 'Unknown'} · {formatDistanceToNow(new Date(att.created_at), { addSuffix: true })}
                  </Text>
                </View>
                {att.user_id === userId && (
                  <TouchableOpacity onPress={() => handleDelete(att.id, att.file_name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Trash2 size={15} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
        {isUploading && (
          <View style={styles.uploadingCard}>
            <ActivityIndicator size="small" color="#F97316" />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}
      </ScrollView>

      {/* Upload button */}
      {showUploadOptions ? (
        <View style={styles.uploadOptions}>
          <TouchableOpacity style={styles.uploadOptionBtn} onPress={handlePickDocument}>
            <FolderOpen size={18} color="#3B82F6" />
            <Text style={styles.uploadOptionText}>Browse Files</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadOptionBtn} onPress={handlePickImage}>
            <ImageIcon size={18} color="#22C55E" />
            <Text style={styles.uploadOptionText}>Photo Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadOptionBtn} onPress={handleTakePhoto}>
            <Camera size={18} color="#F97316" />
            <Text style={styles.uploadOptionText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadCancelBtn} onPress={() => setShowUploadOptions(false)}>
            <Text style={styles.uploadCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={() => setShowUploadOptions(true)} disabled={isUploading}>
          <Upload size={16} color="#FFF" />
          <Text style={styles.fabText}>Upload File</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 20 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94A3B8' },
  emptySub: { fontSize: 13, color: '#CBD5E1' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8, backgroundColor: '#FFF' },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  fileMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  uploadingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#FFEDD5', backgroundColor: '#FFF7ED', marginTop: 8 },
  uploadingText: { fontSize: 13, fontWeight: '600', color: '#F97316' },

  uploadOptions: { paddingHorizontal: 16, paddingVertical: 12, gap: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFF' },
  uploadOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#F8FAFC' },
  uploadOptionText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  uploadCancelBtn: { alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F1F5F9', marginTop: 4 },
  uploadCancelText: { fontSize: 14, fontWeight: '600', color: '#64748B' },

  fab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginHorizontal: 16, marginBottom: 14, borderRadius: 14, backgroundColor: '#F97316', shadowColor: '#F97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  fabText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
