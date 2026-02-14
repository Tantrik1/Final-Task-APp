import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
    Clock,
    MessageCircle,
    Paperclip,
    Link2,
    UserPlus,
    UserMinus,
    CheckCircle2,
    PlayCircle,
    PauseCircle,
    PlusCircle,
    Activity,
    Trash2,
    Edit2,
    ArrowRight,
    Archive,
    RotateCcw,
    FolderKanban,
    Building2,
    Crown,
    Shield,
    MessageSquare,
    ListPlus,
    ListMinus,
    ArrowUpDown,
    Pencil,
} from 'lucide-react-native';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';

export interface ActivityLog {
    id: string;
    action_type: string;
    entity_type: string;
    description: string;
    created_at: string;
    metadata: any;
    task_id?: string;
    project_id?: string;
    actor_id?: string;
    actor: {
        full_name: string;
        email: string;
        avatar_url?: string;
    } | null;
}

interface ActivityItemProps {
    activity: ActivityLog;
    isLast: boolean;
    onPress?: () => void;
}

const getActivityIcon = (type: string, entityType: string) => {
    switch (type) {
        // Task
        case 'create':
            if (entityType === 'project') return { icon: FolderKanban, color: '#8B5CF6', bg: '#F5F3FF' };
            return { icon: PlusCircle, color: '#3B82F6', bg: '#EFF6FF' };
        case 'update':
            if (entityType === 'workspace') return { icon: Building2, color: '#6366F1', bg: '#EEF2FF' };
            if (entityType === 'task') return { icon: Edit2, color: '#F59E0B', bg: '#FFFBEB' };
            return { icon: Edit2, color: '#64748B', bg: '#F1F5F9' };
        case 'delete':
        case 'delete_file':
        case 'remove_link':
        case 'delete_comment':
            return { icon: Trash2, color: '#EF4444', bg: '#FEF2F2' };
        case 'archive': return { icon: Archive, color: '#64748B', bg: '#F1F5F9' };
        case 'restore': return { icon: RotateCcw, color: '#22C55E', bg: '#F0FDF4' };
        case 'move': return { icon: ArrowRight, color: '#8B5CF6', bg: '#F5F3FF' };
        case 'rename': return { icon: Pencil, color: '#F97316', bg: '#FFF7ED' };

        // Comments
        case 'comment': return { icon: MessageCircle, color: '#6366F1', bg: '#EEF2FF' };
        case 'comment_reply': return { icon: MessageSquare, color: '#06B6D4', bg: '#ECFEFF' };
        case 'edit_comment': return { icon: Edit2, color: '#64748B', bg: '#F1F5F9' };

        // Files & Links
        case 'upload': return { icon: Paperclip, color: '#F97316', bg: '#FFF7ED' };
        case 'add_link': return { icon: Link2, color: '#3B82F6', bg: '#EFF6FF' };

        // Assignee
        case 'assign': return { icon: UserPlus, color: '#14B8A6', bg: '#F0FDFA' };
        case 'unassign': return { icon: UserMinus, color: '#94A3B8', bg: '#F8FAFC' };

        // Timer
        case 'timer_start':
        case 'timer_resume': return { icon: PlayCircle, color: '#22C55E', bg: '#F0FDF4' };
        case 'timer_pause': return { icon: PauseCircle, color: '#F59E0B', bg: '#FFFBEB' };

        // Members
        case 'join': return { icon: UserPlus, color: '#22C55E', bg: '#F0FDF4' };
        case 'remove_member': return { icon: UserMinus, color: '#EF4444', bg: '#FEF2F2' };
        case 'update_role': return { icon: Shield, color: '#8B5CF6', bg: '#F5F3FF' };

        // Project Statuses
        case 'add_status': return { icon: ListPlus, color: '#3B82F6', bg: '#EFF6FF' };
        case 'rename_status': return { icon: Pencil, color: '#F97316', bg: '#FFF7ED' };
        case 'delete_status': return { icon: ListMinus, color: '#EF4444', bg: '#FEF2F2' };
        case 'reorder_status': return { icon: ArrowUpDown, color: '#64748B', bg: '#F1F5F9' };

        default: return { icon: Activity, color: '#64748B', bg: '#F1F5F9' };
    }
};

export function ActivityItem({ activity, isLast, onPress }: ActivityItemProps) {
    const { icon: IconComponent, color, bg } = getActivityIcon(activity.action_type, activity.entity_type);
    const actorName = activity.actor?.full_name || activity.actor?.email?.split('@')[0] || '';

    const Wrapper = onPress ? TouchableOpacity : View;

    return (
        <Wrapper style={styles.timelineItem} onPress={onPress} activeOpacity={0.7}>
            {/* Timeline line connector */}
            {!isLast && <View style={styles.timelineLine} />}

            {/* Icon or Avatar */}
            <View style={styles.iconCol}>
                {activity.actor?.avatar_url ? (
                    <View style={[styles.avatarWrap, { borderColor: bg }]}>
                        <Image source={{ uri: activity.actor.avatar_url }} style={styles.avatarImg} />
                        <View style={[styles.miniIcon, { backgroundColor: bg }]}>
                            <IconComponent size={10} color={color} />
                        </View>
                    </View>
                ) : (
                    <View style={[styles.timelineIcon, { backgroundColor: bg }]}>
                        <IconComponent size={14} color={color} />
                    </View>
                )}
            </View>

            {/* Content */}
            <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{activity.description}</Text>
                <View style={styles.metaRow}>
                    <Text style={styles.timelineTime}>
                        {formatActivityTime(activity.created_at)}
                    </Text>
                    {activity.metadata?.field && (
                        <View style={styles.fieldBadge}>
                            <Text style={styles.fieldBadgeText}>{formatFieldName(activity.metadata.field)}</Text>
                        </View>
                    )}
                </View>
            </View>
        </Wrapper>
    );
}

function formatActivityTime(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        if (isToday(date)) return formatDistanceToNow(date, { addSuffix: true });
        if (isYesterday(date)) return 'Yesterday, ' + format(date, 'h:mm a');
        return format(date, 'MMM d, h:mm a');
    } catch {
        return '';
    }
}

function formatFieldName(field: string): string {
    switch (field) {
        case 'status': return '📊 Status';
        case 'priority': return '🔥 Priority';
        case 'due_date': return '📅 Due Date';
        case 'title': return '✏️ Title';
        case 'description': return '📝 Description';
        case 'assigned_to': return '👤 Assignee';
        case 'project_id': return '📁 Project';
        case 'name': return '✏️ Name';
        case 'logo_url': return '🖼️ Logo';
        case 'color': return '🎨 Color';
        default: return field;
    }
}

const styles = StyleSheet.create({
    timelineItem: {
        flexDirection: 'row',
        gap: 12,
        paddingBottom: 20,
        position: 'relative',
    },
    timelineLine: {
        position: 'absolute',
        left: 15,
        top: 34,
        bottom: 0,
        width: 2,
        backgroundColor: '#F1F5F9',
    },
    iconCol: {
        zIndex: 1,
    },
    timelineIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 2,
        position: 'relative',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    miniIcon: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    timelineContent: {
        flex: 1,
        paddingTop: 2,
    },
    timelineTitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#1E293B',
        lineHeight: 20,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2,
    },
    timelineTime: {
        fontSize: 11,
        color: '#94A3B8',
    },
    fieldBadge: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    fieldBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
    },
});
