import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Animated, Dimensions, KeyboardAvoidingView, Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { Building2, Sparkles, FolderKanban, CheckSquare, ArrowRight, ArrowLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWorkspace } from "@/hooks/useWorkspace";

const { width } = Dimensions.get("window");

export default function Onboarding() {
    const { user } = useAuth();
    const router = useRouter();
    const { createWorkspace } = useWorkspace();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [workspaceName, setWorkspaceName] = useState("");
    const [workspaceDescription, setWorkspaceDescription] = useState("");

    const handleCreateWorkspace = async () => {
        if (!workspaceName.trim() || !user) return;
        setLoading(true);
        try {
            const { error } = await createWorkspace(workspaceName.trim(), workspaceDescription.trim());

            if (error) throw error;

            setStep(2); // Move to completion
        } catch (error: any) {
            alert(error.message || "Failed to create workspace");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View className="flex-1 px-8 pt-10">
                    {/* Step Indicator */}
                    <View className="flex-row space-x-2 mb-10">
                        {[0, 1, 2].map((i) => (
                            <View
                                key={i}
                                className={`h-2 rounded-full ${i === step ? 'w-10 bg-primary' : 'w-4 bg-gray-100'}`}
                            />
                        ))}
                    </View>

                    {step === 0 && (
                        <View className="flex-1">
                            <View className="h-20 w-20 bg-primary/10 rounded-[30px] items-center justify-center mb-8">
                                <Sparkles size={40} color="#FF5C00" />
                            </View>
                            <Text className="text-4xl font-bold text-gray-900 mb-4 leading-[48px]">Welcome to Hamro Task! 🎉</Text>
                            <Text className="text-gray-500 text-xl leading-8 mb-10">
                                Nepal's best task management software. Let's get you set up in just a few steps.
                            </Text>

                            <View className="space-y-6 mb-12">
                                <View className="flex-row items-center">
                                    <View className="h-10 w-10 bg-gray-50 rounded-xl items-center justify-center mr-4">
                                        <Building2 size={24} color="#64748B" />
                                    </View>
                                    <Text className="text-gray-700 font-bold">Create your workspace</Text>
                                </View>
                                <View className="flex-row items-center">
                                    <View className="h-10 w-10 bg-gray-50 rounded-xl items-center justify-center mr-4">
                                        <FolderKanban size={24} color="#64748B" />
                                    </View>
                                    <Text className="text-gray-700 font-bold">Manage your projects</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                className="bg-primary py-5 rounded-3xl items-center flex-row justify-center shadow-lg shadow-primary/30 mt-auto mb-10"
                                onPress={() => setStep(1)}
                            >
                                <Text className="text-white font-bold text-xl">Get Started</Text>
                                <ArrowRight size={22} color="white" strokeWidth={3} className="ml-2" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 1 && (
                        <View className="flex-1">
                            <Text className="text-3xl font-bold text-gray-900 mb-2">Workspace Name</Text>
                            <Text className="text-gray-500 text-lg mb-8">A workspace is where you and your team organize projects.</Text>

                            <View className="space-y-6">
                                <View>
                                    <Text className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-widest">Name *</Text>
                                    <TextInput
                                        className="bg-gray-50 rounded-2xl px-5 py-4 text-gray-900 font-bold text-lg border border-gray-100"
                                        placeholder="e.g. My Company"
                                        value={workspaceName}
                                        onChangeText={setWorkspaceName}
                                    />
                                </View>
                                <View>
                                    <Text className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-widest">Description</Text>
                                    <TextInput
                                        className="bg-gray-50 rounded-2xl px-5 py-4 text-gray-900 font-medium border border-gray-100"
                                        placeholder="What is this for?"
                                        multiline
                                        numberOfLines={3}
                                        value={workspaceDescription}
                                        onChangeText={setWorkspaceDescription}
                                    />
                                </View>
                            </View>

                            <View className="mt-auto mb-10 flex-row space-x-4">
                                <TouchableOpacity
                                    className="bg-gray-100 h-16 w-16 rounded-2xl items-center justify-center"
                                    onPress={() => setStep(0)}
                                >
                                    <ArrowLeft size={24} color="#64748B" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className={`flex-1 rounded-3xl items-center justify-center flex-row shadow-lg ${workspaceName.trim() ? 'bg-primary shadow-primary/30' : 'bg-gray-200'}`}
                                    onPress={handleCreateWorkspace}
                                    disabled={!workspaceName.trim() || loading}
                                >
                                    <Text className="text-white font-bold text-xl">
                                        {loading ? "Creating..." : "Continue"}
                                    </Text>
                                    {!loading && <ArrowRight size={22} color="white" strokeWidth={3} className="ml-2" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {step === 2 && (
                        <View className="flex-1 items-center justify-center">
                            <View className="h-32 w-32 bg-green-100 rounded-full items-center justify-center mb-10">
                                <CheckSquare size={60} color="#22C55E" />
                            </View>
                            <Text className="text-4xl font-bold text-gray-900 text-center mb-4">You're All Set! 🚀</Text>
                            <Text className="text-gray-500 text-center text-xl leading-8 mb-12 px-4">
                                Your workspace is ready. Start adding tasks, invite team members, and get productive!
                            </Text>

                            <TouchableOpacity
                                className="bg-gray-900 w-full py-5 rounded-3xl items-center flex-row justify-center shadow-xl mb-10"
                                onPress={() => router.replace("/(tabs)")}
                            >
                                <Text className="text-white font-bold text-xl">Go to Dashboard</Text>
                                <ArrowRight size={22} color="white" strokeWidth={3} className="ml-2" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
