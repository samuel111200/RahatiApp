// app/(tabs)/notifications.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, RefreshControl, Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppNotification,
  markAllRead,
  clearAllNotifications,
} from './notificationService';

const { width } = Dimensions.get('window');

// ─── Helpers ─────────────────────────────────────────────
function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 1)    return 'الآن';
  if (mins < 60)   return `منذ ${mins} دقيقة`;
  if (hours < 24)  return `منذ ${hours} ساعة`;
  return `منذ ${days} يوم`;
}

function formatFullTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} — ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TYPE_COLORS: Record<AppNotification['type'], string> = {
  task:   '#5B9BD5',
  break:  '#7C5CBF',
  energy: '#F5A623',
  add:    '#4CAF82',
  delete: '#E05C5C',
  update: '#C97B3A',
};

const TYPE_BG: Record<AppNotification['type'], string> = {
  task:   '#E8F1FB',
  break:  '#EDE6F8',
  energy: '#FEF3E2',
  add:    '#E8F5EF',
  delete: '#FDEAEA',
  update: '#FEF3E2',
};

const TYPE_LABEL_AR: Record<AppNotification['type'], string> = {
  task:   'مهمة',
  break:  'استراحة',
  energy: 'طاقة',
  add:    'إضافة',
  delete: 'حذف',
  update: 'تحديث',
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
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  title: { fontSize: 13, fontWeight: '700' },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  line:      { flex: 1, height: 1 },
});

// ─── Notification Detail Modal ───────────────────────────
function NotifDetailModal({
  notif,
  visible,
  onClose,
}: {
  notif: AppNotification | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!notif) return null;

  const color = TYPE_COLORS[notif.type];
  const bg    = TYPE_BG[notif.type];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={detailStyles.overlay}>
        <TouchableOpacity style={detailStyles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[detailStyles.card, { borderTopColor: color, borderTopWidth: 5 }]}>

          {/* Header */}
          <View style={detailStyles.header}>
            <View style={[detailStyles.emojiBox, { backgroundColor: bg }]}>
              <Text style={detailStyles.emojiText}>{notif.emoji}</Text>
            </View>
            <TouchableOpacity style={detailStyles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#aaa" />
            </TouchableOpacity>
          </View>

          {/* Type badge */}
          <View style={[detailStyles.typeBadge, { backgroundColor: color + '18' }]}>
            <View style={[detailStyles.typeDot, { backgroundColor: color }]} />
            <Text style={[detailStyles.typeText, { color }]}>
              {TYPE_LABEL_AR[notif.type]}
            </Text>
          </View>

          {/* Title */}
          <Text style={[detailStyles.title, { color }]}>{notif.title}</Text>

          {/* Body */}
          <Text style={detailStyles.body}>{notif.body}</Text>

          {/* Divider */}
          <View style={detailStyles.divider} />

          {/* Time */}
          <View style={detailStyles.timeRow}>
            <Ionicons name="time-outline" size={14} color="#bbb" />
            <Text style={detailStyles.timeText}>{formatFullTime(notif.timestamp)}</Text>
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={[detailStyles.doneBtn, { backgroundColor: color }]}
            onPress={onClose}
          >
            <Text style={detailStyles.doneBtnText}>حسناً 👍</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Notification Card ───────────────────────────────────
function NotifCard({
  notif,
  onPress,
}: {
  notif: AppNotification;
  onPress: (n: AppNotification) => void;
}) {
  const color = TYPE_COLORS[notif.type];
  const bg    = TYPE_BG[notif.type];

  return (
    <TouchableOpacity
      onPress={() => onPress(notif)}
      activeOpacity={0.8}
      style={[
        styles.card,
        { borderLeftColor: color, borderLeftWidth: 4 },
        !notif.read && styles.cardUnread,
      ]}
    >
      <View style={[styles.emojiWrap, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 22 }}>{notif.emoji}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardTitle, { color }]}>{notif.title}</Text>
          {!notif.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.cardMsg} numberOfLines={2}>{notif.body}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardTime}>{timeAgo(notif.timestamp)}</Text>
          <View style={styles.tapHint}>
            <Ionicons name="eye-outline" size={11} color="#bbb" />
            <Text style={styles.tapHintText}>اضغط للتفاصيل</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty State ─────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={{ fontSize: 60 }}>🔔</Text>
      <Text style={styles.emptyTitle}>مفيش إشعارات</Text>
      <Text style={styles.emptySubtitle}>هتظهر هنا لما يحصل أي تحديث في الأبليكيشن</Text>
    </View>
  );
}

// ─── Empty Section State ─────────────────────────────────
function EmptySectionState({ label }: { label: string }) {
  return (
    <View style={styles.emptySectionWrap}>
      <Text style={styles.emptySectionText}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────
export default function NotificationScreen() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [refreshing,    setRefreshing]    = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);
  const [showDetail,    setShowDetail]    = useState(false);

  const loadNotifications = async () => {
    const raw = await AsyncStorage.getItem('app_notifications');
    if (raw) setNotifications(JSON.parse(raw));
    else setNotifications([]);
  };

  useFocusEffect(useCallback(() => {
    loadNotifications();
    const timer = setTimeout(async () => {
      await markAllRead();
    }, 2000);
    return () => clearTimeout(timer);
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleClear = async () => {
    await clearAllNotifications();
    setNotifications([]);
  };

  const handlePressNotif = (notif: AppNotification) => {
    setSelectedNotif(notif);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedNotif(null);
  };

  // ── Split notifications ──
  const unreadNotifs = notifications.filter(n => !n.read);
  const readNotifs   = notifications.filter(n => n.read);
  const unreadCount  = unreadNotifs.length;

  return (
    <View style={styles.safe}>
      <StatusBar backgroundColor="#f8f5ff" barStyle="dark-content" translucent={false} />

      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color="#7C5CBF" />
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>الإشعارات</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.navBtn}>
            <Ionicons name="trash-outline" size={20} color="#E05C5C" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Summary ── */}
      {notifications.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {notifications.length} إشعار
            {unreadCount > 0 ? ` · ${unreadCount} غير مقروء` : ''}
            {' · اضغط على أي إشعار للتفاصيل'}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#7C5CBF']}
            tintColor="#7C5CBF"
          />
        }
      >
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Unread Section ── */}
            <SectionHeader
              title="غير مقروءة"
              count={unreadNotifs.length}
              color="#7C5CBF"
            />
            {unreadNotifs.length === 0 ? (
              <EmptySectionState label="كل الإشعارات اتقرأت ✅" />
            ) : (
              unreadNotifs.map(notif => (
                <NotifCard key={notif.id} notif={notif} onPress={handlePressNotif} />
              ))
            )}

            {/* ── Read Section ── */}
            {readNotifs.length > 0 && (
              <>
                <SectionHeader
                  title="تم قراءتها"
                  count={readNotifs.length}
                  color="#999"
                />
                {readNotifs.map(notif => (
                  <NotifCard key={notif.id} notif={notif} onPress={handlePressNotif} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Detail Modal ── */}
      <NotifDetailModal
        notif={selectedNotif}
        visible={showDetail}
        onClose={handleCloseDetail}
      />
    </View>
  );
}

// ─── Detail Modal Styles ──────────────────────────────────
const detailStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  card: {
    backgroundColor: '#fff', borderRadius: 24,
    padding: 24, width: width * 0.88,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
  },
  emojiBox: {
    width: 60, height: 60, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 30 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center', justifyContent: 'center',
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginBottom: 10,
  },
  typeDot:  { width: 7, height: 7, borderRadius: 4 },
  typeText: { fontSize: 12, fontWeight: '700' },
  title: {
    fontSize: 18, fontWeight: '800',
    marginBottom: 8, textAlign: 'right',
  },
  body: {
    fontSize: 14, color: '#555', lineHeight: 22,
    textAlign: 'right', marginBottom: 16,
  },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  timeText: { fontSize: 12, color: '#bbb' },
  doneBtn: {
    borderRadius: 14, paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ─── Main Styles ─────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8f5ff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f5ff',
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  navCenter: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  navTitle:  { fontSize: 18, fontWeight: '700', color: '#2d2d2d' },
  badge: {
    backgroundColor: '#E05C5C', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    minWidth: 20, alignItems: 'center',
  },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  summary: { paddingHorizontal: 20, paddingBottom: 8 },
  summaryText: { fontSize: 12, color: '#999' },

  scroll: { padding: 16, paddingBottom: 100 },

  card: {
    flexDirection: 'row',
    backgroundColor: '#fff', borderRadius: 16,
    padding: 14, marginBottom: 12, alignItems: 'flex-start',
    shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardUnread: { backgroundColor: '#faf7ff' },
  emojiWrap: {
    width: 46, height: 46, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardBody:   { flex: 1 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:  { fontSize: 14, fontWeight: '700', flex: 1 },
  unreadDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C5CBF', marginLeft: 8 },
  cardMsg:    { fontSize: 13, color: '#555', lineHeight: 20 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  cardTime:   { fontSize: 11, color: '#bbb' },
  tapHint:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tapHintText:{ fontSize: 10, color: '#ccc' },

  emptyWrap:     { alignItems: 'center', paddingTop: 100, gap: 14 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: '#333' },
  emptySubtitle: { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 22, paddingHorizontal: 40 },

  emptySectionWrap: {
    alignItems: 'center', paddingVertical: 20,
    backgroundColor: '#fff', borderRadius: 14,
    marginBottom: 12, borderWidth: 1,
    borderColor: '#f0f0f0', borderStyle: 'dashed',
  },
  emptySectionText: { fontSize: 13, color: '#bbb' },
});