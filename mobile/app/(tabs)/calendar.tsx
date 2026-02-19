import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Plus,
    List,
    CalendarDays,
    Sparkles,
} from 'lucide-react-native';
import {
    format,
    isToday,
    parseISO,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    getDate,
} from 'date-fns';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { CalendarSkeleton } from '@/components/ui/Skeleton';
import Animated, {
    FadeInDown,
    FadeInRight,
    Layout,
} from 'react-native-reanimated';
import { Calendar } from 'react-native-calendars';
import * as Haptics from 'expo-haptics';
import { Svg, Circle } from 'react-native-svg';

interface TaskWithProject {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    project_id: string;
    custom_status_id?: string | null;
    is_completed?: boolean;
    project?: { id: string; name: string; color: string | null };
}

const PRIORITY_CONFIG: Record<string, { color: string, label: string }> = {
    urgent: { color: '#EF4444', label: 'ASAP' },
    high: { color: '#F97316', label: 'High' },
    medium: { color: '#F59E0B', label: 'Med' },
    low: { color: '#94A3B8', label: 'Low' },
};

const VIEW_MODES = [
    { id: 'month', icon: CalendarDays, label: 'Month' },
    { id: 'day', icon: List, label: 'Day' },
];

const DayProgress = ({ progress, isSelected, trackColor }: { progress: number, isSelected: boolean, trackColor: string }) => {
    const radius = 18;
    const stroke = 2.5;
    const normalizedRadius = radius - stroke;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffsetValue = circumference - (progress / 100) * circumference;

    return (
        <View style={s.progressContainer}>
            <Svg height={radius * 2} width={radius * 2}>
                <Circle
                    stroke={isSelected ? 'rgba(255,255,255,0.3)' : trackColor}
                    fill="transparent"
                    strokeWidth={stroke}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
                {progress > 0 && (
                    <Circle
                        stroke={isSelected ? '#FFF' : (progress === 100 ? '#10B981' : '#F97316')}
                        fill="transparent"
                        strokeWidth={stroke}
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={strokeDashoffsetValue}
                        strokeLinecap="round"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                )}
            </Svg>
        </View>
    );
};

const CustomDay = ({ date, state, marking, onPress, themeColors }: any) => {
    const isSelected = marking?.selected;
    const isTodayDate = state === 'today';
    const isDisabled = state === 'disabled';
    const progress = marking?.progress || 0;

    return (
        <TouchableOpacity
            style={[s.dayContainer, isSelected && { backgroundColor: themeColors?.primary || '#F97316' }]}
            onPress={() => onPress(date)}
            disabled={isDisabled}
        >
            <View style={s.dayContent}>
                {marking?.hasTasks && (
                    <DayProgress progress={progress} isSelected={isSelected} trackColor={themeColors?.border || '#E2E8F0'} />
                )}
                <Text style={[
                    s.dayText,
                    { color: themeColors?.text || '#334155' },
                    isSelected && s.dayTextSelected,
                    isTodayDate && !isSelected && { color: themeColors?.primary || '#F97316', fontWeight: '800' },
                    isDisabled && { color: themeColors?.border || '#CBD5E1' }
                ]}>
                    {date.day}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

export default function CalendarScreen() {
    const router = useRouter();
    const { currentWorkspace } = useWorkspace();
    const { user } = useAuth();
    const { colors } = useTheme();
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

    const isTablet = SCREEN_WIDTH >= 768;

    const [tasks, setTasks] = useState<TaskWithProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<'month' | 'day'>(isTablet ? 'month' : 'month');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dayViewMonth, setDayViewMonth] = useState(new Date());
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
    const [createTaskDueDate, setCreateTaskDueDate] = useState<string | undefined>(undefined);

    const fetchTasks = useCallback(async () => {
        if (!currentWorkspace?.id || !user) return;
        try {
            const { data: projects } = await supabase
                .from('projects')
                .select('id, name, color')
                .eq('workspace_id', currentWorkspace.id)
                .eq('is_archived', false);

            if (!projects || projects.length === 0) {
                setTasks([]);
                return;
            }

            const projectIds = projects.map(p => p.id);
            const projectMap = new Map(projects.map(p => [p.id, p]));

            const { data: statusData } = await supabase
                .from('project_statuses')
                .select('id, is_completed, category')
                .in('project_id', projectIds);

            const completedStatusIds = new Set(
                (statusData || []).filter(s => s.category === 'done' || s.category === 'cancelled' || s.is_completed).map(s => s.id)
            );

            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .in('project_id', projectIds)
                .not('due_date', 'is', null)
                .order('due_date', { ascending: true });

            if (error) throw error;

            setTasks(
                (data || []).map(t => ({
                    ...t,
                    project: projectMap.get(t.project_id),
                    is_completed: t.custom_status_id
                        ? completedStatusIds.has(t.custom_status_id)
                        : t.status === 'done'
                }))
            );
        } catch (error) {
            console.error('Error fetching calendar tasks:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [currentWorkspace?.id, user]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const onRefresh = () => { setRefreshing(true); fetchTasks(); };

    const markedDates = useMemo(() => {
        const marked: any = {};

        // Group tasks by date
        const dayStats: Record<string, { total: number, completed: number }> = {};

        tasks.forEach(t => {
            if (!t.due_date) return;
            const date = format(parseISO(t.due_date), 'yyyy-MM-dd');
            if (!dayStats[date]) {
                dayStats[date] = { total: 0, completed: 0 };
            }
            dayStats[date].total += 1;
            if (t.is_completed) dayStats[date].completed += 1;
        });

        Object.entries(dayStats).forEach(([date, stats]) => {
            const progress = Math.round((stats.completed / stats.total) * 100);
            marked[date] = {
                progress,
                count: stats.total,
                hasTasks: true
            };
        });

        // Add selection styling
        if (marked[selectedDate]) {
            marked[selectedDate].selected = true;
            marked[selectedDate].selectedColor = '#F97316';
        } else {
            marked[selectedDate] = { selected: true, selectedColor: '#F97316', hasTasks: false };
        }

        return marked;
    }, [tasks, selectedDate]);


    const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(style);
    };

    if (isLoading) {
        return (
            <View style={[s.container, { backgroundColor: colors.background }]}>
                <CalendarSkeleton />
            </View>
        );
    }

    return (
        <View style={[s.container, { backgroundColor: colors.background }]}>
            {/* ─── Header View Controls ─── */}
            <View style={s.header}>
                <View style={[s.viewToggle, { backgroundColor: colors.surface }, isTablet && s.tabletToggle]}>
                    {VIEW_MODES.map((mode) => (
                        <TouchableOpacity
                            key={mode.id}
                            style={[s.toggleBtn, viewMode === mode.id && [s.toggleBtnActive, { backgroundColor: colors.card }]]}
                            onPress={() => { triggerHaptic(); setViewMode(mode.id as any); }}
                        >
                            <mode.icon size={16} color={viewMode === mode.id ? colors.primary : colors.textTertiary} />
                            <Text style={[s.toggleLabel, { color: colors.textTertiary }, viewMode === mode.id && { color: colors.text }]}>{mode.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {isTablet && (
                    <TouchableOpacity style={s.addBtnTablet} onPress={() => triggerHaptic()}>
                        <Plus size={20} color="#FFF" />
                        <Text style={s.addBtnText}>New Task</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={[s.content, isTablet && s.tabletContent]}>
                {/* ─── Calendar View ─── */}
                {(isTablet || viewMode === 'month') && (
                    <Animated.View
                        entering={FadeInDown.springify()}
                        exiting={FadeInDown.springify()}
                        layout={Layout.springify()}
                        style={[s.calendarContainer, { backgroundColor: colors.card, borderColor: colors.border }, isTablet && s.tabletCalendar]}
                    >
                        <Calendar
                            markingType={'custom'}
                            markedDates={markedDates}
                            onDayPress={(day: any) => { triggerHaptic(); setSelectedDate(day.dateString); }}
                            dayComponent={(props: any) => <CustomDay {...props} themeColors={colors} onPress={(day: any) => { triggerHaptic(); setSelectedDate(day.dateString); }} />}
                            theme={{
                                backgroundColor: colors.card,
                                calendarBackground: colors.card,
                                textSectionTitleColor: colors.textTertiary,
                                selectedDayBackgroundColor: colors.primary,
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: colors.primary,
                                dayTextColor: colors.text,
                                textDisabledColor: colors.border,
                                dotColor: colors.primary,
                                selectedDotColor: '#ffffff',
                                arrowColor: colors.primary,
                                disabledArrowColor: colors.border,
                                monthTextColor: colors.text,
                                indicatorColor: colors.primary,
                                textDayFontWeight: '600',
                                textMonthFontWeight: 'bold',
                                textDayHeaderFontWeight: '700',
                                textDayFontSize: 16,
                                textMonthFontSize: 18,
                                textDayHeaderFontSize: 12,
                            }}
                            style={s.calendar}
                        />
                    </Animated.View>
                )}

                {/* ─── Month View: Selected Date Tasks ─── */}
                {!isTablet && viewMode === 'month' && (() => {
                    const selectedTasks = tasks.filter(t => t.due_date && format(parseISO(t.due_date), 'yyyy-MM-dd') === selectedDate);
                    return (
                        <View style={s.mvSelectedSection}>
                            <View style={s.mvSelectedHeader}>
                                <View>
                                    <Text style={[s.mvSelectedDate, { color: colors.text }]}>{format(parseISO(selectedDate), 'EEE, MMM d')}</Text>
                                    <Text style={[s.mvSelectedCount, { color: colors.textTertiary }]}>{selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}</Text>
                                </View>
                                <TouchableOpacity
                                    style={[s.mvAddBtn, { backgroundColor: colors.primary }]}
                                    onPress={() => {
                                        triggerHaptic();
                                        setCreateTaskDueDate(selectedDate);
                                        setShowCreateTaskModal(true);
                                    }}
                                >
                                    <Plus size={16} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                            {selectedTasks.length === 0 ? (
                                <Text style={[s.mvNoTasks, { color: colors.textTertiary }]}>No tasks for this date</Text>
                            ) : (
                                selectedTasks.map(task => (
                                    <TouchableOpacity
                                        key={task.id}
                                        style={[s.dvTaskCard, { backgroundColor: colors.card, borderColor: colors.border }, task.is_completed && s.dvTaskCardDone]}
                                        onPress={() => router.push(`/task/${task.id}` as any)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[s.dvTaskDot, { backgroundColor: PRIORITY_CONFIG[task.priority]?.color || '#94A3B8' }]} />
                                        <Text style={[s.dvTaskTitle, { color: colors.text }, task.is_completed && s.dvTaskTitleDone]} numberOfLines={1}>
                                            {task.title}
                                        </Text>
                                        {task.is_completed ? (
                                            <CheckCircle2 size={16} color="#10B981" />
                                        ) : (
                                            <View style={[s.dvPriorityMini, { backgroundColor: (PRIORITY_CONFIG[task.priority]?.color || '#94A3B8') + '20' }]}>
                                                <Text style={[s.dvPriorityMiniText, { color: PRIORITY_CONFIG[task.priority]?.color }]}>
                                                    {PRIORITY_CONFIG[task.priority]?.label}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    );
                })()}

                {/* ─── Day List View ─── */}
                {(isTablet || viewMode === 'day') && (() => {
                    const monthStart = startOfMonth(dayViewMonth);
                    const monthEnd = endOfMonth(dayViewMonth);
                    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

                    return (
                        <Animated.View
                            entering={FadeInRight.springify()}
                            style={[s.agendaContainer, isTablet && s.tabletAgenda]}
                        >
                            {/* ─── Month/Year Switcher ─── */}
                            <View style={[s.dvMonthHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <TouchableOpacity
                                    style={[s.dvNavBtn, { backgroundColor: colors.primary + '15' }]}
                                    onPress={() => { triggerHaptic(); setDayViewMonth(prev => subMonths(prev, 1)); setExpandedDay(null); }}
                                >
                                    <ChevronLeft size={20} color={colors.primary} />
                                </TouchableOpacity>
                                <View style={s.dvMonthCenter}>
                                    <Text style={[s.dvMonthTitle, { color: colors.text }]}>{format(dayViewMonth, 'MMMM yyyy')}</Text>
                                    <Text style={[s.dvMonthSub, { color: colors.textTertiary }]}>
                                        {daysInMonth.length} days · {tasks.filter(t => {
                                            if (!t.due_date) return false;
                                            const d = parseISO(t.due_date);
                                            return d >= monthStart && d <= monthEnd;
                                        }).length} tasks
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[s.dvNavBtn, { backgroundColor: colors.primary + '15' }]}
                                    onPress={() => { triggerHaptic(); setDayViewMonth(prev => addMonths(prev, 1)); setExpandedDay(null); }}
                                >
                                    <ChevronRight size={20} color={colors.primary} />
                                </TouchableOpacity>
                            </View>

                            {/* ─── Day Rows ─── */}
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={s.dvList}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                            >
                                {daysInMonth.map((day, idx) => {
                                    const dateKey = format(day, 'yyyy-MM-dd');
                                    const dayTasks = tasks.filter(t => t.due_date && format(parseISO(t.due_date), 'yyyy-MM-dd') === dateKey);
                                    const total = dayTasks.length;
                                    const completed = dayTasks.filter(t => t.is_completed).length;
                                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                                    const isExpanded = expandedDay === dateKey;
                                    const isTodayDay = isToday(day);

                                    return (
                                        <Animated.View key={dateKey} entering={FadeInDown.delay(idx * 20).springify()} layout={Layout.springify()}>
                                            {/* ─ Day Summary Row ─ */}
                                            <TouchableOpacity
                                                style={[s.dvRow, { backgroundColor: colors.card, borderColor: colors.border }, isTodayDay && [s.dvRowToday, { borderColor: colors.primary, backgroundColor: colors.primary + '08' }], isExpanded && s.dvRowExpanded]}
                                                onPress={() => { triggerHaptic(); setExpandedDay(isExpanded ? null : dateKey); }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={[s.dvDayNum, { backgroundColor: colors.surface }, isTodayDay && { backgroundColor: colors.primary }]}>
                                                    <Text style={[s.dvDayNumText, { color: colors.text }, isTodayDay && s.dvDayNumTextToday]}>{getDate(day)}</Text>
                                                </View>
                                                <View style={s.dvDayInfo}>
                                                    <Text style={[s.dvDayName, { color: colors.text }]}>{format(day, 'EEE')}</Text>
                                                    <Text style={[s.dvTaskCount, { color: colors.textTertiary }]}>
                                                        {total === 0 ? 'No tasks' : `${total} task${total > 1 ? 's' : ''}`}
                                                    </Text>
                                                </View>
                                                {total > 0 && (
                                                    <View style={[s.dvPctBadge, { backgroundColor: colors.surface }, pct === 100 && s.dvPctBadgeDone]}>
                                                        <Text style={[s.dvPctText, { color: colors.textSecondary }, pct === 100 && s.dvPctTextDone]}>{pct}%</Text>
                                                    </View>
                                                )}
                                                <ChevronRight
                                                    size={16}
                                                    color={isExpanded ? colors.primary : colors.textTertiary}
                                                    style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                                                />
                                            </TouchableOpacity>

                                            {/* ─ Expanded Day Detail ─ */}
                                            {isExpanded && (
                                                <Animated.View entering={FadeInDown.duration(200)} style={[s.dvExpanded, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                                    {dayTasks.length === 0 ? (
                                                        <View style={s.dvEmptyState}>
                                                            <Sparkles size={24} color={colors.textTertiary} />
                                                            <Text style={[s.dvEmptyTitle, { color: colors.textSecondary }]}>No tasks for this day</Text>
                                                            <Text style={[s.dvEmptySub, { color: colors.textTertiary }]}>Would you like to create one?</Text>
                                                            <View style={s.dvEmptyActions}>
                                                                <TouchableOpacity
                                                                    style={[s.dvEmptyYes, { backgroundColor: colors.primary }]}
                                                                    onPress={() => {
                                                                        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                                                                        setCreateTaskDueDate(dateKey);
                                                                        setShowCreateTaskModal(true);
                                                                    }}
                                                                >
                                                                    <Plus size={14} color="#FFF" />
                                                                    <Text style={s.dvEmptyYesText}>Yes, create</Text>
                                                                </TouchableOpacity>
                                                                <TouchableOpacity
                                                                    style={[s.dvEmptyNo, { borderColor: colors.border, backgroundColor: colors.card }]}
                                                                    onPress={() => { triggerHaptic(); setExpandedDay(null); }}
                                                                >
                                                                    <Text style={[s.dvEmptyNoText, { color: colors.textTertiary }]}>No thanks</Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    ) : (
                                                        <>
                                                            {dayTasks.map((task) => (
                                                                <TouchableOpacity
                                                                    key={task.id}
                                                                    style={[s.dvTaskCard, { backgroundColor: colors.card, borderColor: colors.border }, task.is_completed && s.dvTaskCardDone]}
                                                                    onPress={() => router.push(`/task/${task.id}` as any)}
                                                                    activeOpacity={0.8}
                                                                >
                                                                    <View style={[s.dvTaskDot, { backgroundColor: PRIORITY_CONFIG[task.priority]?.color || '#94A3B8' }]} />
                                                                    <Text style={[s.dvTaskTitle, { color: colors.text }, task.is_completed && s.dvTaskTitleDone]} numberOfLines={1}>
                                                                        {task.title}
                                                                    </Text>
                                                                    {task.is_completed ? (
                                                                        <CheckCircle2 size={16} color="#10B981" />
                                                                    ) : (
                                                                        <View style={[s.dvPriorityMini, { backgroundColor: (PRIORITY_CONFIG[task.priority]?.color || '#94A3B8') + '20' }]}>
                                                                            <Text style={[s.dvPriorityMiniText, { color: PRIORITY_CONFIG[task.priority]?.color }]}>
                                                                                {PRIORITY_CONFIG[task.priority]?.label}
                                                                            </Text>
                                                                        </View>
                                                                    )}
                                                                </TouchableOpacity>
                                                            ))}
                                                            <TouchableOpacity
                                                                style={[s.dvAddBtn, { borderColor: colors.primary }]}
                                                                onPress={() => {
                                                                    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                                                                    setCreateTaskDueDate(dateKey);
                                                                    setShowCreateTaskModal(true);
                                                                }}
                                                            >
                                                                <Plus size={14} color={colors.primary} />
                                                                <Text style={[s.dvAddBtnText, { color: colors.primary }]}>Add task</Text>
                                                            </TouchableOpacity>
                                                        </>
                                                    )}
                                                </Animated.View>
                                            )}
                                        </Animated.View>
                                    );
                                })}
                            </ScrollView>
                        </Animated.View>
                    );
                })()}

                {/* ─── Create Task Modal ─── */}
                <CreateTaskModal
                    visible={showCreateTaskModal}
                    onClose={() => setShowCreateTaskModal(false)}
                    initialDueDate={createTaskDueDate}
                    onCreated={() => { setShowCreateTaskModal(false); fetchTasks(); }}
                />
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0',
        padding: 4,
        borderRadius: 14,
        gap: 4,
    },
    tabletToggle: {
        width: 200,
    },
    toggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 10,
        gap: 6,
        flex: 1,
        justifyContent: 'center',
    },
    toggleBtnActive: {
        backgroundColor: '#FFFFFF',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: { elevation: 2 },
        }),
    },
    toggleLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
    },
    toggleLabelActive: {
        color: '#0F172A',
    },
    addBtnTablet: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F97316',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        gap: 8,
    },
    addBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },
    content: {
        flex: 1,
    },
    tabletContent: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 20,
    },
    calendarContainer: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        marginHorizontal: 16,
        marginTop: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.05,
                shadowRadius: 16,
            },
            android: { elevation: 4 },
        }),
    },
    tabletCalendar: {
        flex: 1,
        marginHorizontal: 0,
        height: 480,
    },
    calendar: {
        paddingBottom: 10,
    },
    agendaContainer: {
        flex: 1,
        marginTop: 20,
    },
    tabletAgenda: {
        flex: 1,
        marginTop: 8,
    },
    agendaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    selectedDateLabel: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    taskCountLabel: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 2,
    },
    addBtnMobile: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F97316',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#F97316',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: { elevation: 6 },
        }),
    },
    taskList: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#F1F5F9',
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    emptyIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 6,
    },
    taskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 4,
            },
            android: { elevation: 2 },
        }),
    },
    taskCardCompleted: {
        opacity: 0.7,
        backgroundColor: '#F1F5F9',
    },
    priorityStrip: {
        width: 6,
        height: '100%',
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    taskMain: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    taskHeaderLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    taskTitleText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        flex: 1,
        marginRight: 10,
    },
    taskTitleCompleted: {
        textDecorationLine: 'line-through',
        color: '#94A3B8',
    },
    priorityCapsule: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    priorityCapsuleText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    taskFooterLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    projectBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    badgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    timeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
    },
    checkCircle: {
        paddingRight: 16,
    },
    // -- Progress & Custom Day Styles --
    progressContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayContainer: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
    },
    daySelected: {
        backgroundColor: '#F97316',
    },
    dayContent: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155',
    },
    dayTextSelected: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    dayTextToday: {
        color: '#F97316',
        fontWeight: '800',
    },
    dayTextDisabled: {
        color: '#CBD5E1',
    },
    // -- Month View: Selected Date Section --
    mvSelectedSection: {
        paddingHorizontal: 20,
        paddingTop: 16,
        flex: 1,
    },
    mvSelectedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    mvSelectedDate: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    mvSelectedCount: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 2,
    },
    mvAddBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#F97316',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mvNoTasks: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
        textAlign: 'center',
        paddingVertical: 20,
    },
    // -- Day View List Styles --
    dvMonthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
            android: { elevation: 2 },
        }),
    },
    dvNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dvMonthCenter: {
        alignItems: 'center',
    },
    dvMonthTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    dvMonthSub: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 2,
    },
    dvList: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 40,
    },
    dvRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 12,
    },
    dvRowToday: {
        borderWidth: 1.5,
    },
    dvRowExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        marginBottom: 0,
        borderBottomWidth: 0,
    },
    dvDayNum: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dvDayNumToday: {
        backgroundColor: '#F97316',
    },
    dvDayNumText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#334155',
    },
    dvDayNumTextToday: {
        color: '#FFF',
    },
    dvDayInfo: {
        flex: 1,
    },
    dvDayName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    dvTaskCount: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 1,
    },
    dvPctBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
    },
    dvPctBadgeDone: {
        backgroundColor: '#D1FAE5',
    },
    dvPctText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
    },
    dvPctTextDone: {
        color: '#059669',
    },
    dvExpanded: {
        backgroundColor: '#FAFBFC',
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: '#F1F5F9',
        borderBottomLeftRadius: 14,
        borderBottomRightRadius: 14,
    },
    dvTaskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: 6,
        gap: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    dvTaskCardDone: {
        opacity: 0.6,
    },
    dvTaskDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dvTaskTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
    },
    dvTaskTitleDone: {
        textDecorationLine: 'line-through',
        color: '#94A3B8',
    },
    dvPriorityMini: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    dvPriorityMiniText: {
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    dvAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#F97316',
        borderStyle: 'dashed',
        marginTop: 4,
    },
    dvAddBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#F97316',
    },
    dvEmptyState: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 6,
    },
    dvEmptyTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
    },
    dvEmptySub: {
        fontSize: 12,
        color: '#94A3B8',
    },
    dvEmptyActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
    dvEmptyYes: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F97316',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
    },
    dvEmptyYesText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFF',
    },
    dvEmptyNo: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFF',
    },
    dvEmptyNoText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
    },
});
