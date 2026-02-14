import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    Modal,
    Dimensions,
    KeyboardAvoidingView,
    Keyboard,
    ScrollView,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
    X,
    Sparkles,
    Flag,
    User,
    Calendar as CalendarIcon,
    ChevronDown,
    Check,
    FolderKanban,
    Zap,
    Flame,
    Minus,
    Sun,
    Sunrise,
    CalendarDays,
    XCircle,
    Rocket,
    LayoutGrid,
    MessageSquare,
    CheckCircle2,
    Circle,
    Plus,
    Search,
} from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { format, addDays, nextMonday, startOfDay, isToday, isTomorrow, isSameDay, parseISO } from 'date-fns';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    Layout,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    interpolateColor,
    runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Constants & Config ───

const PRIORITIES = [
    { value: 'low', label: 'Low', color: '#94A3B8', bg: '#F1F5F9', emoji: '😌' },
    { value: 'medium', label: 'Med', color: '#F59E0B', bg: '#FEF3C7', emoji: '⚡' },
    { value: 'high', label: 'High', color: '#F97316', bg: '#FFEDD5', emoji: '🔥' },
    { value: 'urgent', label: 'ASAP', color: '#EF4444', bg: '#FEE2E2', emoji: '🚨' },
];

const QUICK_DATES = [
    { id: 'today', label: 'Today', icon: Sun, color: '#F59E0B' },
    { id: 'tomorrow', label: 'Tomorrow', icon: Sunrise, color: '#3B82F6' },
    { id: 'monday', label: 'Next Mon', icon: CalendarDays, color: '#8B5CF6' },
];

// ─── Shared Components ───

interface CreateTaskModalProps {
    visible: boolean;
    onClose: () => void;
    initialProjectId?: string;
    initialDueDate?: string;
    onCreated?: () => void;
}

export function CreateTaskModal({ visible, onClose, initialProjectId, initialDueDate, onCreated }: CreateTaskModalProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspace();

    // -- State --
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [projectId, setProjectId] = useState(initialProjectId || '');
    const [assigneeId, setAssigneeId] = useState<string | null>(null);
    const [dueDateInput, setDueDateInput] = useState('');
    const [customStatusId, setCustomStatusId] = useState<string | null>(null);
    const [statusName, setStatusName] = useState('');

    const [projects, setProjects] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState<Date>(new Date());

    const titleInputRef = useRef<TextInput>(null);

    // -- Animations --
    const modalOpacity = useSharedValue(0);
    const contentTranslateY = useSharedValue(SCREEN_HEIGHT);

    const [shouldRender, setShouldRender] = useState(visible);

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
            modalOpacity.value = withTiming(1, { duration: 300 });
            contentTranslateY.value = withSpring(0, { damping: 20, stiffness: 90 });
            resetForm();
            fetchInitialData();
            setTimeout(() => titleInputRef.current?.focus(), 500);
        } else {
            modalOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
                if (finished) {
                    runOnJS(setShouldRender)(false);
                }
            });
            contentTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
        }
    }, [visible]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setPriority('medium');
        setAssigneeId(null);
        setDueDateInput(initialDueDate || '');
        setCustomStatusId(null);
        setStatusName('');
        if (initialProjectId) setProjectId(initialProjectId);
    };

    const fetchInitialData = async () => {
        if (!currentWorkspace?.id) return;
        setIsLoading(true);
        try {
            const [projectsRes, membersRes] = await Promise.all([
                supabase.from('projects').select('id, name, color').eq('workspace_id', currentWorkspace.id).eq('is_archived', false).order('name'),
                supabase.from('workspace_members').select('user_id, profiles:profiles!workspace_members_user_id_fkey(id, full_name, avatar_url, email)').eq('workspace_id', currentWorkspace.id),
            ]);
            setProjects(projectsRes.data || []);
            // Correctly mapping profile IDs to the assignee selection
            setMembers(membersRes.data?.map((m: any) => m.profiles).filter(Boolean) || []);

            if (!projectId && projectsRes.data && projectsRes.data.length > 0) {
                setProjectId(projectsRes.data[0].id);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) fetchProjectStatuses(projectId);
    }, [projectId]);

    const fetchProjectStatuses = async (pId: string) => {
        try {
            const { data } = await supabase.from('project_statuses').select('*').eq('project_id', pId).order('position');
            setStatuses(data || []);
            const def = data?.find((s: any) => s.is_default) || data?.[0];
            if (def) {
                setCustomStatusId(def.id);
                setStatusName(def.name);
            }
        } catch (error) {
            console.error('Status fetch error:', error);
        }
    };

    const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(style);
        }
    };

    const handleCreate = async () => {
        if (!title.trim() || !projectId || !user) return;
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setIsSaving(true);
        try {
            const resolvedStatus = statuses.find(s => s.id === customStatusId);
            const mapToEnum = (s: any): string => {
                if (s?.is_completed) return 'done';
                const n = s?.name?.toLowerCase() || '';
                if (n.includes('progress') || n.includes('doing')) return 'in_progress';
                if (n.includes('review')) return 'review';
                return 'todo';
            };

            const { data: newTask, error } = await supabase.from('tasks').insert([{
                title: title.trim(),
                description: description.trim() || null,
                status: mapToEnum(resolvedStatus),
                custom_status_id: customStatusId,
                priority,
                project_id: projectId,
                assigned_to: assigneeId,
                due_date: dueDateInput || null,
                created_by: user.id,
                workspace_id: currentWorkspace?.id
            }]).select('id').single();

            if (error) throw error;

            if (assigneeId && newTask) {
                // Ensure the member is correctly assigned
                await supabase.from('task_assignees').insert({
                    task_id: newTask.id,
                    user_id: assigneeId,
                    assigned_by: user.id
                });
            }

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            onCreated?.();
            onClose();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const currentProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
    const currentStatus = useMemo(() => statuses.find(s => s.id === customStatusId), [statuses, customStatusId]);

    const modalStyle = useAnimatedStyle(() => ({
        opacity: modalOpacity.value,
    }));

    const contentStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: contentTranslateY.value }],
    }));

    if (!shouldRender) return null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <Animated.View style={[styles.overlay, modalStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                >
                    <Animated.View style={[styles.modalContainer, contentStyle, { paddingBottom: insets.bottom + 20 }]}>
                        {/* ─── Mesh Gradient Background (SVG Simulation) ─── */}
                        <View style={styles.meshContainer}>
                            <View style={[styles.meshBlob, { backgroundColor: '#F9731615', top: -50, right: -50, width: 250, height: 250 }]} />
                            <View style={[styles.meshBlob, { backgroundColor: '#8B5CF610', bottom: -100, left: -50, width: 300, height: 300 }]} />
                        </View>

                        {/* ─── Header ─── */}
                        <View style={[styles.header, { paddingTop: 20 }]}>
                            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                                <X size={20} color="#64748B" />
                            </TouchableOpacity>
                            <View style={styles.headerTitleContainer}>
                                <Sparkles size={16} color="#F97316" />
                                <Text style={styles.headerTitle}>New Task</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.createBtn, (!title.trim() || isSaving) && styles.createBtnDisabled]}
                                onPress={handleCreate}
                                disabled={!title.trim() || isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <Text style={styles.createBtnText}>Create</Text>
                                        <Rocket size={16} color="#FFF" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.scroll}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* ─── Title & Description Area ─── */}
                            <Animated.View entering={FadeInDown.delay(100)} style={styles.inputBlock}>
                                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                                <TextInput
                                    ref={titleInputRef}
                                    style={styles.titleInput}
                                    placeholder="Task name..."
                                    placeholderTextColor="#CBD5E1"
                                    value={title}
                                    onChangeText={setTitle}
                                    multiline
                                />
                                <TextInput
                                    style={styles.descInput}
                                    placeholder="Add details or notes..."
                                    placeholderTextColor="#94A3B8"
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                />
                            </Animated.View>

                            {/* ─── Project & Status Row ─── */}
                            <Animated.View entering={FadeInDown.delay(200)} style={styles.chipRow}>
                                <TouchableOpacity
                                    style={[styles.glassChip, { borderColor: (currentProject?.color || '#3B82F6') + '20' }]}
                                    onPress={() => { triggerHaptic(); setShowProjectPicker(true); }}
                                >
                                    <View style={[styles.dot, { backgroundColor: currentProject?.color || '#3B82F6' }]} />
                                    <Text style={styles.chipText} numberOfLines={1}>
                                        {currentProject?.name || 'Project'}
                                    </Text>
                                    <ChevronDown size={14} color="#94A3B8" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.glassChip, { borderColor: (currentStatus?.color || '#94A3B8') + '20' }]}
                                    onPress={() => { triggerHaptic(); setShowStatusPicker(true); }}
                                >
                                    <View style={[styles.dot, { backgroundColor: currentStatus?.color || '#94A3B8' }]} />
                                    <Text style={[styles.chipText, { color: currentStatus?.color || '#64748B' }]} numberOfLines={1}>
                                        {currentStatus?.name || 'Status'}
                                    </Text>
                                    <ChevronDown size={14} color="#94A3B8" />
                                </TouchableOpacity>
                            </Animated.View>

                            {/* ─── Priority Selection ─── */}
                            <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
                                <Text style={styles.sectionLabel}>Priority</Text>
                                <View style={styles.priorityGrid}>
                                    {PRIORITIES.map((p) => {
                                        const isSelected = priority === p.value;
                                        return (
                                            <TouchableOpacity
                                                key={p.value}
                                                style={[
                                                    styles.priorityCard,
                                                    isSelected && { borderColor: p.color, backgroundColor: p.bg + '60' }
                                                ]}
                                                onPress={() => { triggerHaptic(); setPriority(p.value); }}
                                            >
                                                <Text style={styles.priorityEmoji}>{p.emoji}</Text>
                                                <Text style={[styles.priorityLabel, isSelected && { color: p.color, fontWeight: '700' }]}>
                                                    {p.label}
                                                </Text>
                                                {isSelected && (
                                                    <Animated.View entering={FadeIn.duration(200)} style={[styles.priorityDot, { backgroundColor: p.color }]} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </Animated.View>

                            {/* ─── Assignee Selection ─── */}
                            <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionLabel}>Assign to</Text>
                                    <TouchableOpacity onPress={() => { triggerHaptic(); setShowAssigneePicker(true); }}>
                                        <Text style={styles.viewAll}>View All</Text>
                                    </TouchableOpacity>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarScroll}>
                                    <TouchableOpacity
                                        style={[styles.avatarContainer, !assigneeId && styles.avatarSelected]}
                                        onPress={() => { triggerHaptic(); setAssigneeId(null); }}
                                    >
                                        <View style={styles.avatarEmpty}>
                                            <User size={20} color="#94A3B8" />
                                        </View>
                                        <Text style={styles.avatarName}>Nobody</Text>
                                    </TouchableOpacity>
                                    {members.slice(0, 8).map((m) => {
                                        const isSelected = assigneeId === m.id;
                                        const initial = m.full_name?.charAt(0) || m.email?.charAt(0) || '?';
                                        return (
                                            <TouchableOpacity
                                                key={m.id}
                                                style={[styles.avatarContainer, isSelected && styles.avatarSelected]}
                                                onPress={() => { triggerHaptic(); setAssigneeId(m.id); }}
                                            >
                                                <View style={[styles.avatarCircle, { backgroundColor: isSelected ? '#F9731620' : '#F8FAFC' }]}>
                                                    <Text style={[styles.avatarInitial, isSelected && { color: '#F97316' }]}>{initial}</Text>
                                                </View>
                                                <Text style={[styles.avatarName, isSelected && { color: '#F97316', fontWeight: '600' }]} numberOfLines={1}>
                                                    {m.full_name?.split(' ')[0] || m.email?.split('@')[0]}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </Animated.View>

                            {/* ─── Due Date Selection (Inline Calendar + Shortcuts) ─── */}
                            <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
                                <Text style={styles.sectionLabel}>Due Date</Text>

                                <View style={styles.dateSelectorContainer}>
                                    <View style={styles.dateShortcuts}>
                                        {QUICK_DATES.map((d) => {
                                            const dateStr = d.id === 'today' ? format(new Date(), 'yyyy-MM-dd') :
                                                d.id === 'tomorrow' ? format(addDays(new Date(), 1), 'yyyy-MM-dd') :
                                                    format(nextMonday(new Date()), 'yyyy-MM-dd');
                                            const isSelected = dueDateInput === dateStr;
                                            return (
                                                <TouchableOpacity
                                                    key={d.id}
                                                    style={[styles.dateChip, isSelected && { borderColor: '#F97316', backgroundColor: '#FFF7ED' }]}
                                                    onPress={() => { triggerHaptic(); setDueDateInput(isSelected ? '' : dateStr); }}
                                                >
                                                    <d.icon size={16} color={isSelected ? '#F97316' : d.color} />
                                                    <Text style={[styles.dateLabel, isSelected && { color: '#F97316', fontWeight: '700' }]}>{d.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                        <TouchableOpacity
                                            style={[styles.dateChip, styles.pickDateBtn, !!dueDateInput && !QUICK_DATES.some(q => q.id === dueDateInput) && styles.dateChipSelected]}
                                            onPress={() => { triggerHaptic(); setShowDatePicker(true); }}
                                        >
                                            <CalendarIcon size={16} color="#64748B" />
                                            <Text style={styles.dateLabel}>
                                                {dueDateInput ? format(parseISO(dueDateInput), 'MMM d') : 'Custom'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {dueDateInput && (
                                        <TouchableOpacity
                                            style={styles.clearDateBtn}
                                            onPress={() => { triggerHaptic(); setDueDateInput(''); }}
                                        >
                                            <X size={14} color="#EF4444" />
                                            <Text style={styles.clearDateText}>Clear Date</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </Animated.View>
                        </ScrollView>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Animated.View>

            {/* ─── Premium Sub-Pickers ─── */}

            <ProjectPicker
                visible={showProjectPicker}
                projects={projects}
                selectedId={projectId}
                onSelect={(id: string) => { triggerHaptic(); setProjectId(id); setShowProjectPicker(false); }}
                onClose={() => setShowProjectPicker(false)}
            />

            <StatusPicker
                visible={showStatusPicker}
                statuses={statuses}
                selectedId={customStatusId}
                onSelect={(id: string, name: string) => { triggerHaptic(); setCustomStatusId(id); setStatusName(name); setShowStatusPicker(false); }}
                onClose={() => setShowStatusPicker(false)}
            />

            <AssigneePicker
                visible={showAssigneePicker}
                members={members}
                selectedId={assigneeId}
                onSelect={(id: string | null) => { triggerHaptic(); setAssigneeId(id); setShowAssigneePicker(false); }}
                onClose={() => setShowAssigneePicker(false)}
            />

            <DueDatePicker
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                selectedValue={dueDateInput}
                onSelect={(date: string) => {
                    triggerHaptic();
                    setDueDateInput(date);
                    setShowDatePicker(false);
                }}
            />
        </Modal>
    );
}

// ─── Sub-Picker Components ───

const ProjectPicker = ({ visible, projects, selectedId, onSelect, onClose }: any) => {
    const [search, setSearch] = useState('');
    const filtered = projects.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()));

    if (!visible) return null;
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={pickerStyles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[pickerStyles.container, { height: '60%' }]}>
                    <View style={pickerStyles.handle} />
                    <View style={pickerStyles.header}>
                        <Text style={pickerStyles.title}>Select Project</Text>
                        <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
                            <X size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <View style={pickerStyles.searchBar}>
                        <Search size={16} color="#94A3B8" />
                        <TextInput
                            style={pickerStyles.searchInput}
                            placeholder="Search projects..."
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    <ScrollView contentContainerStyle={pickerStyles.scroll}>
                        {filtered.map((p: any) => (
                            <TouchableOpacity
                                key={p.id}
                                style={[pickerStyles.item, selectedId === p.id && pickerStyles.itemSelected]}
                                onPress={() => onSelect(p.id)}
                            >
                                <View style={[pickerStyles.colorDot, { backgroundColor: p.color || '#3B82F6' }]} />
                                <Text style={[pickerStyles.itemText, selectedId === p.id && pickerStyles.itemTextSelected]}>{p.name}</Text>
                                {selectedId === p.id && <CheckCircle2 size={18} color="#F97316" />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const StatusPicker = ({ visible, statuses, selectedId, onSelect, onClose }: any) => {
    if (!visible) return null;
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={pickerStyles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[pickerStyles.container, { height: '50%' }]}>
                    <View style={pickerStyles.handle} />
                    <View style={pickerStyles.header}>
                        <Text style={pickerStyles.title}>Update Status</Text>
                        <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
                            <X size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={pickerStyles.scroll}>
                        {statuses.map((s: any) => (
                            <TouchableOpacity
                                key={s.id}
                                style={[pickerStyles.item, selectedId === s.id && pickerStyles.itemSelected]}
                                onPress={() => onSelect(s.id, s.name)}
                            >
                                <View style={[pickerStyles.colorDot, { backgroundColor: s.color || '#94A3B8' }]} />
                                <Text style={[pickerStyles.itemText, selectedId === s.id && pickerStyles.itemTextSelected]}>{s.name}</Text>
                                {selectedId === s.id && <CheckCircle2 size={18} color="#F97316" />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const AssigneePicker = ({ visible, members, selectedId, onSelect, onClose }: any) => {
    const [search, setSearch] = useState('');
    const filtered = members.filter((m: any) =>
        (m.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(search.toLowerCase())
    );

    if (!visible) return null;
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={pickerStyles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[pickerStyles.container, { height: '70%' }]}>
                    <View style={pickerStyles.handle} />
                    <View style={pickerStyles.header}>
                        <Text style={pickerStyles.title}>Assign Task</Text>
                        <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
                            <X size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <View style={pickerStyles.searchBar}>
                        <Search size={16} color="#94A3B8" />
                        <TextInput
                            style={pickerStyles.searchInput}
                            placeholder="Find a teammate..."
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    <ScrollView contentContainerStyle={pickerStyles.scroll}>
                        <TouchableOpacity
                            style={[pickerStyles.item, !selectedId && pickerStyles.itemSelected]}
                            onPress={() => onSelect(null)}
                        >
                            <View style={[pickerStyles.avatarPlaceholder, { backgroundColor: '#F1F5F9' }]}>
                                <User size={18} color="#94A3B8" />
                            </View>
                            <Text style={[pickerStyles.itemText, !selectedId && pickerStyles.itemTextSelected]}>Unassigned</Text>
                            {!selectedId && <CheckCircle2 size={18} color="#F97316" />}
                        </TouchableOpacity>

                        {filtered.map((m: any) => (
                            <TouchableOpacity
                                key={m.id}
                                style={[pickerStyles.item, selectedId === m.id && pickerStyles.itemSelected]}
                                onPress={() => onSelect(m.id)}
                            >
                                <View style={[pickerStyles.avatarPlaceholder, { backgroundColor: '#F9731615' }]}>
                                    <Text style={pickerStyles.avatarInitial}>{m.full_name?.charAt(0) || '?'}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[pickerStyles.itemText, selectedId === m.id && pickerStyles.itemTextSelected]}>
                                        {m.full_name || 'Anonymous'}
                                    </Text>
                                    <Text style={pickerStyles.itemSubText}>{m.email}</Text>
                                </View>
                                {selectedId === m.id && <CheckCircle2 size={18} color="#F97316" />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const DueDatePicker = ({ visible, onClose, selectedValue, onSelect }: any) => {
    const [tempDate, setTempDate] = useState(selectedValue || format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        if (visible && selectedValue) {
            setTempDate(selectedValue);
        }
    }, [visible, selectedValue]);

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={pickerStyles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[pickerStyles.container, { height: 'auto', paddingBottom: 30 }]}>
                    <View style={pickerStyles.handle} />
                    <View style={pickerStyles.header}>
                        <Text style={pickerStyles.title}>Select Due Date</Text>
                        <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
                            <X size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <View style={dpStyles.shortcuts}>
                        <TouchableOpacity style={dpStyles.shortcut} onPress={() => onSelect(format(new Date(), 'yyyy-MM-dd'))}>
                            <View style={[dpStyles.shortcutIcon, { backgroundColor: '#FFF7ED' }]}>
                                <Sun size={16} color="#F97316" />
                            </View>
                            <Text style={dpStyles.shortcutText}>Today</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={dpStyles.shortcut} onPress={() => onSelect(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}>
                            <View style={[dpStyles.shortcutIcon, { backgroundColor: '#EFF6FF' }]}>
                                <Sunrise size={16} color="#3B82F6" />
                            </View>
                            <Text style={dpStyles.shortcutText}>Tomorrow</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={dpStyles.shortcut} onPress={() => onSelect(format(nextMonday(new Date()), 'yyyy-MM-dd'))}>
                            <View style={[dpStyles.shortcutIcon, { backgroundColor: '#F5F3FF' }]}>
                                <CalendarDays size={16} color="#8B5CF6" />
                            </View>
                            <Text style={dpStyles.shortcutText}>Next Mon</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ paddingHorizontal: 10 }}>
                        <Calendar
                            current={tempDate}
                            onDayPress={(day: any) => {
                                onSelect(day.dateString);
                            }}
                            markedDates={{
                                [tempDate]: { selected: true, selectedColor: '#F97316' },
                            }}
                            theme={{
                                backgroundColor: '#ffffff',
                                calendarBackground: '#ffffff',
                                textSectionTitleColor: '#94A3B8',
                                selectedDayBackgroundColor: '#F97316',
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: '#F97316',
                                dayTextColor: '#0F172A', // Using very dark blue/black for visibility
                                textDisabledColor: '#E2E8F0',
                                dotColor: '#F97316',
                                selectedDotColor: '#ffffff',
                                arrowColor: '#F97316',
                                monthTextColor: '#0F172A',
                                indicatorColor: '#F97316',
                                textDayFontWeight: '600',
                                textMonthFontWeight: 'bold',
                                textDayHeaderFontWeight: '700',
                                textDayFontSize: 15,
                                textMonthFontSize: 17,
                                textDayHeaderFontSize: 11,
                            }}
                            style={{ borderRadius: 16, overflow: 'hidden' }}
                        />
                    </View>

                    <TouchableOpacity
                        style={[dpStyles.clearBtn, { marginTop: 10, alignSelf: 'center' }]}
                        onPress={() => onSelect('')}
                    >
                        <XCircle size={15} color="#EF4444" />
                        <Text style={dpStyles.clearText}>No Due Date</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// ─── Styles ───

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    keyboardView: {
        width: '100%',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        width: '100%',
        maxHeight: SCREEN_HEIGHT * 0.9,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -12 },
                shadowOpacity: 0.12,
                shadowRadius: 24,
            },
            android: { elevation: 20 },
        }),
    },
    meshContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
        zIndex: -1,
    },
    meshBlob: {
        position: 'absolute',
        borderRadius: 150,
        opacity: 0.7,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    iconBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.6,
    },
    createBtn: {
        backgroundColor: '#F97316',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 22,
        ...Platform.select({
            ios: {
                shadowColor: '#F97316',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
            },
            android: { elevation: 6 },
        }),
    },
    createBtnDisabled: {
        backgroundColor: '#E2E8F0',
        shadowOpacity: 0,
        elevation: 0,
    },
    createBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    scroll: {
        flexGrow: 0,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    inputBlock: {
        borderRadius: 28,
        padding: 18,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        backgroundColor: 'rgba(248, 250, 252, 0.5)',
    },
    titleInput: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0F172A',
        padding: 0,
        marginBottom: 10,
        letterSpacing: -0.5,
    },
    descInput: {
        fontSize: 16,
        color: '#64748B',
        padding: 0,
        minHeight: 44,
        lineHeight: 24,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    glassChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 18,
        backgroundColor: '#FFF',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        flex: 1,
        ...Platform.select({
            ios: {
                shadowColor: '#64748B',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
            },
            android: { elevation: 1 },
        }),
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        flex: 1,
    },
    section: {
        marginBottom: 26,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 12,
    },
    viewAll: {
        fontSize: 12,
        fontWeight: '700',
        color: '#F97316',
    },
    priorityGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    priorityCard: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    priorityEmoji: {
        fontSize: 22,
        marginBottom: 4,
    },
    priorityLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    priorityDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    avatarScroll: {
        gap: 14,
        paddingRight: 20,
    },
    avatarContainer: {
        alignItems: 'center',
        width: 64,
    },
    avatarCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    avatarEmpty: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    avatarSelected: {
        transform: [{ scale: 1.08 }],
    },
    avatarInitial: {
        fontSize: 18,
        fontWeight: '700',
        color: '#F97316',
    },
    avatarName: {
        fontSize: 11,
        color: '#64748B',
        textAlign: 'center',
    },
    dateSelectorContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
    },
    dateShortcuts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    dateChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: {
                shadowColor: '#64748B',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
            },
            android: { elevation: 1 },
        }),
    },
    dateChipSelected: {
        borderColor: '#F97316',
        backgroundColor: '#FFF7ED',
    },
    pickDateBtn: {
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
        borderColor: '#CBD5E1',
    },
    dateLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    clearDateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        alignSelf: 'flex-start',
        paddingVertical: 4,
    },
    clearDateText: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '600',
    }
});


const dpStyles = StyleSheet.create({
    shortcuts: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 10,
    },
    shortcut: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    shortcutIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    shortcutText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#FEF2F2',
    },
    clearText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#EF4444',
    },
});

const pickerStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingBottom: 40,
        width: '100%',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -10 },
                shadowOpacity: 0.1,
                shadowRadius: 15,
            },
            android: { elevation: 10 },
        }),
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        marginHorizontal: 20,
        paddingHorizontal: 16,
        borderRadius: 18,
        height: 48,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#0F172A',
    },
    scroll: {
        paddingHorizontal: 16,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 20,
        marginBottom: 6,
        gap: 14,
    },
    itemSelected: {
        backgroundColor: '#FFF7ED',
    },
    colorDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 16,
        fontWeight: '800',
        color: '#F97316',
    },
    itemText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
        flex: 1,
    },
    itemSubText: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    itemTextSelected: {
        color: '#F97316',
    },
});
