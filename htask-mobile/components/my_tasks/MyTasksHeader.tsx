import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Clock, Calendar, TrendingUp, CheckCircle2 } from 'lucide-react-native';

interface MyTasksHeaderProps {
    stats: {
        overdue: number;
        today: number;
        active: number;
        completed: number;
    };
}

export function MyTasksHeader({ stats }: MyTasksHeaderProps) {
    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.greeting}>My Tasks</Text>
                    <Text style={styles.subGreeting}>
                        {stats.today > 0
                            ? `You've got ${stats.today} tasks to crush today 💪`
                            : "All caught up for today! 🎉"}
                    </Text>
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.summaryRow}
            >
                {/* Overdue */}
                <View style={[styles.summaryCard, stats.overdue > 0 ? styles.cardOverdue : styles.cardGood]}>
                    <View style={styles.iconBox}>
                        <Clock size={16} color={stats.overdue > 0 ? '#EF4444' : '#10B981'} />
                    </View>
                    <View>
                        <Text style={[styles.count, stats.overdue > 0 && { color: '#EF4444' }]}>{stats.overdue}</Text>
                        <Text style={styles.label}>Overdue</Text>
                    </View>
                </View>

                {/* Due Today */}
                <View style={[styles.summaryCard, styles.cardToday]}>
                    <View style={styles.iconBox}>
                        <Calendar size={16} color="#F59E0B" />
                    </View>
                    <View>
                        <Text style={[styles.count, { color: '#F59E0B' }]}>{stats.today}</Text>
                        <Text style={styles.label}>Due Today</Text>
                    </View>
                </View>

                {/* Active */}
                <View style={[styles.summaryCard, styles.cardActive]}>
                    <View style={styles.iconBox}>
                        <TrendingUp size={16} color="#3B82F6" />
                    </View>
                    <View>
                        <Text style={[styles.count, { color: '#3B82F6' }]}>{stats.active}</Text>
                        <Text style={styles.label}>Active</Text>
                    </View>
                </View>

                {/* Completed */}
                <View style={[styles.summaryCard, styles.cardCompleted]}>
                    <View style={styles.iconBox}>
                        <CheckCircle2 size={16} color="#8B5CF6" />
                    </View>
                    <View>
                        <Text style={[styles.count, { color: '#8B5CF6' }]}>{stats.completed}</Text>
                        <Text style={styles.label}>Completed</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
        backgroundColor: '#F8FAFC',
    },
    headerRow: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    greeting: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0F172A',
    },
    subGreeting: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 4,
    },
    summaryRow: {
        paddingHorizontal: 20,
        gap: 12,
        paddingBottom: 8, // slight padding for shadow
    },
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        minWidth: 140,
        borderWidth: 1,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    cardOverdue: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    cardGood: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    cardToday: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
    },
    cardActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
    },
    cardCompleted: {
        backgroundColor: '#F5F3FF',
        borderColor: '#DDD6FE',
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    count: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
});
