import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Timer, Square, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useActiveTimer, useIsTimerRunning, useTimerActions } from '@/stores/useTaskStore';

const pad = (n: number) => n.toString().padStart(2, '0');

const formatLive = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
};

// Memoized component to prevent unnecessary re-renders
const OptimizedTimerBanner = React.memo(() => {
    const { user } = useAuth();
    const { colors, colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';
    const router = useRouter();
    
    const activeTimer = useActiveTimer();
    const isTimerRunning = useIsTimerRunning();
    const { stopTimer, clearError } = useTimerActions();
    
    // Ref-based timer text to avoid re-renders
    const timerTextRef = useRef<Text>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const intervalRef = useRef<any>(null);

    // ─── Live tick with ref-based DOM update ─────────────────────────
    useEffect(() => {
        if (!activeTimer || !timerTextRef.current) {
            if (timerTextRef.current) {
                timerTextRef.current.setNativeProps({ text: '0:00' });
            }
            return;
        }

        const sessionStart = new Date(activeTimer.started_at).getTime();
        const tick = () => {
            if (timerTextRef.current) {
                const sessionElapsed = Math.floor((Date.now() - sessionStart) / 1000);
                const totalElapsed = activeTimer.total_work_time + sessionElapsed;
                timerTextRef.current.setNativeProps({ text: formatLive(totalElapsed) });
            }
        };

        tick(); // Initial tick
        intervalRef.current = setInterval(tick, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [activeTimer]);

    // ─── Pulse animation ───────────────────────────────────────────────
    useEffect(() => {
        if (!activeTimer) {
            Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
            return;
        }

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [activeTimer, pulseAnim]);

    // ─── Stop timer handler ─────────────────────────────────────────────
    const handleStop = useCallback(async () => {
        if (!activeTimer || !user) return;
        clearError();
        await stopTimer(activeTimer.task_id, user);
    }, [activeTimer, user, stopTimer, clearError]);

    if (!activeTimer || !isTimerRunning) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/task/${activeTimer.task_id}` as any)}
            style={[
                styles.banner,
                {
                    backgroundColor: isDark ? '#1C2A1C' : '#F0FDF4',
                    borderColor: isDark ? '#166534' : '#86EFAC',
                },
            ]}
        >
            {/* Left: pulse dot + timer icon */}
            <View style={styles.left}>
                <View style={styles.iconWrap}>
                    <Timer size={14} color="#22C55E" />
                    <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
                </View>
                <View style={styles.textBlock}>
                    <Text style={[styles.label, { color: isDark ? '#86EFAC' : '#15803D' }]}>
                        Working on
                    </Text>
                    <Text
                        style={[styles.taskTitle, { color: isDark ? '#DCFCE7' : '#14532D' }]}
                        numberOfLines={1}
                    >
                        {activeTimer.task_title}
                    </Text>
                    <Text style={[styles.projectName, { color: isDark ? '#4ADE80' : '#16A34A' }]} numberOfLines={1}>
                        {activeTimer.project_name}
                    </Text>
                </View>
            </View>

            {/* Right: live timer + stop + chevron */}
            <View style={styles.right}>
                <Text 
                    ref={timerTextRef}
                    style={[styles.timerText, { color: isDark ? '#4ADE80' : '#16A34A' }]}
                >
                    0:00
                </Text>
                <TouchableOpacity
                    onPress={handleStop}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[styles.stopBtn, { backgroundColor: isDark ? '#166534' : '#DCFCE7' }]}
                >
                    <Square size={12} color="#EF4444" fill="#EF4444" />
                </TouchableOpacity>
                <ChevronRight size={14} color={isDark ? '#4ADE80' : '#16A34A'} />
            </View>
        </TouchableOpacity>
    );
});

OptimizedTimerBanner.displayName = 'OptimizedTimerBanner';

export { OptimizedTimerBanner as OptimizedTimerBanner };

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 2,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    iconWrap: {
        position: 'relative',
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseDot: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#22C55E',
    },
    textBlock: {
        flex: 1,
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    taskTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginTop: 1,
    },
    projectName: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timerText: {
        fontSize: 15,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        letterSpacing: -0.3,
        minWidth: 52,
        textAlign: 'right',
    },
    stopBtn: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
