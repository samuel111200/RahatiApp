// app/Doctor/DocNotif.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, RefreshControl, Modal, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import { AppNotification, markAllRead, clearAllNotifications } from '../tabs/notificationService';

const { width } = Dimensions.get('window');
const DOC_COLOR       = Colors.primary;
const DOC_COLOR_LIGHT = Colors.primaryUltraLight;

// ─── Type for translations ────────────────────────────────
type Translations = ReturnType<typeof useLang>['t'];

// ─── Helpers ─────────────────────────────────────────────
function timeAgo(timestamp: number, isRTL: boolean): string {
  const diff  = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (isRTL) {
    if (mins < 1)  return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
  } else {
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
}

function formatFullTime(timestamp: number): string {
  const d   = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} — ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TYPE_COLORS: Record<AppNotification['type'], string> = {
  task:   Colors.info,
  break:  DOC_COLOR,
  energy: Colors.warning,
  add:    Colors.success,
  delete: Colors.danger,
  update: '#C97B3A',
};

const TYPE_BG: Record<AppNotification['type'], string> = {
  task:   Colors.infoLight,
  break:  DOC_COLOR_LIGHT,
  energy: Colors.warningLight,
  add:    Colors.successLight,
  delete: Colors.dangerLight,
  update: Colors.warningLight,
};

// ─── Section Header ───────────────────────────────────────
function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <View style={sectionStyles.container}>
      <View style={[sectionStyles.pill, { backgroundColor: color + '18' }]}>
        <View style={[sectionStyles.dot, { backgroundColor: color }]} />
        <Text style={[sectionStyles.title, { color }]}>{title}</Text>
        <View style={[sectionStyles.badge, { backgroundColor: color }]}>
          <Text style={sectionStyles.badgeText}>{count}</Text>
        </View>
      </View>
      <View style={[sectionStyles.line, { backgroundColor: color + '30' }]} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 8, gap: 10 },
  pill:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dot:       { width: 7, height: 7, borderRadius: 4 },
  title:     { fontSize: 13, fontWeight: '700' },
  badge:     { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  line:      { flex: 1, height: 1 },
});

// ─── Detail Modal ─────────────────────────────────────────
function NotifDetailModal({ notif, visible, onClose, isRTL, t }: {
  notif: AppNotification | null;
  visible: boolean;
  onClose: () => void;
  isRTL: boolean;
  t: Translations;
}) {
  if (!notif) return null;
  const color = TYPE_COLORS[notif.type];
  const bg    = TYPE_BG[notif.type];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={detailStyles.overlay}>
        <TouchableOpacity style={detailStyles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[detailStyles.card, { borderTopColor: color, borderTopWidth: 5 }]}>
          <View style={detailStyles.header}>
            <View style={[detailStyles.emojiBox, { backgroundColor: bg }]}>
              <Text style={detailStyles.emojiText}>{notif.emoji}</Text>
            </View>
            <TouchableOpacity style={detailStyles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#aaa" />
            </TouchableOpacity>
          </View>
          <Text style={[detailStyles.title, { color, textAlign: isRTL ? 'right' : 'left' }]}>{notif.title}</Text>
          <Text style={[detailStyles.body, { textAlign: isRTL ? 'right' : 'left' }]}>{notif.body}</Text>
          <View style={detailStyles.divider} />
          <View style={detailStyles.timeRow}>
            <Ionicons name="time-outline" size={14} color="#bbb" />
            <Text style={detailStyles.timeText}>{formatFullTime(notif.timestamp)}</Text>
          </View>
          <TouchableOpacity style={[detailStyles.doneBtn, { backgroundColor: color }]} onPress={onClose}>
            <Text style={detailStyles.doneBtnText}>{t.okBtn}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdrop:   { ...StyleSheet.absoluteFillObject },
  card:       { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: width * 0.88, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 12 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  emojiBox:   { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emojiText:  { fontSize: 30 },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  body:       { fontSize: 14, color: '#555', lineHeight: 22, marginBottom: 16 },
  divider:    { height: 1, backgroundColor: '#f0f0f0', marginBottom: 12 },
  timeRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  timeText:   { fontSize: 12, color: '#bbb' },
  doneBtn:    { borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  doneBtnText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ─── Notification Card ───────────────────────────────────
function NotifCard({ notif, onPress, isRTL }: { notif: AppNotification; onPress: (n: AppNotification) => void; isRTL: boolean }) {
  const color = TYPE_COLORS[notif.type];
  const bg    = TYPE_BG[notif.type];

  return (
    <TouchableOpacity
      onPress={() => onPress(notif)} activeOpacity={0.8}
      style={[
        styles.card,
        { borderLeftColor: isRTL ? 'transparent' : color, borderLeftWidth: isRTL ? 0 : 4,
          borderRightColor: isRTL ? color : 'transparent', borderRightWidth: isRTL ? 4 : 0 },
        !notif.read && styles.cardUnread,
      ]}
    >
      <View style={[styles.emojiWrap, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 22 }}>{notif.emoji}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={[styles.cardTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.cardTitle, { color, textAlign: isRTL ? 'right' : 'left' }]}>{notif.title}</Text>
          {!notif.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={[styles.cardMsg, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>{notif.body}</Text>
        <View style={[styles.cardFooter, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={styles.cardTime}>{timeAgo(notif.timestamp, isRTL)}</Text>
          <View style={[styles.tapHint, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="eye-outline" size={11} color="#bbb" />
            <Text style={styles.tapHintText}>{isRTL ? 'اضغط للتفاصيل' : 'Tap for details'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty State ─────────────────────────────────────────
function EmptyState({ t, isRTL }: { t: Translations; isRTL: boolean }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={{ fontSize: 60 }}>🔔</Text>
      <Text style={styles.emptyTitle}>{t.docNoNotifs}</Text>
      <Text style={[styles.emptySubtitle, { textAlign: 'center' }]}>{t.docNoNotifsSubtitle}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────
export default function DocNotifScreen() {
  const { isRTL, t } = useLang();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [refreshing,    setRefreshing]    = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);
  const [showDetail,    setShowDetail]    = useState(false);

  const loadNotifications = async () => {
    const raw = await AsyncStorage.getItem('doc_notifications');
    if (raw) {
      setNotifications(JSON.parse(raw));
    } else {
      // إنشاء إشعارات تجريبية للدكتور عند أول تشغيل
      const demo: AppNotification[] = [
        { id: 'dn1', title: t.docNotifNewRequest,      body: `${isRTL ? 'محمد حسن' : 'Mohamed Hassan'} ${isRTL ? 'أرسل طلب انضمام' : 'sent a join request'}`,      emoji: '🆕', type: 'add',    timestamp: Date.now() - 600000,   read: false },
        { id: 'dn2', title: t.docNotifRequestAccepted, body: `${isRTL ? 'سارة علي' : 'Sara Ali'} ${isRTL ? 'اتقبلت بنجاح' : 'was accepted successfully'}`,           emoji: '✅', type: 'update', timestamp: Date.now() - 3600000,  read: false },
        { id: 'dn3', title: t.docNotifNewMessage,      body: `${isRTL ? 'أحمد: كيف حالك يا دكتور؟' : 'Ahmed: How are you doctor?'}`,                                 emoji: '💬', type: 'task',   timestamp: Date.now() - 7200000,  read: true  },
        { id: 'dn4', title: t.docNotifExerciseAssigned,body: `${isRTL ? 'تمرين مشي مُعيَّن لفاطمة' : 'Walking exercise assigned to Fatima'}`,                         emoji: '🏋️', type: 'break',  timestamp: Date.now() - 86400000, read: true  },
      ];
      await AsyncStorage.setItem('doc_notifications', JSON.stringify(demo));
      setNotifications(demo);
    }
  };

  useFocusEffect(useCallback(() => {
    loadNotifications();
    const timer = setTimeout(async () => {
      const raw = await AsyncStorage.getItem('doc_notifications');
      if (raw) {
        const list: AppNotification[] = JSON.parse(raw);
        const updated = list.map(n => ({ ...n, read: true }));
        await AsyncStorage.setItem('doc_notifications', JSON.stringify(updated));
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isRTL]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleClear = async () => {
    await AsyncStorage.removeItem('doc_notifications');
    setNotifications([]);
  };

  const unreadNotifs = notifications.filter(n => !n.read);
  const readNotifs   = notifications.filter(n =>  n.read);

  return (
    <View style={styles.safe}>
      <StatusBar backgroundColor={Colors.background} barStyle="dark-content" translucent={false} />

      {/* ── Navbar ── */}
      <View style={[styles.navbar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={DOC_COLOR} />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>{t.docNotificationsTitle}</Text>
          {unreadNotifs.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadNotifs.length}</Text>
            </View>
          )}
        </View>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.navBtn}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {notifications.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {notifications.length} {isRTL ? 'إشعار' : 'notifications'}
            {unreadNotifs.length > 0 ? ` · ${unreadNotifs.length} ${isRTL ? 'غير مقروء' : 'unread'}` : ''}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[DOC_COLOR]} tintColor={DOC_COLOR} />}
      >
        {notifications.length === 0 ? (
          <EmptyState t={t} isRTL={isRTL} />
        ) : (
          <>
            <SectionHeader title={t.docNotifUnread} count={unreadNotifs.length} color={DOC_COLOR} />
            {unreadNotifs.length === 0 ? (
              <View style={styles.emptySectionWrap}>
                <Text style={styles.emptySectionText}>{t.allRead}</Text>
              </View>
            ) : (
              unreadNotifs.map(notif => (
                <NotifCard
                  key={notif.id} notif={notif}
                  onPress={n => { setSelectedNotif(n); setShowDetail(true); }}
                  isRTL={isRTL}
                />
              ))
            )}
            {readNotifs.length > 0 && (
              <>
                <SectionHeader title={t.docNotifRead} count={readNotifs.length} color={Colors.textMuted} />
                {readNotifs.map(notif => (
                  <NotifCard
                    key={notif.id} notif={notif}
                    onPress={n => { setSelectedNotif(n); setShowDetail(true); }}
                    isRTL={isRTL}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <NotifDetailModal
        notif={selectedNotif} visible={showDetail}
        onClose={() => { setShowDetail(false); setSelectedNotif(null); }}
        isRTL={isRTL} t={t}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  navbar:     { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.background },
  navBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  navCenter:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  navTitle:   { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  badge:      { backgroundColor: Colors.danger, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  badgeText:  { fontSize: 11, color: '#fff', fontWeight: '700' },
  summary:    { paddingHorizontal: 20, paddingBottom: 8 },
  summaryText:{ fontSize: 12, color: Colors.textMuted },
  scroll:     { padding: 16, paddingBottom: 100 },
  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16,
    padding: 14, marginBottom: 12, alignItems: 'flex-start',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardUnread:       { backgroundColor: Colors.primaryUltraLight },
  emojiWrap:        { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardBody:         { flex: 1 },
  cardTop:          { alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:        { fontSize: 14, fontWeight: '700', flex: 1 },
  unreadDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: DOC_COLOR, marginLeft: 8 },
  cardMsg:          { fontSize: 13, color: '#555', lineHeight: 20 },
  cardFooter:       { alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  cardTime:         { fontSize: 11, color: '#bbb' },
  tapHint:          { alignItems: 'center', gap: 3 },
  tapHintText:      { fontSize: 10, color: '#ccc' },
  emptyWrap:        { alignItems: 'center', paddingTop: 100, gap: 14 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle:    { fontSize: 13, color: '#aaa', lineHeight: 22, paddingHorizontal: 40 },
  emptySectionWrap: { alignItems: 'center', paddingVertical: 20, backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  emptySectionText: { fontSize: 13, color: '#bbb' },
});