import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  Target,
  History,
  MessageCircle,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  MoreVertical,
  Trash2,
  FolderKanban,
  Activity,
  User as UserIcon,
  Flag,
  Calendar as CalendarIcon,
  ChevronDown,
  Sun,
  Sunrise,
  CalendarDays,
  XCircle,
  X,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { format, addDays, nextMonday, startOfDay } from 'date-fns';
import { TaskDetailsTab } from '@/components/task/TaskDetailsTab';
import { TaskSessionsTab } from '@/components/task/TaskSessionsTab';
import { TaskCommentsTab } from '@/components/task/TaskCommentsTab';
import { TaskActivityTab } from '@/components/task/TaskActivityTab';
import { TimerPauseModal } from '@/components/task/TimerPauseModal';
import { PickerModal } from '@/components/task/PickerModal';
import { AssigneeSelector, AssigneeSelectorHandle } from '@/components/task/AssigneeSelector';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TextInput } from 'react-native';

const PRIORITIES = [
  { label: 'Low', value: 'low', color: '#94A3B8' },
  { label: 'Medium', value: 'medium', color: '#EAB308' },
  { label: 'High', value: 'high', color: '#F97316' },
  { label: 'Urgent', value: 'urgent', color: '#EF4444' },
];

type TabKey = 'details' | 'sessions' | 'activity' | 'comments';

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  user?: { full_name: string | null; email: string };
  replies?: Comment[];
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [assignees, setAssignees] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  // Shared UI states for Title and Bubbles
  const [title, setTitle] = useState('');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assigneeRef = useRef<AssigneeSelectorHandle>(null);

  // Track keyboard visibility to hide bottom tab bar when typing
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Sync state when task prop changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
    }
  }, [task?.id, task?.title]);

  // Effective assignees: if task_assignees table doesn't exist, synthesize from task.assigned_to
  const effectiveAssignees = useMemo(() => {
    if (assignees.length > 0) return assignees;
    if (!task?.assigned_to) return [];
    const member = members.find(m => m.id === task.assigned_to);
    if (!member) return [];
    return [{
      id: `legacy-${task.assigned_to}`,
      user_id: task.assigned_to,
      assigned_at: task.created_at || new Date().toISOString(),
      profile: member,
    }];
  }, [assignees, task, members]);

  // Timer
  const completedStatus = useMemo(() => statuses.find(s => s.is_completed), [statuses]);
  const {
    isRunning, displayTime, formatTime, formatTimeLive, formatTimeWithSeconds,
    startTimer, pauseTimer, resumeTimer, completeTask, deleteSession,
    sessions, firstStartedAt, completedAt, totalWorkTime,
    isLoading: timerLoading, elapsedTime, refresh: timerRefresh,
  } = useTaskTimer(id || '', completedStatus?.id);

  const currentStatus = useMemo(() => statuses.find(s => s.id === task?.custom_status_id), [statuses, task?.custom_status_id]);
  const isCompleted = currentStatus?.is_completed || false;

  // Pause dialog state
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pausedDuration, setPausedDuration] = useState(0);

  const handlePauseTimer = async () => {
    const duration = await pauseTimer();
    if (duration > 0) {
      setPausedDuration(duration);
      setShowPauseDialog(true);
    }
  };

  // ─── Data Fetching ───
  const fetchTask = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, creator:profiles!tasks_created_by_fkey(full_name, email)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        Alert.alert('Not Found', 'This task no longer exists.');
        router.back();
        return;
      }
      setTask(data);
      return data;
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  }, [id]);

  const syncField = useCallback(async (field: string, value: any, extra?: Record<string, any>) => {
    console.log(`[TaskDetail] Syncing ${field}:`, value, extra || '');
    try {
      const update: Record<string, any> = { [field]: value, ...extra };
      const { error } = await supabase.from('tasks').update(update).eq('id', id);
      if (error) throw error;
      console.log(`[TaskDetail] ✓ ${field} synced successfully`);
      fetchTask();
    } catch (err: any) {
      console.error(`[TaskDetail] ✗ Error syncing ${field}:`, err);
    }
  }, [id, fetchTask]);

  const handleTitleChange = (text: string) => {
    setTitle(text);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      if (text.trim()) syncField('title', text.trim());
    }, 800);
  };

  const mapToEnum = (s: any): string => {
    if (!s) return 'todo';
    if (s.is_completed) return 'done';
    const n = s.name?.toLowerCase() || '';
    if (n.includes('progress') || n.includes('doing') || n.includes('active')) return 'in_progress';
    if (n.includes('review') || n.includes('testing') || n.includes('qa')) return 'review';
    if (n.includes('done') || n.includes('complete') || n.includes('closed')) return 'done';
    return 'todo';
  };

  const handleStatusChange = async (statusId: string) => {
    const st = statuses.find(s => s.id === statusId);
    if (!st) return;

    // If marking as completed, also stop timer
    if (st.is_completed && isRunning) {
      await pauseTimer();
    }

    syncField('custom_status_id', statusId, {
      status: mapToEnum(st),
      completed_at: st.is_completed ? new Date().toISOString() : null,
    });
  };

  const handlePriorityChange = (val: string) => {
    syncField('priority', val);
  };

  const dueDate = task?.due_date ? new Date(task.due_date + 'T00:00:00') : null;

  useEffect(() => {
    if (showDatePicker) {
      setTempDate(dueDate || new Date());
    }
  }, [showDatePicker]);

  const handleDateConfirm = (date: Date) => {
    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
    syncField('due_date', dateStr);
    setShowDatePicker(false);
  };

  const handleClearDate = () => {
    syncField('due_date', null);
    setShowDatePicker(false);
  };

  const handleQuickDate = (date: Date) => {
    handleDateConfirm(date);
  };

  const handlePauseStatusChange = async (statusId: string) => {
    const st = statuses.find(s => s.id === statusId);
    if (!st) return;
    try {
      await supabase.from('tasks').update({
        custom_status_id: statusId,
        status: mapToEnum(st),
        ...(st.is_completed ? { completed_at: new Date().toISOString() } : {}),
      }).eq('id', id);
      console.log('[Timer] ✓ Status updated after pause:', st.name);
      fetchTask();
    } catch (err) {
      console.error('[Timer] ✗ Error updating status after pause:', err);
    }
  };

  const fetchStatuses = useCallback(async (projectId: string) => {
    try {
      const { data } = await supabase.from('project_statuses').select('*').eq('project_id', projectId).order('position');
      setStatuses(data || []);
    } catch (error) { console.error('Error fetching statuses:', error); }
  }, []);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*, user:profiles!task_comments_user_id_fkey(full_name, email)')
        .eq('task_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const map = new Map<string, Comment>();
      const roots: Comment[] = [];
      (data || []).forEach((c: any) => map.set(c.id, { ...c, replies: [] }));
      map.forEach(c => {
        if (c.parent_id) { const p = map.get(c.parent_id); if (p) p.replies!.push(c); }
        else roots.push(c);
      });
      setComments(roots);
    } catch (error) { console.error('Error fetching comments:', error); }
  }, [id]);

  const fetchAttachments = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*, uploader:profiles!task_attachments_user_id_fkey(full_name, email)')
        .eq('task_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAttachments(data || []);
    } catch (error) { console.error('Error fetching attachments:', error); }
  }, [id]);

  const fetchLinks = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('task_links')
        .select('*, creator:profiles!task_links_user_id_fkey(full_name, email)')
        .eq('task_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLinks(data || []);
    } catch (error) { console.error('Error fetching links:', error); }
  }, [id]);

  const fetchAssignees = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('task_assignees')
        .select('*, profile:profiles!task_assignees_user_id_fkey(id, full_name, email, avatar_url)')
        .eq('task_id', id)
        .order('assigned_at', { ascending: true });
      if (error) {
        // Table may not exist yet — silently fall back to empty
        setAssignees([]);
        return;
      }
      setAssignees(data || []);
    } catch (error) {
      setAssignees([]);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      if (!currentWorkspace?.id || !id) return;
      setIsLoading(true);
      try {
        const [projectsRes, membersRes] = await Promise.all([
          supabase.from('projects').select('id, name, color').eq('workspace_id', currentWorkspace.id).eq('is_archived', false),
          supabase.from('workspace_members').select('user_id, profiles:profiles!workspace_members_user_id_fkey(id, full_name, avatar_url, email)').eq('workspace_id', currentWorkspace.id),
        ]);
        setProjects(projectsRes.data || []);
        const membersData = membersRes.data?.map((m: any) => m.profiles).filter(Boolean) || [];
        setMembers(membersData);

        const taskData = await fetchTask();
        if (taskData?.project_id) {
          await fetchStatuses(taskData.project_id);
        }
        await Promise.all([fetchComments(), fetchAttachments(), fetchLinks(), fetchAssignees()]);
      } catch (error) {
        console.error('Error initializing:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [id, currentWorkspace?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`task-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${id}` }, () => fetchTask())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${id}` }, () => fetchComments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_attachments', filter: `task_id=eq.${id}` }, () => fetchAttachments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_links', filter: `task_id=eq.${id}` }, () => fetchLinks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_work_sessions', filter: `task_id=eq.${id}` }, () => {
        console.log('[Realtime] Work sessions changed, refreshing timer...');
        timerRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees', filter: `task_id=eq.${id}` }, () => fetchAssignees())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Re-fetch statuses when project changes
  useEffect(() => {
    if (task?.project_id) fetchStatuses(task.project_id);
  }, [task?.project_id]);

  const handleTaskUpdated = useCallback(() => {
    fetchTask();
  }, [fetchTask]);

  const handleDelete = useCallback(() => {
    router.back();
  }, []);

  // 3-dot menu state
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showTransferPicker, setShowTransferPicker] = useState(false);

  const handleDeleteTask = () => {
    setShowOptionsMenu(false);
    Alert.alert('Delete Task', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          console.log('[Activity] Deleting task:', id);
          try {
            const { error } = await supabase.from('tasks').delete().eq('id', id);
            if (error) throw error;
            console.log('[Activity] ✓ Task deleted');
            router.back();
          } catch (err: any) {
            console.error('[Activity] ✗ Error deleting task:', err);
            Alert.alert('Error', 'Failed to delete task');
          }
        }
      },
    ]);
  };

  const handleTransferProject = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    console.log(`[Activity] Transferring task to project: ${proj?.name || projectId}`);
    supabase.from('tasks').update({ project_id: projectId }).eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('[Activity] ✗ Transfer failed:', error);
          Alert.alert('Error', 'Failed to transfer task');
        } else {
          console.log('[Activity] ✓ Task transferred to:', proj?.name);
          fetchTask();
        }
      });
    setShowTransferPicker(false);
  };

  // ─── Tabs ───
  const TABS: { key: TabKey; label: string; Icon: any; count?: number }[] = [
    { key: 'details', label: 'Details', Icon: Target },
    { key: 'sessions', label: 'Sessions', Icon: History, count: sessions.length },
    { key: 'activity', label: 'Activity', Icon: Activity },
    { key: 'comments', label: 'Comments', Icon: MessageCircle, count: comments.length },
  ];

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={{ color: '#94A3B8', fontSize: 16 }}>Task not found</Text>
      </View>
    );
  }

  const projectName = projects.find(p => p.id === task.project_id)?.name;
  const projectColor = projects.find(p => p.id === task.project_id)?.color || '#F97316';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar style="dark" />

      {/* ─── Custom Header ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{task.title}</Text>
            {projectName && (
              <View style={styles.headerProject}>
                <View style={[styles.headerDot, { backgroundColor: projectColor }]} />
                <Text style={styles.headerProjectText} numberOfLines={1}>{projectName}</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowOptionsMenu(true)} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MoreVertical size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* ─── Timer Bar ─── */}
      {!timerLoading && (
        <View style={styles.timerBar}>
          <View style={styles.timerLeft}>
            <View style={[styles.timerIcon, isRunning && { backgroundColor: '#DCFCE7' }]}>
              {isRunning ? <Clock size={18} color="#22C55E" /> : isCompleted ? <CheckCircle2 size={18} color="#22C55E" /> : <Clock size={18} color="#94A3B8" />}
            </View>
            <View>
              <Text style={styles.timerValue}>
                {isRunning ? formatTimeLive(displayTime) : formatTime(displayTime)}
              </Text>
              <Text style={styles.timerSub}>
                {isRunning ? '● Running' : sessions.length > 0 ? `${sessions.length} session${sessions.length > 1 ? 's' : ''}` : 'No time tracked'}
              </Text>
            </View>
          </View>
          <View style={styles.timerActions}>
            {isCompleted ? (
              <View style={styles.completedBadge}>
                <CheckCircle2 size={14} color="#22C55E" />
                <Text style={styles.completedBadgeText}>Done</Text>
              </View>
            ) : isRunning ? (
              <>
                <TouchableOpacity style={[styles.timerBtn, { backgroundColor: '#F97316' }]} onPress={handlePauseTimer}>
                  <Pause size={14} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.timerBtn, { backgroundColor: '#22C55E' }]} onPress={completeTask}>
                  <CheckCircle2 size={14} color="#FFF" />
                </TouchableOpacity>
              </>
            ) : firstStartedAt ? (
              <>
                <TouchableOpacity style={[styles.timerBtn, { backgroundColor: '#F97316' }]} onPress={resumeTimer}>
                  <Play size={14} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.timerBtn, { backgroundColor: '#22C55E' }]} onPress={completeTask}>
                  <CheckCircle2 size={14} color="#FFF" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.timerBtn, { backgroundColor: '#F97316' }]} onPress={startTimer}>
                <Play size={14} color="#FFF" />
                <Text style={styles.timerBtnText}>Start</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ─── Mini Stats ─── */}
      {!timerLoading && (firstStartedAt || completedAt) && (
        <View style={styles.miniStats}>
          {firstStartedAt && (
            <View style={styles.miniStatItem}>
              <View style={[styles.miniStatDot, { backgroundColor: '#F97316' }]} />
              <Text style={styles.miniStatLabel}>Started</Text>
              <Text style={styles.miniStatValue}>{format(firstStartedAt, 'MMM d')}</Text>
            </View>
          )}
          {completedAt && (
            <View style={styles.miniStatItem}>
              <View style={[styles.miniStatDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.miniStatLabel}>Completed</Text>
              <Text style={styles.miniStatValue}>{format(completedAt, 'MMM d')}</Text>
            </View>
          )}
          {firstStartedAt && (
            <View style={styles.miniStatItem}>
              <View style={[styles.miniStatDot, { backgroundColor: '#8B5CF6' }]} />
              <Text style={styles.miniStatLabel}>Elapsed</Text>
              <Text style={styles.miniStatValue}>
                {Math.max(1, Math.ceil(((completedAt || new Date()).getTime() - firstStartedAt.getTime()) / (1000 * 60 * 60 * 24)))}d
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ─── Title and Bubbles (Visible on all tabs) ─── */}
      <View style={styles.sharedHeaders}>
        <TextInput
          style={[styles.titleInput, isCompleted && { textDecorationLine: 'line-through', color: '#94A3B8' }]}
          placeholder="Task title..."
          placeholderTextColor="#CBD5E1"
          value={title}
          onChangeText={handleTitleChange}
          multiline
        />

        <View style={{ height: 40, marginBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbleRow}>
            {/* Status */}
            <TouchableOpacity style={[styles.bubble, { borderColor: (currentStatus?.color || '#94A3B8') + '40' }]} onPress={() => setShowStatusPicker(true)}>
              <View style={[styles.bubbleDot, { backgroundColor: currentStatus?.color || '#94A3B8' }]} />
              <Text style={styles.bubbleText} numberOfLines={1}>{currentStatus?.name || 'Status'}</Text>
              <ChevronDown size={12} color="#94A3B8" />
            </TouchableOpacity>

            {/* Assignees */}
            <TouchableOpacity style={[styles.bubble, effectiveAssignees.length > 0 && { borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }]} onPress={() => assigneeRef.current?.openPicker()}>
              <UserIcon size={12} color={effectiveAssignees.length > 0 ? '#F97316' : '#94A3B8'} />
              <Text style={[styles.bubbleText, effectiveAssignees.length > 0 && { color: '#F97316' }]} numberOfLines={1}>
                {effectiveAssignees.length === 0 ? 'Assignee' : effectiveAssignees.length === 1 ? (effectiveAssignees[0].profile?.full_name?.split(' ')[0] || effectiveAssignees[0].profile?.email?.split('@')[0] || 'Member') : `${effectiveAssignees.length} Assignees`}
              </Text>
              {effectiveAssignees.length > 0 && <ChevronDown size={12} color="#F97316" />}
            </TouchableOpacity>

            {/* Priority */}
            {(() => {
              const pInfo = PRIORITIES.find(p => p.value === task?.priority) || PRIORITIES[1];
              return (
                <TouchableOpacity style={[styles.bubble, { borderColor: pInfo.color + '40' }]} onPress={() => setShowPriorityPicker(true)}>
                  <Flag size={12} color={pInfo.color} />
                  <Text style={[styles.bubbleText, { color: pInfo.color }]}>{pInfo.label}</Text>
                </TouchableOpacity>
              );
            })()}

            {/* Due Date */}
            <TouchableOpacity style={[styles.bubble, dueDate ? { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' } : {}]} onPress={() => setShowDatePicker(true)}>
              <CalendarIcon size={12} color={dueDate ? '#F97316' : '#94A3B8'} />
              <Text style={[styles.bubbleText, dueDate ? { color: '#F97316' } : { color: '#94A3B8' }]}>
                {dueDate ? format(dueDate, 'MMM d') : 'Due date'}
              </Text>
              {dueDate && (
                <TouchableOpacity onPress={handleClearDate} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <X size={11} color="#EF4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
        <View style={styles.divider} />
      </View>

      {/* ─── Tab Content ─── */}
      <View style={{ flex: 1 }}>
        {activeTab === 'details' && (
          <TaskDetailsTab
            taskId={id!}
            task={task}
            attachments={attachments}
            links={links}
            userId={user?.id || ''}
            onTaskUpdated={handleTaskUpdated}
            onDelete={handleDelete}
            onAttachmentsRefresh={fetchAttachments}
            onLinksRefresh={fetchLinks}
          />
        )}
        {activeTab === 'sessions' && (
          <TaskSessionsTab
            sessions={sessions}
            isRunning={isRunning}
            elapsedTime={elapsedTime}
            totalWorkTime={totalWorkTime}
            onDeleteSession={deleteSession}
          />
        )}
        {activeTab === 'activity' && (
          <TaskActivityTab
            taskId={id!}
          />
        )}
        {activeTab === 'comments' && (
          <TaskCommentsTab
            taskId={id!}
            userId={user?.id || ''}
            comments={comments}
            onRefresh={fetchComments}
          />
        )}
      </View>

      {/* ─── Bottom Tab Bar (hidden when keyboard is up) ─── */}
      {!keyboardVisible && (
        <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.bottomTab}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.bottomTabIconWrap, active && styles.bottomTabIconWrapActive]}>
                  <tab.Icon size={18} color={active ? '#F97316' : '#94A3B8'} />
                </View>
                <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>{tab.label}</Text>
                {tab.count !== undefined && tab.count > 0 && (
                  <View style={[styles.bottomTabBadge, active && styles.bottomTabBadgeActive]}>
                    <Text style={[styles.bottomTabBadgeText, active && styles.bottomTabBadgeTextActive]}>{tab.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ─── 3-Dot Options Menu ─── */}
      <Modal visible={showOptionsMenu} transparent animationType="fade" onRequestClose={() => setShowOptionsMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowOptionsMenu(false)}>
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowOptionsMenu(false); setShowTransferPicker(true); }}>
              <FolderKanban size={18} color="#3B82F6" />
              <Text style={styles.menuItemText}>Transfer to Project</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteTask}>
              <Trash2 size={18} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Delete Task</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Transfer Project Picker ─── */}
      <PickerModal
        visible={showTransferPicker}
        onClose={() => setShowTransferPicker(false)}
        title="Transfer to Project"
        options={projects.map(p => ({ value: p.id, label: p.name, color: p.color }))}
        selectedValue={task?.project_id}
        onSelect={handleTransferProject}
      />

      {/* ─── Pause Status Dialog ─── */}
      <TimerPauseModal
        visible={showPauseDialog}
        onClose={() => setShowPauseDialog(false)}
        sessionDuration={formatTimeWithSeconds(pausedDuration)}
        statuses={statuses}
        currentStatusId={task?.custom_status_id || null}
        onStatusChange={handlePauseStatusChange}
      />
      {/* ─── Picker Modals ─── */}
      <PickerModal visible={showStatusPicker} onClose={() => setShowStatusPicker(false)} title="Select Status" options={statuses.map(st => ({ value: st.id, label: st.name, color: st.color, subtitle: st.is_default ? 'Default' : st.is_completed ? 'Completed' : undefined }))} selectedValue={task?.custom_status_id} onSelect={handleStatusChange} />
      <PickerModal visible={showPriorityPicker} onClose={() => setShowPriorityPicker(false)} title="Select Priority" options={PRIORITIES.map(p => ({ value: p.value, label: p.label, color: p.color }))} selectedValue={task?.priority} onSelect={handlePriorityChange} />

      {/* ─── Date Picker Modal ─── */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={dpStyles.overlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <TouchableOpacity style={dpStyles.sheet} activeOpacity={1} onPress={() => { }}>
            <View style={dpStyles.handle} />
            <View style={dpStyles.header}>
              <Text style={dpStyles.title}>Set Due Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={dpStyles.closeBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Quick date shortcuts */}
            <View style={dpStyles.shortcuts}>
              <TouchableOpacity style={dpStyles.shortcut} onPress={() => handleQuickDate(new Date())}>
                <View style={[dpStyles.shortcutIcon, { backgroundColor: '#FFF7ED' }]}>
                  <Sun size={16} color="#F97316" />
                </View>
                <Text style={dpStyles.shortcutText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dpStyles.shortcut} onPress={() => handleQuickDate(addDays(new Date(), 1))}>
                <View style={[dpStyles.shortcutIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Sunrise size={16} color="#3B82F6" />
                </View>
                <Text style={dpStyles.shortcutText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dpStyles.shortcut} onPress={() => handleQuickDate(nextMonday(new Date()))}>
                <View style={[dpStyles.shortcutIcon, { backgroundColor: '#F5F3FF' }]}>
                  <CalendarDays size={16} color="#8B5CF6" />
                </View>
                <Text style={dpStyles.shortcutText}>Next Mon</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dpStyles.shortcut} onPress={() => handleQuickDate(addDays(new Date(), 7))}>
                <View style={[dpStyles.shortcutIcon, { backgroundColor: '#F0FDF4' }]}>
                  <CalendarIcon size={16} color="#22C55E" />
                </View>
                <Text style={dpStyles.shortcutText}>+1 Week</Text>
              </TouchableOpacity>
            </View>

            {/* Calendar — force light theme to prevent white-on-white */}
            <View style={dpStyles.calendarContainer}>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                onChange={(_e, d) => { if (d) setTempDate(d); }}
                accentColor="#F97316"
                themeVariant="light"
                style={{ alignSelf: 'center', width: '100%' }}
              />
            </View>

            {/* Action buttons */}
            <View style={dpStyles.actions}>
              {dueDate && (
                <TouchableOpacity style={dpStyles.clearBtn} onPress={handleClearDate}>
                  <XCircle size={15} color="#EF4444" />
                  <Text style={dpStyles.clearText}>Clear Date</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={dpStyles.confirmBtn} onPress={() => handleDateConfirm(tempDate)}>
                <Text style={dpStyles.confirmText}>Set Date</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <AssigneeSelector
        ref={assigneeRef}
        taskId={id!}
        userId={user?.id || ''}
        assignees={assignees}
        members={members}
        onRefresh={fetchAssignees}
        showInlineList={false}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },

  // Shared Headers
  sharedHeaders: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFF' },
  titleInput: { fontSize: 22, fontWeight: '700', color: '#0F172A', padding: 0, marginBottom: 8, textAlignVertical: 'top' },
  bubbleRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  bubbleDot: { width: 7, height: 7, borderRadius: 4 },
  bubbleText: { fontSize: 12, fontWeight: '600', color: '#475569', maxWidth: 100 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginTop: 4, marginBottom: 4 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFF' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerBtn: { padding: 6, borderRadius: 10, backgroundColor: '#F8FAFC' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  headerProject: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerDot: { width: 6, height: 6, borderRadius: 3 },
  headerProjectText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  // Timer bar
  timerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  timerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  timerValue: { fontSize: 18, fontWeight: '700', color: '#1E293B', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  timerSub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  timerActions: { flexDirection: 'row', gap: 6 },
  timerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  timerBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0FDF4' },
  completedBadgeText: { fontSize: 12, fontWeight: '600', color: '#22C55E' },

  // Mini stats
  miniStats: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  miniStatItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniStatDot: { width: 6, height: 6, borderRadius: 3 },
  miniStatLabel: { fontSize: 11, color: '#94A3B8' },
  miniStatValue: { fontSize: 11, fontWeight: '600', color: '#475569' },

  // Bottom tab bar
  bottomTabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFF', paddingTop: 6 },
  bottomTab: { flex: 1, alignItems: 'center', paddingVertical: 4, position: 'relative' as const },
  bottomTabIconWrap: { width: 36, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  bottomTabIconWrapActive: { backgroundColor: '#FFF7ED' },
  bottomTabText: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
  bottomTabTextActive: { color: '#F97316' },
  bottomTabBadge: { position: 'absolute' as const, top: 0, right: '20%' as any, backgroundColor: '#F1F5F9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, minWidth: 16, alignItems: 'center' },
  bottomTabBadgeActive: { backgroundColor: '#FFEDD5' },
  bottomTabBadgeText: { fontSize: 9, fontWeight: '700', color: '#94A3B8' },
  bottomTabBadgeTextActive: { color: '#F97316' },

  // 3-dot menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20 },
  menuItemText: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  menuDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 20 },
});

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  closeBtn: { padding: 6, borderRadius: 10, backgroundColor: '#F1F5F9' },
  shortcuts: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  shortcut: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FAFBFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  shortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  calendarContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 8,
  },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 12 },
  clearBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  clearText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  confirmBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F97316',
    ...Platform.select({
      ios: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
