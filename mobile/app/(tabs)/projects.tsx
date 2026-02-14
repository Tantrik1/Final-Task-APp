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
import {
    Plus,
    FolderKanban,
    MoreVertical,
    Archive,
    Trash2,
    CheckSquare,
    Search,
    Loader2,
    LayoutTemplate,
    X,
    Settings,
    GripVertical,
    ChevronUp,
    ChevronDown
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { SYSTEM_TEMPLATES, SystemTemplate } from '@/constants/systemTemplates';
import { useProjectTemplates, ProjectTemplate } from '@/hooks/useProjectTemplates';

const { width } = Dimensions.get('window');

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

// ... imports done 

export default function Projects() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
    const { user } = useAuth();

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
                setEditableStatuses(details.statuses.map((s, idx) => ({
                    ...s,
                    id: `temp-${idx}-${Date.now()}`, // More stable temp ID
                    position: idx
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
                .select('id, is_completed')
                .in('project_id', allProjectIds);

            const completedStatusIds = new Set(
                (allStatuses || []).filter(s => s.is_completed).map(s => s.id)
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
                    editableStatuses.map((s, idx) => ({
                        name: s.name,
                        color: s.color,
                        position: idx,
                        is_default: s.is_default,
                        is_completed: s.is_completed
                    }))
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
        <View style={styles.container}>
            {/* Header / Search Area */}
            <View style={styles.header}>
                <View style={styles.searchContainer}>
                    <Search size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
                <TouchableOpacity
                    style={[styles.archiveToggle, showArchived && styles.archiveToggleActive]}
                    onPress={() => setShowArchived(!showArchived)}
                >
                    <Archive size={20} color={showArchived ? '#FFFFFF' : '#64748B'} />
                </TouchableOpacity>
            </View>

            {/* Creating Project FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setIsCreateModalOpen(true)}
            >
                <Plus size={24} color="#FFFFFF" strokeWidth={3} />
            </TouchableOpacity>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
            >
                {isLoading && projects.length === 0 ? (
                    <View style={styles.centerParams}>
                        <Loader2 size={32} color="#F97316" className="animate-spin" />
                        <Text style={styles.loadingText}>Loading Projects...</Text>
                    </View>
                ) : filteredProjects.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconBg}>
                            <FolderKanban size={48} color="#F97316" />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {showArchived ? 'No archived projects' : 'No projects found'}
                        </Text>
                        <Text style={styles.emptyDesc}>
                            {showArchived
                                ? 'Archived projects will appear here.'
                                : 'Create a new project to get started.'}
                        </Text>
                        {!showArchived && (
                            <TouchableOpacity style={styles.createButtonEmpty} onPress={() => setIsCreateModalOpen(true)}>
                                <Text style={styles.createButtonText}>Create First Project</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {filteredProjects.map(project => {
                            const progress = project.taskCounts && project.taskCounts.total > 0
                                ? Math.round((project.taskCounts.done / project.taskCounts.total) * 100)
                                : 0;

                            return (
                                <TouchableOpacity
                                    key={project.id}
                                    style={styles.card}
                                    onPress={() => router.push(`/project/${project.id}` as any)}
                                >
                                    {/* Color Bar */}
                                    <View style={[styles.colorBar, { backgroundColor: project.color || '#3B82F6' }]} />

                                    <View style={styles.cardHeader}>
                                        <View style={[styles.iconContainer, { backgroundColor: (project.color || '#3B82F6') + '20' }]}>
                                            <FolderKanban size={20} color={project.color || '#3B82F6'} />
                                        </View>
                                        <TouchableOpacity onPress={() => openOptions(project)} style={{ padding: 4 }}>
                                            <MoreVertical size={20} color="#94A3B8" />
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.cardTitle} numberOfLines={1}>{project.name}</Text>
                                    <Text style={styles.cardDesc} numberOfLines={2}>
                                        {project.description || 'No description'}
                                    </Text>

                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <CheckSquare size={14} color="#64748B" />
                                                <Text style={styles.progressText}>
                                                    {project.taskCounts?.done || 0}/{project.taskCounts?.total || 0}
                                                </Text>
                                            </View>
                                            <Text style={[styles.progressPercent, { color: project.color || '#3B82F6' }]}>
                                                {progress}%
                                            </Text>
                                        </View>
                                        <View style={styles.progressBarBg}>
                                            <View
                                                style={[
                                                    styles.progressBarFill,
                                                    {
                                                        width: `${progress}%`,
                                                        backgroundColor: project.color || '#3B82F6'
                                                    }
                                                ]}
                                            />
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
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentWrapper}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {createStep === 1 ? 'New Project - Step 1' : 'New Project - Step 2'}
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setIsCreateModalOpen(false);
                                setCreateStep(1);
                            }}>
                                <Text style={styles.closeText}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            {createStep === 1 ? (
                                // STEP 1: Name and Description
                                <>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Project Name *</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. Website Redesign"
                                            value={newProjectName}
                                            onChangeText={setNewProjectName}
                                            autoFocus
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Description</Text>
                                        <TextInput
                                            style={[styles.input, styles.textArea]}
                                            placeholder="What is this project about?"
                                            value={newProjectDesc}
                                            onChangeText={setNewProjectDesc}
                                            multiline
                                        />
                                    </View>
                                </>
                            ) : (
                                // STEP 2: Template Selection and Customization
                                <>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Template</Text>
                                        {templatesLoading ? (
                                            <View style={{ padding: 20, alignItems: 'center' }}>
                                                <ActivityIndicator size="small" color="#F97316" />
                                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Loading templates...</Text>
                                            </View>
                                        ) : (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                                                {/* System Templates */}
                                                {SYSTEM_TEMPLATES.map(template => (
                                                    <TouchableOpacity
                                                        key={template.id}
                                                        style={[
                                                            styles.templateCard,
                                                            selectedTemplateId === template.id && styles.templateCardActive,
                                                            { borderColor: selectedTemplateId === template.id ? template.color : '#E2E8F0' }
                                                        ]}
                                                        onPress={() => setSelectedTemplateId(template.id)}
                                                    >
                                                        <View style={[styles.templateIcon, { backgroundColor: template.color + '20' }]}>
                                                            <FolderKanban size={20} color={template.color} />
                                                        </View>
                                                        <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
                                                        <View style={styles.templateBadge}>
                                                            <Text style={styles.templateBadgeText}>System</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}

                                                {/* Workspace Templates */}
                                                {workspaceTemplates.map(template => (
                                                    <TouchableOpacity
                                                        key={template.id}
                                                        style={[
                                                            styles.templateCard,
                                                            selectedTemplateId === template.id && styles.templateCardActive,
                                                            { borderColor: selectedTemplateId === template.id ? template.color : '#E2E8F0' }
                                                        ]}
                                                        onPress={() => setSelectedTemplateId(template.id)}
                                                    >
                                                        <View style={[styles.templateIcon, { backgroundColor: template.color + '20' }]}>
                                                            <LayoutTemplate size={20} color={template.color} />
                                                        </View>
                                                        <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
                                                        <View style={[styles.templateBadge, { backgroundColor: '#F1F5F9' }]}>
                                                            <Text style={[styles.templateBadgeText, { color: '#64748B' }]}>Custom</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}

                                            </ScrollView>
                                        )}
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <View style={styles.sectionHeader}>
                                            <Text style={styles.label}>Statuses</Text>
                                            <TouchableOpacity
                                                style={styles.addStatusBtn}
                                                onPress={() => {
                                                    const newPos = editableStatuses.length;
                                                    setEditableStatuses([...editableStatuses, {
                                                        id: Math.random().toString(36).substr(2, 9),
                                                        name: 'New Status',
                                                        color: '#64748B',
                                                        position: newPos,
                                                        is_default: false,
                                                        is_completed: false
                                                    }]);
                                                    setIsStatusesModified(true);
                                                }}
                                            >
                                                <Plus size={16} color="#F97316" />
                                                <Text style={styles.addStatusText}>Add Status</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.statusList}>
                                            {editableStatuses.map((status, index) => (
                                                <View key={status.id} style={styles.statusItemContainer}>
                                                    <View style={styles.statusItem}>
                                                        <View style={styles.reorderButtons}>
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    if (index > 0) {
                                                                        const newStatuses = [...editableStatuses];
                                                                        [newStatuses[index], newStatuses[index - 1]] = [newStatuses[index - 1], newStatuses[index]];
                                                                        setEditableStatuses(newStatuses);
                                                                        setIsStatusesModified(true);
                                                                    }
                                                                }}
                                                                disabled={index === 0}
                                                            >
                                                                <ChevronUp size={16} color={index === 0 ? '#CBD5E1' : '#94A3B8'} />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    if (index < editableStatuses.length - 1) {
                                                                        const newStatuses = [...editableStatuses];
                                                                        [newStatuses[index], newStatuses[index + 1]] = [newStatuses[index + 1], newStatuses[index]];
                                                                        setEditableStatuses(newStatuses);
                                                                        setIsStatusesModified(true);
                                                                    }
                                                                }}
                                                                disabled={index === editableStatuses.length - 1}
                                                            >
                                                                <ChevronDown size={16} color={index === editableStatuses.length - 1 ? '#CBD5E1' : '#94A3B8'} />
                                                            </TouchableOpacity>
                                                        </View>

                                                        <TouchableOpacity
                                                            style={[styles.statusColorCircle, { backgroundColor: status.color }]}
                                                            onPress={() => setEditingColorIndex(editingColorIndex === index ? null : index)}
                                                        />
                                                        <TextInput
                                                            style={styles.statusInput}
                                                            value={status.name}
                                                            onChangeText={(text) => {
                                                                const newStatuses = [...editableStatuses];
                                                                newStatuses[index].name = text;
                                                                setEditableStatuses(newStatuses);
                                                                setIsStatusesModified(true);
                                                            }}
                                                        />
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                const newStatuses = [...editableStatuses];
                                                                newStatuses[index].is_completed = !newStatuses[index].is_completed;
                                                                setEditableStatuses(newStatuses);
                                                                setIsStatusesModified(true);
                                                            }}
                                                            style={[styles.statusToggle, status.is_completed && styles.statusToggleDone]}
                                                        >
                                                            <CheckSquare size={14} color={status.is_completed ? '#FFFFFF' : '#94A3B8'} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                setEditableStatuses(editableStatuses.filter((_, i) => i !== index));
                                                                setIsStatusesModified(true);
                                                            }}
                                                        >
                                                            <Trash2 size={16} color="#EF4444" />
                                                        </TouchableOpacity>
                                                    </View>

                                                    {editingColorIndex === index && (
                                                        <View style={styles.colorPalette}>
                                                            {['#64748B', '#3B82F6', '#F97316', '#22C55E', '#EF4444', '#A855F7', '#EC4899', '#06B6D4', '#8B5CF6', '#F59E0B'].map(color => (
                                                                <TouchableOpacity
                                                                    key={color}
                                                                    style={[styles.paletteColor, { backgroundColor: color }, status.color === color && styles.paletteColorActive]}
                                                                    onPress={() => {
                                                                        const newStatuses = [...editableStatuses];
                                                                        newStatuses[index].color = color;
                                                                        setEditableStatuses(newStatuses);
                                                                        setEditingColorIndex(null);
                                                                        setIsStatusesModified(true);
                                                                    }}
                                                                />
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </>
                            )}
                        </ScrollView>

                        {/* Action Buttons */}
                        {createStep === 1 ? (
                            <TouchableOpacity
                                style={[styles.submitButton, !newProjectName.trim() && styles.submitButtonDisabled]}
                                onPress={() => setCreateStep(2)}
                                disabled={!newProjectName.trim()}
                            >
                                <Text style={styles.submitButtonText}>Next</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity
                                    style={[styles.submitButton, { flex: 1, backgroundColor: '#64748B' }]}
                                    onPress={() => setCreateStep(1)}
                                >
                                    <Text style={styles.submitButtonText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.submitButton, { flex: 2 }, isSubmitting && styles.submitButtonDisabled]}
                                    onPress={handleCreateProject}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <Text style={styles.submitButtonText}>Creating...</Text>
                                    ) : (
                                        <Text style={styles.submitButtonText}>Create Project</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
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
                    <View style={styles.optionsContainer}>
                        <Text style={styles.optionsTitle}>{selectedProject?.name}</Text>

                        <TouchableOpacity style={styles.optionItem} onPress={handleArchiveProject}>
                            <Archive size={20} color="#64748B" />
                            <Text style={styles.optionText}>
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
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
        marginTop: 16,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#0F172A',
    },
    archiveToggle: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    archiveToggleActive: {
        backgroundColor: '#64748B',
        borderColor: '#64748B',
    },
    scrollContent: {
        padding: 16,
        paddingTop: 0,
        paddingBottom: 80,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    card: {
        width: (width - 44) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        paddingTop: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        marginBottom: 4,
        position: 'relative',
        overflow: 'hidden',
    },
    colorBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 16,
        height: 32,
    },
    progressContainer: {
        gap: 6,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    progressPercent: {
        fontSize: 12,
        fontWeight: '700',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F97316',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        elevation: 8,
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    centerParams: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    loadingText: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 14,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        paddingHorizontal: 32,
    },
    emptyIconBg: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
    },
    createButtonEmpty: {
        backgroundColor: '#F97316',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    createButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
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
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
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
        backgroundColor: '#F97316',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    submitButtonDisabled: {
        backgroundColor: '#94A3B8',
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    // Template Styles
    templateScroll: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    templateCard: {
        width: 140,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginRight: 10,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    templateCardActive: {
        backgroundColor: '#F8FAFC',
        borderWidth: 2,
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
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center',
    },
    templateBadge: {
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
    },
    templateBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
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
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#FFF7ED',
    },
    addStatusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F97316',
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
        gap: 10,
        backgroundColor: '#F8FAFC',
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
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
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '500',
        padding: 0,
    },
    statusToggle: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    statusToggleDone: {
        backgroundColor: '#22C55E',
        borderColor: '#22C55E',
    },
    colorPalette: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: 10,
        backgroundColor: '#FFFFFF',
        marginTop: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
    },
    paletteColor: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
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


