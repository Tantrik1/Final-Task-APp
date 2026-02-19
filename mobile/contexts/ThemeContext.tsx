import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useNativeColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  colorScheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  colors: typeof Colors.light;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Brand Colors for Hamro Task
const Colors = {
  light: {
    // Primary Brand Colors
    primary: '#4338CA',
    primaryLight: '#6366F1',
    primaryDark: '#3730A3',
    primaryBg: '#EEF2FF',
    primaryGradient: ['#4338CA', '#6366F1', '#8B5CF6'],
    
    // Secondary Colors
    secondary: '#10B981',
    secondaryLight: '#34D399',
    secondaryDark: '#059669',
    secondaryBg: '#ECFDF5',
    secondaryGradient: ['#10B981', '#34D399'],
    
    // Accent Colors
    accent: '#F97316',
    accentLight: '#FB923C',
    accentDark: '#EA580C',
    accentBg: '#FFF7ED',
    accentGradient: ['#F97316', '#FB923C'],
    
    // Surface Colors
    background: '#FAFBFC',
    surface: '#F8FAFC',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',
    cardHover: '#F8FAFC',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    borderStrong: '#CBD5E1',
    
    // Text Colors
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#64748B',
    textMuted: '#94A3B8',
    textInverse: '#FFFFFF',
    textDisabled: '#CBD5E1',
    
    // Typography Hierarchy
    h1: { color: '#0F172A', fontSize: 28, fontWeight: '900' },
    h2: { color: '#0F172A', fontSize: 22, fontWeight: '800' },
    h3: { color: '#0F172A', fontSize: 18, fontWeight: '700' },
    h4: { color: '#1E293B', fontSize: 16, fontWeight: '600' },
    h5: { color: '#1E293B', fontSize: 14, fontWeight: '600' },
    body: { color: '#475569', fontSize: 14, fontWeight: '400' },
    caption: { color: '#64748B', fontSize: 12, fontWeight: '500' },
    small: { color: '#94A3B8', fontSize: 11, fontWeight: '500' },
    
    // Status Colors
    success: '#10B981',
    successBg: '#ECFDF5',
    successBorder: '#6EE7B7',
    warning: '#F97316',
    warningBg: '#FFF7ED',
    warningBorder: '#FDBA74',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    errorBorder: '#FCA5A5',
    info: '#3B82F6',
    infoBg: '#EFF6FF',
    infoBorder: '#93C5FD',
    
    // AI Assistant Specific
    aiBubble: '#FFFFFF',
    aiBubbleBorder: '#E2E8F0',
    userBubble: '#4338CA',
    userBubbleText: '#FFFFFF',
    typingIndicator: '#6366F1',
    
    // Navigation
    tabBar: '#FFFFFF',
    tabBarActive: '#4338CA',
    tabBarInactive: '#94A3B8',
    
    // Input
    inputBg: '#FFFFFF',
    inputBorder: '#E2E8F0',
    inputBorderFocus: '#4338CA',
    inputText: '#0F172A',
    inputPlaceholder: '#94A3B8',
    
    // Button Styles
    buttonPrimary: '#4338CA',
    buttonPrimaryHover: '#3730A3',
    buttonSecondary: '#F1F5F9',
    buttonSecondaryHover: '#E2E8F0',
    buttonDanger: '#EF4444',
    buttonDangerHover: '#DC2626',
    buttonText: '#FFFFFF',
    
    // Card Styles
    cardDefault: '#FFFFFF',
    cardElevated: '#FFFFFF',
    cardGlass: 'rgba(255, 255, 255, 0.8)',
    cardGradient: ['#FFFFFF', '#F8FAFC'],
    
    // Shadow
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowLight: 'rgba(0, 0, 0, 0.05)',
    shadowStrong: 'rgba(0, 0, 0, 0.15)',
    shadowColored: 'rgba(67, 56, 202, 0.15)',
  },
  dark: {
    // Primary Brand Colors
    primary: '#6366F1',
    primaryLight: '#818CF8',
    primaryDark: '#4338CA',
    primaryBg: '#1E1B4B',
    primaryGradient: ['#4338CA', '#6366F1', '#8B5CF6'],
    
    // Secondary Colors
    secondary: '#34D399',
    secondaryLight: '#6EE7B7',
    secondaryDark: '#10B981',
    secondaryBg: '#064E3B',
    secondaryGradient: ['#10B981', '#34D399'],
    
    // Accent Colors
    accent: '#FB923C',
    accentLight: '#FDBA74',
    accentDark: '#F97316',
    accentBg: '#7C2D12',
    accentGradient: ['#F97316', '#FB923C'],
    
    // Surface Colors
    background: '#0F172A',
    surface: '#1E293B',
    surfaceElevated: '#334155',
    card: '#1E293B',
    cardHover: '#334155',
    border: '#334155',
    borderLight: '#475569',
    borderStrong: '#64748B',
    
    // Text Colors
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#1E293B',
    textDisabled: '#475569',
    
    // Typography Hierarchy
    h1: { color: '#F8FAFC', fontSize: 28, fontWeight: '900' },
    h2: { color: '#F8FAFC', fontSize: 22, fontWeight: '800' },
    h3: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
    h4: { color: '#F1F5F9', fontSize: 16, fontWeight: '600' },
    h5: { color: '#F1F5F9', fontSize: 14, fontWeight: '600' },
    body: { color: '#CBD5E1', fontSize: 14, fontWeight: '400' },
    caption: { color: '#94A3B8', fontSize: 12, fontWeight: '500' },
    small: { color: '#64748B', fontSize: 11, fontWeight: '500' },
    
    // Status Colors
    success: '#34D399',
    successBg: '#064E3B',
    successBorder: '#10B981',
    warning: '#FB923C',
    warningBg: '#7C2D12',
    warningBorder: '#F97316',
    error: '#F87171',
    errorBg: '#7F1D1D',
    errorBorder: '#EF4444',
    info: '#60A5FA',
    infoBg: '#1E3A8A',
    infoBorder: '#3B82F6',
    
    // AI Assistant Specific
    aiBubble: '#1E293B',
    aiBubbleBorder: '#334155',
    userBubble: '#6366F1',
    userBubbleText: '#FFFFFF',
    typingIndicator: '#818CF8',
    
    // Navigation
    tabBar: '#1E293B',
    tabBarActive: '#6366F1',
    tabBarInactive: '#64748B',
    
    // Input
    inputBg: '#334155',
    inputBorder: '#475569',
    inputBorderFocus: '#6366F1',
    inputText: '#F8FAFC',
    inputPlaceholder: '#94A3B8',
    
    // Button Styles
    buttonPrimary: '#6366F1',
    buttonPrimaryHover: '#4338CA',
    buttonSecondary: '#334155',
    buttonSecondaryHover: '#475569',
    buttonDanger: '#EF4444',
    buttonDangerHover: '#DC2626',
    buttonText: '#FFFFFF',
    
    // Card Styles
    cardDefault: '#1E293B',
    cardElevated: '#334155',
    cardGlass: 'rgba(30, 41, 59, 0.8)',
    cardGradient: ['#1E293B', '#334155'],
    
    // Shadow
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowLight: 'rgba(0, 0, 0, 0.2)',
    shadowStrong: 'rgba(0, 0, 0, 0.4)',
    shadowColored: 'rgba(99, 102, 241, 0.25)',
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const nativeColorScheme = useNativeColorScheme();
  
  const colorScheme = theme === 'system' 
    ? (nativeColorScheme || 'light') 
    : theme;

  // Load saved theme preference
  useEffect(() => {
    AsyncStorage.getItem('theme').then(savedTheme => {
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme as Theme);
      }
    });
  }, []);

  // Save theme preference
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
  };

  const value: ThemeContextType = {
    theme,
    colorScheme,
    setTheme,
    colors: Colors[colorScheme],
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Helper functions for consistent styling
export function createTypography(colors: typeof Colors.light) {
  return {
    h1: { ...colors.h1, fontFamily: 'System' },
    h2: { ...colors.h2, fontFamily: 'System' },
    h3: { ...colors.h3, fontFamily: 'System' },
    h4: { ...colors.h4, fontFamily: 'System' },
    h5: { ...colors.h5, fontFamily: 'System' },
    body: { ...colors.body, fontFamily: 'System' },
    caption: { ...colors.caption, fontFamily: 'System' },
    small: { ...colors.small, fontFamily: 'System' },
  };
}

export function createCardStyles(colors: typeof Colors.light) {
  return {
    default: {
      backgroundColor: colors.cardDefault,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    elevated: {
      backgroundColor: colors.cardElevated,
      borderColor: colors.borderLight,
      borderWidth: 1,
      borderRadius: 20,
      shadowColor: colors.shadowStrong,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    glass: {
      backgroundColor: colors.cardGlass,
      borderColor: colors.borderLight,
      borderWidth: 1,
      borderRadius: 20,
      shadowColor: colors.shadowLight,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    gradient: {
      borderRadius: 20,
      overflow: 'hidden',
    },
  };
}

export function createButtonStyles(colors: typeof Colors.light) {
  return {
    primary: {
      backgroundColor: colors.buttonPrimary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 24,
      shadowColor: colors.shadowColored,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    secondary: {
      backgroundColor: colors.buttonSecondary,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    danger: {
      backgroundColor: colors.buttonDanger,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderColor: colors.border,
      borderWidth: 1,
    },
  };
}

export { Colors };
