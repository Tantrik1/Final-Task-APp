import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Search, SlidersHorizontal, ArrowUpDown, LayoutList, Check, X } from 'lucide-react-native';

export type SortOption = 'due_date' | 'updated' | 'priority';
export type ViewMode = 'smart' | 'status' | 'project';

interface SmartFilterBarProps {
    searchQuery: string;
    onSearchChange: (text: string) => void;
    currentSort: SortOption;
    onSortChange: (sort: SortOption) => void;
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
    activeFiltersCount: number;
    onOpenFilters: () => void;
}

export function SmartFilterBar({
    searchQuery,
    onSearchChange,
    currentSort,
    onSortChange,
    currentView,
    onViewChange,
    activeFiltersCount,
    onOpenFilters,
}: SmartFilterBarProps) {
    return (
        <View style={styles.container}>
            {/* Search Bar */}
            <View style={styles.searchRow}>
                <View style={styles.searchBar}>
                    <Search size={18} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search tasks..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={onSearchChange}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => onSearchChange('')}>
                            <X size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={[styles.filterBtn, activeFiltersCount > 0 && styles.filterBtnActive]}
                    onPress={onOpenFilters}
                >
                    <SlidersHorizontal size={18} color={activeFiltersCount > 0 ? '#FFFFFF' : '#64748B'} />
                    {activeFiltersCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{activeFiltersCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Quick Toggles */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.toggles}
            >
                {/* View Mode */}
                <TouchableOpacity
                    style={[styles.chip, currentView === 'smart' && styles.chipActive]}
                    onPress={() => onViewChange('smart')}
                >
                    <LayoutList size={14} color={currentView === 'smart' ? '#FFF' : '#64748B'} />
                    <Text style={[styles.chipText, currentView === 'smart' && styles.chipTextActive]}>Smart View</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.chip, currentView === 'project' && styles.chipActive]}
                    onPress={() => onViewChange('project')}
                >
                    <Text style={[styles.chipText, currentView === 'project' && styles.chipTextActive]}>By Project</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.chip, currentView === 'status' && styles.chipActive]}
                    onPress={() => onViewChange('status')}
                >
                    <Text style={[styles.chipText, currentView === 'status' && styles.chipTextActive]}>By Status</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* Sort */}
                <TouchableOpacity
                    style={[styles.chip, currentSort === 'due_date' && styles.chipActiveSecondary]}
                    onPress={() => onSortChange('due_date')}
                >
                    <ArrowUpDown size={14} color={currentSort === 'due_date' ? '#0F172A' : '#64748B'} />
                    <Text style={[styles.chipText, currentSort === 'due_date' && styles.chipTextActiveSecondary]}>Due Date</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.chip, currentSort === 'priority' && styles.chipActiveSecondary]}
                    onPress={() => onSortChange('priority')}
                >
                    <Text style={[styles.chipText, currentSort === 'priority' && styles.chipTextActiveSecondary]}>Priority</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 12,
        backgroundColor: '#F8FAFC',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        height: 44,
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#0F172A',
        height: '100%',
    },
    filterBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterBtnActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#F97316',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#F8FAFC',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    toggles: {
        paddingHorizontal: 20,
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    chipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    chipActiveSecondary: {
        backgroundColor: '#E2E8F0',
        borderColor: '#CBD5E1',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    chipTextActiveSecondary: {
        color: '#0F172A',
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: '#CBD5E1',
        alignSelf: 'center',
        marginHorizontal: 4,
    },
});
