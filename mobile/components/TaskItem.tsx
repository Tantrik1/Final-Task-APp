import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Calendar } from 'lucide-react-native';
import { format } from 'date-fns';

interface Task {
    id: string;
    title: string;
    status: 'todo' | 'in_progress' | 'done' | 'backlog';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string | null;
    assignee?: {
        name: string;
        avatar_url?: string;
    } | null;
}

interface TaskItemProps {
    task: Task;
    onStatusChange?: (id: string, newStatus: string) => void;
}

export const TaskItem = ({ task, onStatusChange }: TaskItemProps) => {
    const router = useRouter();

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'done': return '#22C55E';
            case 'in_progress': return '#F97316';
            case 'todo': return '#64748B';
            default: return '#94A3B8';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return '#EF4444';
            case 'high': return '#F97316';
            case 'medium': return '#EAB308';
            default: return '#94A3B8';
        }
    };

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => router.push(`/task/${task.id}` as any)}
        >


            <View style={styles.content}>
                <Text style={[styles.title, task.status === 'done' && styles.titleComplete]} numberOfLines={1}>
                    {task.title}
                </Text>

                <View style={styles.metaRow}>
                    <View style={[styles.priorityBadge, { borderColor: getPriorityColor(task.priority) }]}>
                        <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                            {task.priority}
                        </Text>
                    </View>

                    {task.due_date && (
                        <View style={styles.dateBadge}>
                            <Calendar size={10} color="#64748B" />
                            <Text style={styles.dateText}>
                                {format(new Date(task.due_date), 'MMM d')}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {task.assignee && (
                <View style={styles.assigneeAvatar}>
                    {task.assignee.avatar_url ? (
                        <Image source={{ uri: task.assignee.avatar_url }} style={styles.avatarImage} />
                    ) : (
                        <Text style={styles.avatarText}>{task.assignee.name.charAt(0)}</Text>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        // Minimal shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
        elevation: 1,
    },

    content: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 4,
    },
    titleComplete: {
        textDecorationLine: 'line-through',
        color: '#94A3B8',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    priorityBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
    },
    priorityText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    dateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    dateText: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '500',
    },
    assigneeAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    avatarImage: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    avatarText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
});
