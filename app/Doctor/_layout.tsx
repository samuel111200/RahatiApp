// app/Doctor/_layout.tsx
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { ChatsProvider } from '../../context/Chatscontext';
import { setupDocNotifications } from './DocNotifService';
import DocTabBar from '../../components/DocTabBar';

const DOC_TAB_HIDDEN = ['RoleChoose', 'Docsignin', 'DocsignUp1', 'Docsignup2', 'Docpatient'];

function DocTabBarGate() {
  const pathname = usePathname();
  const hidden = DOC_TAB_HIDDEN.some(seg => pathname.includes(seg));
  if (hidden) return null;
  return <DocTabBar />;
}

export default function DoctorLayout() {
  useEffect(() => {
    setupDocNotifications();
  }, []);

  return (
    <ChatsProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="RoleChoose"    options={{ gestureEnabled: false }} />
          <Stack.Screen name="Docsignin"     options={{ gestureEnabled: false }} />
          <Stack.Screen name="DocsignUp1"    options={{ gestureEnabled: false }} />
          <Stack.Screen name="Docsignup2"    options={{ gestureEnabled: false }} />
          <Stack.Screen name="Dochome"       options={{ gestureEnabled: false }} />
          <Stack.Screen name="Docchat"       options={{ gestureEnabled: true  }} />
          <Stack.Screen name="Docpatient"    options={{ gestureEnabled: true  }} />
          <Stack.Screen name="Docmore"       options={{ gestureEnabled: true  }} />
          <Stack.Screen name="DocInfo"       options={{ gestureEnabled: true  }} />
          <Stack.Screen name="DocMedication" options={{ gestureEnabled: true  }} />
          <Stack.Screen name="DocAssessment" options={{ gestureEnabled: true  }} />
        </Stack>
        <DocTabBarGate />
      </View>
    </ChatsProvider>
  );
}
