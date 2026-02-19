import React, { useState } from 'react';
import {
    View, Text, StyleSheet,
    TouchableOpacity, TextInput, Platform, Modal,
} from 'react-native';
import {
    Search, X, Flag, ChevronDown, Calendar, FolderOpen, Check,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type SortOption = 'due_date' | 'updated' | 'priority';
export type PriorityFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low';
export type StatusFilter = 'all' | 'active' | 'completed' | 'overdue';

export interface ProjectOption {
    id: string;
    name: string;
    color: string | null;
}

interface SmartFilterBarProps {
    searchQuery: string;
    onSearchChange: (text: string) => void;
    priorityFilter: PriorityFilter;
    onPriorityFilterChange: (p: PriorityFilter) => void;
    statusFilter: StatusFilter;
    onStatusFilterChange: (s: StatusFilter) => void;
    projectFilter: string | null;
    onProjectFilterChange: (id: string | null) => void;
    projects: ProjectOption[];
    activeFiltersCount: number;
    onClearFilters: () => void;
}

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string; color: string }[] = [
    { value: 'all',    label: 'All priorities', color: '#94A3B8' },
    { value: 'urgent', label: 'Urgent',          color: '#EF4444' },
    { value: 'high',   label: 'High',            color: '#F97316' },
    { value: 'medium', label: 'Medium',          color: '#EAB308' },
    { value: 'low',    label: 'Low',             color: '#94A3B8' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string; color: string }[] = [
    { value: 'all',       label: 'All dates',  color: '#94A3B8' },
    { value: 'overdue',   label: 'Overdue',    color: '#EF4444' },
    { value: 'active',    label: 'Active',     color: '#3B82F6' },
    { value: 'completed', label: 'Completed',  color: '#10B981' },
];

type OpenMenu = 'priority' | 'date' | 'project' | null;

export function SmartFilterBar({
    searchQuery,
    onSearchChange,
    priorityFilter,
    onPriorityFilterChange,
    statusFilter,
    onStatusFilterChange,
    projectFilter,
    onProjectFilterChange,
    projects,
    activeFiltersCount,
    onClearFilters,
}: SmartFilterBarProps) {
    const { colors, colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';
    const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

    const toggle = (menu: OpenMenu) => setOpenMenu(prev => prev === menu ? null : menu);

    const activePriority = PRIORITY_OPTIONS.find(o => o.value === priorityFilter)!;
    const activeStatus   = STATUS_OPTIONS.find(o => o.value === statusFilter)!;
    const activeProject  = projects.find(p => p.id === projectFilter);

    const priorityActive = priorityFilter !== 'all';
    const statusActive   = statusFilter !== 'all';
    const projectActive  = projectFilter !== null;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Backdrop to close dropdowns */}
            {openMenu !== null && (
                <Modal transparent visible={true} animationType="none">
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill} 
                        onPress={() => setOpenMenu(null)}
                        activeOpacity={1}
                    />
                </Modal>
            )}
            {/* ── Search Row ── */}
            <View style={styles.searchRow}>
                <View style={[
                    styles.searchBar,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    searchQuery.length > 0 && { borderColor: colors.primary },
                ]}>
                    <Search size={16} color={searchQuery.length > 0 ? colors.primary : colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search tasks..."
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={onSearchChange}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <View style={[styles.clearBtn, { backgroundColor: colors.surface }]}>
                                <X size={12} color={colors.textSecondary} />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Clear all badge */}
                {activeFiltersCount > 0 && (
                    <TouchableOpacity
                        style={[styles.clearAllBtn, { backgroundColor: colors.error + '18', borderColor: colors.error + '50' }]}
                        onPress={onClearFilters}
                    >
                        <X size={13} color={colors.error} />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Dropdown Button Row ── */}
            <View style={styles.dropdownRow}>
                {/* Priority */}
                <TouchableOpacity
                    style={[
                        styles.dropBtn,
                        { backgroundColor: colors.card, borderColor: priorityActive ? activePriority.color : colors.border },
                        priorityActive && { backgroundColor: activePriority.color + '18' },
                        openMenu === 'priority' && { borderColor: colors.primary },
                    ]}
                    onPress={() => toggle('priority')}
                    accessible={true}
                    accessibilityLabel={`Filter by priority: ${priorityActive ? activePriority.label : 'All'}`}
                    accessibilityRole="button"
                >
                    <Flag size={13} color={priorityActive ? activePriority.color : colors.textSecondary} />
                    <Text style={[styles.dropBtnText, { color: priorityActive ? activePriority.color : colors.textSecondary }]} numberOfLines={1}>
                        {priorityActive ? activePriority.label : 'Priority'}
                    </Text>
                    <ChevronDown size={12} color={priorityActive ? activePriority.color : colors.textTertiary}
                        style={{ transform: [{ rotate: openMenu === 'priority' ? '180deg' : '0deg' }] }}
                    />
                </TouchableOpacity>

                {/* Date / Status */}
                <TouchableOpacity
                    style={[
                        styles.dropBtn,
                        { backgroundColor: colors.card, borderColor: statusActive ? activeStatus.color : colors.border },
                        statusActive && { backgroundColor: activeStatus.color + '18' },
                        openMenu === 'date' && { borderColor: colors.primary },
                    ]}
                    onPress={() => toggle('date')}
                    accessible={true}
                    accessibilityLabel={`Filter by date: ${statusActive ? activeStatus.label : 'All'}`}
                    accessibilityRole="button"
                >
                    <Calendar size={13} color={statusActive ? activeStatus.color : colors.textSecondary} />
                    <Text style={[styles.dropBtnText, { color: statusActive ? activeStatus.color : colors.textSecondary }]} numberOfLines={1}>
                        {statusActive ? activeStatus.label : 'Date'}
                    </Text>
                    <ChevronDown size={12} color={statusActive ? activeStatus.color : colors.textTertiary}
                        style={{ transform: [{ rotate: openMenu === 'date' ? '180deg' : '0deg' }] }}
                    />
                </TouchableOpacity>

                {/* Project */}
                <TouchableOpacity
                    style={[
                        styles.dropBtn,
                        { backgroundColor: colors.card, borderColor: projectActive ? (activeProject?.color || colors.primary) : colors.border },
                        projectActive && { backgroundColor: (activeProject?.color || colors.primary) + '18' },
                        openMenu === 'project' && { borderColor: colors.primary },
                    ]}
                    onPress={() => toggle('project')}
                    accessible={true}
                    accessibilityLabel={`Filter by project: ${activeProject ? activeProject.name : 'All'}`}
                    accessibilityRole="button"
                >
                    {projectActive && activeProject?.color ? (
                        <View style={[styles.projectDot, { backgroundColor: activeProject.color }]} />
                    ) : (
                        <FolderOpen size={13} color={projectActive ? (activeProject?.color || colors.primary) : colors.textSecondary} />
                    )}
                    <Text style={[styles.dropBtnText, { color: projectActive ? (activeProject?.color || colors.primary) : colors.textSecondary }]} numberOfLines={1}>
                        {activeProject ? activeProject.name : 'Project'}
                    </Text>
                    <ChevronDown size={12} color={projectActive ? (activeProject?.color || colors.primary) : colors.textTertiary}
                        style={{ transform: [{ rotate: openMenu === 'project' ? '180deg' : '0deg' }] }}
                    />
                </TouchableOpacity>
            </View>

            {/* ── Priority Dropdown ── */}
            {openMenu === 'priority' && (
                <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                    {PRIORITY_OPTIONS.map((opt, i) => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[
                                styles.dropItem,
                                i < PRIORITY_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                                priorityFilter === opt.value && { backgroundColor: isDark ? colors.surface : opt.color + '10' },
                            ]}
                            onPress={() => { onPriorityFilterChange(opt.value); setOpenMenu(null); }}
                        >
                            <View style={styles.dropItemLeft}>
                                {opt.value !== 'all'
                                    ? <View style={[styles.dotLg, { backgroundColor: opt.color }]} />
                                    : <View style={[styles.dotLg, { backgroundColor: colors.border }]} />
                                }
                                <Text style={[styles.dropItemText, { color: priorityFilter === opt.value ? opt.color : colors.text }]}>
                                    {opt.label}
                                </Text>
                            </View>
                            {priorityFilter === opt.value && <Check size={14} color={opt.color} />}
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* ── Date / Status Dropdown ── */}
            {openMenu === 'date' && (
                <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                    {STATUS_OPTIONS.map((opt, i) => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[
                                styles.dropItem,
                                i < STATUS_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                                statusFilter === opt.value && { backgroundColor: isDark ? colors.surface : opt.color + '10' },
                            ]}
                            onPress={() => { onStatusFilterChange(opt.value); setOpenMenu(null); }}
                        >
                            <View style={styles.dropItemLeft}>
                                <View style={[styles.dotLg, { backgroundColor: opt.color }]} />
                                <Text style={[styles.dropItemText, { color: statusFilter === opt.value ? opt.color : colors.text }]}>
                                    {opt.label}
                                </Text>
                            </View>
                            {statusFilter === opt.value && <Check size={14} color={opt.color} />}
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* ── Project Dropdown ── */}
            {openMenu === 'project' && (
                <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                    {/* All projects option */}
                    <TouchableOpacity
                        style={[
                            styles.dropItem,
                            { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                            projectFilter === null && { backgroundColor: isDark ? colors.surface : colors.primaryBg },
                        ]}
                        onPress={() => { onProjectFilterChange(null); setOpenMenu(null); }}
                    >
                        <View style={styles.dropItemLeft}>
                            <View style={[styles.dotLg, { backgroundColor: colors.border }]} />
                            <Text style={[styles.dropItemText, { color: projectFilter === null ? colors.primary : colors.text }]}>
                                All projects
                            </Text>
                        </View>
                        {projectFilter === null && <Check size={14} color={colors.primary} />}
                    </TouchableOpacity>

                    {projects.map((proj, i) => (
                        <TouchableOpacity
                            key={proj.id}
                            style={[
                                styles.dropItem,
                                i < projects.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                                projectFilter === proj.id && { backgroundColor: isDark ? colors.surface : (proj.color || colors.primary) + '10' },
                            ]}
                            onPress={() => { onProjectFilterChange(proj.id); setOpenMenu(null); }}
                        >
                            <View style={styles.dropItemLeft}>
                                <View style={[styles.dotLg, { backgroundColor: proj.color || colors.primary }]} />
                                <Text style={[styles.dropItemText, { color: projectFilter === proj.id ? (proj.color || colors.primary) : colors.text }]} numberOfLines={1}>
                                    {proj.name}
                                </Text>
                            </View>
                            {projectFilter === proj.id && <Check size={14} color={proj.color || colors.primary} />}
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 8,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 10,
        marginBottom: 10,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 42,
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 8,
        borderWidth: 1.5,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        height: '100%',
        fontWeight: '500',
    },
    clearBtn: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearAllBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    dropdownRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
        marginBottom: 8,
    },
    dropBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 36,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    dropBtnText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
    },
    projectDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dropdown: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
            android: { elevation: 4 },
        }),
    },
    dropItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 11,
    },
    dropItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    dotLg: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dropItemText: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
});
