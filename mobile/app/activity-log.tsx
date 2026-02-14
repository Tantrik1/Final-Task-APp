import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import {
    Sparkles,
    Zap,
    MessageCircle,
    Users,
    Timer,
    FolderKanban,
    CircleDot,
    ArrowLeft
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ActivityItem } from '@/hooks/useDashboardData';

import { DashboardHeader } from '@/components/DashboardHeader';
import { GlobalTabBar } from '@/components/GlobalTabBar';

// Reusing Activity Icon logic from Dashboard
function getActivityIcon(type: string) {
    switch (type) {
        case 'create': return { icon: Sparkles, color: '#8B5CF6', bg: '#F5F3FF' };
        case 'update': return { icon: Zap, color: '#3B82F6', bg: '#EFF6FF' };
        case 'comment': return { icon: MessageCircle, color: '#06B6D4', bg: '#ECFEFF' };
        case 'assign': return { icon: Users, color: '#F97316', bg: '#FFF7ED' };
        case 'timer_start': case 'timer_pause': return { icon: Timer, color: '#10B981', bg: '#ECFDF5' };
        case 'upload': return { icon: FolderKanban, color: '#EC4899', bg: '#FDF2F8' };
        case 'join': return { icon: Users, color: '#22C55E', bg: '#F0FDF4' };
        default: return { icon: CircleDot, color: '#64748B', bg: '#F1F5F9' };
    }
}

const ActivityRow = ({ activity }: { activity: ActivityItem }) => {
    const router = useRouter();
    const { icon: Icon, color, bg } = getActivityIcon(activity.action_type);

    const handlePress = () => {
        if (activity.task_id) {
            router.push(`/task/${activity.task_id}` as any);
        } else if (activity.project_id) {
            router.push(`/project/${activity.project_id}` as any);
        }
    };

    return (
        <TouchableOpacity style={styles.activityRow} onPress={handlePress} activeOpacity={0.7}>
            <View style={[styles.activityIconWrap, { backgroundColor: bg }]}>
                <Icon size={16} color={color} />
            </View>
            <View style={styles.activityInfo}>
                <View style={styles.activityHeader}>
                    <Text style={styles.actorName}>{activity.actor_name}</Text>
                    <Text style={styles.activityTime}>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</Text>
                </View>
                <Text style={styles.activityDesc}>{activity.description}</Text>
                {activity.project_name && (
                    <View style={styles.projectBadge}>
                        <View style={[styles.projectDot, { backgroundColor: activity.project_color || '#64748B' }]} />
                        <Text style={styles.projectText}>{activity.project_name}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const ITEMS_PER_PAGE = 20;

export default function ActivityLogScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currentWorkspace } = useWorkspace();

    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    const fetchActivities = useCallback(async (refresh = false) => {
        if (!currentWorkspace?.id) return;

        try {
            if (refresh) {
                setIsRefreshing(true);
                setPage(0); // Reset page
            } else {
                setIsLoadingMore(true);
            }

            const currentPage = refresh ? 0 : page;
            const from = currentPage * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data: actLogs, error } = await supabase
                .from('activity_logs')
                .select('id, action_type, entity_type, description, actor_id, project_id, task_id, created_at')
                .eq('workspace_id', currentWorkspace.id)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            if (actLogs && actLogs.length > 0) {
                // Fetch profiles and projects for enrichment
                const actorIds = [...new Set(actLogs.map(a => a.actor_id).filter(Boolean))];
                const projectIds = [...new Set(actLogs.map(a => a.project_id).filter(Boolean))];

                const { data: actorProfs } = await supabase.from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', actorIds.length > 0 ? actorIds : ['__none__']);

                const { data: projects } = await supabase.from('projects')
                    .select('id, name, color')
                    .in('id', projectIds.length > 0 ? projectIds : ['__none__']);

                const actorMap = new Map(actorProfs?.map(p => [p.id, p]));
                const projectMap = new Map(projects?.map(p => [p.id, p]));

                const enrichedLogs = actLogs.map(log => {
                    const actor = actorMap.get(log.actor_id);
                    const proj = projectMap.get(log.project_id);
                    return {
                        id: log.id,
                        action_type: log.action_type,
                        entity_type: log.entity_type,
                        description: log.description,
                        actor_name: actor?.full_name || 'Someone',
                        actor_avatar: actor?.avatar_url,
                        project_name: proj?.name,
                        project_color: proj?.color || '#6366f1',
                        created_at: log.created_at,
                        task_id: log.task_id,
                        project_id: log.project_id,
                    };
                });

                if (refresh) {
                    setActivities(enrichedLogs);
                } else {
                    setActivities(prev => {
                        const newItems = enrichedLogs.filter(
                            item => !prev.some(existing => existing.id === item.id)
                        );
                        return [...prev, ...newItems];
                    });
                }

                if (actLogs.length < ITEMS_PER_PAGE) {
                    setHasMore(false);
                } else {
                    setPage(currentPage + 1);
                }
            } else {
                if (refresh) setActivities([]);
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    }, [currentWorkspace, page]);

    useEffect(() => {
        if (currentWorkspace?.id) {
            fetchActivities(true);
        }
    }, [currentWorkspace?.id]);

    const onRefresh = () => {
        setHasMore(true);
        fetchActivities(true);
    };

    const loadMore = () => {
        if (!isLoadingMore && hasMore) {
            fetchActivities(false);
        }
    };

    return (
        <View style={styles.container}>
            <DashboardHeader showBack />

            <FlatList
                data={activities}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ActivityRow activity={item} />}
                contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#F97316" />
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    isLoadingMore ? (
                        <View style={styles.loaderFooter}>
                            <ActivityIndicator size="small" color="#F97316" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={!isLoading ? (
                    <View style={styles.emptyState}>
                        <Zap size={48} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No activity recorded yet</Text>
                    </View>
                ) : null}
            />

            <GlobalTabBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        zIndex: 10,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        marginBottom: 8,
        borderRadius: 12,
        // Shadow for premium feel
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
            android: { elevation: 1 },
        }),
    },
    activityIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    activityInfo: {
        flex: 1,
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 2,
    },
    actorName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    activityTime: {
        fontSize: 11,
        color: '#94A3B8',
    },
    activityDesc: {
        fontSize: 13,
        fontWeight: '500',
        color: '#475569',
        lineHeight: 18,
        marginBottom: 6,
    },
    projectBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F8FAFC',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    projectDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    projectText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
    loaderFooter: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '500',
    },
});
