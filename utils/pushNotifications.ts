import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

const PROJECT_ID = '9173fa5b-8197-45a4-ac98-581081c3b0db';

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

type BilingualStr = string | { ar: string; en: string };

function pickLang(val: BilingualStr, lang: string): string {
  if (typeof val === 'string') return val;
  return lang === 'en' ? val.en : val.ar;
}

export async function sendPushToUser(
  targetUid: string,
  title: BilingualStr,
  body: BilingualStr,
  chatId?: string,
  navData?: Record<string, string>,
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'users', targetUid));
    if (!snap.exists()) return;
    const data  = snap.data();
    const token = data.fcmToken as string | undefined;
    if (!token) return;
    const lang  = (data.lang as string) ?? 'ar';
    const payload: Record<string, unknown> = {
      to:    token,
      title: pickLang(title, lang),
      body:  pickLang(body,  lang),
      sound: 'default',
      data:  { ...(chatId ? { chatId } : {}), ...(navData ?? {}) },
    };
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[pushNotifications] sendPushToUser:', e);
  }
}
