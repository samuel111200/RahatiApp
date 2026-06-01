// app/_layout.tsx
import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/Languagecontext';
import '../global.css';

// ─── Auth Guard ────────────────────────────────────────────
// Runs on every navigation. Blocks access to home screens when
// not authenticated, and blocks access to auth screens when authenticated.
function AuthGuard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const first  = (segments[0] ?? '') as string;
    const second = (segments[1] ?? '') as string;

    // Never interfere with splash / onboarding
    if (!first || first === 'startup' || first === 'langchoose') return;

    const DOCTOR_AUTH  = ['Docsignin', 'DocsignUp1', 'Docsignup2', 'RoleChoose'];
    const DOCTOR_HOME  = ['Dochome', 'Docpatient', 'Docchat', 'Docmore', 'Docnotif', 'DocNotifService'];

    const isOnPatientAuth = first === 'auth';
    const isOnDoctorAuth  = first === 'Doctor' && DOCTOR_AUTH.includes(second);
    const isOnDoctorHome  = first === 'Doctor' && DOCTOR_HOME.includes(second);
    const isOnPatientHome = first === 'tabs';

    if (isAuthenticated && user) {
      // Logged-in user on an auth screen → push them to their home
      if (isOnPatientAuth || isOnDoctorAuth) {
        router.replace(user.role === 'doctor' ? '/Doctor/Dochome' : '/tabs/home');
      }
    } else if (!isAuthenticated) {
      // Unauthenticated user on a home screen → push them to sign-in
      if (isOnDoctorHome || isOnPatientHome) {
        AsyncStorage.getItem('app_role').then(role => {
          router.replace(role === 'doctor' ? '/Doctor/Docsignin' : '/auth/sign-in');
        });
      }
    }
  }, [isAuthenticated, isLoading, user?.role, segments.join('/')]);

  return null;
}

// ─── Root Layout ───────────────────────────────────────────
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <LanguageProvider>
        <AuthProvider>
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="startup"    options={{ gestureEnabled: false }} />
            <Stack.Screen name="langchoose" options={{ gestureEnabled: false }} />
            {/* Auth screens — no swipe-back once inside the app */}
            <Stack.Screen name="auth"   options={{ gestureEnabled: false }} />
            <Stack.Screen name="tabs"   options={{ gestureEnabled: false }} />
            <Stack.Screen name="Doctor" options={{ gestureEnabled: false }} />
          </Stack>
          <StatusBar style="dark" />
        </AuthProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
