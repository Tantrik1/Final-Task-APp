import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    TextInput,
    Modal,
    Alert,
    Platform,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ProjectsSkeleton } from '@/components/ui/Skeleton';
import {
    Plus,
    FolderKanban,
    Trash2,
    CheckSquare,
    Search,
    Loader2,
    LayoutTemplate,
    X,
    Settings,
    ChevronDown,
    Archive,
    MoreVertical,
    Clock,
    Users,
    Rocket,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { SYSTEM_TEMPLATES, SystemTemplate } from '@/constants/systemTemplates';
import { useProjectTemplates, ProjectTemplate } from '@/hooks/useProjectTemplates';

const { width } = Dimensions.get('window');
const HORIZONTAL_PAD = 20;

const CATEGORY_CONFIG = {
    todo:      { color: '#3B82F6', bg: '#EFF6FF', label: 'Todo',      short: 'TODO' },
    active:    { color: '#F97316', bg: '#FFF7ED', label: 'Active',    short: 'ACT' },
    done:      { color: '#22C55E', bg: '#F0FDF4', label: 'Done',      short: 'DONE' },
    cancelled: { color: '#EF4444', bg: '#FEF2F2', label: 'Cancelled', short: 'CXL' },
} as const;

interface Project {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    is_archived: boolean;
    created_at: string;
    taskCounts?: {
        total: number;
        done: number;
    };
}

export default function Projects() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
    const { user } = useAuth();
    const { colors } = useTheme();

    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1); // 1 = name/desc, 2 = template
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');

    // Store selected template ID. Check if it's system or workspace based on ID lookup.
    // Default to "simple" template for beginner-friendly experience
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('simple');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Track if statuses have been modified by the user
    const [isStatusesModified, setIsStatusesModified] = useState(false);
    const [editableStatuses, setEditableStatuses] = useState<any[]>([]);
    const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
    const [draggedStatusIdx, setDraggedStatusIdx] = useState<number | null>(null);

    // Load template hook functions
    const {
        templates: workspaceTemplates,
        isLoading: templatesLoading,
        getTemplateDetails,
        createProjectFromTemplate,
        createProjectFromSystemTemplate,
        createProjectWithStatuses,
        refresh: refreshTemplates
    } = useProjectTemplates(currentWorkspace?.id);

    // Identify selected template object for display/logic
    const selectedTemplate = useMemo(() => {
        return SYSTEM_TEMPLATES.find(t => t.id === selectedTemplateId)
            || workspaceTemplates.find(t => t.id === selectedTemplateId);
    }, [selectedTemplateId, workspaceTemplates]);

    // Load statuses when template changes
    useEffect(() => {
        const loadStatuses = async () => {
            if (!selectedTemplateId) return;
            const details = await getTemplateDetails(selectedTemplateId);
            if (details && details.statuses) {
                setEditableStatuses(details.statuses.map((s: any, idx: number) => ({
                    ...s,
                    id: `temp-${idx}-${Date.now()}`,
                    position: idx,
                    category: s.category || (s.is_completed ? 'done' : s.is_default ? 'todo' : 'active'),
                })));
                setIsStatusesModified(false); // Reset modification flag on template change
            }
        };
        loadStatuses();
    }, [selectedTemplateId, getTemplateDetails]);


    // Context Menu State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [showOptionsModal, setShowOptionsModal] = useState(false);

    const fetchProjects = useCallback(async () => {
        if (!currentWorkspace?.id) return;

        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('workspace_id', currentWorkspace.id)
                .eq('is_archived', showArchived)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const projectsData = data || [];
            if (projectsData.length === 0) {
                setProjects([]);
                return;
            }

            const allProjectIds = projectsData.map(p => p.id);

            // Fetch all statuses for these projects to known which custom statuses are "completed"
            const { data: allStatuses } = await supabase
                .from('project_statuses')
                .select('id, is_completed, category')
                .in('project_id', allProjectIds);

            const completedStatusIds = new Set(
                (allStatuses || []).filter(s => s.category === 'done' || s.category === 'cancelled' || s.is_completed).map(s => s.id)
            );

            // Fetch ALL tasks for these projects in one single query
            const { data: allTasks } = await supabase
                .from('tasks')
                .select('id, project_id, custom_status_id, status')
                .in('project_id', allProjectIds);

            // Aggregate counts in memory
            const countsByProject: Record<string, { total: number, done: number }> = {};

            // Initialize counters
            allProjectIds.forEach(pid => {
                countsByProject[pid] = { total: 0, done: 0 };
            });

            (allTasks || []).forEach(task => {
                if (task.project_id && countsByProject[task.project_id]) {
                    countsByProject[task.project_id].total++;

                    const isCustomDone = task.custom_status_id && completedStatusIds.has(task.custom_status_id);
                    const isSystemDone = task.status === 'done';

                    if (isCustomDone || isSystemDone) {
                        countsByProject[task.project_id].done++;
                    }
                }
            });

            const projectsWithCounts = projectsData.map(project => ({
                ...project,
                taskCounts: countsByProject[project.id] || { total: 0, done: 0 }
            }));

            setProjects(projectsWithCounts);
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [currentWorkspace, showArchived]);

    useEffect(() => {
        if (!workspaceLoading && !currentWorkspace) {
            setIsLoading(false);
        }
    }, [workspaceLoading, currentWorkspace]);

    const hasMounted = useRef(false);

    useEffect(() => {
        if (currentWorkspace) {
            fetchProjects();
        }
    }, [currentWorkspace, fetchProjects]);

    // Re-fetch when tab regains focus (back navigation)
    useFocusEffect(
        useCallback(() => {
            if (hasMounted.current && currentWorkspace) {
                fetchProjects();
            } else {
                hasMounted.current = true;
            }
        }, [fetchProjects, currentWorkspace])
    );

    // Realtime subscription for projects
    useEffect(() => {
        if (!currentWorkspace?.id) return;
        const channel = supabase
            .channel(`projects-rt-${currentWorkspace.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `workspace_id=eq.${currentWorkspace.id}` }, () => {
                fetchProjects();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentWorkspace?.id, fetchProjects]);

    const handleCreateProject = async () => {
        if (!newProjectName.trim() || !currentWorkspace?.id || !user) return;

        // Validate category constraints
        const doneCount = editableStatuses.filter(s => (s as any).category === 'done').length;
        const todoCount = editableStatuses.filter(s => (s as any).category === 'todo').length;
        if (doneCount !== 1) {
            Alert.alert('Invalid Statuses', 'You need exactly 1 status with the "Done" category for completion tracking.');
            return;
        }
        if (todoCount < 1) {
            Alert.alert('Invalid Statuses', 'You need at least 1 status with the "Todo" category for new tasks.');
            return;
        }

        setIsSubmitting(true);
        try {
            let projectId: string | null = null;
            let errorOccurred: any = null;

            if (!isStatusesModified && selectedTemplate) {
                // Flow 1: Use template as-is (Optimized)
                if ('is_system' in selectedTemplate && selectedTemplate.is_system) {
                    projectId = await createProjectFromSystemTemplate(selectedTemplate as any, newProjectName.trim());
                } else {
                    projectId = await createProjectFromTemplate(selectedTemplate.id, newProjectName.trim());
                }

                if (!projectId) throw new Error('Failed to create project from template');
            } else {
                // Flow 2: Custom statuses edited by user
                const { data, error } = await createProjectWithStatuses(
                    {
                        name: newProjectName.trim(),
                        description: newProjectDesc.trim() || (selectedTemplate?.description || null),
                        icon: selectedTemplate?.icon || 'folder',
                        color: selectedTemplate?.color || '#3B82F6'
                    },
                    editableStatuses.map((s, idx) => {
                        const cat = (s as any).category || 'active';
                        return {
                            name: s.name,
                            color: s.color,
                            position: idx,
                            is_default: cat === 'todo',
                            is_completed: cat === 'done' || cat === 'cancelled',
                            category: cat,
                        };
                    })
                );

                if (error) throw error;
                projectId = data.id;
            }

            setNewProjectName('');
            setNewProjectDesc('');
            setIsCreateModalOpen(false);
            fetchProjects();

            if (projectId) {
                router.push(`/project/${projectId}` as any);
            }
        } catch (error: any) {
            console.error('Error creating project:', error);
            Alert.alert('Error', error.message || 'Failed to create project');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleArchiveProject = async () => {
        if (!selectedProject) return;
        try {
            const { error } = await supabase
                .from('projects')
                .update({ is_archived: !selectedProject.is_archived })
                .eq('id', selectedProject.id);

            if (error) throw error;

            setShowOptionsModal(false);
            fetchProjects();
        } catch (error) {
            console.error('Error archiving project:', error);
            Alert.alert('Error', 'Failed to update project status');
        }
    };

    const handleDeleteProject = async () => {
        if (!selectedProject) return;

        Alert.alert(
            'Delete Project',
            `Are you sure you want to delete "${selectedProject.name}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('projects')
                                .delete()
                                .eq('id', selectedProject.id);

                            if (error) throw error;
                            setShowOptionsModal(false);
                            fetchProjects();
                        } catch (error) {
                            console.error('Error deleting project:', error);
                            Alert.alert('Error', 'Failed to delete project');
                        }
                    }
                }
            ]
        );
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openOptions = (project: Project) => {
        setSelectedProject(project);
        setShowOptionsModal(true);
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchProjects();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* ─── Header ─── */}
            <View style={[styles.header, { paddingTop: 16 }]}>
                <View style={styles.titleRow}>
                    <View>
                        <Text style={[styles.pageTitle, { color: colors.text }]}>
                            {showArchived ? 'Archived' : 'Projects'}
                        </Text>
                        <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
                            {filteredProjects.length} {showArchived ? 'archived' : 'active'} project{filteredProjects.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={[
                                styles.archiveToggle,
                                {
                                    backgroundColor: showArchived ? colors.primary + '15' : 'transparent',
                                    borderColor: showArchived ? colors.primary + '30' : colors.border,
                                }
                            ]}
                            onPress={() => setShowArchived(!showArchived)}
                            activeOpacity={0.7}
                        >
                            <Archive size={18} color={showArchived ? colors.primary : colors.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.addProjectBtn,
                                { backgroundColor: colors.primary }
                            ]}
                            onPress={() => setIsCreateModalOpen(true)}
                            activeOpacity={0.8}
                        >
                            <Plus size={18} color="#fff" strokeWidth={2.5} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ─── Search ─── */}
                <View style={[
                    styles.searchBar,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        ...Platform.select({
                            ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
                            android: { elevation: 1 },
                        }),
                    }
                ]}>
                    <Search size={18} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={colors.textTertiary}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                            <X size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ─── FAB ─── */}
            <TouchableOpacity
                style={[
                    styles.fab,
                    {
                        backgroundColor: colors.primary,
                        ...Platform.select({
                            ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
                            android: { elevation: 6 },
                        }),
                    }
                ]}
                onPress={() => setIsCreateModalOpen(true)}
                activeOpacity={0.85}
            >
                <Plus size={24} color={colors.buttonText} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* ─── List ─── */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {isLoading && projects.length === 0 ? (
                    <ProjectsSkeleton />
                ) : filteredProjects.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={[styles.emptyIconBg, { backgroundColor: colors.primary + '12' }]}>
                            <FolderKanban size={40} color={colors.primary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                            {showArchived ? 'No Archived Projects' : 'No Projects Yet'}
                        </Text>
                        <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                            {showArchived
                                ? 'Projects you archive will appear here.'
                                : 'Organise your work into projects.\nTap below to create your first one.'}
                        </Text>
                        {!showArchived && (
                            <TouchableOpacity
                                style={[styles.createBtn, { backgroundColor: colors.primary }]}
                                onPress={() => setIsCreateModalOpen(true)}
                                activeOpacity={0.85}
                            >
                                <Plus size={18} color="#fff" strokeWidth={2.5} />
                                <Text style={styles.createBtnText}>Create Project</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.cardList}>
                        {filteredProjects.map(project => {
                            const total = project.taskCounts?.total ?? 0;
                            const done = project.taskCounts?.done ?? 0;
                            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                            const pColor = project.color || colors.primary;

                            return (
                                <TouchableOpacity
                                    key={project.id}
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor: colors.card,
                                            borderColor: colors.border,
                                            ...Platform.select({
                                                ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10 },
                                                android: { elevation: 2 },
                                            }),
                                        }
                                    ]}
                                    onPress={() => router.push(`/project/${project.id}` as any)}
                                    activeOpacity={0.7}
                                >
                                    {/* Left color accent */}
                                    <View style={[styles.cardAccent, { backgroundColor: pColor }]} />

                                    {/* Content */}
                                    <View style={styles.cardBody}>
                                        {/* Row 1: icon + title + menu */}
                                        <View style={styles.cardTopRow}>
                                            <View style={[styles.cardIcon, { backgroundColor: pColor + '18' }]}>
                                                <FolderKanban size={18} color={pColor} />
                                            </View>
                                            <View style={styles.cardTitleWrap}>
                                                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                                                    {project.name}
                                                </Text>
                                                {project.description ? (
                                                    <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                                        {project.description}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            <MoreVertical size={18} color={colors.textTertiary} />
                                        </View>

                                        {/* Row 2: stats chips + progress */}
                                        <View style={styles.cardBottomRow}>
                                            <View style={styles.chipRow}>
                                                <View style={[styles.chip, { backgroundColor: colors.surface }]}>
                                                    <CheckSquare size={12} color={colors.textSecondary} />
                                                    <Text style={[styles.chipText, { color: colors.textSecondary }]}>{done}/{total}</Text>
                                                </View>
                                                <View style={[styles.chip, { backgroundColor: colors.surface }]}>
                                                    <Clock size={12} color={colors.textSecondary} />
                                                    <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                                                        {new Date(project.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.progressWrap}>
                                                <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                                                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pColor }]} />
                                                </View>
                                                <Text style={[styles.progressPct, { color: pColor }]}>{pct}%</Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Create Project Modal */}
            <Modal
                visible={isCreateModalOpen}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setIsCreateModalOpen(false);
                    setCreateStep(1);
                }}
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <View style={[
                        styles.modalContentWrapper, 
                        { 
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                        }
                    ]}>
                        {/* Header with step indicator */}
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    {createStep === 1 ? 'Create Project' : 'Choose Template'}
                                </Text>
                                <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
                                    {createStep === 1 ? 'Give your project a name' : 'Pick a workflow template'}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 12 }}>
                                <View style={[styles.stepDot, { backgroundColor: colors.primary }]} />
                                <View style={[styles.stepLine, { backgroundColor: createStep === 2 ? colors.primary : colors.border }]} />
                                <View style={[styles.stepDot, { backgroundColor: createStep === 2 ? colors.primary : colors.border }]} />
                            </View>
                            <TouchableOpacity 
                                onPress={() => { setIsCreateModalOpen(false); setCreateStep(1); }}
                                style={[styles.modalCloseBtn, { backgroundColor: colors.surface }]}
                            >
                                <X size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {createStep === 1 ? (
                                <View style={{ paddingTop: 4 }}>
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.label, { color: colors.textSecondary }]}>Project Name <Text style={{ color: colors.primary }}>*</Text></Text>
                                        <TextInput
                                            style={[
                                                styles.input, 
                                                { 
                                                    backgroundColor: colors.surface,
                                                    borderColor: colors.border,
                                                    color: colors.text,
                                                }
                                            ]}
                                            placeholder="e.g. Website Redesign"
                                            value={newProjectName}
                                            onChangeText={setNewProjectName}
                                            placeholderTextColor={colors.textTertiary}
                                            autoFocus
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
                                        <TextInput
                                            style={[
                                                styles.input, 
                                                styles.textArea,
                                                { 
                                                    backgroundColor: colors.surface,
                                                    borderColor: colors.border,
                                                    color: colors.text,
                                                }
                                            ]}
                                            placeholder="What is this project about?"
                                            value={newProjectDesc}
                                            onChangeText={setNewProjectDesc}
                                            multiline
                                            placeholderTextColor={colors.textTertiary}
                                        />
                                    </View>
                                </View>
                            ) : (
                                <View style={{ paddingTop: 4 }}>
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.label, { color: colors.textSecondary }]}>Template</Text>
                                        {templatesLoading ? (
                                            <View style={{ padding: 20, alignItems: 'center' }}>
                                                <ActivityIndicator size="small" color={colors.primary} />
                                                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>Loading templates...</Text>
                                            </View>
                                        ) : (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll} contentContainerStyle={{ paddingRight: 8 }}>
                                                {SYSTEM_TEMPLATES.map(template => {
                                                    const isActive = selectedTemplateId === template.id;
                                                    return (
                                                        <TouchableOpacity
                                                            key={template.id}
                                                            style={[
                                                                styles.templateCard,
                                                                { backgroundColor: colors.surface, borderColor: colors.border },
                                                                isActive && { backgroundColor: template.color + '12', borderColor: template.color, borderWidth: 2 },
                                                            ]}
                                                            onPress={() => setSelectedTemplateId(template.id)}
                                                            activeOpacity={0.7}
                                                        >
                                                            {isActive && (
                                                                <View style={[styles.templateCheck, { backgroundColor: template.color }]}>
                                                                    <CheckSquare size={10} color="#FFF" />
                                                                </View>
                                                            )}
                                                            <View style={[styles.templateIcon, { backgroundColor: template.color + '20' }]}>
                                                                <FolderKanban size={20} color={template.color} />
                                                            </View>
                                                            <Text style={[styles.templateName, { color: isActive ? template.color : colors.text }]} numberOfLines={2}>{template.name}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}

                                                {workspaceTemplates.map(template => {
                                                    const isActive = selectedTemplateId === template.id;
                                                    return (
                                                        <TouchableOpacity
                                                            key={template.id}
                                                            style={[
                                                                styles.templateCard,
                                                                { backgroundColor: colors.surface, borderColor: colors.border },
                                                                isActive && { backgroundColor: template.color + '12', borderColor: template.color, borderWidth: 2 },
                                                            ]}
                                                            onPress={() => setSelectedTemplateId(template.id)}
                                                            activeOpacity={0.7}
                                                        >
                                                            {isActive && (
                                                                <View style={[styles.templateCheck, { backgroundColor: template.color }]}>
                                                                    <CheckSquare size={10} color="#FFF" />
                                                                </View>
                                                            )}
                                                            <View style={[styles.templateIcon, { backgroundColor: template.color + '20' }]}>
                                                                <LayoutTemplate size={20} color={template.color} />
                                                            </View>
                                                            <Text style={[styles.templateName, { color: isActive ? template.color : colors.text }]} numberOfLines={2}>{template.name}</Text>
                                                            <View style={[styles.templateBadge, { backgroundColor: colors.card }]}>
                                                                <Text style={[styles.templateBadgeText, { color: colors.textTertiary }]}>Custom</Text>
                                                            </View>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        )}
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <View style={styles.sectionHeader}>
                                            <Text style={[styles.label, { color: colors.textSecondary }]}>Workflow Statuses</Text>
                                        </View>

                                        {/* Validation warnings */}
                                        {(() => {
                                            const doneCount = editableStatuses.filter(s => (s as any).category === 'done').length;
                                            const todoCount = editableStatuses.filter(s => (s as any).category === 'todo').length;
                                            const warnings: string[] = [];
                                            if (doneCount === 0) warnings.push('⚠ Need exactly 1 "Done" status for completion tracking');
                                            if (todoCount === 0) warnings.push('⚠ Need at least 1 "Todo" status as default for new tasks');
                                            return warnings.length > 0 ? (
                                                <View style={{ marginBottom: 10, padding: 10, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}>
                                                    {warnings.map((w, i) => (
                                                        <Text key={i} style={{ fontSize: 11, color: '#DC2626', fontWeight: '500', lineHeight: 16 }}>{w}</Text>
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
                                            const catStatuses = editableStatuses
                                                .map((s, idx) => ({ ...s, _idx: idx }))
                                                .filter(s => (s as any).category === catKey);
                                            const isSingleton = catKey === 'done' || catKey === 'cancelled';
                                            const canAdd = !isSingleton || catStatuses.length === 0;
                                            const isDragging = draggedStatusIdx !== null;
                                            const draggedStatus = isDragging ? editableStatuses[draggedStatusIdx] : null;
                                            const draggedFromThisCat = isDragging && (draggedStatus as any)?.category === catKey;
                                            const canDropHere = isDragging && !draggedFromThisCat && (!isSingleton || catStatuses.length === 0);

                                            return (
                                                <View key={catKey} style={{ marginBottom: 12 }}>
                                                    {/* Category header / Drop zone */}
                                                    <TouchableOpacity
                                                        activeOpacity={canDropHere ? 0.7 : 1}
                                                        onPress={() => {
                                                            if (!canDropHere || draggedStatusIdx === null) return;
                                                            const newStatuses = [...editableStatuses];
                                                            (newStatuses[draggedStatusIdx] as any).category = catKey;
                                                            newStatuses[draggedStatusIdx].is_completed = catKey === 'done' || catKey === 'cancelled';
                                                            newStatuses[draggedStatusIdx].is_default = catKey === 'todo';
                                                            setEditableStatuses(newStatuses);
                                                            setIsStatusesModified(true);
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
                                                            <Text style={{ fontSize: 12, fontWeight: '700', color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cfg.label}</Text>
                                                            <Text style={{ fontSize: 10, color: colors.textTertiary }}>{catStatuses.length}</Text>
                                                            {catKey === 'todo' && !isDragging && <Text style={{ fontSize: 9, color: colors.textTertiary, fontStyle: 'italic' }}>· default</Text>}
                                                            {isSingleton && !isDragging && <Text style={{ fontSize: 9, color: colors.textTertiary, fontStyle: 'italic' }}>· max 1</Text>}
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
                                                                    const newStatus = {
                                                                        id: Math.random().toString(36).substr(2, 9),
                                                                        name: catKey === 'done' ? 'Done' : catKey === 'cancelled' ? 'Cancelled' : 'New Status',
                                                                        color: defaultColors[catKey] || '#64748B',
                                                                        position: editableStatuses.length,
                                                                        is_default: catKey === 'todo',
                                                                        is_completed: catKey === 'done' || catKey === 'cancelled',
                                                                        category: catKey,
                                                                    };
                                                                    setEditableStatuses([...editableStatuses, newStatus]);
                                                                    setIsStatusesModified(true);
                                                                }}
                                                            >
                                                                <Plus size={12} color={cfg.color} />
                                                                <Text style={{ fontSize: 10, fontWeight: '600', color: cfg.color }}>Add</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </TouchableOpacity>

                                                    {/* Status items in this category */}
                                                    {catStatuses.length === 0 && !canDropHere ? (
                                                        <View style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: cfg.color + '30', backgroundColor: cfg.bg }}>
                                                            <Text style={{ fontSize: 11, color: cfg.color, opacity: 0.6, textAlign: 'center' }}>No {cfg.label.toLowerCase()} statuses</Text>
                                                        </View>
                                                    ) : catStatuses.length > 0 ? (
                                                        <View style={{ gap: 4 }}>
                                                            {catStatuses.map((status) => {
                                                                const globalIdx = status._idx;
                                                                const isBeingDragged = draggedStatusIdx === globalIdx;
                                                                return (
                                                                    <View key={status.id} style={{ opacity: isBeingDragged ? 0.4 : 1 }}>
                                                                        <TouchableOpacity
                                                                            activeOpacity={0.8}
                                                                            onLongPress={() => {
                                                                                setDraggedStatusIdx(globalIdx);
                                                                                setEditingColorIndex(null);
                                                                            }}
                                                                            delayLongPress={300}
                                                                            style={[styles.statusItem, {
                                                                                backgroundColor: isBeingDragged ? cfg.bg : colors.surface,
                                                                                borderColor: isBeingDragged ? cfg.color : cfg.color + '25',
                                                                                borderWidth: isBeingDragged ? 2 : 1,
                                                                                borderLeftWidth: 3, borderLeftColor: cfg.color,
                                                                            }]}
                                                                        >
                                                                            <TouchableOpacity
                                                                                style={[styles.statusColorCircle, { backgroundColor: status.color }]}
                                                                                onPress={() => !isDragging && setEditingColorIndex(editingColorIndex === globalIdx ? null : globalIdx)}
                                                                            />
                                                                            <TextInput
                                                                                style={[styles.statusInput, { color: colors.text }]}
                                                                                value={status.name}
                                                                                editable={!isDragging}
                                                                                onChangeText={(text) => {
                                                                                    const newStatuses = [...editableStatuses];
                                                                                    newStatuses[globalIdx].name = text;
                                                                                    setEditableStatuses(newStatuses);
                                                                                    setIsStatusesModified(true);
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
                                                                                        if (nextCat === 'done' && editableStatuses.some((s, i) => i !== globalIdx && (s as any).category === 'done')) {
                                                                                            nextCat = 'cancelled';
                                                                                        }
                                                                                        if (nextCat === 'cancelled' && editableStatuses.some((s, i) => i !== globalIdx && (s as any).category === 'cancelled')) {
                                                                                            nextCat = 'todo';
                                                                                        }
                                                                                        const newStatuses = [...editableStatuses];
                                                                                        (newStatuses[globalIdx] as any).category = nextCat;
                                                                                        newStatuses[globalIdx].is_completed = nextCat === 'done' || nextCat === 'cancelled';
                                                                                        newStatuses[globalIdx].is_default = nextCat === 'todo';
                                                                                        setEditableStatuses(newStatuses);
                                                                                        setIsStatusesModified(true);
                                                                                    }}
                                                                                    style={[styles.categoryPill, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}
                                                                                >
                                                                                    <Text style={[styles.categoryPillText, { color: cfg.color }]}>{cfg.short}</Text>
                                                                                </TouchableOpacity>
                                                                            )}

                                                                            {/* Delete */}
                                                                            {!isDragging && (
                                                                                <TouchableOpacity
                                                                                    onPress={() => {
                                                                                        if (editableStatuses.length <= 2) {
                                                                                            Alert.alert('Minimum Statuses', 'You need at least 2 statuses.');
                                                                                            return;
                                                                                        }
                                                                                        if (catKey === 'done' && catStatuses.length <= 1) {
                                                                                            Alert.alert('Required', 'You must keep a "Done" status for completion tracking. Add another Done status first, or move this one to a different category.');
                                                                                            return;
                                                                                        }
                                                                                        setEditableStatuses(editableStatuses.filter((_, i) => i !== globalIdx));
                                                                                        setIsStatusesModified(true);
                                                                                    }}
                                                                                >
                                                                                    <Trash2 size={13} color="#EF4444" />
                                                                                </TouchableOpacity>
                                                                            )}
                                                                        </TouchableOpacity>

                                                                        {/* Inline color picker */}
                                                                        {editingColorIndex === globalIdx && !isDragging && (
                                                                            <View style={[styles.colorPalette, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                                                {['#64748B', '#3B82F6', '#F97316', '#22C55E', '#EF4444', '#A855F7', '#EC4899', '#06B6D4', '#8B5CF6', '#F59E0B'].map(color => (
                                                                                    <TouchableOpacity
                                                                                        key={color}
                                                                                        style={[styles.paletteColor, { backgroundColor: color }, status.color === color && { borderColor: colors.text }]}
                                                                                        onPress={() => {
                                                                                            const newStatuses = [...editableStatuses];
                                                                                            newStatuses[globalIdx].color = color;
                                                                                            setEditableStatuses(newStatuses);
                                                                                            setEditingColorIndex(null);
                                                                                            setIsStatusesModified(true);
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
                                        {draggedStatusIdx !== null && editableStatuses[draggedStatusIdx] && (
                                            <View style={{
                                                flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginTop: 4,
                                                backgroundColor: colors.primary + '15', borderWidth: 1.5, borderColor: colors.primary + '40',
                                            }}>
                                                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: editableStatuses[draggedStatusIdx].color }} />
                                                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>
                                                    Moving "{editableStatuses[draggedStatusIdx].name}"
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => setDraggedStatusIdx(null)}
                                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                                                >
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        {/* Action Buttons */}
                        <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                            {createStep === 1 ? (
                                <TouchableOpacity
                                    style={[styles.submitButton, { backgroundColor: colors.primary }, !newProjectName.trim() && { opacity: 0.5 }]}
                                    onPress={() => setCreateStep(2)}
                                    disabled={!newProjectName.trim()}
                                >
                                    <Text style={styles.submitButtonText}>Next — Choose Template</Text>
                                    <ChevronDown size={16} color="#FFF" style={{ transform: [{ rotate: '-90deg' }] }} />
                                </TouchableOpacity>
                            ) : (
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.submitButton, { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                                        onPress={() => setCreateStep(1)}
                                    >
                                        <ChevronDown size={16} color={colors.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
                                        <Text style={[styles.submitButtonText, { color: colors.textSecondary }]}>Back</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.submitButton, { flex: 2, backgroundColor: colors.primary }, isSubmitting && { opacity: 0.6 }]}
                                        onPress={handleCreateProject}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <>
                                                <Text style={styles.submitButtonText}>Create Project</Text>
                                                <Rocket size={16} color="#FFF" />
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Options Modal */}
            <Modal
                visible={showOptionsModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowOptionsModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOptionsModal(false)}
                >
                    <View style={[styles.optionsContainer, { backgroundColor: colors.card }]}>
                        <Text style={[styles.optionsTitle, { color: colors.textSecondary }]}>{selectedProject?.name}</Text>

                        <TouchableOpacity style={[styles.optionItem, { borderBottomColor: colors.border }]} onPress={handleArchiveProject}>
                            <Archive size={20} color={colors.textSecondary} />
                            <Text style={[styles.optionText, { color: colors.text }]}>
                                {selectedProject?.is_archived ? 'Restore Project' : 'Archive Project'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.optionItem, { borderBottomWidth: 0 }]} onPress={handleDeleteProject}>
                            <Trash2 size={20} color="#EF4444" />
                            <Text style={[styles.optionText, { color: '#EF4444' }]}>Delete Project</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    // ─── Layout ───
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: HORIZONTAL_PAD,
        paddingBottom: 12,
        gap: 14,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.6,
    },
    pageSubtitle: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
        opacity: 0.6,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    archiveToggle: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    addProjectBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ─── Search ───
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: 16,
        paddingHorizontal: 16,
        gap: 10,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 0,
    },

    // ─── Scroll ───
    scrollContent: {
        paddingHorizontal: HORIZONTAL_PAD,
        paddingTop: 8,
        paddingBottom: 100,
    },

    // ─── Cards (single column) ───
    cardList: {
        gap: 12,
    },
    card: {
        flexDirection: 'row',
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    cardAccent: {
        width: 4,
    },
    cardBody: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cardIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitleWrap: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    cardDesc: {
        fontSize: 13,
        marginTop: 2,
        opacity: 0.65,
    },
    cardBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    chipRow: {
        flexDirection: 'row',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
    },
    progressWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    progressTrack: {
        width: 48,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressPct: {
        fontSize: 12,
        fontWeight: '700',
    },

    // ─── FAB ───
    fab: {
        position: 'absolute',
        bottom: 28,
        right: HORIZONTAL_PAD,
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
    },

    // ─── States ───
    centerState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 80,
        paddingHorizontal: 32,
    },
    emptyIconBg: {
        width: 88,
        height: 88,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 14,
    },
    createBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContentWrapper: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    modalCloseBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    stepLine: {
        width: 20,
        height: 2,
        borderRadius: 1,
    },
    modalFooter: {
        paddingTop: 16,
        marginTop: 4,
        borderTopWidth: 1,
    },
    closeText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#0F172A',
        backgroundColor: '#F8FAFC',
    },
    textArea: {
        height: 100,
        paddingTop: 12,
        textAlignVertical: 'top',
    },
    submitButton: {
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 15,
    },
    // Template Styles
    templateScroll: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    templateCard: {
        width: 110,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        marginRight: 10,
        alignItems: 'center',
        position: 'relative',
    },
    templateCardActive: {
        borderWidth: 2,
    },
    templateCheck: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    templateIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    templateName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        textAlign: 'center',
        lineHeight: 17,
    },
    templateBadge: {
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
        backgroundColor: '#F1F5F9',
        borderRadius: 6,
    },
    templateBadgeText: {
        fontSize: 9,
        fontWeight: '500',
        color: '#94A3B8',
    },
    // Status Edit Styles
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 8,
    },
    addStatusBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    addStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statusList: {
        gap: 8,
        marginBottom: 8,
    },
    statusItemContainer: {
        marginBottom: 8,
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    reorderButtons: {
        flexDirection: 'column',
    },
    statusColorCircle: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    statusInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        padding: 0,
    },
    statusToggle: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusToggleDone: {
        backgroundColor: '#22C55E',
        borderColor: '#22C55E',
    },
    categoryPill: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    categoryPillText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    colorPalette: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: 10,
        marginTop: 4,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
    },
    paletteColor: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2.5,
        borderColor: 'transparent',
    },
    paletteColorActive: {
        borderColor: '#0F172A',
    },
    // Options Modal
    optionsContainer: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    optionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
        padding: 12,
        textAlign: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
    },
});


