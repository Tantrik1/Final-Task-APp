import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { Check } from 'lucide-react-native';

interface PickerOption {
  value: string;
  label: string;
  color?: string;
  subtitle?: string;
}

interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
}

export function PickerModal({ visible, onClose, title, options, selectedValue, onSelect }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.option, selectedValue === opt.value && styles.optionActive]}
                onPress={() => { onSelect(opt.value); onClose(); }}
              >
                {opt.color && <View style={[styles.dot, { backgroundColor: opt.color }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionText, selectedValue === opt.value && styles.optionTextActive]}>
                    {opt.label}
                  </Text>
                  {opt.subtitle && <Text style={styles.optionSub}>{opt.subtitle}</Text>}
                </View>
                {selectedValue === opt.value && <Check size={18} color="#F97316" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, maxHeight: '70%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: '#1E293B', paddingHorizontal: 20, marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 12 },
  optionActive: { backgroundColor: '#FFF7ED' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  optionText: { fontSize: 15, fontWeight: '500', color: '#334155' },
  optionTextActive: { color: '#F97316', fontWeight: '600' },
  optionSub: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8, marginHorizontal: 20, borderRadius: 12, backgroundColor: '#F1F5F9' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
});
