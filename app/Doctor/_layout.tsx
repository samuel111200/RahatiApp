// app/Doctor/_layout.tsx
import { Stack } from 'expo-router';
import { ChatsProvider } from '../../context/Chatscontext';

export default function DoctorLayout() {
  return (
    <ChatsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RoleChoose" />
        <Stack.Screen name="Docsignin"  />
        <Stack.Screen name="Docsignup1" />
        <Stack.Screen name="Docsignup2" />
        <Stack.Screen name="Dochome"    />
        <Stack.Screen name="Docchat"    />
        <Stack.Screen name="Docpatient" options={{ gestureEnabled: true }} />
        <Stack.Screen name="Docmore"    />
        <Stack.Screen name="DocNotif"   options={{ gestureEnabled: true }} />
        <Stack.Screen name="DocExercises" options={{ gestureEnabled: true }} />
      </Stack>
    </ChatsProvider>
  );
}