import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
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
    const token = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    await setDoc(doc(db, 'users', uid), { fcmToken: token.data }, { merge: true });
  } catch (e) {
    console.warn('[pushNotifications] registerPushToken:', e);
  }
}

export function startTokenRefreshListener(uid: string): () => void {
  const sub = Notifications.addPushTokenListener(async ({ data: token }) => {
    try {
      await setDoc(doc(db, 'users', uid), { fcmToken: token }, { merge: true });
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

    await fetch(`${backendUrl}/api/send-push`, {
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
  } catch (e) {
    console.warn('[pushNotifications] sendPushToUser:', e);
  }
}
