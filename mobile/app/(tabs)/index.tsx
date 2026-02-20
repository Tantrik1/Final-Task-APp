import React, { useRef, useCallback, useMemo } from 'react';
import { ActiveTimerBanner } from '@/components/ActiveTimerBanner';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    StyleSheet,
    Dimensions,
    Platform,
    Image,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useDashboardData, ActivityItem, Task } from '@/hooks/useDashboardData';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTheme } from '@/contexts/ThemeContext';
import {
    FolderKanban,
    CheckSquare,
    Users,
    TrendingUp,
    Clock,
    Calendar,
    AlertCircle,
    Zap,
    Target,
    Timer,
    MessageCircle,
    ChevronRight,
    AlertTriangle,
    CheckCircle2,
    ListTodo,
    Sparkles,
    CreditCard,
    BarChart3,
    CircleDot,
} from 'lucide-react-native';
import { formatDistanceToNow, format, isToday, isTomorrow, isPast } from 'date-fns';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

const { width } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const s = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

    // Loading
    loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, fontWeight: '500' },

    // Hero
    heroSection: { marginBottom: 20, paddingVertical: 4 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    heroGreeting: {
        fontSize: 24, fontWeight: '800', marginBottom: 4,
        letterSpacing: -0.5,
    },
    heroMotivation: { fontSize: 14, fontWeight: '500', maxWidth: width - 120 },
    roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    roleBadgeText: { fontSize: 11, fontWeight: '700' },

    // Stats
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    statCard: {
        flex: 1, padding: 12, borderRadius: 16, borderWidth: 1,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4 },
            android: { elevation: 1 },
        }),
    },
    statIconWrap: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 10, fontWeight: '600' },

    // Card
    card: {
        borderRadius: 20, padding: 20, marginTop: 16,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
            android: { elevation: 4 },
        }),
    },

    // Section Header
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700' },
    viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    viewAllText: { fontSize: 13, fontWeight: '600' },

    // Task Row
    taskRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 10, paddingHorizontal: 10, marginBottom: 6,
        borderRadius: 12,
    },
    taskRowOverdue: {},
    taskPriorityDot: { width: 6, height: 28, borderRadius: 3 },
    taskInfo: { flex: 1 },
    taskTitle: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
    taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    taskProjectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    taskProjectDot: { width: 5, height: 5, borderRadius: 3 },
    taskProjectText: { fontSize: 10, fontWeight: '600', maxWidth: 100 },
    taskDateBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    taskDateText: { fontSize: 11, fontWeight: '700' },

    // Activity Row
    activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
    activityIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    activityInfo: { flex: 1 },
    activityDesc: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
    activityTime: { fontSize: 11, marginTop: 2 },

    // Health
    healthRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    healthBox: {
        flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
        borderWidth: 1,
    },
    healthNum: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
    healthLabel: { fontSize: 10, fontWeight: '600' },

    // Status Bar
    statusBarContainer: { marginTop: 4 },
    statusBar: { height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden' },
    statusSegment: { height: '100%' },

    // Stuck
    stuckSubtitle: { fontSize: 12, marginBottom: 12, marginTop: -6 },
    stuckRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
    stuckInfo: { flex: 1 },
    stuckTitle: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
    stuckMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stuckDot: { width: 5, height: 5, borderRadius: 3 },
    stuckProject: { fontSize: 11, fontWeight: '500' },
    stuckAssignee: { fontSize: 11 },
    stuckDaysBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    stuckDaysText: { fontSize: 11, fontWeight: '700' },

    // Completed
    completedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
    completedInfo: { flex: 1 },
    completedTitle: { fontSize: 13, fontWeight: '500', textDecorationLine: 'line-through' },
    completedTime: { fontSize: 11, marginTop: 1 },

    // Workload
    workloadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
    workloadAvatar: {
        width: 36, height: 36, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    workloadAvatarImg: { width: 36, height: 36, borderRadius: 12 },
    workloadInitial: { fontSize: 15, fontWeight: '700' },
    workloadInfo: { flex: 1 },
    workloadNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    workloadName: { fontSize: 14, fontWeight: '600', flex: 1 },
    workloadRole: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
    workloadBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
    workloadBarFill: { height: '100%', borderRadius: 3 },
    workloadCount: { alignItems: 'center', minWidth: 36 },
    workloadCountNum: { fontSize: 16, fontWeight: '800' },
    workloadCountLabel: { fontSize: 9, fontWeight: '600' },

    // Project
    projectRow: { marginBottom: 14 },
    projectRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    projectRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    projectDot: { width: 8, height: 8, borderRadius: 4 },
    projectRowName: { fontSize: 14, fontWeight: '600', flex: 1 },
    projectRowPct: { fontSize: 12, fontWeight: '700' },
    projectTaskCount: { fontSize: 12, fontWeight: '600' },
    projectBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
    projectBarFill: { height: '100%', borderRadius: 3 },

    // Plan
    planRow: { flexDirection: 'row', justifyContent: 'space-around' },
    planItem: { alignItems: 'center', gap: 6 },
    planLabel: { fontSize: 11, fontWeight: '600' },
    planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    planBadgeText: { fontSize: 13, fontWeight: '700' },
    planValue: { fontSize: 18, fontWeight: '800' },

    // Task Group Label
    taskGroupLabel: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6, paddingLeft: 4 },

    // More text
    moreText: { textAlign: 'center', fontSize: 12, fontWeight: '500', marginTop: 8 },

    // Empty State
    emptyCard: {
        borderRadius: 20, padding: 32, marginTop: 12,
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
            android: { elevation: 2 },
        }),
    },
    emptyEmoji: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    emptySubtitle: { fontSize: 14, textAlign: 'center' },

    // Time
    timeCard: { alignItems: 'center', paddingVertical: 16 },
    timeBig: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    timeValue: { fontSize: 32, fontWeight: '800' },
    timeLabel: { fontSize: 13, fontWeight: '500' },
});

// ─── Greeting Helper ─────────────────────────────────────
function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
}

function getRoleLabel(role: string) {
    switch (role) {
        case 'owner': return { text: '👑 Owner', color: '#F59E0B', bg: '#FEF3C7' };
        case 'admin': return { text: '🛡️ Admin', color: '#6366F1', bg: '#EEF2FF' };
        case 'viewer': return { text: '👁️ Viewer', color: '#64748B', bg: '#F1F5F9' };
        default: return { text: '👤 Member', color: '#10B981', bg: '#ECFDF5' };
    }
}

function getPriorityConfig(priority: string) {
    switch (priority?.toLowerCase()) {
        case 'urgent': return { color: '#EF4444', bg: '#FEF2F2', label: 'Urgent' };
        case 'high': return { color: '#F97316', bg: '#FFF7ED', label: 'High' };
        case 'medium': return { color: '#EAB308', bg: '#FEFCE8', label: 'Medium' };
        default: return { color: '#22C55E', bg: '#F0FDF4', label: 'Low' };
    }
}

function formatDueDate(date: string | null) {
    if (!date) return { text: 'No date', color: '#94A3B8' };
    const d = new Date(date);
    if (isToday(d)) return { text: 'Today', color: '#3B82F6' };
    if (isTomorrow(d)) return { text: 'Tomorrow', color: '#8B5CF6' };
    if (isPast(d)) return { text: format(d, 'MMM d'), color: '#EF4444' };
    return { text: format(d, 'MMM d'), color: '#64748B' };
}

function getActivityIcon(type: string) {
    switch (type) {
        case 'create': return { icon: Sparkles, color: '#8B5CF6', bg: '#F5F3FF' };
        case 'update': return { icon: Zap, color: '#3B82F6', bg: '#EFF6FF' };
        case 'comment': return { icon: MessageCircle, color: '#06B6D4', bg: '#ECFEFF' };
        case 'assign': return { icon: Users, color: '#F97316', bg: '#FFF7ED' };
        case 'timer_start': case 'timer_pause': return { icon: Timer, color: '#10B981', bg: '#ECFDF5' };
        case 'upload': return { icon: FolderKanban, color: '#EC4899', bg: '#FDF2F8' };
        case 'join': return { icon: Users, color: '#22C55E', bg: '#F0FDF4' };
        default: return { icon: CircleDot, color: '#64748B', bg: '#F1F5F9' };
    }
}

// ─── Stat Card ────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, bgColor }: any) => {
    const { colors } = useTheme();
    return (
        <View style={[
            s.statCard, 
            { 
                backgroundColor: colors.cardElevated,
                borderColor: colors.borderLight,
                shadowColor: colors.shadowStrong,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 4,
            }
        ]}>
            <View style={[
                s.statIconWrap, 
                { 
                    backgroundColor: color + '20',
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 2,
                }
            ]}>
                <Icon size={18} color={color} />
            </View>
            <Text style={[
                s.statValue, 
                { 
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: '900',
                    marginBottom: 2
                }
            ]} numberOfLines={1}>{value ?? 0}</Text>
            <Text style={[
                s.statLabel, 
                { 
                    color: colors.textTertiary,
                    fontSize: 11,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                }
            ]} numberOfLines={1}>{label}</Text>
        </View>
    );
};

// ─── Section Header ────────────────────────────────────────
const SectionHeader = ({ title, icon: Icon, color, onViewAll }: any) => {
    const { colors } = useTheme();
    return (
        <View style={[
            s.sectionHeader,
            { 
                marginBottom: 16,
                paddingBottom: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderLight
            }
        ]}>
            <View style={s.sectionTitleRow}>
                {Icon && (
                    <View style={[
                        s.sectionIcon, 
                        { 
                            backgroundColor: color + '15',
                            shadowColor: color,
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                            elevation: 1,
                        }
                    ]}>
                        <Icon size={16} color={color} />
                    </View>
                )}
                <Text style={[
                    s.sectionTitle, 
                    { 
                        color: colors.text,
                        fontSize: 18,
                        fontWeight: '800',
                        letterSpacing: -0.3
                    }
                ]}>{title}</Text>
            </View>
            {onViewAll && (
                <TouchableOpacity 
                    onPress={onViewAll} 
                    style={[
                        s.viewAllBtn,
                        {
                            backgroundColor: colors.primaryBg,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.primary + '30'
                        }
                    ]}
                >
                    <Text style={[
                        s.viewAllText, 
                        { 
                            color: colors.primary,
                            fontSize: 12,
                            fontWeight: '700',
                            letterSpacing: 0.3
                        }
                    ]}>View all</Text>
                    <ChevronRight size={14} color={colors.primary} />
                </TouchableOpacity>
            )}
        </View>
    );
};

// ─── Task Row ──────────────────────────────────────────────
const TaskRow = ({ task, onPress }: { task: Task; onPress: () => void }) => {
    const due = formatDueDate(task.due_date);
    const priority = getPriorityConfig(task.priority);
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
    const { colors } = useTheme();

    return (
        <TouchableOpacity style={[
            s.taskRow, 
            { 
                backgroundColor: colors.cardHover,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 12,
                marginHorizontal: 16,
                marginBottom: 8,
                shadowColor: colors.shadowLight,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
            },
            isOverdue && { 
                backgroundColor: colors.errorBg,
                borderWidth: 1,
                borderColor: colors.errorBorder
            }
        ]} onPress={onPress}>
            <View style={[
                s.taskPriorityDot, 
                { 
                    backgroundColor: priority.color,
                    width: 4,
                    height: 20,
                    borderRadius: 2,
                    shadowColor: priority.color,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 2,
                    elevation: 1,
                }
            ]} />
            <View style={s.taskInfo}>
                <Text style={[
                    s.taskTitle, 
                    { 
                        color: colors.text,
                        fontSize: 15,
                        fontWeight: '600',
                        marginBottom: 4,
                        lineHeight: 20
                    }
                ]} numberOfLines={1}>{task.title}</Text>
                <View style={s.taskMeta}>
                    {task.project && (
                        <View style={[
                            s.taskProjectBadge, 
                            { 
                                backgroundColor: (task.project.color || colors.primary) + '15',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: (task.project.color || colors.primary) + '30'
                            }
                        ]}>
                            <View style={[
                                s.taskProjectDot, 
                                { 
                                    backgroundColor: task.project.color || colors.primary,
                                    width: 6,
                                    height: 6
                                }
                            ]} />
                            <Text style={[
                                s.taskProjectText, 
                                { 
                                    color: task.project.color || colors.primary,
                                    fontSize: 11,
                                    fontWeight: '600',
                                    maxWidth: 120
                                }
                            ]} numberOfLines={1}>
                                {task.project.name}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
            <View style={[
                s.taskDateBadge, 
                { 
                    backgroundColor: due.color + '15',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: due.color + '30'
                }
            ]}>
                <Text style={[
                    s.taskDateText, 
                    { 
                        color: due.color,
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 0.2
                    }
                ]}>{due.text}</Text>
            </View>
        </TouchableOpacity>
    );
};

// ─── Activity Row ──────────────────────────────────────────
const ActivityRow = ({ activity }: { activity: ActivityItem }) => {
    const router = useRouter();
    const { icon: Icon, color, bg } = getActivityIcon(activity.action_type);
    const { colors } = useTheme();

    const handlePress = () => {
        if (activity.task_id) {
            router.push(`/task/${activity.task_id}` as any);
        } else if (activity.project_id) {
            router.push(`/project/${activity.project_id}` as any);
        }
    };

    return (
        <TouchableOpacity style={[
            s.activityRow, 
            { 
                borderBottomColor: colors.borderLight,
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginHorizontal: 16,
                backgroundColor: colors.cardHover,
                borderRadius: 12,
                marginBottom: 4,
                shadowColor: colors.shadowLight,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
            }
        ]} onPress={handlePress}>
            <View style={[
                s.activityIconWrap, 
                { 
                    backgroundColor: bg,
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.15,
                    shadowRadius: 2,
                    elevation: 1,
                }
            ]}>
                <Icon size={16} color={color} />
            </View>
            <View style={s.activityInfo}>
                <Text style={[
                    s.activityDesc, 
                    { 
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: '500',
                        lineHeight: 20,
                        marginBottom: 2
                    }
                ]} numberOfLines={2}>{activity.description}</Text>
                <Text style={[
                    s.activityTime, 
                    { 
                        color: colors.textTertiary,
                        fontSize: 12,
                        fontWeight: '500'
                    }
                ]}>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</Text>
            </View>
        </TouchableOpacity>
    );
};

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════
export default function Dashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const { currentRole } = useWorkspace();
    const { colors } = useTheme();
    const hasMounted = useRef(false);

    const {
        stats,
        upcomingTasks,
        myTasks,
        overdueTasks,
        recentlyCompleted,
        recentlyAssigned,
        chartData,
        activities,
        performers,
        assigneeStats,
        projectProgress,
        memberWorkloads,
        subscriptionInfo,
        stuckTasks,
        isLoading,
        refreshing,
        refresh,
        silentRefresh,
    } = useDashboardData();

    useFocusEffect(
        useCallback(() => {
            if (hasMounted.current) {
                silentRefresh();
            } else {
                hasMounted.current = true;
            }
        }, [silentRefresh])
    );

    const role = currentRole || 'member';
    const roleInfo = getRoleLabel(role);
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
    const greeting = getGreeting();

    const isOwner = role === 'owner';
    const isAdmin = role === 'admin';
    const isMember = role === 'member' || role === 'viewer';

    // Motivational message
    const motivationText = useMemo(() => {
        if (!stats) return '';
        if (isMember) {
            const myDueToday = myTasks.filter(t => t.due_date && isToday(new Date(t.due_date))).length;
            if (myDueToday > 0) return `You've got ${myDueToday} task${myDueToday > 1 ? 's' : ''} due today 💪`;
            if (myTasks.length === 0) return 'All caught up! Great work 🎉';
            return `${myTasks.length} active task${myTasks.length > 1 ? 's' : ''} on your plate`;
        }
        if (stats.overdueTasks > 0) return `${stats.overdueTasks} overdue task${stats.overdueTasks > 1 ? 's' : ''} need attention ⚠️`;
        if (stats.tasksDueToday > 0) return `${stats.tasksDueToday} task${stats.tasksDueToday > 1 ? 's' : ''} due today across the team`;
        return 'Everything is on track! 🚀';
    }, [stats, myTasks, isMember]);

    // Loading state
    if (isLoading && !stats) {
        return (
            <View style={[s.container, { backgroundColor: colors.background }]}>
                <DashboardSkeleton />
            </View>
        );
    }

    // ─── OWNER DASHBOARD ─────────────────────────────────────
    const renderOwnerDashboard = () => (
        <>
            {/* Quick Stats Row 1 */}
            <View style={s.statsRow}>
                <StatCard label="Projects" value={stats?.totalProjects} icon={FolderKanban} color="#8B5CF6" bgColor="#F5F3FF" />
                <StatCard label="Total Tasks" value={stats?.totalTasks} icon={ListTodo} color="#3B82F6" bgColor="#EFF6FF" />
                <StatCard label="Due Today" value={stats?.tasksDueToday} icon={Calendar} color="#F97316" bgColor="#FFF7ED" />
            </View>
            <View style={s.statsRow}>
                <StatCard label="Overdue" value={stats?.overdueTasks} icon={AlertCircle} color="#EF4444" bgColor="#FEF2F2" />
                <StatCard label="Members" value={stats?.activeMembers + '/' + stats?.totalMembers} icon={Users} color="#10B981" bgColor="#ECFDF5" />
                <StatCard label="Hours/Wk" value={stats?.totalHoursThisWeek} icon={Clock} color="#0EA5E9" bgColor="#F0F9FF" />
            </View>

            {/* Work Health */}
            <View style={[s.card, { backgroundColor: colors.cardElevated }]}>
                <SectionHeader title="Work Health" icon={BarChart3} color="#8B5CF6" />
                <View style={s.healthRow}>
                    <View style={[
                        s.healthBox, 
                        { 
                            backgroundColor: colors.successBg,
                            borderColor: colors.successBorder,
                            borderWidth: 2,
                            shadowColor: colors.success,
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 2,
                        }
                    ]}>
                        <Text style={[s.healthNum, { color: colors.success, fontSize: 22, fontWeight: '900' }]}>{stats?.completedTasks || 0}</Text>
                        <Text style={[s.healthLabel, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>Done</Text>
                    </View>
                    <View style={[
                        s.healthBox, 
                        { 
                            backgroundColor: colors.warningBg,
                            borderColor: colors.warningBorder,
                            borderWidth: 2,
                            shadowColor: colors.warning,
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 2,
                        }
                    ]}>
                        <Text style={[s.healthNum, { color: colors.warning, fontSize: 22, fontWeight: '900' }]}>{stats?.inProgressTasks || 0}</Text>
                        <Text style={[s.healthLabel, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>Active</Text>
                    </View>
                    <View style={[
                        s.healthBox, 
                        { 
                            backgroundColor: colors.errorBg,
                            borderColor: colors.errorBorder,
                            borderWidth: 2,
                            shadowColor: colors.error,
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 2,
                        }
                    ]}>
                        <Text style={[s.healthNum, { color: colors.error, fontSize: 22, fontWeight: '900' }]}>{stats?.overdueTasks || 0}</Text>
                        <Text style={[s.healthLabel, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>Overdue</Text>
                    </View>
                    <View style={[
                        s.healthBox, 
                        { 
                            backgroundColor: colors.infoBg,
                            borderColor: colors.infoBorder,
                            borderWidth: 2,
                            shadowColor: colors.info,
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 2,
                        }
                    ]}>
                        <Text style={[s.healthNum, { color: colors.info, fontSize: 22, fontWeight: '900' }]}>{stats?.completionRate || 0}%</Text>
                        <Text style={[s.healthLabel, { color: colors.textSecondary, fontSize: 11, fontWeight: '600' }]}>On Time</Text>
                    </View>
                </View>

                {/* Status Bar */}
                {stats && stats.totalTasks > 0 && (
                    <View style={[s.statusBarContainer, { marginTop: 8 }]}>
                        <View style={[
                            s.statusBar, 
                            { 
                                backgroundColor: colors.borderLight,
                                height: 10,
                                borderRadius: 6,
                                overflow: 'hidden',
                                shadowColor: colors.shadowLight,
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.1,
                                shadowRadius: 2,
                                elevation: 1,
                            }
                        ]}>
                            <View style={[s.statusSegment, { flex: stats.completedTasks, backgroundColor: colors.success }]} />
                            <View style={[s.statusSegment, { flex: stats.inProgressTasks || 0.01, backgroundColor: colors.warning }]} />
                            <View style={[s.statusSegment, { flex: stats.overdueTasks || 0.01, backgroundColor: colors.error }]} />
                            <View style={[s.statusSegment, { flex: Math.max(0, stats.totalTasks - stats.completedTasks - stats.inProgressTasks - stats.overdueTasks), backgroundColor: colors.border }]} />
                        </View>
                    </View>
                )}
            </View>

            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
                <View style={[
                    s.card, 
                    { 
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.errorBorder,
                        borderWidth: 2,
                        shadowColor: colors.shadowColored,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 3,
                    }
                ]}>
                    <SectionHeader title="Overdue Tasks" icon={AlertTriangle} color={colors.error} />
                    {overdueTasks.slice(0, 5).map(t => (
                        <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
                    ))}
                </View>
            )}

            {/* Stuck Tasks */}
            {stuckTasks.length > 0 && (
                <View style={[
                    s.card, 
                    { 
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.warningBorder,
                        borderWidth: 2,
                        shadowColor: colors.shadowColored,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 3,
                    }
                ]}>
                    <SectionHeader title="Stuck Tasks" icon={AlertCircle} color={colors.warning} />
                    <Text style={[s.stuckSubtitle, { color: colors.textTertiary, fontSize: 13, fontWeight: '500' }]}>Tasks without updates for 3+ days</Text>
                    {stuckTasks.slice(0, 5).map(st => (
                        <TouchableOpacity 
                            key={st.id} 
                            style={[
                                s.stuckRow, 
                                { 
                                    backgroundColor: colors.cardHover,
                                    borderRadius: 12,
                                    paddingVertical: 12,
                                    paddingHorizontal: 12,
                                    marginHorizontal: 16,
                                    marginBottom: 8,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.borderLight,
                                    shadowColor: colors.shadowLight,
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 4,
                                    elevation: 1,
                                }
                            ]} 
                            onPress={() => router.push(`/task/${st.id}` as any)}
                        >
                            <View style={s.stuckInfo}>
                                <Text style={[s.stuckTitle, { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }]} numberOfLines={1}>{st.title}</Text>
                                <View style={s.stuckMeta}>
                                    <View style={[s.stuckDot, { backgroundColor: st.project_color, width: 6, height: 6 }]} />
                                    <Text style={[s.stuckProject, { color: colors.textSecondary, fontSize: 12, fontWeight: '500' }]} numberOfLines={1}>{st.project_name}</Text>
                                    {st.assigned_to_name && <Text style={[s.stuckAssignee, { color: colors.textTertiary, fontSize: 11 }]}>• {st.assigned_to_name}</Text>}
                                </View>
                            </View>
                            <View style={[
                                s.stuckDaysBadge, 
                                { 
                                    backgroundColor: colors.warningBg,
                                    borderColor: colors.warningBorder,
                                    borderWidth: 1,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 6
                                }
                            ]}>
                                <Text style={[s.stuckDaysText, { color: colors.warning, fontSize: 11, fontWeight: '700' }]}>{st.days_stuck}d</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Recently Completed */}
            {recentlyCompleted.length > 0 && (
                <View style={[
                    s.card, 
                    { 
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.successBorder,
                        borderWidth: 2,
                        shadowColor: colors.shadowColored,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 3,
                    }
                ]}>
                    <SectionHeader title="Recently Completed" icon={CheckCircle2} color={colors.success} />
                    {recentlyCompleted.map(t => (
                        <TouchableOpacity 
                            key={t.id} 
                            style={[
                                s.completedRow, 
                                { 
                                    backgroundColor: colors.successBg,
                                    borderRadius: 12,
                                    paddingVertical: 12,
                                    paddingHorizontal: 12,
                                    marginHorizontal: 16,
                                    marginBottom: 8,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.successBorder,
                                    shadowColor: colors.shadowLight,
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 4,
                                    elevation: 1,
                                }
                            ]} 
                            onPress={() => router.push(`/task/${t.id}` as any)}
                        >
                            <View style={{ alignItems: 'center', justifyContent: 'center', width: 24 }}>
                                <CheckCircle2 size={18} color={colors.success} />
                            </View>
                            <View style={s.completedInfo}>
                                <Text style={[
                                    s.completedTitle, 
                                    { 
                                        color: colors.text,
                                        fontSize: 14,
                                        fontWeight: '600',
                                        textDecorationLine: 'line-through',
                                        marginBottom: 2,
                                        lineHeight: 18
                                    }
                                ]} numberOfLines={1}>{t.title}</Text>
                                {t.completed_at && (
                                    <Text style={[
                                        s.completedTime, 
                                        { 
                                            color: colors.textTertiary,
                                            fontSize: 12,
                                            fontWeight: '500'
                                        }
                                    ]}>{formatDistanceToNow(new Date(t.completed_at), { addSuffix: true })}</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Team Activity */}
            {activities.length > 0 && (
                <View style={[
                    s.card, 
                    { 
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.borderLight,
                        borderWidth: 2,
                        shadowColor: colors.shadowStrong,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 12,
                        elevation: 4,
                    }
                ]}>
                    <SectionHeader title="Team Activity" icon={Zap} color={colors.accent} />
                    {activities.slice(0, 8).map(a => (
                        <ActivityRow key={a.id} activity={a} />
                    ))}
                </View>
            )}

            {/* Member Workload */}
            {memberWorkloads.length > 0 && (
                <View style={[
                    s.card, 
                    { 
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.borderLight,
                        borderWidth: 2,
                        shadowColor: colors.shadowStrong,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 12,
                        elevation: 4,
                    }
                ]}>
                    <SectionHeader title="Member Workload" icon={Users} color={colors.primary} />
                    {memberWorkloads.map(m => (
                        <View key={m.id} style={[
                            s.workloadRow, 
                            { 
                                backgroundColor: colors.cardHover,
                                borderRadius: 12,
                                paddingVertical: 16,
                                paddingHorizontal: 16,
                                marginHorizontal: 16,
                                marginBottom: 8,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.borderLight,
                                shadowColor: colors.shadowLight,
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 4,
                                elevation: 1,
                            }
                        ]}>
                            <View style={[
                                s.workloadAvatar, 
                                { 
                                    backgroundColor: m.avatar ? 'transparent' : colors.surfaceElevated,
                                    borderColor: colors.border,
                                    borderWidth: 2,
                                    shadowColor: colors.shadow,
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 4,
                                    elevation: 2,
                                }
                            ]}>
                                {m.avatar ? (
                                    <Image source={{ uri: m.avatar }} style={s.workloadAvatarImg} />
                                ) : (
                                    <Text style={[
                                        s.workloadInitial, 
                                        { 
                                            color: colors.text,
                                            fontSize: 16,
                                            fontWeight: '700'
                                        }
                                    ]}>{m.name.charAt(0)}</Text>
                                )}
                            </View>
                            <View style={s.workloadInfo}>
                                <View style={s.workloadNameRow}>
                                    <Text style={[
                                        s.workloadName, 
                                        { 
                                            color: colors.text,
                                            fontSize: 15,
                                            fontWeight: '600',
                                            flex: 1
                                        }
                                    ]} numberOfLines={1}>{m.name}</Text>
                                    <Text style={[
                                        s.workloadRole, 
                                        { 
                                            color: colors.textTertiary,
                                            fontSize: 11,
                                            fontWeight: '600',
                                            textTransform: 'capitalize',
                                            backgroundColor: colors.primaryBg,
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 4,
                                            overflow: 'hidden'
                                        }
                                    ]}>{m.role}</Text>
                                </View>
                                <View style={[
                                    s.workloadBarBg, 
                                    { 
                                        backgroundColor: colors.borderLight,
                                        height: 8,
                                        borderRadius: 4,
                                        overflow: 'hidden'
                                    }
                                ]}>
                                    <View style={[
                                        s.workloadBarFill, 
                                        { 
                                            width: `${Math.min(100, (m.activeTasks / Math.max(1, ...memberWorkloads.map(w => w.activeTasks))) * 100)}%`,
                                            backgroundColor: colors.primary,
                                            shadowColor: colors.primary,
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 2,
                                            elevation: 1,
                                        }
                                    ]} />
                                </View>
                            </View>
                            <View style={s.workloadCount}>
                                <Text style={[
                                    s.workloadCountNum, 
                                    { 
                                        color: colors.text,
                                        fontSize: 18,
                                        fontWeight: '800',
                                        marginBottom: 2
                                    }
                                ]}>{m.activeTasks}</Text>
                                <Text style={[
                                    s.workloadCountLabel, 
                                    { 
                                        color: colors.textTertiary,
                                        fontSize: 10,
                                        fontWeight: '600'
                                    }
                                ]}>active</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Project Progress */}
            {projectProgress.length > 0 && (
                <View style={[
                    s.card, 
                    { 
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.borderLight,
                        borderWidth: 2,
                        shadowColor: colors.shadowStrong,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 12,
                        elevation: 4,
                    }
                ]}>
                    <SectionHeader title="Project Progress" icon={FolderKanban} color="#8B5CF6" />
                    {projectProgress.slice(0, 6).map(p => {
                        const pct = p.totalTasks > 0 ? Math.round((p.completedTasks / p.totalTasks) * 100) : 0;
                        return (
                            <View key={p.id} style={[
                                s.projectRow, 
                                { 
                                    backgroundColor: colors.cardHover,
                                    borderRadius: 12,
                                    paddingVertical: 16,
                                    paddingHorizontal: 16,
                                    marginHorizontal: 16,
                                    marginBottom: 8,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.borderLight,
                                    shadowColor: colors.shadowLight,
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 4,
                                    elevation: 1,
                                }
                            ]}>
                                <View style={s.projectRowHeader}>
                                    <View style={s.projectRowLeft}>
                                        <View style={[
                                            s.projectDot, 
                                            { 
                                                backgroundColor: p.color || colors.primary,
                                                width: 10,
                                                height: 10,
                                                borderRadius: 5,
                                                shadowColor: p.color || colors.primary,
                                                shadowOffset: { width: 0, height: 1 },
                                                shadowOpacity: 0.2,
                                                shadowRadius: 2,
                                                elevation: 1,
                                            }
                                        ]} />
                                        <Text style={[
                                            s.projectRowName, 
                                            { 
                                                color: colors.text,
                                                fontSize: 15,
                                                fontWeight: '600',
                                                flex: 1
                                            }
                                        ]} numberOfLines={1}>{p.name}</Text>
                                    </View>
                                    <Text style={[
                                        s.projectRowPct, 
                                        { 
                                            color: colors.textSecondary,
                                            fontSize: 14,
                                            fontWeight: '700',
                                            backgroundColor: colors.primaryBg,
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 6,
                                            overflow: 'hidden'
                                        }
                                    ]}>{pct}%</Text>
                                </View>
                                <View style={[
                                    s.projectBarBg, 
                                    { 
                                        backgroundColor: colors.borderLight,
                                        height: 8,
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                        marginTop: 8
                                    }
                                ]}>
                                    <View style={[
                                        s.projectBarFill, 
                                        { 
                                            width: `${pct}%`,
                                            backgroundColor: p.color || colors.primary,
                                            shadowColor: p.color || colors.primary,
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 2,
                                            elevation: 1,
                                        }
                                    ]} />
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Plan & Usage */}
            {subscriptionInfo && (
                <View style={[
                    s.card, 
                    { 
                        backgroundColor: colors.cardElevated,
                        borderColor: colors.warningBorder,
                        borderWidth: 2,
                        shadowColor: colors.shadowColored,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 3,
                    }
                ]}>
                    <SectionHeader title="Plan & Usage" icon={CreditCard} color={colors.warning} />
                    <View style={[
                        s.planRow, 
                        { 
                            backgroundColor: colors.warningBg,
                            borderRadius: 12,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            marginHorizontal: 16,
                            marginBottom: 8,
                            shadowColor: colors.shadowLight,
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 4,
                            elevation: 1,
                        }
                    ]}>
                        <View style={s.planItem}>
                            <Text style={[
                                s.planLabel, 
                                { 
                                    color: colors.textSecondary,
                                    fontSize: 12,
                                    fontWeight: '600',
                                    marginBottom: 6
                                }
                            ]}>Current Plan</Text>
                            <View style={[
                                s.planBadge, 
                                { 
                                    backgroundColor: colors.warning,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    shadowColor: colors.warning,
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 2,
                                    elevation: 1,
                                }
                            ]}>
                                <Text style={[
                                    s.planBadgeText, 
                                    { 
                                        color: colors.buttonText,
                                        fontSize: 13,
                                        fontWeight: '700'
                                    }
                                ]}>{subscriptionInfo.planName}</Text>
                            </View>
                        </View>
                        <View style={s.planItem}>
                            <Text style={[
                                s.planLabel, 
                                { 
                                    color: colors.textSecondary,
                                    fontSize: 12,
                                    fontWeight: '600',
                                    marginBottom: 6
                                }
                            ]}>Members</Text>
                            <Text style={[
                                s.planValue, 
                                { 
                                    color: colors.text,
                                    fontSize: 18,
                                    fontWeight: '800'
                                }
                            ]}>
                                {subscriptionInfo.membersUsed}{subscriptionInfo.membersLimit ? `/${subscriptionInfo.membersLimit}` : ''}
                            </Text>
                        </View>
                        {subscriptionInfo.daysUntilExpiry !== null && (
                            <View style={s.planItem}>
                                <Text style={[
                                    s.planLabel, 
                                    { 
                                        color: colors.textSecondary,
                                        fontSize: 12,
                                        fontWeight: '600',
                                        marginBottom: 6
                                    }
                                ]}>Days Left</Text>
                                <Text style={[
                                    s.planValue, 
                                    { 
                                        color: subscriptionInfo.daysUntilExpiry <= 7 ? colors.error : colors.text,
                                        fontSize: 18,
                                        fontWeight: '800',
                                        backgroundColor: subscriptionInfo.daysUntilExpiry <= 7 ? colors.errorBg : 'transparent',
                                        paddingHorizontal: subscriptionInfo.daysUntilExpiry <= 7 ? 8 : 0,
                                        paddingVertical: subscriptionInfo.daysUntilExpiry <= 7 ? 4 : 0,
                                        borderRadius: 6
                                    }
                                ]}>
                                    {subscriptionInfo.daysUntilExpiry}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </>
    );

    // ─── ADMIN DASHBOARD ─────────────────────────────────────
    const renderAdminDashboard = () => (
        <>
            {/* Quick Stats */}
            <View style={s.statsRow}>
                <StatCard label="Due Today" value={stats?.tasksDueToday} icon={Calendar} color="#3B82F6" bgColor="#EFF6FF" />
                <StatCard label="Overdue" value={stats?.overdueTasks} icon={AlertCircle} color="#EF4444" bgColor="#FEF2F2" />
                <StatCard label="Active" value={stats?.inProgressTasks} icon={Clock} color="#F97316" bgColor="#FFF7ED" />
            </View>
            <View style={s.statsRow}>
                <StatCard label="Completed" value={stats?.completedTasks} icon={CheckSquare} color="#22C55E" bgColor="#F0FDF4" />
                <StatCard label="Members" value={stats?.totalMembers} icon={Users} color="#6366F1" bgColor="#EEF2FF" />
                <StatCard label="On Time" value={`${stats?.completionRate || 0}%`} icon={TrendingUp} color="#10B981" bgColor="#ECFDF5" />
            </View>

            {/* My Assigned Tasks */}
            {myTasks.length > 0 && (
                <View style={s.card}>
                    <SectionHeader title="My Assigned Tasks" icon={Target} color="#F97316" onViewAll={() => router.push('/(tabs)/tasks')} />
                    {myTasks.slice(0, 5).map(t => (
                        <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
                    ))}
                    {myTasks.length > 5 && (
                        <Text style={s.moreText}>+{myTasks.length - 5} more tasks</Text>
                    )}
                </View>
            )}

            {/* Tasks Due Today (All) */}
            {upcomingTasks.length > 0 && (
                <View style={s.card}>
                    <SectionHeader title="Upcoming Deadlines" icon={Calendar} color="#3B82F6" onViewAll={() => router.push('/(tabs)/tasks')} />
                    {upcomingTasks.map(t => (
                        <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
                    ))}
                </View>
            )}

            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
                <View style={[s.card, { borderColor: '#FEE2E2', borderWidth: 1 }]}>
                    <SectionHeader title="Overdue Tasks" icon={AlertTriangle} color="#EF4444" />
                    {overdueTasks.slice(0, 5).map(t => (
                        <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
                    ))}
                </View>
            )}

            {/* Project Quick Access */}
            {projectProgress.length > 0 && (
                <View style={s.card}>
                    <SectionHeader title="Projects" icon={FolderKanban} color="#8B5CF6" />
                    {projectProgress.slice(0, 6).map(p => {
                        const pct = p.totalTasks > 0 ? Math.round((p.completedTasks / p.totalTasks) * 100) : 0;
                        return (
                            <View key={p.id} style={s.projectRow}>
                                <View style={s.projectRowHeader}>
                                    <View style={s.projectRowLeft}>
                                        <View style={[s.projectDot, { backgroundColor: p.color }]} />
                                        <Text style={s.projectRowName} numberOfLines={1}>{p.name}</Text>
                                    </View>
                                    <Text style={s.projectTaskCount}>{p.totalTasks - p.completedTasks} active</Text>
                                </View>
                                <View style={s.projectBarBg}>
                                    <View style={[s.projectBarFill, { width: `${pct}%`, backgroundColor: p.color }]} />
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Activity Feed */}
            {activities.length > 0 && (
                <View style={s.card}>
                    <SectionHeader title="Recent Activity" icon={Zap} color="#F97316" onViewAll={() => router.push('/(tabs)/activity-log' as any)} />
                    {activities.slice(0, 5).map(a => (
                        <ActivityRow key={a.id} activity={a} />
                    ))}
                </View>
            )}
        </>
    );

    // ─── MEMBER DASHBOARD ────────────────────────────────────
    const renderMemberDashboard = () => {
        const myDueToday = myTasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
        const myOverdue = myTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
        const myInProgress = myTasks.filter(t => t.first_started_at || t.status?.toLowerCase() === 'in_progress');
        const myHoursWeek = stats?.totalHoursThisWeek || 0;

        return (
            <>
                {/* Personal Quick Stats */}
                <View style={s.statsRow}>
                    <StatCard label="My Tasks" value={myTasks.length} icon={Target} color="#F97316" bgColor="#FFF7ED" />
                    <StatCard label="Due Today" value={myDueToday.length} icon={Calendar} color="#3B82F6" bgColor="#EFF6FF" />
                    <StatCard label="Overdue" value={myOverdue.length} icon={AlertCircle} color="#EF4444" bgColor="#FEF2F2" />
                </View>

                {/* My Tasks — Primary Focus */}
                {myTasks.length > 0 ? (
                    <View style={s.card}>
                        <SectionHeader title="My Tasks" icon={Target} color="#F97316" onViewAll={() => router.push('/(tabs)/tasks')} />

                        {/* Due Today */}
                        {myDueToday.length > 0 && (
                            <>
                                <Text style={s.taskGroupLabel}>📅 Due Today</Text>
                                {myDueToday.map(t => (
                                    <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
                                ))}
                            </>
                        )}

                        {/* Overdue */}
                        {myOverdue.length > 0 && (
                            <>
                                <Text style={[s.taskGroupLabel, { color: '#EF4444' }]}>🔴 Overdue</Text>
                                {myOverdue.map(t => (
                                    <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
                                ))}
                            </>
                        )}

                        {/* In Progress */}
                        {myInProgress.length > 0 && (
                            <>
                                <Text style={[s.taskGroupLabel, { color: '#F97316' }]}>⚡ In Progress</Text>
                                {myInProgress.filter(t => !myDueToday.includes(t) && !myOverdue.includes(t)).slice(0, 5).map(t => (
                                    <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
                                ))}
                            </>
                        )}

                        {/* Other Active */}
                        {myTasks.filter(t => !myDueToday.includes(t) && !myOverdue.includes(t) && !myInProgress.includes(t)).length > 0 && (
                            <>
                                <Text style={s.taskGroupLabel}>📋 Other</Text>
                                {myTasks.filter(t => !myDueToday.includes(t) && !myOverdue.includes(t) && !myInProgress.includes(t)).slice(0, 5).map(t => (
                                    <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
                                ))}
                            </>
                        )}
                    </View>
                ) : (
                    <View style={s.emptyCard}>
                        <Text style={s.emptyEmoji}>🎉</Text>
                        <Text style={s.emptyTitle}>All caught up!</Text>
                        <Text style={s.emptySubtitle}>No tasks assigned to you right now.</Text>
                    </View>
                )}

                {/* Recently Assigned */}
                {recentlyAssigned.length > 0 && (
                    <View style={s.card}>
                        <SectionHeader title="Recently Assigned" icon={Sparkles} color="#8B5CF6" />
                        {recentlyAssigned.map(t => (
                            <TaskRow key={t.id} task={t} onPress={() => router.push(`/task/${t.id}` as any)} />
                        ))}
                    </View>
                )}

                {/* My Time This Week */}
                <View style={s.card}>
                    <SectionHeader title="My Time This Week" icon={Timer} color="#10B981" />
                    <View style={s.timeCard}>
                        <View style={s.timeBig}>
                            <Timer size={24} color="#10B981" />
                            <Text style={s.timeValue}>{myHoursWeek}h</Text>
                        </View>
                        <Text style={s.timeLabel}>Total hours tracked this week</Text>
                    </View>
                </View>
            </>
        );
    };

    return (
        <View style={[s.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={[
                    s.scrollContent,
                    { 
                        paddingTop: 20,
                        paddingBottom: 120,
                        paddingHorizontal: 16
                    }
                ]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
            >
                {/* Hero Greeting */}
                <View style={s.heroSection}>
                    <View style={s.heroTop}>
                        <View>
                            <Text style={[s.heroGreeting, { color: colors.text }]}>{greeting}, {userName} ✨</Text>
                            <Text style={[s.heroMotivation, { color: colors.textSecondary }]}>{motivationText}</Text>
                        </View>
                        <View style={[s.roleBadge, { backgroundColor: roleInfo.bg }]}>
                            <Text style={[s.roleBadgeText, { color: roleInfo.color }]}>{roleInfo.text}</Text>
                        </View>
                    </View>
                </View>

                {/* Role-Based Content */}
                {isOwner && renderOwnerDashboard()}
                {isAdmin && renderAdminDashboard()}
                {isMember && renderMemberDashboard()}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}
