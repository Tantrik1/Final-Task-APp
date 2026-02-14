import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { isPast, isToday, isTomorrow, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { MyTasksHeader } from '@/components/my_tasks/MyTasksHeader';
import { SmartFilterBar, SortOption, ViewMode } from '@/components/my_tasks/SmartFilterBar';
import { TaskCard } from '@/components/my_tasks/TaskCard';
import { Target, Clock } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

// Types
interface TaskWithProject {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    project_id: string;
    assigned_to: string | null;
    created_by: string;
    custom_status_id: string | null;
    completed_at: string | null;
    is_completed?: boolean;
    project?: { id: string; name: string; color: string | null };
}

export default function TasksScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currentWorkspace } = useWorkspace();
    const { user } = useAuth();

    // State
    const [tasks, setTasks] = useState<TaskWithProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters & View State
    const [searchQuery, setSearchQuery] = useState('');
    const [currentSort, setCurrentSort] = useState<SortOption>('due_date');
    const [currentView, setCurrentView] = useState<ViewMode>('smart');
    const [activeFiltersCount, setActiveFiltersCount] = useState(0); // For now just a placeholder

    // Active Timer (Mock)
    const [activeTimer, setActiveTimer] = useState<{ taskId: string; title: string; duration: string } | null>(null);

    const fetchTasks = useCallback(async () => {
        if (!currentWorkspace?.id || !user) return;

        try {
            // 1. Get Projects
            const { data: projects } = await supabase
                .from('projects')
                .select('id, name, color')
                .eq('workspace_id', currentWorkspace.id)
                .eq('is_archived', false);

            if (!projects || projects.length === 0) {
                setTasks([]);
                setIsLoading(false);
                setRefreshing(false);
                return;
            }

            const projectIds = projects.map(p => p.id);
            const projectMap = new Map(projects.map(p => [p.id, p]));

            // 2. Get Completed Status IDs
            const { data: statusData } = await supabase
                .from('project_statuses')
                .select('id, is_completed')
                .in('project_id', projectIds);

            const completedStatusIds = new Set(
                (statusData || []).filter(s => s.is_completed).map(s => s.id)
            );

            // 3. Get Tasks
            // Logic: Assigned to me OR Created by me
            const { data: tasksData, error } = await supabase
                .from('tasks')
                .select('*')
                .in('project_id', projectIds)
                .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
                .order('due_date', { ascending: true, nullsFirst: false });

            if (error) throw error;

            // 4. Transform & Mark Completion
            const processedTasks = (tasksData || []).map(task => ({
                ...task,
                project: projectMap.get(task.project_id),
                is_completed: task.status === 'done' || (task.custom_status_id && completedStatusIds.has(task.custom_status_id))
            }));

            setTasks(processedTasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [currentWorkspace?.id, user]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    // Realtime subscription
    useEffect(() => {
        if (!currentWorkspace?.id) return;
        const channel = supabase
            .channel('my-tasks-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentWorkspace?.id, fetchTasks]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTasks();
    };

    // ─── Stats Logic ─────────────────────────────────────────────
    const stats = useMemo(() => {
        const now = new Date();
        const startOfLastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        return {
            total: tasks.length,
            overdue: tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && !t.is_completed).length,
            today: tasks.filter(t => t.due_date && isToday(new Date(t.due_date)) && !t.is_completed).length,
            active: tasks.filter(t => !t.is_completed).length,
            completed: tasks.filter(t => t.is_completed && t.completed_at && new Date(t.completed_at) > startOfLastWeek).length, // Recently completed
        };
    }, [tasks]);

    // ─── Filtering & Sorting Logic ───────────────────────────────
    const filteredTasks = useMemo(() => {
        let result = tasks;

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t => t.title.toLowerCase().includes(q) || t.project?.name.toLowerCase().includes(q));
        }

        // Sort
        result.sort((a, b) => {
            if (currentSort === 'due_date') {
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            } else if (currentSort === 'priority') {
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, undefined: 4 };
                return (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 4);
            } else {
                // Recently Updated (mock using created_at for now as updated_at might strictly be db level)
                return new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime();
            }
        });

        return result;
    }, [tasks, searchQuery, currentSort]);

    // ─── Grouping Logic (Smart View) ─────────────────────────────
    const groupedTasks = useMemo(() => {
        if (currentView === 'project') {
            const groups: Record<string, TaskWithProject[]> = {};
            filteredTasks.forEach(t => {
                const key = t.project?.name || 'No Project';
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
            });
            return Object.entries(groups).map(([title, tasks]) => ({ title, tasks, color: tasks[0]?.project?.color }));
        }

        if (currentView === 'status') {
            const groups: Record<string, TaskWithProject[]> = {};
            filteredTasks.forEach(t => {
                const key = t.is_completed ? 'Completed' : 'Active';
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
            });
            return Object.entries(groups).map(([title, tasks]) => ({ title, tasks, color: title === 'Completed' ? '#10B981' : '#3B82F6' }));
        }

        // Default: Smart View
        const overdue: TaskWithProject[] = [];
        const today: TaskWithProject[] = [];
        const active: TaskWithProject[] = [];
        const completed: TaskWithProject[] = [];

        filteredTasks.forEach(t => {
            if (t.is_completed) {
                completed.push(t);
                return;
            }
            if (t.due_date) {
                const d = new Date(t.due_date);
                if (isPast(d) && !isToday(d)) {
                    overdue.push(t);
                    return;
                }
                if (isToday(d)) {
                    today.push(t);
                    return;
                }
            }
            active.push(t);
        });

        return [
            { title: 'Overdue', tasks: overdue, color: '#EF4444' },
            { title: 'Due Today', tasks: today, color: '#F59E0B' },
            { title: 'Active', tasks: active, color: '#3B82F6' },
            { title: 'Recently Completed', tasks: completed, color: '#10B981' },
        ];
    }, [filteredTasks, currentView]);

    const handleComplete = async (task: TaskWithProject) => {
        // Optimistic update
        const newStatus = task.is_completed ? 'todo' : 'done'; // Toggle for now, ideally strictly 'done'
        try {
            await supabase.from('tasks').update({
                status: newStatus,
                completed_at: newStatus === 'done' ? new Date().toISOString() : null
            }).eq('id', task.id);
            fetchTasks(); // Refresh to ensure sync
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to update task');
        }
    };

    return (
        <View style={styles.container}>
            {/* Sticky Timer (Optional) */}
            {activeTimer && (
                <View style={styles.timerBar}>
                    <View style={styles.timerContent}>
                        <Clock size={14} color="#FFF" />
                        <Text style={styles.timerText} numberOfLines={1}>Tracking: {activeTimer.title}</Text>
                        <Text style={styles.timerTime}>{activeTimer.duration}</Text>
                    </View>
                    <View style={styles.timerAction}>
                        <View style={styles.stopBtn} />
                    </View>
                </View>
            )}

            {/* Header with Stats */}
            <MyTasksHeader stats={{
                overdue: stats.overdue,
                today: stats.today,
                active: stats.active,
                completed: stats.completed
            }} />

            {/* Smart Filters */}
            <SmartFilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                currentSort={currentSort}
                onSortChange={setCurrentSort}
                currentView={currentView}
                onViewChange={setCurrentView}
                activeFiltersCount={activeFiltersCount}
                onOpenFilters={() => Alert.alert('Filters', 'Advanced filters coming soon!')}
            />

            {/* Task List */}
            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#F97316" />
                </View>
            ) : tasks.length === 0 ? (
                <View style={styles.emptyState}>
                    <Target size={48} color="#CBD5E1" />
                    <Text style={styles.emptyText}>No tasks found</Text>
                    <Text style={styles.emptySub}>Get started by creating a task in a project.</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
                    showsVerticalScrollIndicator={false}
                >
                    {groupedTasks.map((group) => (
                        group.tasks.length > 0 && (
                            <View key={group.title} style={styles.group}>
                                <View style={styles.groupHeader}>
                                    <View style={[styles.groupDot, { backgroundColor: group.color || '#94A3B8' }]} />
                                    <Text style={styles.groupTitle}>{group.title}</Text>
                                    <View style={styles.groupCount}>
                                        <Text style={styles.groupCountText}>{group.tasks.length}</Text>
                                    </View>
                                </View>
                                {group.tasks.map((task, index) => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        index={index}
                                        onPress={() => router.push(`/task/${task.id}` as any)}
                                        onComplete={() => handleComplete(task)}
                                        onChangeStatus={() => Alert.alert('Change Status', 'Select new status...')}
                                    />
                                ))}
                            </View>
                        )
                    ))}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 20,
    },
    group: {
        marginBottom: 24,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    groupDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    groupTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    groupCount: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    groupCountText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginTop: 16,
    },
    emptySub: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 8,
    },
    timerBar: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: '#0F172A',
        borderRadius: 100,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
    },
    timerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timerText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    timerTime: {
        color: '#F97316',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontWeight: '700',
    },
    timerAction: {
        marginLeft: 12,
    },
    stopBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#FFF',
    },
});
