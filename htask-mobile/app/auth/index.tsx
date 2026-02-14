import { useState, useRef, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    Animated,
    Image,
    ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, User, Eye, EyeOff, Sparkles, ChevronRight, Check } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";

const { width } = Dimensions.get("window");

export default function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");

    // State for UI feedback
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Animation refs
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const router = useRouter();
    const { signIn, signUp } = useAuth();

    // Toggle between Login and Signup with animation
    const toggleMode = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true
            }),
            Animated.timing(slideAnim, {
                toValue: isLogin ? -20 : 20,
                duration: 150,
                useNativeDriver: true
            })
        ]).start(() => {
            setIsLogin(!isLogin);
            setErrorMsg("");
            slideAnim.setValue(isLogin ? 20 : -20);

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true
                })
            ]).start();
        });
    };

    const handleAuth = async () => {
        setErrorMsg("");

        if (!email || !password) {
            setErrorMsg("Please fill in all fields");
            return;
        }

        if (!isLogin && !fullName) {
            setErrorMsg("Please enter your full name");
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                const { error } = await signIn(email, password);
                if (error) throw error;
                // Navigation handled by auth listener, but we can force redirect for better UX if listener is slow
                // router.replace("/(tabs)"); 
            } else {
                const { error } = await signUp(email, password, fullName);
                if (error) throw error;
                alert("Account created! Please check your email to confirm.");
                toggleMode();
            }
        } catch (err: any) {
            const msg = err.message || "Something went wrong";
            if (!isLogin && (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered"))) {
                setErrorMsg("An account with this email already exists. If you were invited to a workspace, please sign in with the credentials sent to your email.");
                // Auto-switch to login tab after a moment
                setTimeout(() => toggleMode(), 2000);
            } else {
                setErrorMsg(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header Section */}
                        <View style={styles.header}>
                            <View style={styles.logoContainer}>
                                <Image
                                    source={require('@/assets/images/icon.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text style={styles.title}>Hamro Task</Text>
                            <Text style={styles.subtitle}>Master your day, every day.</Text>
                        </View>

                        {/* Error Banner */}
                        {errorMsg ? (
                            <View style={styles.errorContainer}>
                                <View style={styles.errorIcon}>
                                    <Text style={styles.errorIconText}>!</Text>
                                </View>
                                <Text style={styles.errorText}>{errorMsg}</Text>
                            </View>
                        ) : null}

                        {/* Tab Bar */}
                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                style={[styles.tab, isLogin && styles.activeTab]}
                                onPress={() => !isLogin && toggleMode()}
                            >
                                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Login</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, !isLogin && styles.activeTab]}
                                onPress={() => isLogin && toggleMode()}
                            >
                                <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Form Container */}
                        <Animated.View
                            style={[
                                styles.formContainer,
                                {
                                    opacity: fadeAnim,
                                    transform: [{ translateX: slideAnim }]
                                }
                            ]}
                        >
                            {/* Full Name (Signup Only) */}
                            {!isLogin && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Full Name</Text>
                                    <View style={styles.inputContainer}>
                                        <User size={20} color="#94A3B8" />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="John Doe"
                                            placeholderTextColor="#CBD5E1"
                                            value={fullName}
                                            onChangeText={setFullName}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Email */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email</Text>
                                <View style={styles.inputContainer}>
                                    <Mail size={20} color="#94A3B8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="you@company.com"
                                        placeholderTextColor="#CBD5E1"
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            {/* Password */}
                            <View style={styles.inputGroup}>
                                <View style={styles.passwordHeader}>
                                    <Text style={styles.label}>Password</Text>
                                    {isLogin && (
                                        <TouchableOpacity onPress={() => router.push("/auth/reset")}>
                                            <Text style={styles.forgotPassword}>Forgot Password?</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View style={styles.inputContainer}>
                                    <Lock size={20} color="#94A3B8" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor="#CBD5E1"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                        {showPassword ? <EyeOff size={20} color="#94A3B8" /> : <Eye size={20} color="#94A3B8" />}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Action Button */}
                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleAuth}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text style={styles.buttonText}>
                                            {isLogin ? "Sign In" : "Create Account"}
                                        </Text>
                                        <ChevronRight size={22} color="white" strokeWidth={3} />
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* Divider Text */}
                            <View style={styles.dividerContainer}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>Or continue with</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            {/* Social Buttons */}
                            <View style={styles.socialContainer}>
                                {['google', 'apple', 'github'].map((provider, i) => (
                                    <View key={i} style={styles.socialButton}>
                                        <View style={styles.socialIconPlaceholder} />
                                    </View>
                                ))}
                            </View>

                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = {
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center' as const,
        marginTop: 48,
        marginBottom: 32,
    },
    logoContainer: {
        width: 80,
        height: 80,
        backgroundColor: '#FFF7ED', // orange-50
        borderRadius: 24,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginBottom: 16,
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    logo: {
        width: 48,
        height: 48,
        borderRadius: 12,
    },
    title: {
        fontSize: 32,
        fontWeight: '800' as const,
        color: '#0F172A',
        textAlign: 'center' as const,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500' as const,
        color: '#94A3B8',
        marginTop: 4,
    },
    errorContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    errorIcon: {
        width: 24,
        height: 24,
        backgroundColor: '#FEE2E2',
        borderRadius: 12,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginRight: 12,
    },
    errorIconText: {
        color: '#DC2626',
        fontWeight: 'bold' as const,
    },
    errorText: {
        color: '#B91C1C',
        fontWeight: '500' as const,
        flex: 1,
    },
    // New Tab Styles
    tabContainer: {
        flexDirection: 'row' as const,
        marginBottom: 32,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: '#64748B',
    },
    activeTabText: {
        color: '#F97316', // Primary Orange
        fontWeight: '700' as const,
    },
    formContainer: {
        // spacing handled by children
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '700' as const,
        color: '#334155',
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        height: 56,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    input: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '600' as const,
        color: '#0F172A',
    },
    passwordHeader: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        marginBottom: 8,
    },
    forgotPassword: {
        fontSize: 12,
        fontWeight: '600' as const,
        color: '#94A3B8',
    },
    eyeIcon: {
        padding: 8,
    },
    button: {
        height: 56,
        backgroundColor: '#F97316',
        borderRadius: 16,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginTop: 8,
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold' as const,
        marginRight: 8,
    },
    dividerContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginVertical: 24,
    },
    dividerLine: {
        height: 1,
        width: 48,
        backgroundColor: '#E2E8F0',
    },
    dividerText: {
        color: '#94A3B8',
        fontWeight: '500' as const,
        marginHorizontal: 16,
    },
    socialContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'center' as const,
        gap: 16,
    },
    socialButton: {
        height: 48,
        width: 48,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginHorizontal: 8,
    },
    socialIconPlaceholder: {
        height: 24,
        width: 24,
        backgroundColor: '#CBD5E1',
        borderRadius: 12,
        opacity: 0.5,
    },
};
