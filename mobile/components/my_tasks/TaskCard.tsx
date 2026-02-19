import React, { useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated as RNAnimated, PanResponder, Platform,
} from 'react-native';
import { Flag, Calendar, CheckCircle2, Circle } from 'lucide-react-native';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';

interface TaskCardProps {
    task: any;
    onPress: () => void;
    onComplete: () => void;
    onChangeStatus: () => void;
    index?: number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; bgDark: string }> = {
    todo: { color: '#94A3B8', bg: '#F8FAFC', bgDark: '#1E293B' },
    in_progress: { color: '#3B82F6', bg: '#EFF6FF', bgDark: '#1E3A8A' },
    review: { color: '#F59E0B', bg: '#FFFBEB', bgDark: '#78350F' },
    done: { color: '#10B981', bg: '#F0FDF4', bgDark: '#065F46' },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; bgDark: string; label: string }> = {
    urgent: { color: '#EF4444', bg: '#FEF2F2', bgDark: '#2D1515', label: 'Urgent' },
    high:   { color: '#F97316', bg: '#FFF7ED', bgDark: '#2D1A08', label: 'High' },
    medium: { color: '#EAB308', bg: '#FEFCE8', bgDark: '#2D2808', label: 'Medium' },
    low:    { color: '#94A3B8', bg: '#F8FAFC', bgDark: '#1E293B', label: 'Low' },
};

export function TaskCard({ task, onPress, onComplete, onChangeStatus }: TaskCardProps) {
    const { colors, colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';

    const pConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.low;
    const dueDate = task.due_date ? parseISO(task.due_date) : null;
    const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && !task.is_completed;
    const isTodayDue = dueDate && isToday(dueDate) && !task.is_completed;

    const pan = useRef(new RNAnimated.ValueXY()).current;

    const resetPosition = () => {
        RNAnimated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    };

    const panResponder = useRef(
        PanResponder.create({
            // Only claim the gesture if it's clearly horizontal — never block vertical scroll
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: (_e, g) =>
                Math.abs(g.dx) > Math.abs(g.dy * 3) && Math.abs(g.dx) > 20,
            onMoveShouldSetPanResponderCapture: (_e, g) =>
                Math.abs(g.dx) > Math.abs(g.dy * 3) && Math.abs(g.dx) > 20,
            onPanResponderMove: RNAnimated.event([null, { dx: pan.x }], { useNativeDriver: false }),
            onPanResponderRelease: (_e, g) => {
                if (g.dx > 80) { onComplete(); resetPosition(); }
                else if (g.dx < -80) { onChangeStatus(); resetPosition(); }
                else resetPosition();
            },
        })
    ).current;

    const completeOpacity = pan.x.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
    const statusOpacity   = pan.x.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp' });
    const cardScale       = pan.x.interpolate({ inputRange: [-80, 0, 80], outputRange: [0.97, 1, 0.97], extrapolate: 'clamp' });

    return (
        <View style={styles.wrapper}>
            {/* Swipe action backgrounds */}
            <View style={styles.actionLayer}>
                <RNAnimated.View style={[styles.actionLeft, { opacity: completeOpacity }]}>
                    <CheckCircle2 size={20} color="#FFF" />
                    <Text style={styles.actionText}>Complete</Text>
                </RNAnimated.View>
                <RNAnimated.View style={[styles.actionRight, { opacity: statusOpacity }]}>
                    <Text style={styles.actionText}>Status</Text>
                    <Flag size={20} color="#FFF" />
                </RNAnimated.View>
            </View>

            {/* Card */}
            <RNAnimated.View
                {...panResponder.panHandlers}
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        shadowColor: colors.shadow,
                        transform: [{ translateX: pan.x }, { scale: cardScale }],
                    },
                    task.is_completed && { opacity: 0.6 },
                ]}
                accessible={true}
                accessibilityLabel={`Task: ${task.title}`}
                accessibilityHint="Swipe right to complete, swipe left to change status, or tap to view details"
            >
                <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.touchable}>
                    {/* Priority accent bar */}
                    <View style={[styles.accentBar, { backgroundColor: task.is_completed ? colors.border : pConfig.color }]} />

                    <View style={styles.content}>
                        {/* Top row: checkbox + title */}
                        <View style={styles.topRow}>
                            <TouchableOpacity 
                                onPress={onComplete} 
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} 
                                style={styles.checkBtn}
                                accessible={true}
                                accessibilityLabel={task.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: task.is_completed }}
                            >
                                {task.is_completed
                                    ? <CheckCircle2 size={20} color={colors.secondary} />
                                    : <Circle size={20} color={colors.border} />
                                }
                            </TouchableOpacity>
                            <Text
                                style={[
                                    styles.title,
                                    { color: colors.text },
                                    task.is_completed && { textDecorationLine: 'line-through', color: colors.textMuted },
                                ]}
                                numberOfLines={2}
                            >
                                {task.title}
                            </Text>
                        </View>

                        {/* Bottom row: tags */}
                        <View style={styles.metaRow}>
                            {/* Status */}
                            {task.status_name && !task.is_completed && (
                                <View style={[
                                    styles.tag,
                                    {
                                        backgroundColor: task.status_color ? (task.status_color + '20') : (isDark ? (STATUS_CONFIG[task.status]?.bgDark || colors.surface) : (STATUS_CONFIG[task.status]?.bg || '#F8FAFC')),
                                        borderColor: task.status_color ? (task.status_color + '50') : ((STATUS_CONFIG[task.status]?.color || colors.textTertiary) + '40'),
                                    },
                                ]}>
                                    <View style={[styles.dot, { backgroundColor: task.status_color || STATUS_CONFIG[task.status]?.color || colors.textTertiary }]} />
                                    <Text style={[styles.tagText, { color: task.status_color || STATUS_CONFIG[task.status]?.color || colors.textSecondary }]} numberOfLines={1}>
                                        {task.status_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                    </Text>
                                </View>
                            )}

                            {/* Project */}
                            {task.project && (
                                <View style={[styles.tag, { backgroundColor: isDark ? colors.surface : '#F8FAFC', borderColor: colors.borderLight }]}>
                                    <View style={[styles.dot, { backgroundColor: task.project.color || '#6366F1' }]} />
                                    <Text style={[styles.tagText, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {task.project.name}
                                    </Text>
                                </View>
                            )}

                            {/* Due date */}
                            {task.due_date && (
                                <View style={[
                                    styles.tag,
                                    { backgroundColor: isDark ? colors.surface : '#F8FAFC', borderColor: colors.borderLight },
                                    isOverdue && { backgroundColor: isDark ? '#2D1515' : '#FEF2F2', borderColor: isDark ? '#7F1D1D' : '#FECACA' },
                                    isTodayDue && { backgroundColor: isDark ? '#2D2008' : '#FFFBEB', borderColor: isDark ? '#78350F' : '#FDE68A' },
                                ]}>
                                    <Calendar size={11} color={isOverdue ? '#EF4444' : isTodayDue ? '#F59E0B' : colors.textTertiary} />
                                    <Text style={[
                                        styles.tagText,
                                        { color: isOverdue ? '#EF4444' : isTodayDue ? '#F59E0B' : colors.textSecondary },
                                    ]}>
                                        {isOverdue ? 'Overdue' : isTodayDue ? 'Today' : dueDate ? format(dueDate, 'MMM d') : ''}
                                    </Text>
                                </View>
                            )}

                            {/* Priority badge */}
                            {task.priority && task.priority !== 'low' && (
                                <View style={[
                                    styles.tag,
                                    { backgroundColor: isDark ? pConfig.bgDark : pConfig.bg, borderColor: pConfig.color + '40' },
                                ]}>
                                    <Flag size={11} color={pConfig.color} />
                                    <Text style={[styles.tagText, { color: pConfig.color }]}>{pConfig.label}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </RNAnimated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 12,
        borderRadius: 14,
    },
    actionLayer: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        borderRadius: 14,
        overflow: 'hidden',
    },
    actionLeft: {
        backgroundColor: '#10B981',
        height: '100%',
        width: '50%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 20,
        gap: 8,
    },
    actionRight: {
        backgroundColor: '#6366F1',
        height: '100%',
        width: '50%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 20,
        gap: 8,
        position: 'absolute',
        right: 0,
    },
    actionText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 13,
    },
    card: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
        minHeight: 76,
        ...Platform.select({
            ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
            android: { elevation: 2 },
        }),
    },
    touchable: {
        flexDirection: 'row',
    },
    accentBar: {
        width: 3,
        minHeight: '100%',
    },
    content: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 10,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    checkBtn: {
        marginTop: 1,
    },
    title: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 7,
        paddingLeft: 30,
        minHeight: 24,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 7,
        borderWidth: 1,
        height: 24,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    tagText: {
        fontSize: 11,
        fontWeight: '600',
        maxWidth: 120,
        lineHeight: 14,
    },
});
