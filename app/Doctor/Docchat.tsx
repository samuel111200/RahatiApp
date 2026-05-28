import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import { usePathname } from 'expo-router';
import { notifyIncomingMessage } from './DocNotifService';

const DOC_COLOR       = '#7C5CBF';
const DOC_COLOR_LIGHT = '#F0EBFA';

// ─── DocTabBar ────────────────────────────────────────────
type TabItem = { label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; route: string; };
const TABS: TabItem[] = [
  { label: 'الرئيسية', icon: 'home-outline',       iconActive: 'home',        route: '/Doctor/Dochome' },
  { label: 'الشاتات',  icon: 'chatbubbles-outline', iconActive: 'chatbubbles', route: '/Doctor/Docchat' },
  { label: 'المزيد',   icon: 'grid-outline',         iconActive: 'grid',        route: '/Doctor/Docmore' },
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
  tab:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconWrap: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'transparent' },
  iconWrapActive: { backgroundColor: DOC_COLOR, shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 10, elevation: 6 },
  label:       { fontSize: 11, fontWeight: '600', color: '#B0BEC5' },
  labelActive: { color: DOC_COLOR, fontWeight: '700' },
});

type PatientStatus = 'pending' | 'accepted';
type Patient = {
  id: string; firstName: string; lastName: string;
  age?: string; gender?: string; avatar?: string;
  status: PatientStatus; requestedAt: string; acceptedAt?: string;
};

const STORAGE_KEY  = 'doc_patients';
const READ_KEY     = 'doc_chats_read';
const MESSAGES_KEY = 'doc_messages';

// ─── مفتاح لتتبع آخر رسايل المرضى (لمنع التكرار في الـ polling) ──
const CHAT_LAST_SEEN_KEY = 'doc_chat_last_seen';

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

type LastMsgStore = {
  [patientId: string]: {
    text: string;
    time: string;
    sender: 'doctor' | 'patient';
  };
};

type StoredMessage = {
  id: string;
  text: string;
  sender: 'doctor' | 'patient';
  time: string;
  status?: 'sent' | 'delivered' | 'read';
};

// ─── آخر ID شوفناه لكل مريض (لمنع الـ notification المكررة) ──
type LastSeenMap = { [patientId: string]: string };

function sortChats(list: ChatPreview[]): ChatPreview[] {
  return [...list].sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    if (b.isOnline    !== a.isOnline)    return b.isOnline ? 1 : -1;
    return 0;
  });
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function ChatItem({ item, index, onPress }: { item: ChatPreview; index: number; onPress: () => void }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 10, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const hasUnread = item.unreadCount > 0;

  const lastMsgDisplay = item.lastMessage
    ? item.lastMessage
    : 'ابدأ المحادثة الآن...';

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        style={[styles.chatRow, hasUnread && styles.chatRowUnread]}
        activeOpacity={0.75}
      >
        {hasUnread && <View style={styles.unreadBar} />}

        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, hasUnread && styles.avatarActive]}>
            <Text style={styles.avatarText}>{getInitials(item.patientName)}</Text>
          </View>
          {item.isOnline && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatTopRow}>
            <Text style={[styles.patientName, hasUnread && styles.patientNameBold]} numberOfLines={1}>
              {item.patientName}
            </Text>
            {!!item.lastMessageTime && (
              <Text style={[styles.timeText, hasUnread && styles.timeTextActive]}>
                {item.lastMessageTime}
              </Text>
            )}
          </View>

          <View style={styles.chatBottomRow}>
            <View style={styles.lastMsgWrap}>
              {item.lastMessageSender === 'doctor' && !!item.lastMessage && (
                <Ionicons
                  name={item.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'}
                  size={14}
                  color={item.status === 'read' ? DOC_COLOR : Colors.textMuted}
                  style={{ marginEnd: 3 }}
                />
              )}
              <Text
                style={[
                  styles.lastMsg,
                  hasUnread && styles.lastMsgBold,
                  !item.lastMessage && styles.lastMsgEmpty,
                ]}
                numberOfLines={1}
              >
                {lastMsgDisplay}
              </Text>
            </View>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyChats() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="chatbubbles-outline" size={48} color={DOC_COLOR} />
      </View>
      <Text style={styles.emptyTitle}>لا توجد محادثات بعد</Text>
      <Text style={styles.emptySubtitle}>المحادثات ستظهر هنا فقط للمرضى الذين قبلت طلباتهم</Text>
    </View>
  );
}

export default function ChatsListScreen() {
  const { isRTL } = useLang();
  const insets    = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [chats,  setChats]  = useState<ChatPreview[]>([]);

  // ─── آخر IDs المرضى اللي شوفناهم (لمنع notification مكررة) ──
  const lastSeenMapRef = useRef<LastSeenMap>({});

  // ─── تحميل وتحديث قائمة الشاتات ──────────────────────
  const loadAcceptedChats = useCallback(async () => {
    try {
      const raw      = await AsyncStorage.getItem(STORAGE_KEY);
      const patients: Patient[] = raw ? JSON.parse(raw) : [];
      const accepted = patients.filter(p => p.status === 'accepted');

      const readRaw  = await AsyncStorage.getItem(READ_KEY);
      const readSet: string[] = readRaw ? JSON.parse(readRaw) : [];

      const msgsRaw = await AsyncStorage.getItem(MESSAGES_KEY);
      const lastMsgs: LastMsgStore = msgsRaw ? JSON.parse(msgsRaw) : {};

      const enriched = await Promise.all(
        accepted.map(async (p) => {
          let last = lastMsgs[p.id];

          if (!last) {
            try {
              const chatRaw = await AsyncStorage.getItem(`doc_chat_${p.id}`);
              if (chatRaw) {
                const msgs: StoredMessage[] = JSON.parse(chatRaw);
                if (msgs.length > 0) {
                  const latestMsg = msgs[msgs.length - 1];
                  last = {
                    text:   latestMsg.text,
                    time:   latestMsg.time,
                    sender: latestMsg.sender,
                  };
                  lastMsgs[p.id] = last;
                }
              }
            } catch {}
          }

          // حساب الـ unread: رسايل المريض اللي مش اتقرأت
          let unreadCount = 0;
          try {
            const chatRaw = await AsyncStorage.getItem(`doc_chat_${p.id}`);
            if (chatRaw) {
              const msgs: StoredMessage[] = JSON.parse(chatRaw);
              const patientMsgs = msgs.filter(m => m.sender === 'patient');
              if (patientMsgs.length > 0) {
                const lastSeenId = lastSeenMapRef.current[p.id] || '';
                const lastSeenIndex = patientMsgs.findIndex(m => m.id === lastSeenId);
                if (lastSeenId === '') {
                  unreadCount = 0; // أول مرة نحمّل → مفيش unread
                } else {
                  unreadCount = lastSeenIndex === -1
                    ? patientMsgs.length
                    : patientMsgs.length - lastSeenIndex - 1;
                }
              }
            }
          } catch {}

          return {
            patientId:         p.id,
            patientName:       `${p.firstName} ${p.lastName}`,
            lastMessage:       last?.text   ?? '',
            lastMessageTime:   last?.time   ?? '',
            lastMessageSender: last?.sender ?? ('doctor' as 'doctor' | 'patient'),
            unreadCount,
            isOnline:          Math.random() < 0.5,
            status:            (readSet.includes(p.id) ? 'read' : 'sent') as 'read' | 'sent',
          };
        })
      );

      await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(lastMsgs));
      setChats(sortChats(enriched));
    } catch {}
  }, []);

  // ─── ✅ Polling: فحص رسايل جديدة من المرضى كل 6 ثواني ──
  const pollForNewMessages = useCallback(async () => {
    try {
      const raw      = await AsyncStorage.getItem(STORAGE_KEY);
      const patients: Patient[] = raw ? JSON.parse(raw) : [];
      const accepted = patients.filter(p => p.status === 'accepted');

      let hasUpdates = false;

      for (const p of accepted) {
        const chatRaw = await AsyncStorage.getItem(`doc_chat_${p.id}`);
        if (!chatRaw) continue;
        const msgs: StoredMessage[] = JSON.parse(chatRaw);
        const patientMsgs = msgs.filter(m => m.sender === 'patient');
        if (!patientMsgs.length) continue;

        const latestMsg   = patientMsgs[patientMsgs.length - 1];
        const lastSeenId  = lastSeenMapRef.current[p.id];

        if (lastSeenId === undefined) {
          // أول مرة نشوف هذا المريض → خزّن بدون notification
          lastSeenMapRef.current[p.id] = latestMsg.id;
          continue;
        }

        if (latestMsg.id !== lastSeenId) {
          // رسالة جديدة!
          lastSeenMapRef.current[p.id] = latestMsg.id;
          const name = `${p.firstName} ${p.lastName}`;
          await notifyIncomingMessage(name, p.id, latestMsg.text);
          hasUpdates = true;
        }
      }

      // لو فيه رسايل جديدة → حدّث قائمة الشاتات
      if (hasUpdates) {
        await loadAcceptedChats();
      }
    } catch {}
  }, [loadAcceptedChats]);

  // ─── Init: تهيئة الـ lastSeenMap من الـ storage ─────
  const initLastSeen = useCallback(async () => {
    try {
      const raw      = await AsyncStorage.getItem(STORAGE_KEY);
      const patients: Patient[] = raw ? JSON.parse(raw) : [];
      const accepted = patients.filter(p => p.status === 'accepted');

      for (const p of accepted) {
        const chatRaw = await AsyncStorage.getItem(`doc_chat_${p.id}`);
        if (!chatRaw) continue;
        const msgs: StoredMessage[] = JSON.parse(chatRaw);
        const patientMsgs = msgs.filter(m => m.sender === 'patient');
        if (patientMsgs.length > 0) {
          // عند التهيئة → خزّن آخر رسالة كـ "مشوفة" بدون notification
          if (lastSeenMapRef.current[p.id] === undefined) {
            lastSeenMapRef.current[p.id] = patientMsgs[patientMsgs.length - 1].id;
          }
        }
      }
    } catch {}
  }, []);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(useCallback(() => {
    const init = async () => {
      await initLastSeen();
      await loadAcceptedChats();
    };
    init();

    // ✅ بدء الـ polling كل 6 ثواني
    pollingRef.current = setInterval(pollForNewMessages, 6000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadAcceptedChats, pollForNewMessages, initLastSeen]));

  const handleOpenChat = async (item: ChatPreview) => {
    try {
      const raw = await AsyncStorage.getItem(READ_KEY);
      const readSet: string[] = raw ? JSON.parse(raw) : [];
      if (!readSet.includes(item.patientId)) {
        readSet.push(item.patientId);
        await AsyncStorage.setItem(READ_KEY, JSON.stringify(readSet));
      }
      // مسح الـ unread بعد فتح الشات
      setChats(prev =>
        sortChats(prev.map(c =>
          c.patientId === item.patientId
            ? { ...c, unreadCount: 0, status: 'read' as const }
            : c
        ))
      );

      // تحديث الـ lastSeen عند فتح الشات
      try {
        const chatRaw = await AsyncStorage.getItem(`doc_chat_${item.patientId}`);
        if (chatRaw) {
          const msgs: StoredMessage[] = JSON.parse(chatRaw);
          const patientMsgs = msgs.filter(m => m.sender === 'patient');
          if (patientMsgs.length > 0) {
            lastSeenMapRef.current[item.patientId] = patientMsgs[patientMsgs.length - 1].id;
          }
        }
      } catch {}
    } catch {}

    router.push({
      pathname: '/Doctor/Docpatient',
      params: {
        patientId:   item.patientId,
        patientName: item.patientName,
        isOnline:    item.isOnline ? '1' : '0',
      },
    });
  };

  const filtered    = chats.filter(c => c.patientName.includes(search) || c.lastMessage.includes(search));
  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  const topPadding = insets.top > 0
    ? insets.top
    : Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  return (
    <View style={[styles.safe, { paddingTop: topPadding }]}>
      <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" translucent />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={DOC_COLOR} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle}>المحادثات</Text>
          {totalUnread > 0 && <Text style={styles.headerSub}>{totalUnread} رسالة غير مقروءة</Text>}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          value={search} onChangeText={setSearch}
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

      <View style={styles.noticeBanner}>
        <Ionicons name="information-circle-outline" size={15} color={DOC_COLOR} />
        <Text style={styles.noticeText}>تظهر هنا محادثات المرضى المقبولين فقط</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.patientId}
        renderItem={({ item, index }) => (
          <ChatItem item={item} index={index} onPress={() => handleOpenChat(item)} />
        )}
        ListEmptyComponent={<EmptyChats />}
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <DocTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5FF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0EBFA',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  headerSub:   { fontSize: 12, color: DOC_COLOR, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: Spacing.base, marginTop: 14, marginBottom: 10,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#E8DFFA',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  searchIcon:  { marginEnd: 8 },
  searchInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0 },
  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.base, marginBottom: 12,
    backgroundColor: DOC_COLOR_LIGHT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: DOC_COLOR + '25',
  },
  noticeText: { fontSize: 12, color: DOC_COLOR, fontWeight: '500', flex: 1 },
  chatRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 13, backgroundColor: '#fff', gap: 12 },
  chatRowUnread: { backgroundColor: '#F8F5FF' },
  unreadBar:     { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: DOC_COLOR },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: DOC_COLOR + '30' },
  avatarActive: { borderColor: DOC_COLOR + '70' },
  avatarText:   { fontSize: 17, fontWeight: '800', color: DOC_COLOR },
  onlineBadge:  { position: 'absolute', bottom: 2, end: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF82', borderWidth: 2, borderColor: '#fff' },
  chatContent:   { flex: 1 },
  chatTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  patientName:     { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary, flex: 1, marginEnd: 6 },
  patientNameBold: { fontWeight: '800' },
  timeText:        { fontSize: 11, color: Colors.textMuted },
  timeTextActive:  { color: DOC_COLOR, fontWeight: '700' },
  lastMsgWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginEnd: 8 },
  lastMsg:      { fontSize: 13, color: Colors.textMuted, flex: 1 },
  lastMsgBold:  { color: Colors.textPrimary, fontWeight: '600' },
  lastMsgEmpty: { color: Colors.textMuted, fontStyle: 'italic' },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: DOC_COLOR, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText:  { fontSize: 11, color: '#fff', fontWeight: '800' },
  separator:   { height: 1, backgroundColor: '#F0EBFA', marginStart: 78 },
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 2, borderColor: DOC_COLOR + '25' },
  emptyTitle:      { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  emptySubtitle:   { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});