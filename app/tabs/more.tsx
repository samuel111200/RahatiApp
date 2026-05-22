import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, SafeAreaView, TextInput, Alert, Switch, Image,
  Animated, Platform, StatusBar, KeyboardAvoidingView, 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, OutlineButton } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { notify } from './notificationService';

// ─── Storage Keys ─────────────────────────────────────────
const STORAGE_KEYS = {
  CORE_TASKS:   'core_tasks',
  EXTRA_TASKS:  'extra_tasks',
  CORE_EX:      'core_exercises',
  EXTRA_EX:     'extra_exercises',
  ENERGY:       'energy_level',
  NOTIF_PUSH:   'notif_push_enabled',
  NOTIF_REMIND: 'notif_reminders_enabled',
  REMIND_HOUR:  'notif_reminder_hour',
  REMIND_MIN:   'notif_reminder_min',
};

// ─── Default reminder time ─────────────────────────────────
const DEFAULT_REMIND_HOUR = 8;
const DEFAULT_REMIND_MIN  = 0;

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function getPlanDoneKey(date: Date) {
  return `plan_done_${toKey(date)}`;
}

// ─── Sub-components ────────────────────────────────────────

function InfoRow({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return (
    <View style={[styles.infoRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={styles.infoValue}>{value || '—'}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, value, color, onPress, isLast, isRTL }: {
  icon: string; label: string; value?: string; color: string;
  onPress: () => void; isLast: boolean; isRTL: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.menuRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }, !isLast && styles.menuRowBorder]}
    >
      <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color={Colors.primary + '80'} />
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={[styles.menuIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
    </TouchableOpacity>
  );
}

function MiniStat({ icon, value, label, color, bg }: {
  icon: string; value: number | string; label: string; color: string; bg: string;
}) {
  return (
    <View style={[mStat.card, { backgroundColor: bg }]}>
      <Text style={mStat.icon}>{icon}</Text>
      <Text style={[mStat.value, { color }]}>{value}</Text>
      <Text style={mStat.label}>{label}</Text>
    </View>
  );
}

// ─── ProfileField (خارج EditProfileModal تمامًا لتجنب إعادة الإنشاء) ────────
type ProfileFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  isRTL: boolean;
};

const ProfileField = React.memo(function ProfileField({
  label, value, onChangeText, keyboardType = 'default', autoCapitalize = 'words', isRTL,
}: ProfileFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={Colors.textMuted}
        blurOnSubmit={false}
      />
    </View>
  );
});

// ─── Avatar Action Sheet ──────────────────────────────────
function AvatarActionSheet({ visible, onClose, onPickNew, onDelete, hasAvatar, t }: {
  visible: boolean; onClose: () => void; onPickNew: () => void;
  onDelete: () => void; hasAvatar: boolean; t: any;
}) {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.actionOverlay, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[styles.actionSheet, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionEmoji}>📸</Text>
            <Text style={styles.actionTitle}>{t.photoTitle || 'صورتك الشخصية'}</Text>
            <Text style={styles.actionSubtitle}>{t.photoSubtitle || 'خليها تعبّر عنك! 🌟'}</Text>
          </View>
          <View style={styles.actionDivider} />
          <TouchableOpacity style={styles.actionBtn} onPress={() => { onClose(); setTimeout(onPickNew, 300); }} activeOpacity={0.7}>
            <View style={[styles.actionBtnIcon, { backgroundColor: '#4CAF8220' }]}>
              <Text style={styles.actionBtnEmoji}>🖼️</Text>
            </View>
            <Text style={styles.actionBtnText}>{hasAvatar ? (t.changePhoto || 'غيّر الصورة') : (t.addPhoto || 'أضف صورة')}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {hasAvatar && (
            <>
              <View style={styles.actionDivider} />
              <TouchableOpacity style={styles.actionBtn} onPress={() => { onClose(); setTimeout(onDelete, 300); }} activeOpacity={0.7}>
                <View style={[styles.actionBtnIcon, { backgroundColor: Colors.dangerLight }]}>
                  <Text style={styles.actionBtnEmoji}>🗑️</Text>
                </View>
                <Text style={[styles.actionBtnText, { color: Colors.danger }]}>{t.deletePhoto || 'احذف الصورة'}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.danger + '80'} />
              </TouchableOpacity>
            </>
          )}
          <View style={styles.actionDivider} />
          <TouchableOpacity style={[styles.actionBtn, { justifyContent: 'center' }]} onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.actionBtnText, { color: Colors.textMuted, textAlign: 'center' }]}>{t.cancel || 'مش دلوقتي 😅'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Edit Profile Modal ────────────────────────────────────
type UserFields = { firstName: string; lastName: string; email: string; age: string; gender: string; };

function EditProfileModal({ visible, onClose, user, onSave, t, isRTL }: {
  visible: boolean; onClose: () => void; user: any;
  onSave: (data: UserFields) => void; t: any; isRTL: boolean;
}) {
  const [form, setForm] = useState<UserFields>({
    firstName: user?.firstName || '', lastName: user?.lastName || '',
    email: user?.email || '', age: user?.age ? String(user.age) : '', gender: user?.gender || '',
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) setForm({
      firstName: user?.firstName || '', lastName: user?.lastName || '',
      email: user?.email || '', age: user?.age ? String(user.age) : '', gender: user?.gender || '',
    });
  }, [visible]);

  // ── handlers مستقرة بـ useCallback لتجنب re-render الـ ProfileField ──
  const handleFirstName  = useCallback((v: string) => setForm(p => ({ ...p, firstName: v })),  []);
  const handleLastName   = useCallback((v: string) => setForm(p => ({ ...p, lastName: v })),   []);
  const handleEmail      = useCallback((v: string) => setForm(p => ({ ...p, email: v })),      []);
  const handleAge        = useCallback((v: string) => setForm(p => ({ ...p, age: v })),        []);

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert(t.error || 'خطأ', t.nameRequired || 'الاسم الأول والأخير مطلوبان');
      return;
    }
    setSaving(true);
    try {
      await AsyncStorage.setItem('user_profile', JSON.stringify(form));
      onSave(form);
      onClose(); // ← أغلق الـ modal أولاً لسرعة الاستجابة

      // ── إشعار بعد الإغلاق بدون await حتى لا يبطّئ الـ UI ──
      notify({
        title: isRTL ? 'تم تحديث الملف الشخصي ✅' : 'Profile Updated ✅',
        body: isRTL
          ? `مرحباً ${form.firstName}! تم حفظ بياناتك بنجاح`
          : `Hi ${form.firstName}! Your profile has been updated successfully`,
        emoji: '👤',
        type: 'add',
      });
    } catch {
      Alert.alert(t.error || 'خطأ', t.saveFailed || 'فشل الحفظ، حاول مجدداً');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* خلفية شفافة للإغلاق */}
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* محتوى المودال */}
        <View style={styles.slideModal}>
          <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t.editProfile}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView
            contentContainerStyle={styles.editFormContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            {/* ── الحقول تستخدم ProfileField المعرّفة خارج الـ modal ── */}
            <ProfileField
              label={t.firstName}
              value={form.firstName}
              onChangeText={handleFirstName}
              isRTL={isRTL}
            />
            <ProfileField
              label={t.lastName}
              value={form.lastName}
              onChangeText={handleLastName}
              isRTL={isRTL}
            />
            <ProfileField
              label={t.email}
              value={form.email}
              onChangeText={handleEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              isRTL={isRTL}
            />
            <ProfileField
              label={t.age}
              value={form.age}
              onChangeText={handleAge}
              keyboardType="numeric"
              autoCapitalize="none"
              isRTL={isRTL}
            />

            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.gender}</Text>
              <View style={[styles.genderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {(['male','female'] as const).map(g => (
                  <TouchableOpacity key={g} onPress={() => setForm(p => ({ ...p, gender: g }))}
                    style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]} activeOpacity={0.8}>
                    <Ionicons name={g === 'male' ? 'male-outline' : 'female-outline'} size={18}
                      color={form.gender === g ? Colors.white : Colors.textSecondary} />
                    <Text style={[styles.genderBtnText, form.gender === g && styles.genderBtnTextActive]}>
                      {g === 'male' ? t.male : t.female}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <PrimaryButton
              title={saving ? (t.saving || 'جاري الحفظ…') : (t.save || 'حفظ التعديلات')}
              onPress={handleSave}
              style={styles.saveBtn}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Language Modal ───────────────────────────────────────
function LanguageModal({ visible, onClose, isRTL, t, onSelect }: {
  visible: boolean; onClose: () => void; isRTL: boolean; t: any;
  onSelect: (lang: 'ar' | 'en') => void;
}) {
  const langs = [
    { code: 'ar' as const, label: 'العربية', flag: '🇸🇦', native: 'Arabic' },
    { code: 'en' as const, label: 'English', flag: '🇺🇸', native: 'الإنجليزية' },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={[styles.modalIconWrap, { backgroundColor: '#E8F5EF' }]}>
            <Ionicons name="language-outline" size={32} color="#4CAF82" />
          </View>
          <Text style={styles.modalTitle}>{t.language}</Text>
          <Text style={styles.modalBody}>{t.selectLanguage || 'اختر لغتك المفضلة'}</Text>
          <View style={{ width: '100%', gap: 10, marginBottom: Spacing.xl }}>
            {langs.map(lang => (
              <TouchableOpacity key={lang.code} onPress={() => { onSelect(lang.code); onClose(); }}
                style={[styles.langOption, (isRTL ? lang.code==='ar' : lang.code==='en') && styles.langOptionActive]}
                activeOpacity={0.8}>
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.langName}>{lang.label}</Text>
                  <Text style={styles.langNative}>{lang.native}</Text>
                </View>
                {(isRTL ? lang.code==='ar' : lang.code==='en') && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          <OutlineButton title={t.cancel} onPress={onClose} style={{ width: '100%' }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Notifications Modal ──────────────────────────────────
function NotificationsModal({ visible, onClose, t, isRTL }: {
  visible: boolean; onClose: () => void; t: any; isRTL: boolean;
}) {
  const [pushEnabled,   setPushEnabled]   = useState(true);
  const [remindEnabled, setRemindEnabled] = useState(true);
  const [remindHour,    setRemindHour]    = useState(DEFAULT_REMIND_HOUR);
  const [remindMin,     setRemindMin]     = useState(DEFAULT_REMIND_MIN);
  const [saving,        setSaving]        = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    (async () => {
      const push   = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_PUSH);
      const remind = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_REMIND);
      const hour   = await AsyncStorage.getItem(STORAGE_KEYS.REMIND_HOUR);
      const min    = await AsyncStorage.getItem(STORAGE_KEYS.REMIND_MIN);
      if (push   !== null) setPushEnabled(push === 'true');
      if (remind !== null) setRemindEnabled(remind === 'true');
      if (hour   !== null) setRemindHour(Number(hour));
      if (min    !== null) setRemindMin(Number(min));
    })();
  }, [visible]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_PUSH,   String(pushEnabled));
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_REMIND, String(remindEnabled));
      await AsyncStorage.setItem(STORAGE_KEYS.REMIND_HOUR,  String(remindHour));
      await AsyncStorage.setItem(STORAGE_KEYS.REMIND_MIN,   String(remindMin));

      const { status } = await Notifications.getPermissionsAsync();
      if (pushEnabled && status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      await Notifications.cancelAllScheduledNotificationsAsync();

      if (pushEnabled && remindEnabled) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: isRTL ? '🌿 تذكير يومي' : '🌿 Daily Reminder',
            body: isRTL
              ? 'حان وقت مراجعة مهامك وتمارينك اليوم 💪'
              : "Time to check today's tasks and exercises 💪",
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: remindHour,
            minute: remindMin,
          },
        });
      }

      onClose();
    } catch (e) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل الحفظ، تأكد من صلاحيات الإشعارات' : 'Save failed, check notification permissions'
      );
    } finally { setSaving(false); }
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const changeHour = (delta: number) => setRemindHour(prev => (prev + delta + 24) % 24);
  const changeMin  = (delta: number) => setRemindMin(prev  => (prev + delta + 60) % 60);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.slideModalSafe}>
        <View style={styles.slideModal}>
          <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t.notifications || 'الإشعارات'}</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: Spacing.xl }}>
            <Text style={[notifStyles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
              إعدادات عامة
            </Text>
            <View style={styles.card}>
              <View style={[styles.switchRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Switch
                  value={pushEnabled}
                  onValueChange={setPushEnabled}
                  trackColor={{ false: Colors.divider, true: Colors.primary + '66' }}
                  thumbColor={pushEnabled ? Colors.primary : Colors.textMuted}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.switchLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                    🔔 {isRTL ? 'إشعارات التطبيق' : 'App Notifications'}
                  </Text>
                  <Text style={[notifStyles.switchDesc, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {isRTL
                      ? 'تفعيل أو إيقاف جميع إشعارات التطبيق'
                      : 'Enable or disable all app notifications'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={[notifStyles.sectionLabel, { textAlign: isRTL ? 'right' : 'left', marginTop: 16 }]}>
              تذكير يومي
            </Text>
            <View style={[styles.card, !pushEnabled && { opacity: 0.4 }]}>
              <View style={[styles.switchRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Switch
                  value={remindEnabled && pushEnabled}
                  onValueChange={v => setRemindEnabled(v)}
                  disabled={!pushEnabled}
                  trackColor={{ false: Colors.divider, true: '#F4A32B66' }}
                  thumbColor={remindEnabled && pushEnabled ? '#F4A32B' : Colors.textMuted}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.switchLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                    ⏰ {isRTL ? 'تذكير يومي بالمهام' : 'Daily Task Reminder'}
                  </Text>
                  <Text style={[notifStyles.switchDesc, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {isRTL
                      ? 'إشعار يومي يذكرك بمراجعة مهامك وتمارينك'
                      : 'Daily notification to review tasks and exercises'}
                  </Text>
                </View>
              </View>

              {remindEnabled && pushEnabled && (
                <>
                  <View style={styles.divider} />
                  <View style={notifStyles.timePickerWrap}>
                    <Text style={[notifStyles.timePickerLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                      {isRTL ? '🕐 وقت التذكير' : '🕐 Reminder Time'}
                    </Text>
                    <View style={notifStyles.timePicker}>
                      <View style={notifStyles.timeUnit}>
                        <TouchableOpacity onPress={() => changeHour(1)} style={notifStyles.timeArrow}>
                          <Ionicons name="chevron-up" size={20} color={Colors.primary} />
                        </TouchableOpacity>
                        <View style={notifStyles.timeValueBox}>
                          <Text style={notifStyles.timeValue}>{pad(remindHour)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => changeHour(-1)} style={notifStyles.timeArrow}>
                          <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>

                      <Text style={notifStyles.timeSep}>:</Text>

                      <View style={notifStyles.timeUnit}>
                        <TouchableOpacity onPress={() => changeMin(5)} style={notifStyles.timeArrow}>
                          <Ionicons name="chevron-up" size={20} color={Colors.primary} />
                        </TouchableOpacity>
                        <View style={notifStyles.timeValueBox}>
                          <Text style={notifStyles.timeValue}>{pad(remindMin)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => changeMin(-5)} style={notifStyles.timeArrow}>
                          <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={notifStyles.timeHint}>
                      {isRTL
                        ? `هتوصلك إشعار كل يوم الساعة ${pad(remindHour)}:${pad(remindMin)}`
                        : `You'll get a notification every day at ${pad(remindHour)}:${pad(remindMin)}`}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <View style={notifStyles.unavailableCard}>
              <Ionicons name="information-circle-outline" size={16} color="#888" />
              <Text style={notifStyles.unavailableText}>
                {isRTL
                  ? 'إشعارات البريد الإلكتروني وتحديثات التطبيق تحتاج اتصال بالسيرفر وغير متاحة حالياً.'
                  : 'Email notifications and app updates require a server connection and are not available yet.'}
              </Text>
            </View>

            <PrimaryButton
              title={saving ? (isRTL ? 'جاري الحفظ…' : 'Saving…') : (isRTL ? '💾 حفظ الإعدادات' : '💾 Save Settings')}
              onPress={handleSave}
              style={{ marginTop: Spacing.base }}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Help Modal ───────────────────────────────────────────
function HelpModal({ visible, onClose, t, isRTL }: {
  visible: boolean; onClose: () => void; t: any; isRTL: boolean;
}) {
  const faqs = [
    { q: t.faq1q || 'كيف أحدّث ملفي الشخصي؟',   a: t.faq1a || 'اذهب إلى المزيد ← تعديل الملف الشخصي وحدّث بياناتك.' },
    { q: t.faq2q || 'كيف أغيّر اللغة؟',           a: t.faq2a || 'اذهب إلى المزيد ← اللغة واختر لغتك المفضلة.' },
    { q: t.faq3q || 'كيف أتواصل مع الدعم؟',       a: t.faq3a || 'راسلنا على support@rahati.app وسنرد خلال 24 ساعة.' },
  ];
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.slideModalSafe}>
        <View style={styles.slideModal}>
          <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t.help}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.xl }}>
            <View style={styles.card}>
              {faqs.map((faq, i) => (
                <View key={i}>
                  <TouchableOpacity onPress={() => setExpanded(expanded === i ? null : i)}
                    style={[styles.faqRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]} activeOpacity={0.8}>
                    <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-back'} size={16} color={Colors.textMuted} />
                    <Text style={[styles.faqQ, { flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{faq.q}</Text>
                  </TouchableOpacity>
                  {expanded === i && (
                    <Text style={[styles.faqA, { textAlign: isRTL ? 'right' : 'left' }]}>{faq.a}</Text>
                  )}
                  {i < faqs.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────
type ModalKey = 'logout' | 'editProfile' | 'language' | 'notifications' | 'help' | null;

export default function MoreScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { t, isRTL, setLang }           = useLang();

  const [activeModal,     setActiveModal]     = useState<ModalKey>(null);
  const [avatarUri,       setAvatarUri]       = useState<string | null>(null);
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);

  // ── Stats ──
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskDone,  setTaskDone]  = useState(0);
  const [exTotal,   setExTotal]   = useState(0);
  const [exDone,    setExDone]    = useState(0);
  const [energy,    setEnergy]    = useState(50);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem('user_avatar').then(uri => { if (uri) setAvatarUri(uri); });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadStats = async () => {
        try {
          const today    = new Date();
          const todayKey = toKey(today);

          const [coreTRaw, extraTRaw] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.CORE_TASKS),
            AsyncStorage.getItem(STORAGE_KEYS.EXTRA_TASKS),
          ]);

          const coreTasks:     any[] = coreTRaw  ? JSON.parse(coreTRaw)  : [];
          const allExtraTasks: any[] = extraTRaw ? JSON.parse(extraTRaw) : [];
          const extraTasks = allExtraTasks.filter(
            (tk: any) => !tk.date || tk.date === todayKey
          );
          const allTasksTotal = coreTasks.length + extraTasks.length;

          const exListRaw = await AsyncStorage.getItem(STORAGE_KEYS.CORE_EX);
          const coreEx: any[] = exListRaw ? JSON.parse(exListRaw) : [];
          const exSlotsTotal = coreEx.length > 0 ? allTasksTotal : 0;

          const planDoneRaw = await AsyncStorage.getItem(getPlanDoneKey(today));
          const doneIds: Set<string> = planDoneRaw
            ? new Set(JSON.parse(planDoneRaw))
            : new Set();

          const coreTaskIds  = new Set(coreTasks.map((t: any)  => t.key ?? t.id));
          const extraTaskIds = new Set(extraTasks.map((t: any) => t.key ?? t.id));
          const taskDoneCount = [...doneIds].filter(
            id => coreTaskIds.has(id) || extraTaskIds.has(id)
          ).length;

          const rawExDone = [...doneIds].filter(
            id => id.startsWith('exercise_')
          ).length;
          const exDoneCount = Math.min(rawExDone, exSlotsTotal);

          setTaskTotal(allTasksTotal);
          setTaskDone(taskDoneCount);
          setExTotal(exSlotsTotal);
          setExDone(exDoneCount);

          const energyRaw = await AsyncStorage.getItem(STORAGE_KEYS.ENERGY);
          if (energyRaw !== null) setEnergy(Number(energyRaw));

        } catch (e) {
          console.warn('[MoreScreen] Stats load error:', e);
        }
      };

      loadStats();
    }, [])
  );

  const open  = (key: ModalKey) => setActiveModal(key);
  const close = ()              => setActiveModal(null);

  const handleSaveProfile = async (data: UserFields) => {
    await updateProfile({
      firstName: data.firstName,
      lastName:  data.lastName,
      email:     data.email,
      age:       data.age,
      gender:    data.gender,
    });
  };

  const handleLanguageSelect = async (lang: 'ar' | 'en') => {
    await AsyncStorage.setItem('app_language', lang);
    setLang(lang);
  };

  const handleAvatarPressIn = () => {
    longPressTimer.current = setTimeout(() => setShowAvatarSheet(true), 500);
  };
  const handleAvatarPressOut = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.error || 'خطأ', t.photoPermissionRequired || 'مطلوب إذن الوصول للصور');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1,1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await AsyncStorage.setItem('user_avatar', dataUri);
      setAvatarUri(dataUri);
    }
  };

  const handleDeleteAvatar = async () => {
    await AsyncStorage.removeItem('user_avatar');
    setAvatarUri(null);
  };

  const MENU = [
    { key: 'notifications', icon: 'notifications-outline', label: t.notifications || 'الإشعارات',  color: '#F4A32B' },
    { key: 'language',      icon: 'language-outline',      label: t.language      || 'اللغة',       color: '#4CAF82', value: isRTL ? 'عربي' : 'English' },
    { key: 'help',          icon: 'help-circle-outline',   label: t.help          || 'المساعدة',    color: '#29B6D4' },
  ];

  const initials = user
    ? `${(user.firstName||'?')[0]}${(user.lastName||'?')[0]}`.toUpperCase()
    : '?';

  const eColor = energy >= 70 ? '#4CAF82' : energy >= 40 ? '#F4A32B' : '#E05C5C';
  const eBg    = energy >= 70 ? '#E8F5EF' : energy >= 40 ? '#FEF3E2' : '#FDEAEA';

  const taskPct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
  const exPct   = exTotal   > 0 ? Math.round((exDone   / exTotal)   * 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t.profile || 'حسابي'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => open('editProfile')}>
            <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Avatar Card ── */}
        <View style={styles.avatarCard}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPressIn={handleAvatarPressIn}
            onPressOut={handleAvatarPressOut}
            onPress={() => {}}
          >
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                {avatarUri
                  ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  : <Text style={styles.avatarInitials}>{initials}</Text>}
              </View>
              <TouchableOpacity style={styles.cameraBadge} onPress={handlePickAvatar} activeOpacity={0.85}>
                <Ionicons name="camera" size={13} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          <Text style={styles.avatarName}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
          <Text style={styles.avatarHint}>{t.longPressHint || '👆 اضغط مطوّل لخيارات الصورة'}</Text>
        </View>

        {/* ── Energy Bar ── */}
        <View style={[styles.energyCard, { backgroundColor: eBg, borderColor: eColor + '33' }]}>
          <Text style={{ fontSize: 20 }}>{energy >= 70 ? '⚡' : energy >= 40 ? '🔋' : '🪫'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.energyLabel, { color: eColor }]}>
              {energy >= 70 ? (isRTL ? 'طاقة عالية' : 'High Energy')
                : energy >= 40 ? (isRTL ? 'طاقة متوسطة' : 'Medium Energy')
                : (isRTL ? 'طاقة منخفضة' : 'Low Energy')}
            </Text>
            <View style={[styles.energyBarBg, { backgroundColor: eColor + '22' }]}>
              <View style={[styles.energyBarFill, { width: `${energy}%` as any, backgroundColor: eColor }]} />
            </View>
          </View>
          <Text style={[styles.energyPct, { color: eColor }]}>{energy}%</Text>
        </View>

        {/* ── Account Info ── */}
        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
          {t.accountInfo || 'معلومات الحساب'}
        </Text>
        <View style={styles.card}>
          <InfoRow label={t.firstName || 'الاسم الأول'} value={user?.firstName || ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.lastName  || 'الاسم الأخير'} value={user?.lastName || ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.email     || 'البريد'} value={user?.email || ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.age       || 'العمر'} value={user?.age ? `${user.age} ${t.years || 'سنة'}` : ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow
            label={t.gender || 'الجنس'}
            value={
              user?.gender === 'male'   ? (t.male   || 'ذكر')  :
              user?.gender === 'female' ? (t.female || 'أنثى') : ''
            }
            isRTL={isRTL}
          />
        </View>

        {/* ── Quick Links ── */}
        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL ? 'روابط سريعة' : 'Quick Links'}
        </Text>
        <View style={styles.quickLinksRow}>
          {[
            { label: isRTL ? 'خطتي'    : 'My Plan',    icon: 'calendar-outline',     color: '#7C5CBF', bg: '#F0EBFA', route: '/tabs/home'          },
            { label: isRTL ? 'تمارين'  : 'Exercises',  icon: 'fitness-outline',       color: '#4CAF82', bg: '#E8F5EF', route: '/tabs/exercises'    },
            { label: t.tasks || (isRTL ? 'مهامي' : 'Tasks'), icon: 'checkbox-outline', color: '#5B9BD5', bg: '#E8F1FB', route: '/tabs/tasks'        },
            { label: isRTL ? 'إشعارات' : 'Alerts',     icon: 'notifications-outline', color: '#C97B3A', bg: '#FEF3E2', route: '/tabs/notification' },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={[styles.quickLink, { backgroundColor: item.bg }]}
              onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
              <Text style={[styles.quickLinkText, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Settings ── */}
        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
          {t.settings || 'الإعدادات'}
        </Text>
        <View style={styles.card}>
          {MENU.map((item, i) => (
            <MenuRow key={item.key} icon={item.icon} label={item.label}
              value={'value' in item ? item.value : undefined}
              color={item.color} onPress={() => open(item.key as ModalKey)}
              isLast={i === MENU.length - 1} isRTL={isRTL} />
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity onPress={() => open('logout')}
          style={[styles.logoutBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>{t.logout || 'تسجيل الخروج'}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>{t.version || 'الإصدار 1.0.0'}</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <AvatarActionSheet visible={showAvatarSheet} onClose={() => setShowAvatarSheet(false)}
        onPickNew={handlePickAvatar} onDelete={handleDeleteAvatar} hasAvatar={!!avatarUri} t={t} />

      <EditProfileModal visible={activeModal === 'editProfile'} onClose={close}
        user={user} onSave={handleSaveProfile} t={t} isRTL={isRTL} />

      <LanguageModal visible={activeModal === 'language'} onClose={close}
        isRTL={isRTL} t={t} onSelect={handleLanguageSelect} />

      <NotificationsModal visible={activeModal === 'notifications'} onClose={close} t={t} isRTL={isRTL} />
      <HelpModal          visible={activeModal === 'help'}          onClose={close} t={t} isRTL={isRTL} />

      {/* Logout Confirm */}
      <Modal visible={activeModal === 'logout'} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: Colors.dangerLight }]}>
              <Ionicons name="log-out-outline" size={32} color={Colors.danger} />
            </View>
            <Text style={styles.modalTitle}>{t.logout || 'تسجيل الخروج'}</Text>
            <Text style={styles.modalBody}>{t.logoutConfirm || 'هل أنت متأكد من تسجيل الخروج؟'}</Text>
            <View style={styles.modalBtns}>
              <OutlineButton title={t.cancel || 'إلغاء'} onPress={close} style={{ flex: 1 }} />
              <PrimaryButton
                title={t.confirm || 'تأكيد'}
                onPress={() => { close(); logout(); router.replace('/auth/sign-in'); }}
                style={{ flex: 1, backgroundColor: Colors.danger }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Notification Styles ──────────────────────────────────
const notifStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase',
  },
  switchDesc: {
    fontSize: 11, color: Colors.textMuted, marginTop: 1,
  },
  timePickerWrap: {
    padding: Spacing.base, gap: 12,
  },
  timePickerLabel: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary,
  },
  timePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  timeUnit: {
    alignItems: 'center', gap: 4,
  },
  timeArrow: {
    padding: 6, borderRadius: 10, backgroundColor: Colors.primary + '12',
  },
  timeValueBox: {
    width: 56, height: 48, borderRadius: 12,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1.5, borderColor: Colors.primary + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  timeValue: {
    fontSize: 22, fontWeight: '800', color: Colors.primary,
  },
  timeSep: {
    fontSize: 28, fontWeight: '900', color: Colors.primary, marginBottom: 4,
  },
  timeHint: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center',
    backgroundColor: Colors.primary + '08', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  unavailableCard: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#f5f5f5', borderRadius: 12,
    padding: 12, marginTop: 16,
  },
  unavailableText: {
    flex: 1, fontSize: 11, color: '#888', lineHeight: 17,
  },
});

// ─── Styles ───────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl },

  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.shadowDark, shadowOffset: { width:0,height:1 }, shadowOpacity:1, shadowRadius:3, elevation:2,
  },
  pageTitle: { flex:1, fontSize:22, fontWeight:'800', color:Colors.textPrimary, textAlign:'center' },

  avatarCard: {
    backgroundColor: Colors.primary, borderRadius: Radius.xxl, padding: Spacing.xl,
    alignItems: 'center', marginBottom: Spacing.xl,
    shadowColor: Colors.shadow, shadowOffset:{width:0,height:4}, shadowOpacity:1, shadowRadius:12, elevation:4,
  },
  avatarWrapper: { width:80, height:80, marginBottom:4 },
  avatarCircle: {
    width:80, height:80, borderRadius:40, backgroundColor: Colors.primaryLight,
    borderWidth:3, borderColor:'rgba(255,255,255,0.35)',
    alignItems:'center', justifyContent:'center', overflow:'hidden',
  },
  avatarImage:    { width:80, height:80, borderRadius:40 },
  avatarInitials: { fontSize:26, fontWeight:'800', color:Colors.white },
  cameraBadge: {
    position:'absolute', bottom:-2, right:-2, width:26, height:26, borderRadius:13,
    backgroundColor:Colors.primary, borderWidth:2, borderColor:Colors.white,
    alignItems:'center', justifyContent:'center', elevation:3,
    shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.2, shadowRadius:2,
  },
  avatarName:  { fontSize:FontSize.lg, fontWeight:'800', color:Colors.white, marginBottom:2, marginTop:8 },
  avatarEmail: { fontSize:FontSize.sm, color:'rgba(255,255,255,0.75)' },
  avatarHint:  { fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:6, marginBottom:16 },

  energyCard: {
    flexDirection:'row', alignItems:'center', gap:12,
    borderRadius:16, padding:14, marginBottom:Spacing.xl,
    borderWidth:1,
  },
  energyLabel:   { fontSize:13, fontWeight:'700', marginBottom:6 },
  energyBarBg:   { height:6, borderRadius:3, overflow:'hidden' },
  energyBarFill: { height:6, borderRadius:3 },
  energyPct:     { fontSize:16, fontWeight:'900' },

  sectionLabel: {
    fontSize:FontSize.xs, fontWeight:'700', color:Colors.textMuted,
    letterSpacing:1, marginBottom:8, textTransform:'uppercase',
  },

  card: {
    backgroundColor:Colors.white, borderRadius:Radius.xl, marginBottom:Spacing.xl,
    overflow:'hidden', shadowColor:Colors.shadowDark,
    shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2,
  },
  divider: { height:1, backgroundColor:Colors.divider, marginHorizontal:Spacing.base },

  infoRow:   { justifyContent:'space-between', alignItems:'center', paddingHorizontal:Spacing.base, paddingVertical:14 },
  infoLabel: { fontSize:FontSize.sm, color:Colors.textSecondary },
  infoValue: { fontSize:FontSize.sm, fontWeight:'600', color:Colors.textPrimary },

  menuRow:       { alignItems:'center', paddingHorizontal:Spacing.base, paddingVertical:14, gap:12 },
  menuRowBorder: { borderBottomWidth:1, borderBottomColor:Colors.divider },
  menuIcon:      { width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center' },
  menuLabel:     { flex:1, fontSize:FontSize.base, color:Colors.textPrimary, fontWeight:'500', textAlign:'right' },
  menuValue:     { fontSize:FontSize.sm, color:Colors.textMuted },

  quickLinksRow: { flexDirection:'row', gap:10, marginBottom:Spacing.xl },
  quickLink: {
    flex:1, borderRadius:14, paddingVertical:14,
    alignItems:'center', gap:6,
  },
  quickLinkText: { fontSize:11, fontWeight:'700' },

  logoutBtn: {
    alignItems:'center', justifyContent:'center', gap:8,
    backgroundColor:Colors.dangerLight, borderRadius:Radius.xl,
    paddingVertical:16, marginBottom:Spacing.base,
  },
  logoutText:  { fontSize:FontSize.base, fontWeight:'600', color:Colors.danger },
  versionText: { textAlign:'center', fontSize:FontSize.xs, color:Colors.textMuted },

  overlay: {
    flex:1, backgroundColor:'rgba(0,0,0,0.45)',
    alignItems:'center', justifyContent:'center', padding:Spacing.xl,
  },
  modalCard: {
    backgroundColor:Colors.white, borderRadius:Radius.xxl, padding:Spacing.xxl,
    width:'100%', alignItems:'center',
    shadowColor:Colors.shadow, shadowOffset:{width:0,height:8}, shadowOpacity:1, shadowRadius:20, elevation:8,
  },
  modalIconWrap: {
    width:64, height:64, borderRadius:32,
    alignItems:'center', justifyContent:'center', marginBottom:14,
  },
  modalTitle: { fontSize:FontSize.xl, fontWeight:'800', color:Colors.textPrimary, marginBottom:8 },
  modalBody:  { fontSize:FontSize.base, color:Colors.textSecondary, textAlign:'center', marginBottom:Spacing.xl },
  modalBtns:  { flexDirection:'row', gap:12, width:'100%' },

  // ── Slide Modal ──
  slideModalSafe: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  slideModal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    maxHeight: '92%',
  },
  modalHeader: {
    alignItems:'center', paddingHorizontal:Spacing.base, paddingVertical:Spacing.base,
    borderBottomWidth:1, borderBottomColor:Colors.divider,
  },
  modalCloseBtn:    { width:36, height:36, borderRadius:18, backgroundColor:Colors.divider, alignItems:'center', justifyContent:'center' },
  modalHeaderTitle: { flex:1, fontSize:FontSize.lg, fontWeight:'700', color:Colors.textPrimary, textAlign:'center' },

  editFormContent: { padding:Spacing.xl, paddingBottom:40 },
  fieldWrap:   { marginBottom:Spacing.base },
  fieldLabel:  { fontSize:FontSize.sm, fontWeight:'600', color:Colors.textSecondary, marginBottom:6 },
  fieldInput:  {
    backgroundColor:Colors.white, borderRadius:Radius.lg, paddingHorizontal:Spacing.base,
    paddingVertical:12, fontSize:FontSize.base, color:Colors.textPrimary,
    borderWidth:1, borderColor:Colors.divider,
  },
  genderRow:           { gap:10 },
  genderBtn:           { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, borderRadius:Radius.lg, borderWidth:1.5, borderColor:Colors.divider, paddingVertical:12, backgroundColor:Colors.white },
  genderBtnActive:     { backgroundColor:Colors.primary, borderColor:Colors.primary },
  genderBtnText:       { fontSize:FontSize.base, color:Colors.textSecondary, fontWeight:'600' },
  genderBtnTextActive: { color:Colors.white },
  saveBtn: { marginTop:Spacing.xl },

  langOption:       { flexDirection:'row', alignItems:'center', gap:12, padding:Spacing.base, borderRadius:Radius.lg, borderWidth:1.5, borderColor:Colors.divider, backgroundColor:Colors.white },
  langOptionActive: { borderColor:Colors.primary, backgroundColor:Colors.primary + '0A' },
  langFlag:         { fontSize:28 },
  langName:         { fontSize:FontSize.base, fontWeight:'700', color:Colors.textPrimary },
  langNative:       { fontSize:FontSize.sm, color:Colors.textMuted },

  switchRow:   { alignItems:'center', paddingHorizontal:Spacing.base, paddingVertical:14, gap:12 },
  switchLabel: { flex:1, fontSize:FontSize.base, color:Colors.textPrimary, fontWeight:'500' },

  faqRow: { alignItems:'center', paddingHorizontal:Spacing.base, paddingVertical:14, gap:10 },
  faqQ:   { fontSize:FontSize.base, fontWeight:'600', color:Colors.textPrimary },
  faqA:   { fontSize:FontSize.sm, color:Colors.textSecondary, lineHeight:20, paddingHorizontal:Spacing.base, paddingBottom:14 },

  actionOverlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center', padding:Spacing.xl },
  actionSheet:    { backgroundColor:Colors.white, borderRadius:28, width:'100%', overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:10}, shadowOpacity:0.2, shadowRadius:24, elevation:12 },
  actionHeader:   { alignItems:'center', paddingTop:Spacing.xl, paddingBottom:Spacing.base, paddingHorizontal:Spacing.xl },
  actionEmoji:    { fontSize:42, marginBottom:8 },
  actionTitle:    { fontSize:FontSize.lg, fontWeight:'800', color:Colors.textPrimary, marginBottom:4 },
  actionSubtitle: { fontSize:FontSize.sm, color:Colors.textMuted, textAlign:'center' },
  actionDivider:  { height:1, backgroundColor:Colors.divider },
  actionBtn:      { flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:Spacing.xl, paddingVertical:16 },
  actionBtnIcon:  { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center' },
  actionBtnEmoji: { fontSize:20 },
  actionBtnText:  { flex:1, fontSize:FontSize.base, fontWeight:'600', color:Colors.textPrimary },
});

const mStat = StyleSheet.create({
  card:  { flex:1, alignItems:'center', paddingVertical:12, gap:3 },
  icon:  { fontSize:18 },
  value: { fontSize:16, fontWeight:'900' },
  label: { fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:'600' },
});