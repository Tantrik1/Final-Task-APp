import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    Dimensions,
    Modal,
    TextInput,
    ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ProjectDetailSkeleton } from '@/components/ui/Skeleton';
import {
    ArrowLeft,
    Calendar,
    MoreVertical,
    Plus,
    List,
    LayoutGrid,
    Edit3,
    Trash2,
    Archive,
    X,
    Check,
    ChevronDown,
    AlertCircle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import Animated, { FadeIn } from 'react-native-reanimated';
import KanbanView from '@/components/project/KanbanView';
import ListView from '@/components/project/ListView';
import CalendarView from '@/components/project/CalendarView';
import { CreateTaskModal } from '@/components/CreateTaskModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_CONFIG = {
    todo:      { color: '#3B82F6', bg: '#EFF6FF', label: 'Todo',      short: 'TODO', order: 0 },
    active:    { color: '#F97316', bg: '#FFF7ED', label: 'Active',    short: 'ACT', order: 1 },
    done:      { color: '#22C55E', bg: '#F0FDF4', label: 'Done',      short: 'DONE', order: 2 },
    cancelled: { color: '#EF4444', bg: '#FEF2F2', label: 'Cancelled', short: 'CXL', order: 3 },
} as const;

const sortStatusesByCategoryAndPosition = (statuses: any[]) => {
    return [...statuses].sort((a, b) => {
        const catA = a.category || 'active';
        const catB = b.category || 'active';
        const orderA = CATEGORY_CONFIG[catA as keyof typeof CATEGORY_CONFIG]?.order ?? 1;
        const orderB = CATEGORY_CONFIG[catB as keyof typeof CATEGORY_CONFIG]?.order ?? 1;
        if (orderA !== orderB) return orderA - orderB;
        return (a.position ?? 0) - (b.position ?? 0);
    });
};

interface Project {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    created_at: string;
}

interface Task {
    id: string;
    title: string;
    status: string;
    custom_status_id?: string | null;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string | null;
    description?: string | null;
    assigned_to?: string | null;
    assignee?: {
        full_name: string;
        avatar_url: string;
    } | null;
}

type ViewType = 'kanban' | 'list' | 'calendar';

const VIEW_TABS: { key: ViewType; label: string; Icon: any }[] = [
    { key: 'list', label: 'List', Icon: List },
    { key: 'kanban', label: 'Board', Icon: LayoutGrid },
    { key: 'calendar', label: 'Calendar', Icon: Calendar },
];

export default function ProjectDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewType, setViewType] = useState<ViewType>('list');
    const [projectStatuses, setProjectStatuses] = useState<any[]>([]);

    // Project edit/delete state
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editColor, setEditColor] = useState('');
    const [isSavingProject, setIsSavingProject] = useState(false);
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
    const hasMounted = useRef(false);

    // Status editor state
    const [editStatuses, setEditStatuses] = useState<any[]>([]);
    const [editingStatusColorIdx, setEditingStatusColorIdx] = useState<number | null>(null);
    const [deletedStatusIds, setDeletedStatusIds] = useState<string[]>([]);
    const [statusMapping, setStatusMapping] = useState<Record<string, string>>({});
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [pendingDeleteTaskCount, setPendingDeleteTaskCount] = useState(0);
    const [draggedStatusIdx, setDraggedStatusIdx] = useState<number | null>(null);

    const fetchProjectDetails = useCallback(async () => {
        if (!id) return;
        try {
            const [projectResult, statusResult, viewResult, taskResult] = await Promise.all([
                supabase.from('projects').select('*').eq('id', id).single(),
                supabase.from('project_statuses').select('*').eq('project_id', id).order('position'),
                supabase.from('project_views').select('*').eq('project_id', id).order('position'),
                supabase.from('tasks').select(`*, assignee:profiles!tasks_assigned_to_fkey(full_name, avatar_url)`).eq('project_id', id).order('position'),
            ]);

            if (projectResult.error) throw projectResult.error;
            setProject(projectResult.data);
            setProjectStatuses(sortStatusesByCategoryAndPosition(statusResult.data || []));

            if (viewResult.data && viewResult.data.length > 0) {
                const defaultView = viewResult.data.find((v: any) => v.is_default) || viewResult.data[0];
                if (defaultView.view_type === 'calendar') setViewType('calendar');
                else if (defaultView.view_type === 'list') setViewType('list');
                else setViewType('kanban');
            }

            if (taskResult.error) {
                const { data: fallback } = await supabase.from('tasks').select('*').eq('project_id', id).order('position');
                setTasks(fallback || []);
            } else {
                setTasks(taskResult.data || []);
            }
        } catch (error) {
            console.error('Error fetching project details:', error);
            Alert.alert('Error', 'Failed to load project details');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchProjectDetails();
    }, [fetchProjectDetails]);

    // Re-fetch when screen regains focus (back navigation)
    useFocusEffect(
        useCallback(() => {
            if (hasMounted.current) {
                fetchProjectDetails();
            } else {
                hasMounted.current = true;
            }
        }, [fetchProjectDetails])
    );

    // Realtime subscription for tasks + statuses
    useEffect(() => {
        if (!id) return;
        const channel = supabase
            .channel(`project-detail-rt-${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${id}` }, () => {
                fetchProjectDetails();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_statuses', filter: `project_id=eq.${id}` }, () => {
                fetchProjectDetails();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, fetchProjectDetails]);

    const toggleTaskComplete = useCallback(async (task: Task) => {
        const status = task.custom_status_id
            ? projectStatuses.find(s => s.id === task.custom_status_id)
            : null;
        const currentlyDone = status?.category === 'done' || status?.category === 'cancelled' || status?.is_completed || false;

        let targetStatus: any;
        if (currentlyDone) {
            targetStatus = projectStatuses.find(s => s.category === 'todo' || s.is_default) || projectStatuses[0];
        } else {
            targetStatus = projectStatuses.find(s => s.category === 'done' || s.is_completed) || projectStatuses[projectStatuses.length - 1];
        }

        if (!targetStatus) return;

        // Optimistic update
        const prevTasks = tasks;
        setTasks(prev => prev.map(t =>
            t.id === task.id
                ? { ...t, custom_status_id: targetStatus.id }
                : t
        ));

        try {
            // Only write custom_status_id — DB trigger handles status, completed_at, first_started_at
            const { error } = await supabase
                .from('tasks')
                .update({ custom_status_id: targetStatus.id })
                .eq('id', task.id);
            if (error) throw error;
        } catch (error) {
            console.error('Error toggling task:', error);
            setTasks(prevTasks);
            Alert.alert('Error', 'Failed to update task');
        }
    }, [projectStatuses, tasks]);

    // Stats
    const stats = useMemo(() => {
        const total = tasks.length;
        const done = tasks.filter(t => {
            if (!t.custom_status_id) return false;
            const s = projectStatuses.find(s => s.id === t.custom_status_id);
            return s?.category === 'done' || s?.category === 'cancelled' || s?.is_completed || false;
        }).length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        return { total, done, progress };
    }, [tasks, projectStatuses]);

    const projectColor = project?.color || '#F97316';

    const PROJECT_COLORS = [
        '#F97316', '#EF4444', '#EC4899', '#8B5CF6', '#6366F1',
        '#3B82F6', '#06B6D4', '#14B8A6', '#22C55E', '#EAB308',
        '#78716C', '#64748B',
    ];

    const openEditModal = () => {
        if (!project) return;
        setEditName(project.name);
        setEditDescription(project.description || '');
        setEditColor(project.color || '#F97316');
        setEditStatuses(projectStatuses.map(s => ({
            ...s,
            _isNew: false,
            category: s.category || (s.is_completed ? 'done' : s.is_default ? 'todo' : 'active'),
        })));
        setDeletedStatusIds([]);
        setStatusMapping({});
        setEditingStatusColorIdx(null);
        setShowOptionsMenu(false);
        setShowEditModal(true);
    };

    // Check task count for a status before deleting
    const handleDeleteStatus = async (statusId: string, globalIdx: number) => {
        if (editStatuses.length <= 2) {
            Alert.alert('Minimum Statuses', 'You need at least 2 statuses.');
            return;
        }
        const cat = editStatuses[globalIdx]?.category;
        if (cat === 'done' && editStatuses.filter(s => s.category === 'done').length <= 1) {
            Alert.alert('Required', 'You must keep a "Done" status for completion tracking.');
            return;
        }

        // For new statuses that aren't in DB yet, just remove
        if (editStatuses[globalIdx]._isNew) {
            setEditStatuses(prev => prev.filter((_, i) => i !== globalIdx));
            return;
        }

        // Check how many tasks use this status
        const { count } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('custom_status_id', statusId);

        if (count && count > 0) {
            // Show mapping modal — user must choose where to move tasks
            setPendingDeleteId(statusId);
            setPendingDeleteTaskCount(count);
            setShowMappingModal(true);
        } else {
            // No tasks — safe to delete
            setEditStatuses(prev => prev.filter((_, i) => i !== globalIdx));
            setDeletedStatusIds(prev => [...prev, statusId]);
        }
    };

    const confirmStatusMapping = (targetStatusId: string) => {
        if (!pendingDeleteId) return;
        setStatusMapping(prev => ({ ...prev, [pendingDeleteId]: targetStatusId }));
        setEditStatuses(prev => prev.filter(s => s.id !== pendingDeleteId));
        setDeletedStatusIds(prev => [...prev, pendingDeleteId]);
        setPendingDeleteId(null);
        setShowMappingModal(false);
    };

    const handleUpdateProject = async () => {
        if (!project || !editName.trim()) return;

        // Validate categories
        const doneCount = editStatuses.filter(s => s.category === 'done').length;
        const todoCount = editStatuses.filter(s => s.category === 'todo').length;
        if (doneCount !== 1) {
            Alert.alert('Invalid', 'You need exactly 1 "Done" status.');
            return;
        }
        if (todoCount < 1) {
            Alert.alert('Invalid', 'You need at least 1 "Todo" status.');
            return;
        }

        setIsSavingProject(true);
        try {
            // 1. Update project metadata
            const { error } = await supabase
                .from('projects')
                .update({
                    name: editName.trim(),
                    description: editDescription.trim() || null,
                    color: editColor,
                })
                .eq('id', project.id);
            if (error) throw error;

            // 2. Reassign tasks from deleted statuses (mapping)
            for (const [fromId, toId] of Object.entries(statusMapping)) {
                await supabase
                    .from('tasks')
                    .update({ custom_status_id: toId })
                    .eq('custom_status_id', fromId);
            }

            // 3. Delete removed statuses
            if (deletedStatusIds.length > 0) {
                await supabase
                    .from('project_statuses')
                    .delete()
                    .in('id', deletedStatusIds);
            }

            // 4. Recalculate positions per category, then upsert
            const statusesByCategory = {
                todo: editStatuses.filter(s => s.category === 'todo'),
                active: editStatuses.filter(s => s.category === 'active'),
                done: editStatuses.filter(s => s.category === 'done'),
                cancelled: editStatuses.filter(s => s.category === 'cancelled'),
            };

            // Assign position within each category
            for (const cat of ['todo', 'active', 'done', 'cancelled'] as const) {
                const catStatuses = statusesByCategory[cat];
                for (let i = 0; i < catStatuses.length; i++) {
                    const s = catStatuses[i];
                    const statusData = {
                        name: s.name,
                        color: s.color,
                        position: i,
                        is_default: cat === 'todo',
                        is_completed: cat === 'done' || cat === 'cancelled',
                        category: cat,
                    };

                    if (s._isNew) {
                        await supabase.from('project_statuses').insert({
                            ...statusData,
                            project_id: project.id,
                        });
                    } else {
                        await supabase.from('project_statuses')
                            .update(statusData)
                            .eq('id', s.id);
                    }
                }
            }

            // 5. Sync tasks whose status category changed
            // The DB trigger only fires on custom_status_id change, so we need to
            // manually sync tasks when the status *itself* moved categories.
            const origStatuses = projectStatuses; // snapshot before edit
            for (const s of editStatuses) {
                if (s._isNew) continue; // new statuses have no tasks yet
                const orig = origStatuses.find((o: any) => o.id === s.id);
                if (!orig || orig.category === s.category) continue; // category didn't change

                const nowCompleted = s.category === 'done' || s.category === 'cancelled';
                const enumStatus = s.category === 'todo' ? 'todo' : s.category === 'active' ? 'in_progress' : 'done';

                if (nowCompleted) {
                    await supabase
                        .from('tasks')
                        .update({ status: enumStatus, completed_at: new Date().toISOString() })
                        .eq('custom_status_id', s.id)
                        .is('completed_at', null);
                } else {
                    await supabase
                        .from('tasks')
                        .update({ status: enumStatus, completed_at: null })
                        .eq('custom_status_id', s.id);
                }
            }

            setProject({ ...project, name: editName.trim(), description: editDescription.trim() || null, color: editColor });
            setShowEditModal(false);
            setDraggedStatusIdx(null);
            fetchProjectDetails();
        } catch (error: any) {
            console.error('Error updating project:', error);
            Alert.alert('Error', 'Failed to update project: ' + error.message);
        } finally {
            setIsSavingProject(false);
        }
    };

    const handleArchiveProject = () => {
        if (!project) return;
        setShowOptionsMenu(false);
        Alert.alert('Archive Project', `Archive "${project.name}"? It will be hidden from your project list.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Archive', onPress: async () => {
                    try {
                        const { error } = await supabase.from('projects').update({ is_archived: true }).eq('id', project.id);
                        if (error) throw error;
                        router.back();
                    } catch (error: any) {
                        console.error('Error archiving project:', error);
                        Alert.alert('Error', 'Failed to archive project');
                    }
                }
            },
        ]);
    };

    const handleDeleteProject = () => {
        if (!project) return;
        setShowOptionsMenu(false);
        Alert.alert(
            'Delete Project',
            `Permanently delete "${project.name}" and all its tasks? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                            const { error } = await supabase.from('projects').delete().eq('id', project.id);
                            if (error) throw error;
                            router.back();
                        } catch (error: any) {
                            console.error('Error deleting project:', error);
                            Alert.alert('Error', 'Failed to delete project: ' + error.message);
                        }
                    }
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ProjectDetailSkeleton />
            </View>
        );
    }

    if (!project) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
                <Text style={[styles.errorText, { color: colors.text }]}>Project not found</Text>
                <TouchableOpacity 
                    onPress={() => router.back()} 
                    style={[
                        styles.backBtn, 
                        { 
                            backgroundColor: colors.primary,
                            shadowColor: colors.shadowColored,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 2,
                        }
                    ]}
                >
                    <ArrowLeft size={20} color={colors.buttonText} />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* ─── Header ─── */}
            <View style={[
                styles.header,
                {
                    backgroundColor: colors.card,
                    borderBottomColor: colors.border,
                    paddingTop: insets.top + 12,
                    paddingBottom: 12,
                }
            ]}>
                <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: colors.surface }]}
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                        {project.name}
                    </Text>
                    {project.description ? (
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {project.description}
                        </Text>
                    ) : null}
                </View>
                <TouchableOpacity
                    style={[styles.optionsButton, { backgroundColor: colors.surface }]}
                    onPress={() => setShowOptionsMenu(true)}
                >
                    <MoreVertical size={20} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* ─── Minimal Progress Strip ─── */}
            <View style={[styles.progressStrip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <View style={styles.progressStripRow}>
                    <Text style={[styles.progressStripLabel, { color: colors.textSecondary }]}>
                        {stats.done}/{stats.total} tasks
                    </Text>
                    <Text style={[styles.progressStripPct, { color: projectColor }]}>
                        {stats.progress}%
                    </Text>
                </View>
                <View style={[styles.progressStripTrack, { backgroundColor: colors.borderLight }]}>
                    <Animated.View
                        entering={FadeIn.delay(200).duration(600)}
                        style={[styles.progressStripFill, { width: `${stats.progress}%`, backgroundColor: projectColor }]}
                    />
                </View>
            </View>

            {/* ─── Content ─── */}
            <View style={[styles.content, { backgroundColor: colors.background }]}>
                {viewType === 'list' && (
                    <ListView
                        tasks={tasks}
                        statuses={projectStatuses}
                        onToggleComplete={toggleTaskComplete}
                        projectId={project.id}
                    />
                )}
                {viewType === 'kanban' && (
                    <KanbanView
                        tasks={tasks}
                        statuses={projectStatuses}
                        onToggleComplete={toggleTaskComplete}
                        projectId={project.id}
                        projectColor={projectColor}
                        onAddTask={() => setShowCreateTaskModal(true)}
                    />
                )}
                {viewType === 'calendar' && (
                    <CalendarView
                        tasks={tasks}
                        statuses={projectStatuses}
                        onToggleComplete={toggleTaskComplete}
                        projectId={project.id}
                        projectColor={projectColor}
                    />
                )}
            </View>

            {/* ─── Bottom View Tab Bar ─── */}
            <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.card, borderTopColor: colors.border }]}>
                {VIEW_TABS.map(tab => {
                    const isActive = viewType === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.bottomTab}
                            onPress={() => setViewType(tab.key)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.bottomTabIconWrap, isActive && { backgroundColor: projectColor + '18' }]}>
                                <tab.Icon size={18} color={isActive ? projectColor : colors.textTertiary} />
                            </View>
                            <Text style={[styles.bottomTabText, { color: colors.textTertiary }, isActive && { color: projectColor }]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ─── FAB ─── */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: projectColor }]}
                onPress={() => setShowCreateTaskModal(true)}
                activeOpacity={0.85}
            >
                <Plus size={24} color="#FFFFFF" strokeWidth={3} />
            </TouchableOpacity>

            {/* ─── Create Task Modal ─── */}
            <CreateTaskModal
                visible={showCreateTaskModal}
                onClose={() => setShowCreateTaskModal(false)}
                initialProjectId={project.id}
                onCreated={fetchProjectDetails}
            />

            {/* ─── Options Menu Modal ─── */}
            <Modal visible={showOptionsMenu} transparent animationType="fade" onRequestClose={() => setShowOptionsMenu(false)}>
                <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowOptionsMenu(false)}>
                    <View style={[styles.menuSheet, { backgroundColor: colors.card }]}>
                        <TouchableOpacity style={styles.menuItem} onPress={openEditModal}>
                            <Edit3 size={18} color={colors.text} />
                            <Text style={[styles.menuItemText, { color: colors.text }]}>Edit Project</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={handleArchiveProject}>
                            <Archive size={18} color={colors.warning} />
                            <Text style={[styles.menuItemText, { color: colors.warning }]}>Archive Project</Text>
                        </TouchableOpacity>
                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.menuItem} onPress={handleDeleteProject}>
                            <Trash2 size={18} color={colors.error} />
                            <Text style={[styles.menuItemText, { color: colors.error }]}>Delete Project</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ─── Edit Project Modal ─── */}
            <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
                <View style={styles.editOverlay}>
                    <View style={[styles.editSheet, { backgroundColor: colors.card }]}>
                        <View style={[styles.editHandle, { backgroundColor: colors.border }]} />
                        <View style={[styles.editHeader, { borderBottomColor: colors.border }]}>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <X size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <Text style={[styles.editTitle, { color: colors.text }]}>Edit Project</Text>
                            <TouchableOpacity onPress={handleUpdateProject} disabled={isSavingProject || !editName.trim()}>
                                {isSavingProject ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Text style={[styles.editSaveText, { color: colors.primary }, !editName.trim() && { color: colors.textTertiary }]}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                            {/* Name */}
                            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Project Name</Text>
                            <TextInput
                                style={[styles.editInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Project name"
                                placeholderTextColor={colors.textTertiary}
                            />

                            {/* Description */}
                            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Description</Text>
                            <TextInput
                                style={[styles.editInput, { minHeight: 80, textAlignVertical: 'top', color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                                value={editDescription}
                                onChangeText={setEditDescription}
                                placeholder="Add a description..."
                                placeholderTextColor={colors.textTertiary}
                                multiline
                            />

                            {/* Color */}
                            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Color</Text>
                            <View style={styles.colorGrid}>
                                {PROJECT_COLORS.map(color => (
                                    <TouchableOpacity
                                        key={color}
                                        style={[styles.colorSwatch, { backgroundColor: color }, editColor === color && styles.colorSwatchActive]}
                                        onPress={() => setEditColor(color)}
                                    >
                                        {editColor === color && <Check size={16} color="#FFF" />}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* ─── Workflow Statuses ─── */}
                            <Text style={[styles.editLabel, { color: colors.textSecondary, marginTop: 24 }]}>Workflow Statuses</Text>

                            {/* Validation warnings */}
                            {(() => {
                                const doneCount = editStatuses.filter(s => s.category === 'done').length;
                                const todoCount = editStatuses.filter(s => s.category === 'todo').length;
                                const warnings: string[] = [];
                                if (doneCount === 0) warnings.push('⚠ Need exactly 1 "Done" status');
                                if (todoCount === 0) warnings.push('⚠ Need at least 1 "Todo" status');
                                return warnings.length > 0 ? (
                                    <View style={{ marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}>
                                        {warnings.map((w, i) => (
                                            <Text key={i} style={{ fontSize: 11, color: '#DC2626', fontWeight: '500' }}>{w}</Text>
                                        ))}
                                    </View>
                                ) : null;
                            })()}

                            {/* Drag-and-drop hint */}
                            {draggedStatusIdx === null && (
                                <Text style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 8, fontStyle: 'italic' }}>Long-press a status to drag it to another category</Text>
                            )}

                            {/* Category-grouped status editor with drag-and-drop */}
                            {(['todo', 'active', 'done', 'cancelled'] as const).map(catKey => {
                                const cfg = CATEGORY_CONFIG[catKey];
                                const catStatuses = editStatuses
                                    .map((s, idx) => ({ ...s, _gIdx: idx }))
                                    .filter(s => s.category === catKey);
                                const isSingleton = catKey === 'done' || catKey === 'cancelled';
                                const canAdd = !isSingleton || catStatuses.length === 0;
                                const isDragging = draggedStatusIdx !== null;
                                const draggedStatus = isDragging ? editStatuses[draggedStatusIdx] : null;
                                const draggedFromThisCat = isDragging && draggedStatus?.category === catKey;
                                const canDropHere = isDragging && !draggedFromThisCat && (!isSingleton || catStatuses.length === 0);

                                return (
                                    <View key={catKey} style={{ marginBottom: 14 }}>
                                        {/* Category header / Drop zone */}
                                        <TouchableOpacity
                                            activeOpacity={canDropHere ? 0.7 : 1}
                                            onPress={() => {
                                                if (!canDropHere || draggedStatusIdx === null) return;
                                                setEditStatuses(prev => {
                                                    const next = [...prev];
                                                    next[draggedStatusIdx] = {
                                                        ...next[draggedStatusIdx],
                                                        category: catKey,
                                                        is_completed: catKey === 'done' || catKey === 'cancelled',
                                                        is_default: catKey === 'todo',
                                                    };
                                                    return next;
                                                });
                                                setDraggedStatusIdx(null);
                                            }}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8,
                                                padding: canDropHere ? 8 : 0,
                                                borderRadius: canDropHere ? 10 : 0,
                                                borderWidth: canDropHere ? 2 : 0,
                                                borderStyle: 'dashed' as any,
                                                borderColor: canDropHere ? cfg.color : 'transparent',
                                                backgroundColor: canDropHere ? cfg.bg : 'transparent',
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.color }} />
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cfg.label}</Text>
                                                <Text style={{ fontSize: 10, color: colors.textTertiary }}>{catStatuses.length}</Text>
                                                {isSingleton && !canDropHere && <Text style={{ fontSize: 9, color: colors.textTertiary, fontStyle: 'italic' }}>· max 1</Text>}
                                                {canDropHere && <Text style={{ fontSize: 10, fontWeight: '600', color: cfg.color, marginLeft: 4 }}>↓ Drop here</Text>}
                                                {isDragging && !canDropHere && !draggedFromThisCat && isSingleton && catStatuses.length > 0 && (
                                                    <Text style={{ fontSize: 9, color: colors.textTertiary, fontStyle: 'italic', marginLeft: 4 }}>full</Text>
                                                )}
                                            </View>
                                            {!isDragging && canAdd && (
                                                <TouchableOpacity
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: cfg.color + '15' }}
                                                    onPress={() => {
                                                        const defaultColors: Record<string, string> = { todo: '#3B82F6', active: '#F97316', done: '#22C55E', cancelled: '#EF4444' };
                                                        setEditStatuses(prev => [...prev, {
                                                            id: 'new_' + Math.random().toString(36).substr(2, 9),
                                                            name: catKey === 'done' ? 'Done' : catKey === 'cancelled' ? 'Cancelled' : 'New Status',
                                                            color: defaultColors[catKey] || '#64748B',
                                                            position: prev.length,
                                                            is_default: catKey === 'todo',
                                                            is_completed: catKey === 'done' || catKey === 'cancelled',
                                                            category: catKey,
                                                            _isNew: true,
                                                        }]);
                                                    }}
                                                >
                                                    <Plus size={12} color={cfg.color} />
                                                    <Text style={{ fontSize: 10, fontWeight: '600', color: cfg.color }}>Add</Text>
                                                </TouchableOpacity>
                                            )}
                                        </TouchableOpacity>

                                        {catStatuses.length === 0 && !canDropHere ? (
                                            <View style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: cfg.color + '30', backgroundColor: cfg.bg }}>
                                                <Text style={{ fontSize: 11, color: cfg.color, opacity: 0.6, textAlign: 'center' }}>No {cfg.label.toLowerCase()} statuses</Text>
                                            </View>
                                        ) : catStatuses.length > 0 ? (
                                            <View style={{ gap: 4 }}>
                                                {catStatuses.map((status, catIdx) => {
                                                    const gIdx = status._gIdx;
                                                    const isBeingDragged = draggedStatusIdx === gIdx;
                                                    return (
                                                        <View key={status.id} style={{ opacity: isBeingDragged ? 0.4 : 1 }}>
                                                            <TouchableOpacity
                                                                activeOpacity={0.8}
                                                                onLongPress={() => {
                                                                    setDraggedStatusIdx(gIdx);
                                                                    setEditingStatusColorIdx(null);
                                                                }}
                                                                delayLongPress={300}
                                                                style={{
                                                                    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, borderWidth: isBeingDragged ? 2 : 1,
                                                                    backgroundColor: isBeingDragged ? cfg.bg : colors.surface,
                                                                    borderColor: isBeingDragged ? cfg.color : cfg.color + '25',
                                                                    borderLeftWidth: 3, borderLeftColor: cfg.color,
                                                                }}
                                                            >
                                                                {/* Reorder buttons (within category) */}
                                                                {!isDragging && (
                                                                    <View style={{ flexDirection: 'column', gap: 2 }}>
                                                                        <TouchableOpacity
                                                                            onPress={() => {
                                                                                if (catIdx > 0) {
                                                                                    const prevStatus = catStatuses[catIdx - 1];
                                                                                    setEditStatuses(prev => {
                                                                                        const next = [...prev];
                                                                                        [next[gIdx], next[prevStatus._gIdx]] = [next[prevStatus._gIdx], next[gIdx]];
                                                                                        return next;
                                                                                    });
                                                                                }
                                                                            }}
                                                                            disabled={catIdx === 0}
                                                                            style={{ opacity: catIdx === 0 ? 0.3 : 1 }}
                                                                        >
                                                                            <ChevronDown size={12} color={colors.textTertiary} style={{ transform: [{ rotate: '180deg' }] }} />
                                                                        </TouchableOpacity>
                                                                        <TouchableOpacity
                                                                            onPress={() => {
                                                                                if (catIdx < catStatuses.length - 1) {
                                                                                    const nextStatus = catStatuses[catIdx + 1];
                                                                                    setEditStatuses(prev => {
                                                                                        const next = [...prev];
                                                                                        [next[gIdx], next[nextStatus._gIdx]] = [next[nextStatus._gIdx], next[gIdx]];
                                                                                        return next;
                                                                                    });
                                                                                }
                                                                            }}
                                                                            disabled={catIdx === catStatuses.length - 1}
                                                                            style={{ opacity: catIdx === catStatuses.length - 1 ? 0.3 : 1 }}
                                                                        >
                                                                            <ChevronDown size={12} color={colors.textTertiary} />
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                )}
                                                                {/* Color dot */}
                                                                <TouchableOpacity
                                                                    style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: status.color }}
                                                                    onPress={() => !isDragging && setEditingStatusColorIdx(editingStatusColorIdx === gIdx ? null : gIdx)}
                                                                />
                                                                {/* Name input */}
                                                                <TextInput
                                                                    style={{ flex: 1, fontSize: 13, fontWeight: '500', padding: 0, color: colors.text }}
                                                                    value={status.name}
                                                                    editable={!isDragging}
                                                                    onChangeText={(text) => {
                                                                        setEditStatuses(prev => {
                                                                            const next = [...prev];
                                                                            next[gIdx] = { ...next[gIdx], name: text };
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    placeholderTextColor={colors.textTertiary}
                                                                />
                                                                {/* Category pill (tap to cycle when not dragging) */}
                                                                {!isDragging && (
                                                                    <TouchableOpacity
                                                                        onPress={() => {
                                                                            const CATS = ['todo', 'active', 'done', 'cancelled'] as const;
                                                                            const curIdx = CATS.indexOf(catKey);
                                                                            let nextCat = CATS[(curIdx + 1) % CATS.length];
                                                                            if (nextCat === 'done' && editStatuses.some((s, i) => i !== gIdx && s.category === 'done')) nextCat = 'cancelled';
                                                                            if (nextCat === 'cancelled' && editStatuses.some((s, i) => i !== gIdx && s.category === 'cancelled')) nextCat = 'todo';
                                                                            setEditStatuses(prev => {
                                                                                const next = [...prev];
                                                                                next[gIdx] = { ...next[gIdx], category: nextCat, is_completed: nextCat === 'done' || nextCat === 'cancelled', is_default: nextCat === 'todo' };
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, backgroundColor: cfg.bg, borderColor: cfg.color + '40' }}
                                                                    >
                                                                        <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.3, color: cfg.color }}>{cfg.short}</Text>
                                                                    </TouchableOpacity>
                                                                )}
                                                                {/* Delete */}
                                                                {!isDragging && (
                                                                    <TouchableOpacity onPress={() => handleDeleteStatus(status.id, gIdx)}>
                                                                        <Trash2 size={13} color="#EF4444" />
                                                                    </TouchableOpacity>
                                                                )}
                                                            </TouchableOpacity>
                                                            {/* Inline color picker */}
                                                            {editingStatusColorIdx === gIdx && !isDragging && (
                                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, marginTop: 4, borderRadius: 10, borderWidth: 1, justifyContent: 'center', backgroundColor: colors.card, borderColor: colors.border }}>
                                                                    {['#64748B', '#3B82F6', '#F97316', '#22C55E', '#EF4444', '#A855F7', '#EC4899', '#06B6D4', '#8B5CF6', '#F59E0B'].map(c => (
                                                                        <TouchableOpacity
                                                                            key={c}
                                                                            style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: 2.5, borderColor: status.color === c ? colors.text : 'transparent' }}
                                                                            onPress={() => {
                                                                                setEditStatuses(prev => {
                                                                                    const next = [...prev];
                                                                                    next[gIdx] = { ...next[gIdx], color: c };
                                                                                    return next;
                                                                                });
                                                                                setEditingStatusColorIdx(null);
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </View>
                                                            )}
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        ) : null}
                                    </View>
                                );
                            })}

                            {/* Floating drag banner */}
                            {draggedStatusIdx !== null && editStatuses[draggedStatusIdx] && (
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginTop: 4,
                                    backgroundColor: colors.primary + '15', borderWidth: 1.5, borderColor: colors.primary + '40',
                                }}>
                                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: editStatuses[draggedStatusIdx].color }} />
                                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>
                                        Moving "{editStatuses[draggedStatusIdx].name}"
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setDraggedStatusIdx(null)}
                                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                                    >
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── Status Mapping Modal (shown when deleting a status that has tasks) ─── */}
            <Modal visible={showMappingModal} transparent animationType="fade" onRequestClose={() => setShowMappingModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 16, width: '100%', maxWidth: 340, padding: 20, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24 }, android: { elevation: 12 } }) }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <AlertCircle size={20} color="#F97316" />
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 }}>Move Tasks</Text>
                        </View>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 }}>
                            This status has <Text style={{ fontWeight: '700', color: colors.text }}>{pendingDeleteTaskCount} task{pendingDeleteTaskCount !== 1 ? 's' : ''}</Text>. Choose where to move them before deleting:
                        </Text>
                        <View style={{ gap: 6 }}>
                            {editStatuses
                                .filter(s => s.id !== pendingDeleteId)
                                .map(s => {
                                    const cat = s.category || 'active';
                                    const cfg = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.active;
                                    return (
                                        <TouchableOpacity
                                            key={s.id}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
                                            onPress={() => confirmStatusMapping(s.id)}
                                        >
                                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                                            <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: colors.text }}>{s.name}</Text>
                                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: cfg.bg }}>
                                                <Text style={{ fontSize: 9, fontWeight: '700', color: cfg.color }}>{cfg.short}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                        </View>
                        <TouchableOpacity
                            style={{ marginTop: 12, padding: 10, borderRadius: 8, alignItems: 'center' }}
                            onPress={() => { setShowMappingModal(false); setPendingDeleteId(null); }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ─── Header ───
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 12,
    },
    projectDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 2,
        opacity: 0.6,
    },
    optionsButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ─── Progress Strip ───
    progressStrip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    progressStripRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressStripLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    progressStripPct: {
        fontSize: 13,
        fontWeight: '800',
    },
    progressStripTrack: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressStripFill: {
        height: '100%',
        borderRadius: 2,
    },
    // ─── View Switcher ───
    viewSwitcher: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
    },
    viewTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
        gap: 5,
        backgroundColor: '#F8FAFC',
    },
    viewTabActive: {
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
            android: { elevation: 3 },
        }),
    },
    viewTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
    },
    viewTabTextActive: {
        color: '#FFFFFF',
    },
    // ─── Content ───
    content: {
        flex: 1,
    },
    // ─── Bottom Tab Bar ───
    bottomTabBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        backgroundColor: '#FFF',
        paddingTop: 6,
    },
    bottomTab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
    },
    bottomTabIconWrap: {
        width: 36,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomTabText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 2,
    },
    // ─── FAB ───
    fab: {
        position: 'absolute',
        bottom: 80,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
            },
            android: { elevation: 8 },
        }),
    },
    // ─── Error / Empty ───
    errorText: {
        fontSize: 16,
        color: '#EF4444',
        marginBottom: 16,
    },
    backBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
    },
    backBtnText: {
        color: '#64748B',
        fontWeight: '600',
    },
    // ─── Options Menu ───
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuSheet: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        width: SCREEN_WIDTH * 0.7,
        paddingVertical: 8,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
            android: { elevation: 12 },
        }),
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#334155',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 16,
    },
    // ─── Edit Project Modal ───
    editOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    editSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '90%',
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    editHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 4,
    },
    editHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    editTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E293B',
    },
    editSaveText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F97316',
    },
    editLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 16,
    },
    editInput: {
        fontSize: 15,
        color: '#1E293B',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    colorSwatch: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorSwatchActive: {
        borderWidth: 3,
        borderColor: '#FFFFFF',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
            android: { elevation: 4 },
        }),
    },
});
