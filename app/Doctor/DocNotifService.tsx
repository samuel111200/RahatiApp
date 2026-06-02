import * as Notifications from 'expo-notifications';
import Constants from "expo-constants";
import { Platform } from 'react-native';

// ─── إعداد الإشعارات ───────────────────────────────────
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
  await pushNotif('🆕 طلب انضمام جديد', `${patientName} أرسل طلب انضمام`);
}

export async function notifyPatientAccepted(patientName: string, _patientId: string) {
  await pushNotif('✅ تم قبول المريض', `${patientName} أصبح من مرضاك`);
}

export async function notifyNewMessage(patientName: string, _patientId: string, preview: string) {
  const short = preview.length > 50 ? preview.slice(0, 50) + '…' : preview;
  await pushNotif(`💬 رسالة من ${patientName}`, short);
}

export async function notifyMessageSent(patientName: string, _patientId: string, preview: string) {
  const short = preview.length > 50 ? preview.slice(0, 50) + '…' : preview;
  await pushNotif(`📤 رسالة أُرسلت لـ ${patientName}`, short);
}

export async function notifyProfileUpdated(doctorName: string) {
  await pushNotif('✏️ تم تحديث الملف الشخصي', `د. ${doctorName} — تم حفظ بياناتك بنجاح`);
}

export async function notifyLanguageChanged(lang: 'ar' | 'en') {
  const isAr = lang === 'ar';
  await pushNotif(
    isAr ? '🌐 تم تغيير اللغة' : '🌐 Language Changed',
    isAr ? 'تم تفعيل اللغة العربية بنجاح' : 'English language has been activated',
  );
}

export async function notifyAvatarUpdated(action: 'added' | 'deleted') {
  const isAdded = action === 'added';
  await pushNotif(
    isAdded ? '📸 تم تحديث صورتك' : '🗑️ تم حذف الصورة',
    isAdded ? 'تم رفع صورتك الشخصية بنجاح 🎉' : 'تم حذف صورتك الشخصية',
  );
}

export async function notifyLogout() {
  await pushNotif('👋 تم تسجيل الخروج', 'تم تسجيل خروجك بنجاح. نراك قريباً!');
}

export async function notifyIncomingMessage(patientName: string, _patientId: string, messageText: string) {
  const short = messageText.length > 60 ? messageText.slice(0, 60) + '…' : messageText;
  await pushNotif(`💬 ${patientName}`, short);
}

// باقية للتوافق مع الكود القديم — مش بتعمل حاجة دلوقتي
export async function getDocNotifUnreadCount(): Promise<number> { return 0; }