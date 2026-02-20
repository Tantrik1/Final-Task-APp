import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { CheckSquare, Square, Plus, Trash2, ListChecks } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/hooks/useWorkspace';

const logActivity = async (
    taskId: string,
    userId: string,
    workspaceId: string,
    entityId: string,
    actionType: string,
    description: string,
    metadata?: Record<string, any>
) => {
    try {
        await supabase.from('activity_logs').insert({
            task_id: taskId,
            actor_id: userId,
            workspace_id: workspaceId,
            entity_id: entityId,
            action_type: actionType,
            entity_type: 'checklist',
            description,
            metadata: metadata ?? {},
        });
    } catch (e) {
        console.error('[Checklist] activity log error:', e);
    }
};

interface ChecklistItem {
    id: string;
    task_id: string;
    title: string;
    is_checked: boolean;
    position: number;
    created_at: string;
}

interface TaskChecklistProps {
    taskId: string;
}

export function TaskChecklist({ taskId }: TaskChecklistProps) {
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspace();
    const { colors, colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';

    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newTitle, setNewTitle] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [showInput, setShowInput] = useState(false);
    const inputRef = useRef<TextInput>(null);

    // ─── Progress ─────────────────────────────────────────────────────
    const checkedCount = items.filter(i => i.is_checked).length;
    const total = items.length;
    const progress = total > 0 ? checkedCount / total : 0;
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [progress]);

    // ─── Fetch ────────────────────────────────────────────────────────
    const fetchItems = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('task_checklists')
                .select('*')
                .eq('task_id', taskId)
                .order('position', { ascending: true });
            if (error) throw error;
            setItems(data || []);
        } catch (e) {
            console.error('[Checklist] fetch error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    // ─── Realtime ─────────────────────────────────────────────────────
    useEffect(() => {
        const channel = supabase
            .channel(`checklist:${taskId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'task_checklists',
                filter: `task_id=eq.${taskId}`,
            }, () => {
                fetchItems();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [taskId, fetchItems]);

    // ─── Add item ─────────────────────────────────────────────────────
    const handleAdd = async () => {
        const title = newTitle.trim();
        if (!title || !user) return;
        setIsAdding(true);
        try {
            const maxPos = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 0;
            const { error } = await supabase.from('task_checklists').insert({
                task_id: taskId,
                created_by: user.id,
                title,
                position: maxPos,
            });
            if (error) throw error;
            setNewTitle('');
            await fetchItems();
            if (currentWorkspace) {
                logActivity(taskId, user.id, currentWorkspace.id, taskId, 'checklist_add', `Added checklist item: "${title}"`, { item_title: title });
            }
        } catch (e) {
            console.error('[Checklist] add error:', e);
            Alert.alert('Error', 'Failed to add checklist item');
        } finally {
            setIsAdding(false);
        }
    };

    // ─── Toggle ───────────────────────────────────────────────────────
    const handleToggle = async (item: ChecklistItem) => {
        const nowChecked = !item.is_checked;
        // Optimistic update
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: nowChecked } : i));
        try {
            const { error } = await supabase
                .from('task_checklists')
                .update({ is_checked: nowChecked })
                .eq('id', item.id);
            if (error) throw error;
            if (user && currentWorkspace) {
                const actionType = nowChecked ? 'checklist_check' : 'checklist_uncheck';
                const desc = nowChecked
                    ? `Checked "${item.title}"`
                    : `Unchecked "${item.title}"`;
                logActivity(taskId, user.id, currentWorkspace.id, item.id, actionType, desc, { item_title: item.title });
            }
        } catch (e) {
            // Revert
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: item.is_checked } : i));
            Alert.alert('Error', 'Failed to update item');
        }
    };

    // ─── Delete ───────────────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        const item = items.find(i => i.id === id);
        setItems(prev => prev.filter(i => i.id !== id));
        try {
            const { error } = await supabase.from('task_checklists').delete().eq('id', id);
            if (error) throw error;
            if (user && item && currentWorkspace) {
                logActivity(taskId, user.id, currentWorkspace.id, item.id, 'checklist_delete', `Deleted checklist item: "${item.title}"`, { item_title: item.title });
            }
        } catch (e) {
            await fetchItems();
            Alert.alert('Error', 'Failed to delete item');
        }
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const progressColor = progress === 1 ? '#22C55E' : progress > 0.5 ? '#F59E0B' : '#6366F1';

    return (
        <View style={[s.container, { backgroundColor: isDark ? colors.surface : '#F8FAFC', borderColor: colors.border }]}>
            {/* Header */}
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <ListChecks size={16} color={colors.primary} />
                    <Text style={[s.headerTitle, { color: colors.text }]}>Checklist</Text>
                    {total > 0 && (
                        <View style={[s.countBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[s.countText, { color: colors.primary }]}>
                                {checkedCount}/{total}
                            </Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity
                    onPress={() => {
                        setShowInput(v => !v);
                        setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                    style={[s.addBtn, { backgroundColor: colors.primary + '15' }]}
                >
                    <Plus size={14} color={colors.primary} />
                    <Text style={[s.addBtnText, { color: colors.primary }]}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* Progress bar */}
            {total > 0 && (
                <View style={s.progressSection}>
                    <View style={[s.progressTrack, { backgroundColor: isDark ? colors.border : '#E2E8F0' }]}>
                        <Animated.View
                            style={[s.progressFill, { width: progressWidth, backgroundColor: progressColor }]}
                        />
                    </View>
                    <Text style={[s.progressLabel, { color: colors.textTertiary }]}>
                        {Math.round(progress * 100)}%
                    </Text>
                </View>
            )}

            {/* Add input */}
            {showInput && (
                <View style={[s.inputRow, { backgroundColor: isDark ? colors.card : '#FFFFFF', borderColor: colors.border }]}>
                    <TextInput
                        ref={inputRef}
                        style={[s.input, { color: colors.text }]}
                        placeholder="New checklist item..."
                        placeholderTextColor={colors.textTertiary}
                        value={newTitle}
                        onChangeText={setNewTitle}
                        onSubmitEditing={handleAdd}
                        returnKeyType="done"
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        onPress={handleAdd}
                        disabled={!newTitle.trim() || isAdding}
                        style={[s.submitBtn, { backgroundColor: newTitle.trim() ? colors.primary : colors.border }]}
                    >
                        {isAdding
                            ? <ActivityIndicator size="small" color="#FFF" />
                            : <Plus size={14} color="#FFF" />}
                    </TouchableOpacity>
                </View>
            )}

            {/* Items */}
            {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
            ) : items.length === 0 ? (
                <Text style={[s.emptyText, { color: colors.textTertiary }]}>
                    No checklist items yet. Tap Add to create one.
                </Text>
            ) : (
                <View style={s.itemList}>
                    {items.map(item => (
                        <View
                            key={item.id}
                            style={[
                                s.itemRow,
                                { borderBottomColor: colors.border },
                                item.is_checked && { opacity: 0.6 },
                            ]}
                        >
                            <TouchableOpacity
                                onPress={() => handleToggle(item)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={s.checkBtn}
                            >
                                {item.is_checked
                                    ? <CheckSquare size={18} color="#22C55E" />
                                    : <Square size={18} color={colors.border} />}
                            </TouchableOpacity>

                            <Text
                                style={[
                                    s.itemTitle,
                                    { color: colors.text },
                                    item.is_checked && { textDecorationLine: 'line-through', color: colors.textMuted },
                                ]}
                                numberOfLines={2}
                            >
                                {item.title}
                            </Text>

                            <TouchableOpacity
                                onPress={() => handleDelete(item.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Trash2 size={14} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 16,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    countBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
    },
    countText: {
        fontSize: 11,
        fontWeight: '700',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    addBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    progressSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    progressTrack: {
        flex: 1,
        height: 5,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressLabel: {
        fontSize: 11,
        fontWeight: '700',
        minWidth: 32,
        textAlign: 'right',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 12,
        marginBottom: 10,
        borderRadius: 10,
        borderWidth: 1,
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 6,
        gap: 8,
    },
    input: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 4,
    },
    submitBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 13,
        textAlign: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    itemList: {
        paddingBottom: 4,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    checkBtn: {
        flexShrink: 0,
    },
    itemTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
});
