// app/auth/sign-up-1.tsx  —  Patient sign-up step 1
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, InputField, GenderPicker, StepBar } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function PatientSignUp1Screen() {
  const { t, isRTL } = useLang();
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [age,       setAge]       = useState('');
  const [gender,    setGender]    = useState('');
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = t.required;
    if (!lastName.trim())  e.lastName  = t.required;
    if (!age.trim())       e.age       = t.required;
    else if (isNaN(Number(age)) || +age < 5 || +age > 120) e.age = t.invalidAge;
    if (!gender)           e.gender    = t.required;
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

          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.replace('/auth/sign-in')} style={styles.backBtn}>
              <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={Colors.primary} />
            </TouchableOpacity>
            <StepBar current={1} total={2} />
            <Text style={styles.stepLabel}>{t.step1of2}</Text>
          </View>

          <View style={styles.roleBadgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeEmoji}>🧑‍⚕️</Text>
              <Text style={styles.roleBadgeText}>
                {isRTL ? 'تسجيل مريض' : 'Patient Sign Up'}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t.personalInfo}</Text>
          <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t.enterPersonalInfo}</Text>

          <View style={styles.card}>
            <View style={[styles.nameRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={styles.halfField}>
                <InputField
                  label={t.firstName} placeholder={isRTL ? 'أحمد' : 'John'}
                  value={firstName} onChangeText={setFirstName}
                  error={errors.firstName} rtl={isRTL}
                />
              </View>
              <View style={styles.halfField}>
                <InputField
                  label={t.lastName} placeholder={isRTL ? 'محمد' : 'Doe'}
                  value={lastName} onChangeText={setLastName}
                  error={errors.lastName} rtl={isRTL}
                />
              </View>
            </View>

            <InputField
              label={t.age} placeholder="25"
              value={age} onChangeText={setAge}
              keyboardType="numeric" error={errors.age} rtl={isRTL}
            />

            <View>
              <Text style={[styles.genderLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.gender}</Text>
              <GenderPicker value={gender} onChange={setGender} maleLabel={t.male} femaleLabel={t.female} rtl={isRTL} />
              {errors.gender ? <Text style={styles.errText}>{errors.gender}</Text> : null}
            </View>
          </View>

          <PrimaryButton title={t.continueBtn} onPress={handleContinue} style={styles.btn} />

          <TouchableOpacity onPress={() => router.replace('/auth/sign-in')} style={styles.loginRow}>
            <Text style={styles.loginText}>
              {t.haveAccount}{' '}
              <Text style={styles.loginLink}>{t.signIn}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/Doctor/RoleChoose')} style={styles.switchRoleBtn} activeOpacity={0.7}>
            <View style={styles.switchRoleInner}>
              <Ionicons name="swap-horizontal-outline" size={16} color={Colors.primary} />
              <Text style={styles.switchRoleText}>
                {isRTL ? 'أنت دكتور؟ غيّر دورك' : 'Are you a doctor? Switch role'}
              </Text>
            </View>
          </TouchableOpacity>

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
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.xxl,
    padding: Spacing.xl, marginBottom: Spacing.xl,
    shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  nameRow:     { gap: 12, marginBottom: 4 },
  halfField:   { flex: 1 },
  genderLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8, marginTop: 4 },
  errText:     { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4 },

  btn:      { marginBottom: Spacing.base },
  loginRow: { alignItems: 'center', paddingVertical: 10 },
  loginText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  loginLink: { color: Colors.primary, fontWeight: '700' },

  switchRoleBtn:   { marginTop: 8 },
  switchRoleInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primaryUltraLight, borderRadius: Radius.lg,
    paddingVertical: 12, borderWidth: 1.5, borderColor: Colors.primary + '40',
  },
  switchRoleText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
});
