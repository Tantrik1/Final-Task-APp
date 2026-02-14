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
    ActivityIndicator,
    Keyboard,
    TouchableWithoutFeedback,
    Alert,
    FlexAlignType
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, User, Eye, EyeOff, ChevronRight, Github, Chrome, Command } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";

const { width } = Dimensions.get("window");

// ─── Custom Input Component ──────────────────────────────────────────────────
const CustomInput = ({
    label,
    icon: Icon,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    keyboardType,
    autoCapitalize,
    isPassword,
    showPassword,
    toggleShowPassword
}: any) => {
    const [isFocused, setIsFocused] = useState(false);
    // Animate border and background
    const focusAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(focusAnim, {
            toValue: isFocused ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [isFocused]);

    const borderColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#E2E8F0', '#F97316']
    });

    const backgroundColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#F8FAFC', '#FFFFFF']
    });

    return (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <Animated.View style={[
                styles.inputContainer,
                {
                    borderColor,
                    backgroundColor,
                    // Subtle shadow on focus
                    shadowColor: '#F97316',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isFocused ? 0.1 : 0,
                    shadowRadius: 8,
                    elevation: isFocused ? 2 : 0,
                }
            ]}>
                <Icon size={20} color={isFocused ? "#F97316" : "#94A3B8"} />
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#CBD5E1"
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
                {isPassword && (
                    <TouchableOpacity onPress={toggleShowPassword} style={styles.eyeIcon}>
                        {showPassword ?
                            <EyeOff size={20} color={isFocused ? "#F97316" : "#94A3B8"} /> :
                            <Eye size={20} color={isFocused ? "#F97316" : "#94A3B8"} />
                        }
                    </TouchableOpacity>
                )}
            </Animated.View>
        </View>
    );
};


export default function AuthScreen() {
    const insets = useSafeAreaInsets();
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
        Keyboard.dismiss();

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
            } else {
                const { error } = await signUp(email, password, fullName);
                if (error) throw error;
                Alert.alert("Success", "Account created! Please check your email to confirm.");
                toggleMode();
            }
        } catch (err: any) {
            const msg = err.message || "Something went wrong";
            if (!isLogin && (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered"))) {
                setErrorMsg("An account with this email already exists. Please login.");
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
            <Image
                source={{ uri: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop' }}
                style={[styles.bgImage, { opacity: 0.03 }]}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header Section */}
                        <View style={[styles.header, { marginTop: insets.top + 40 }]}>
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
                                <Text style={styles.errorText}>{errorMsg}</Text>
                            </View>
                        ) : null}

                        {/* Tab Bar */}
                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                style={[styles.tab, isLogin && styles.activeTab]}
                                onPress={() => !isLogin && toggleMode()}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Login</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, !isLogin && styles.activeTab]}
                                onPress={() => isLogin && toggleMode()}
                                activeOpacity={0.8}
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
                                <CustomInput
                                    label="Full Name"
                                    icon={User}
                                    value={fullName}
                                    onChangeText={setFullName}
                                    placeholder="John Doe"
                                    autoCapitalize="words"
                                />
                            )}

                            {/* Email */}
                            <CustomInput
                                label="Email"
                                icon={Mail}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="you@company.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            {/* Password */}
                            <View>
                                <CustomInput
                                    label="Password"
                                    icon={Lock}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="••••••••"
                                    isPassword={true}
                                    showPassword={showPassword}
                                    toggleShowPassword={() => setShowPassword(!showPassword)}
                                    secureTextEntry={!showPassword}
                                />
                                {isLogin && (
                                    <TouchableOpacity
                                        style={styles.forgotPassContainer}
                                        onPress={() => router.push("/auth/reset")}
                                    >
                                        <Text style={styles.forgotPassword}>Forgot Password?</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Action Button */}
                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleAuth}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text style={styles.buttonText}>
                                            {isLogin ? "Sign In" : "Create Account"}
                                        </Text>
                                        <ChevronRight size={20} color="white" strokeWidth={3} />
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
                                <TouchableOpacity style={styles.socialButton}>
                                    <View style={[styles.socialIconCircle, { backgroundColor: '#EA4335' }]}>
                                        <Chrome size={20} color="#FFF" />
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.socialButton}>
                                    <View style={[styles.socialIconCircle, { backgroundColor: '#000000' }]}>
                                        <Command size={20} color="#FFF" />
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.socialButton}>
                                    <View style={[styles.socialIconCircle, { backgroundColor: '#181717' }]}>
                                        <Github size={20} color="#FFF" />
                                    </View>
                                </TouchableOpacity>
                            </View>

                        </Animated.View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = {
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    bgImage: {
        ...Dimensions.get('window'), // Make specific typing
        position: 'absolute' as 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
    },
    header: {
        alignItems: 'center' as const,
        marginBottom: 32,
    },
    logoContainer: {
        width: 80,
        height: 80,
        backgroundColor: '#FFF7ED',
        borderRadius: 24,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FFEDD5',
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    logo: {
        width: 48,
        height: 48,
        borderRadius: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '800' as const,
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500' as const,
        color: '#64748B',
        marginTop: 6,
    },
    errorContainer: {
        backgroundColor: '#FEF2F2',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '600' as const,
        textAlign: 'center' as const,
    },
    // Tabs
    tabContainer: {
        flexDirection: 'row' as const,
        marginBottom: 28,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        padding: 4,
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
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: '#64748B',
    },
    activeTabText: {
        color: '#0F172A',
        fontWeight: '700' as const,
    },
    formContainer: {},
    // Inputs
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '700' as const,
        color: '#334155',
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
    },
    inputContainer: {
        height: 54,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1.5, // Thicker border for better visibility
    },
    input: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '600' as const,
        color: '#0F172A',
    },
    eyeIcon: {
        padding: 8,
    },
    forgotPassContainer: {
        alignSelf: 'flex-end' as const, // Fix type inference
        marginTop: -12,
        marginBottom: 24,
    },
    forgotPassword: {
        fontSize: 13,
        fontWeight: '600' as const,
        color: '#F97316',
    },
    // Button
    button: {
        height: 56,
        backgroundColor: '#F97316',
        borderRadius: 16,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700' as const,
        marginRight: 6,
    },
    // Divider
    dividerContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginVertical: 28,
    },
    dividerLine: {
        height: 1,
        width: 40,
        backgroundColor: '#E2E8F0',
    },
    dividerText: {
        color: '#94A3B8',
        fontWeight: '500' as const,
        fontSize: 13,
        marginHorizontal: 12,
    },
    socialContainer: {
        flexDirection: 'row' as const,
        justifyContent: 'center' as const,
        gap: 20,
    },
    socialButton: {
        padding: 4,
        borderRadius: 20,
    },
    socialIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    }
};
