import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Dimensions,
    Image,
    Platform,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ChevronLeft,
    MessageSquare,
    FolderKanban,
    Building2,
    Bell,
    CheckCircle2,
    Clock,
    Users,
    Zap,
} from 'lucide-react-native';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { useNotifications, Notification, getNotificationDeepLink } from '@/hooks/useNotifications';
import { ActivityItem, ActivityLog } from '@/components/ActivityItem';

const { width } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────

const getNotificationStyle = (type: string, entityType: string) => {
    // Task: Orange/Amber (Action/Item)
    if (entityType === 'task' || type.startsWith('task_')) {
        return { icon: CheckCircle2, bg: '#F97316', color: '#FFFFFF' };
    }
    // Project: Purple (Container)
    if (entityType === 'project' || type.startsWith('project_')) {
        return { icon: FolderKanban, bg: '#8B5CF6', color: '#FFFFFF' };
    }
    // Communication: Blue
    if (entityType === 'comment' || entityType === 'chat' || type.startsWith('comment_') || type.startsWith('chat_')) {
        return { icon: MessageSquare, bg: '#3B82F6', color: '#FFFFFF' };
    }
    // Workspace/Member: Indigo/Slate
    if (entityType === 'workspace' || entityType === 'member' || type === 'role_changed' || type === 'workspace_invite_accepted') {
        return { icon: Users, bg: '#6366F1', color: '#FFFFFF' }; // Users icon typically better for members
    }
    // Default
    return { icon: Bell, bg: '#94A3B8', color: '#FFFFFF' };
};

const getNotificationCategory = (type: string, entityType: string): string => {
    if (entityType === 'task' || entityType === 'project' || type.startsWith('task_') || type.startsWith('project_')) return 'projects';
    if (entityType === 'chat' || entityType === 'comment' || type.startsWith('chat_') || type.startsWith('comment_')) return 'chat';
    if (entityType === 'workspace' || entityType === 'member' || type === 'role_changed' || type === 'workspace_invite_accepted') return 'workspace';
    return 'all';
};

function formatTime(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        if (isToday(date)) return formatDistanceToNow(date, { addSuffix: true });
        if (isYesterday(date)) return 'Yesterday, ' + format(date, 'h:mm a');
        return format(date, 'MMM d, h:mm a');
    } catch {
        return '';
    }
}

// ─── Notification Item ──────────────────────────────────────

const NotificationItem = ({ item, onRead }: { item: Notification; onRead: (id: string) => void }) => {
    const router = useRouter();

    const handlePress = () => {
        if (!item.is_read) {
            onRead(item.id);
        }
        const path = getNotificationDeepLink(item);
        if (path) {
            try {
                router.push(path as any);
            } catch (e) {
                console.warn("Navigation failed", e);
                router.push('/(tabs)');
            }
        }
    };

    const timeAgo = useMemo(() => formatTime(item.created_at), [item.created_at]);
    const { icon: Icon, bg, color } = getNotificationStyle(item.type, item.entity_type);

    return (
        <TouchableOpacity
            style={[styles.itemContainer, !item.is_read && styles.itemUnread]}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <View style={styles.itemLeft}>
                <View style={styles.avatarContainer}>
                    {item.actor?.avatar_url ? (
                        <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: item.is_read ? '#F1F5F9' : '#FFF7ED' }]}>
                            <Text style={[styles.avatarInitials, { color: item.is_read ? '#64748B' : '#F97316' }]}>
                                {item.actor?.full_name?.charAt(0) || item.actor?.email?.charAt(0) || '?'}
                            </Text>
                        </View>
                    )}
                    {/* Premium Badge: Solid Bg + White Icon */}
                    <View style={[styles.iconBadge, { backgroundColor: bg }]}>
                        <Icon size={10} color={color} strokeWidth={3} />
                    </View>
                </View>
            </View>

            <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                    <Text style={[styles.itemTitle, !item.is_read && styles.itemTitleUnread]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={styles.itemTime}>{timeAgo}</Text>
                </View>
                <Text style={[styles.itemMessage, !item.is_read && styles.itemMessageUnread]} numberOfLines={2}>
                    {item.body}
                </Text>
            </View>

            {!item.is_read && <View style={styles.readIndicator} />}
        </TouchableOpacity>
    );
};

// ─── Date Group Header ──────────────────────────────────────

const DateGroupHeader = ({ dateStr }: { dateStr: string }) => {
    const date = new Date(dateStr);
    let label = '';
    if (isToday(date)) label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    else label = format(date, 'EEEE, MMM d');

    return (
        <View style={styles.dateGroupHeader}>
            <Text style={styles.dateGroupText}>{label}</Text>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════

export default function NotificationsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState(0);
    const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');

    const {
        notifications,
        isLoading,
        markAsRead,
        markAllAsRead,
        fetchNotifications,
        fetchProjectActivity,
        loadOlderNotifications,
        hasMore,
        isLoadingMore,
    } = useNotifications();

    const [projectActivities, setProjectActivities] = useState<ActivityLog[]>([]);
    const [isProjectLoading, setIsProjectLoading] = useState(false);

    const tabs = ['All', 'Projects', 'Chat', 'Workspace'];

    // Load project activities eagerly on mount (needed for All tab too)
    useEffect(() => {
        loadProjectActivity();
    }, []);

    // Also reload when Projects tab is selected
    useEffect(() => {
        if (activeTab === 1) {
            loadProjectActivity();
        }
    }, [activeTab]);

    const loadProjectActivity = async () => {
        setIsProjectLoading(true);
        const data = await fetchProjectActivity();
        setProjectActivities(data);
        setIsProjectLoading(false);
    };

    // ─── ALL Tab: Merge notifications + activity logs ──────────
    // Unified item type for the All tab
    type UnifiedItem = {
        id: string;
        created_at: string;
        kind: 'notification' | 'activity';
        notification?: Notification;
        activity?: ActivityLog;
    };

    const allItems = useMemo<UnifiedItem[]>(() => {
        const notifItems: UnifiedItem[] = notifications.map(n => ({
            id: `n-${n.id}`,
            created_at: n.created_at,
            kind: 'notification' as const,
            notification: n,
        }));

        // Convert activity logs to unified items
        // Deduplicate: skip activity logs that have a matching notification (same entity)
        const notifEntityIds = new Set(notifications.map(n => n.entity_id));
        const activityItems: UnifiedItem[] = projectActivities
            .filter(a => !notifEntityIds.has(a.id)) // Don't duplicate if there's already a notification
            .map(a => ({
                id: `a-${a.id}`,
                created_at: a.created_at,
                kind: 'activity' as const,
                activity: a,
            }));

        // Merge and sort by time descending
        return [...notifItems, ...activityItems]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [notifications, projectActivities]);

    // ─── Filtered notifications for Chat/Workspace tabs ──────

    const filteredNotifications = useMemo(() => {
        return tabs.map((tab, index) => {
            let baseList = notifications;

            // 1. Filter by Status
            if (statusFilter === 'unread') {
                baseList = baseList.filter(n => !n.is_read);
            } else if (statusFilter === 'read') {
                baseList = baseList.filter(n => n.is_read);
            }

            // 2. Filter by Category (Tab)
            if (index === 0) return []; // All uses allItems (unified)
            if (index === 1) return []; // Projects uses separate list

            return baseList.filter(n => {
                const category = getNotificationCategory(n.type, n.entity_type);
                return category === tab.toLowerCase();
            });
        });
    }, [notifications, statusFilter]);

    // Update `allItems` to respect status filter
    const filteredUnifiedItems = useMemo(() => {
        let items = allItems;
        if (statusFilter === 'unread') {
            // Only show unread notifications. Activities don't have read status, so exclude them.
            items = items.filter(i => i.kind === 'notification' ? !i.notification!.is_read : false);
        } else if (statusFilter === 'read') {
            items = items.filter(i => i.kind === 'notification' ? i.notification!.is_read : true);
        }
        return items;
    }, [allItems, statusFilter]);

    // ─── Group items by date ──────────

    const groupByDate = useCallback((items: any[]) => {
        const groups: { title: string; data: any[] }[] = [];
        let currentDateKey = '';

        items.forEach(item => {
            const dateKey = format(new Date(item.created_at), 'yyyy-MM-dd');
            if (dateKey !== currentDateKey) {
                groups.push({ title: dateKey, data: [item] });
                currentDateKey = dateKey;
            } else {
                groups[groups.length - 1].data.push(item);
            }
        });

        return groups;
    }, []);

    const handleTabPress = (index: number) => {
        setActiveTab(index);
    };

    const renderHeader = () => (
        <>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                {/* Improved Mark all as read button visibility */}
                <TouchableOpacity
                    onPress={() => markAllAsRead()}
                    style={styles.markReadButton}
                >
                    <CheckCircle2 size={16} color="#F97316" />
                    <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
            </View>

            {/* Status Filters (Seen / Unseen) */}
            <View style={styles.statusFilterContainer}>
                {(['all', 'unread', 'read'] as const).map((filter) => (
                    <TouchableOpacity
                        key={filter}
                        style={[styles.statusChip, statusFilter === filter && styles.activeStatusChip]}
                        onPress={() => setStatusFilter(filter)}
                    >
                        <Text style={[styles.statusChipText, statusFilter === filter && styles.activeStatusChipText]}>
                            {filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : 'Read'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Category Tabs */}
            <View style={styles.tabsContainer}>
                {tabs.map((tab, index) => {
                    const isActive = activeTab === index;
                    const icon = index === 0 ? Bell : index === 1 ? FolderKanban : index === 2 ? MessageSquare : Building2;
                    const Icon = icon;
                    return (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, isActive && styles.activeTab]}
                            onPress={() => handleTabPress(index)}
                        >
                            <Icon size={14} color={isActive ? '#F97316' : '#94A3B8'} />
                            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </>
    );

    // ─── Render Project Activity Tab ──────────

    const renderProjectsTab = () => {
        if (isProjectLoading && projectActivities.length === 0) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F97316" />
                </View>
            );
        }

        return (
            <FlatList
                data={projectActivities}
                keyExtractor={(item) => item.id}
                renderItem={({ item: activity, index }) => {
                    const prevDate = index > 0 ? format(new Date(projectActivities[index - 1].created_at), 'yyyy-MM-dd') : '';
                    const curDate = format(new Date(activity.created_at), 'yyyy-MM-dd');
                    const showDate = curDate !== prevDate;

                    return (
                        <View style={{ paddingHorizontal: 16 }}>
                            {showDate && <DateGroupHeader dateStr={activity.created_at} />}
                            <ActivityItem
                                activity={activity}
                                isLast={index === projectActivities.length - 1}
                                onPress={activity.task_id ? () => router.push(`/task/${activity.task_id}` as any) : undefined}
                            />
                        </View>
                    );
                }}
                contentContainerStyle={styles.listContent}
                refreshing={isProjectLoading}
                onRefresh={loadProjectActivity}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <FolderKanban size={48} color="#CBD5E1" />
                        <Text style={styles.emptyStateText}>No project activity</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Recent updates to projects and tasks will appear here.
                        </Text>
                    </View>
                }
            />
        );
    };

    // ─── Render All Tab (Unified: Notifications + Activities) ──────────

    const renderAllTab = () => {
        const loading = isLoading && notifications.length === 0;
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F97316" />
                </View>
            );
        }

        return (
            <FlatList
                data={filteredUnifiedItems} // Use filtered items
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => {
                    const prevDate = index > 0 ? format(new Date(filteredUnifiedItems[index - 1].created_at), 'yyyy-MM-dd') : '';
                    const curDate = format(new Date(item.created_at), 'yyyy-MM-dd');
                    const showDate = curDate !== prevDate;

                    if (item.kind === 'activity' && item.activity) {
                        return (
                            <View style={{ paddingHorizontal: 16 }}>
                                {showDate && <DateGroupHeader dateStr={item.created_at} />}
                                <ActivityItem
                                    activity={item.activity}
                                    isLast={index === filteredUnifiedItems.length - 1}
                                    onPress={item.activity.task_id ? () => router.push(`/task/${item.activity!.task_id}` as any) : undefined}
                                />
                            </View>
                        );
                    }

                    if (item.kind === 'notification' && item.notification) {
                        return (
                            <>
                                {showDate && <DateGroupHeader dateStr={item.created_at} />}
                                <NotificationItem item={item.notification} onRead={markAsRead} />
                            </>
                        );
                    }

                    return null;
                }}
                contentContainerStyle={styles.listContent}
                refreshing={isLoading}
                onRefresh={() => { fetchNotifications(); loadProjectActivity(); }}
                ListFooterComponent={
                    <View style={{ padding: 16, paddingBottom: 32 }}>
                        {isLoadingMore ? (
                            <ActivityIndicator color="#F97316" />
                        ) : hasMore ? (
                            <TouchableOpacity
                                style={{
                                    padding: 12,
                                    backgroundColor: '#FFF7ED',
                                    borderRadius: 8,
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: '#FED7AA'
                                }}
                                onPress={loadOlderNotifications}
                            >
                                <Text style={{ color: '#F97316', fontWeight: '600' }}>Load Older Notifications</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No more older notifications</Text>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Bell size={48} color="#CBD5E1" />
                        <Text style={styles.emptyStateText}>No notifications</Text>
                        <Text style={styles.emptyStateSubtext}>
                            You&apos;re all caught up! 🎉
                        </Text>
                    </View>
                }
            />
        );
    };

    // ─── Render Notification List Tab ──────────

    const renderNotificationsTab = (data: Notification[]) => {
        return (
            <FlatList
                data={data}
                keyExtractor={(n) => n.id}
                renderItem={({ item, index }) => {
                    // Date grouping
                    const prevDate = index > 0 ? format(new Date(data[index - 1].created_at), 'yyyy-MM-dd') : '';
                    const curDate = format(new Date(item.created_at), 'yyyy-MM-dd');
                    const showDate = curDate !== prevDate;

                    return (
                        <>
                            {showDate && <DateGroupHeader dateStr={item.created_at} />}
                            <NotificationItem item={item} onRead={markAsRead} />
                        </>
                    );
                }}
                contentContainerStyle={styles.listContent}
                refreshing={isLoading}
                onRefresh={fetchNotifications}
                ListFooterComponent={
                    <View style={{ padding: 16, paddingBottom: 32 }}>
                        {isLoadingMore ? (
                            <ActivityIndicator color="#F97316" />
                        ) : hasMore ? (
                            <TouchableOpacity
                                style={{
                                    padding: 12,
                                    backgroundColor: '#FFF7ED',
                                    borderRadius: 8,
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: '#FED7AA'
                                }}
                                onPress={loadOlderNotifications}
                            >
                                <Text style={{ color: '#F97316', fontWeight: '600' }}>Load Older Notifications</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No more older notifications</Text>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Bell size={48} color="#CBD5E1" />
                        <Text style={styles.emptyStateText}>No notifications</Text>
                        <Text style={styles.emptyStateSubtext}>
                            You&apos;re all caught up! 🎉
                        </Text>
                    </View>
                }
            />
        );
    };

    // ─── Active Tab Content ──────────

    const renderActiveTab = () => {
        if (activeTab === 0) return renderAllTab();
        if (activeTab === 1) return renderProjectsTab();
        const data = filteredNotifications[activeTab];
        return renderNotificationsTab(data);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />
            {renderHeader()}

            {isLoading && notifications.length === 0 && activeTab !== 1 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F97316" />
                </View>
            ) : (
                renderActiveTab()
            )}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    markReadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#FFF7ED',
        borderRadius: 16,
    },
    markReadText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F97316',
    },
    statusFilterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
        backgroundColor: '#FFFFFF',
        gap: 8,
    },
    statusChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
    },
    activeStatusChip: {
        backgroundColor: '#0F172A',
    },
    statusChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    activeStatusChipText: {
        color: '#FFFFFF',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    activeTab: {
        backgroundColor: '#FFF7ED',
        borderColor: '#F97316',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    activeTabText: {
        color: '#F97316',
    },
    listContent: {
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Date Group
    dateGroupHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    dateGroupText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Notification Item
    itemContainer: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#FFFFFF',
        alignItems: 'flex-start',
    },
    itemUnread: {
        backgroundColor: '#FFFCFA',
    },
    itemLeft: {
        marginRight: 12,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#E2E8F0',
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        fontSize: 17,
        fontWeight: '700',
    },
    iconBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        borderRadius: 9, // Half of 18
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF', // Creates the "cutout" effect from avatar
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 },
            android: { elevation: 3 },
        }),
    },
    itemContent: {
        flex: 1,
        gap: 3,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        flex: 1,
        marginRight: 8,
    },
    itemTitleUnread: {
        color: '#0F172A',
        fontWeight: '700',
    },
    itemTime: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500',
    },
    itemMessage: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 19,
    },
    itemMessageUnread: {
        color: '#334155',
        fontWeight: '500',
    },
    readIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F97316',
        marginTop: 6,
        marginLeft: 8,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: 40,
    },
    emptyStateText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '700',
        color: '#334155',
    },
    emptyStateSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
    },
});
