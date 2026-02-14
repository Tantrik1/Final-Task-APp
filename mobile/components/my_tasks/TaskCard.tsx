import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated, Dimensions, PanResponder, Image } from 'react-native';
import { ChevronRight, Flag, Calendar, MessageSquare, Clock, CheckCircle2 } from 'lucide-react-native';
import { format, isPast, isToday } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface TaskCardProps {
    task: any;
    onPress: () => void;
    onComplete: () => void;
    onChangeStatus: () => void;
    index: number;
}

const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#EF4444',
    high: '#F97316',
    medium: '#EAB308',
    low: '#94A3B8',
};

export function TaskCard({ task, onPress, onComplete, onChangeStatus, index }: TaskCardProps) {
    const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
    const isTodayDue = task.due_date && isToday(new Date(task.due_date));

    // Swipe Logic
    const pan = useRef(new RNAnimated.ValueXY()).current;

    // Reset position if released without trigger
    const resetPosition = () => {
        RNAnimated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 2) && Math.abs(gestureState.dx) > 10;
            },
            onPanResponderMove: RNAnimated.event([null, { dx: pan.x }], { useNativeDriver: false }),
            onPanResponderRelease: (evt, gestureState) => {
                if (gestureState.dx > 100) {
                    // Swiped Right -> Complete
                    onComplete();
                    resetPosition(); // Or animate out
                } else if (gestureState.dx < -100) {
                    // Swiped Left -> Change Status
                    onChangeStatus();
                    resetPosition();
                } else {
                    resetPosition();
                }
            },
        })
    ).current;

    const completeOpacity = pan.x.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const statusOpacity = pan.x.interpolate({
        inputRange: [-100, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View entering={FadeInDown.delay(index * 50).springify()} style={styles.container}>
            {/* Background Actions */}
            <View style={styles.actionLayer}>
                <RNAnimated.View style={[styles.actionLeft, { opacity: completeOpacity }]}>
                    <CheckCircle2 size={24} color="#FFF" />
                    <Text style={styles.actionText}>Complete</Text>
                </RNAnimated.View>
                <RNAnimated.View style={[styles.actionRight, { opacity: statusOpacity }]}>
                    <Text style={styles.actionText}>Status</Text>
                    <Clock size={24} color="#FFF" />
                </RNAnimated.View>
            </View>

            {/* Foreground Card */}
            <RNAnimated.View
                {...panResponder.panHandlers}
                style={[styles.card, { transform: [{ translateX: pan.x }] }]}
            >
                <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.touchable}>
                    <View style={[styles.priorityLine, { backgroundColor: priorityColor }]} />

                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text style={[styles.title, task.is_completed && styles.completedTitle]} numberOfLines={1}>
                                {task.title}
                            </Text>
                            {task.assigned_to && (
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>A</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.metaRow}>
                            {/* Project Tag */}
                            {task.project && (
                                <View style={styles.tag}>
                                    <View style={[styles.dot, { backgroundColor: task.project.color || '#6366F1' }]} />
                                    <Text style={styles.tagText}>{task.project.name}</Text>
                                </View>
                            )}

                            {/* Due Date */}
                            {task.due_date && (
                                <View style={[
                                    styles.tag,
                                    isOverdue && styles.tagOverdue,
                                    isTodayDue && styles.tagToday
                                ]}>
                                    <Calendar size={12} color={isOverdue ? '#EF4444' : isTodayDue ? '#F59E0B' : '#64748B'} />
                                    <Text style={[
                                        styles.tagText,
                                        isOverdue && { color: '#EF4444' },
                                        isTodayDue && { color: '#F59E0B' }
                                    ]}>
                                        {format(new Date(task.due_date), 'MMM d')}
                                    </Text>
                                </View>
                            )}

                            {/* Priority */}
                            <View style={styles.tag}>
                                <Flag size={12} color={priorityColor} />
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </RNAnimated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
    },
    actionLayer: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 16,
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
        backgroundColor: '#3B82F6',
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
        fontSize: 14,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        flexDirection: 'row',
        elevation: 2,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
    },
    touchable: {
        flex: 1,
        flexDirection: 'row',
    },
    priorityLine: {
        width: 4,
        height: '100%',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        flex: 1,
        marginRight: 12,
    },
    completedTitle: {
        textDecorationLine: 'line-through',
        color: '#94A3B8',
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    avatarText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    tagOverdue: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    tagToday: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    tagText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
});
