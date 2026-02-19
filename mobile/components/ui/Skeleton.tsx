import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
    const { colors } = useTheme();
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    const opacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: colors.border,
                    opacity,
                },
                style,
            ]}
        />
    );
}

// ─── Circle skeleton (avatars) ───
export function SkeletonCircle({ size = 40, style }: { size?: number; style?: ViewStyle }) {
    return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
}

// ─── Pre-built skeleton layouts for common page patterns ───

export function DashboardSkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background }]}>
            {/* Stats row */}
            <View style={sk.row}>
                {[1, 2, 3].map(i => (
                    <View key={i} style={[sk.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Skeleton width={36} height={36} borderRadius={12} />
                        <Skeleton width="60%" height={20} style={{ marginTop: 10 }} />
                        <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
                    </View>
                ))}
            </View>
            {/* Chart placeholder */}
            <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Skeleton width="50%" height={16} />
                <Skeleton width="100%" height={140} borderRadius={12} style={{ marginTop: 12 }} />
            </View>
            {/* Activity list */}
            <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Skeleton width="40%" height={16} />
                {[1, 2, 3, 4].map(i => (
                    <View key={i} style={sk.listItem}>
                        <SkeletonCircle size={36} />
                        <View style={{ flex: 1, gap: 6 }}>
                            <Skeleton width="70%" height={14} />
                            <Skeleton width="50%" height={11} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

export function ProjectsSkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background }]}>
            {/* Search bar */}
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <Skeleton width="100%" height={44} borderRadius={12} />
            </View>
            {/* Project cards */}
            {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={[sk.projectCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={sk.rowBetween}>
                        <View style={{ flex: 1, gap: 8 }}>
                            <Skeleton width="65%" height={16} />
                            <Skeleton width="40%" height={12} />
                        </View>
                        <Skeleton width={48} height={48} borderRadius={14} />
                    </View>
                    <View style={[sk.row, { marginTop: 12, gap: 8 }]}>
                        <Skeleton width={60} height={24} borderRadius={12} />
                        <Skeleton width={80} height={24} borderRadius={12} />
                        <Skeleton width={50} height={24} borderRadius={12} />
                    </View>
                </View>
            ))}
        </View>
    );
}

export function TasksSkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background }]}>
            {/* Header stats */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <Skeleton width="50%" height={22} />
                <Skeleton width="70%" height={13} style={{ marginTop: 6 }} />
                <View style={[sk.row, { marginTop: 12, gap: 10 }]}>
                    {[1, 2, 3, 4].map(i => (
                        <View key={i} style={[sk.miniCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Skeleton width={28} height={28} borderRadius={10} />
                            <Skeleton width={24} height={18} style={{ marginTop: 6 }} />
                            <Skeleton width={40} height={10} style={{ marginTop: 4 }} />
                        </View>
                    ))}
                </View>
            </View>
            {/* Filter bar */}
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <Skeleton width="100%" height={40} borderRadius={12} />
                <View style={[sk.row, { marginTop: 10, gap: 8 }]}>
                    {[1, 2, 3].map(i => <Skeleton key={i} width={80} height={30} borderRadius={20} />)}
                </View>
            </View>
            {/* Task cards */}
            {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={[sk.taskCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Skeleton width={3} height={52} borderRadius={2} style={{ position: 'absolute', left: 0, top: 0 }} />
                    <View style={{ flex: 1, paddingLeft: 12, gap: 8 }}>
                        <Skeleton width="75%" height={15} />
                        <View style={[sk.row, { gap: 8 }]}>
                            <Skeleton width={70} height={22} borderRadius={6} />
                            <Skeleton width={60} height={22} borderRadius={6} />
                            <Skeleton width={24} height={22} borderRadius={6} />
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
}

export function CalendarSkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background }]}>
            {/* Toggle */}
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <Skeleton width={200} height={36} borderRadius={10} />
            </View>
            {/* Calendar grid */}
            <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={sk.rowBetween}>
                    <Skeleton width={24} height={24} borderRadius={8} />
                    <Skeleton width={140} height={18} />
                    <Skeleton width={24} height={24} borderRadius={8} />
                </View>
                <View style={[sk.row, { marginTop: 16, justifyContent: 'space-between' }]}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((_, i) => (
                        <Skeleton key={i} width={32} height={12} borderRadius={4} />
                    ))}
                </View>
                {[1, 2, 3, 4, 5].map(row => (
                    <View key={row} style={[sk.row, { marginTop: 10, justifyContent: 'space-between' }]}>
                        {[1, 2, 3, 4, 5, 6, 7].map(col => (
                            <Skeleton key={col} width={32} height={32} borderRadius={16} />
                        ))}
                    </View>
                ))}
            </View>
            {/* Selected day tasks */}
            <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
                <Skeleton width="40%" height={16} />
                {[1, 2].map(i => (
                    <View key={i} style={[sk.taskCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
                        <Skeleton width={8} height={8} borderRadius={4} />
                        <Skeleton width="60%" height={14} />
                        <Skeleton width={50} height={20} borderRadius={6} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function ChatSkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background }]}>
            {/* Tabs */}
            <View style={[sk.row, { paddingHorizontal: 20, gap: 12, marginBottom: 16 }]}>
                <Skeleton width={100} height={36} borderRadius={10} />
                <Skeleton width={100} height={36} borderRadius={10} />
            </View>
            {/* Channel list */}
            {[1, 2, 3, 4, 5, 6].map(i => (
                <View key={i} style={[sk.chatRow, { borderBottomColor: colors.border }]}>
                    <Skeleton width={44} height={44} borderRadius={14} />
                    <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="55%" height={15} />
                        <Skeleton width="80%" height={12} />
                    </View>
                    <Skeleton width={36} height={12} />
                </View>
            ))}
        </View>
    );
}

export function MembersSkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background }]}>
            {/* Summary */}
            <View style={[sk.summaryBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Skeleton width={40} height={22} />
                <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
            </View>
            {/* Search */}
            <View style={{ padding: 16 }}>
                <Skeleton width="100%" height={44} borderRadius={12} />
                <View style={[sk.row, { marginTop: 12, gap: 8 }]}>
                    {[1, 2, 3].map(i => <Skeleton key={i} width={70} height={30} borderRadius={20} />)}
                </View>
            </View>
            {/* Members */}
            {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={[sk.memberRow, { backgroundColor: colors.card }]}>
                    <SkeletonCircle size={44} />
                    <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="50%" height={15} />
                        <Skeleton width="70%" height={12} />
                    </View>
                    <Skeleton width={56} height={24} borderRadius={8} />
                </View>
            ))}
        </View>
    );
}

export function ProfileSkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background, paddingHorizontal: 20 }]}>
            {/* Avatar card */}
            <View style={[sk.profileCard, { backgroundColor: colors.card }]}>
                <SkeletonCircle size={88} style={{ marginBottom: 16 }} />
                <Skeleton width="50%" height={20} />
                <Skeleton width="60%" height={14} style={{ marginTop: 6 }} />
                <View style={[sk.row, { marginTop: 16, gap: 8 }]}>
                    <Skeleton width={80} height={28} borderRadius={14} />
                    <Skeleton width={100} height={28} borderRadius={14} />
                </View>
                <View style={[sk.row, { marginTop: 20, width: '100%', justifyContent: 'space-around' }]}>
                    {[1, 2, 3].map(i => (
                        <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                            <Skeleton width={36} height={22} />
                            <Skeleton width={50} height={10} />
                        </View>
                    ))}
                </View>
            </View>
            {/* Form */}
            <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 20 }]}>
                <Skeleton width="40%" height={16} />
                {[1, 2, 3].map(i => (
                    <View key={i} style={{ marginTop: 16 }}>
                        <Skeleton width="30%" height={12} />
                        <Skeleton width="100%" height={44} borderRadius={12} style={{ marginTop: 8 }} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function ActivitySkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background }]}>
            {/* Filter bar */}
            <View style={[sk.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Skeleton width="80%" height={40} borderRadius={12} />
                <View style={[sk.row, { marginTop: 10, gap: 8 }]}>
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} width={72} height={30} borderRadius={20} />)}
                </View>
            </View>
            {/* Activity rows */}
            <View style={{ padding: 16 }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <View key={i} style={[sk.activityRow, { backgroundColor: colors.card }]}>
                        <Skeleton width={36} height={36} borderRadius={12} />
                        <View style={{ flex: 1, gap: 6 }}>
                            <View style={sk.rowBetween}>
                                <Skeleton width="40%" height={14} />
                                <Skeleton width={60} height={11} />
                            </View>
                            <Skeleton width="85%" height={12} />
                            <Skeleton width={80} height={20} borderRadius={6} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

export function ProjectDetailSkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background }]}>
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
                <Skeleton width="60%" height={22} />
                <Skeleton width="40%" height={14} />
                <View style={[sk.row, { gap: 8, marginTop: 8 }]}>
                    {[1, 2, 3].map(i => <Skeleton key={i} width={80} height={32} borderRadius={10} />)}
                </View>
            </View>
            {/* Task list */}
            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <View key={i} style={[sk.taskCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <SkeletonCircle size={20} />
                        <Skeleton width="65%" height={14} />
                        <Skeleton width={50} height={20} borderRadius={6} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function TaskDetailSkeleton() {
    const { colors } = useTheme();
    return (
        <View style={[sk.container, { backgroundColor: colors.background, paddingHorizontal: 20 }]}>
            <Skeleton width="70%" height={24} style={{ marginTop: 12 }} />
            <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
            {/* Bubbles */}
            <View style={[sk.row, { marginTop: 16, gap: 8 }]}>
                <Skeleton width={90} height={32} borderRadius={16} />
                <Skeleton width={110} height={32} borderRadius={16} />
                <Skeleton width={80} height={32} borderRadius={16} />
            </View>
            {/* Tabs */}
            <View style={[sk.row, { marginTop: 20, gap: 16 }]}>
                {[1, 2, 3, 4].map(i => <Skeleton key={i} width={60} height={28} borderRadius={8} />)}
            </View>
            {/* Content */}
            <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                <Skeleton width="30%" height={14} />
                <Skeleton width="100%" height={80} borderRadius={10} style={{ marginTop: 10 }} />
                <Skeleton width="50%" height={14} style={{ marginTop: 16 }} />
                <Skeleton width="100%" height={44} borderRadius={10} style={{ marginTop: 8 }} />
            </View>
        </View>
    );
}

const sk = StyleSheet.create({
    container: { flex: 1, paddingTop: 16 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    card: { marginHorizontal: 20, padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 16, gap: 4 },
    statCard: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, marginHorizontal: 4, alignItems: 'center' },
    miniCard: { flex: 1, padding: 10, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
    projectCard: { marginHorizontal: 20, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
    taskCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
    listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
    chatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
    summaryBar: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, padding: 12, borderRadius: 16, marginBottom: 8 },
    profileCard: { alignItems: 'center', padding: 24, borderRadius: 24, marginTop: 40 },
    filterBar: { padding: 16, borderBottomWidth: 1, gap: 4 },
    activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 14, marginBottom: 8 },
});
