// app/Doctor/Docsignin.tsx
// app/Doctor/Docsignin.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, InputField } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function DocSignInScreen() {
  const { signIn, logout } = useAuth();
  const { t, isRTL } = useLang();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim())              e.email    = t.required;
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t.invalidEmail;
    if (!password.trim())           e.password = t.required;
    else if (password.length < 6)   e.password = t.shortPassword;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleDevReset = async () => {
    await AsyncStorage.clear();
    Alert.alert('✅ تم المسح', 'أُعيد تعيين التطبيق — أغلقه وافتحه من جديد');
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setLoading(true);
    const { ok, error, role } = await signIn(email, password);
    setLoading(false);

    if (!ok) {
      Alert.alert(
        isRTL ? 'خطأ في تسجيل الدخول' : 'Sign In Error',
        error ?? (isRTL ? 'فشل تسجيل الدخول' : 'Sign in failed'),
      );
      return;
    }

    if (role !== 'doctor') {
      // Patient account used on doctor screen → reject
      await logout();
      Alert.alert(
        isRTL ? 'حساب مريض' : 'Patient Account',
        isRTL
          ? 'هذا الحساب خاص بالمرضى. اختر "مريض" من صفحة اختيار الدور.'
          : 'This is a patient account. Please select "Patient" from the role screen.',
      );
      return;
    }

    router.replace('/Doctor/Dochome');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Background orbs ── */}
          <View style={styles.orbTR} />
          <View style={styles.orbBL} />

          {/* ── DEV Reset ── */}
          <TouchableOpacity style={styles.devBtn} onPress={handleDevReset} activeOpacity={0.7}>
            <Ionicons name="refresh-circle-outline" size={16} color="#fff" />
            <Text style={styles.devBtnText}>Reset App</Text>
          </TouchableOpacity>

          {/* ── Role badge ── */}
          <View style={styles.roleBadgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeEmoji}>🩺</Text>
              <Text style={styles.roleBadgeText}>
                {isRTL ? 'دخول الدكتور' : 'Doctor Login'}
              </Text>
            </View>
          </View>

          {/* ── Title ── */}
          <View style={[styles.titleBlock, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text style={styles.title}>{t.signIn}</Text>
            <Text style={styles.subtitle}>{t.welcome}</Text>
          </View>

          {/* ── Form card ── */}
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
          </View>

          {/* ── Sign up link ── */}
          <TouchableOpacity
            onPress={() => router.push('/Doctor/DocsignUp1')}
            style={styles.signUpRow}
            activeOpacity={0.7}
          >
            <Text style={styles.signUpText}>
              {t.noAccount}{' '}
              <Text style={styles.signUpLink}>{t.signUp}</Text>
            </Text>
          </TouchableOpacity>

          {/* ── Sign in button ── */}
          <PrimaryButton title={t.signIn} onPress={handleSignIn} loading={loading} />

          {/* ── Switch role ── */}
          <TouchableOpacity
            onPress={() => router.replace('/Doctor/RoleChoose')}
            style={styles.switchRoleBtn}
            activeOpacity={0.7}
          >
            <View style={styles.switchRoleInner}>
              <Ionicons name="swap-horizontal-outline" size={18} color={Colors.primary} />
              <Text style={styles.switchRoleText}>
                {isRTL ? 'أنت مريض؟ غيّر دورك' : 'Are you a patient? Switch role'}
              </Text>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={16}
                color={Colors.primary}
              />
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

  orbTR: {
    position: 'absolute', top: -30, right: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: Colors.primaryMid, opacity: 0.35,
  },
  orbBL: {
    position: 'absolute', bottom: 100, left: -60,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.accentSoft, opacity: 0.4,
  },

  roleBadgeRow: { alignItems: 'center', paddingTop: 52, paddingBottom: 24 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryUltraLight, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 50, borderWidth: 1.5, borderColor: Colors.primary + '60',
  },
  roleBadgeEmoji: { fontSize: 22 },
  roleBadgeText:  { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },

  titleBlock: { marginBottom: Spacing.xl },
  title:      { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle:   { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.xxl,
    padding: Spacing.xl, marginBottom: Spacing.base,
    shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },

  signUpRow:  { alignItems: 'center', paddingVertical: 14 },
  signUpText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  signUpLink: { color: Colors.primary, fontWeight: '700' },

  switchRoleBtn: { marginTop: 20 },
  switchRoleInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primaryUltraLight,
    borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: Colors.primary + '40',
  },
  switchRoleText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, flex: 1, textAlign: 'center' },
  devBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 12, marginRight: 4, backgroundColor: '#FF6B6B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 4 },
  devBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
