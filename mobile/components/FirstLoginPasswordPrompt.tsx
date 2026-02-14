import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { Shield, Lock, Eye, EyeOff, Check, AlertTriangle, Sparkles } from "lucide-react-native";

interface FirstLoginPasswordPromptProps {
    visible: boolean;
    onComplete: () => void;
    onSkip: () => void;
}

export function FirstLoginPasswordPrompt({
    visible,
    onComplete,
    onSkip,
}: FirstLoginPasswordPromptProps) {
    const [showForm, setShowForm] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const canSubmit = newPassword.length >= 8 && newPassword === confirmPassword && !isSubmitting;

    const handleUpdatePassword = async () => {
        if (!canSubmit) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from("profiles")
                    .update({ needs_password_reset: false })
                    .eq("id", user.id);
            }

            setIsSuccess(true);
            setTimeout(() => {
                onComplete();
            }, 1500);
        } catch (error: any) {
            alert(error.message || "Failed to update password");
            setIsSubmitting(false);
        }
    };

    const handleSkip = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase
                .from("profiles")
                .update({ needs_password_reset: false })
                .eq("id", user.id);
        }
        onSkip();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 justify-end bg-black/50">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                    className="flex-1 justify-end"
                >
                    <View className="bg-white rounded-t-[40px] px-8 pt-10 pb-12 shadow-2xl">
                        {!showForm && !isSuccess ? (
                            <View className="items-center">
                                <View className="h-20 w-20 bg-primary/10 rounded-full items-center justify-center mb-6">
                                    <Shield size={40} color="#FF5C00" />
                                </View>
                                <Text className="text-2xl font-bold text-gray-900 text-center mb-2">Secure Your Account</Text>
                                <Text className="text-gray-500 text-center mb-8 leading-6 text-lg">
                                    You're using a temporary password. For your security, we recommend changing it now.
                                </Text>

                                <TouchableOpacity
                                    className="bg-primary w-full py-5 rounded-2xl items-center flex-row justify-center mb-4 shadow-lg shadow-primary/30"
                                    onPress={() => setShowForm(true)}
                                >
                                    <Lock size={20} color="white" className="mr-2" />
                                    <Text className="text-white font-bold text-lg">Set New Password</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className="w-full py-4 items-center"
                                    onPress={handleSkip}
                                >
                                    <Text className="text-gray-400 font-bold">Skip (Not Recommended)</Text>
                                </TouchableOpacity>
                            </View>
                        ) : isSuccess ? (
                            <View className="items-center py-10">
                                <View className="h-20 w-20 bg-green-100 rounded-full items-center justify-center mb-6">
                                    <Check size={40} color="#22C55E" />
                                </View>
                                <Text className="text-2xl font-bold text-gray-900 text-center">Password Updated!</Text>
                                <Text className="text-gray-500 text-center mt-2">Your account is now secured.</Text>
                            </View>
                        ) : (
                            <View>
                                <Text className="text-2xl font-bold text-gray-900 mb-6">Create New Password</Text>

                                <View className="space-y-4 mb-8">
                                    <View>
                                        <Text className="text-sm font-semibold text-gray-700 mb-2">New Password</Text>
                                        <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
                                            <TextInput
                                                className="flex-1 text-gray-900 font-medium"
                                                placeholder="At least 8 characters"
                                                secureTextEntry={!showPassword}
                                                value={newPassword}
                                                onChangeText={setNewPassword}
                                            />
                                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                                {showPassword ? <EyeOff size={20} color="#64748B" /> : <Eye size={20} color="#64748B" />}
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View>
                                        <Text className="text-sm font-semibold text-gray-700 mb-2">Confirm Password</Text>
                                        <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
                                            <TextInput
                                                className="flex-1 text-gray-900 font-medium"
                                                placeholder="Repeat new password"
                                                secureTextEntry={!showPassword}
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                            />
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    className={`w-full py-5 rounded-2xl items-center flex-row justify-center ${canSubmit ? 'bg-primary' : 'bg-gray-200'}`}
                                    onPress={handleUpdatePassword}
                                    disabled={!canSubmit}
                                >
                                    {isSubmitting ? <ActivityIndicator color="white" /> : (
                                        <>
                                            <Sparkles size={20} color="white" className="mr-2" />
                                            <Text className="text-white font-bold text-lg">Update Password</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className="w-full py-4 items-center mt-2"
                                    onPress={() => setShowForm(false)}
                                    disabled={isSubmitting}
                                >
                                    <Text className="text-gray-400 font-bold">Back</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}
