// app/tabs/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import {
  setupNotifications,
  registerBackgroundTask,
  startAllWatchers,
  stopAllWatchers,
  setNotifUid,
} from './notificationService';
import MedicationNote from '../../components/Medicationnote';
import PatientTabBar from '../../components/PatientTabBar';
import { useAuth } from '../../context/AuthContext';

const MED_HIDDEN_SEGMENTS = ['doctorchat', 'Exercisesessionscreen'];
const TAB_HIDDEN_SEGMENTS = ['doctorchat', 'Exercisesessionscreen', 'references'];

function MedicationNoteGate() {
  const pathname = usePathname();
  const hidden = MED_HIDDEN_SEGMENTS.some(seg => pathname.includes(seg));
  if (hidden) return null;
  return <MedicationNote />;
}

function PatientTabBarGate() {
  const pathname = usePathname();
  const hidden = TAB_HIDDEN_SEGMENTS.some(seg => pathname.includes(seg));
  if (hidden) return null;
  return <PatientTabBar />;
}

export default function TabsLayout() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) setNotifUid(user.uid);

    setupNotifications();
    registerBackgroundTask();
    startAllWatchers();

    return () => {
      stopAllWatchers();
      setNotifUid('');
    };
  }, [user?.uid]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home"                  options={{ gestureEnabled: false }} />
        <Stack.Screen name="info"                  options={{ gestureEnabled: true  }} />
        <Stack.Screen name="exercises"             options={{ gestureEnabled: true  }} />
        <Stack.Screen name="more"                  options={{ gestureEnabled: true  }} />
        <Stack.Screen name="doctors"               options={{ gestureEnabled: true  }} />
        <Stack.Screen name="doctorchat"            options={{ gestureEnabled: true  }} />
        <Stack.Screen name="Exercisesessionscreen" options={{ gestureEnabled: true  }} />
        <Stack.Screen name="references"            options={{ gestureEnabled: true  }} />
      </Stack>
      <MedicationNoteGate />
      <PatientTabBarGate />
    </View>
  );
}
