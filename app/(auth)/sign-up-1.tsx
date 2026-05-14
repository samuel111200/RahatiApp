// app/(auth)/sign-up-1.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RahatiLogo from '../../components/RahatiLogo';
import { PrimaryButton, InputField, GenderPicker, StepBar } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function SignUp1Screen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'هذا الحقل مطلوب';
    if (!lastName.trim()) e.lastName = 'هذا الحقل مطلوب';
    if (!age.trim()) e.age = 'هذا الحقل مطلوب';
    else if (isNaN(Number(age)) || +age < 5 || +age > 120) e.age = 'يرجى إدخال عمر صحيح';
    if (!gender) e.gender = 'هذا الحقل مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    router.push({ pathname: '/(auth)/sign-up-2', params: { firstName, lastName, age, gender } });
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
            <StepBar current={1} total={2} />
            <Text style={styles.stepLabel}>الخطوة 1 من 2</Text>
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeNum}>01</Text></View>
            <RahatiLogo size={48} showBackground />
          </View>
          <Text style={styles.title}>المعلومات الشخصية</Text>
          <Text style={styles.subtitle}>أدخل معلوماتك الشخصية</Text>

          {/* Form */}
          <View style={styles.card}>
            <View style={styles.nameRow}>
              <View style={styles.halfField}>
                <InputField label="الاسم الأول" placeholder="أحمد" value={firstName} onChangeText={setFirstName} error={errors.firstName} rtl />
              </View>
              <View style={styles.halfField}>
                <InputField label="الاسم الثاني" placeholder="محمد" value={lastName} onChangeText={setLastName} error={errors.lastName} rtl />
              </View>
            </View>

            <InputField label="العمر" placeholder="25" value={age} onChangeText={setAge} keyboardType="numeric" error={errors.age} rtl />

            <View>
              <Text style={styles.genderLabel}>الجنس</Text>
              <GenderPicker value={gender} onChange={setGender} maleLabel="ذكر" femaleLabel="أنثى" rtl />
              {errors.gender ? <Text style={styles.errText}>{errors.gender}</Text> : null}
            </View>
          </View>

          <PrimaryButton title="متابعة" onPress={handleContinue} style={styles.btn} />

          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')} style={styles.loginRow}>
            <Text style={styles.loginText}>لديك حساب بالفعل؟ <Text style={styles.loginLink}>تسجيل الدخول</Text></Text>
          </TouchableOpacity>
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
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: Spacing.xl },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xl, marginBottom: Spacing.xl, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  nameRow: { flexDirection: 'row-reverse', gap: 12 },
  halfField: { flex: 1 },
  genderLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right', marginBottom: 8 },
  errText: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4, textAlign: 'right' },
  btn: { marginBottom: Spacing.base },
  loginRow: { alignItems: 'center', paddingVertical: 10 },
  loginText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  loginLink: { color: Colors.primary, fontWeight: '700' },
});
