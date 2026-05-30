// app/tabs/doctorchat.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES vs original:
//   • All setInterval / mock auto-replies replaced with Firestore onSnapshot.
//   • Chat is BLOCKED (shows pending banner) until relationship.status = 'accepted'.
//   • Renders an interactive "Agree / Give Access" card for request_access messages.
//   • All visual styles, RTL logic, and LanguageContext strings preserved exactly.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, TextInput, KeyboardAvoidingView,
  Platform, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';

// ── Firebase ─────────────────────────────────────────────────────────────────
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, relDoc, chatDoc, messagesCol, FSMessage, FSRelationship } from '../../utils/firebaseConfig';
import { useAuth } from '../../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Message = {
  id:           string;
  text:         string;
  sender:       'patient' | 'doctor';
  time:         string;
  status?:      'sent' | 'delivered' | 'read';
  type:         'text' | 'request_access';
  accessStatus: 'pending' | 'granted' | null;
};

function nowTime() {
  return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick-reply constants (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_REPLIES_AR = ['عندي سؤال عن التمارين','أشعر بألم','شكراً دكتور','هل يمكنني تغيير موعدي؟','أريد نصيحة'];
const QUICK_REPLIES_EN = ['I have a question about exercises','I feel pain','Thank you doctor','Can I change my appointment?','I need advice'];

// ─────────────────────────────────────────────────────────────────────────────
// AccessRequestCard – rendered only when type === 'request_access'
// ─────────────────────────────────────────────────────────────────────────────
function AccessRequestCard({
                             msg, isRTL, chatId, onGranted,
                           }: {
  msg: Message; isRTL: boolean; chatId: string; onGranted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleAgree = async () => {
    if (loading || msg.accessStatus === 'granted') return;
    setLoading(true);
    try {
      // Read current relationship ID from the chat doc
      const chatSnap = await getDoc(chatDoc(chatId));
      if (!chatSnap.exists()) return;
      const { participants } = chatSnap.data() as { participants: string[] };
      // participants = [doctorId, patientId]
      const [doctorId, patientId] = participants;

      const batch = writeBatch(db);

      // 1. Update the message's accessStatus
      batch.update(doc(db, 'chats', chatId, 'messages', msg.id), {
        accessStatus: 'granted',
      });

      // 2. Update the relationship's exerciseAccess
      batch.update(relDoc(doctorId, patientId), {
        exerciseAccess: 'granted',
      });

      await batch.commit();
      onGranted();
    } catch (err) {
      console.warn('[AccessRequestCard.handleAgree]', err);
    } finally {
      setLoading(false);
    }
  };

  const isGranted = msg.accessStatus === 'granted';

  return (
      <View style={accessStyles.card}>
        <View style={accessStyles.iconRow}>
          <Ionicons name="fitness-outline" size={24} color="#7C5CBF" />
        </View>
        <Text style={[accessStyles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL ? 'طلب إضافة تمارين' : 'Exercise Access Request'}
        </Text>
        <Text style={[accessStyles.body, { textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL
              ? 'الدكتور يطلب إذنك لإضافة وإدارة تمارين مخصصة لك'
              : 'Your doctor is requesting permission to add and manage exercises for you'}
        </Text>
        {isGranted ? (
            <View style={accessStyles.grantedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF82" />
              <Text style={accessStyles.grantedText}>
                {isRTL ? 'تم الموافقة ✅' : 'Access Granted ✅'}
              </Text>
            </View>
        ) : (
            <TouchableOpacity
                style={accessStyles.agreeBtn}
                onPress={handleAgree}
                activeOpacity={0.8}
                disabled={loading}
            >
              {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={accessStyles.agreeBtnText}>
                    {isRTL ? 'موافق / منح الصلاحية' : 'Agree / Give Access'}
                  </Text>}
            </TouchableOpacity>
        )}
        <Text style={[accessStyles.time, { textAlign: isRTL ? 'right' : 'left' }]}>{msg.time}</Text>
      </View>
  );
}

const accessStyles = StyleSheet.create({
  card: { alignSelf: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginVertical: 8, maxWidth: '85%', borderWidth: 1.5, borderColor: '#7C5CBF30', shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 },
  iconRow: { alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '800', color: '#2d2d2d', marginBottom: 4 },
  body:  { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 12 },
  agreeBtn: { backgroundColor: '#7C5CBF', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  agreeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  grantedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5EF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'center' },
  grantedText: { color: '#4CAF82', fontWeight: '700', fontSize: 13 },
  time: { fontSize: 10, color: '#aaa', marginTop: 8 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble (unchanged visual, now supports request_access type)
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({
                         msg, isRTL, doctorColor, doctorBg, chatId, onAccessGranted,
                       }: {
  msg: Message; isRTL: boolean; doctorColor: string; doctorBg: string;
  chatId: string; onAccessGranted: () => void;
}) {
  const isPatient = msg.sender === 'patient';
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isPatient ? 20 : -20)).current;

  useEffect(() => {
    if (msg.type === 'request_access') return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  if (msg.type === 'request_access') {
    return (
        <AccessRequestCard
            msg={msg} isRTL={isRTL} chatId={chatId} onGranted={onAccessGranted}
        />
    );
  }

  return (
      <Animated.View
          style={[
            styles.msgRow,
            isPatient ? styles.msgRowRight : styles.msgRowLeft,
            { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
          ]}
      >
        {!isPatient && (
            <View style={[styles.docAvatar, { backgroundColor: doctorBg }]}>
              <Ionicons name="person" size={13} color={doctorColor} />
            </View>
        )}
        <View style={[
          styles.bubble,
          isPatient
              ? [styles.bubblePatient, { backgroundColor: Colors.primary }]
              : [styles.bubbleDoctor, { backgroundColor: '#fff', borderColor: doctorColor + '30' }],
        ]}>
          <Text style={[
            styles.bubbleText,
            isPatient ? { color: '#fff' } : { color: Colors.textPrimary },
            { textAlign: isRTL ? 'right' : 'left' },
          ]}>
            {msg.text}
          </Text>
          <View style={styles.bubbleMeta}>
            <Text style={[styles.timeText, isPatient && { color: 'rgba(255,255,255,0.7)' }]}>
              {msg.time}
            </Text>
            {isPatient && (
                <Ionicons
                    name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'}
                    size={12}
                    color={msg.status === 'read' ? '#93E0FF' : 'rgba(255,255,255,0.6)'}
                />
            )}
          </View>
        </View>
      </Animated.View>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{label}</Text>
        <View style={styles.dividerLine} />
      </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending banner shown before doctor accepts
// ─────────────────────────────────────────────────────────────────────────────
function PendingBanner({ isRTL, doctorColor }: { isRTL: boolean; doctorColor: string }) {
  return (
      <View style={[styles.noticeBanner, { borderColor: '#F4A32B40' }]}>
        <Ionicons name="hourglass-outline" size={14} color="#F4A32B" />
        <Text style={[styles.noticeText, { color: '#F4A32B' }]}>
          {isRTL
              ? 'طلبك قيد الانتظار — الشات سيُفتح بعد قبول الدكتور'
              : 'Request pending — chat opens once the doctor accepts'}
        </Text>
      </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function DoctorChatScreen() {
  const { isRTL } = useLang();
  const { user }  = useAuth();

  const params = useLocalSearchParams<{
    doctorId:    string; patientId:   string; chatId:      string;
    doctorName:  string; doctorEmoji: string;
    doctorColor: string; doctorBg:    string; specialty:   string;
  }>();

  const doctorId    = params.doctorId    ?? '';
  const patientId   = params.patientId   ?? user?.uid ?? '';
  const chatId      = params.chatId      ?? `${doctorId}_${patientId}`;
  const doctorName  = params.doctorName  ?? 'الدكتور';
  const doctorEmoji = params.doctorEmoji ?? '🩺';
  const doctorColor = params.doctorColor ?? Colors.primary;
  const doctorBg    = params.doctorBg    ?? Colors.primaryUltraLight;
  const specialty   = params.specialty   ?? '';

  const [messages,       setMessages]       = useState<Message[]>([]);
  const [inputText,      setInputText]      = useState('');
  const [showQuick,      setShowQuick]      = useState(false);
  const [relStatus,      setRelStatus]      = useState<'pending' | 'accepted' | null>(null);
  const [accessGranted,  setAccessGranted]  = useState(false);
  const listRef   = useRef<FlatList>(null);
  const quickAnim = useRef(new Animated.Value(0)).current;

  const quickReplies = isRTL ? QUICK_REPLIES_AR : QUICK_REPLIES_EN;

  // ── Subscribe to relationship status ──────────────────────────────────────
  useEffect(() => {
    if (!doctorId || !patientId) return;
    const relRef = relDoc(doctorId, patientId);
    const unsub  = onSnapshot(relRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as FSRelationship;
        setRelStatus(data.status);
        setAccessGranted(data.exerciseAccess === 'granted');
      }
    });
    return () => unsub();
  }, [doctorId, patientId]);

  // ── Subscribe to messages (only when accepted) ────────────────────────────
  useEffect(() => {
    if (relStatus !== 'accepted' || !chatId) return;

    const q = query(
        messagesCol(chatId),
        orderBy('timestamp', 'asc'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map((d) => {
        const data = d.data() as FSMessage;
        return {
          id:           d.id,
          text:         data.text,
          sender:       data.sender,
          time:         data.time,
          status:       'delivered',
          type:         data.type ?? 'text',
          accessStatus: data.accessStatus ?? null,
        };
      });
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    });

    return () => unsub();
  }, [relStatus, chatId]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(
      async (text: string) => {
        if (!text.trim() || relStatus !== 'accepted') return;
        const timeStr = nowTime();

        setInputText('');
        setShowQuick(false);

        try {
          await addDoc(messagesCol(chatId), {
            text:         text.trim(),
            sender:       'patient',
            time:         timeStr,
            timestamp:    serverTimestamp(),
            type:         'text',
            accessStatus: null,
          });

          // Update chat preview
          await updateDoc(chatDoc(chatId), {
            lastMessage:       text.trim(),
            lastMessageTime:   serverTimestamp(),
            lastMessageSender: 'patient',
          }).catch(() => {});

          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (err) {
          console.warn('[DoctorChatScreen.sendMessage]', err);
        }
      },
      [chatId, relStatus],
  );

  const toggleQuick = () => {
    const toVal = showQuick ? 0 : 1;
    setShowQuick(!showQuick);
    Animated.spring(quickAnim, { toValue: toVal, tension: 120, friction: 8, useNativeDriver: true }).start();
  };

  const handleBack = () => router.replace('/tabs/doctors');

  const isAccepted = relStatus === 'accepted';

  return (
      <SafeAreaView style={styles.safe}>
        <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />

        {/* ── Header (unchanged) ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={doctorColor} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={[styles.headerAvatar, { backgroundColor: doctorBg }]}>
              <Text style={{ fontSize: 20 }}>{doctorEmoji}</Text>
            </View>
            <View>
              <Text style={styles.headerName} numberOfLines={1}>{doctorName}</Text>
              <Text style={[styles.headerSpec, { color: doctorColor }]} numberOfLines={1}>{specialty}</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.callBtn, { backgroundColor: doctorBg }]} activeOpacity={0.8}>
            <Ionicons name="call-outline" size={18} color={doctorColor} />
          </TouchableOpacity>
        </View>

        {/* ── Status Banner ── */}
        {isAccepted ? (
            <View style={[styles.noticeBanner, { borderColor: doctorColor + '30' }]}>
              <Ionicons name="shield-checkmark-outline" size={14} color={doctorColor} />
              <Text style={[styles.noticeText, { color: doctorColor }]}>
                {isRTL ? 'متصل بالسيرفر — شات مباشر ✅' : 'Live sync enabled ✅'}
              </Text>
            </View>
        ) : (
            <PendingBanner isRTL={isRTL} doctorColor={doctorColor} />
        )}

        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* ── Message list ── */}
          {isAccepted ? (
              <FlatList
                  ref={listRef}
                  data={messages}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                  ListHeaderComponent={<DateDivider label={isRTL ? 'اليوم' : 'Today'} />}
                  renderItem={({ item }) => (
                      <MessageBubble
                          msg={item} isRTL={isRTL}
                          doctorColor={doctorColor} doctorBg={doctorBg}
                          chatId={chatId}
                          onAccessGranted={() => setAccessGranted(true)}
                      />
                  )}
              />
          ) : (
              // Locked state placeholder
              <View style={styles.lockedState}>
                <Text style={styles.lockedEmoji}>⏳</Text>
                <Text style={styles.lockedTitle}>
                  {isRTL ? 'في انتظار الدكتور' : 'Awaiting doctor approval'}
                </Text>
                <Text style={styles.lockedSub}>
                  {isRTL
                      ? 'سيُفتح الشات فور قبول طلبك'
                      : 'Chat will open as soon as your request is accepted'}
                </Text>
              </View>
          )}

          {/* ── Quick replies ── */}
          {isAccepted && showQuick && (
              <Animated.ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  style={[styles.quickWrap, {
                    opacity: quickAnim,
                    transform: [{ translateY: quickAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                  }]}
                  contentContainerStyle={styles.quickContent}
              >
                {quickReplies.map((q, i) => (
                    <TouchableOpacity
                        key={i}
                        onPress={() => { sendMessage(q); setShowQuick(false); }}
                        style={[styles.quickChip, { borderColor: doctorColor + '50' }]}
                        activeOpacity={0.8}
                    >
                      <Text style={[styles.quickChipText, { color: doctorColor }]}>{q}</Text>
                    </TouchableOpacity>
                ))}
              </Animated.ScrollView>
          )}

          {/* ── Input bar ── */}
          <View style={styles.inputBarWrap}>
            <View style={[styles.inputBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                  onPress={toggleQuick}
                  style={[styles.iconBtn, { backgroundColor: showQuick ? doctorColor : doctorBg }]}
                  activeOpacity={0.8}
                  disabled={!isAccepted}
              >
                <Ionicons
                    name={showQuick ? 'close' : 'flash'}
                    size={18}
                    color={showQuick ? '#fff' : doctorColor}
                />
              </TouchableOpacity>

              <View style={[styles.inputWrap, { borderColor: doctorColor + '40' }]}>
                <TextInput
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={
                      isAccepted
                          ? (isRTL ? 'اكتب رسالتك...' : 'Write your message...')
                          : (isRTL ? 'في انتظار القبول...' : 'Awaiting approval...')
                    }
                    placeholderTextColor={Colors.textMuted}
                    style={[styles.textInput, { textAlign: isRTL ? 'right' : 'left' }]}
                    multiline
                    maxLength={500}
                    editable={isAccepted}
                />
              </View>

              <TouchableOpacity
                  onPress={() => sendMessage(inputText)}
                  style={[styles.sendBtn, { backgroundColor: (inputText.trim() && isAccepted) ? doctorColor : '#B0BEC5' }]}
                  activeOpacity={0.8}
                  disabled={!inputText.trim() || !isAccepted}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — original preserved, new locked-state added
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5FF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.base, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryUltraLight, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  headerSpec: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  noticeBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: Spacing.base, marginTop: 10, marginBottom: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  noticeText: { fontSize: 11, fontWeight: '500', flex: 1 },
  listContent: { paddingHorizontal: Spacing.base, paddingBottom: 12, paddingTop: 8 },
  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginBottom: 8 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft:  { justifyContent: 'flex-start' },
  docAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubblePatient: { borderBottomRightRadius: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  bubbleDoctor: { borderBottomLeftRadius: 4, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  bubbleText: { fontSize: FontSize.base, lineHeight: 22 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, justifyContent: 'flex-end' },
  timeText: { fontSize: 10, color: Colors.textMuted },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14, paddingHorizontal: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', backgroundColor: '#F8F5FF', paddingHorizontal: 8, borderRadius: 8 },
  quickWrap:    { maxHeight: 50, marginBottom: 4 },
  quickContent: { paddingHorizontal: Spacing.base, gap: 8, alignItems: 'center' },
  quickChip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  quickChipText: { fontSize: 12, fontWeight: '600' },
  inputBarWrap: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  inputBar: { alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.base, paddingTop: 10, paddingBottom: 12 },
  inputWrap: { flex: 1, backgroundColor: Colors.background, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, minHeight: 44, maxHeight: 120 },
  textInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0, lineHeight: 20 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  lockedState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  lockedEmoji: { fontSize: 52 },
  lockedTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  lockedSub:   { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});