import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useWorkspace, WorkspaceRole } from './useWorkspace';
import { useAuth } from './useAuth';
import {
    format,
    subDays,
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    isPast,
    isToday,
    differenceInDays,
} from 'date-fns';

export interface DashboardStats {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    totalMembers: number;
    overdueTasks: number;
    inProgressTasks: number;
    activeMembers: number;
    tasksThisWeek: number;
    tasksDueToday: number;
    tasksDueTomorrow: number;
    tasksDueThisMonth: number;
    completionRate: number;
    totalHoursThisWeek: number;
}

export interface Task {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    project_id: string;
    assigned_to?: string | null;
    created_by?: string;
    created_at?: string;
    completed_at?: string | null;
    first_started_at?: string | null;
    custom_status_id?: string | null;
    project?: {
        name: string;
        color: string | null;
    };
    statusName?: string;
}

export interface ChartData {
    name: string;
    completed: number;
    created: number;
}

export interface ActivityItem {
    id: string;
    action_type: string;
    entity_type: string;
    description: string;
    actor_name: string;
    actor_avatar?: string;
    project_name?: string;
    project_color?: string;
    created_at: string;
    task_id?: string;
}

export interface Performer {
    id: string;
    name: string;
    avatar?: string;
    completedTasks: number;
    totalTasks: number;
}

export interface ProjectStats {
    id: string;
    name: string;
    color: string;
    totalTasks: number;
    completedTasks: number;
}

export interface AssigneeStat {
    id: string;
    name: string;
    avatar?: string;
    activeTasks: number;
    totalTasks: number;
}

export interface MemberWorkload {
    id: string;
    name: string;
    avatar?: string;
    role: string;
    activeTasks: number;
    completedTasks: number;
    hoursThisWeek: number;
}

export interface SubscriptionInfo {
    planName: string;
    status: string;
    membersUsed: number;
    membersLimit: number | null;
    daysUntilExpiry: number | null;
    expiresAt: string | null;
}

export interface StuckTask {
    id: string;
    title: string;
    status: string;
    project_name: string;
    project_color: string;
    days_stuck: number;
    assigned_to_name?: string;
}

export function useDashboardData() {
    const { currentWorkspace, currentRole } = useWorkspace();
    const { user } = useAuth();

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
    const [myTasks, setMyTasks] = useState<Task[]>([]);
    const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
    const [recentlyCompleted, setRecentlyCompleted] = useState<Task[]>([]);
    const [recentlyAssigned, setRecentlyAssigned] = useState<Task[]>([]);
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [performers, setPerformers] = useState<Performer[]>([]);
    const [assigneeStats, setAssigneeStats] = useState<AssigneeStat[]>([]);
    const [projectProgress, setProjectProgress] = useState<ProjectStats[]>([]);
    const [memberWorkloads, setMemberWorkloads] = useState<MemberWorkload[]>([]);
    const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
    const [stuckTasks, setStuckTasks] = useState<StuckTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        if (!currentWorkspace?.id || !user) return;

        try {
            const workspaceId = currentWorkspace.id;
            const role: WorkspaceRole = currentRole || 'member';
            const isOwnerOrAdmin = role === 'owner' || role === 'admin';

            // 1. Fetch Projects
            const { data: projects } = await supabase
                .from('projects')
                .select('id, name, color')
                .eq('workspace_id', workspaceId)
                .eq('is_archived', false);

            const projectIds = projects?.map(p => p.id) || [];
            const projectMap = new Map(projects?.map(p => [p.id, p]));

            // 2. Fetch statuses
            const { data: allStatuses } = await supabase
                .from('project_statuses')
                .select('id, project_id, name, is_completed, is_default')
                .in('project_id', projectIds.length > 0 ? projectIds : ['__none__']);

            const completedStatusMap = new Map<string, Set<string>>();
            const statusIdNameMap = new Map<string, string>();

            allStatuses?.forEach(s => {
                statusIdNameMap.set(s.id, s.name);
                if (s.is_completed) {
                    if (!completedStatusMap.has(s.project_id)) completedStatusMap.set(s.project_id, new Set());
                    completedStatusMap.get(s.project_id)!.add(s.name);
                }
            });

            const isTaskDone = (projectId: string, status: string) =>
                completedStatusMap.get(projectId)?.has(status) || status.toLowerCase() === 'done';

            // 3. Members
            const { data: members } = await supabase
                .from('workspace_members')
                .select('user_id, role, last_active_at')
                .eq('workspace_id', workspaceId);

            const mIds = members?.map(m => m.user_id) || [];
            const { data: mProfs } = await supabase.from('profiles')
                .select('id, full_name, avatar_url, email')
                .in('id', mIds.length > 0 ? mIds : ['__none__']);
            const profileMap = new Map(mProfs?.map(p => [p.id, p]));
            const memberRoleMap = new Map(members?.map(m => [m.user_id, m.role]));

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const activeCount = members?.filter(m => m.last_active_at && new Date(m.last_active_at) >= yesterday).length || 0;

            // 4. Fetch Tasks
            let allTasks: any[] = [];
            if (projectIds.length > 0) {
                const { data: tData } = await supabase
                    .from('tasks')
                    .select('id, title, project_id, status, due_date, completed_at, first_started_at, created_at, assigned_to, created_by, priority, custom_status_id, updated_at')
                    .in('project_id', projectIds);
                allTasks = tData || [];
            }

            // Enrich tasks w/ status name
            allTasks.forEach(t => {
                if (t.custom_status_id && statusIdNameMap.has(t.custom_status_id)) {
                    t.statusName = statusIdNameMap.get(t.custom_status_id);
                } else {
                    t.statusName = t.status;
                }
            });

            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');
            const tomStr = format(subDays(today, -1), 'yyyy-MM-dd');
            const mStart = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
            const mEnd = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');
            const weekStart = startOfWeek(today, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

            // Compute stats
            let totalTasks = allTasks.length;
            let completedCount = 0;
            let overdueCount = 0;
            let inProgressCount = 0;
            let dueTodayCount = 0;
            let dueTomCount = 0;
            let dueMonthCount = 0;

            const overdueList: Task[] = [];
            const stuckList: StuckTask[] = [];

            allTasks.forEach(t => {
                const done = isTaskDone(t.project_id, t.status);
                if (done) {
                    completedCount++;
                } else {
                    if (t.first_started_at || t.status.toLowerCase() === 'in_progress') {
                        inProgressCount++;
                    }
                    if (t.due_date) {
                        if (t.due_date === todayStr) dueTodayCount++;
                        if (t.due_date === tomStr) dueTomCount++;
                        if (t.due_date >= mStart && t.due_date <= mEnd) dueMonthCount++;
                        if (isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))) {
                            overdueCount++;
                            const proj = projectMap.get(t.project_id);
                            overdueList.push({ ...t, project: proj });
                        }
                    }

                    // Stuck detection: task not updated in 3+ days, not completed
                    if (t.updated_at) {
                        const daysSinceUpdate = differenceInDays(today, new Date(t.updated_at));
                        if (daysSinceUpdate >= 3 && !done) {
                            const proj = projectMap.get(t.project_id);
                            const assigneeProf = t.assigned_to ? profileMap.get(t.assigned_to) : null;
                            stuckList.push({
                                id: t.id,
                                title: t.title,
                                status: t.statusName || t.status,
                                project_name: proj?.name || 'Unknown',
                                project_color: proj?.color || '#6366F1',
                                days_stuck: daysSinceUpdate,
                                assigned_to_name: assigneeProf?.full_name || undefined,
                            });
                        }
                    }
                }
            });

            // Completion rate
            const withRate = allTasks.filter(t => t.due_date && t.completed_at && isTaskDone(t.project_id, t.status));
            let rate = 0;
            if (withRate.length > 0) {
                const onTime = withRate.filter(t => new Date(t.completed_at) <= new Date(t.due_date)).length;
                rate = Math.round((onTime / withRate.length) * 100);
            }

            // Hours this week
            let totalHoursThisWeek = 0;
            const myHoursThisWeek: { [key: string]: number } = {};
            if (projectIds.length > 0) {
                const { data: sessions } = await supabase
                    .from('task_work_sessions')
                    .select('user_id, duration_seconds')
                    .in('task_id', allTasks.map(t => t.id))
                    .gte('started_at', weekStart.toISOString())
                    .lte('started_at', weekEnd.toISOString())
                    .not('ended_at', 'is', null);

                sessions?.forEach(s => {
                    const hours = (s.duration_seconds || 0) / 3600;
                    totalHoursThisWeek += hours;
                    myHoursThisWeek[s.user_id] = (myHoursThisWeek[s.user_id] || 0) + hours;
                });
            }

            setStats({
                totalProjects: projects?.length || 0,
                totalTasks,
                completedTasks: completedCount,
                totalMembers: members?.length || 0,
                overdueTasks: overdueCount,
                inProgressTasks: inProgressCount,
                activeMembers: activeCount,
                tasksThisWeek: allTasks.filter(t => t.due_date && t.due_date >= format(weekStart, 'yyyy-MM-dd') && t.due_date <= format(weekEnd, 'yyyy-MM-dd')).length,
                tasksDueToday: dueTodayCount,
                tasksDueTomorrow: dueTomCount,
                tasksDueThisMonth: dueMonthCount,
                completionRate: rate,
                totalHoursThisWeek: Math.round(totalHoursThisWeek * 10) / 10,
            });

            setOverdueTasks(overdueList.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()).slice(0, 10));
            setStuckTasks(stuckList.sort((a, b) => b.days_stuck - a.days_stuck).slice(0, 8));

            // My Tasks (for member + admin)
            const myTasksList = allTasks
                .filter(t => t.assigned_to === user.id && !isTaskDone(t.project_id, t.status))
                .map(t => ({ ...t, project: projectMap.get(t.project_id) }))
                .sort((a, b) => {
                    // Overdue first, then due today, then by date
                    if (a.due_date && !b.due_date) return -1;
                    if (!a.due_date && b.due_date) return 1;
                    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                    return 0;
                });
            setMyTasks(myTasksList);

            // Recently Assigned (last 7 days)
            const recentAssigned = allTasks
                .filter(t =>
                    t.assigned_to === user.id &&
                    t.created_at &&
                    differenceInDays(today, new Date(t.created_at)) <= 7 &&
                    !isTaskDone(t.project_id, t.status)
                )
                .map(t => ({ ...t, project: projectMap.get(t.project_id) }))
                .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
                .slice(0, 5);
            setRecentlyAssigned(recentAssigned);

            // Recently Completed
            const recentDone = allTasks
                .filter(t => isTaskDone(t.project_id, t.status) && t.completed_at)
                .map(t => ({ ...t, project: projectMap.get(t.project_id) }))
                .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
                .slice(0, 5);
            setRecentlyCompleted(recentDone);

            // Upcoming tasks (next deadlines)
            const upcoming = allTasks
                .filter(t => !isTaskDone(t.project_id, t.status) && t.due_date && t.due_date >= todayStr)
                .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                .slice(0, 5)
                .map(t => ({ ...t, project: projectMap.get(t.project_id) }));
            setUpcomingTasks(upcoming as Task[]);

            // Chart (Velocity)
            const velocity: ChartData[] = [];
            for (let i = 6; i >= 0; i--) {
                const date = subDays(new Date(), i);
                const ds = startOfDay(date);
                const de = endOfDay(date);
                velocity.push({
                    name: format(date, 'EEE'),
                    completed: allTasks.filter(t => t.completed_at && new Date(t.completed_at) >= ds && new Date(t.completed_at) <= de).length,
                    created: allTasks.filter(t => t.created_at && new Date(t.created_at) >= ds && new Date(t.created_at) <= de).length,
                });
            }
            setChartData(velocity);

            // Activity Feed from activity_logs
            const { data: actLogs } = await supabase
                .from('activity_logs')
                .select('id, action_type, entity_type, description, actor_id, project_id, task_id, created_at')
                .eq('workspace_id', workspaceId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (actLogs && actLogs.length > 0) {
                const actorIds = [...new Set(actLogs.map(a => a.actor_id).filter(Boolean))];
                const { data: actorProfs } = await supabase.from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', actorIds.length > 0 ? actorIds : ['__none__']);
                const actorMap = new Map(actorProfs?.map(p => [p.id, p]));

                setActivities(actLogs.map(log => {
                    const actor = actorMap.get(log.actor_id);
                    const proj = projectMap.get(log.project_id);
                    return {
                        id: log.id,
                        action_type: log.action_type,
                        entity_type: log.entity_type,
                        description: log.description,
                        actor_name: actor?.full_name || 'Someone',
                        actor_avatar: actor?.avatar_url,
                        project_name: proj?.name,
                        project_color: proj?.color || '#6366f1',
                        created_at: log.created_at,
                        task_id: log.task_id,
                    };
                }));
            } else {
                setActivities([]);
            }

            // Performers & Member Workloads
            setPerformers(mIds.map(mid => {
                const ut = allTasks.filter(t => t.assigned_to === mid);
                return {
                    id: mid,
                    name: profileMap.get(mid)?.full_name || 'User',
                    avatar: profileMap.get(mid)?.avatar_url,
                    completedTasks: ut.filter(t => isTaskDone(t.project_id, t.status)).length,
                    totalTasks: ut.length,
                };
            }).sort((a, b) => b.completedTasks - a.completedTasks).slice(0, 5));

            setAssigneeStats(mIds.map(mid => {
                const ut = allTasks.filter(t => t.assigned_to === mid);
                return {
                    id: mid,
                    name: profileMap.get(mid)?.full_name || 'User',
                    avatar: profileMap.get(mid)?.avatar_url,
                    activeTasks: ut.filter(t => !isTaskDone(t.project_id, t.status)).length,
                    totalTasks: ut.length,
                };
            }).sort((a, b) => b.activeTasks - a.activeTasks));

            // Member Workloads (owner/admin)
            if (isOwnerOrAdmin) {
                setMemberWorkloads(mIds.map(mid => {
                    const ut = allTasks.filter(t => t.assigned_to === mid);
                    return {
                        id: mid,
                        name: profileMap.get(mid)?.full_name || profileMap.get(mid)?.email?.split('@')[0] || 'User',
                        avatar: profileMap.get(mid)?.avatar_url,
                        role: memberRoleMap.get(mid) || 'member',
                        activeTasks: ut.filter(t => !isTaskDone(t.project_id, t.status)).length,
                        completedTasks: ut.filter(t => isTaskDone(t.project_id, t.status)).length,
                        hoursThisWeek: Math.round((myHoursThisWeek[mid] || 0) * 10) / 10,
                    };
                }).sort((a, b) => b.activeTasks - a.activeTasks));
            }

            // Project Progress
            setProjectProgress(projects?.map(p => {
                const pt = allTasks.filter(t => t.project_id === p.id);
                return {
                    id: p.id, name: p.name, color: p.color || '#6366f1',
                    totalTasks: pt.length,
                    completedTasks: pt.filter(t => isTaskDone(t.project_id, t.status)).length,
                };
            }) || []);

            // Subscription Info (owner only)
            if (role === 'owner') {
                try {
                    const { data: sub } = await supabase
                        .from('workspace_subscriptions')
                        .select('status, expires_at, member_count, plan_id, subscription_plans(name, max_members)')
                        .eq('workspace_id', workspaceId)
                        .maybeSingle();

                    if (sub) {
                        const plan = (sub as any).subscription_plans;
                        let daysUntilExpiry: number | null = null;
                        if (sub.expires_at) {
                            daysUntilExpiry = differenceInDays(new Date(sub.expires_at), today);
                        }
                        setSubscriptionInfo({
                            planName: plan?.name || 'Free',
                            status: sub.status || 'active',
                            membersUsed: members?.length || 0,
                            membersLimit: plan?.max_members || null,
                            daysUntilExpiry,
                            expiresAt: sub.expires_at,
                        });
                    }
                } catch (err) {
                    // Subscription table might not exist, ignore
                    console.log('Subscription fetch skipped:', err);
                }
            }
        } catch (error) {
            console.error('Dashboard error:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [currentWorkspace, currentRole, user]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const refresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const silentRefresh = useCallback(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    return {
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
        currentRole: currentRole || 'member',
        isLoading,
        refreshing,
        refresh,
        silentRefresh,
    };
}
