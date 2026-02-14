import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import {
  Clock,
  Target,
  TrendingUp,
  Eye,
  CheckCircle2,
  X,
} from 'lucide-react-native';

interface TimerPauseModalProps {
  visible: boolean;
  onClose: () => void;
  sessionDuration: string;
  statuses: any[];
  currentStatusId: string | null;
  onStatusChange: (statusId: string) => void;
}

export function TimerPauseModal({
  visible,
  onClose,
  sessionDuration,
  statuses,
  currentStatusId,
  onStatusChange,
}: TimerPauseModalProps) {
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(currentStatusId);

  const handleConfirm = () => {
    if (selectedStatusId && selectedStatusId !== currentStatusId) {
      console.log('[TimerPause] Updating status to:', selectedStatusId);
      onStatusChange(selectedStatusId);
    }
    onClose();
  };

  const getStatusIcon = (status: any) => {
    if (status.is_completed) return CheckCircle2;
    const n = status.name?.toLowerCase() || '';
    if (n.includes('progress') || n.includes('doing')) return TrendingUp;
    if (n.includes('review') || n.includes('testing')) return Eye;
    return Target;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Clock size={20} color="#F97316" />
            </View>
            <View>
              <Text style={styles.title}>Timer Paused</Text>
              <Text style={styles.subtitle}>
                You worked for <Text style={styles.durationText}>{sessionDuration}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.prompt}>Update task status?</Text>

          {/* Status options */}
          <View style={styles.options}>
            {statuses.map((status) => {
              const isSelected = selectedStatusId === status.id;
              const isCurrent = currentStatusId === status.id;
              const Icon = getStatusIcon(status);

              return (
                <TouchableOpacity
                  key={status.id}
                  style={[
                    styles.option,
                    isSelected && { borderColor: status.color || '#F97316', backgroundColor: (status.color || '#F97316') + '08' },
                  ]}
                  onPress={() => setSelectedStatusId(status.id)}
                >
                  <View style={[styles.optionIcon, { backgroundColor: (status.color || '#94A3B8') + '18' }]}>
                    <Icon size={16} color={status.color || '#94A3B8'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.optionLabel, isSelected && { color: status.color || '#F97316' }]}>{status.name}</Text>
                      {isCurrent && (
                        <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>Current</Text></View>
                      )}
                    </View>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: status.color || '#F97316' }]}>
                      <CheckCircle2 size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.keepBtn} onPress={onClose}>
              <Text style={styles.keepText}>Keep Current</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.updateBtn} onPress={handleConfirm}>
              <CheckCircle2 size={15} color="#FFF" />
              <Text style={styles.updateText}>Update Status</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 10, marginBottom: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  durationText: { fontWeight: '700', color: '#F97316' },
  closeBtn: { marginLeft: 'auto', padding: 4 },

  prompt: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, marginBottom: 10 },

  options: { paddingHorizontal: 20, gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: '#F1F5F9', backgroundColor: '#FAFAFA' },
  optionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
  currentBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: '#F1F5F9' },
  currentBadgeText: { fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  checkCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20 },
  keepBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#F1F5F9' },
  keepText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  updateBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F97316', ...Platform.select({ ios: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  updateText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
