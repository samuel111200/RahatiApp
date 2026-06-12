import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

const PROJECT_ID = '9173fa5b-8197-45a4-ac98-581081c3b0db';

// ── Token registration ─────────────────────────────────────────────────────────

export async function registerPushToken(uid: string): Promise<void> {
  try {
    if (!Constants.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (finalStatus !== 'granted') {
      const { status: asked } = await Notifications.requestPermissionsAsync();
      finalStatus = asked;
    }
    if (finalStatus !== 'granted') return;

    const savedLang = await AsyncStorage.getItem('app_language').catch(() => null);
    const lang = savedLang === 'en' ? 'en' : 'ar';
    const updates: Record<string, string> = { devicePlatform: Platform.OS, lang };

    // Native FCM token (Android) — backend uses this path with Admin SDK to include imageUrl
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      updates.fcmToken = deviceToken.data;
    } catch {
      // getDevicePushTokenAsync may fail in Expo Go — fall through to Expo token
    }

    // Expo push token — cross-platform fallback (iOS, Expo Go)
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    updates.expoPushToken = expoToken.data;
    if (!updates.fcmToken) updates.fcmToken = expoToken.data;

    // Retry saving tokens up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await setDoc(doc(db, 'users', uid), updates, { merge: true });
        return;
      } catch (e) {
        if (attempt === 3) throw e;
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  } catch (e) {
    console.warn('[pushNotifications] registerPushToken:', e);
  }
}

export function startTokenRefreshListener(uid: string): () => void {
  const sub = Notifications.addPushTokenListener(async ({ data: token }) => {
    try {
      // Only update the Expo push token on refresh — native FCM token rarely changes
      await setDoc(doc(db, 'users', uid), { expoPushToken: token }, { merge: true });
    } catch (e) {
      console.warn('[pushNotifications] token refresh save:', e);
    }
  });
  return () => sub.remove();
}

// ── Cross-device push via backend ──────────────────────────────────────────────

type BilingualStr = string | { ar: string; en: string };

export async function sendPushToUser(
  targetUid:  string,
  title:      BilingualStr,
  body:       BilingualStr,
  chatId?:    string,
  navData?:   Record<string, string>,
): Promise<void> {
  try {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      console.warn('[pushNotifications] EXPO_PUBLIC_BACKEND_URL is not set — skipping push');
      return;
    }

    // Firebase ID token proves the caller is an authenticated user
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;

    const res = await fetch(`${backendUrl}/api/send-push`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        toUserId: targetUid,
        title,
        body,
        data: { ...(chatId ? { chatId } : {}), ...(navData ?? {}) },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[pushNotifications] send-push failed:', res.status, err.reason ?? err);
    }
  } catch (e) {
    console.warn('[pushNotifications] sendPushToUser:', e);
  }
}
