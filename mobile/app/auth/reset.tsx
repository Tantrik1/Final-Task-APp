import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Mail, ChevronLeft, ArrowRight, ShieldCheck } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";

export default function ResetPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const { resetPassword } = useAuth();

    const handleReset = async () => {
        if (!email) return;
        setLoading(true);
        const { error } = await resetPassword(email);

        if (error) {
            alert(error.message);
        } else {
            setSuccess(true);
        }
        setLoading(false);
    };

    return (
        <View style={localStyles.container}>
            <SafeAreaView style={localStyles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={localStyles.keyboardView}
                >
                    <View style={localStyles.navBar}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={localStyles.backButton}
                        >
                            <ChevronLeft size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={localStyles.scrollContent} keyboardShouldPersistTaps="handled">
                        <View style={localStyles.header}>
                            <View style={localStyles.iconContainer}>
                                <ShieldCheck size={40} color="#FF5C00" />
                            </View>
                            <Text style={localStyles.title}>Reset Password</Text>
                            <Text style={localStyles.subtitle}>
                                {success
                                    ? "Check your email for the reset link."
                                    : "Enter your email address and we'll send you a link to reset your password."}
                            </Text>
                        </View>

                        {!success ? (
                            <View style={localStyles.formContainer}>
                                <View style={localStyles.inputGroup}>
                                    <Text style={localStyles.label}>Email Address</Text>
                                    <View style={localStyles.inputContainer}>
                                        <Mail size={20} color="#94A3B8" />
                                        <TextInput
                                            style={localStyles.input}
                                            placeholder="you@company.com"
                                            placeholderTextColor="#CBD5E1"
                                            value={email}
                                            onChangeText={setEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[localStyles.button, loading && localStyles.buttonDisabled]}
                                    onPress={handleReset}
                                    disabled={loading}
                                >
                                    <Text style={localStyles.buttonText}>
                                        {loading ? "Sending..." : "Send Reset Link"}
                                    </Text>
                                    {!loading && <ArrowRight size={20} color="white" strokeWidth={3} />}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={localStyles.secondaryButton}
                                onPress={() => router.back()}
                            >
                                <Text style={localStyles.buttonText}>Back to Login</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const localStyles = {
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
    navBar: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
    },
    backButton: {
        height: 40,
        width: 40,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
    },
    header: {
        marginTop: 24,
        marginBottom: 40,
    },
    iconContainer: {
        height: 80,
        width: 80,
        backgroundColor: '#FFF7ED',
        borderRadius: 24,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    title: {
        fontSize: 32,
        fontWeight: '800' as const,
        color: '#0F172A',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '500' as const,
        color: '#64748B',
        lineHeight: 28,
    },
    formContainer: {
        gap: 24,
    },
    inputGroup: {
        marginBottom: 8,
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
    button: {
        height: 56,
        backgroundColor: '#F97316',
        borderRadius: 16,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        gap: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    secondaryButton: {
        height: 56,
        backgroundColor: '#0F172A',
        borderRadius: 16,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginTop: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold' as const,
    },
};
