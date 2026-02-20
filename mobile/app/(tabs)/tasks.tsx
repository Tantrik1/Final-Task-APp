import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, RefreshControl,
    Alert, TouchableOpacity, TextInput, Platform,
} from 'react-native';
import {
    ChevronDown, ChevronRight, Search, X,
    Target, Flag, Calendar, CheckCircle2, Circle, Clock,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { isPast, isToday, format, parseISO } from 'date-fns';
import { MyTasksHeader } from '@/components/my_tasks/MyTasksHeader';
import { TasksSkeleton } from '@/components/ui/Skeleton';
import { OptimizedTimerBanner } from '@/components/OptimizedTimerBanner';
import { useTimerActions } from '@/stores/useTaskStore';

// ─── Types ───────────────────────────────────────────────────────
interface ProjectInfo { id: string; name: string; color: string | null }
interface StatusInfo { id: string; name: string; color: string; is_completed: boolean; is_default: boolean; category: string; project_id: string }
interface TaskItem {
    id: string; title: string; status: string; priority: string;
    due_date: string | null; project_id: string; assigned_to: string | null;
    created_by: string; custom_status_id: string | null; completed_at: string | null;
    is_completed: boolean; status_name: string; status_color: string;
    status_category: string; project: ProjectInfo;
}
interface CategoryGroup {
    category: string; label: string; color: string;
    tasks: TaskItem[]; order: number;
}

// ─── Constants ───────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; color: string; order: number }> = {
    todo:      { label: 'Todo',        color: '#3B82F6', order: 0 },
    active:    { label: 'In Progress', color: '#F97316', order: 1 },
    done:      { label: 'Done',        color: '#22C55E', order: 2 },
    cancelled: { label: 'Cancelled',   color: '#EF4444', order: 3 },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    urgent: { color: '#EF4444', bg: '#FEF2F2', label: 'Urgent' },
    high:   { color: '#F97316', bg: '#FFF7ED', label: 'High' },
    medium: { color: '#EAB308', bg: '#FEFCE8', label: 'Medium' },
    low:    { color: '#94A3B8', bg: '#F8FAFC', label: 'Low' },
};

const MAX_VISIBLE = 7;

// ─── Component ───────────────────────────────────────────────────
export default function TasksScreen() {
    const router = useRouter();
    const { currentWorkspace } = useWorkspace();
    const { user } = useAuth();
    const { colors, colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';
    const { syncWithRealtime } = useTimerActions();

    // Data
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [projects, setProjects] = useState<ProjectInfo[]>([]);
    const [allStatuses, setAllStatuses] = useState<StatusInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Accordion state
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleCollapse = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const toggleExpand = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    // ─── Fetch ───────────────────────────────────────────────────
    const fetchTasks = useCallback(async () => {
        if (!currentWorkspace?.id || !user) return;
        try {
            // 1. Projects
            const { data: projData } = await supabase
                .from('projects').select('id, name, color')
                .eq('workspace_id', currentWorkspace.id).eq('is_archived', false);

            if (!projData?.length) {
                setTasks([]); setProjects([]); setAllStatuses([]);
                return;
            }
            setProjects(projData);
            const projectIds = projData.map(p => p.id);
            const projectMap = new Map(projData.map(p => [p.id, p]));

            // 2. All statuses for these projects
            const { data: statusData } = await supabase
                .from('project_statuses')
                .select('id, name, color, is_completed, is_default, category, project_id')
                .in('project_id', projectIds);

            const statuses = statusData || [];
            setAllStatuses(statuses);
            const statusMap = new Map(statuses.map(s => [s.id, s]));

            // 3. Tasks assigned to or created by me
            const { data: tasksData, error } = await supabase
                .from('tasks').select('*')
                .in('project_id', projectIds)
                .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
                .order('due_date', { ascending: true, nullsFirst: false });

            if (error) throw error;

            // 4. Enrich tasks
            const processed: TaskItem[] = (tasksData || []).map(t => {
                const cs = t.custom_status_id ? statusMap.get(t.custom_status_id) : null;
                const proj = projectMap.get(t.project_id) || { id: t.project_id, name: 'Unknown', color: null };

                // Derive category: custom status category → legacy enum mapping
                let category = 'active';
                if (cs) {
                    category = cs.category || (cs.is_completed ? 'done' : 'active');
                } else {
                    // Legacy fallback
                    if (t.status === 'todo') category = 'todo';
                    else if (t.status === 'done') category = 'done';
                    else if (t.status === 'in_progress' || t.status === 'review') category = 'active';
                }

                return {
                    ...t,
                    is_completed: cs ? (cs.is_completed || cs.category === 'done' || cs.category === 'cancelled') : t.status === 'done',
                    status_name: cs?.name || t.status,
                    status_color: cs?.color || CATEGORY_META[category]?.color || '#94A3B8',
                    status_category: category,
                    project: proj,
                };
            });

            setTasks(processed);
        } catch (err) {
            console.error('Error fetching tasks:', err);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [currentWorkspace?.id, user]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    // Realtime
    useEffect(() => {
        if (!currentWorkspace?.id || !projects.length) return;
        const ids = projects.map(p => p.id).join(',');
        const ch = supabase
            .channel('my-tasks-rt')
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'tasks',
                filter: `project_id=in.(${ids})`,
            }, () => fetchTasks())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [currentWorkspace?.id, projects]);

    // Timer-specific realtime for instant sync
    useEffect(() => {
        if (!user) return;
        const ch = supabase
            .channel('timer-sync-tasks')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tasks',
                filter: `assigned_to=eq.${user.id}`,
            }, (payload) => syncWithRealtime(payload, user))
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tasks',
                filter: `created_by=eq.${user.id}`,
            }, (payload) => syncWithRealtime(payload, user))
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [user]);

    const onRefresh = () => { setRefreshing(true); fetchTasks(); };

    // ─── Stats ───────────────────────────────────────────────────
    const stats = useMemo(() => {
        const week = new Date(Date.now() - 7 * 86400000);
        return {
            overdue: tasks.filter(t => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)) && !t.is_completed).length,
            today: tasks.filter(t => t.due_date && isToday(parseISO(t.due_date)) && !t.is_completed).length,
            active: tasks.filter(t => !t.is_completed).length,
            completed: tasks.filter(t => t.is_completed && t.completed_at && new Date(t.completed_at) > week).length,
        };
    }, [tasks]);

    // ─── Filtered tasks ──────────────────────────────────────────
    const filteredTasks = useMemo(() => {
        let result = tasks;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(q) ||
                t.project.name.toLowerCase().includes(q) ||
                t.status_name.toLowerCase().includes(q)
            );
        }
        return result;
    }, [tasks, searchQuery]);

    // ─── Group by status category ────────────────────────────────
    const categoryGroups = useMemo((): CategoryGroup[] => {
        const buckets: Record<string, TaskItem[]> = { todo: [], active: [], done: [], cancelled: [] };

        filteredTasks.forEach(t => {
            const cat = t.status_category;
            if (buckets[cat]) buckets[cat].push(t);
            else buckets.active.push(t); // fallback
        });

        return Object.entries(buckets)
            .map(([cat, tasks]) => {
                const meta = CATEGORY_META[cat] || CATEGORY_META.active;
                return { category: cat, label: meta.label, color: meta.color, tasks, order: meta.order };
            })
            .sort((a, b) => a.order - b.order);
    }, [filteredTasks]);

    // ─── Toggle complete ─────────────────────────────────────────
    const handleComplete = async (task: TaskItem) => {
        const markingDone = !task.is_completed;

        // Optimistic
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_completed: markingDone } : t));

        try {
            const projectStatuses = allStatuses.filter(s => s.project_id === task.project_id);
            let targetId: string | undefined;
            if (markingDone) {
                targetId = projectStatuses.find(s => s.category === 'done' || s.is_completed)?.id;
            } else {
                targetId = (projectStatuses.find(s => s.category === 'todo' || s.is_default) || projectStatuses[0])?.id;
            }
            if (targetId) {
                await supabase.from('tasks').update({ custom_status_id: targetId }).eq('id', task.id);
            }
            fetchTasks();
        } catch (e) {
            // Revert
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_completed: task.is_completed } : t));
            Alert.alert('Error', 'Failed to update task');
        }
    };

    // ─── Inline Task Row ─────────────────────────────────────────
    const renderTask = (task: TaskItem) => {
        const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.low;
        const dueDate = task.due_date ? parseISO(task.due_date) : null;
        const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && !task.is_completed;
        const isDueToday = dueDate && isToday(dueDate) && !task.is_completed;
        const projColor = task.project.color || '#6366F1';

        return (
            <TouchableOpacity
                key={task.id}
                style={[s.taskCard, { backgroundColor: colors.card, borderColor: colors.border },
                    task.is_completed && { opacity: 0.5 }]}
                onPress={() => router.push(`/task/${task.id}` as any)}
                activeOpacity={0.6}
            >
                {/* Priority accent bar */}
                <View style={[s.accentBar, { backgroundColor: task.is_completed ? colors.border : pri.color }]} />

                <View style={s.cardBody}>
                    {/* Row 1: Checkbox + Title + Priority badge */}
                    <View style={s.cardTopRow}>
                        <TouchableOpacity
                            onPress={() => handleComplete(task)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            {task.is_completed
                                ? <CheckCircle2 size={20} color="#22C55E" />
                                : <Circle size={20} color={colors.border} />}
                        </TouchableOpacity>

                        <Text style={[s.cardTitle, { color: colors.text },
                            task.is_completed && { textDecorationLine: 'line-through', color: colors.textMuted }]}
                            numberOfLines={2}
                        >
                            {task.title}
                        </Text>

                        {task.priority && task.priority !== 'low' && (
                            <View style={[s.priBadge, { backgroundColor: isDark ? pri.color + '25' : pri.bg }]}>
                                <Flag size={10} color={pri.color} />
                                <Text style={[s.priBadgeText, { color: pri.color }]}>{pri.label}</Text>
                            </View>
                        )}
                    </View>

                    {/* Row 2: Status · Project · Due date */}
                    <View style={s.cardBottomRow}>
                        {/* Custom status */}
                        <View style={[s.tag, { backgroundColor: task.status_color + '15' }]}>
                            <View style={[s.tagDot, { backgroundColor: task.status_color }]} />
                            <Text style={[s.tagLabel, { color: task.status_color }]} numberOfLines={1}>
                                {task.status_name}
                            </Text>
                        </View>

                        {/* Project */}
                        <View style={[s.tag, { backgroundColor: isDark ? colors.surface : projColor + '10' }]}>
                            <View style={[s.tagDot, { backgroundColor: projColor }]} />
                            <Text style={[s.tagLabel, { color: isDark ? colors.textSecondary : projColor }]} numberOfLines={1}>
                                {task.project.name}
                            </Text>
                        </View>

                        {/* Due date */}
                        {dueDate && (
                            <View style={[s.tag, {
                                backgroundColor: isOverdue ? '#FEF2F2' : isDueToday ? '#FFFBEB' : isDark ? colors.surface : '#F8FAFC',
                            }]}>
                                <Calendar size={10}
                                    color={isOverdue ? '#EF4444' : isDueToday ? '#F59E0B' : colors.textTertiary} />
                                <Text style={[s.tagLabel, {
                                    color: isOverdue ? '#EF4444' : isDueToday ? '#F59E0B' : colors.textTertiary,
                                }]}>
                                    {isOverdue ? 'Overdue' : isDueToday ? 'Today' : format(dueDate, 'MMM d')}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // ─── Render ──────────────────────────────────────────────────
    return (
        <View style={[s.container, { backgroundColor: colors.background }]}>
            <MyTasksHeader stats={stats} />
            <OptimizedTimerBanner />

            {/* Search bar */}
            <View style={s.searchRow}>
                <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: searchQuery ? colors.primary : colors.border }]}>
                    <Search size={16} color={searchQuery ? colors.primary : colors.textTertiary} />
                    <TextInput
                        style={[s.searchInput, { color: colors.text }]}
                        placeholder="Search tasks, projects, statuses..."
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <View style={[s.clearBtn, { backgroundColor: colors.surface }]}>
                                <X size={12} color={colors.textSecondary} />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            {isLoading ? (
                <TasksSkeleton />
            ) : filteredTasks.length === 0 ? (
                <View style={s.emptyState}>
                    <Target size={48} color={colors.textTertiary} />
                    <Text style={[s.emptyTitle, { color: colors.text }]}>
                        {tasks.length === 0 ? 'No tasks found' : 'No matching tasks'}
                    </Text>
                    <Text style={[s.emptySub, { color: colors.textTertiary }]}>
                        {tasks.length === 0 ? 'Create a task in a project to get started.' : 'Try a different search query.'}
                    </Text>
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={[s.clearFilterBtn, { backgroundColor: colors.primary }]}>
                            <Text style={s.clearFilterText}>Clear Search</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={s.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    showsVerticalScrollIndicator={false}
                >
                    {categoryGroups.map(group => {
                        if (group.tasks.length === 0) return null;
                        const key = group.category;
                        const isCollapsed = collapsedGroups.has(key);
                        const isExpanded = expandedGroups.has(key);
                        const total = group.tasks.length;
                        const visible = isCollapsed ? [] : (isExpanded ? group.tasks : group.tasks.slice(0, MAX_VISIBLE));
                        const hiddenCount = Math.max(0, total - MAX_VISIBLE);

                        return (
                            <View key={key} style={s.group}>
                                {/* Accordion header */}
                                <TouchableOpacity
                                    style={[s.groupHeader, { backgroundColor: isDark ? group.color + '12' : group.color + '08', borderColor: group.color + '30' }]}
                                    onPress={() => toggleCollapse(key)}
                                    activeOpacity={0.7}
                                >
                                    <View style={s.groupHeaderLeft}>
                                        <View style={[s.groupDot, { backgroundColor: group.color }]} />
                                        <Text style={[s.groupLabel, { color: isDark ? '#FFF' : '#1E293B' }]}>
                                            {group.label}
                                        </Text>
                                        <View style={[s.groupBadge, { backgroundColor: group.color + '20' }]}>
                                            <Text style={[s.groupBadgeText, { color: group.color }]}>{total}</Text>
                                        </View>
                                    </View>
                                    {isCollapsed
                                        ? <ChevronRight size={16} color={colors.textTertiary} />
                                        : <ChevronDown size={16} color={colors.textTertiary} />}
                                </TouchableOpacity>

                                {/* Task rows */}
                                {!isCollapsed && (
                                    <View style={s.groupTasks}>
                                        {visible.map(renderTask)}

                                        {/* Load more / less */}
                                        {hiddenCount > 0 && (
                                            <TouchableOpacity
                                                style={[s.loadMoreBtn, { borderColor: group.color + '30' }]}
                                                onPress={() => toggleExpand(key)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[s.loadMoreText, { color: group.color }]}>
                                                    {isExpanded ? 'Show less' : `Show ${hiddenCount} more`}
                                                </Text>
                                                {!isExpanded && <ChevronDown size={12} color={group.color} />}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1 },

    // Search
    searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        height: 42, borderRadius: 12, paddingHorizontal: 12, gap: 8, borderWidth: 1.5,
    },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '500', height: '100%' },
    clearBtn: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

    // List
    listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },

    // Category accordion
    group: { marginBottom: 16 },
    groupHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1,
    },
    groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    groupDot: { width: 10, height: 10, borderRadius: 5 },
    groupLabel: { fontSize: 15, fontWeight: '700' },
    groupBadge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8 },
    groupBadgeText: { fontSize: 12, fontWeight: '700' },

    // Tasks inside accordion
    groupTasks: { gap: 6, marginTop: 8 },

    // Task card
    taskCard: {
        flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
            android: { elevation: 2 },
        }),
    },
    accentBar: { width: 4 },
    cardBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
    cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
    priBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    priBadgeText: { fontSize: 10, fontWeight: '700' },
    cardBottomRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingLeft: 30 },

    // Tags
    tag: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: 140,
    },
    tagDot: { width: 6, height: 6, borderRadius: 3 },
    tagLabel: { fontSize: 11, fontWeight: '600' },

    // Load more
    loadMoreBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginTop: 2,
    },
    loadMoreText: { fontSize: 12, fontWeight: '600' },

    // Empty state
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
    emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8 },
    clearFilterBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 16 },
    clearFilterText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
