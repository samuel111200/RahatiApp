// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../context/Languagecontext";
import "../global.css";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <LanguageProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="startup" options={{ gestureEnabled: false }} />
            <Stack.Screen name="langchoose" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
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