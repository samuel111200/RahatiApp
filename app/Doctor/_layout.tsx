// app/Doctor/_layout.tsx
import { Stack } from 'expo-router';
import { ChatsProvider } from '../../context/Chatscontext';
import { setupDocNotifications } from './DocNotifService';
import { useEffect } from 'react';

export default function DoctorLayout() {
    useEffect(() => {
      setupDocNotifications();
    }, []);

  return (
    <ChatsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RoleChoose"    options={{ gestureEnabled: false }} />
        <Stack.Screen name="Docsignin"     options={{ gestureEnabled: false }} />
        <Stack.Screen name="DocsignUp1"    options={{ gestureEnabled: false }} />
        <Stack.Screen name="Docsignup2"    options={{ gestureEnabled: false }} />
        <Stack.Screen name="Dochome"       options={{ gestureEnabled: false }} />
        <Stack.Screen name="Docchat"       options={{ gestureEnabled: false }} />
        <Stack.Screen name="Docpatient"    options={{ gestureEnabled: true  }} />
        <Stack.Screen name="Docmore"       options={{ gestureEnabled: false }} />
        <Stack.Screen name="DocInfo"       options={{ gestureEnabled: false }} />
        <Stack.Screen name="DocMedication" options={{ gestureEnabled: false }} />
        <Stack.Screen name="DocAssessment" options={{ gestureEnabled: true  }} />
      </Stack>
    </ChatsProvider>
  );
}