import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
    ScrollView,
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
    ArrowLeft,
    Search,
    X,
    SlidersHorizontal
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTheme } from '@/contexts/ThemeContext';
import { ActivitySkeleton } from '@/components/ui/Skeleton';
import { ActivityItem } from '@/hooks/useDashboardData';
import Animated, { FadeInDown } from 'react-native-reanimated';

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

const FILTER_TYPES = [
    { id: 'all', label: 'All', icon: CircleDot },
    { id: 'create', label: 'Created', icon: Sparkles },
    { id: 'update', label: 'Updated', icon: Zap },
    { id: 'comment', label: 'Comments', icon: MessageCircle },
    { id: 'assign', label: 'Assigned', icon: Users },
    { id: 'timer_start', label: 'Timer', icon: Timer },
    { id: 'upload', label: 'Uploads', icon: FolderKanban },
];

const ActivityRow = ({ activity, colors }: { activity: ActivityItem; colors: any }) => {
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
        <TouchableOpacity style={[styles.activityRow, { backgroundColor: colors.card, borderBottomColor: colors.border, shadowColor: colors.shadow }]} onPress={handlePress} activeOpacity={0.7}>
            <View style={[styles.activityIconWrap, { backgroundColor: bg }]}>
                <Icon size={16} color={color} />
            </View>
            <View style={styles.activityInfo}>
                <View style={styles.activityHeader}>
                    <Text style={[styles.actorName, { color: colors.text }]}>{activity.actor_name}</Text>
                    <Text style={[styles.activityTime, { color: colors.textTertiary }]}>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</Text>
                </View>
                <Text style={[styles.activityDesc, { color: colors.textSecondary }]}>{activity.description}</Text>
                {activity.project_name && (
                    <View style={[styles.projectBadge, { backgroundColor: colors.surface }]}>
                        <View style={[styles.projectDot, { backgroundColor: activity.project_color || '#64748B' }]} />
                        <Text style={[styles.projectText, { color: colors.textSecondary }]}>{activity.project_name}</Text>
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
    const { colors } = useTheme();

    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

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

    const filteredActivities = useMemo(() => {
        let result = activities;
        if (activeFilter !== 'all') {
            if (activeFilter === 'timer_start') {
                result = result.filter(a => a.action_type === 'timer_start' || a.action_type === 'timer_pause');
            } else {
                result = result.filter(a => a.action_type === activeFilter);
            }
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(a =>
                a.description?.toLowerCase().includes(q) ||
                a.actor_name?.toLowerCase().includes(q) ||
                a.project_name?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [activities, activeFilter, searchQuery]);

    const activeCount = activeFilter !== 'all' || searchQuery.trim()
        ? filteredActivities.length
        : activities.length;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <DashboardHeader showBack />

            {/* ─── Advanced Filter Bar ─── */}
            <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                {/* Search Row */}
                <View style={[styles.searchRow]}>
                    <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Search size={16} color={colors.textTertiary} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Search activity..."
                            placeholderTextColor={colors.textTertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={16} color={colors.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.countText, { color: colors.primary }]}>{activeCount}</Text>
                    </View>
                </View>

                {/* Type Filter Chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                >
                    {FILTER_TYPES.map((filter) => {
                        const isActive = activeFilter === filter.id;
                        const { color: iconColor } = filter.id === 'all'
                            ? { color: isActive ? '#FFF' : colors.textSecondary }
                            : getActivityIcon(filter.id);
                        return (
                            <TouchableOpacity
                                key={filter.id}
                                style={[
                                    styles.chip,
                                    { backgroundColor: colors.surface, borderColor: colors.border },
                                    isActive && { backgroundColor: colors.primary, borderColor: colors.primary }
                                ]}
                                onPress={() => setActiveFilter(filter.id)}
                            >
                                <filter.icon size={13} color={isActive ? '#FFF' : iconColor} />
                                <Text style={[
                                    styles.chipText,
                                    { color: colors.textSecondary },
                                    isActive && { color: '#FFF' }
                                ]}>{filter.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ─── Activity List ─── */}
            {isLoading ? (
                <ActivitySkeleton />
            ) : (
                <FlatList
                    data={filteredActivities}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item, index }) => (
                        <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
                            <ActivityRow activity={item} colors={colors} />
                        </Animated.View>
                    )}
                    contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        isLoadingMore ? (
                            <View style={styles.loaderFooter}>
                                <ActivityIndicator size="small" color={colors.primary} />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surface }]}>
                                <Zap size={32} color={colors.textTertiary} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                                {activeFilter !== 'all' || searchQuery ? 'No matching activity' : 'No activity recorded yet'}
                            </Text>
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                {activeFilter !== 'all' || searchQuery ? 'Try adjusting your filters' : 'Activity will appear here as your team works'}
                            </Text>
                            {(activeFilter !== 'all' || searchQuery.trim()) && (
                                <TouchableOpacity
                                    style={[styles.clearBtn, { borderColor: colors.border }]}
                                    onPress={() => { setActiveFilter('all'); setSearchQuery(''); }}
                                >
                                    <X size={14} color={colors.primary} />
                                    <Text style={[styles.clearBtnText, { color: colors.primary }]}>Clear Filters</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            <GlobalTabBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ─── Filter Bar ───
    filterBar: {
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        gap: 10,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 10,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 8,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        height: '100%',
    },
    countBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        minWidth: 36,
        alignItems: 'center',
    },
    countText: {
        fontSize: 13,
        fontWeight: '800',
    },
    chipRow: {
        paddingHorizontal: 16,
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // ─── List ───
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderRadius: 14,
        borderBottomWidth: 0,
        ...Platform.select({
            ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
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
    },
    activityTime: {
        fontSize: 11,
    },
    activityDesc: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
        marginBottom: 6,
    },
    projectBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
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
    },
    loaderFooter: {
        paddingVertical: 20,
        alignItems: 'center',
    },

    // ─── Empty State ───
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 8,
    },
    emptyIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    emptyText: {
        fontSize: 13,
        fontWeight: '500',
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    clearBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
