// app/(tabs)/more.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { PrimaryButton, OutlineButton } from '../../components/UI';
import RahatiLogo from '../../components/RahatiLogo';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

function InfoRow({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return (
    <View style={[styles.infoRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={styles.infoValue}>{value || '—'}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, value, color, onPress, isLast, isRTL }: { icon: string; label: string; value?: string; color: string; onPress: () => void; isLast: boolean; isRTL: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={[styles.menuRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }, !isLast && styles.menuRowBorder]}>
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={Colors.textMuted} />
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={[styles.menuIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { t, isRTL } = useLang();
  const [logoutModal, setLogoutModal] = useState(false);

  const MENU = [
    { key: 'edit',  icon: 'person-outline',       label: t.editProfile,    color: Colors.primary },
    { key: 'notif', icon: 'notifications-outline', label: t.notifications,  color: '#F4A32B'      },
    { key: 'lang',  icon: 'language-outline',      label: t.language,       color: '#4CAF82', value: isRTL ? 'عربي' : 'English' },
    { key: 'priv',  icon: 'lock-closed-outline',   label: t.privacy,        color: '#5B9BD5' },
    { key: 'help',  icon: 'help-circle-outline',   label: t.help,           color: '#29B6D4' },
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

        {/* Avatar */}
        <View style={styles.avatarCard}>
          <TouchableOpacity style={styles.editBtn}>
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
        <View style={styles.card}>
          <InfoRow label={t.firstName} value={user?.firstName || ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.lastName} value={user?.lastName || ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.email} value={user?.email || ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.age} value={user?.age ? `${user.age} ${t.years}` : ''} isRTL={isRTL} />
          <View style={styles.divider} />
          <InfoRow label={t.gender} value={user?.gender === 'male' ? t.male : user?.gender === 'female' ? t.female : ''} isRTL={isRTL} />
        </View>

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
              onPress={() => {}}
              isLast={i === MENU.length - 1}
              isRTL={isRTL}
            />
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={() => setLogoutModal(true)} style={[styles.logoutBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>{t.logout}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>{t.version}</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Logout Modal */}
      <Modal visible={logoutModal} transparent animationType="fade" onRequestClose={() => setLogoutModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={32} color={Colors.danger} />
            </View>
            <Text style={styles.modalTitle}>{t.logout}</Text>
            <Text style={styles.modalBody}>{t.logoutConfirm}</Text>
            <View style={styles.modalBtns}>
              <OutlineButton title={t.cancel} onPress={() => setLogoutModal(false)} style={{ flex: 1 }} />
              <PrimaryButton title={t.confirm} onPress={() => { setLogoutModal(false); logout(); router.replace('/auth/sign-in'); }} style={{ flex: 1, backgroundColor: Colors.danger }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl },
  topBar: { alignItems: 'center', gap: 12, marginBottom: Spacing.xl },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  avatarCard: { backgroundColor: Colors.primary, borderRadius: Radius.xxl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.xl, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4, position: 'relative' },
  editBtn: { position: 'absolute', top: 14, left: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarInitials: { fontSize: 26, fontWeight: '800', color: Colors.white },
  avatarName: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  avatarEmail: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)' },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xl, marginBottom: Spacing.xl, overflow: 'hidden', shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  divider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: Spacing.base },
  infoRow: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 14 },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  menuRow: { alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 14, gap: 12 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  menuIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '500', textAlign: 'right' },
  menuValue: { fontSize: FontSize.sm, color: Colors.textMuted },
  logoutBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.dangerLight, borderRadius: Radius.xl, paddingVertical: 16, marginBottom: Spacing.base },
  logoutText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.danger },
  versionText: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  modalCard: { backgroundColor: Colors.white, borderRadius: Radius.xxl, padding: Spacing.xxl, width: '100%', alignItems: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 20, elevation: 8 },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  modalBody: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
});