import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Image,
  Animated, Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, OutlineButton } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { notify } from './notificationService';
import PatientTabBar from '../../components/PatientTabBar';
import { db } from '../../utils/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { uploadImageToCloudinary } from '../../utils/uploadImage';

const STORAGE_KEYS = {
  CORE_TASKS:   'core_tasks',
  EXTRA_TASKS:  'extra_tasks',
  CORE_EX:      'core_exercises',
  EXTRA_EX:     'extra_exercises',
  ENERGY:       'energy_level',
};

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function getPlanDoneKey(date: Date) { return `plan_done_${toKey(date)}`; }

function InfoRow({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return (
    <View style={[styles.infoRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

function MenuRow({ icon, label, value, color, onPress, isLast, isRTL }: {
  icon: string; label: string; value?: string; color: string;
  onPress: () => void; isLast: boolean; isRTL: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={[styles.menuRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }, !isLast && styles.menuRowBorder]}>
      <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color={Colors.primary + '80'} />
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Text style={[styles.menuLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <View style={[styles.menuIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Energy Edit Modal ────────────────────────────────────
function EnergyEditModal({ visible, onClose, currentEnergy, onSave, isRTL, t }: {
  visible: boolean; onClose: () => void; currentEnergy: number;
  onSave: (val: number) => void; isRTL: boolean; t: any;
}) {
  const [value, setValue] = useState(currentEnergy);
  React.useEffect(() => { if (visible) setValue(currentEnergy); }, [visible, currentEnergy]);

  const levels = [
    { label: t.energyExhausted, val: 10, emoji: '🪫', color: '#E05C5C' },
    { label: t.energyLow,               val: 30, emoji: '😴', color: '#E07B5C' },
    { label: t.energyMedium,    val: 55, emoji: '🔋', color: '#F4A32B' },
    { label: t.highEnergy,      val: 75, emoji: '⚡', color: '#4CAF82' },
    { label: t.energyExcellent, val: 95, emoji: '🚀', color: '#5B9BD5' },
  ];
  const eColor = value >= 70 ? '#4CAF82' : value >= 40 ? '#F4A32B' : '#E05C5C';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
      <View style={energyModal.sheet}>
        <View style={energyModal.handle} />
        <Text style={energyModal.title}>
          {t.energyTodayQ}
        </Text>
        <Text style={energyModal.sub}>
          {t.chooseEnergyLevel}
        </Text>
        <View style={[energyModal.valueWrap, { borderColor: eColor + '40' }]}>
          <Text style={[energyModal.valueNum, { color: eColor }]}>{value}%</Text>
          <Text style={energyModal.valueEmoji}>
            {value >= 80 ? '🚀' : value >= 60 ? '⚡' : value >= 40 ? '🔋' : value >= 20 ? '😴' : '🪫'}
          </Text>
        </View>
        <View style={energyModal.barBg}>
          <View style={[energyModal.barFill, { width: `${value}%`, backgroundColor: eColor }]} />
        </View>
        <View style={energyModal.controls}>
          {['-5', '-1', '+1', '+5'].map(step => (
            <TouchableOpacity
              key={step}
              style={[energyModal.controlBtn, { borderColor: eColor }]}
              onPress={() => setValue(v => Math.min(100, Math.max(0, v + parseInt(step))))}
              activeOpacity={0.8}
            >
              <Text style={[energyModal.controlText, { color: eColor }]}>{step}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={energyModal.quickRow}>
          {levels.map(l => (
            <TouchableOpacity
              key={l.val}
              style={[energyModal.quickBtn, value === l.val && { backgroundColor: l.color + '22', borderColor: l.color }]}
              onPress={() => setValue(l.val)} activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>{l.emoji}</Text>
              <Text style={[energyModal.quickLabel, { color: l.color }]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[energyModal.saveBtn, { backgroundColor: eColor }]}
          onPress={() => { onSave(value); onClose(); }} activeOpacity={0.85}
        >
          <Text style={energyModal.saveBtnText}>{t.saveEnergy}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── ProfileField ─────────────────────────────────────────
type ProfileFieldProps = { label: string; value: string; onChangeText: (v: string) => void; keyboardType?: any; autoCapitalize?: any; isRTL: boolean; };
const ProfileField = React.memo(function ProfileField({ label, value, onChangeText, keyboardType = 'default', autoCapitalize = 'words', isRTL }: ProfileFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]} keyboardType={keyboardType} autoCapitalize={autoCapitalize} placeholderTextColor={Colors.textMuted} blurOnSubmit={false} />
    </View>
  );
});

// ─── Avatar Action Sheet ──────────────────────────────────
function AvatarActionSheet({ visible, onClose, onPickNew, onDelete, hasAvatar, t, isRTL }: {
  visible: boolean; onClose: () => void; onPickNew: () => void;
  onDelete: () => void; hasAvatar: boolean; t: any; isRTL: boolean;
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
            <Text style={styles.actionTitle}>{t.photoTitle}</Text>
            <Text style={styles.actionSubtitle}>{t.photoSubtitle}</Text>
          </View>
          <View style={styles.actionDivider} />
          <TouchableOpacity style={styles.actionBtn} onPress={() => { onClose(); setTimeout(onPickNew, 300); }} activeOpacity={0.7}>
            <View style={[styles.actionBtnIcon, { backgroundColor: '#4CAF8220' }]}><Text style={styles.actionBtnEmoji}>🖼️</Text></View>
            <Text style={styles.actionBtnText}>{hasAvatar ? t.changePhoto : t.addPhoto}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {hasAvatar && (
            <>
              <View style={styles.actionDivider} />
              <TouchableOpacity style={styles.actionBtn} onPress={() => { onClose(); setTimeout(onDelete, 300); }} activeOpacity={0.7}>
                <View style={[styles.actionBtnIcon, { backgroundColor: Colors.dangerLight }]}><Text style={styles.actionBtnEmoji}>🗑️</Text></View>
                <Text style={[styles.actionBtnText, { color: Colors.danger }]}>{t.deletePhoto}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.danger + '80'} />
              </TouchableOpacity>
            </>
          )}
          <View style={styles.actionDivider} />
          <TouchableOpacity style={[styles.actionBtn, { justifyContent: 'center' }]} onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.actionBtnText, { color: Colors.textMuted, textAlign: 'center' }]}>
              {t.notNowBtn}
            </Text>
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
  onSave: (data: UserFields) => Promise<void>; t: any; isRTL: boolean;
}) {
  const [form, setForm] = useState<UserFields>({
    firstName: user?.firstName || '', lastName: user?.lastName || '',
    email: user?.email || '', age: user?.age ? String(user.age) : '', gender: user?.gender || '',
  });
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    if (visible) setForm({ firstName: user?.firstName || '', lastName: user?.lastName || '', email: user?.email || '', age: user?.age ? String(user.age) : '', gender: user?.gender || '' });
  }, [visible, user]);
  const handleFirstName = useCallback((v: string) => setForm(p => ({ ...p, firstName: v })), []);
  const handleLastName  = useCallback((v: string) => setForm(p => ({ ...p, lastName: v })),  []);
  const handleEmail     = useCallback((v: string) => setForm(p => ({ ...p, email: v })),     []);
  const handleAge       = useCallback((v: string) => setForm(p => ({ ...p, age: v })),       []);
  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { Alert.alert(t.error, t.nameRequired); return; }
    setSaving(true);
    try {
      await onSave(form); onClose();
      notify({ title: t.profileUpdated, body: `${t.profileUpdatedBody}`, emoji: '👤', type: 'add' });
    } catch { Alert.alert(t.error, t.saveFailed); }
    finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
        <View style={styles.slideModal}>
          <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}><Ionicons name="close" size={22} color={Colors.textPrimary} /></TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t.editProfile}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={styles.editFormContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">
            <ProfileField label={t.firstName} value={form.firstName} onChangeText={handleFirstName} isRTL={isRTL} />
            <ProfileField label={t.lastName}  value={form.lastName}  onChangeText={handleLastName}  isRTL={isRTL} />
            <ProfileField label={t.email}     value={form.email}     onChangeText={handleEmail}     keyboardType="email-address" autoCapitalize="none" isRTL={isRTL} />
            <ProfileField label={t.age}       value={form.age}       onChangeText={handleAge}       keyboardType="numeric" autoCapitalize="none" isRTL={isRTL} />
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.gender}</Text>
              <View style={[styles.genderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {(['male','female'] as const).map(g => (
                  <TouchableOpacity key={g} onPress={() => setForm(p => ({ ...p, gender: g }))}
                    style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]} activeOpacity={0.8}>
                    <Ionicons name={g === 'male' ? 'male-outline' : 'female-outline'} size={18} color={form.gender === g ? Colors.white : Colors.textSecondary} />
                    <Text style={[styles.genderBtnText, form.gender === g && styles.genderBtnTextActive]}>{g === 'male' ? t.male : t.female}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <PrimaryButton title={saving ? t.savingProfile : t.save} onPress={handleSave} style={styles.saveBtn} />
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
          <Text style={styles.modalBody}>{t.selectLanguage}</Text>
          <View style={{ width: '100%', gap: 10, marginBottom: Spacing.xl }}>
            {langs.map(lang => (
              <TouchableOpacity key={lang.code} onPress={() => { onSelect(lang.code); onClose(); }}
                style={[styles.langOption, (isRTL ? lang.code==='ar' : lang.code==='en') && styles.langOptionActive]} activeOpacity={0.8}>
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.langName}>{lang.label}</Text>
                  <Text style={styles.langNative}>{lang.native}</Text>
                </View>
                {(isRTL ? lang.code==='ar' : lang.code==='en') && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
          <OutlineButton title={t.cancel} onPress={onClose} style={{ width: '100%' }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Help Modal ───────────────────────────────────────────
function HelpModal({ visible, onClose, t, isRTL }: { visible: boolean; onClose: () => void; t: any; isRTL: boolean; }) {
  const faqs = [
    { q: t.faq1q, a: t.faq1a },
    { q: t.faq2q, a: t.faq2a },
    { q: t.faq3q, a: t.faq3a },
  ];
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.slideModalSafe}>
        <View style={styles.slideModal}>
          <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}><Ionicons name="close" size={22} color={Colors.textPrimary} /></TouchableOpacity>
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
                  {expanded === i && <Text style={[styles.faqA, { textAlign: isRTL ? 'right' : 'left' }]}>{faq.a}</Text>}
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
type ModalKey = 'logout' | 'editProfile' | 'language' | 'help' | 'energy' | null;

export default function MoreScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { t, isRTL, setLang }           = useLang();
  const [activeModal,     setActiveModal]     = useState<ModalKey>(null);
  const [avatarUri,       setAvatarUri]       = useState<string | null>(null);
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskDone,  setTaskDone]  = useState(0);
  const [energy,    setEnergy]    = useState(50);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const avatarKey = user?.uid ? `${user.uid}_user_avatar` : 'user_avatar';
    AsyncStorage.getItem(avatarKey).then(uri => { if (uri) setAvatarUri(uri); });
  }, [user?.uid]);

  useFocusEffect(useCallback(() => {
    const loadStats = async () => {
      try {
        const today    = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const uid = user?.uid ?? 'guest';
        const mk = (base: string) => `${uid}_${base}`;
        const [coreTRaw, extraTRaw] = await Promise.all([
          AsyncStorage.getItem(mk(STORAGE_KEYS.CORE_TASKS)),
          AsyncStorage.getItem(mk(STORAGE_KEYS.EXTRA_TASKS)),
        ]);
        const coreTasks:     any[] = coreTRaw  ? JSON.parse(coreTRaw)  : [];
        const allExtraTasks: any[] = extraTRaw ? JSON.parse(extraTRaw) : [];
        const extraTasks = allExtraTasks.filter((tk: any) => !tk.date || tk.date === todayKey);
        setTaskTotal(coreTasks.length + extraTasks.length);
        const planDoneRaw = await AsyncStorage.getItem(mk(getPlanDoneKey(today)));
        const doneIds: Set<string> = planDoneRaw ? new Set(JSON.parse(planDoneRaw)) : new Set();
        const coreTaskIds  = new Set(coreTasks.map((t: any)  => t.key ?? t.id));
        const extraTaskIds = new Set(extraTasks.map((t: any) => t.key ?? t.id));
        setTaskDone([...doneIds].filter(id => coreTaskIds.has(id) || extraTaskIds.has(id)).length);

        if (user?.uid) {
          try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            const fsEnergy = snap.exists() ? snap.data().energyLevel : undefined;
            if (fsEnergy != null) {
              setEnergy(Number(fsEnergy));
            } else {
              const energyRaw = await AsyncStorage.getItem(`energy_level_${user.uid}`);
              if (energyRaw !== null) setEnergy(Number(energyRaw));
            }
          } catch {
            const energyRaw = await AsyncStorage.getItem(`energy_level_${user.uid}`);
            if (energyRaw !== null) setEnergy(Number(energyRaw));
          }
        } else {
          const energyRaw = await AsyncStorage.getItem(STORAGE_KEYS.ENERGY);
          if (energyRaw !== null) setEnergy(Number(energyRaw));
        }
      } catch (e) { console.warn('[MoreScreen] Stats load error:', e); }
    };
    loadStats();
  }, [user?.uid]));

  const open  = (key: ModalKey) => setActiveModal(key);
  const close = ()              => setActiveModal(null);

  const handleSaveProfile = async (data: any) => {
    await updateProfile({ firstName: data.firstName, lastName: data.lastName, email: data.email, age: data.age, gender: data.gender });
  };

  const handleLanguageSelect = async (lang: 'ar' | 'en') => {
    await AsyncStorage.setItem('app_language', lang);
    setLang(lang);
  };

  const handleSaveEnergy = async (val: number) => {
    setEnergy(val);
    if (user?.uid) {
      await AsyncStorage.setItem(`energy_level_${user.uid}`, String(val));
      setDoc(doc(db, 'users', user.uid), { energyLevel: val }, { merge: true }).catch(() => {});
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.ENERGY, String(val));
    }
  };

  const handleAvatarPressIn  = () => { longPressTimer.current = setTimeout(() => setShowAvatarSheet(true), 500); };
  const handleAvatarPressOut = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert(t.error, t.photoPermissionRequired); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const avatarKey = user?.uid ? `${user.uid}_user_avatar` : 'user_avatar';
      const localUri = result.assets[0].uri;
      setAvatarUri(localUri);
      await AsyncStorage.setItem(avatarKey, localUri);
      try {
        const cloudUrl = await uploadImageToCloudinary(localUri);
        await updateProfile({ photoUrl: cloudUrl });
        await AsyncStorage.setItem(avatarKey, cloudUrl);
        setAvatarUri(cloudUrl);
      } catch (e) {
        console.warn('[more] avatar upload failed:', e);
      }
    }
  };

  const handleDeleteAvatar = async () => {
    const avatarKey = user?.uid ? `${user.uid}_user_avatar` : 'user_avatar';
    await AsyncStorage.removeItem(avatarKey);
    setAvatarUri(null);
    updateProfile({ photoUrl: '' }).catch(() => {});
  };

  const MENU = [
    { key: 'language', icon: 'language-outline', label: t.language, color: '#4CAF82', value: isRTL ? 'عربي' : 'English' },
    { key: 'help',     icon: 'help-circle-outline', label: t.help,  color: '#29B6D4' },
  ];

  const initials = user ? `${(user.firstName||'?')[0]}${(user.lastName||'?')[0]}`.toUpperCase() : '?';
  const eColor = energy >= 70 ? '#4CAF82' : energy >= 40 ? '#F4A32B' : '#E05C5C';
  const eBg    = energy >= 70 ? '#E8F5EF' : energy >= 40 ? '#FEF3E2' : '#FDEAEA';
  const energyLabel = energy >= 70 ? t.highEnergy : energy >= 40 ? t.mediumEnergy : t.lowEnergy;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity style={styles.editBtn} onPress={() => open('editProfile')}>
            <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t.profile}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.avatarCard}>
          <TouchableOpacity activeOpacity={0.85} onPressIn={handleAvatarPressIn} onPressOut={handleAvatarPressOut} onPress={() => {}}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.avatarInitials}>{initials}</Text>}
              </View>
              <TouchableOpacity style={styles.cameraBadge} onPress={handlePickAvatar} activeOpacity={0.85}>
                <Ionicons name="camera" size={13} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarName}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
          <Text style={styles.avatarHint}>{t.longPressHint}</Text>
        </View>

        {/* Energy Card */}
        <TouchableOpacity onPress={() => open('energy')} activeOpacity={0.85}
          style={[styles.energyCard, { backgroundColor: eBg, borderColor: eColor + '33', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={{ fontSize: 20 }}>{energy >= 70 ? '⚡' : energy >= 40 ? '🔋' : '🪫'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.energyLabel, { color: eColor }]}>{energyLabel}</Text>
            <View style={[styles.energyBarBg, { backgroundColor: eColor + '22' }]}>
              <View style={[styles.energyBarFill, { width: `${energy}%` as any, backgroundColor: eColor }]} />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={[styles.energyPct, { color: eColor }]}>{energy}%</Text>
            <Text style={{ fontSize: 10, color: eColor, opacity: 0.7 }}>{t.tapToEditEnergy}</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.accountInfo}</Text>
        <View style={styles.card}>
          <InfoRow label={t.firstName} value={user?.firstName || ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.lastName}  value={user?.lastName  || ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.email}     value={user?.email     || ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.age}       value={user?.age ? `${user.age} ${t.years}` : ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.gender}    value={user?.gender === 'male' ? t.male : user?.gender === 'female' ? t.female : ''} isRTL={isRTL} />
        </View>

        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.quickLinks}</Text>
        <View style={[styles.quickLinksRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {[
            { label: t.myPlanLink,    icon: 'calendar-outline',  color: '#7C5CBF', bg: '#F0EBFA', route: '/tabs/home'      },
            { label: t.exercisesLink, icon: 'fitness-outline',   color: '#4CAF82', bg: '#E8F5EF', route: '/tabs/exercises' },
            { label: t.tasksLink,     icon: 'checkbox-outline',  color: '#5B9BD5', bg: '#E8F1FB', route: '/tabs/tasks'     },
            { label: t.doctorsLink,   icon: 'medkit-outline',    color: '#C97B3A', bg: '#FEF3E2', route: '/tabs/doctors'   },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={[styles.quickLink, { backgroundColor: item.bg }]}
              onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
              <Text style={[styles.quickLinkText, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.settings}</Text>
        <View style={styles.card}>
          {MENU.map((item, i) => (
            <MenuRow key={item.key} icon={item.icon} label={item.label}
              value={'value' in item ? item.value : undefined}
              color={item.color} onPress={() => open(item.key as ModalKey)}
              isLast={i === MENU.length - 1} isRTL={isRTL} />
          ))}
        </View>

        <TouchableOpacity onPress={() => open('logout')}
          style={[styles.logoutBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>{t.logout}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>{t.version}</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ✅ isRTL prop added here */}
      <AvatarActionSheet
        visible={showAvatarSheet}
        onClose={() => setShowAvatarSheet(false)}
        onPickNew={handlePickAvatar}
        onDelete={handleDeleteAvatar}
        hasAvatar={!!avatarUri}
        t={t}
        isRTL={isRTL}
      />
      <EditProfileModal visible={activeModal === 'editProfile'} onClose={close} user={user} onSave={handleSaveProfile} t={t} isRTL={isRTL} />
      <LanguageModal visible={activeModal === 'language'} onClose={close} isRTL={isRTL} t={t} onSelect={handleLanguageSelect} />
      <HelpModal visible={activeModal === 'help'} onClose={close} t={t} isRTL={isRTL} />
      <EnergyEditModal visible={activeModal === 'energy'} onClose={close} currentEnergy={energy} onSave={handleSaveEnergy} isRTL={isRTL} t={t} />

      <Modal visible={activeModal === 'logout'} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: Colors.dangerLight }]}>
              <Ionicons name="log-out-outline" size={32} color={Colors.danger} />
            </View>
            <Text style={styles.modalTitle}>{t.logout}</Text>
            <Text style={styles.modalBody}>{t.logoutConfirm}</Text>
            <View style={styles.modalBtns}>
              <OutlineButton title={t.cancel} onPress={close} style={{ flex: 1 }} />
              <PrimaryButton title={t.confirm} onPress={() => { close(); logout(); }} style={{ flex: 1, backgroundColor: Colors.danger }} />
            </View>
          </View>
        </View>
      </Modal>
      <PatientTabBar />
    </SafeAreaView>
  );
}

const energyModal = StyleSheet.create({
  sheet:       { backgroundColor: Colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 10 },
  handle:      { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center' },
  title:       { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  sub:         { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: -8 },
  valueWrap:   { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  valueNum:    { fontSize: 36, fontWeight: '900' },
  valueEmoji:  { fontSize: 28 },
  barBg:       { height: 10, backgroundColor: Colors.border, borderRadius: 5, overflow: 'hidden', marginHorizontal: 4 },
  barFill:     { height: 10, borderRadius: 5 },
  controls:    { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  controlBtn:  { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: Colors.white },
  controlText: { fontSize: 16, fontWeight: '800' },
  quickRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  quickBtn:    { alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white, minWidth: 60 },
  quickLabel:  { fontSize: 10, fontWeight: '700' },
  saveBtn:     { borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: FontSize.base, fontWeight: '800', color: '#fff' },
});

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl },
  topBar:  { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  editBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.shadowDark, shadowOffset: { width:0,height:1 }, shadowOpacity:1, shadowRadius:3, elevation:2 },
  pageTitle: { flex:1, fontSize:22, fontWeight:'800', color:Colors.textPrimary, textAlign:'center' },
  avatarCard:     { backgroundColor: Colors.primary, borderRadius: Radius.xxl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.xl, shadowColor: Colors.shadow, shadowOffset:{width:0,height:4}, shadowOpacity:1, shadowRadius:12, elevation:4 },
  avatarWrapper:  { width:80, height:80, marginBottom:4 },
  avatarCircle:   { width:80, height:80, borderRadius:40, backgroundColor: Colors.primaryLight, borderWidth:3, borderColor:'rgba(255,255,255,0.35)', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  avatarImage:    { width:80, height:80, borderRadius:40 },
  avatarInitials: { fontSize:26, fontWeight:'800', color:Colors.white },
  cameraBadge:    { position:'absolute', bottom:-2, right:-2, width:26, height:26, borderRadius:13, backgroundColor:Colors.primary, borderWidth:2, borderColor:Colors.white, alignItems:'center', justifyContent:'center', elevation:3 },
  avatarName:     { fontSize:FontSize.lg, fontWeight:'800', color:Colors.white, marginBottom:2, marginTop:8 },
  avatarEmail:    { fontSize:FontSize.sm, color:'rgba(255,255,255,0.75)' },
  avatarHint:     { fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:6, marginBottom:16 },
  energyCard:     { flexDirection:'row', alignItems:'center', gap:12, borderRadius:16, padding:14, marginBottom:Spacing.xl, borderWidth:1 },
  energyLabel:    { fontSize:13, fontWeight:'700', marginBottom:6 },
  energyBarBg:    { height:6, borderRadius:3, overflow:'hidden' },
  energyBarFill:  { height:6, borderRadius:3 },
  energyPct:      { fontSize:16, fontWeight:'900' },
  sectionLabel: { fontSize:FontSize.xs, fontWeight:'700', color:Colors.textMuted, letterSpacing:1, marginBottom:8, textTransform:'uppercase' },
  card: { backgroundColor:Colors.white, borderRadius:Radius.xl, marginBottom:Spacing.xl, overflow:'hidden', shadowColor:Colors.shadowDark, shadowOffset:{width:0,height:2}, shadowOpacity:1, shadowRadius:6, elevation:2 },
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
  quickLink:     { flex:1, borderRadius:14, paddingVertical:14, alignItems:'center', gap:6 },
  quickLinkText: { fontSize:11, fontWeight:'700' },
  logoutBtn:   { alignItems:'center', justifyContent:'center', gap:8, backgroundColor:Colors.dangerLight, borderRadius:Radius.xl, paddingVertical:16, marginBottom:Spacing.base },
  logoutText:  { fontSize:FontSize.base, fontWeight:'600', color:Colors.danger },
  versionText: { textAlign:'center', fontSize:FontSize.xs, color:Colors.textMuted },
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.45)', alignItems:'center', justifyContent:'center', padding:Spacing.xl },
  modalCard:   { backgroundColor:Colors.white, borderRadius:Radius.xxl, padding:Spacing.xxl, width:'100%', alignItems:'center', shadowColor:Colors.shadow, shadowOffset:{width:0,height:8}, shadowOpacity:1, shadowRadius:20, elevation:8 },
  modalIconWrap: { width:64, height:64, borderRadius:32, alignItems:'center', justifyContent:'center', marginBottom:14 },
  modalTitle:  { fontSize:FontSize.xl, fontWeight:'800', color:Colors.textPrimary, marginBottom:8 },
  modalBody:   { fontSize:FontSize.base, color:Colors.textSecondary, textAlign:'center', marginBottom:Spacing.xl },
  modalBtns:   { flexDirection:'row', gap:12, width:'100%' },
  slideModalSafe: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end' },
  slideModal:     { backgroundColor:Colors.background, borderTopLeftRadius:Radius.xxl, borderTopRightRadius:Radius.xxl, maxHeight:'92%' },
  modalHeader:    { alignItems:'center', paddingHorizontal:Spacing.base, paddingVertical:Spacing.base, borderBottomWidth:1, borderBottomColor:Colors.divider },
  modalCloseBtn:  { width:36, height:36, borderRadius:18, backgroundColor:Colors.divider, alignItems:'center', justifyContent:'center' },
  modalHeaderTitle: { flex:1, fontSize:FontSize.lg, fontWeight:'700', color:Colors.textPrimary, textAlign:'center' },
  editFormContent: { padding:Spacing.xl, paddingBottom:40 },
  fieldWrap:   { marginBottom:Spacing.base },
  fieldLabel:  { fontSize:FontSize.sm, fontWeight:'600', color:Colors.textSecondary, marginBottom:6 },
  fieldInput:  { backgroundColor:Colors.white, borderRadius:Radius.lg, paddingHorizontal:Spacing.base, paddingVertical:12, fontSize:FontSize.base, color:Colors.textPrimary, borderWidth:1, borderColor:Colors.divider },
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