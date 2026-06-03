// app/auth/sign-up-2.tsx  —  Patient sign-up step 2
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, InputField, StepBar } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function PatientSignUp2Screen() {
  const params = useLocalSearchParams<{ firstName: string; lastName: string; age: string; gender: string }>();
  const { signUp } = useAuth();
  const { t, isRTL } = useLang();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [loading,     setLoading]     = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim())               e.email    = t.required;
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t.invalidEmail;
    if (!password.trim())            e.password = t.required;
    else if (password.length < 6)    e.password = t.shortPassword;
    if (!confirm.trim())             e.confirm  = t.required;
    else if (confirm !== password)   e.confirm  = t.passwordMismatch;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);
    const { ok, error } = await signUp(
      {
        firstName: params.firstName,
        lastName:  params.lastName,
        age:       params.age,
        gender:    params.gender,
        role:      'patient',
      },
      { email, password },
    );
    setLoading(false);
    if (ok) {
      router.replace('/tabs/home');
    } else {
      Alert.alert(
        isRTL ? 'خطأ في إنشاء الحساب' : 'Sign Up Error',
        error ?? (isRTL ? 'فشل إنشاء الحساب، حاول مجدداً' : 'Sign up failed, please try again'),
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={Colors.primary} />
            </TouchableOpacity>
            <StepBar current={2} total={2} />
            <Text style={styles.stepLabel}>{t.step2of2}</Text>
          </View>

          <View style={styles.roleBadgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeEmoji}>🧑‍⚕️</Text>
              <Text style={styles.roleBadgeText}>
                {isRTL ? 'تسجيل مريض' : 'Patient Sign Up'}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t.accountData}</Text>
          <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t.createAccount}</Text>

          <View style={[styles.summaryCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={styles.summaryAvatar}>
              <Text style={{ fontSize: 22 }}>🧑‍⚕️</Text>
            </View>
            <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={styles.summaryName}>{params.firstName} {params.lastName}</Text>
              <Text style={styles.summaryMeta}>
                {params.age} {t.years} · {params.gender === 'male' ? t.male : t.female}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF82" />
          </View>

          <View style={styles.card}>
            <InputField
              label={t.email}
              placeholder="example@email.com"
              value={email} onChangeText={setEmail}
              keyboardType="email-address"
              error={errors.email} rtl={isRTL}
            />
            <InputField
              label={t.password} placeholder="••••••••"
              value={password} onChangeText={setPassword}
              secureTextEntry={!showPass} error={errors.password} rtl={isRTL}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              }
            />
            <InputField
              label={t.confirmPassword} placeholder="••••••••"
              value={confirm} onChangeText={setConfirm}
              secureTextEntry={!showConfirm} error={errors.confirm} rtl={isRTL}
              rightIcon={
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              }
            />

            <Text style={styles.passHint}>
              {isRTL ? '🔒 كلمة المرور 6 أحرف على الأقل' : '🔒 At least 6 characters'}
            </Text>
          </View>

          <PrimaryButton title={t.signUp} onPress={handleSignUp} loading={loading} />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },

  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Spacing.base, marginBottom: Spacing.lg },
  backBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryUltraLight, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', marginLeft: 4 },

  roleBadgeRow: { alignItems: 'flex-start', marginBottom: Spacing.base },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E8F8F2', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 50, borderWidth: 1.5, borderColor: '#4CAF82',
  },
  roleBadgeEmoji: { fontSize: 18 },
  roleBadgeText:  { fontSize: FontSize.sm, fontWeight: '700', color: '#2E7D52' },

  title:    { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.base },

  summaryCard: {
    alignItems: 'center', backgroundColor: '#E8F8F2',
    borderRadius: Radius.xl, padding: Spacing.base,
    marginBottom: Spacing.xl, gap: 12,
    borderWidth: 1.5, borderColor: '#4CAF82' + '50',
  },
  summaryAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#4CAF82' + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  summaryName: { fontSize: FontSize.base, fontWeight: '700', color: '#1A5C32' },
  summaryMeta: { fontSize: FontSize.xs, color: '#4CAF82', marginTop: 2 },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.xxl,
    padding: Spacing.xl, marginBottom: Spacing.xl,
    shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  passHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
});
