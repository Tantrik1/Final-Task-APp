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
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn } from 'react-native-reanimated';
import KanbanView from '@/components/project/KanbanView';
import ListView from '@/components/project/ListView';
import CalendarView from '@/components/project/CalendarView';
import { CreateTaskModal } from '@/components/CreateTaskModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    { key: 'kanban', label: 'Board', Icon: LayoutGrid },
    { key: 'list', label: 'List', Icon: List },
    { key: 'calendar', label: 'Calendar', Icon: Calendar },
];

export default function ProjectDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewType, setViewType] = useState<ViewType>('kanban');
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
            setProjectStatuses(statusResult.data || []);

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
        const currentlyDone = status?.is_completed || false;

        let targetStatus: any;
        if (currentlyDone) {
            targetStatus = projectStatuses.find(s => s.is_default) || projectStatuses[0];
        } else {
            targetStatus = projectStatuses.find(s => s.is_completed) || projectStatuses[projectStatuses.length - 1];
        }

        if (!targetStatus) return;

        const mapToEnum = (s: any): string => {
            if (!s) return 'todo';
            if (s.is_completed) return 'done';
            const n = s.name?.toLowerCase() || '';
            if (n.includes('progress') || n.includes('doing') || n.includes('active')) return 'in_progress';
            if (n.includes('review') || n.includes('testing') || n.includes('qa')) return 'review';
            if (n.includes('done') || n.includes('complete') || n.includes('closed')) return 'done';
            if (s.is_default) return 'todo';
            return 'todo';
        };

        // Optimistic update
        const prevTasks = tasks;
        setTasks(prev => prev.map(t =>
            t.id === task.id
                ? { ...t, custom_status_id: targetStatus.id, status: mapToEnum(targetStatus) }
                : t
        ));

        try {
            const { error } = await supabase
                .from('tasks')
                .update({
                    status: mapToEnum(targetStatus),
                    custom_status_id: targetStatus.id,
                    completed_at: currentlyDone ? null : new Date().toISOString(),
                })
                .eq('id', task.id);
            if (error) throw error;
        } catch (error) {
            console.error('Error toggling task:', error);
            setTasks(prevTasks); // Revert on error
            Alert.alert('Error', 'Failed to update task');
        }
    }, [projectStatuses, tasks]);

    // Stats
    const stats = useMemo(() => {
        const total = tasks.length;
        const done = tasks.filter(t => {
            if (!t.custom_status_id) return false;
            const s = projectStatuses.find(s => s.id === t.custom_status_id);
            return s?.is_completed || false;
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
        setShowOptionsMenu(false);
        setShowEditModal(true);
    };

    const handleUpdateProject = async () => {
        if (!project || !editName.trim()) return;
        setIsSavingProject(true);
        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    name: editName.trim(),
                    description: editDescription.trim() || null,
                    color: editColor,
                })
                .eq('id', project.id);
            if (error) throw error;
            setProject({ ...project, name: editName.trim(), description: editDescription.trim() || null, color: editColor });
            setShowEditModal(false);
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
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#F97316" />
            </View>
        );
    }

    if (!project) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
                <Text style={styles.errorText}>Project not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* ─── Header ─── */}
            <View style={[styles.header, { paddingTop: insets.top }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                        <ArrowLeft size={22} color="#1E293B" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <View style={[styles.headerDot, { backgroundColor: projectColor }]} />
                        <Text style={styles.headerTitle} numberOfLines={1}>{project.name}</Text>
                    </View>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setShowOptionsMenu(true)}>
                        <MoreVertical size={22} color="#1E293B" />
                    </TouchableOpacity>
                </View>

                {/* Progress bar */}
                <Animated.View entering={FadeIn.duration(400)} style={styles.progressSection}>
                    <View style={styles.progressInfo}>
                        <Text style={styles.progressLabel}>
                            {stats.done} of {stats.total} tasks
                        </Text>
                        <Text style={[styles.progressPercent, { color: projectColor }]}>
                            {stats.progress}%
                        </Text>
                    </View>
                    <View style={styles.progressTrack}>
                        <Animated.View
                            entering={FadeIn.delay(200).duration(600)}
                            style={[styles.progressFill, { width: `${stats.progress}%`, backgroundColor: projectColor }]}
                        />
                    </View>
                </Animated.View>

            </View>

            {/* ─── Content ─── */}
            <View style={styles.content}>
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
                {viewType === 'list' && (
                    <ListView
                        tasks={tasks}
                        statuses={projectStatuses}
                        onToggleComplete={toggleTaskComplete}
                        projectId={project.id}
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
            <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
                                <tab.Icon size={18} color={isActive ? projectColor : '#94A3B8'} />
                            </View>
                            <Text style={[styles.bottomTabText, isActive && { color: projectColor }]}>
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
                    <View style={styles.menuSheet}>
                        <TouchableOpacity style={styles.menuItem} onPress={openEditModal}>
                            <Edit3 size={18} color="#334155" />
                            <Text style={styles.menuItemText}>Edit Project</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={handleArchiveProject}>
                            <Archive size={18} color="#F97316" />
                            <Text style={[styles.menuItemText, { color: '#F97316' }]}>Archive Project</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem} onPress={handleDeleteProject}>
                            <Trash2 size={18} color="#EF4444" />
                            <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Delete Project</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ─── Edit Project Modal ─── */}
            <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
                <View style={styles.editOverlay}>
                    <View style={styles.editSheet}>
                        <View style={styles.editHandle} />
                        <View style={styles.editHeader}>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <X size={22} color="#64748B" />
                            </TouchableOpacity>
                            <Text style={styles.editTitle}>Edit Project</Text>
                            <TouchableOpacity onPress={handleUpdateProject} disabled={isSavingProject || !editName.trim()}>
                                {isSavingProject ? (
                                    <ActivityIndicator size="small" color="#F97316" />
                                ) : (
                                    <Text style={[styles.editSaveText, !editName.trim() && { color: '#CBD5E1' }]}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                            {/* Name */}
                            <Text style={styles.editLabel}>Project Name</Text>
                            <TextInput
                                style={styles.editInput}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Project name"
                                placeholderTextColor="#CBD5E1"
                            />

                            {/* Description */}
                            <Text style={styles.editLabel}>Description</Text>
                            <TextInput
                                style={[styles.editInput, { minHeight: 80, textAlignVertical: 'top' }]}
                                value={editDescription}
                                onChangeText={setEditDescription}
                                placeholder="Add a description..."
                                placeholderTextColor="#CBD5E1"
                                multiline
                            />

                            {/* Color */}
                            <Text style={styles.editLabel}>Color</Text>
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
                        </ScrollView>
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
        backgroundColor: '#FFFFFF',
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        ...Platform.select({
            ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    headerDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1E293B',
        maxWidth: SCREEN_WIDTH * 0.55,
    },
    // ─── Progress ───
    progressSection: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    progressLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94A3B8',
    },
    progressPercent: {
        fontSize: 13,
        fontWeight: '700',
    },
    progressTrack: {
        height: 4,
        backgroundColor: '#F1F5F9',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
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
        maxHeight: '85%',
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
