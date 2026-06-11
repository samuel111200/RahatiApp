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
import { useAuth } from '../../context/AuthContext';

const MED_HIDDEN_SEGMENTS = ['doctorchat', 'Exercisesessionscreen'];

function MedicationNoteGate() {
  const pathname = usePathname();
  const hidden = MED_HIDDEN_SEGMENTS.some(seg => pathname.includes(seg));
  if (hidden) return null;
  return <MedicationNote />;
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
        <Stack.Screen name="tasks"                 options={{ gestureEnabled: false }} />
        <Stack.Screen name="info"                  options={{ gestureEnabled: false }} />
        <Stack.Screen name="exercises"             options={{ gestureEnabled: false }} />
        <Stack.Screen name="more"                  options={{ gestureEnabled: false }} />
        <Stack.Screen name="doctors"               options={{ gestureEnabled: true  }} />
        <Stack.Screen name="doctorchat"            options={{ gestureEnabled: true  }} />
        <Stack.Screen name="Exercisesessionscreen" options={{ gestureEnabled: false }} />
      </Stack>
      <MedicationNoteGate />
    </View>
  );
}
