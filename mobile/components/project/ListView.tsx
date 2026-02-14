import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    CheckSquare,
    Flag,
    Search,
    ChevronDown,
    ChevronRight,
    Clock,
    SlidersHorizontal,
} from 'lucide-react-native';
import { format, isPast, isToday } from 'date-fns';
import Animated, { FadeInDown, FadeIn, Layout } from 'react-native-reanimated';

interface Task {
    id: string;
    title: string;
    status: string;
    custom_status_id?: string | null;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string | null;
    description?: string | null;
    assigned_to?: string | null;
    assignee?: { full_name: string; avatar_url: string } | null;
}

interface Status {
    id: string;
    name: string;
    color: string;
    position: number;
    is_default: boolean;
    is_completed: boolean;
}

interface ListViewProps {
    tasks: Task[];
    statuses: Status[];
    onToggleComplete: (task: Task) => Promise<void> | void;
    projectId: string;
}

type SortOption = 'status' | 'priority' | 'due_date' | 'title';

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    urgent: { color: '#EF4444', bg: '#FEF2F2', label: 'Urgent' },
    high: { color: '#F97316', bg: '#FFF7ED', label: 'High' },
    medium: { color: '#EAB308', bg: '#FEFCE8', label: 'Medium' },
    low: { color: '#94A3B8', bg: '#F8FAFC', label: 'Low' },
};

export default function ListView({ tasks, statuses, onToggleComplete, projectId }: ListViewProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('status');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [showSortMenu, setShowSortMenu] = useState(false);

    const toggleGroup = (group: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    };

    const filteredTasks = useMemo(() => {
        if (!searchQuery.trim()) return tasks;
        const q = searchQuery.toLowerCase();
        return tasks.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.assignee?.full_name?.toLowerCase().includes(q)
        );
    }, [tasks, searchQuery]);

    const groupedTasks = useMemo(() => {
        const groups: { key: string; label: string; color: string; tasks: Task[]; isCompleted: boolean }[] = [];

        if (sortBy === 'status') {
            for (const status of statuses) {
                const defaultStatusId = statuses.find(s => s.is_default)?.id || statuses[0]?.id;
                const statusTasks = filteredTasks
                    .filter(t => {
                        if (t.custom_status_id === status.id) return true;
                        if (status.id === defaultStatusId && !t.custom_status_id) return true;
                        return false;
                    })
                    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
                groups.push({
                    key: status.name,
                    label: status.name,
                    color: status.color,
                    tasks: statusTasks,
                    isCompleted: status.is_completed,
                });
            }
        } else if (sortBy === 'priority') {
            const priorities = ['urgent', 'high', 'medium', 'low'];
            for (const p of priorities) {
                const pTasks = filteredTasks.filter(t => t.priority === p);
                const config = PRIORITY_CONFIG[p];
                groups.push({
                    key: p,
                    label: config.label,
                    color: config.color,
                    tasks: pTasks,
                    isCompleted: false,
                });
            }
        } else if (sortBy === 'due_date') {
            const overdue: Task[] = [];
            const today: Task[] = [];
            const upcoming: Task[] = [];
            const noDue: Task[] = [];

            for (const t of filteredTasks) {
                if (!t.due_date) noDue.push(t);
                else if (isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))) overdue.push(t);
                else if (isToday(new Date(t.due_date))) today.push(t);
                else upcoming.push(t);
            }

            if (overdue.length) groups.push({ key: 'overdue', label: 'Overdue', color: '#EF4444', tasks: overdue, isCompleted: false });
            if (today.length) groups.push({ key: 'today', label: 'Due Today', color: '#F97316', tasks: today, isCompleted: false });
            if (upcoming.length) groups.push({ key: 'upcoming', label: 'Upcoming', color: '#3B82F6', tasks: upcoming, isCompleted: false });
            if (noDue.length) groups.push({ key: 'no-date', label: 'No Due Date', color: '#94A3B8', tasks: noDue, isCompleted: false });
        } else {
            const sorted = [...filteredTasks].sort((a, b) => a.title.localeCompare(b.title));
            groups.push({ key: 'all', label: 'All Tasks', color: '#3B82F6', tasks: sorted, isCompleted: false });
        }

        return groups;
    }, [filteredTasks, statuses, sortBy]);

    const renderTaskRow = (task: Task, index: number) => {
        const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
        const status = task.custom_status_id
            ? statuses.find(s => s.id === task.custom_status_id)
            : null;
        const isCompleted = status?.is_completed || false;
        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
        const isDueToday = task.due_date && isToday(new Date(task.due_date));

        return (
            <Animated.View
                key={task.id}
                entering={FadeInDown.delay(index * 30).duration(250)}
                layout={Layout.springify()}
            >
                <TouchableOpacity
                    style={[styles.taskRow, isCompleted && styles.taskRowCompleted]}
                    onPress={() => router.push(`/task/${task.id}` as any)}
                    activeOpacity={0.6}
                >


                    {/* Content */}
                    <View style={styles.taskContent}>
                        <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]} numberOfLines={1}>
                            {task.title}
                        </Text>
                        <View style={styles.taskMeta}>
                            {/* Status chip */}
                            {status && (
                                <View style={[styles.statusChip, { backgroundColor: status.color + '15' }]}>
                                    <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                                    <Text style={[styles.statusChipText, { color: status.color }]}>{status.name}</Text>
                                </View>
                            )}
                            {/* Priority */}
                            <View style={[styles.priorityChip, { backgroundColor: priority.bg }]}>
                                <Flag size={8} color={priority.color} />
                            </View>
                            {/* Due date */}
                            {task.due_date && (
                                <View style={[styles.dateChip, {
                                    backgroundColor: isOverdue ? '#FEF2F2' : isDueToday ? '#FFF7ED' : '#F8FAFC'
                                }]}>
                                    <Clock size={8} color={isOverdue ? '#EF4444' : isDueToday ? '#F97316' : '#94A3B8'} />
                                    <Text style={[styles.dateChipText, {
                                        color: isOverdue ? '#EF4444' : isDueToday ? '#F97316' : '#94A3B8'
                                    }]}>
                                        {format(new Date(task.due_date), 'MMM d')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Assignee */}
                    {task.assignee && (
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {task.assignee.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const SORT_OPTIONS: { key: SortOption; label: string }[] = [
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Priority' },
        { key: 'due_date', label: 'Due Date' },
        { key: 'title', label: 'Alphabetical' },
    ];

    return (
        <View style={styles.container}>
            {/* Search + Sort bar */}
            <View style={styles.toolbar}>
                <View style={styles.searchBar}>
                    <Search size={16} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search tasks..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <TouchableOpacity
                    style={[styles.sortBtn, showSortMenu && styles.sortBtnActive]}
                    onPress={() => setShowSortMenu(!showSortMenu)}
                >
                    <SlidersHorizontal size={16} color={showSortMenu ? '#FFF' : '#64748B'} />
                </TouchableOpacity>
            </View>

            {/* Sort options */}
            {showSortMenu && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.sortMenu}>
                    <Text style={styles.sortMenuLabel}>Group by</Text>
                    <View style={styles.sortOptions}>
                        {SORT_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.key}
                                style={[styles.sortOption, sortBy === opt.key && styles.sortOptionActive]}
                                onPress={() => { setSortBy(opt.key); setShowSortMenu(false); }}
                            >
                                <Text style={[styles.sortOptionText, sortBy === opt.key && styles.sortOptionTextActive]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>
            )}

            {/* Task groups */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {groupedTasks.map(group => {
                    if (group.tasks.length === 0 && sortBy !== 'status') return null;
                    const isCollapsed = collapsedGroups.has(group.key);

                    return (
                        <View key={group.key} style={styles.group}>
                            {/* Group header */}
                            <TouchableOpacity
                                style={styles.groupHeader}
                                onPress={() => toggleGroup(group.key)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.groupHeaderLeft}>
                                    <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                                    <Text style={styles.groupTitle}>{group.label}</Text>
                                    <View style={[styles.groupCount, { backgroundColor: group.color + '15' }]}>
                                        <Text style={[styles.groupCountText, { color: group.color }]}>
                                            {group.tasks.length}
                                        </Text>
                                    </View>
                                </View>
                                {isCollapsed ? (
                                    <ChevronRight size={16} color="#94A3B8" />
                                ) : (
                                    <ChevronDown size={16} color="#94A3B8" />
                                )}
                            </TouchableOpacity>

                            {/* Group tasks */}
                            {!isCollapsed && (
                                <View style={styles.groupTasks}>
                                    {group.tasks.length === 0 ? (
                                        <View style={styles.emptyGroup}>
                                            <Text style={styles.emptyGroupText}>No tasks</Text>
                                        </View>
                                    ) : (
                                        group.tasks.map((task, idx) => renderTaskRow(task, idx))
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })}

                {filteredTasks.length === 0 && searchQuery.trim() && (
                    <View style={styles.noResults}>
                        <Search size={32} color="#CBD5E1" />
                        <Text style={styles.noResultsText}>No tasks match "{searchQuery}"</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    toolbar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 8,
        height: 40,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1E293B',
        padding: 0,
    },
    sortBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sortBtnActive: {
        backgroundColor: '#F97316',
    },
    sortMenu: {
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
            android: { elevation: 4 },
        }),
    },
    sortMenuLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    sortOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    sortOption: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    sortOptionActive: {
        backgroundColor: '#F97316',
        borderColor: '#F97316',
    },
    sortOptionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    sortOptionTextActive: {
        color: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 120,
    },
    group: {
        marginBottom: 16,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    groupHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
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
        color: '#334155',
    },
    groupCount: {
        paddingHorizontal: 7,
        paddingVertical: 1,
        borderRadius: 8,
    },
    groupCountText: {
        fontSize: 11,
        fontWeight: '700',
    },
    groupTasks: {
        gap: 6,
        marginTop: 6,
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
            android: { elevation: 1 },
        }),
    },
    taskRowCompleted: {
        opacity: 0.55,
    },

    taskContent: {
        flex: 1,
        gap: 4,
    },
    taskTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    taskTitleDone: {
        textDecorationLine: 'line-through',
        color: '#94A3B8',
    },
    taskMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
    },
    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    statusChipText: {
        fontSize: 10,
        fontWeight: '600',
    },
    priorityChip: {
        width: 20,
        height: 20,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 3,
    },
    dateChipText: {
        fontSize: 10,
        fontWeight: '500',
    },
    avatar: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    avatarText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    emptyGroup: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    emptyGroupText: {
        fontSize: 12,
        color: '#CBD5E1',
    },
    noResults: {
        alignItems: 'center',
        paddingVertical: 48,
        gap: 12,
    },
    noResultsText: {
        fontSize: 14,
        color: '#94A3B8',
    },
});
