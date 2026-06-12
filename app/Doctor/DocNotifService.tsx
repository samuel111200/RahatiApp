import * as Notifications from 'expo-notifications';
import Constants from "expo-constants";
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── إعداد الإشعارات ───────────────────────────────────
export async function setupDocNotifications() {
  // Note: setNotificationHandler is intentionally NOT called here.
  // The root _layout.tsx sets it once with chat-suppression logic; calling it
  // again here would overwrite that handler and break foreground suppression.

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('doc_channel', {
      name: 'Doctor Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  if (!Constants.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
}

// ─── Helper: get current lang ───────────────────────────
async function getLang(): Promise<'ar' | 'en'> {
  try {
    const saved = await AsyncStorage.getItem('app_language');
    return saved === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

// ─── دالة مساعدة داخلية ─────────────────────────────────
async function pushNotif(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'doc_channel' } : {}),
    },
    trigger: null,
  });
}

// ─── الدوال العامة ──────────────────────────────────────
export async function notifyNewRequest(patientName: string, _patientId: string) {
  const lang = await getLang();
  const title = lang === 'ar' ? '🆕 طلب انضمام جديد' : '🆕 New Join Request';
  const body  = lang === 'ar'
    ? `${patientName} أرسل طلب انضمام`
    : `${patientName} sent a join request`;
  await pushNotif(title, body);
}

export async function notifyPatientAccepted(patientName: string, _patientId: string) {
  const lang = await getLang();
  const title = lang === 'ar' ? '✅ تم قبول المريض' : '✅ Patient Accepted';
  const body  = lang === 'ar'
    ? `${patientName} أصبح من مرضاك`
    : `${patientName} is now your patient`;
  await pushNotif(title, body);
}

export async function notifyNewMessage(patientName: string, _patientId: string, preview: string) {
  const lang = await getLang();
  const short = preview.length > 50 ? preview.slice(0, 50) + '…' : preview;
  const title = lang === 'ar' ? `💬 رسالة من ${patientName}` : `💬 Message from ${patientName}`;
  await pushNotif(title, short);
}

export async function notifyMessageSent(patientName: string, _patientId: string, preview: string) {
  const lang = await getLang();
  const short = preview.length > 50 ? preview.slice(0, 50) + '…' : preview;
  const title = lang === 'ar'
    ? `📤 رسالة أُرسلت لـ ${patientName}`
    : `📤 Message sent to ${patientName}`;
  await pushNotif(title, short);
}

export async function notifyProfileUpdated(doctorName: string) {
  const lang = await getLang();
  const title = lang === 'ar' ? '✏️ تم تحديث الملف الشخصي' : '✏️ Profile Updated';
  const body  = lang === 'ar'
    ? `د. ${doctorName} — تم حفظ بياناتك بنجاح`
    : `Dr. ${doctorName} — Your data has been saved successfully`;
  await pushNotif(title, body);
}

export async function notifyLanguageChanged(lang: 'ar' | 'en') {
  const isAr = lang === 'ar';
  const title = isAr ? '🌐 تم تغيير اللغة' : '🌐 Language Changed';
  const body  = isAr
    ? 'تم تفعيل اللغة العربية بنجاح'
    : 'English language has been activated';
  await pushNotif(title, body);
}

export async function notifyAvatarUpdated(action: 'added' | 'deleted') {
  const lang = await getLang();
  const isAdded = action === 'added';
  if (lang === 'ar') {
    await pushNotif(
      isAdded ? '📸 تم تحديث صورتك' : '🗑️ تم حذف الصورة',
      isAdded ? 'تم رفع صورتك الشخصية بنجاح 🎉' : 'تم حذف صورتك الشخصية',
    );
  } else {
    await pushNotif(
      isAdded ? '📸 Photo Updated' : '🗑️ Photo Deleted',
      isAdded ? 'Your profile photo has been uploaded successfully 🎉' : 'Your profile photo has been deleted',
    );
  }
}

export async function notifyLogout() {
  const lang = await getLang();
  if (lang === 'ar') {
    await pushNotif('👋 تم تسجيل الخروج', 'تم تسجيل خروجك بنجاح. نراك قريباً!');
  } else {
    await pushNotif('👋 Logged Out', 'You have been logged out successfully. See you soon!');
  }
}

export async function notifyIncomingMessage(patientName: string, _patientId: string, messageText: string) {
  const lang = await getLang();
  const short = messageText.length > 60 ? messageText.slice(0, 60) + '…' : messageText;
  const title = lang === 'ar' ? `💬 ${patientName}` : `💬 ${patientName}`;
  await pushNotif(title, short);
}

// باقية للتوافق مع الكود القديم
export async function getDocNotifUnreadCount(): Promise<number> { return 0; }