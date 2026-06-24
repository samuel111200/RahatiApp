import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, InputField } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

// ─── NOTE ─────────────────────────────────────────────────────────────────────
// lastEnergyUpdate is read directly from signIn()'s return value — NOT from
// the `user` context state. React state is async: `user` is still null at the
// moment the await resolves, so user?.lastEnergyUpdate would always be
// undefined, sending everyone to /energy every time.
//
// REQUIRED in AuthContext.signIn():
//   return { ok: true, role: data.role, lastEnergyUpdate: data.lastEnergyUpdate ?? null };
// ──────────────────────────────────────────────────────────────────────────────

const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function PatientSignInScreen() {
  const { signIn, logout } = useAuth();
  const { t, isRTL } = useLang();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim())                    e.email    = t.required;
    else if (!/\S+@\S+\.\S+/.test(email)) e.email    = t.invalidEmail;
    if (!password.trim())                 e.password = t.required;
    else if (password.length < 6)         e.password = t.shortPassword;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignIn = async () => {
    if (!validate()) return;

    setLoading(true);

    // signIn() enforces the role gate atomically before setting any state.
    // It returns `lastEnergyUpdate` from the same Firestore read it already
    // performed — so we never have a stale-context or double-read problem.
    const { ok, error, lastEnergyUpdate } = await signIn(email, password, 'patient');
    // ↑ lastEnergyUpdate comes from the same Firestore doc signIn() already
    //   read — no second network call, no stale React state.

    // ── FAILURE ───────────────────────────────────────────────────────────────
    if (!ok) {
      setLoading(false);
      if (error === 'wrongPortal') {
        Alert.alert(
            t.error || 'Login Error',
            (t as any).wrongPortal ||
            (isRTL
                ? 'هذا الحساب مسجّل بدور مختلف. يرجى استخدام البوابة الصحيحة.'
                : 'This account is registered under a different role. Please use the correct portal.'),
        );
      } else {
        const errMsg = error ? ((t as any)[error] ?? t.signInFailed) : t.signInFailed;
        Alert.alert(t.error, errMsg);
      }
      return;
    }

    // ── SUCCESS — PATIENT ENERGY ROUTING ─────────────────────────────────────
    // Use lastEnergyUpdate from signIn()'s return — never from user context,
    // which is still null at this point due to async React state updates.
    try {
      const today = getLocalToday();
      setLoading(false); // stop spinner BEFORE navigating

      if (lastEnergyUpdate === today) {
        router.replace('/tabs/home');
      } else {
        router.replace('/energy');
      }
    } catch (err) {
      console.error('Energy routing error:', err);
      setLoading(false);
      router.replace('/tabs/home');
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
            <View style={styles.orbTR} />
            <View style={styles.orbBL} />

            <View style={styles.roleBadgeRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeEmoji}>🧑‍⚕️</Text>
                <Text style={styles.roleBadgeText}>{t.patientLogin}</Text>
              </View>
            </View>

            <View style={[styles.titleBlock, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
              <Text style={styles.title}>{t.signIn}</Text>
              <Text style={styles.subtitle}>{t.welcome}</Text>
            </View>

            <View style={styles.card}>
              <InputField
                  label={t.email}
                  placeholder="example@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
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

            <TouchableOpacity
                onPress={() => router.push('/auth/sign-up-1')}
                style={styles.signUpRow}
                activeOpacity={0.7}
            >
              <Text style={styles.signUpText}>
                {t.noAccount}{' '}
                <Text style={styles.signUpLink}>{t.signUp}</Text>
              </Text>
            </TouchableOpacity>

            <PrimaryButton title={t.signIn} onPress={handleSignIn} loading={loading} />

            <TouchableOpacity
                onPress={() => logout().then(() => router.replace('/Doctor/RoleChoose'))}
                style={styles.switchRoleBtn}
                activeOpacity={0.7}
            >
              <View style={styles.switchRoleInner}>
                <Ionicons name="swap-horizontal-outline" size={18} color={Colors.primary} />
                <Text style={styles.switchRoleText}>{t.switchToDoctorRole}</Text>
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
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    justifyContent: 'center',
  },

  orbTR: {
    position: 'absolute',
    top: -30,
    right: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#E8DFFA',
    opacity: 0.5,
  },
  orbBL: {
    position: 'absolute',
    bottom: 100,
    left: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8DFFA',
    opacity: 0.5,
  },

  roleBadgeRow: { alignItems: 'center', paddingTop: 52, paddingBottom: 24 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0EBFA',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#7C5CBF',
  },
  roleBadgeEmoji: { fontSize: 22 },
  roleBadgeText: { fontSize: FontSize.sm, fontWeight: '700', color: '#7C5CBF' },

  titleBlock: { marginBottom: Spacing.xl },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    marginBottom: Spacing.base,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },

  signUpRow: { alignItems: 'center', paddingVertical: 14 },
  signUpText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  signUpLink: { color: Colors.primary, fontWeight: '700' },

  switchRoleBtn: { marginTop: 20 },
  switchRoleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryUltraLight,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
  },
  switchRoleText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
    flex: 1,
    textAlign: 'center',
  },
});