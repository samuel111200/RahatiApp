// Doctor/Docpatient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES vs original:
//   • setInterval polling REMOVED — replaced with Firestore onSnapshot.
//   • "Add Exercise" button locked/unlocked via exerciseAccess field (real-time).
//   • Sending "request_access" message writes a special FSMessage to Firestore.
//   • All styles, RTL, animations, and LanguageContext strings preserved.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput, KeyboardAvoidingView,
  Platform, Animated, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import { useChats } from '../../context/Chatscontext';
import type { PatientExercise } from '../../context/Chatscontext';
import { notifyMessageSent } from './DocNotifService';

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
} from 'firebase/firestore';
import { db, relDoc, chatDoc, messagesCol, FSMessage, FSRelationship } from '../../utils/firebaseConfig';
import { useAuth } from '../../context/AuthContext';

const DOC_COLOR       = '#7C5CBF';
const DOC_COLOR_LIGHT = '#F0EBFA';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Message = {
  id:           string;
  text:         string;
  sender:       'doctor' | 'patient';
  time:         string;
  status?:      'sent' | 'delivered' | 'read';
  type:         'text' | 'request_access';
  accessStatus: 'pending' | 'granted' | null;
};

function now() {
  return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

const QUICK_REPLIES = ['كيف حالك اليوم؟','هل تناولت الدواء؟','ما هي الأعراض؟','لا داعي للقلق','يرجى المراجعة غداً'];

// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({ msg, isRTL }: { msg: Message; isRTL: boolean }) {
  const isDoc     = msg.sender === 'doctor';
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isDoc ? 20 : -20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  // Special rendering for access request messages on doctor's side
  if (msg.type === 'request_access') {
    const isGranted = msg.accessStatus === 'granted';
    return (
        <View style={[msgStyles.row, msgStyles.rowRight]}>
          <View style={[msgStyles.bubble, msgStyles.bubbleDoc, { alignItems: 'flex-end' }]}>
            <Text style={[msgStyles.bubbleTextDoc, { fontSize: 12 }]}>
              {isRTL ? '🔒 طلب صلاحية التمارين' : '🔒 Exercise access request'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons
                  name={isGranted ? 'checkmark-circle' : 'time-outline'}
                  size={12}
                  color={isGranted ? '#D4BBFF' : 'rgba(255,255,255,0.6)'}
              />
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                {isGranted
                    ? (isRTL ? 'تمت الموافقة ✅' : 'Granted ✅')
                    : (isRTL ? 'في انتظار موافقة المريض' : 'Awaiting patient approval')}
              </Text>
            </View>
          </View>
        </View>
    );
  }

  return (
      <Animated.View
          style={[
            msgStyles.row,
            isDoc ? msgStyles.rowRight : msgStyles.rowLeft,
            { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
          ]}
      >
        {!isDoc && (
            <View style={msgStyles.patientAvatar}>
              <Ionicons name="person" size={14} color={DOC_COLOR} />
            </View>
        )}
        <View style={[msgStyles.bubble, isDoc ? msgStyles.bubbleDoc : msgStyles.bubblePatient]}>
          <Text style={[msgStyles.bubbleText, isDoc ? msgStyles.bubbleTextDoc : msgStyles.bubbleTextPatient]}>
            {msg.text}
          </Text>
          <View style={msgStyles.bubbleMeta}>
            <Text style={[msgStyles.timeText, isDoc && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
            {isDoc && (
                <Ionicons
                    name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'}
                    size={13}
                    color={msg.status === 'read' ? '#D4BBFF' : 'rgba(255,255,255,0.6)'}
                />
            )}
          </View>
        </View>
      </Animated.View>
  );
}

const msgStyles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft:  { justifyContent: 'flex-start' },
  patientAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: DOC_COLOR + '30' },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleDoc: { backgroundColor: DOC_COLOR, borderBottomRightRadius: 4, shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  bubblePatient: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 1, borderWidth: 1, borderColor: Colors.border },
  bubbleText:        { fontSize: FontSize.base, lineHeight: 22 },
  bubbleTextDoc:     { color: '#fff', fontWeight: '500' },
  bubbleTextPatient: { color: Colors.textPrimary },
  bubbleMeta:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  timeText:          { fontSize: 10, color: Colors.textMuted },
});

function DateDivider({ label }: { label: string }) {
  return (
      <View style={divStyles.wrap}>
        <View style={divStyles.line} />
        <Text style={divStyles.text}>{label}</Text>
        <View style={divStyles.line} />
      </View>
  );
}
const divStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14, paddingHorizontal: 8 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  text: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', backgroundColor: '#F8F5FF', paddingHorizontal: 8, borderRadius: 8 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function Docpatient() {
  const params = useLocalSearchParams<{
    patientId: string; patientName: string; isOnline: string; chatId: string;
  }>();
  const patientId   = params.patientId   ?? '';
  const patientName = params.patientName ?? '';
  const chatId      = params.chatId      ?? '';
  const isOnline    = params.isOnline === '1';

  const { isRTL }                               = useLang();
  const { markAsRead, assignExercise, removeExercise, subscribeToExercises } = useChats();
  const { user }                                = useAuth();
  const insets                                  = useSafeAreaInsets();

  const [messages,      setMessages]      = useState<Message[]>([]);
  const [inputText,     setInputText]     = useState('');
  const [showQuick,     setShowQuick]     = useState(false);
  const [exercises,     setExercises]     = useState<PatientExercise[]>([]);
  const [showExModal,   setShowExModal]   = useState(false);
  const [exerciseAccess, setExerciseAccess] = useState<'locked' | 'granted'>('locked');
  const [requestSent,   setRequestSent]   = useState(false);
  const [newEx,         setNewEx]         = useState({ title: '', emoji: '🏋️', durationMin: '', description: '' });

  const listRef         = useRef<FlatList>(null);
  const quickAnim       = useRef(new Animated.Value(0)).current;
  const seenMessageIds  = useRef(new Set<string>());

  // ── Mark as read on focus ─────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (patientId) markAsRead(patientId);
  }, [patientId]));

  // ── Subscribe to relationship (exerciseAccess field) ──────────────────────
  useEffect(() => {
    if (!user?.uid || !patientId) return;
    const unsub = onSnapshot(relDoc(user.uid, patientId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as FSRelationship;
        setExerciseAccess(data.exerciseAccess ?? 'locked');
      }
    });
    return () => unsub();
  }, [user?.uid, patientId]);

  // ── Subscribe to messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    const q = query(messagesCol(chatId), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map(d => {
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

      // Detect new incoming patient messages → notify
      const incoming = msgs.filter(m => m.sender === 'patient');
      const newest   = incoming.filter(m => !seenMessageIds.current.has(m.id));
      if (newest.length > 0 && seenMessageIds.current.size > 0) {
        import('./DocNotifService').then(({ notifyIncomingMessage }) => {
          notifyIncomingMessage(patientName, patientId, newest[newest.length - 1].text).catch(() => {});
        });
      }
      seenMessageIds.current = new Set(msgs.map(m => m.id));

      // Check if any request_access message has been granted → update local state
      const grantedMsg = msgs.find(m => m.type === 'request_access' && m.accessStatus === 'granted');
      if (grantedMsg) setExerciseAccess('granted');
      const pendingMsg = msgs.find(m => m.type === 'request_access' && m.accessStatus === 'pending');
      if (pendingMsg) setRequestSent(true);

      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    });
    return () => unsub();
  }, [chatId]);

  // ── Subscribe to exercises ────────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) return;
    const unsub = subscribeToExercises(patientId, setExercises);
    return () => unsub();
  }, [patientId, subscribeToExercises]);

  // ── Send text message ─────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !chatId) return;
    const timeStr = now();
    setInputText('');
    setShowQuick(false);

    try {
      await addDoc(messagesCol(chatId), {
        text:         text.trim(),
        sender:       'doctor',
        time:         timeStr,
        timestamp:    serverTimestamp(),
        type:         'text',
        accessStatus: null,
      });
      await updateDoc(chatDoc(chatId), {
        lastMessage:       text.trim(),
        lastMessageTime:   serverTimestamp(),
        lastMessageSender: 'doctor',
      }).catch(() => {});

      notifyMessageSent(patientName, patientId, text).catch(() => {});
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.warn('[Docpatient.sendMessage]', err);
    }
  }, [chatId, patientId, patientName]);

  // ── Request exercise access (writes special message) ─────────────────────
  const handleRequestAccess = useCallback(async () => {
    if (!chatId || requestSent) return;
    const timeStr = now();
    try {
      await addDoc(messagesCol(chatId), {
        text:         isRTL ? 'طلب إضافة تمارين' : 'Exercise access request',
        sender:       'doctor',
        time:         timeStr,
        timestamp:    serverTimestamp(),
        type:         'request_access',
        accessStatus: 'pending',
      });
      setRequestSent(true);
    } catch (err) {
      console.warn('[Docpatient.handleRequestAccess]', err);
    }
  }, [chatId, requestSent, isRTL]);

  // ── Assign exercise ───────────────────────────────────────────────────────
  const handleSaveExercise = useCallback(async () => {
    const durMin = parseInt(newEx.durationMin, 10);
    if (!newEx.title.trim() || isNaN(durMin) || durMin <= 0) return;

    await assignExercise(patientId, {
      title:       newEx.title.trim(),
      emoji:       newEx.emoji || '🏋️',
      durationMin: durMin,
      description: newEx.description.trim(),
      completed:   false,
    });

    setNewEx({ title: '', emoji: '🏋️', durationMin: '', description: '' });
    setShowExModal(false);
  }, [newEx, patientId, assignExercise]);

  const toggleQuick = () => {
    const v = showQuick ? 0 : 1;
    setShowQuick(!showQuick);
    Animated.spring(quickAnim, { toValue: v, tension: 120, friction: 8, useNativeDriver: true }).start();
  };

  const isLocked = exerciseAccess === 'locked';

  return (
      <SafeAreaView style={styles.safe} edges={['top','bottom']}>
        <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={DOC_COLOR} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={styles.headerAvatar}>
              <Ionicons name="person" size={20} color={DOC_COLOR} />
              {isOnline && <View style={styles.onlineDot} />}
            </View>
            <View>
              <Text style={styles.headerName} numberOfLines={1}>{patientName}</Text>
              <Text style={styles.headerSub}>
                {isOnline ? (isRTL ? 'نشط الآن' : 'Active now') : (isRTL ? 'غير متصل' : 'Offline')}
              </Text>
            </View>
          </View>

          {/* Exercise Access button */}
          <TouchableOpacity
              style={[styles.exerciseBtn, isLocked ? styles.exerciseBtnLocked : styles.exerciseBtnActive]}
              onPress={isLocked ? handleRequestAccess : () => setShowExModal(true)}
              activeOpacity={0.8}
              disabled={requestSent && isLocked}
          >
            <Ionicons
                name={isLocked ? (requestSent ? 'time-outline' : 'lock-closed-outline') : 'fitness-outline'}
                size={16}
                color={isLocked ? '#F4A32B' : '#fff'}
            />
            <Text style={[styles.exerciseBtnText, isLocked && { color: '#F4A32B' }]}>
              {isLocked
                  ? (requestSent
                      ? (isRTL ? 'في الانتظار' : 'Pending')
                      : (isRTL ? 'طلب صلاحية' : 'Request'))
                  : (isRTL ? 'تمارين +' : '+ Exercise')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Access status banner */}
        {!isLocked && (
            <View style={[styles.banner, { borderColor: '#4CAF8240' }]}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#4CAF82" />
              <Text style={[styles.bannerText, { color: '#4CAF82' }]}>
                {isRTL ? 'صلاحية التمارين ممنوحة ✅' : 'Exercise access granted ✅'}
              </Text>
            </View>
        )}
        {isLocked && requestSent && (
            <View style={[styles.banner, { borderColor: '#F4A32B40' }]}>
              <Ionicons name="hourglass-outline" size={14} color="#F4A32B" />
              <Text style={[styles.bannerText, { color: '#F4A32B' }]}>
                {isRTL ? 'طلب الصلاحية في انتظار الموافقة' : 'Access request awaiting patient approval'}
              </Text>
            </View>
        )}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Messages */}
          <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListHeaderComponent={<DateDivider label={isRTL ? 'اليوم' : 'Today'} />}
              renderItem={({ item }) => <MessageBubble msg={item} isRTL={isRTL} />}
          />

          {/* Quick replies */}
          {showQuick && (
              <Animated.ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  style={[styles.quickWrap, {
                    opacity: quickAnim,
                    transform: [{ translateY: quickAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
                  }]}
                  contentContainerStyle={styles.quickContent}
              >
                {QUICK_REPLIES.map((q, i) => (
                    <TouchableOpacity key={i} onPress={() => { sendMessage(q); setShowQuick(false); }} style={styles.quickChip} activeOpacity={0.8}>
                      <Text style={styles.quickChipText}>{q}</Text>
                    </TouchableOpacity>
                ))}
              </Animated.ScrollView>
          )}

          {/* Input bar */}
          <View style={styles.inputBarWrap}>
            <View style={[styles.inputBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity onPress={toggleQuick} style={[styles.iconBtn, showQuick && { backgroundColor: DOC_COLOR }]} activeOpacity={0.8}>
                <Ionicons name={showQuick ? 'close' : 'flash'} size={18} color={showQuick ? '#fff' : DOC_COLOR} />
              </TouchableOpacity>
              <View style={styles.inputWrap}>
                <TextInput
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={isRTL ? 'اكتب رسالة...' : 'Write a message...'}
                    placeholderTextColor={Colors.textMuted}
                    style={[styles.textInput, { textAlign: isRTL ? 'right' : 'left' }]}
                    multiline maxLength={500}
                />
              </View>
              <TouchableOpacity
                  onPress={() => sendMessage(inputText)}
                  style={[styles.sendBtn, { backgroundColor: inputText.trim() ? DOC_COLOR : '#B0BEC5' }]}
                  activeOpacity={0.8} disabled={!inputText.trim()}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* ── Exercise list sidebar / modal ── */}
        {!isLocked && exercises.length > 0 && (
            <View style={styles.exListWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exListContent}>
                {exercises.map(ex => (
                    <View key={ex.id} style={styles.exChip}>
                      <Text style={styles.exEmoji}>{ex.emoji}</Text>
                      <Text style={styles.exTitle} numberOfLines={1}>{ex.title}</Text>
                      <TouchableOpacity onPress={() => removeExercise(patientId, ex.id)} style={styles.exRemoveBtn}>
                        <Ionicons name="close-circle" size={14} color="#E53935" />
                      </TouchableOpacity>
                    </View>
                ))}
              </ScrollView>
            </View>
        )}

        {/* ── Add Exercise Modal ── */}
        <Modal visible={showExModal} transparent animationType="slide" onRequestClose={() => setShowExModal(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowExModal(false)} />
            <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'تعيين تمرين جديد' : 'Assign New Exercise'}
            </Text>

            <TextInput
                value={newEx.title} onChangeText={v => setNewEx(p => ({ ...p, title: v }))}
                placeholder={isRTL ? 'اسم التمرين *' : 'Exercise name *'}
                placeholderTextColor={Colors.textMuted}
                style={[styles.modalInput, { textAlign: isRTL ? 'right' : 'left' }]}
            />
            <TextInput
                value={newEx.emoji} onChangeText={v => setNewEx(p => ({ ...p, emoji: v }))}
                placeholder="🏋️"
                style={[styles.modalInput, { textAlign: 'center', maxWidth: 80 }]}
            />
            <TextInput
                value={newEx.durationMin} onChangeText={v => setNewEx(p => ({ ...p, durationMin: v }))}
                placeholder={isRTL ? 'المدة (دقائق) *' : 'Duration (min) *'}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
                style={[styles.modalInput, { textAlign: isRTL ? 'right' : 'left' }]}
            />
            <TextInput
                value={newEx.description} onChangeText={v => setNewEx(p => ({ ...p, description: v }))}
                placeholder={isRTL ? 'وصف (اختياري)' : 'Description (optional)'}
                placeholderTextColor={Colors.textMuted}
                style={[styles.modalInput, { textAlign: isRTL ? 'right' : 'left' }]}
                multiline
            />

            <TouchableOpacity style={styles.saveExBtn} onPress={handleSaveExercise} activeOpacity={0.8}>
              <Text style={styles.saveExBtnText}>{isRTL ? '✅ حفظ التمرين' : '✅ Save Exercise'}</Text>
            </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F8F5FF' },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.base, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center' },
  headerInfo:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar:{ width: 40, height: 40, borderRadius: 20, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center' },
  onlineDot:   { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF82', borderWidth: 1.5, borderColor: '#fff' },
  headerName:  { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  headerSub:   { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  exerciseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1.5 },
  exerciseBtnActive: { backgroundColor: DOC_COLOR, borderColor: DOC_COLOR },
  exerciseBtnLocked: { backgroundColor: '#FEF3E2', borderColor: '#F4A32B40' },
  exerciseBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
  banner:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: Spacing.base, marginTop: 8, marginBottom: 2, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  bannerText: { fontSize: 11, fontWeight: '500', flex: 1 },
  listContent:{ paddingHorizontal: Spacing.base, paddingBottom: 12, paddingTop: 8 },
  quickWrap:    { maxHeight: 50, marginBottom: 4 },
  quickContent: { paddingHorizontal: Spacing.base, gap: 8, alignItems: 'center' },
  quickChip:    { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: DOC_COLOR + '50' },
  quickChipText:{ fontSize: 12, fontWeight: '600', color: DOC_COLOR },
  inputBarWrap: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border },
  inputBar:     { alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.base, paddingTop: 10, paddingBottom: 12 },
  inputWrap:    { flex: 1, backgroundColor: Colors.background, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: DOC_COLOR + '40', minHeight: 44, maxHeight: 120 },
  textInput:    { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0, lineHeight: 20 },
  iconBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center' },
  sendBtn:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  exListWrap:   { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 8 },
  exListContent:{ paddingHorizontal: Spacing.base, gap: 8 },
  exChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: DOC_COLOR_LIGHT, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: DOC_COLOR + '30', maxWidth: 160 },
  exEmoji:      { fontSize: 16 },
  exTitle:      { fontSize: 11, fontWeight: '700', color: DOC_COLOR, flex: 1 },
  exRemoveBtn:  { marginLeft: 2 },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, gap: 12 },
  modalHandle:  { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  modalTitle:   { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  modalInput:   { backgroundColor: Colors.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSize.base, color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border },
  saveExBtn:    { backgroundColor: DOC_COLOR, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveExBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
});