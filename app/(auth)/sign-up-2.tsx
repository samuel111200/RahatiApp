// app/(auth)/sign-up-2.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import RahatiLogo from '../../components/RahatiLogo';
import { PrimaryButton, InputField, StepBar } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function SignUp2Screen() {
  const params = useLocalSearchParams<{ firstName: string; lastName: string; age: string; gender: string }>();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'هذا الحقل مطلوب';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'البريد الإلكتروني غير صحيح';
    if (!password.trim()) e.password = 'هذا الحقل مطلوب';
    else if (password.length < 6) e.password = 'كلمة المرور 6 أحرف على الأقل';
    if (!confirm.trim()) e.confirm = 'هذا الحقل مطلوب';
    else if (confirm !== password) e.confirm = 'كلمتا المرور غير متطابقتين';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = () => {
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      signUp(
        { firstName: params.firstName, lastName: params.lastName, age: params.age, gender: params.gender },
        { email, password }
      );
      setLoading(false);
      router.replace('/(tabs)/startup');
    }, 900);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
          </TouchableOpacity>

          {/* Step bar */}
          <View style={styles.stepWrap}>
            <StepBar current={2} total={2} />
            <Text style={styles.stepLabel}>الخطوة 2 من 2</Text>
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeNum}>02</Text></View>
            <RahatiLogo size={48} showBackground />
          </View>
          <Text style={styles.title}>بيانات الحساب</Text>
          <Text style={styles.subtitle}>أنشئ بيانات حسابك</Text>

          {/* Summary mini card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryAvatar}>
              <Ionicons name="person" size={20} color={Colors.white} />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.summaryName}>{params.firstName} {params.lastName}</Text>
              <Text style={styles.summaryMeta}>
                {params.age} سنة · {params.gender === 'male' ? 'ذكر' : 'أنثى'}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.card}>
            <InputField label="البريد الإلكتروني" placeholder="example@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" error={errors.email} rtl />
            <InputField
              label="كلمة المرور" placeholder="••••••••" value={password}
              onChangeText={setPassword} secureTextEntry={!showPass} error={errors.password} rtl
              rightIcon={<TouchableOpacity onPress={() => setShowPass(!showPass)}><Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} /></TouchableOpacity>}
            />
            <InputField
              label="تأكيد كلمة المرور" placeholder="••••••••" value={confirm}
              onChangeText={setConfirm} secureTextEntry={!showConfirm} error={errors.confirm} rtl
              rightIcon={<TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}><Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} /></TouchableOpacity>}
            />
          </View>

          <PrimaryButton title="إنشاء حساب" onPress={handleSignUp} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  backBtn: { marginTop: Spacing.base, alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryUltraLight, alignItems: 'center', justifyContent: 'center' },
  stepWrap: { marginTop: Spacing.lg, marginBottom: Spacing.xl },
  stepLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500', textAlign: 'right', marginTop: 6 },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  stepBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryMid, alignItems: 'center', justifyContent: 'center' },
  stepBadgeNum: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right', marginBottom: 4 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: Spacing.base },
  summaryCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: Colors.primaryMid, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.xl, gap: 12 },
  summaryAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  summaryName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primaryDark },
  summaryMeta: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xl, marginBottom: Spacing.xl, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
});
