import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Activity } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ActivityItem, ActivityLog } from '../ActivityItem';

interface TaskActivityTabProps {
  taskId: string;
}

export function TaskActivityTab({ taskId }: TaskActivityTabProps) {
  const { colors } = useTheme();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivityLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          actor:profiles!activity_logs_actor_id_fkey(full_name, email, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivityLogs();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Activity size={36} color={colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: colors.textTertiary }]}>No activity yet</Text>
        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>Actions on this task will appear here</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.timeline}>
        {activities.map((activity, index) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            isLast={index === activities.length - 1}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94A3B8' },
  emptySub: { fontSize: 13, color: '#CBD5E1' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  timeline: { gap: 0 },
});
