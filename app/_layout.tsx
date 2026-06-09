// app/_layout.tsx
import { useEffect, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Disable OS-level RTL so the app controls direction entirely via isRTL state.
// Without this, Arabic system-locale devices double-reverse every flex layout.
I18nManager.allowRTL(false);
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
        if (user.role === 'doctor') {
          router.replace('/Doctor/Dochome');
        } else {
          const today = new Date().toISOString().split('T')[0];
          const uid   = user.uid ?? 'guest';
          AsyncStorage.getItem(`energy_date_${uid}`).then(savedDate => {
            router.replace(savedDate === today ? '/tabs/home' : '/energy');
          });
        }
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

function openChatFromNotification(data: Record<string, string> | null | undefined) {
  if (!data?.screen) return;
  if (data.screen === 'Docpatient') {
    router.push({
      pathname: '/Doctor/Docpatient',
      params: { patientId: data.patientId, patientName: data.patientName, isOnline: '0' },
    });
  } else if (data.screen === 'doctorchat') {
    router.push({
      pathname: '/tabs/doctorchat',
      params: {
        doctorId:    data.doctorId,
        doctorName:  data.doctorName,
        doctorEmoji: data.doctorEmoji  || '🩺',
        doctorColor: data.doctorColor  || '#7C5CBF',
        doctorBg:    data.doctorBg     || '#F0EBFA',
        specialty:   data.specialty    || '',
        isFirebase:  '1',
      },
    });
  }
}

// ─── Root Layout ───────────────────────────────────────────
export default function RootLayout() {
  const notifSub = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Notification tapped while app is in background / foreground
    notifSub.current = Notifications.addNotificationResponseReceivedListener(response => {
      openChatFromNotification(response.notification.request.content.data as any);
    });

    // Notification tapped when app was fully closed (cold start)
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response?.notification.request.content.data) {
        setTimeout(() => openChatFromNotification(response.notification.request.content.data as any), 800);
      }
    });

    return () => { notifSub.current?.remove(); };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <LanguageProvider>
        <AuthProvider>
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="startup"    options={{ gestureEnabled: false }} />
            <Stack.Screen name="langchoose" options={{ gestureEnabled: false }} />
            <Stack.Screen name="energy"     options={{ gestureEnabled: false }} />
            {/* auth: gesture allowed so sign-in can swipe back to RoleChoose */}
            <Stack.Screen name="auth" />
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
