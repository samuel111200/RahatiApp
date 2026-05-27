// app/(auth)/sign-in.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, InputField } from '../../components/UI';
import RahatiLogo from '../../components/RahatiLogo';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function DocSignInScreen() {
  const { signIn } = useAuth();
  const { t, isRTL } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = t.required;
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t.invalidEmail;
    if (!password.trim()) e.password = t.required;
    else if (password.length < 6) e.password = t.shortPassword;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignIn = () => {
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      signIn(email, password);
      setLoading(false);
      router.replace('/Doctor/Dochome');
    }, 900);
  };

  const handleDevReset = async () => {
    await AsyncStorage.clear();
    Alert.alert('✅ تم المسح', 'أُعيد تعيين التطبيق — أغلقه وافتحه من جديد');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={styles.orbTR} />
          <View style={styles.orbBL} />

          {/* DEV Reset */}
          <TouchableOpacity style={styles.devBtn} onPress={handleDevReset} activeOpacity={0.7}>
            <Ionicons name="refresh-circle-outline" size={16} color="#fff" />
            <Text style={styles.devBtnText}>Reset App</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.headerBlock}>
            <RahatiLogo />
            <Text style={styles.appName}>{t.appName}</Text>
            <Text style={styles.tagline}>{t.appTagline2}</Text>
          </View>

          {/* Title */}
          <View style={[styles.titleBlock, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text style={styles.title}>{t.signIn}</Text>
            <Text style={styles.subtitle}>{t.welcome}</Text>
          </View>

          {/* Form */}
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
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              }
            />

            <View style={styles.divRow}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>{t.orWith}</Text>
              <View style={styles.divLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                <FontAwesome name="google" size={20} color="#EA4335" />
                <Text style={styles.socialBtnText}>{t.google}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                <FontAwesome name="facebook" size={20} color="#1877F2" />
                <Text style={styles.socialBtnText}>{t.facebook}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={() => router.push('/Doctor/DocsignUp1')} style={styles.signUpRow} activeOpacity={0.7}>
            <Text style={styles.signUpText}>
              {t.noAccount}{' '}
              <Text style={styles.signUpLink}>{t.signUp}</Text>
            </Text>
          </TouchableOpacity>

          <PrimaryButton title={t.signIn} onPress={handleSignIn} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
  orbTR: { position: 'absolute', top: -30, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: Colors.primaryMid, opacity: 0.35 },
  orbBL: { position: 'absolute', bottom: 100, left: -60, width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.accentSoft, opacity: 0.4 },
  devBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 12, marginRight: 4, backgroundColor: '#FF6B6B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 4 },
  devBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  headerBlock: { alignItems: 'center', paddingTop: 44, paddingBottom: Spacing.base },
  appName: { fontSize: 26, fontWeight: '800', color: Colors.primary, marginTop: 10, letterSpacing: 1 },
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  titleBlock: { marginBottom: Spacing.xl },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xl, marginBottom: Spacing.base, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  divRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { fontSize: FontSize.xs, color: Colors.textMuted, marginHorizontal: 8 },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: Radius.lg, backgroundColor: Colors.offWhite, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  socialBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  signUpRow: { alignItems: 'center', paddingVertical: 14 },
  signUpText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  signUpLink: { color: Colors.primary, fontWeight: '700' },
});