import React from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import {
    Home,
    FolderKanban,
    CheckSquare,
    MessageSquare,
    Calendar,
    ListTodo
} from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, FadeIn } from 'react-native-reanimated';

// Fixed constants
const TAB_BAR_HEIGHT = 50;
const CURVE_DEPTH = 36;
const CENTER_BUTTON_SIZE = 64;

const TabIcon = ({
    Icon,
    isActive,
    label,
    onPress
}: {
    Icon: any,
    isActive: boolean,
    label: string,
    onPress: () => void
}) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
        scale.value = withSpring(0.9, { damping: 10, stiffness: 200 }, () => {
            scale.value = withSpring(1);
        });
        onPress();
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.8}
            style={styles.tabItem}
            hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
        >
            <Animated.View style={[styles.iconWrapper, animatedStyle]}>
                <Icon
                    size={28}
                    color={isActive ? '#F97316' : '#94A3B8'}
                    strokeWidth={isActive ? 2.5 : 2}
                />
                {isActive && (
                    <Animated.View
                        style={styles.activeIndicator}
                        entering={FadeIn.duration(300)}
                    />
                )}
            </Animated.View>
        </TouchableOpacity>
    );
};

const CenterButton = ({ onPress }: { onPress: () => void }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
        scale.value = withSpring(0.9, { damping: 8 }, () => {
            scale.value = withSpring(1);
        });
        onPress();
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            style={styles.centerBtnContainer}
            onPress={handlePress}
        >
            <Animated.View style={[styles.centerBtn, animatedStyle]}>
                <LinearGradient
                    colors={['rgba(94, 42, 40, 1)', '#EA580C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.centerBtnGradient}
                >
                    <CheckSquare size={30} color="#FFFFFF" strokeWidth={2.5} />
                </LinearGradient>
            </Animated.View>
        </TouchableOpacity>
    );
};

export const GlobalTabBar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    const tabs = [
        { id: 'calendar', label: 'Calendar', Icon: Calendar, route: '/(tabs)/calendar' },
        { id: 'index', label: 'Home', Icon: Home, route: '/(tabs)' },
        { id: 'tasks', label: 'Tasks', Icon: CheckSquare, route: '/(tabs)/tasks' },
        { id: 'projects', label: 'Projects', Icon: FolderKanban, route: '/(tabs)/projects' },
        { id: 'chat', label: 'Chat', Icon: MessageSquare, route: '/(tabs)/chat' },
    ];

    // Layout: [Calendar, Home]  [Tasks]  [Projects, Chat]
    const leftTabs = [tabs[0], tabs[1]];
    const rightTabs = [tabs[3], tabs[4]];
    const centerRoute = tabs[2].route;

    const isActive = (route: string) => {
        if (route === '/(tabs)' && pathname === '/') return true;
        if (route === '/(tabs)') return pathname === '/' || pathname === '/(tabs)';
        return pathname.includes(route) && route !== '/(tabs)';
    };

    // SVG Path Construction
    // A full width rectangle with a bezier curve dip in the top center
    const center = width / 2;
    const holeWidth = 65; // The span of the dip

    // Path logic:
    // Start top-left -> curve down center -> top-right -> bottom-right -> bottom-left -> close
    const path = `
        M 0,0
        L ${center - holeWidth / 2},0
        C ${center - holeWidth / 3},0 ${center - holeWidth / 4},${CURVE_DEPTH} ${center},${CURVE_DEPTH}
        C ${center + holeWidth / 4},${CURVE_DEPTH} ${center + holeWidth / 3},0 ${center + holeWidth / 2},0
        L ${width},0
        L ${width},${TAB_BAR_HEIGHT + 30}
        L 0,${TAB_BAR_HEIGHT + 30}
        Z
    `;

    return (
        <View style={styles.container} pointerEvents="box-none">
            <View style={[styles.barWrapper, { height: TAB_BAR_HEIGHT + insets.bottom }]}>
                {/* Background Shape */}
                <Svg width={width} height={TAB_BAR_HEIGHT + insets.bottom + 50} style={styles.svgBg}>
                    <Defs>
                        <SvgGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
                            <Stop offset="0.4" stopColor="#FDFBF9" stopOpacity="1" />
                            <Stop offset="1" stopColor="#F8FAFC" stopOpacity="1" />
                        </SvgGradient>
                    </Defs>
                    {/* Shadow simulation using view shadow instead for simplicity */}
                    <Path d={path} fill="url(#bgGrad)" stroke="#F1F5F9" strokeWidth="1" />
                </Svg>

                <View style={[styles.contentContainer, { paddingBottom: insets.bottom }]}>
                    {/* Left Tabs */}
                    <View style={styles.sideGroup}>
                        {leftTabs.map(tab => (
                            <TabIcon
                                key={tab.id}
                                Icon={tab.Icon}
                                label={tab.label}
                                isActive={isActive(tab.route)}
                                onPress={() => router.push(tab.route as any)}
                            />
                        ))}
                    </View>

                    {/* Center Spacer */}
                    <View style={{ width: holeWidth }} />

                    {/* Right Tabs */}
                    <View style={styles.sideGroup}>
                        {rightTabs.map(tab => (
                            <TabIcon
                                key={tab.id}
                                Icon={tab.Icon}
                                label={tab.label}
                                isActive={isActive(tab.route)}
                                onPress={() => router.push(tab.route as any)}
                            />
                        ))}
                    </View>
                </View>

                {/* Floating Center Button */}
                <View style={[styles.centerPosition, { left: width / 2 - CENTER_BUTTON_SIZE / 2, bottom: insets.bottom + (TAB_BAR_HEIGHT / 2) - 10 }]}>
                    <CenterButton onPress={() => router.push(centerRoute as any)} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        zIndex: 100,
        backgroundColor: 'transparent',
    },
    barWrapper: {
        width: '100%',
        backgroundColor: 'transparent',
        // Shadow for the curve shape
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 20,
    },
    svgBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    contentContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sideGroup: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 10,
        height: '100%',
    },
    centerPosition: {
        position: 'absolute',
        width: CENTER_BUTTON_SIZE,
        height: CENTER_BUTTON_SIZE,
        zIndex: 50,
        // Bottom is calculated dynamically in render to align with curve
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
    },
    iconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#F97316',
    },
    centerBtnContainer: {
        width: CENTER_BUTTON_SIZE,
        height: CENTER_BUTTON_SIZE,
        borderRadius: CENTER_BUTTON_SIZE / 2,
        backgroundColor: '#FFFFFF', // OuterRim
        padding: 5,
        shadowColor: "#F97316",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
    },
    centerBtn: {
        flex: 1,
        borderRadius: (CENTER_BUTTON_SIZE - 10) / 2,
        overflow: 'hidden',
    },
    centerBtnGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
