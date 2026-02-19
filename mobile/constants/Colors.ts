// Re-export colors from ThemeContext for backward compatibility
export { Colors } from '@/contexts/ThemeContext';

// Legacy exports for compatibility
const tintColorLight = '#4338CA';
const tintColorDark = '#6366F1';

export default {
  light: {
    text: '#1E293B',
    background: '#FFFFFF',
    tint: tintColorLight,
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F8FAFC',
    background: '#0F172A',
    tint: tintColorDark,
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
  },
};
