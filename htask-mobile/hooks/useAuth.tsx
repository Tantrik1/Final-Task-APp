import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECOVERY_MODE_KEY = 'hamro_task_recovery_mode';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isRecoveryMode: boolean;
    signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: Error | null }>;
    updatePassword: (password: string) => Promise<{ error: Error | null }>;
    clearRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);

    useEffect(() => {
        // Initialize recovery mode from AsyncStorage
        AsyncStorage.getItem(RECOVERY_MODE_KEY).then(val => {
            if (val === 'true') setIsRecoveryMode(true);
        });

        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);

                // Detect PASSWORD_RECOVERY event
                if (event === 'PASSWORD_RECOVERY') {
                    console.log('[Auth] PASSWORD_RECOVERY event detected');
                    setIsRecoveryMode(true);
                    AsyncStorage.setItem(RECOVERY_MODE_KEY, 'true');
                }

                // Clear recovery mode on sign out
                if (event === 'SIGNED_OUT') {
                    setIsRecoveryMode(false);
                    AsyncStorage.removeItem(RECOVERY_MODE_KEY);
                }
            }
        );

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const clearRecoveryMode = useCallback(() => {
        setIsRecoveryMode(false);
        AsyncStorage.removeItem(RECOVERY_MODE_KEY);
    }, []);

    const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: 'htaskmobile://auth/callback',
                data: {
                    full_name: fullName,
                },
            },
        });

        return { error: error as Error | null };
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        return { error: error as Error | null };
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    const resetPassword = useCallback(async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'htaskmobile://auth/reset-confirm',
        });

        return { error: error as Error | null };
    }, []);

    const updatePassword = useCallback(async (password: string) => {
        const { error } = await supabase.auth.updateUser({
            password,
        });

        return { error: error as Error | null };
    }, []);

    const value = {
        user,
        session,
        isLoading,
        isRecoveryMode,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        clearRecoveryMode,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
