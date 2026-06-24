// app/_layout.tsx
import { useEffect, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { activeChatRef } from '../utils/activeChatRef';

I18nManager.allowRTL(false);

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;
    if (data?.chatId && activeChatRef.chatId && data.chatId === activeChatRef.chatId) {
      return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: false };
    }
    return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true };
  },
});
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/Languagecontext';
import '../global.css';

function AuthGuard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const first  = (segments[0] ?? '') as string;
    const second = (segments[1] ?? '') as string;

    if (!first || first === 'startup' || first === 'langchoose') return;

    const DOCTOR_AUTH  = ['Docsignin', 'DocsignUp1', 'Docsignup2', 'RoleChoose'];
    const DOCTOR_HOME  = ['Dochome', 'Docpatient', 'Docchat', 'Docmore', 'Docnotif', 'DocNotifService'];

    const isOnPatientAuth = first === 'auth';
    const isOnDoctorAuth  = first === 'Doctor' && DOCTOR_AUTH.includes(second);
    const isOnDoctorHome  = first === 'Doctor' && DOCTOR_HOME.includes(second);
    const isOnPatientHome = first === 'tabs';

    if (isAuthenticated && user) {
      // ── Correct-portal redirects only ──────────────────────────────────────
      // A doctor on the doctor auth screen → send to doctor home.
      if (isOnDoctorAuth && user.role === 'doctor') {
        router.replace('/Doctor/Dochome');
        return;
      }
      // A patient on the patient auth screen → send to energy or home.
      if (isOnPatientAuth && user.role === 'patient') {
        const today = new Date().toISOString().split('T')[0];
        const uid   = user.uid ?? 'guest';
        AsyncStorage.getItem(`energy_date_${uid}`).then(savedDate => {
          router.replace(savedDate === today ? '/tabs/home' : '/energy');
        });
        return;
      }
      // ── Wrong-portal combinations — DO NOTHING ─────────────────────────────
      // If a doctor account appears while on the patient auth screen (or vice
      // versa), it means AuthContext.signIn() is mid-flight and about to call
      // signOut(). AuthGuard must stay silent and not redirect anywhere —
      // signIn() will clean up React state and Firebase session itself.

    } else if (!isAuthenticated) {
      if (isOnDoctorHome || isOnPatientHome) {
        // Always go to RoleChoose — never try to read app_role here.
        // app_role is cleared on logout so it would be null, causing
        // AuthGuard to route to the wrong portal.
        router.replace('/Doctor/RoleChoose');
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

export default function RootLayout() {
  const notifSub = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    notifSub.current = Notifications.addNotificationResponseReceivedListener(response => {
      openChatFromNotification(response.notification.request.content.data as any);
    });

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