import React, { useState, useMemo } from 'react';
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
    ChevronLeft,
    ChevronRight,
    CheckSquare,
    Flag,
    Calendar as CalendarIcon,
} from 'lucide-react-native';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    isToday,
    isPast,
} from 'date-fns';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_SIZE = (SCREEN_WIDTH - 32 - 12) / 7; // 16px padding each side, 2px gaps

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

interface CalendarViewProps {
    tasks: Task[];
    statuses: Status[];
    onToggleComplete: (task: Task) => Promise<void> | void;
    projectId: string;
    projectColor: string;
}

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
    urgent: { color: '#EF4444', label: 'Urgent' },
    high: { color: '#F97316', label: 'High' },
    medium: { color: '#EAB308', label: 'Medium' },
    low: { color: '#94A3B8', label: 'Low' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ tasks, statuses, onToggleComplete, projectId, projectColor }: CalendarViewProps) {
    const router = useRouter();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    const tasksByDate = useMemo(() => {
        const map: Record<string, Task[]> = {};
        for (const task of tasks) {
            if (task.due_date) {
                const key = task.due_date.split('T')[0];
                if (!map[key]) map[key] = [];
                map[key].push(task);
            }
        }
        return map;
    }, [tasks]);

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const calStart = startOfWeek(monthStart);
        const calEnd = endOfWeek(monthEnd);

        const days: Date[] = [];
        let day = calStart;
        while (day <= calEnd) {
            days.push(day);
            day = addDays(day, 1);
        }
        return days;
    }, [currentMonth]);

    const selectedDateTasks = useMemo(() => {
        if (!selectedDate) return [];
        const key = format(selectedDate, 'yyyy-MM-dd');
        return tasksByDate[key] || [];
    }, [selectedDate, tasksByDate]);

    const unscheduledTasks = useMemo(() => {
        return tasks.filter(t => !t.due_date);
    }, [tasks]);

    const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const goToToday = () => {
        setCurrentMonth(new Date());
        setSelectedDate(new Date());
    };

    const getStatusForTask = (task: Task) => {
        return task.custom_status_id
            ? statuses.find(s => s.id === task.custom_status_id)
            : null;
    };

    const renderDayCell = (day: Date) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDate[dateKey] || [];
        const isCurrentMonth = isSameMonth(day, currentMonth);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isTodayDate = isToday(day);
        const hasOverdue = dayTasks.some(t => {
            const status = getStatusForTask(t);
            return !status?.is_completed && isPast(new Date(t.due_date!)) && !isToday(new Date(t.due_date!));
        });

        // Task dots (max 3 visible)
        const dotTasks = dayTasks.slice(0, 3);

        return (
            <TouchableOpacity
                key={dateKey}
                style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isTodayDate && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDate(day)}
                activeOpacity={0.6}
            >
                <Text style={[
                    styles.dayText,
                    !isCurrentMonth && styles.dayTextMuted,
                    isSelected && styles.dayTextSelected,
                    isTodayDate && !isSelected && styles.dayTextToday,
                ]}>
                    {format(day, 'd')}
                </Text>
                {dayTasks.length > 0 && (
                    <View style={styles.dotRow}>
                        {dotTasks.map((t, i) => {
                            const status = getStatusForTask(t);
                            return (
                                <View
                                    key={i}
                                    style={[
                                        styles.taskDot,
                                        { backgroundColor: isSelected ? '#FFF' : (status?.color || projectColor) },
                                    ]}
                                />
                            );
                        })}
                        {dayTasks.length > 3 && (
                            <Text style={[styles.dotMore, isSelected && { color: '#FFF' }]}>+</Text>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderTaskItem = (task: Task, index: number) => {
        const status = getStatusForTask(task);
        const isCompleted = status?.is_completed || false;
        const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

        return (
            <Animated.View key={task.id} entering={FadeInDown.delay(index * 40).duration(250)}>
                <TouchableOpacity
                    style={[styles.taskItem, isCompleted && styles.taskItemCompleted]}
                    onPress={() => router.push(`/task/${task.id}` as any)}
                    activeOpacity={0.6}
                >
                    <TouchableOpacity
                        style={[styles.checkbox, isCompleted && styles.checkboxDone]}
                        onPress={() => onToggleComplete(task)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {isCompleted && <CheckSquare size={10} color="#FFF" />}
                    </TouchableOpacity>

                    <View style={[styles.taskColorBar, { backgroundColor: status?.color || '#94A3B8' }]} />

                    <View style={styles.taskContent}>
                        <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]} numberOfLines={1}>
                            {task.title}
                        </Text>
                        <View style={styles.taskMeta}>
                            {status && (
                                <Text style={[styles.taskStatus, { color: status.color }]}>{status.name}</Text>
                            )}
                            <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
                        </View>
                    </View>

                    {task.assignee && (
                        <View style={styles.miniAvatar}>
                            <Text style={styles.miniAvatarText}>
                                {task.assignee.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Month navigation */}
            <View style={styles.monthNav}>
                <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn}>
                    <ChevronLeft size={20} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity onPress={goToToday}>
                    <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn}>
                    <ChevronRight size={20} color="#64748B" />
                </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekdayRow}>
                {WEEKDAYS.map(d => (
                    <View key={d} style={styles.weekdayCell}>
                        <Text style={styles.weekdayText}>{d}</Text>
                    </View>
                ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
                {calendarDays.map(day => renderDayCell(day))}
            </View>

            {/* Selected date tasks */}
            {selectedDate && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.selectedSection}>
                    <View style={styles.selectedHeader}>
                        <CalendarIcon size={16} color={projectColor} />
                        <Text style={styles.selectedTitle}>
                            {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE, MMM d')}
                        </Text>
                        <View style={[styles.selectedBadge, { backgroundColor: projectColor + '15' }]}>
                            <Text style={[styles.selectedBadgeText, { color: projectColor }]}>
                                {selectedDateTasks.length}
                            </Text>
                        </View>
                    </View>

                    {selectedDateTasks.length === 0 ? (
                        <View style={styles.emptyDay}>
                            <Text style={styles.emptyDayText}>No tasks due on this day</Text>
                        </View>
                    ) : (
                        <View style={styles.taskList}>
                            {selectedDateTasks.map((task, idx) => renderTaskItem(task, idx))}
                        </View>
                    )}
                </Animated.View>
            )}

            {/* Unscheduled tasks */}
            {unscheduledTasks.length > 0 && (
                <View style={styles.unscheduledSection}>
                    <View style={styles.selectedHeader}>
                        <Flag size={16} color="#94A3B8" />
                        <Text style={styles.selectedTitle}>Unscheduled</Text>
                        <View style={[styles.selectedBadge, { backgroundColor: '#F1F5F9' }]}>
                            <Text style={[styles.selectedBadgeText, { color: '#94A3B8' }]}>
                                {unscheduledTasks.length}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.taskList}>
                        {unscheduledTasks.map((task, idx) => renderTaskItem(task, idx))}
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    navBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E293B',
    },
    weekdayRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 4,
    },
    weekdayCell: {
        width: DAY_SIZE,
        alignItems: 'center',
        paddingVertical: 4,
    },
    weekdayText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
    },
    dayCell: {
        width: DAY_SIZE,
        height: DAY_SIZE + 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        gap: 2,
    },
    dayCellSelected: {
        backgroundColor: '#F97316',
    },
    dayCellToday: {
        backgroundColor: '#FFF7ED',
    },
    dayText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    dayTextMuted: {
        color: '#CBD5E1',
    },
    dayTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    dayTextToday: {
        color: '#F97316',
        fontWeight: '700',
    },
    dotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 6,
    },
    taskDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    dotMore: {
        fontSize: 8,
        fontWeight: '700',
        color: '#94A3B8',
        marginLeft: 1,
    },
    selectedSection: {
        marginTop: 16,
        paddingHorizontal: 16,
    },
    selectedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    selectedTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        flex: 1,
    },
    selectedBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    selectedBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    taskList: {
        gap: 6,
    },
    taskItem: {
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
    taskItemCompleted: {
        opacity: 0.5,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxDone: {
        backgroundColor: '#22C55E',
        borderColor: '#22C55E',
    },
    taskColorBar: {
        width: 3,
        height: 28,
        borderRadius: 2,
    },
    taskContent: {
        flex: 1,
        gap: 2,
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
    taskStatus: {
        fontSize: 10,
        fontWeight: '600',
    },
    priorityDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    miniAvatar: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    miniAvatarText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    emptyDay: {
        paddingVertical: 24,
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        borderStyle: 'dashed',
    },
    emptyDayText: {
        fontSize: 13,
        color: '#94A3B8',
    },
    unscheduledSection: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
});
