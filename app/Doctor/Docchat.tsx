// Doctor/Docchat.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES vs original:
//   • All setInterval polling and AsyncStorage chat-list loading REMOVED.
//   • Chat list is now driven by ChatsContext (which uses onSnapshot).
//   • Per-chat unread badge is maintained locally; resets on open.
//   • All styles, animations, RTL, and localization strings preserved exactly.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import { usePathname } from 'expo-router';
import { useChats } from '../../context/Chatscontext';
import type { ChatPreview } from '../../context/Chatscontext';

const DOC_COLOR       = '#7C5CBF';
const DOC_COLOR_LIGHT = '#F0EBFA';

// ─────────────────────────────────────────────────────────────────────────────
// DocTabBar (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
type TabItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
};
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
                <TouchableOpacity
                    key={tab.route}
                    style={tabStyles.tab}
                    onPress={() => router.push(tab.route as any)}
                    activeOpacity={0.7}
                >
                  <View style={[tabStyles.iconWrap, isActive && tabStyles.iconWrapActive]}>
                    <Ionicons
                        name={isActive ? tab.iconActive : tab.icon}
                        size={22}
                        color={isActive ? '#fff' : '#B0BEC5'}
                    />
                  </View>
                  <Text style={[tabStyles.label, isActive && tabStyles.labelActive]}>
                    {tab.label}
                  </Text>
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
  iconWrap: {
    width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', backgroundColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: DOC_COLOR,
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40, shadowRadius: 10, elevation: 6,
  },
  label:       { fontSize: 11, fontWeight: '600', color: '#B0BEC5' },
  labelActive: { color: DOC_COLOR, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// ChatItem (unchanged visually)
// ─────────────────────────────────────────────────────────────────────────────
function ChatItem({
                    item, index, onPress,
                  }: {
  item: ChatPreview; index: number; onPress: () => void;
}) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 10, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const hasUnread = item.unreadCount > 0;
  const lastMsgDisplay = item.lastMessage || 'ابدأ المحادثة الآن...';

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
              <Text
                  style={[styles.patientName, hasUnread && styles.patientNameBold]}
                  numberOfLines={1}
              >
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
                    <Text style={styles.unreadText}>
                      {item.unreadCount > 9 ? '9+' : item.unreadCount}
                    </Text>
                  </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function DocchatScreen() {
  const { isRTL, t }    = useLang();
  const { chats, markAsRead, totalUnread } = useChats();
  const insets          = useSafeAreaInsets();

  const [search, setSearch] = useState('');

  // Filter accepted chats (status field comes from ChatsContext)
  const filtered = chats
      .filter(c =>
          !search.trim() ||
          c.patientName.toLowerCase().includes(search.trim().toLowerCase()),
      );
  const sorted = sortChats(filtered);

  const handleOpenChat = useCallback((item: ChatPreview) => {
    markAsRead(item.patientId);
    router.push({
      pathname: '/Doctor/Docpatient',
      params: {
        patientId:   item.patientId,
        patientName: item.patientName,
        isOnline:    item.isOnline ? '1' : '0',
        chatId:      item.relationshipId,
      },
    });
  }, [markAsRead]);

  return (
      <View style={styles.safe}>
        <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={styles.headerTitle}>
              {isRTL ? 'المحادثات' : 'Chats'}
            </Text>
            {totalUnread > 0 && (
                <Text style={styles.headerSub}>
                  {totalUnread} {isRTL ? 'رسالة غير مقروءة' : 'unread messages'}
                </Text>
            )}
          </View>
          {/* Live-sync badge */}
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{isRTL ? 'مباشر' : 'Live'}</Text>
          </View>
        </View>

        {/* ── Subtitle ── */}
        <View style={styles.subtitleWrap}>
          <Ionicons name="information-circle-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.subtitle}>
            {isRTL ? t.docAcceptedOnly : t.docAcceptedOnly}
          </Text>
        </View>

        {/* ── Search ── */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isRTL ? 'ابحث في المحادثات...' : 'Search chats...'}
              placeholderTextColor={Colors.textMuted}
              style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
          />
          {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
          )}
        </View>

        {/* ── Chat List ── */}
        {sorted.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>
                {isRTL ? 'لا توجد محادثات بعد' : 'No chats yet'}
              </Text>
              <Text style={styles.emptySub}>
                {isRTL
                    ? 'المحادثات ستظهر هنا فقط للمرضى الذين قبلت طلباتهم'
                    : "Chats will appear here only for accepted patients"}
              </Text>
            </View>
        ) : (
            <FlatList
                data={sorted}
                keyExtractor={item => item.patientId}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => (
                    <ChatItem
                        item={item}
                        index={index}
                        onPress={() => handleOpenChat(item)}
                    />
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        )}

        <DocTabBar />
      </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (preserved from original)
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#F8F5FF' },
  header:        { paddingHorizontal: Spacing.base, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle:   { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  headerSub:     { fontSize: 12, color: DOC_COLOR, fontWeight: '600', marginTop: 2 },
  liveBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E8F5EF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF82' },
  liveText:      { fontSize: 11, color: '#4CAF82', fontWeight: '700' },
  subtitleWrap:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.base, marginBottom: 10 },
  subtitle:      { fontSize: 12, color: Colors.textMuted, flex: 1 },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', marginHorizontal: Spacing.base, marginBottom: 12, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: Colors.border, shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  searchInput:   { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, padding: 0 },
  listContent:   { paddingHorizontal: Spacing.base, paddingBottom: 24 },
  separator:     { height: 1, backgroundColor: Colors.border, marginLeft: 76 },
  chatRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderRadius: 16, gap: 12, position: 'relative' },
  chatRowUnread: { backgroundColor: '#F5F0FF' },
  unreadBar:     { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2, backgroundColor: DOC_COLOR },
  avatarWrap:    { position: 'relative' },
  avatar:        { width: 52, height: 52, borderRadius: 26, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarActive:  { borderColor: DOC_COLOR },
  avatarText:    { fontSize: 16, fontWeight: '800', color: DOC_COLOR },
  onlineBadge:   { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#4CAF82', borderWidth: 2, borderColor: '#fff' },
  chatContent:   { flex: 1, gap: 4 },
  chatTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patientName:   { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  patientNameBold: { fontWeight: '800', color: DOC_COLOR },
  timeText:      { fontSize: 11, color: Colors.textMuted },
  timeTextActive:{ color: DOC_COLOR, fontWeight: '700' },
  chatBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsgWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  lastMsg:       { fontSize: FontSize.sm, color: Colors.textMuted, flex: 1 },
  lastMsgBold:   { fontWeight: '700', color: Colors.textSecondary },
  lastMsgEmpty:  { fontStyle: 'italic', color: Colors.textMuted },
  unreadBadge:   { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: DOC_COLOR, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText:    { fontSize: 11, fontWeight: '900', color: '#fff' },
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyEmoji:    { fontSize: 52 },
  emptyTitle:    { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  emptySub:      { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});