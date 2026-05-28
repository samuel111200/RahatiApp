import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from "expo-constants";
import { Platform } from 'react-native';

type AppNotification = {
  id: string;
  title: string;
  body: string;
  emoji: string;
  type: 'task' | 'break' | 'energy' | 'add' | 'delete' | 'update';
  timestamp: number;
  read: boolean;
};

const DOC_NOTIF_KEY = 'doc_notifications';
const DEDUP_KEY     = 'doc_notif_dedup';

// ─── إعداد الإشعارات (استدعيه في _layout.tsx) ─────────
export async function setupDocNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('doc_channel', {
      name: 'إشعارات الدكتور',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  if (!Constants.isDevice) return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
}

// ─── منع التكرار ───────────────────────────────────────
async function isDuplicate(hash: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DEDUP_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (list.includes(hash)) return true;
    const updated = [hash, ...list].slice(0, 50);
    await AsyncStorage.setItem(DEDUP_KEY, JSON.stringify(updated));
    return false;
  } catch { return false; }
}

function makeHash(type: string, id: string) {
  return `${type}_${id}_${Math.floor(Date.now() / 60000)}`;
}

// ─── حفظ + إشعار خارجي ────────────────────────────────
async function pushAndSave(
  notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>,
  hash: string,
  pushTitle: string,
  pushBody: string,
) {
  if (await isDuplicate(hash)) return;

  const raw  = await AsyncStorage.getItem(DOC_NOTIF_KEY);
  const list: AppNotification[] = raw ? JSON.parse(raw) : [];
  const newNotif: AppNotification = {
    ...notif,
    id: `doc_notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    read: false,
  };
  await AsyncStorage.setItem(DOC_NOTIF_KEY, JSON.stringify([newNotif, ...list].slice(0, 50)));

  await Notifications.scheduleNotificationAsync({
    content: {
      title: pushTitle,
      body: pushBody,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'doc_channel' } : {}),
    },
    trigger: null,
  });
}

// ─── حساب عدد الإشعارات غير المقروءة ──────────────────
export async function getDocNotifUnreadCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(DOC_NOTIF_KEY);
    if (!raw) return 0;
    const list: AppNotification[] = JSON.parse(raw);
    return list.filter(n => !n.read).length;
  } catch { return 0; }
}

// ─── لما مريض يبعت طلب انضمام ─────────────────────────
export async function notifyNewRequest(patientName: string, patientId: string) {
  await pushAndSave(
    { title: '🆕 طلب انضمام جديد', body: `${patientName} أرسل طلب انضمام`, emoji: '🆕', type: 'add' },
    makeHash('request', patientId),
    '🆕 طلب انضمام جديد',
    `${patientName} أرسل طلب انضمام`,
  );
}

// ─── لما الدكتور يقبل مريض ────────────────────────────
export async function notifyPatientAccepted(patientName: string, patientId: string) {
  await pushAndSave(
    { title: '✅ تم قبول المريض', body: `${patientName} انضم لقائمة مرضاك`, emoji: '✅', type: 'update' },
    makeHash('accepted', patientId),
    '✅ تم قبول المريض',
    `${patientName} أصبح من مرضاك`,
  );
}

// ─── لما مريض يبعت رسالة ──────────────────────────────
export async function notifyNewMessage(patientName: string, patientId: string, preview: string) {
  const short = preview.length > 50 ? preview.slice(0, 50) + '…' : preview;
  await pushAndSave(
    { title: `💬 رسالة من ${patientName}`, body: short, emoji: '💬', type: 'task' },
    makeHash('msg', `${patientId}_${preview.slice(0, 20)}`),
    `💬 رسالة من ${patientName}`,
    short,
  );
}

// ─── لما الدكتور يبعت رسالة لمريض ────────────────────
export async function notifyMessageSent(patientName: string, patientId: string, preview: string) {
  const short = preview.length > 50 ? preview.slice(0, 50) + '…' : preview;
  await pushAndSave(
    { title: `📤 رسالة أُرسلت لـ ${patientName}`, body: short, emoji: '📤', type: 'task' },
    makeHash('sent', `${patientId}_${preview.slice(0, 20)}`),
    `📤 رسالة أُرسلت لـ ${patientName}`,
    short,
  );
}

// ─── ✅ NEW: لما الدكتور يحفظ بياناته الشخصية ────────
export async function notifyProfileUpdated(doctorName: string) {
  await pushAndSave(
    {
      title: '✏️ تم تحديث الملف الشخصي',
      body: `د. ${doctorName} — تم حفظ بياناتك بنجاح`,
      emoji: '✏️',
      type: 'update',
    },
    makeHash('profile_update', doctorName + Date.now()),
    '✏️ تم تحديث الملف الشخصي',
    `د. ${doctorName} — تم حفظ بياناتك بنجاح`,
  );
}

// ─── ✅ NEW: لما الدكتور يغير اللغة ──────────────────
export async function notifyLanguageChanged(lang: 'ar' | 'en') {
  const isAr   = lang === 'ar';
  const title  = isAr ? '🌐 تم تغيير اللغة' : '🌐 Language Changed';
  const body   = isAr ? 'تم تفعيل اللغة العربية بنجاح' : 'English language has been activated';
  const hash   = makeHash('lang_change', lang + Date.now());
  await pushAndSave(
    { title, body, emoji: '🌐', type: 'update' },
    hash,
    title,
    body,
  );
}

// ─── ✅ NEW: لما الدكتور يغير الصورة الشخصية ─────────
export async function notifyAvatarUpdated(action: 'added' | 'deleted') {
  const isAdded = action === 'added';
  const title   = isAdded ? '📸 تم تحديث صورتك' : '🗑️ تم حذف الصورة';
  const body    = isAdded
    ? 'تم رفع صورتك الشخصية بنجاح 🎉'
    : 'تم حذف صورتك الشخصية';
  await pushAndSave(
    { title, body, emoji: isAdded ? '📸' : '🗑️', type: isAdded ? 'add' : 'delete' },
    makeHash('avatar', action + Date.now()),
    title,
    body,
  );
}

// ─── ✅ NEW: لما الدكتور يسجل الخروج ─────────────────
export async function notifyLogout() {
  await pushAndSave(
    {
      title: '👋 تم تسجيل الخروج',
      body: 'تم تسجيل خروجك بنجاح. نراك قريباً!',
      emoji: '👋',
      type: 'update',
    },
    makeHash('logout', Date.now().toString()),
    '👋 تم تسجيل الخروج',
    'تم تسجيل خروجك بنجاح. نراك قريباً!',
  );
}

// ─── ✅ NEW: إشعار رسالة واردة جديدة من المريض (للشاتات) ──
export async function notifyIncomingMessage(
  patientName: string,
  patientId: string,
  messageText: string,
) {
  const short = messageText.length > 60 ? messageText.slice(0, 60) + '…' : messageText;
  // هاش بيتغير مع كل رسالة جديدة (مش مقيّد بالدقيقة)
  const hash  = `incoming_${patientId}_${messageText.slice(0, 30)}_${Date.now()}`;

  const raw  = await AsyncStorage.getItem(DOC_NOTIF_KEY);
  const list: AppNotification[] = raw ? JSON.parse(raw) : [];
  const newNotif: AppNotification = {
    id: `doc_notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title: `💬 ${patientName}`,
    body: short,
    emoji: '💬',
    type: 'task',
    timestamp: Date.now(),
    read: false,
  };
  await AsyncStorage.setItem(DOC_NOTIF_KEY, JSON.stringify([newNotif, ...list].slice(0, 50)));

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💬 ${patientName}`,
      body: short,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'doc_channel' } : {}),
    },
    trigger: null,
  });
}