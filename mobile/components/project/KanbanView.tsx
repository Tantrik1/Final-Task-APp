import React, { useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    CheckSquare,
    Calendar,
    Flag,
    Plus,
} from 'lucide-react-native';
import { format, isPast, isToday } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = SCREEN_WIDTH * 0.75;
const COLUMN_SNAP = COLUMN_WIDTH + 12;

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
    category?: 'todo' | 'active' | 'done' | 'cancelled';
}

interface KanbanViewProps {
    tasks: Task[];
    statuses: Status[];
    onToggleComplete: (task: Task) => Promise<void> | void;
    projectId: string;
    projectColor: string;
    onAddTask?: () => void;
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    urgent: { color: '#EF4444', bg: '#FEF2F2', label: 'Urgent' },
    high: { color: '#F97316', bg: '#FFF7ED', label: 'High' },
    medium: { color: '#EAB308', bg: '#FEFCE8', label: 'Medium' },
    low: { color: '#94A3B8', bg: '#F8FAFC', label: 'Low' },
};

export default function KanbanView({ tasks, statuses, onToggleComplete, projectId, projectColor, onAddTask }: KanbanViewProps) {
    const router = useRouter();
    const { colors } = useTheme();
    const scrollRef = useRef<ScrollView>(null);

    const handleAddTask = () => {
        if (onAddTask) {
            onAddTask();
        } else {
            router.push(`/modal?projectId=${projectId}` as any);
        }
    };

    const defaultStatusId = statuses.find(s => s.is_default)?.id || statuses[0]?.id;

    const getColumnTasks = (status: Status) =>
        tasks.filter(t => {
            if (t.custom_status_id === status.id) return true;
            // Show orphaned tasks (no custom_status_id) in the default column
            if (status.id === defaultStatusId && !t.custom_status_id) return true;
            return false;
        });

    const renderCard = (task: Task, index: number) => {
        const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
        const isDueToday = task.due_date && isToday(new Date(task.due_date));
        const matchedStatus = task.custom_status_id
            ? statuses.find(s => s.id === task.custom_status_id)
            : null;
        const isCompleted = matchedStatus?.category === 'done' || matchedStatus?.category === 'cancelled' || matchedStatus?.is_completed || false;

        return (
            <Animated.View
                key={task.id}
                entering={FadeInDown.delay(index * 50).duration(300).springify()}
            >
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, isCompleted && styles.cardCompleted]}
                    onPress={() => router.push(`/task/${task.id}` as any)}
                    activeOpacity={0.7}
                >
                    {/* Priority accent */}
                    <View style={[styles.cardAccent, { backgroundColor: priority.color }]} />

                    <View style={styles.cardBody}>
                        {/* Title row */}
                        <View style={styles.cardTitleRow}>
                            <Text style={[styles.cardTitle, { color: colors.text }, isCompleted && styles.cardTitleDone]} numberOfLines={2}>
                                {task.title}
                            </Text>
                        </View>

                        {/* Description preview */}
                        {!!task.description && !isCompleted && (
                            <Text style={[styles.cardDesc, { color: colors.textTertiary }]} numberOfLines={1}>
                                {task.description}
                            </Text>
                        )}

                        {/* Meta row */}
                        <View style={styles.cardMeta}>
                            {/* Priority chip */}
                            <View style={[styles.chip, { backgroundColor: priority.bg }]}>
                                <Flag size={9} color={priority.color} />
                                <Text style={[styles.chipText, { color: priority.color }]}>{priority.label}</Text>
                            </View>

                            {/* Due date chip */}
                            {task.due_date && (
                                <View style={[
                                    styles.chip,
                                    { backgroundColor: isOverdue ? '#FEF2F2' : isDueToday ? '#FFF7ED' : '#F1F5F9' }
                                ]}>
                                    <Calendar size={9} color={isOverdue ? '#EF4444' : isDueToday ? '#F97316' : '#64748B'} />
                                    <Text style={[
                                        styles.chipText,
                                        { color: isOverdue ? '#EF4444' : isDueToday ? '#F97316' : '#64748B' }
                                    ]}>
                                        {format(new Date(task.due_date), 'MMM d')}
                                    </Text>
                                </View>
                            )}

                            {/* Spacer */}
                            <View style={{ flex: 1 }} />

                            {/* Assignee avatar */}
                            {task.assignee && (
                                <View style={[styles.cardAvatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <Text style={[styles.cardAvatarText, { color: colors.textSecondary }]}>
                                        {task.assignee.full_name?.charAt(0)?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderColumn = (status: Status) => {
        const columnTasks = getColumnTasks(status);
        const completedCount = columnTasks.length;

        return (
            <View key={status.id} style={[styles.column, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Column header */}
                <View style={[styles.columnHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <View style={[styles.columnDot, { backgroundColor: status.color }]} />
                    <Text style={[styles.columnTitle, { color: colors.text }]}>{status.name}</Text>
                    <View style={[styles.columnBadge, { backgroundColor: status.color + '20' }]}>
                        <Text style={[styles.columnBadgeText, { color: status.color }]}>{completedCount}</Text>
                    </View>
                </View>

                {/* Column content */}
                <ScrollView
                    style={styles.columnScroll}
                    contentContainerStyle={styles.columnContent}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                >
                    {columnTasks.length === 0 ? (
                        <View style={styles.emptyColumn}>
                            <Text style={[styles.emptyColumnText, { color: colors.textTertiary }]}>No tasks</Text>
                            <TouchableOpacity
                                style={[styles.addTaskMini, { borderColor: colors.border }]}
                                onPress={handleAddTask}
                            >
                                <Plus size={14} color={colors.textTertiary} />
                                <Text style={[styles.addTaskMiniText, { color: colors.textTertiary }]}>Add task</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {columnTasks.map((task, index) => renderCard(task, index))}
                            <TouchableOpacity
                                style={[styles.addCardBtn, { borderColor: colors.border }]}
                                onPress={handleAddTask}
                            >
                                <Plus size={14} color={colors.textTertiary} />
                                <Text style={[styles.addCardText, { color: colors.textTertiary }]}>Add task</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </View>
        );
    };

    if (statuses.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No statuses configured for this project</Text>
            </View>
        );
    }

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled={false}
            snapToInterval={COLUMN_SNAP}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {statuses.map(renderColumn)}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 120,
        gap: 12,
    },
    column: {
        width: COLUMN_WIDTH,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        overflow: 'hidden',
        maxHeight: '100%',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    columnHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 8,
    },
    columnDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    columnTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
        flex: 1,
    },
    columnBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 24,
        alignItems: 'center',
    },
    columnBadgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    columnScroll: {
        flex: 1,
    },
    columnContent: {
        padding: 10,
        gap: 8,
        paddingBottom: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        ...Platform.select({
            ios: {
                shadowColor: '#64748B',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    cardCompleted: {
        opacity: 0.6,
        borderColor: '#E2E8F0',
    },
    cardAccent: {
        height: 3,
        width: '100%',
    },
    cardBody: {
        padding: 12,
        gap: 8,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },

    cardTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        lineHeight: 20,
    },
    cardTitleDone: {
        textDecorationLine: 'line-through',
        color: '#94A3B8',
    },
    cardDesc: {
        fontSize: 12,
        color: '#94A3B8',
        lineHeight: 16,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        gap: 3,
    },
    chipText: {
        fontSize: 10,
        fontWeight: '600',
    },
    cardAvatar: {
        width: 22,
        height: 22,
        borderRadius: 7,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardAvatarText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    emptyColumn: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    emptyColumnText: {
        fontSize: 13,
        color: '#94A3B8',
    },
    addTaskMini: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    addTaskMiniText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
    },
    addCardBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        marginTop: 4,
    },
    addCardText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#94A3B8',
    },
});
