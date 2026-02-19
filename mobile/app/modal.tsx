import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import {
  X,
  Check,
  Calendar as CalendarIcon,
  Flag,
  User,
  ChevronDown,
  AlignLeft,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Trash2,
  MessageCircle,
  History,
  Target,
  Send,
  Reply,
  ChevronUp,
  CornerDownRight,
  Paperclip,
  Link2,
  ExternalLink,
  Plus,
  FileText,
  Image,
  File,
  Sun,
  Sunrise,
  CalendarDays,
  XCircle,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { format, formatDistanceToNow, addDays, nextMonday, startOfDay } from 'date-fns';

const PRIORITIES = [
  { label: 'Low', value: 'low', color: '#94A3B8' },
  { label: 'Medium', value: 'medium', color: '#EAB308' },
  { label: 'High', value: 'high', color: '#F97316' },
  { label: 'Urgent', value: 'urgent', color: '#EF4444' },
];

type TabKey = 'details' | 'sessions' | 'comments' | 'attachments' | 'links';

// ─── Styles ───
const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, maxHeight: '70%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: '#1E293B', paddingHorizontal: 20, marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 12 },
  optionActive: { backgroundColor: '#FFF7ED' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  optionText: { fontSize: 15, fontWeight: '500', color: '#334155' },
  optionTextActive: { color: '#F97316', fontWeight: '600' },
  optionSub: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8, marginHorizontal: 20, borderRadius: 12, backgroundColor: '#F1F5F9' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 8 : 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  saveText: { fontSize: 16, fontWeight: '600', color: '#F97316' },
  timerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  timerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  timerValue: { fontSize: 18, fontWeight: '700', color: '#1E293B', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  timerSub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  timerActions: { flexDirection: 'row', gap: 6 },
  timerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  timerBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0FDF4' },
  completedBadgeText: { fontSize: 12, fontWeight: '600', color: '#22C55E' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, gap: 5 },
  tabActive: { backgroundColor: '#FFF7ED' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#F97316' },
  tabBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  tabBadgeActive: { backgroundColor: '#FFEDD5' },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  tabBadgeTextActive: { color: '#F97316' },
  titleInput: { fontSize: 22, fontWeight: '700', color: '#0F172A', padding: 0, marginBottom: 16, textAlignVertical: 'top', minHeight: 32 },
  inputGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  descInput: { fontSize: 16, color: '#334155', padding: 12, minHeight: 100, textAlignVertical: 'top', lineHeight: 24, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  fieldSection: { gap: 2 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: '#64748B', width: 80 },
  fieldValue: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  fieldValueText: { fontSize: 14, fontWeight: '500', color: '#1E293B', maxWidth: 160 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  miniAvatar: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 9, fontWeight: '700', color: '#64748B' },
  dateInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 8 },
  dateTextInput: { flex: 1, fontSize: 14, color: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#F97316', paddingVertical: 6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  metaSection: { gap: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { fontSize: 13, color: '#94A3B8' },
  metaValue: { fontSize: 13, color: '#475569', fontWeight: '500' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FEF2F2', marginTop: 8 },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8, backgroundColor: '#FFF' },
  sessionCardActive: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  sessionNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sessionNumText: { fontSize: 12, fontWeight: '700' },
  sessionType: { fontSize: 13, fontWeight: '600', color: '#334155' },
  sessionTime: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  sessionDuration: { fontSize: 13, fontWeight: '600', color: '#1E293B', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  activeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: '#DCFCE7' },
  activeBadgeText: { fontSize: 10, fontWeight: '600', color: '#22C55E' },
  commentRow: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  commentAvatar: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#334155' },
  commentTime: { fontSize: 11, color: '#CBD5E1' },
  commentContent: { fontSize: 14, color: '#1E293B', lineHeight: 20 },
  commentAction: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  commentActionText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  replyIndent: { marginLeft: 24, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#F1F5F9' },
  replyInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8, paddingLeft: 4 },
  replyInput: { flex: 1, fontSize: 13, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minHeight: 34, maxHeight: 80, textAlignVertical: 'top' },
  commentInputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFF' },
  commentInput: { flex: 1, fontSize: 16, color: '#1E293B', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, maxHeight: 120, textAlignVertical: 'top', backgroundColor: '#FAFAFA' },
  sendBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  emptyTab: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTabTitle: { fontSize: 15, fontWeight: '600', color: '#94A3B8' },
  emptyTabSub: { fontSize: 13, color: '#CBD5E1' },
  attachmentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8, backgroundColor: '#FFF' },
  attachmentIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  attachmentName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  attachmentMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 8, backgroundColor: '#FFF' },
  linkIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  linkTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  linkUrl: { fontSize: 12, color: '#3B82F6', marginTop: 1 },
  addLinkForm: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FAFAFA', gap: 10, marginTop: 12 },
  addLinkInput: { fontSize: 14, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF' },
  addLinkCancel: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  addLinkCancelText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  addLinkSave: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F97316' },
  addLinkSaveText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  addLinkFab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginHorizontal: 16, marginBottom: 12, borderRadius: 12, backgroundColor: '#F97316' },
  addLinkFabText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  closeBtn: { padding: 4 },
  shortcuts: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  shortcut: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  shortcutText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  calendarContainer: { paddingHorizontal: 12, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 12 },
  clearBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
  clearText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  confirmBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#F97316', ...Platform.select({ ios: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

// ─── Interfaces ───
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

// ─── Picker Modal Component ───
function PickerModal({ visible, onClose, title, options, selectedValue, onSelect }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { value: string; label: string; color?: string; subtitle?: string }[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.title}>{title}</Text>
          <ScrollView style={{ maxHeight: 400 }}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[pickerStyles.option, selectedValue === opt.value && pickerStyles.optionActive]}
                onPress={() => { onSelect(opt.value); onClose(); }}
              >
                {opt.color && <View style={[pickerStyles.dot, { backgroundColor: opt.color }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={[pickerStyles.optionText, selectedValue === opt.value && pickerStyles.optionTextActive]}>
                    {opt.label}
                  </Text>
                  {opt.subtitle && <Text style={pickerStyles.optionSub}>{opt.subtitle}</Text>}
                </View>
                {selectedValue === opt.value && <Check size={18} color="#F97316" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={pickerStyles.cancelBtn} onPress={onClose}>
            <Text style={pickerStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Modal Screen ───
export default function ModalScreen() {
  const router = useRouter();
  const { id, projectId: initialProjectId } = useLocalSearchParams<{ id?: string; projectId?: string }>();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const isEditMode = !!id;
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusName, setStatusName] = useState('');
  const [customStatusId, setCustomStatusId] = useState<string | null>(null);
  const [priority, setPriority] = useState('low');
  const [projectId, setProjectId] = useState(initialProjectId || '');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueDateInput, setDueDateInput] = useState('');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  // Picker modals
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // Attachments state
  const [attachments, setAttachments] = useState<any[]>([]);

  // Links state
  const [links, setLinks] = useState<any[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);

  // Timer
  const completedStatus = useMemo(() => statuses.find(s => s.category === 'done' || s.is_completed), [statuses]);
  const {
    isRunning, displayTime, formatTime, startTimer, pauseTimer, resumeTimer,
    completeTask, sessions, firstStartedAt, completedAt, isLoading: timerLoading, elapsedTime,
  } = useTaskTimer(id || '', completedStatus?.id);

  // ─── Data Fetching ───
  useEffect(() => { fetchInitialData(); }, [id, initialProjectId]);
  useEffect(() => { if (projectId) fetchProjectStatuses(projectId); }, [projectId]);
  useEffect(() => { if (id) { fetchComments(); fetchAttachments(); fetchLinks(); } }, [id]);

  // ─── Realtime Subscription ───
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`task-detail-rt-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${id}` }, () => fetchComments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_attachments', filter: `task_id=eq.${id}` }, () => fetchAttachments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_links', filter: `task_id=eq.${id}` }, () => fetchLinks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_sessions', filter: `task_id=eq.${id}` }, () => { })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const fetchInitialData = async () => {
    if (!currentWorkspace?.id) return;
    setIsLoading(true);
    try {
      const [projectsRes, membersRes] = await Promise.all([
        supabase.from('projects').select('id, name, color').eq('workspace_id', currentWorkspace.id).eq('is_archived', false),
        supabase.from('workspace_members').select('user_id, profiles(id, full_name, avatar_url, email)').eq('workspace_id', currentWorkspace.id),
      ]);
      setProjects(projectsRes.data || []);
      setMembers(membersRes.data?.map((m: any) => m.profiles).filter(Boolean) || []);

      if (id) {
        const { data: task, error } = await supabase
          .from('tasks')
          .select('*, creator:profiles!tasks_created_by_fkey(full_name, email)')
          .eq('id', id).maybeSingle();
        if (error) throw error;
        if (!task) { Alert.alert('Not Found', 'This task no longer exists.'); router.back(); return; }
        setTitle(task.title);
        setDescription(task.description || '');
        setStatusName(task.status);
        setCustomStatusId(task.custom_status_id);
        setPriority(task.priority || 'low');
        setProjectId(task.project_id);
        setAssigneeId(task.assigned_to);
        setDueDate(task.due_date);
        setDueDateInput(task.due_date || '');
        setCreatedAt(task.created_at);
        setCreatorName(task.creator?.full_name || task.creator?.email?.split('@')[0] || null);
      } else if (initialProjectId) {
        setProjectId(initialProjectId);
      } else if (projectsRes.data && projectsRes.data.length > 0) {
        setProjectId(projectsRes.data[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching modal data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjectStatuses = async (pid: string) => {
    try {
      const { data } = await supabase.from('project_statuses').select('*').eq('project_id', pid).order('position');
      const list = data || [];
      setStatuses(list);
      if (!id || !list.find(s => s.name === statusName)) {
        const def = list.find(s => s.is_default);
        if (def) { setStatusName(def.name); setCustomStatusId(def.id); }
        else if (list.length > 0) { setStatusName(list[0].name); setCustomStatusId(list[0].id); }
      }
    } catch (error) { console.error('Error fetching statuses:', error); }
  };

  // ─── Comments ───
  const fetchComments = async () => {
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
  };

  const handleSubmitComment = async (parentId: string | null = null) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim() || !user || !id) return;
    setIsSubmittingComment(true);
    try {
      const { error } = await supabase.from('task_comments').insert({
        task_id: id, user_id: user.id, parent_id: parentId, content: content.trim(),
      });
      if (error) throw error;
      if (parentId) { setReplyContent(''); setReplyingTo(null); setExpandedReplies(prev => new Set([...prev, parentId])); }
      else setNewComment('');
      fetchComments();
    } catch (error) { console.error('Error adding comment:', error); Alert.alert('Error', 'Failed to add comment'); }
    finally { setIsSubmittingComment(false); }
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('task_comments').delete().eq('id', commentId);
            fetchComments();
          } catch (error) { console.error('Error deleting comment:', error); }
        }
      },
    ]);
  };

  // ─── Attachments ───
  const fetchAttachments = async () => {
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
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    Alert.alert('Delete Attachment', 'Remove this file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('task_attachments').delete().eq('id', attachmentId);
            fetchAttachments();
          } catch (error) { console.error('Error deleting attachment:', error); }
        }
      },
    ]);
  };

  // ─── Links ───
  const fetchLinks = async () => {
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
  };

  const handleAddLink = async () => {
    if (!newLinkUrl.trim() || !user || !id) return;
    try {
      const { error } = await supabase.from('task_links').insert({
        task_id: id,
        user_id: user.id,
        title: newLinkTitle.trim() || newLinkUrl.trim(),
        url: newLinkUrl.trim(),
      });
      if (error) throw error;
      setNewLinkTitle('');
      setNewLinkUrl('');
      setShowAddLink(false);
      fetchLinks();
    } catch (error) { console.error('Error adding link:', error); Alert.alert('Error', 'Failed to add link'); }
  };

  const handleDeleteLink = async (linkId: string) => {
    Alert.alert('Remove Link', 'Remove this link?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('task_links').delete().eq('id', linkId);
            fetchLinks();
          } catch (error) { console.error('Error deleting link:', error); }
        }
      },
    ]);
  };

  // ─── Save / Delete ───
  const handleSave = async () => {
    if (!title.trim() || !projectId || !user) {
      Alert.alert('Missing Info', 'Please provide a title and select a project.');
      return;
    }
    setIsSaving(true);
    try {
      // Resolve custom_status_id
      let resolvedStatusId = customStatusId;
      if (!resolvedStatusId && statuses.length > 0) {
        const matched = statuses.find(s => s.name === statusName);
        resolvedStatusId = matched?.id || statuses.find(s => s.is_default)?.id || statuses[0]?.id;
      }

      const parsedDue = dueDateInput.trim() || null;

      // Only write custom_status_id — DB trigger handles status enum, completed_at, first_started_at
      const taskData: Record<string, any> = {
        title: title.trim(),
        description: description.trim() || null,
        custom_status_id: resolvedStatusId || null,
        priority: priority || 'low',
        project_id: projectId,
        assigned_to: assigneeId,
        due_date: parsedDue,
      };

      if (id) {
        const { error } = await supabase.from('tasks').update(taskData).eq('id', id);
        if (error) throw error;
      } else {
        const { data: newTask, error } = await supabase.from('tasks').insert([{ ...taskData, created_by: user.id }]).select('id').maybeSingle();
        if (error) throw error;
        // Also insert into task_assignees for multi-assignee support
        if (newTask && assigneeId) {
          try {
            await supabase.from('task_assignees').insert({
              task_id: newTask.id,
              user_id: assigneeId,
              assigned_by: user.id,
            });
          } catch (_) { /* Non-critical */ }
        }
      }
      router.back();
    } catch (error: any) {
      console.error('Error saving task:', error);
      Alert.alert('Error', 'Failed to save task: ' + error.message);
    } finally { setIsSaving(false); }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete Task', 'This action cannot be undone. Delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('tasks').delete().eq('id', id);
            if (error) throw error;
            router.back();
          } catch (error: any) {
            console.error('Error deleting task:', error);
            Alert.alert('Error', 'Failed to delete task');
          }
        }
      },
    ]);
  };

  // ─── Helpers ───
  const currentProject = projects.find(p => p.id === projectId);
  const currentStatus = statuses.find(s => s.id === customStatusId) || statuses.find(s => s.name === statusName);
  const isCompleted = currentStatus?.category === 'done' || currentStatus?.category === 'cancelled' || currentStatus?.is_completed || false;
  const assignee = members.find(m => m.id === assigneeId);

  const formatTimeFull = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
    return `${s}s`;
  };

  if (isLoading) {
    return <View style={s.loadingContainer}><ActivityIndicator size="large" color="#F97316" /></View>;
  }

  // ─── Tab: Details ───
  const renderDetails = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: keyboardVisible ? 40 : 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <TextInput
          style={[s.titleInput, isCompleted && { textDecorationLine: 'line-through', color: '#94A3B8' }]}
          placeholder="Task title..."
          placeholderTextColor="#CBD5E1"
          value={title}
          onChangeText={setTitle}
          multiline
        />

        {/* Description */}
        <View style={s.inputGroup}>
          <View style={s.labelRow}><AlignLeft size={14} color="#94A3B8" /><Text style={s.label}>Description</Text></View>
          <TextInput
            style={s.descInput}
            placeholder="Add details..."
            placeholderTextColor="#CBD5E1"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={s.divider} />

        {/* Field rows */}
        <View style={s.fieldSection}>
          {/* Project */}
          <TouchableOpacity style={s.fieldRow} onPress={() => setShowProjectPicker(true)}>
            <Text style={s.fieldLabel}>Project</Text>
            <View style={s.fieldValue}>
              <View style={[s.dot, { backgroundColor: currentProject?.color || '#3B82F6' }]} />
              <Text style={s.fieldValueText} numberOfLines={1}>{currentProject?.name || 'Select...'}</Text>
              <ChevronDown size={14} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          {/* Status */}
          <TouchableOpacity style={s.fieldRow} onPress={() => setShowStatusPicker(true)}>
            <Text style={s.fieldLabel}>Status</Text>
            <View style={s.fieldValue}>
              <View style={[s.dot, { backgroundColor: currentStatus?.color || '#94A3B8' }]} />
              <Text style={s.fieldValueText}>{currentStatus?.name || statusName || 'Select...'}</Text>
              <ChevronDown size={14} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          {/* Priority */}
          <TouchableOpacity style={s.fieldRow} onPress={() => setShowPriorityPicker(true)}>
            <Text style={s.fieldLabel}>Priority</Text>
            <View style={s.fieldValue}>
              <Flag size={13} color={PRIORITIES.find(p => p.value === priority)?.color || '#94A3B8'} />
              <Text style={s.fieldValueText}>{PRIORITIES.find(p => p.value === priority)?.label || 'Low'}</Text>
              <ChevronDown size={14} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          {/* Assignee */}
          <TouchableOpacity style={s.fieldRow} onPress={() => setShowAssigneePicker(true)}>
            <Text style={s.fieldLabel}>Assignee</Text>
            <View style={s.fieldValue}>
              {assignee ? (
                <View style={s.miniAvatar}><Text style={s.miniAvatarText}>{assignee.full_name?.charAt(0)?.toUpperCase() || '?'}</Text></View>
              ) : <User size={13} color="#94A3B8" />}
              <Text style={s.fieldValueText}>{assignee?.full_name || 'Unassigned'}</Text>
              <ChevronDown size={14} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          {/* Due Date */}
          <TouchableOpacity style={s.fieldRow} onPress={() => { setTempDate(dueDateInput ? new Date(dueDateInput + 'T00:00:00') : new Date()); setShowDatePicker(true); }}>
            <Text style={s.fieldLabel}>Due Date</Text>
            <View style={s.fieldValue}>
              <CalendarIcon size={13} color="#F97316" />
              <Text style={[s.fieldValueText, !dueDateInput && { color: '#94A3B8' }]}>
                {dueDateInput ? format(new Date(dueDateInput + 'T00:00:00'), 'MMM d, yyyy') : 'Not set'}
              </Text>
              {dueDateInput ? (
                <TouchableOpacity onPress={() => setDueDateInput('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color="#EF4444" />
                </TouchableOpacity>
              ) : (
                <ChevronDown size={14} color="#94A3B8" />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Meta info (edit mode) */}
        {isEditMode && (
          <>
            <View style={s.divider} />
            <View style={s.metaSection}>
              {creatorName && (
                <View style={s.metaRow}>
                  <Text style={s.metaLabel}>Created by</Text>
                  <Text style={s.metaValue}>{creatorName}</Text>
                </View>
              )}
              {createdAt && (
                <View style={s.metaRow}>
                  <Text style={s.metaLabel}>Created</Text>
                  <Text style={s.metaValue}>{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Delete button (edit mode) */}
        {isEditMode && (
          <>
            <View style={s.divider} />
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
              <Trash2 size={16} color="#EF4444" />
              <Text style={s.deleteBtnText}>Delete Task</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ─── Tab: Sessions ───
  const renderSessions = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      {sessions.length === 0 ? (
        <View style={s.emptyTab}>
          <Clock size={32} color="#CBD5E1" />
          <Text style={s.emptyTabTitle}>No sessions yet</Text>
          <Text style={s.emptyTabSub}>Start the timer to track your work</Text>
        </View>
      ) : (
        sessions.map((session, index) => {
          const isActive = !session.ended_at;
          return (
            <View key={session.id} style={[s.sessionCard, isActive && s.sessionCardActive]}>
              <View style={[s.sessionNum, { backgroundColor: session.session_type === 'start' ? '#EFF6FF' : '#FFF7ED' }]}>
                <Text style={[s.sessionNumText, { color: session.session_type === 'start' ? '#3B82F6' : '#F97316' }]}>
                  {sessions.length - index}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.sessionType}>{session.session_type === 'start' ? 'Started' : 'Resumed'}</Text>
                  {isActive && <View style={s.activeBadge}><Text style={s.activeBadgeText}>Active</Text></View>}
                </View>
                <Text style={s.sessionTime}>
                  {format(new Date(session.started_at), 'MMM d, yyyy h:mm a')}
                  {session.ended_at && ` → ${format(new Date(session.ended_at), 'h:mm a')}`}
                </Text>
              </View>
              <Text style={s.sessionDuration}>
                {session.duration_seconds
                  ? formatTimeFull(session.duration_seconds)
                  : isRunning ? formatTimeFull(elapsedTime) : '-'}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // ─── Tab: Comments ───
  const renderCommentItem = (comment: Comment, isReply = false) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const initials = comment.user?.full_name
      ? comment.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : comment.user?.email?.[0]?.toUpperCase() || 'U';

    return (
      <View key={comment.id} style={[isReply && s.replyIndent]}>
        <View style={s.commentRow}>
          <View style={s.commentAvatar}><Text style={s.commentAvatarText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={s.commentAuthor}>{comment.user?.full_name || comment.user?.email?.split('@')[0] || 'User'}</Text>
              <Text style={s.commentTime}>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</Text>
            </View>
            <Text style={s.commentContent}>{comment.content}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
              {!isReply && (
                <TouchableOpacity style={s.commentAction} onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}>
                  <Reply size={12} color="#94A3B8" /><Text style={s.commentActionText}>Reply</Text>
                </TouchableOpacity>
              )}
              {hasReplies && (
                <TouchableOpacity style={s.commentAction} onPress={() => {
                  setExpandedReplies(prev => { const n = new Set(prev); if (n.has(comment.id)) n.delete(comment.id); else n.add(comment.id); return n; });
                }}>
                  {isExpanded ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
                  <Text style={s.commentActionText}>{comment.replies?.length} {comment.replies?.length === 1 ? 'reply' : 'replies'}</Text>
                </TouchableOpacity>
              )}
              {comment.user_id === user?.id && (
                <TouchableOpacity style={s.commentAction} onPress={() => handleDeleteComment(comment.id)}>
                  <Trash2 size={12} color="#EF4444" /><Text style={[s.commentActionText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Reply input */}
            {replyingTo === comment.id && (
              <View style={s.replyInputRow}>
                <CornerDownRight size={14} color="#CBD5E1" />
                <TextInput
                  style={s.replyInput}
                  placeholder="Write a reply..."
                  placeholderTextColor="#CBD5E1"
                  value={replyContent}
                  onChangeText={setReplyContent}
                  multiline
                />
                <TouchableOpacity
                  onPress={() => handleSubmitComment(comment.id)}
                  disabled={!replyContent.trim() || isSubmittingComment}
                  style={[s.sendBtn, (!replyContent.trim() || isSubmittingComment) && { opacity: 0.4 }]}
                >
                  <Send size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        {hasReplies && isExpanded && comment.replies?.map(r => renderCommentItem(r, true))}
      </View>
    );
  };

  const renderComments = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 0}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 20 }} style={{ flex: 1 }}>
        {comments.length === 0 ? (
          <View style={s.emptyTab}>
            <MessageCircle size={32} color="#CBD5E1" />
            <Text style={s.emptyTabTitle}>No comments yet</Text>
            <Text style={s.emptyTabSub}>Start the conversation</Text>
          </View>
        ) : (
          comments.map(c => renderCommentItem(c))
        )}
      </ScrollView>
      {/* New comment input */}
      <View style={s.commentInputBar}>
        <TextInput
          style={s.commentInput}
          placeholder="Write a comment..."
          placeholderTextColor="#CBD5E1"
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity
          onPress={() => handleSubmitComment(null)}
          disabled={!newComment.trim() || isSubmittingComment}
          style={[s.sendBtn, (!newComment.trim() || isSubmittingComment) && { opacity: 0.4 }]}
        >
          <Send size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // ─── Tab: Attachments ───
  const getFileIcon = (fileType: string) => {
    if (fileType?.startsWith('image/')) return Image;
    if (fileType?.includes('pdf') || fileType?.includes('document') || fileType?.includes('text')) return FileText;
    return File;
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderAttachments = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} style={{ flex: 1 }}>
      {attachments.length === 0 ? (
        <View style={s.emptyTab}>
          <Paperclip size={32} color="#CBD5E1" />
          <Text style={s.emptyTabTitle}>No attachments</Text>
          <Text style={s.emptyTabSub}>Files attached to this task will appear here</Text>
        </View>
      ) : (
        attachments.map(att => {
          const FileIcon = getFileIcon(att.file_type);
          return (
            <View key={att.id} style={s.attachmentCard}>
              <View style={s.attachmentIcon}>
                <FileIcon size={18} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.attachmentName} numberOfLines={1}>{att.file_name}</Text>
                <Text style={s.attachmentMeta}>
                  {formatFileSize(att.file_size)} · {att.uploader?.full_name || 'Unknown'} · {formatDistanceToNow(new Date(att.created_at), { addSuffix: true })}
                </Text>
              </View>
              {att.user_id === user?.id && (
                <TouchableOpacity onPress={() => handleDeleteAttachment(att.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // ─── Tab: Links ───
  const renderLinks = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 0}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 20 }} style={{ flex: 1 }}>
        {links.length === 0 && !showAddLink ? (
          <View style={s.emptyTab}>
            <Link2 size={32} color="#CBD5E1" />
            <Text style={s.emptyTabTitle}>No links</Text>
            <Text style={s.emptyTabSub}>Add relevant links to this task</Text>
          </View>
        ) : (
          links.map(link => (
            <View key={link.id} style={s.linkCard}>
              <View style={s.linkIcon}>
                <ExternalLink size={16} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.linkTitle} numberOfLines={1}>{link.title}</Text>
                <Text style={s.linkUrl} numberOfLines={1}>{link.url}</Text>
              </View>
              {link.user_id === user?.id && (
                <TouchableOpacity onPress={() => handleDeleteLink(link.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {showAddLink && (
          <View style={s.addLinkForm}>
            <TextInput
              style={s.addLinkInput}
              placeholder="Link title (optional)"
              placeholderTextColor="#CBD5E1"
              value={newLinkTitle}
              onChangeText={setNewLinkTitle}
            />
            <TextInput
              style={s.addLinkInput}
              placeholder="https://..."
              placeholderTextColor="#CBD5E1"
              value={newLinkUrl}
              onChangeText={setNewLinkUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.addLinkCancel} onPress={() => { setShowAddLink(false); setNewLinkTitle(''); setNewLinkUrl(''); }}>
                <Text style={s.addLinkCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.addLinkSave, !newLinkUrl.trim() && { opacity: 0.4 }]} onPress={handleAddLink} disabled={!newLinkUrl.trim()}>
                <Text style={s.addLinkSaveText}>Add Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      {!showAddLink && (
        <TouchableOpacity style={s.addLinkFab} onPress={() => setShowAddLink(true)}>
          <Plus size={16} color="#FFF" />
          <Text style={s.addLinkFabText}>Add Link</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );

  // ─── Tabs config ───
  const TABS: { key: TabKey; label: string; Icon: any; badge?: number }[] = [
    { key: 'details', label: 'Details', Icon: Target },
    ...(isEditMode ? [
      { key: 'sessions' as TabKey, label: 'Sessions', Icon: History, badge: sessions.length },
      { key: 'comments' as TabKey, label: 'Comments', Icon: MessageCircle, badge: comments.length },
      { key: 'attachments' as TabKey, label: 'Files', Icon: Paperclip, badge: attachments.length },
      { key: 'links' as TabKey, label: 'Links', Icon: Link2, badge: links.length },
    ] : []),
  ];

  return (
    <View style={s.container}>
      <StatusBar style="auto" />

      {/* ─── Header ─── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <X size={22} color="#64748B" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditMode ? 'Task' : 'New Task'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving || !title.trim()}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#F97316" />
          ) : (
            <Text style={[s.saveText, (!title.trim()) && { color: '#CBD5E1' }]}>
              {isEditMode ? 'Save' : 'Create'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Timer (edit mode) ─── */}
      {isEditMode && !timerLoading && (
        <View style={s.timerBar}>
          <View style={s.timerLeft}>
            <View style={[s.timerIcon, isRunning && { backgroundColor: '#DCFCE7' }]}>
              {isRunning ? <Clock size={18} color="#22C55E" /> : isCompleted ? <CheckCircle2 size={18} color="#22C55E" /> : <Clock size={18} color="#94A3B8" />}
            </View>
            <View>
              <Text style={s.timerValue}>{formatTime(displayTime)}</Text>
              <Text style={s.timerSub}>
                {isRunning ? '● Running' : sessions.length > 0 ? `${sessions.length} session${sessions.length > 1 ? 's' : ''}` : 'No time tracked'}
              </Text>
            </View>
          </View>
          <View style={s.timerActions}>
            {isCompleted ? (
              <View style={s.completedBadge}><CheckCircle2 size={14} color="#22C55E" /><Text style={s.completedBadgeText}>Done</Text></View>
            ) : isRunning ? (
              <>
                <TouchableOpacity style={[s.timerBtn, { backgroundColor: '#F97316' }]} onPress={pauseTimer}>
                  <Pause size={14} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={[s.timerBtn, { backgroundColor: '#22C55E' }]} onPress={completeTask}>
                  <CheckCircle2 size={14} color="#FFF" />
                </TouchableOpacity>
              </>
            ) : firstStartedAt ? (
              <>
                <TouchableOpacity style={[s.timerBtn, { backgroundColor: '#F97316' }]} onPress={resumeTimer}>
                  <Play size={14} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={[s.timerBtn, { backgroundColor: '#22C55E' }]} onPress={completeTask}>
                  <CheckCircle2 size={14} color="#FFF" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[s.timerBtn, { backgroundColor: '#F97316' }]} onPress={startTimer}>
                <Play size={14} color="#FFF" />
                <Text style={s.timerBtnText}>Start</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ─── Tab Bar ─── */}
      {TABS.length > 1 && (
        <View style={s.tabBar}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={[s.tab, active && s.tabActive]} onPress={() => setActiveTab(tab.key)}>
                <tab.Icon size={14} color={active ? '#F97316' : '#94A3B8'} />
                <Text style={[s.tabText, active && s.tabTextActive]}>{tab.label}</Text>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                    <Text style={[s.tabBadgeText, active && s.tabBadgeTextActive]}>{tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ─── Tab Content ─── */}
      <View style={{ flex: 1 }}>
        {activeTab === 'details' && renderDetails()}
        {activeTab === 'sessions' && renderSessions()}
        {activeTab === 'comments' && renderComments()}
        {activeTab === 'attachments' && renderAttachments()}
        {activeTab === 'links' && renderLinks()}
      </View>

      {/* ─── Picker Modals ─── */}
      <PickerModal
        visible={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        title="Select Project"
        options={projects.map(p => ({ value: p.id, label: p.name, color: p.color }))}
        selectedValue={projectId}
        onSelect={setProjectId}
      />
      <PickerModal
        visible={showStatusPicker}
        onClose={() => setShowStatusPicker(false)}
        title="Select Status"
        options={statuses.map(st => ({ value: st.id, label: st.name, color: st.color, subtitle: st.category === 'done' || st.category === 'cancelled' ? 'Completed' : st.is_default ? 'Default' : undefined }))}
        selectedValue={customStatusId}
        onSelect={(val: string) => { setCustomStatusId(val); const st = statuses.find(s => s.id === val); if (st) setStatusName(st.name); }}
      />
      <PickerModal
        visible={showPriorityPicker}
        onClose={() => setShowPriorityPicker(false)}
        title="Select Priority"
        options={PRIORITIES.map(p => ({ value: p.value, label: p.label, color: p.color }))}
        selectedValue={priority || 'low'}
        onSelect={setPriority}
      />
      <PickerModal
        visible={showAssigneePicker}
        onClose={() => setShowAssigneePicker(false)}
        title="Select Assignee"
        options={[
          { value: '__none__', label: 'Unassigned', color: '#CBD5E1' },
          ...members.map(m => ({ value: m.id, label: m.full_name || m.email?.split('@')[0] || 'User', subtitle: m.email })),
        ]}
        selectedValue={assigneeId || '__none__'}
        onSelect={(val: string) => setAssigneeId(val === '__none__' ? null : val)}
      />

      {/* Date Picker Modal */}
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

            {/* Quick shortcuts */}
            <View style={dpStyles.shortcuts}>
              <TouchableOpacity style={dpStyles.shortcut} onPress={() => { setDueDateInput(format(startOfDay(new Date()), 'yyyy-MM-dd')); setShowDatePicker(false); }}>
                <Sun size={15} color="#F97316" />
                <Text style={dpStyles.shortcutText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dpStyles.shortcut} onPress={() => { setDueDateInput(format(startOfDay(addDays(new Date(), 1)), 'yyyy-MM-dd')); setShowDatePicker(false); }}>
                <Sunrise size={15} color="#3B82F6" />
                <Text style={dpStyles.shortcutText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dpStyles.shortcut} onPress={() => { setDueDateInput(format(startOfDay(nextMonday(new Date())), 'yyyy-MM-dd')); setShowDatePicker(false); }}>
                <CalendarDays size={15} color="#8B5CF6" />
                <Text style={dpStyles.shortcutText}>Next Mon</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dpStyles.shortcut} onPress={() => { setDueDateInput(format(startOfDay(addDays(new Date(), 7)), 'yyyy-MM-dd')); setShowDatePicker(false); }}>
                <CalendarIcon size={15} color="#22C55E" />
                <Text style={dpStyles.shortcutText}>+1 Week</Text>
              </TouchableOpacity>
            </View>

            {/* Calendar */}
            <View style={dpStyles.calendarContainer}>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                onChange={(_e: any, d?: Date) => { if (d) setTempDate(d); }}
                accentColor="#F97316"
                style={{ alignSelf: 'center' }}
              />
            </View>

            {/* Actions */}
            <View style={dpStyles.actions}>
              {dueDateInput ? (
                <TouchableOpacity style={dpStyles.clearBtn} onPress={() => { setDueDateInput(''); setShowDatePicker(false); }}>
                  <XCircle size={15} color="#EF4444" />
                  <Text style={dpStyles.clearText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[dpStyles.confirmBtn, !dueDateInput && { flex: 1 }]} onPress={() => { setDueDateInput(format(startOfDay(tempDate), 'yyyy-MM-dd')); setShowDatePicker(false); }}>
                <Text style={dpStyles.confirmText}>Set Date</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}


