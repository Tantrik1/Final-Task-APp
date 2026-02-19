import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface MyTasksHeaderProps {
    stats: {
        overdue: number;
        today: number;
        active: number;
        completed: number;
    };
}

const STAT_CARDS = [
    { key: 'overdue',   label: 'Overdue',  accentLight: '#EF4444', accentDark: '#F87171', bgLight: '#FEF2F2', bgDark: '#1C1111' },
    { key: 'today',     label: 'Today',    accentLight: '#F59E0B', accentDark: '#FBBF24', bgLight: '#FFFBEB', bgDark: '#1C1708' },
    { key: 'active',    label: 'Active',   accentLight: '#3B82F6', accentDark: '#60A5FA', bgLight: '#EFF6FF', bgDark: '#0C1524' },
    { key: 'completed', label: 'Done 7d',  accentLight: '#22C55E', accentDark: '#4ADE80', bgLight: '#F0FDF4', bgDark: '#0C1A12' },
] as const;

export function MyTasksHeader({ stats }: MyTasksHeaderProps) {
    const { colors, colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';

    const values: Record<string, number> = {
        overdue: stats.overdue,
        today: stats.today,
        active: stats.active,
        completed: stats.completed,
    };

    return (
        <View style={[st.container, { backgroundColor: colors.background }]}>
            {/* Title */}
            <View style={st.titleRow}>
                <Text style={[st.title, { color: colors.text }]}>My Tasks</Text>
                <Text style={[st.subtitle, { color: colors.textSecondary }]}>
                    {stats.overdue > 0
                        ? `${stats.overdue} task${stats.overdue > 1 ? 's' : ''} need attention`
                        : stats.today > 0
                        ? `${stats.today} due today`
                        : 'All caught up!'}
                </Text>
            </View>

            {/* 4 stat cards in 1 row */}
            <View style={st.statsRow}>
                {STAT_CARDS.map((card) => {
                    const accent = isDark ? card.accentDark : card.accentLight;
                    const bg = isDark ? card.bgDark : card.bgLight;
                    return (
                        <View key={card.key} style={[st.stat, { backgroundColor: bg }]}>
                            <Text style={[st.statNum, { color: accent }]}>
                                {values[card.key]}
                            </Text>
                            <Text style={[st.statLabel, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]} numberOfLines={1}>
                                {card.label}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const st = StyleSheet.create({
    container: {
        paddingTop: 14,
        paddingBottom: 6,
    },
    titleRow: {
        paddingHorizontal: 20,
        marginBottom: 14,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 8,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    statNum: {
        fontSize: 22,
        fontWeight: '900',
        lineHeight: 26,
        letterSpacing: -0.5,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
});
