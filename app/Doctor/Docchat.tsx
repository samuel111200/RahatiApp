import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, TextInput, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';

// ─── Constants ────────────────────────────────────────────
const DOC_COLOR       = '#1A7EBD';
const DOC_COLOR_LIGHT = '#EAF4FB';

// ─── Types ────────────────────────────────────────────────
type ChatPreview = {
  patientId: string;
  patientName: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageSender: 'doctor' | 'patient';
  unreadCount: number;
  isOnline: boolean;
  status: 'read' | 'delivered' | 'sent';
};

// ─── Mock Data ────────────────────────────────────────────
const MOCK_CHATS: ChatPreview[] = [
  {
    patientId: 'p1',
    patientName: 'أحمد محمد علي',
    lastMessage: 'حسناً، ده غالباً من الجلوس الطويل. حاول تمشي كل ساعة',
    lastMessageTime: '10:26 ص',
    lastMessageSender: 'doctor',
    unreadCount: 0,
    isOnline: true,
    status: 'read',
  },
  {
    patientId: 'p2',
    patientName: 'فاطمة حسن إبراهيم',
    lastMessage: 'عندي ألم في الرأس من الصباح وما قدرت أنام',
    lastMessageTime: 'أمس',
    lastMessageSender: 'patient',
    unreadCount: 3,
    isOnline: false,
    status: 'delivered',
  },
  {
    patientId: 'p3',
    patientName: 'محمود عبد الله',
    lastMessage: 'تمام يا دكتور، هاخد الدواء زي ما قلت',
    lastMessageTime: 'الثلاثاء',
    lastMessageSender: 'patient',
    unreadCount: 0,
    isOnline: false,
    status: 'read',
  },
  {
    patientId: 'p4',
    patientName: 'نورا سعيد',
    lastMessage: 'هل لازم أجي للعيادة ولا ممكن يكون عن بُعد؟',
    lastMessageTime: 'الاثنين',
    lastMessageSender: 'patient',
    unreadCount: 1,
    isOnline: true,
    status: 'delivered',
  },
  {
    patientId: 'p5',
    patientName: 'خالد إبراهيم مصطفى',
    lastMessage: 'شكراً جزيلاً دكتور، ربنا يسلمك',
    lastMessageTime: '12/5',
    lastMessageSender: 'patient',
    unreadCount: 0,
    isOnline: false,
    status: 'read',
  },
];

// ─── Helpers ──────────────────────────────────────────────
function getInitials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─── Chat Row Item ────────────────────────────────────────
function ChatItem({
  item,
  index,
  onPress,
}: {
  item: ChatPreview;
  index: number;
  onPress: () => void;
}) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0, tension: 100, friction: 10, delay: index * 60, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const hasUnread = item.unreadCount > 0;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        style={[styles.chatRow, hasUnread && styles.chatRowUnread]}
        activeOpacity={0.75}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, hasUnread && styles.avatarActive]}>
            <Text style={styles.avatarText}>{getInitials(item.patientName)}</Text>
          </View>
          {item.isOnline && <View style={styles.onlineBadge} />}
        </View>

        {/* Content */}
        <View style={styles.chatContent}>
          <View style={styles.chatTopRow}>
            <Text style={[styles.patientName, hasUnread && styles.patientNameBold]} numberOfLines={1}>
              {item.patientName}
            </Text>
            <Text style={[styles.timeText, hasUnread && styles.timeTextActive]}>
              {item.lastMessageTime}
            </Text>
          </View>

          <View style={styles.chatBottomRow}>
            <View style={styles.lastMsgWrap}>
              {item.lastMessageSender === 'doctor' && (
                <Ionicons
                  name={item.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'}
                  size={14}
                  color={item.status === 'read' ? DOC_COLOR : Colors.textMuted}
                  style={{ marginEnd: 3 }}
                />
              )}
              <Text
                style={[styles.lastMsg, hasUnread && styles.lastMsgBold]}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
            </View>

            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty State ─────────────────────────────────────────
function EmptyChats() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="chatbubbles-outline" size={48} color={DOC_COLOR} />
      </View>
      <Text style={styles.emptyTitle}>لا توجد محادثات بعد</Text>
      <Text style={styles.emptySubtitle}>
        المحادثات ستظهر هنا فقط للمرضى الذين قبلت طلباتهم
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function ChatsListScreen() {
  const { isRTL } = useLang();
  const [search, setSearch] = useState('');

  const filtered = MOCK_CHATS.filter(c =>
    c.patientName.includes(search) || c.lastMessage.includes(search)
  );

  const totalUnread = MOCK_CHATS.reduce((sum, c) => sum + c.unreadCount, 0);

  const handleOpenChat = (item: ChatPreview) => {
    router.push({
      pathname: '/Doctor/Docpatient',
      params: { patientId: item.patientId, patientName: item.patientName },
    });
  };

  return (
    // ✅ SafeAreaView بدون أي padding إضافي — مفيش tab bar هنا
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor="#F0F7FC" barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={DOC_COLOR} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>المحادثات</Text>
          {totalUnread > 0 && (
            <Text style={styles.headerSub}>{totalUnread} رسالة غير مقروءة</Text>
          )}
        </View>
        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={22} color={DOC_COLOR} />
        </TouchableOpacity>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث في المحادثات..."
          placeholderTextColor={Colors.textMuted}
          style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Notice ── */}
      <View style={styles.noticeBanner}>
        <Ionicons name="information-circle-outline" size={15} color={DOC_COLOR} />
        <Text style={styles.noticeText}>
          تظهر هنا محادثات المرضى المقبولين فقط
        </Text>
      </View>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.patientId}
        renderItem={({ item, index }) => (
          <ChatItem item={item} index={index} onPress={() => handleOpenChat(item)} />
        )}
        ListEmptyComponent={<EmptyChats />}
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  // ✅ SafeAreaView بدون padding إضافي — مفيش tab bar
  safe: { flex: 1, backgroundColor: '#F0F7FC' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#EAF4FB',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0D2B3E' },
  headerSub:   { fontSize: 12, color: DOC_COLOR, fontWeight: '600', marginTop: 2 },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: Spacing.base, marginTop: 12, marginBottom: 6,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#D6EAF8',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  searchIcon:  { marginEnd: 8 },
  searchInput: { flex: 1, fontSize: FontSize.base, color: '#0D2B3E', padding: 0 },

  // Notice banner
  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.base, marginBottom: 10,
    backgroundColor: DOC_COLOR_LIGHT,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: DOC_COLOR + '25',
  },
  noticeText: { fontSize: 12, color: DOC_COLOR, fontWeight: '500', flex: 1 },

  // Chat Row
  chatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.base, paddingVertical: 13,
    backgroundColor: '#fff',
  },
  chatRowUnread: { backgroundColor: '#F5FBFF' },

  // Avatar
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: DOC_COLOR + '30',
  },
  avatarActive: { borderColor: DOC_COLOR + '70' },
  avatarText: { fontSize: 17, fontWeight: '800', color: DOC_COLOR },
  onlineBadge: {
    position: 'absolute', bottom: 2, end: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#4CAF82',
    borderWidth: 2, borderColor: '#fff',
  },

  // Content
  chatContent: { flex: 1 },
  chatTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  patientName:     { fontSize: FontSize.base, fontWeight: '600', color: '#0D2B3E', flex: 1, marginEnd: 6 },
  patientNameBold: { fontWeight: '800' },

  timeText:       { fontSize: 11, color: Colors.textMuted },
  timeTextActive: { color: DOC_COLOR, fontWeight: '700' },

  lastMsgWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginEnd: 8 },
  lastMsg:     { fontSize: 13, color: Colors.textMuted, flex: 1 },
  lastMsgBold: { color: '#0D2B3E', fontWeight: '600' },

  // Unread badge
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: DOC_COLOR,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { fontSize: 11, color: '#fff', fontWeight: '800' },

  // Separator
  separator: { height: 1, backgroundColor: '#EAF4FB', marginStart: 78 },

  // Empty state
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2, borderColor: DOC_COLOR + '25',
  },
  emptyTitle:    { fontSize: 18, fontWeight: '800', color: '#0D2B3E', marginBottom: 10, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});