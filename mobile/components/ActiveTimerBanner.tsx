import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Timer, Square, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useTimer } from '@/contexts/TimerContext';

interface ActiveTimer {
    task_id: string;
    task_title: string;
    project_name: string;
    session_id: string;
    started_at: string;
    total_work_time: number;
}

const pad = (n: number) => n.toString().padStart(2, '0');

const formatLive = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
};

export function ActiveTimerBanner() {
    const { user } = useAuth();
    const { colors, colorScheme } = useTheme();
    const isDark = colorScheme === 'dark';
    const router = useRouter();
    const { activeTimer, isTimerRunning, refreshTimer } = useTimer();

    const [elapsed, setElapsed] = useState(0);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // ─── Safety net: refetch every 30 seconds ─────
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(refreshTimer, 30000);
        return () => clearInterval(interval);
    }, [user, refreshTimer]);

    // ─── Live tick ────────────────────────────────────────────────────
    useEffect(() => {
        if (!activeTimer) {
            setElapsed(0);
            return;
        }
        const sessionStart = new Date(activeTimer.started_at).getTime();
        const tick = () => {
            const sessionElapsed = Math.floor((Date.now() - sessionStart) / 1000);
            setElapsed(activeTimer.total_work_time + sessionElapsed);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [activeTimer]);

    // ─── Pulse animation on the dot ──────────────────────────────────
    useEffect(() => {
        if (!activeTimer) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [activeTimer, pulseAnim]);

    // ─── Stop timer ───────────────────────────────────────────────────
    const handleStop = async () => {
        if (!activeTimer) return;
        try {
            await supabase.rpc('stop_task_timer', { target_task_id: activeTimer.task_id });
            refreshTimer(); // Context will update state
        } catch (e) {
            console.error('[ActiveTimerBanner] stop error:', e);
        }
    };

    if (!activeTimer) return null;

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
                <Text style={[styles.timerText, { color: isDark ? '#4ADE80' : '#16A34A' }]}>
                    {formatLive(elapsed)}
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
}

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
