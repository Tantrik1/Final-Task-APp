import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Clock, Trash2, Timer, Hash, CalendarDays } from 'lucide-react-native';
import { format } from 'date-fns';

import { TaskSession } from '@/hooks/useTaskTimer';

interface TaskSessionsTabProps {
  sessions: TaskSession[];
  isRunning: boolean;
  elapsedTime: number;
  totalWorkTime: number;
  onDeleteSession?: (sessionId: string) => void;
}

const formatTimeFull = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
};

const formatTimeLive = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export function TaskSessionsTab({ sessions, isRunning, elapsedTime, totalWorkTime, onDeleteSession }: TaskSessionsTabProps) {
  const handleDeletePress = (session: TaskSession) => {
    Alert.alert(
      'Delete Session',
      `Remove this ${session.session_type === 'start' ? 'start' : 'resume'} session?${session.duration_seconds ? `\n\nDuration: ${formatTimeFull(session.duration_seconds)}` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteSession?.(session.id) },
      ]
    );
  };

  const displayTotal = totalWorkTime + (isRunning ? elapsedTime : 0);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={{ flex: 1 }}>
      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Clock size={28} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Start the timer to track your work</Text>
        </View>
      ) : (
        <>
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Timer size={14} color="#F97316" />
                <Text style={styles.summaryLabel}>Total Time</Text>
                <Text style={styles.summaryValue}>{formatTimeFull(displayTotal)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Hash size={14} color="#3B82F6" />
                <Text style={styles.summaryLabel}>Sessions</Text>
                <Text style={styles.summaryValue}>{sessions.length}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <CalendarDays size={14} color="#8B5CF6" />
                <Text style={styles.summaryLabel}>First</Text>
                <Text style={styles.summaryValue}>{format(new Date(sessions[sessions.length - 1].started_at), 'MMM d')}</Text>
              </View>
            </View>
          </View>

          {/* Session list */}
          {sessions.map((session, index) => {
            const isActive = !session.ended_at;
            return (
              <TouchableOpacity
                key={session.id}
                style={[styles.card, isActive && styles.cardActive]}
                onLongPress={() => handleDeletePress(session)}
                delayLongPress={500}
                activeOpacity={0.7}
              >
                <View style={[styles.num, { backgroundColor: session.session_type === 'start' ? '#EFF6FF' : '#FFF7ED' }]}>
                  <Text style={[styles.numText, { color: session.session_type === 'start' ? '#3B82F6' : '#F97316' }]}>
                    {sessions.length - index}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.type}>{session.session_type === 'start' ? 'Started' : 'Resumed'}</Text>
                    {isActive && (
                      <View style={styles.activeBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeBadgeText}>Live</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.time}>
                    {format(new Date(session.started_at), 'MMM d, yyyy h:mm a')}
                    {session.ended_at && ` → ${format(new Date(session.ended_at), 'h:mm a')}`}
                  </Text>
                </View>
                <Text style={[styles.duration, isActive && isRunning && styles.durationLive]}>
                  {session.duration_seconds
                    ? formatTimeFull(session.duration_seconds)
                    : isRunning ? formatTimeLive(elapsedTime) : '-'}
                </Text>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.hint}>Long-press a session to delete it</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94A3B8' },
  emptySub: { fontSize: 13, color: '#CBD5E1' },

  summaryCard: { padding: 16, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8, backgroundColor: '#FFF' },
  cardActive: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  num: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 12, fontWeight: '700' },
  type: { fontSize: 13, fontWeight: '600', color: '#334155' },
  time: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  duration: { fontSize: 13, fontWeight: '600', color: '#1E293B', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  durationLive: { color: '#22C55E' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#DCFCE7' },
  activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#22C55E' },
  activeBadgeText: { fontSize: 10, fontWeight: '600', color: '#22C55E' },

  hint: { textAlign: 'center', fontSize: 11, color: '#CBD5E1', marginTop: 8 },
});
