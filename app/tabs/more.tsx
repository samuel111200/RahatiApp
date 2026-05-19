// app/(tabs)/more.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, SafeAreaView, TextInput, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, OutlineButton } from '../../components/UI';
import RahatiLogo from '../../components/RahatiLogo';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return (
    <View style={[styles.infoRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={styles.infoValue}>{value || '—'}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({
  icon, label, value, color, onPress, isLast, isRTL,
}: {
  icon: string; label: string; value?: string; color: string;
  onPress: () => void; isLast: boolean; isRTL: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.menuRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }, !isLast && styles.menuRowBorder]}
    >
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={Colors.textMuted} />
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={[styles.menuIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Edit Profile Modal ─────────────────────────────────────────────────────────

type UserFields = {
  firstName: string;
  lastName: string;
  email: string;
  age: string;
  gender: string;
};

function EditProfileModal({
  visible, onClose, user, onSave, t, isRTL,
}: {
  visible: boolean;
  onClose: () => void;
  user: any;
  onSave: (data: UserFields) => void;
  t: any;
  isRTL: boolean;
}) {
  const [form, setForm] = useState<UserFields>({
    firstName: user?.firstName || '',
    lastName:  user?.lastName  || '',
    email:     user?.email     || '',
    age:       user?.age       ? String(user.age) : '',
    gender:    user?.gender    || '',
  });
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      setForm({
        firstName: user?.firstName || '',
        lastName:  user?.lastName  || '',
        email:     user?.email     || '',
        age:       user?.age       ? String(user.age) : '',
        gender:    user?.gender    || '',
      });
    }
  }, [visible]);

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert(t.error || 'Error', t.nameRequired || 'First and last name are required.');
      return;
    }
    setSaving(true);
    try {
      await AsyncStorage.setItem('user_profile', JSON.stringify(form));
      onSave(form);
      onClose();
    } catch (e) {
      Alert.alert(t.error || 'Error', t.saveFailed || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    label, key, keyboardType = 'default', autoCapitalize = 'words',
  }: {
    label: string; key: keyof UserFields; keyboardType?: any; autoCapitalize?: any;
  }) => (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={v => setForm(prev => ({ ...prev, [key]: v }))}
        style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.slideModalSafe}>
        <View style={styles.slideModal}>
          {/* Header */}
          <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t.editProfile}</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={styles.editFormContent} showsVerticalScrollIndicator={false}>
            <Field label={t.firstName} key="firstName" />
            <Field label={t.lastName}  key="lastName"  />
            <Field label={t.email}     key="email"     keyboardType="email-address" autoCapitalize="none" />
            <Field label={t.age}       key="age"       keyboardType="numeric" autoCapitalize="none" />

            {/* Gender Picker */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.gender}</Text>
              <View style={[styles.genderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {(['male', 'female'] as const).map(g => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setForm(prev => ({ ...prev, gender: g }))}
                    style={[
                      styles.genderBtn,
                      form.gender === g && styles.genderBtnActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={g === 'male' ? 'male-outline' : 'female-outline'}
                      size={18}
                      color={form.gender === g ? Colors.white : Colors.textSecondary}
                    />
                    <Text style={[
                      styles.genderBtnText,
                      form.gender === g && styles.genderBtnTextActive,
                    ]}>
                      {g === 'male' ? t.male : t.female}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <PrimaryButton
              title={saving ? (t.saving || 'Saving…') : t.save || 'Save'}
              onPress={handleSave}
              style={styles.saveBtn}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Language Modal ─────────────────────────────────────────────────────────────

function LanguageModal({
  visible, onClose, isRTL, t, onSelect,
}: {
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
          <View style={styles.modalIconWrap}>
            <Ionicons name="language-outline" size={32} color="#4CAF82" />
          </View>
          <Text style={styles.modalTitle}>{t.language}</Text>
          <Text style={styles.modalBody}>{t.selectLanguage || 'Choose your preferred language'}</Text>

          <View style={{ width: '100%', gap: 10, marginBottom: Spacing.xl }}>
            {langs.map(lang => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => { onSelect(lang.code); onClose(); }}
                style={[
                  styles.langOption,
                  (isRTL ? lang.code === 'ar' : lang.code === 'en') && styles.langOptionActive,
                ]}
                activeOpacity={0.8}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.langName}>{lang.label}</Text>
                  <Text style={styles.langNative}>{lang.native}</Text>
                </View>
                {(isRTL ? lang.code === 'ar' : lang.code === 'en') && (
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

// ─── Notifications Modal ────────────────────────────────────────────────────────

function NotificationsModal({
  visible, onClose, t, isRTL,
}: {
  visible: boolean; onClose: () => void; t: any; isRTL: boolean;
}) {
  const [pushEnabled,  setPushEnabled]  = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [reminders,    setReminders]    = useState(true);
  const [updates,      setUpdates]      = useState(true);

  const rows = [
    { label: t.pushNotifications  || 'Push Notifications',  value: pushEnabled,  set: setPushEnabled  },
    { label: t.emailNotifications || 'Email Notifications', value: emailEnabled, set: setEmailEnabled },
    { label: t.reminders          || 'Reminders',           value: reminders,    set: setReminders    },
    { label: t.appUpdates         || 'App Updates',          value: updates,      set: setUpdates      },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.slideModalSafe}>
        <View style={styles.slideModal}>
          <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t.notifications}</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={{ padding: Spacing.xl }}>
            <View style={styles.card}>
              {rows.map((row, i) => (
                <View key={i}>
                  <View style={[
                    styles.switchRow,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                  ]}>
                    <Switch
                      value={row.value}
                      onValueChange={row.set}
                      trackColor={{ false: Colors.divider, true: Colors.primary + '66' }}
                      thumbColor={row.value ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={[styles.switchLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                      {row.label}
                    </Text>
                  </View>
                  {i < rows.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
            <PrimaryButton title={t.save || 'Save'} onPress={onClose} style={{ marginTop: Spacing.base }} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Privacy Modal ──────────────────────────────────────────────────────────────

function PrivacyModal({
  visible, onClose, t, isRTL,
}: {
  visible: boolean; onClose: () => void; t: any; isRTL: boolean;
}) {
  const items = [
    { title: t.dataCollection || 'Data Collection',       desc: t.dataCollectionDesc || 'We collect minimal data to improve your experience.' },
    { title: t.dataSharing    || 'Data Sharing',          desc: t.dataSharingDesc    || 'We do not sell or share your personal data with third parties.' },
    { title: t.dataDeletion   || 'Delete My Data',        desc: t.dataDeletionDesc   || 'You can request full deletion of your account and data at any time.' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.slideModalSafe}>
        <View style={styles.slideModal}>
          <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t.privacy}</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: Spacing.xl }}>
            {items.map((item, i) => (
              <View key={i} style={styles.privacyItem}>
                <View style={styles.privacyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.privacyTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{item.title}</Text>
                  <Text style={[styles.privacyDesc,  { textAlign: isRTL ? 'right' : 'left' }]}>{item.desc}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.deleteAccBtn} activeOpacity={0.8}
              onPress={() => Alert.alert(
                t.deleteAccount     || 'Delete Account',
                t.deleteAccountDesc || 'Are you sure? This action cannot be undone.',
                [{ text: t.cancel || 'Cancel' }, { text: t.confirm || 'Confirm', style: 'destructive' }],
              )}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              <Text style={styles.deleteAccText}>{t.deleteAccount || 'Delete Account'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Help Modal ─────────────────────────────────────────────────────────────────

function HelpModal({
  visible, onClose, t, isRTL,
}: {
  visible: boolean; onClose: () => void; t: any; isRTL: boolean;
}) {
  const faqs = [
    { q: t.faq1q || 'How do I update my profile?',   a: t.faq1a || 'Go to More → Edit Profile and update your information.' },
    { q: t.faq2q || 'How do I change the language?', a: t.faq2a || 'Go to More → Language and select your preferred language.' },
    { q: t.faq3q || 'How do I contact support?',     a: t.faq3a || 'Email us at support@rahati.app and we\'ll reply within 24 hours.' },
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
                  <TouchableOpacity
                    onPress={() => setExpanded(expanded === i ? null : i)}
                    style={[styles.faqRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={expanded === i ? 'chevron-up' : (isRTL ? 'chevron-back' : 'chevron-forward')}
                      size={16} color={Colors.textMuted}
                    />
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

// ─── Main Screen ────────────────────────────────────────────────────────────────

type ModalKey = 'logout' | 'editProfile' | 'language' | 'notifications' | 'privacy' | 'help' | null;

export default function MoreScreen() {
  // ✅ FIXED: updateUser → updateProfile
  const { user, logout, updateProfile } = useAuth();
  // ✅ FIXED: setLanguage → setLang
  const { t, isRTL, setLang } = useLang();
  const [activeModal, setActiveModal] = useState<ModalKey>(null);

  const open  = (key: ModalKey) => setActiveModal(key);
  const close = ()              => setActiveModal(null);

  const handleSaveProfile = async (data: UserFields) => {
    // ✅ FIXED: updateUser → updateProfile
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
    // ✅ FIXED: setLanguage → setLang
    setLang(lang);
  };

  const MENU = [
    { key: 'editProfile',    icon: 'person-outline',       label: t.editProfile,   color: Colors.primary },
    { key: 'notifications',  icon: 'notifications-outline', label: t.notifications, color: '#F4A32B'      },
    { key: 'language',       icon: 'language-outline',      label: t.language,      color: '#4CAF82', value: isRTL ? 'عربي' : 'English' },
    { key: 'privacy',        icon: 'lock-closed-outline',   label: t.privacy,       color: '#5B9BD5' },
    { key: 'help',           icon: 'help-circle-outline',   label: t.help,          color: '#29B6D4' },
  ];

  const initials = user
    ? `${(user.firstName || '?')[0]}${(user.lastName || '?')[0]}`.toUpperCase()
    : '?';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <RahatiLogo />
          <Text style={styles.pageTitle}>{t.profile}</Text>
        </View>

        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <TouchableOpacity style={styles.editBtn} onPress={() => open('editProfile')}>
            <Ionicons name="pencil" size={16} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.avatarName}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
        </View>

        {/* Account Info */}
        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.accountInfo}</Text>
        <TouchableOpacity activeOpacity={0.9} onPress={() => open('editProfile')}>
          <View style={styles.card}>
            <InfoRow label={t.firstName} value={user?.firstName || ''} isRTL={isRTL} />
            <View style={styles.divider} />
            <InfoRow label={t.lastName}  value={user?.lastName  || ''} isRTL={isRTL} />
            <View style={styles.divider} />
            <InfoRow label={t.email}     value={user?.email     || ''} isRTL={isRTL} />
            <View style={styles.divider} />
            <InfoRow label={t.age}       value={user?.age ? `${user.age} ${t.years}` : ''} isRTL={isRTL} />
            <View style={styles.divider} />
            <InfoRow
              label={t.gender}
              value={user?.gender === 'male' ? t.male : user?.gender === 'female' ? t.female : ''}
              isRTL={isRTL}
            />
          </View>
        </TouchableOpacity>

        {/* Settings */}
        <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.settings}</Text>
        <View style={styles.card}>
          {MENU.map((item, i) => (
            <MenuRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              value={'value' in item ? item.value : undefined}
              color={item.color}
              onPress={() => open(item.key as ModalKey)}
              isLast={i === MENU.length - 1}
              isRTL={isRTL}
            />
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={() => open('logout')}
          style={[styles.logoutBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>{t.logout}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>{t.version}</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Modals ── */}

      <EditProfileModal
        visible={activeModal === 'editProfile'}
        onClose={close}
        user={user}
        onSave={handleSaveProfile}
        t={t}
        isRTL={isRTL}
      />

      <LanguageModal
        visible={activeModal === 'language'}
        onClose={close}
        isRTL={isRTL}
        t={t}
        onSelect={handleLanguageSelect}
      />

      <NotificationsModal
        visible={activeModal === 'notifications'}
        onClose={close}
        t={t}
        isRTL={isRTL}
      />

      <PrivacyModal
        visible={activeModal === 'privacy'}
        onClose={close}
        t={t}
        isRTL={isRTL}
      />

      <HelpModal
        visible={activeModal === 'help'}
        onClose={close}
        t={t}
        isRTL={isRTL}
      />

      {/* Logout Confirmation */}
      <Modal
        visible={activeModal === 'logout'}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={32} color={Colors.danger} />
            </View>
            <Text style={styles.modalTitle}>{t.logout}</Text>
            <Text style={styles.modalBody}>{t.logoutConfirm}</Text>
            <View style={styles.modalBtns}>
              <OutlineButton title={t.cancel}  onPress={close}                                                                       style={{ flex: 1 }} />
              <PrimaryButton title={t.confirm} onPress={() => { close(); logout(); router.replace('/auth/sign-in'); }} style={{ flex: 1, backgroundColor: Colors.danger }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl },

  // Top bar
  topBar:    { alignItems: 'center', gap: 12, marginBottom: Spacing.xl },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, flex: 1, textAlign: 'right' },

  // Avatar card
  avatarCard: {
    backgroundColor: Colors.primary, borderRadius: Radius.xxl, padding: Spacing.xl,
    alignItems: 'center', marginBottom: Spacing.xl,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 4, position: 'relative',
  },
  editBtn: {
    position: 'absolute', top: 14, left: 14, width: 32, height: 32,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarInitials: { fontSize: 26, fontWeight: '800', color: Colors.white },
  avatarName:     { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  avatarEmail:    { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)' },

  // Sections
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

  // Info rows
  infoRow:   { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 14 },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },

  // Menu rows
  menuRow:       { alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 14, gap: 12 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  menuIcon:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  menuLabel:     { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '500', textAlign: 'right' },
  menuValue:     { fontSize: FontSize.sm, color: Colors.textMuted },

  // Logout
  logoutBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.xl,
    paddingVertical: 16, marginBottom: Spacing.base,
  },
  logoutText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.danger },
  versionText: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted },

  // Overlay + modal card (logout, language)
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xxl,
    width: '100%', alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1, shadowRadius: 20, elevation: 8,
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.dangerLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  modalBody:  { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  modalBtns:  { flexDirection: 'row', gap: 12, width: '100%' },

  // Slide-up modal (edit profile, notifications, privacy, help)
  slideModalSafe: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  slideModal:     { backgroundColor: Colors.background, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, maxHeight: '92%' },
  modalHeader: {
    alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  modalCloseBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.divider, alignItems: 'center', justifyContent: 'center' },
  modalHeaderTitle:{ flex: 1, fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },

  // Edit profile form
  editFormContent: { padding: Spacing.xl, paddingBottom: 40 },
  fieldWrap:   { marginBottom: Spacing.base },
  fieldLabel:  { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput:  {
    backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: Spacing.base,
    paddingVertical: 12, fontSize: FontSize.base, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.divider,
  },
  genderRow:   { gap: 10 },
  genderBtn:   {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.divider,
    paddingVertical: 12, backgroundColor: Colors.white,
  },
  genderBtnActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  genderBtnText:       { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: '600' },
  genderBtnTextActive: { color: Colors.white },
  saveBtn: { marginTop: Spacing.xl },

  // Language options
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.base, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.white,
  },
  langOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '0A' },
  langFlag:   { fontSize: 28 },
  langName:   { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  langNative: { fontSize: FontSize.sm, color: Colors.textMuted },

  // Notifications switches
  switchRow:  { alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 14, gap: 12 },
  switchLabel:{ flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '500' },

  // Privacy
  privacyItem:  { flexDirection: 'row', gap: 12, marginBottom: Spacing.xl, alignItems: 'flex-start' },
  privacyDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginTop: 5 },
  privacyTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  privacyDesc:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  deleteAccBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.xl, paddingVertical: 14,
  },
  deleteAccText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.danger },

  // Help / FAQ
  faqRow: { alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 14, gap: 10 },
  faqQ:   { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  faqA:   {
    fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20,
    paddingHorizontal: Spacing.base, paddingBottom: 14,
  },
});