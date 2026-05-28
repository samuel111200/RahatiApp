import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, SafeAreaView, TextInput, Alert, Image,
  Animated, Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, OutlineButton } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { notify } from '../tabs/notificationService';

// ─── Doctor color (unified) ───────────────────────────────
const DOC_COLOR       = '#7C5CBF';
const DOC_COLOR_MID   = '#E8DFFA';
const DOC_COLOR_LIGHT = '#F0EBFA';

// ─── DocTabBar ────────────────────────────────────────────
type TabItem = { label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; route: string; };
const TABS: TabItem[] = [
  { label: 'الرئيسية', icon: 'home-outline',       iconActive: 'home',        route: '/Doctor/Dochome' },
  { label: 'الشاتات',  icon: 'chatbubbles-outline', iconActive: 'chatbubbles', route: '/Doctor/Docchat' },
  { label: 'المزيد',   icon: 'grid-outline',        iconActive: 'grid',        route: '/Doctor/Docmore' },
];

const ICON_SIZE = 48;

function DocTabBar() {
  const pathname  = usePathname();
  const insets    = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View style={[tabStyles.wrapper, { paddingBottom: bottomPad }]}>
      <View style={tabStyles.container}>
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.route);
          return (
            <TouchableOpacity key={tab.route} style={tabStyles.tab} onPress={() => router.push(tab.route as any)} activeOpacity={0.7}>
              <View style={[tabStyles.iconWrap, isActive && tabStyles.iconWrapActive]}>
                <Ionicons name={isActive ? tab.iconActive : tab.icon} size={22} color={isActive ? '#fff' : '#B0BEC5'} />
              </View>
              <Text style={[tabStyles.label, isActive && tabStyles.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrapper:   { backgroundColor: 'transparent', paddingHorizontal: 16 },
  container: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 28,
    paddingTop: 8, paddingBottom: 8, paddingHorizontal: 8,
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 14,
    borderWidth: 0.5, borderColor: '#E8DFFA', marginBottom: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconWrap: {
    width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: DOC_COLOR,
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40, shadowRadius: 10, elevation: 6,
  },
  label:       { fontSize: 11, fontWeight: '600', color: '#B0BEC5' },
  labelActive: { color: DOC_COLOR, fontWeight: '700' },
});

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
      <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color={DOC_COLOR + '80'} />
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={[styles.menuIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
    </TouchableOpacity>
  );
}

// ─── ProfileField ──────────────────────────────────────────
type ProfileFieldProps = {
  label: string; value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any; autoCapitalize?: any; isRTL: boolean;
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
            <Text style={styles.actionSubtitle}>{t.docPhotoSubtitle || 'صورة احترافية تعكس ثقتك! 🩺'}</Text>
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
type DoctorFields = {
  firstName: string; lastName: string; email: string;
  age: string; gender: string; specialty: string; licenseNumber: string;
};

function EditProfileModal({ visible, onClose, user, onSave, t, isRTL }: {
  visible: boolean; onClose: () => void; user: any;
  onSave: (data: DoctorFields) => void; t: any; isRTL: boolean;
}) {
  const [form, setForm] = useState<DoctorFields>({
    firstName: user?.firstName || '', lastName: user?.lastName || '',
    email: user?.email || '', age: user?.age ? String(user.age) : '',
    gender: user?.gender || '',
    specialty: user?.specialty || '', licenseNumber: user?.licenseNumber || '',
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) setForm({
      firstName: user?.firstName || '', lastName: user?.lastName || '',
      email: user?.email || '', age: user?.age ? String(user.age) : '',
      gender: user?.gender || '',
      specialty: user?.specialty || '', licenseNumber: user?.licenseNumber || '',
    });
  }, [visible, user]);

  const handleFirstName     = useCallback((v: string) => setForm(p => ({ ...p, firstName: v })),     []);
  const handleLastName      = useCallback((v: string) => setForm(p => ({ ...p, lastName: v })),      []);
  const handleEmail         = useCallback((v: string) => setForm(p => ({ ...p, email: v })),         []);
  const handleAge           = useCallback((v: string) => setForm(p => ({ ...p, age: v })),           []);
  const handleSpecialty     = useCallback((v: string) => setForm(p => ({ ...p, specialty: v })),     []);
  const handleLicenseNumber = useCallback((v: string) => setForm(p => ({ ...p, licenseNumber: v })), []);

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert(t.error || 'خطأ', t.nameRequired || 'الاسم الأول والأخير مطلوبان');
      return;
    }
    setSaving(true);
    try {
      onSave(form);
      onClose();
      notify({
        title: isRTL ? 'تم تحديث الملف الشخصي ✅' : 'Profile Updated ✅',
        body: isRTL
          ? `د. ${form.firstName}! تم حفظ بياناتك بنجاح`
          : `Dr. ${form.firstName}! Your profile has been updated successfully`,
        emoji: '🩺',
        type: 'add',
      });
    } catch {
      Alert.alert(t.error || 'خطأ', t.saveFailed || 'فشل الحفظ، حاول مجدداً');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
        <View style={styles.slideModal}>
          <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t.editProfile || 'تعديل الملف الشخصي'}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={styles.editFormContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">
            <ProfileField label={t.firstName || 'الاسم الأول'}     value={form.firstName}     onChangeText={handleFirstName}     isRTL={isRTL} />
            <ProfileField label={t.lastName  || 'الاسم الأخير'}    value={form.lastName}      onChangeText={handleLastName}      isRTL={isRTL} />
            <ProfileField label={t.email     || 'البريد'}          value={form.email}         onChangeText={handleEmail}         keyboardType="email-address" autoCapitalize="none" isRTL={isRTL} />
            <ProfileField label={t.age       || 'العمر'}           value={form.age}           onChangeText={handleAge}           keyboardType="numeric" autoCapitalize="none" isRTL={isRTL} />
            <ProfileField label={isRTL ? 'التخصص' : 'Specialty'}  value={form.specialty}     onChangeText={handleSpecialty}     isRTL={isRTL} />
            <ProfileField label={isRTL ? 'رقم الترخيص' : 'License Number'} value={form.licenseNumber} onChangeText={handleLicenseNumber} keyboardType="numeric" autoCapitalize="none" isRTL={isRTL} />

            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.gender || 'الجنس'}</Text>
              <View style={[styles.genderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {(['male', 'female'] as const).map(g => (
                  <TouchableOpacity key={g} onPress={() => setForm(p => ({ ...p, gender: g }))}
                    style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]} activeOpacity={0.8}>
                    <Ionicons name={g === 'male' ? 'male-outline' : 'female-outline'} size={18}
                      color={form.gender === g ? Colors.white : Colors.textSecondary} />
                    <Text style={[styles.genderBtnText, form.gender === g && styles.genderBtnTextActive]}>
                      {g === 'male' ? (t.male || 'ذكر') : (t.female || 'أنثى')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <PrimaryButton
              title={saving ? (t.saving || 'جاري الحفظ…') : (t.save || 'حفظ التعديلات')}
              onPress={handleSave}
              style={[styles.saveBtn, { backgroundColor: DOC_COLOR }]}
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
          <View style={[styles.modalIconWrap, { backgroundColor: DOC_COLOR_LIGHT }]}>
            <Ionicons name="language-outline" size={32} color={DOC_COLOR} />
          </View>
          <Text style={styles.modalTitle}>{t.language || 'اللغة'}</Text>
          <Text style={styles.modalBody}>{t.selectLanguage || 'اختر لغتك المفضلة'}</Text>
          <View style={{ width: '100%', gap: 10, marginBottom: Spacing.xl }}>
            {langs.map(lang => (
              <TouchableOpacity key={lang.code} onPress={() => { onSelect(lang.code); onClose(); }}
                style={[styles.langOption, (isRTL ? lang.code === 'ar' : lang.code === 'en') && styles.langOptionActive]}
                activeOpacity={0.8}>
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.langName}>{lang.label}</Text>
                  <Text style={styles.langNative}>{lang.native}</Text>
                </View>
                {(isRTL ? lang.code === 'ar' : lang.code === 'en') && (
                  <Ionicons name="checkmark-circle" size={22} color={DOC_COLOR} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          <OutlineButton title={t.cancel || 'إلغاء'} onPress={onClose} style={{ width: '100%' }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Help Modal ───────────────────────────────────────────
function HelpModal({ visible, onClose, t, isRTL }: {
  visible: boolean; onClose: () => void; t: any; isRTL: boolean;
}) {
  const faqs = [
    { q: isRTL ? 'كيف أضيف مريضاً جديداً؟'         : 'How do I add a new patient?',       a: isRTL ? 'اذهب إلى قائمة المرضى واضغط على زر الإضافة.'          : 'Go to the patients list and press the add button.' },
    { q: isRTL ? 'كيف أحدّث ملفي الشخصي؟'           : 'How do I update my profile?',       a: isRTL ? 'اذهب إلى المزيد ← تعديل الملف الشخصي وحدّث بياناتك.'   : 'Go to More → Edit Profile and update your info.' },
    { q: isRTL ? 'كيف أتواصل مع فريق الدعم؟'         : 'How do I contact support?',         a: isRTL ? 'راسلنا على support@rahati.app وسنرد خلال 24 ساعة.'       : 'Email us at support@rahati.app — we reply within 24h.' },
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
            <Text style={styles.modalHeaderTitle}>{t.help || 'المساعدة'}</Text>
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
type ModalKey = 'logout' | 'editProfile' | 'language' | 'help' | null;

type DoctorUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  age?: string | number;
  gender?: string;
  specialty?: string;
  licenseNumber?: string;
};

export default function DocMoreScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { t, isRTL, setLang }           = useLang();

  const doctorUser = user as DoctorUser | null;

  const [activeModal,     setActiveModal]     = useState<ModalKey>(null);
  const [avatarUri,       setAvatarUri]       = useState<string | null>(null);
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);
  const [specialty,       setSpecialty]       = useState('');
  const [licenseNumber,   setLicenseNumber]   = useState('');
  const [totalPatients,   setTotalPatients]   = useState(0);
  const [activePatients,  setActivePatients]  = useState(0);
  const [pendingPatients, setPendingPatients] = useState(0);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem('user_avatar').then(uri => { if (uri) setAvatarUri(uri); });
    AsyncStorage.getItem('doctor_extra_fields').then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        setSpecialty(parsed.specialty || '');
        setLicenseNumber(parsed.licenseNumber || '');
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadStats = async () => {
        try {
          const patientsRaw  = await AsyncStorage.getItem('doc_patients');
          const patients: any[] = patientsRaw ? JSON.parse(patientsRaw) : [];
          setTotalPatients(patients.length);
          setActivePatients(patients.filter((p: any) => p.status === 'accepted').length);
          setPendingPatients(patients.filter((p: any) => p.status === 'pending').length);

          const extraRaw = await AsyncStorage.getItem('doctor_extra_fields');
          if (extraRaw) {
            const parsed = JSON.parse(extraRaw);
            setSpecialty(parsed.specialty || '');
            setLicenseNumber(parsed.licenseNumber || '');
          }
        } catch (e) {
          console.warn('[DocMoreScreen] Stats error:', e);
        }
      };
      loadStats();
    }, [])
  );

  const open  = (key: ModalKey) => setActiveModal(key);
  const close = ()              => setActiveModal(null);

  const handleSaveProfile = async (data: DoctorFields) => {
    await updateProfile({
      firstName: data.firstName,
      lastName:  data.lastName,
      email:     data.email,
      age:       data.age,
      gender:    data.gender,
    } as any);

    const extraFields = {
      specialty:     data.specialty,
      licenseNumber: data.licenseNumber,
    };
    await AsyncStorage.setItem('doctor_extra_fields', JSON.stringify(extraFields));

    setSpecialty(data.specialty || '');
    setLicenseNumber(data.licenseNumber || '');
  };

  const handleLanguageSelect = async (lang: 'ar' | 'en') => {
    await AsyncStorage.setItem('app_language', lang);
    setLang(lang);
  };

  const handleAvatarPressIn  = () => { longPressTimer.current = setTimeout(() => setShowAvatarSheet(true), 500); };
  const handleAvatarPressOut = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.error || 'خطأ', t.photoPermissionRequired || 'مطلوب إذن الوصول للصور');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
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
    { key: 'language', icon: 'language-outline',    label: t.language || 'اللغة',     color: DOC_COLOR,  value: isRTL ? 'عربي' : 'English' },
    { key: 'help',     icon: 'help-circle-outline',  label: t.help    || 'المساعدة',  color: '#29B6D4' },
  ];

  const initials = user
    ? `${(user.firstName || '?')[0]}${(user.lastName || '?')[0]}`.toUpperCase()
    : '?';

  const docTitle = isRTL ? 'د.' : 'Dr.';

  const combinedUser = {
    ...user,
    specialty,
    licenseNumber,
  };

  // ─── Label ديناميكي: لو في pending → "مرضى مقبولون"، لو مفيش → "مرضى"
  const activePatientsLabel = pendingPatients > 0
    ? (isRTL ? 'مرضى مقبولون' : 'Accepted Patients')
    : (isRTL ? 'مرضى'         : 'Patients');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor='#F8F5FF' barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Top Bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={DOC_COLOR} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{isRTL ? 'حسابي' : 'My Account'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => open('editProfile')}>
            <Ionicons name="pencil-outline" size={20} color={DOC_COLOR} />
          </TouchableOpacity>
        </View>

        {/* ── Avatar Card ── */}
        <View style={styles.avatarCard}>
          <View style={styles.docBadge}>
            <Ionicons name="medical" size={12} color="#fff" />
            <Text style={styles.docBadgeText}>{isRTL ? 'دكتور' : 'Doctor'}</Text>
          </View>

          <TouchableOpacity activeOpacity={0.85} onPressIn={handleAvatarPressIn} onPressOut={handleAvatarPressOut} onPress={() => {}}>
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

          <Text style={styles.avatarName}>{docTitle} {user?.firstName} {user?.lastName}</Text>
          <Text style={styles.avatarSpecialty}>{specialty || (isRTL ? 'التخصص غير محدد' : 'Specialty not set')}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
          <Text style={styles.avatarHint}>{isRTL ? '👆 اضغط مطوّل لخيارات الصورة' : '👆 Long press for photo options'}</Text>
        </View>

        {/* ── Doctor Stats ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: DOC_COLOR_LIGHT }]}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={[styles.statValue, { color: DOC_COLOR }]}>{activePatients}</Text>
            <Text style={styles.statLabel}>{activePatientsLabel}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#E8F5EF' }]}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={[styles.statValue, { color: '#4CAF82' }]}>{totalPatients}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'إجمالي المرضى' : 'Total Patients'}</Text>
          </View>
        </View>

        {/* ── Account Info ── */}
        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
          {t.accountInfo || 'معلومات الحساب'}
        </Text>
        <View style={styles.card}>
          <InfoRow label={t.firstName   || 'الاسم الأول'}  value={user?.firstName || ''}                   isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.lastName    || 'الاسم الأخير'} value={user?.lastName  || ''}                   isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.email       || 'البريد'}        value={user?.email     || ''}                   isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.age         || 'العمر'}         value={user?.age ? `${user.age} ${t.years || 'سنة'}` : ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={isRTL ? 'التخصص' : 'Specialty'}      value={specialty}      isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={isRTL ? 'رقم الترخيص' : 'License'}   value={licenseNumber}  isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow
            label={t.gender || 'الجنس'}
            value={user?.gender === 'male' ? (t.male || 'ذكر') : user?.gender === 'female' ? (t.female || 'أنثى') : ''}
            isRTL={isRTL}
          />
        </View>

        {/* ── Quick Links ── */}
        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL ? 'روابط سريعة' : 'Quick Links'}
        </Text>
        <View style={styles.quickLinksRow}>
          {[
            { label: isRTL ? 'المرضى'    : 'Patients',    icon: 'people-outline',        color: DOC_COLOR,  bg: DOC_COLOR_LIGHT, route: '/Doctor/Dochome'   },
            { label: isRTL ? 'الشاتات'   : 'Chats',       icon: 'chatbubbles-outline',    color: '#4CAF82',  bg: '#E8F5EF',       route: '/Doctor/Docchat'  },
            { label: isRTL ? 'إشعارات'   : 'Alerts',      icon: 'notifications-outline',  color: '#E05C5C',  bg: '#FDEAEA',       route: '/Doctor/Docnotif' },
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
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Tab Bar ── */}
      <DocTabBar />

      {/* ── Modals ── */}
      <AvatarActionSheet visible={showAvatarSheet} onClose={() => setShowAvatarSheet(false)}
        onPickNew={handlePickAvatar} onDelete={handleDeleteAvatar} hasAvatar={!!avatarUri} t={t} />

      <EditProfileModal
        visible={activeModal === 'editProfile'}
        onClose={close}
        user={combinedUser}
        onSave={handleSaveProfile}
        t={t}
        isRTL={isRTL}
      />

      <LanguageModal visible={activeModal === 'language'} onClose={close}
        isRTL={isRTL} t={t} onSelect={handleLanguageSelect} />

      <HelpModal visible={activeModal === 'help'} onClose={close} t={t} isRTL={isRTL} />

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
              <OutlineButton title={t.cancel  || 'إلغاء'} onPress={close} style={{ flex: 1 }} />
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

// ─── Styles ───────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#F8F5FF' },
  content: { padding: Spacing.xl },

  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2,
  },
  pageTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },

  avatarCard: {
    backgroundColor: DOC_COLOR, borderRadius: Radius.xxl, padding: Spacing.xl,
    alignItems: 'center', marginBottom: Spacing.xl,
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4,
  },
  docBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  docBadgeText:     { fontSize: 12, fontWeight: '700', color: '#fff' },
  avatarWrapper:    { width: 80, height: 80, marginBottom: 4 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage:    { width: 80, height: 80, borderRadius: 40 },
  avatarInitials: { fontSize: 26, fontWeight: '800', color: Colors.white },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: DOC_COLOR, borderWidth: 2, borderColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2,
  },
  avatarName:      { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white, marginBottom: 2, marginTop: 10 },
  avatarSpecialty: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginBottom: 2 },
  avatarEmail:     { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)' },
  avatarHint:      { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6, marginBottom: 4 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 4 },
  statIcon:  { fontSize: 20 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },

  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
  },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, marginBottom: Spacing.xl,
    overflow: 'hidden', shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: Spacing.base },

  infoRow:   { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 14 },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },

  menuRow:       { alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 14, gap: 12 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  menuIcon:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  menuLabel:     { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '500', textAlign: 'right' },
  menuValue:     { fontSize: FontSize.sm, color: Colors.textMuted },

  quickLinksRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  quickLink:     { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 6 },
  quickLinkText: { fontSize: 11, fontWeight: '700' },

  logoutBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.xl,
    paddingVertical: 16, marginBottom: Spacing.base,
  },
  logoutText:  { fontSize: FontSize.base, fontWeight: '600', color: Colors.danger },
  versionText: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xxl,
    width: '100%', alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 20, elevation: 8,
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  modalBody:  { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  modalBtns:  { flexDirection: 'row', gap: 12, width: '100%' },

  slideModalSafe: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  slideModal: {
    backgroundColor: Colors.background, borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl, maxHeight: '92%',
  },
  modalHeader: {
    alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  modalCloseBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.divider, alignItems: 'center', justifyContent: 'center' },
  modalHeaderTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },

  editFormContent: { padding: Spacing.xl, paddingBottom: 40 },
  fieldWrap:  { marginBottom: Spacing.base },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: Spacing.base,
    paddingVertical: 12, fontSize: FontSize.base, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.divider,
  },
  genderRow:           { gap: 10 },
  genderBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.divider, paddingVertical: 12, backgroundColor: Colors.white },
  genderBtnActive:     { backgroundColor: DOC_COLOR, borderColor: DOC_COLOR },
  genderBtnText:       { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: '600' },
  genderBtnTextActive: { color: Colors.white },
  saveBtn: { marginTop: Spacing.xl },

  langOption:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.base, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.white },
  langOptionActive: { borderColor: DOC_COLOR, backgroundColor: DOC_COLOR + '0A' },
  langFlag:         { fontSize: 28 },
  langName:         { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  langNative:       { fontSize: FontSize.sm, color: Colors.textMuted },

  faqRow: { alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 14, gap: 10 },
  faqQ:   { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  faqA:   { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, paddingHorizontal: Spacing.base, paddingBottom: 14 },

  actionOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  actionSheet:    { backgroundColor: Colors.white, borderRadius: 28, width: '100%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  actionHeader:   { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.base, paddingHorizontal: Spacing.xl },
  actionEmoji:    { fontSize: 42, marginBottom: 8 },
  actionTitle:    { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  actionSubtitle: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  actionDivider:  { height: 1, backgroundColor: Colors.divider },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.xl, paddingVertical: 16 },
  actionBtnIcon:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionBtnEmoji: { fontSize: 20 },
  actionBtnText:  { flex: 1, fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
});