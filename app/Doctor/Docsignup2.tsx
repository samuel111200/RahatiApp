// app/Doctor/Docsignup2.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import RahatiLogo from '../../components/RahatiLogo';
import { PrimaryButton, InputField, StepBar } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function DocSignUp2Screen() {
  // ✅ params فيها الـ 4 fields اللي جاية من الخطوة الأولى بس
  const params = useLocalSearchParams<{
    firstName: string;
    lastName: string;
    age: string;
    gender: string;
  }>();

  const { signUp } = useAuth();
  const { t, isRTL } = useLang();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [specialty, setSpecialty] = useState(''); // ✅ state محلي مش من params
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim())   e.email    = t.required;
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t.invalidEmail;
    if (!password.trim()) e.password = t.required;
    else if (password.length < 6) e.password = t.shortPassword;
    if (!confirm.trim())  e.confirm  = t.required;
    else if (confirm !== password) e.confirm = t.passwordMismatch;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp(
        {
          firstName: params.firstName,
          lastName:  params.lastName,
          age:       params.age,
          gender:    params.gender,
          specialty, // ✅ من الـ state المحلي
        },
        { email, password }
      );

      // ✅ احفظ في doctor_extra_fields عشان صفحة المزيد تلتقطه
      await AsyncStorage.setItem(
        'doctor_extra_fields',
        JSON.stringify({ specialty, licenseNumber: '' })
      );

      router.replace('/Doctor/Dochome');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.stepWrap}>
            <StepBar current={2} total={2} />
            <Text style={[styles.stepLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t.step2of2}
            </Text>
          </View>

          <View style={[styles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeNum}>02</Text>
            </View>
            <RahatiLogo />
          </View>

          <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
            {t.accountData}
          </Text>
          <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
            {t.createAccount}
          </Text>

          <View style={[styles.summaryCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={styles.summaryAvatar}>
              <Ionicons name="person" size={20} color={Colors.white} />
            </View>
            <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={styles.summaryName}>
                {params.firstName} {params.lastName}
              </Text>
              <Text style={styles.summaryMeta}>
                {params.age} {t.years} · {params.gender === 'male' ? t.male : t.female}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <InputField
              label={t.email}
              placeholder="example@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              error={errors.email}
              rtl={isRTL}
            />

            {/* ✅ value من specialty state مش params */}
            <InputField
              label={isRTL ? 'التخصص' : 'Specialty'}
              placeholder={isRTL ? 'مثال: طب نفسي، أطفال، قلب...' : 'e.g. Psychiatry, Cardiology...'}
              value={specialty}
              onChangeText={setSpecialty}
              error={errors.specialty}
              rtl={isRTL}
            />

            <InputField
              label={t.password}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              error={errors.password}
              rtl={isRTL}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              }
            />

            <InputField
              label={t.confirmPassword}
              placeholder="••••••••"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              error={errors.confirm}
              rtl={isRTL}
              rightIcon={
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              }
            />
          </View>

          <PrimaryButton title={t.signUp} onPress={handleSignUp} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  scroll:   { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  backBtn:  { marginTop: Spacing.base, alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryUltraLight, alignItems: 'center', justifyContent: 'center' },
  stepWrap: { marginTop: Spacing.lg, marginBottom: Spacing.xl },
  stepLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500', marginTop: 6 },
  headerRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  stepBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryMid, alignItems: 'center', justifyContent: 'center' },
  stepBadgeNum: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  title:    { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.base },
  summaryCard:   { alignItems: 'center', backgroundColor: Colors.primaryMid, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.xl, gap: 12 },
  summaryAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  summaryName:   { fontSize: FontSize.base, fontWeight: '700', color: Colors.primaryDark },
  summaryMeta:   { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xl, marginBottom: Spacing.xl, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
});