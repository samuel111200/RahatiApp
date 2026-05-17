// app/(auth)/sign-up-1.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '../../context/Languagecontext';
import RahatiLogo from '../../components/RahatiLogo';
import { PrimaryButton, InputField, GenderPicker, StepBar } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function SignUp1Screen() {
  const { t, isRTL } = useLang();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = t.required;
    if (!lastName.trim()) e.lastName = t.required;
    if (!age.trim()) e.age = t.required;
    else if (isNaN(Number(age)) || +age < 5 || +age > 120) e.age = t.invalidAge;
    if (!gender) e.gender = t.required;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    router.push({ pathname: '/auth/sign-up-2', params: { firstName, lastName, age, gender } });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.stepWrap}>
            <StepBar current={1} total={2} />
            <Text style={[styles.stepLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.step1of2}</Text>
          </View>

          <View style={[styles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeNum}>01</Text></View>
            <RahatiLogo />
          </View>
          <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t.personalInfo}</Text>
          <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t.enterPersonalInfo}</Text>

          <View style={styles.card}>
            <View style={[styles.nameRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={styles.halfField}>
                <InputField label={t.firstName} placeholder={isRTL ? 'أحمد' : 'John'} value={firstName} onChangeText={setFirstName} error={errors.firstName} rtl={isRTL} />
              </View>
              <View style={styles.halfField}>
                <InputField label={t.lastName} placeholder={isRTL ? 'محمد' : 'Doe'} value={lastName} onChangeText={setLastName} error={errors.lastName} rtl={isRTL} />
              </View>
            </View>

            <InputField label={t.age} placeholder="25" value={age} onChangeText={setAge} keyboardType="numeric" error={errors.age} rtl={isRTL} />

            <View>
              <Text style={[styles.genderLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.gender}</Text>
              <GenderPicker value={gender} onChange={setGender} maleLabel={t.male} femaleLabel={t.female} rtl={isRTL} />
              {errors.gender ? <Text style={[styles.errText, { textAlign: isRTL ? 'right' : 'left' }]}>{errors.gender}</Text> : null}
            </View>
          </View>

          <PrimaryButton title={t.continueBtn} onPress={handleContinue} style={styles.btn} />

          <TouchableOpacity onPress={() => router.push('/auth/sign-in')} style={styles.loginRow}>
            <Text style={styles.loginText}>{t.haveAccount} <Text style={styles.loginLink}>{t.signIn}</Text></Text>
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
  stepLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500', marginTop: 6 },
  headerRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  stepBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryMid, alignItems: 'center', justifyContent: 'center' },
  stepBadgeNum: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xl, marginBottom: Spacing.xl, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  nameRow: { gap: 12 },
  halfField: { flex: 1 },
  genderLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  errText: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4 },
  btn: { marginBottom: Spacing.base },
  loginRow: { alignItems: 'center', paddingVertical: 10 },
  loginText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  loginLink: { color: Colors.primary, fontWeight: '700' },
});