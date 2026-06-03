import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput, KeyboardAvoidingView,
  Platform, Animated, Modal, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  collection, doc, addDoc, onSnapshot, updateDoc, deleteDoc,
  orderBy, query,
} from 'firebase/firestore';
import { auth, db, FSMessage, FSChat } from '../../utils/firebaseConfig';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import { useChats } from '../../context/Chatscontext';
import { notifyMessageSent } from './DocNotifService';

const DOC_COLOR       = '#7C5CBF';
const DOC_COLOR_LIGHT = '#F0EBFA';

type Message = {
  id: string;
  text: string;
  sender: 'doctor' | 'patient';
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  type?: 'text' | 'request_access';
};

type PatientExercise = {
  id: string;
  title: string;
  emoji: string;
  durationMin: number;
  description?: string;
  assignedAt: number;
  completed?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────
const rtlRow   = (isRTL: boolean) => ({ flexDirection: isRTL ? 'row-reverse' : 'row' } as const);
const rtlAlign = (isRTL: boolean) => ({ textAlign: isRTL ? 'right' : 'left' } as const);
const t        = (isRTL: boolean, ar: string, en: string) => isRTL ? ar : en;

// ─── Message Bubble ──────────────────────────────────────
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

  if (msg.type === 'request_access') {
    return (
      <Animated.View style={[msgStyles.row, msgStyles.rowRight, { opacity: fadeAnim }]}>
        <View style={msgStyles.requestCard}>
          <Ionicons name="barbell-outline" size={22} color={DOC_COLOR} />
          <Text style={msgStyles.requestTitle}>طلب صلاحية التمارين</Text>
          <Text style={msgStyles.requestSub}>طلب الدكتور إذنك لتعيين وإدارة التمارين الخاصة بك</Text>
          <View style={msgStyles.requestBadge}>
            <Ionicons name="time-outline" size={13} color="#F4A32B" />
            <Text style={msgStyles.requestBadgeText}>بانتظار رد المريض</Text>
          </View>
        </View>
      </Animated.View>
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
          <Text style={[msgStyles.timeText, isDoc && { color: 'rgba(255,255,255,0.7)' }]}>
            {msg.time}
          </Text>
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
  patientAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: DOC_COLOR + '30',
  },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleDoc: {
    backgroundColor: DOC_COLOR, borderBottomRightRadius: 4,
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  bubblePatient: {
    backgroundColor: '#fff', borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 1,
    borderWidth: 1, borderColor: Colors.border,
  },
  bubbleText:        { fontSize: FontSize.base, lineHeight: 22 },
  bubbleTextDoc:     { color: '#fff', fontWeight: '500' },
  bubbleTextPatient: { color: Colors.textPrimary },
  bubbleMeta:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  timeText:          { fontSize: 10, color: Colors.textMuted },
  requestCard: {
    maxWidth: '80%', backgroundColor: '#fff', borderRadius: 16,
    padding: 14, alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: DOC_COLOR + '40',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
  },
  requestTitle: { fontSize: 14, fontWeight: '800', color: DOC_COLOR, textAlign: 'center' },
  requestSub:   { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  requestBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  requestBadgeText: { fontSize: 11, color: '#F4A32B', fontWeight: '700' },
});

// ─── Date Divider ─────────────────────────────────────────
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

const QUICK_REPLIES = ['كيف حالك اليوم؟', 'هل تناولت الدواء؟', 'ما هي الأعراض؟', 'لا داعي للقلق', 'يرجى المراجعة غداً'];

// ─── Exercise Management Modal ────────────────────────────
function ExerciseManagementModal({
  visible,
  onClose,
  patientId,
  isRTL,
  patientName,
}: {
  visible: boolean;
  onClose: () => void;
  patientId: string;
  isRTL: boolean;
  patientName?: string;
}) {
  const [exercises, setExercises] = useState<PatientExercise[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle,    setNewTitle]    = useState('');
  const [newEmoji,    setNewEmoji]    = useState('🏋️');
  const [newMins,     setNewMins]     = useState('');
  const [newDesc,     setNewDesc]     = useState('');
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!visible || !patientId) return;
    const unsub = onSnapshot(
      collection(db, 'exercises', patientId, 'items'),
      (snap) => {
        const list: PatientExercise[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PatientExercise, 'id'>),
        }));
        setExercises(list.sort((a, b) => b.assignedAt - a.assignedAt));
      },
    );
    return unsub;
  }, [visible, patientId]);

  const resetForm = () => {
    setNewTitle('');
    setNewEmoji('🏋️');
    setNewMins('');
    setNewDesc('');
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) {
      Alert.alert(t(isRTL, 'تنبيه', 'Notice'), t(isRTL, 'أدخل اسم التمرين', 'Enter exercise name'));
      return;
    }
    const mins = parseInt(newMins);
    if (!newMins.trim() || isNaN(mins) || mins <= 0) {
      Alert.alert(t(isRTL, 'تنبيه', 'Notice'), t(isRTL, 'أدخل مدة صحيحة', 'Enter a valid duration'));
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'exercises', patientId, 'items'), {
        title: newTitle.trim(),
        emoji: newEmoji.trim() || '🏋️',
        durationMin: mins,
        description: newDesc.trim() || '',
        assignedAt: Date.now(),
        completed: false,
      });
      resetForm();
      setShowAddForm(false);
    } catch (e) {
      console.warn('[ExerciseModal] add error:', e);
      setSaving(false);
    }
  };

  const handleDelete = (ex: PatientExercise) => {
    Alert.alert(
      t(isRTL, 'حذف التمرين', 'Delete Exercise'),
      t(isRTL, `هل تريد حذف "${ex.title}"؟`, `Delete "${ex.title}"?`),
      [
        { text: t(isRTL, 'إلغاء', 'Cancel'), style: 'cancel' },
        {
          text: t(isRTL, 'حذف', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'exercises', patientId, 'items', ex.id));
            } catch (e) {
              console.warn('[ExerciseModal] delete error:', e);
            }
          },
        },
      ],
    );
  };

  const doneCount = exercises.filter((e) => e.completed).length;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F5FF' }} edges={['top', 'bottom']}>
        <View style={exStyles.header}>
          <TouchableOpacity onPress={onClose} style={exStyles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={DOC_COLOR} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={exStyles.headerTitle}>
              {t(isRTL, `تمارين ${patientName || 'المريض'}`, `${patientName || 'Patient'}'s Exercises`)}
            </Text>
            <Text style={exStyles.headerSub}>
              {exercises.length} {t(isRTL, 'تمرين مُعيَّن', 'assigned')}
              {doneCount > 0 && ` · ${doneCount} ${t(isRTL, 'تم', 'done')}`}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={exStyles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {exercises.length === 0 && !showAddForm ? (
            <View style={exStyles.emptyState}>
              <Text style={{ fontSize: 48 }}>🏋️</Text>
              <Text style={exStyles.emptyText}>
                {t(isRTL, 'لا توجد تمارين مُعيَّنة بعد', 'No exercises assigned yet')}
              </Text>
            </View>
          ) : (
            exercises.map((ex) => (
              <View key={ex.id} style={exStyles.card}>
                <Text style={exStyles.cardEmoji}>{ex.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={exStyles.cardTitle}>{ex.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Ionicons name="time-outline" size={11} color={DOC_COLOR} />
                    <Text style={exStyles.cardMeta}>
                      {ex.durationMin} {t(isRTL, 'دقيقة', 'min')}
                    </Text>
                    {ex.completed && (
                      <View style={exStyles.doneBadge}>
                        <Text style={exStyles.doneBadgeText}>{t(isRTL, 'تم ✓', 'Done ✓')}</Text>
                      </View>
                    )}
                  </View>
                  {!!ex.description && (
                    <Text style={exStyles.cardDesc} numberOfLines={2}>{ex.description}</Text>
                  )}
                </View>
                <TouchableOpacity style={exStyles.deleteBtn} onPress={() => handleDelete(ex)} activeOpacity={0.8}>
                  <Ionicons name="trash-outline" size={18} color="#E05C5C" />
                </TouchableOpacity>
              </View>
            ))
          )}

          {showAddForm && (
            <View style={exStyles.addForm}>
              <Text style={exStyles.addFormTitle}>{t(isRTL, '➕ تمرين جديد', '➕ New Exercise')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[exStyles.input, { width: 54, textAlign: 'center' }]}
                  value={newEmoji}
                  onChangeText={setNewEmoji}
                  placeholder="🏋️"
                  maxLength={4}
                />
                <TextInput
                  style={[exStyles.input, { flex: 1 }, rtlAlign(isRTL)]}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder={t(isRTL, 'اسم التمرين *', 'Exercise name *')}
                  placeholderTextColor="#bbb"
                />
              </View>
              <TextInput
                style={[exStyles.input, rtlAlign(isRTL)]}
                value={newMins}
                onChangeText={setNewMins}
                placeholder={t(isRTL, 'المدة بالدقائق *', 'Duration (minutes) *')}
                placeholderTextColor="#bbb"
                keyboardType="numeric"
              />
              <TextInput
                style={[exStyles.input, { height: 64, textAlignVertical: 'top' }, rtlAlign(isRTL)]}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder={t(isRTL, 'وصف (اختياري)', 'Description (optional)')}
                placeholderTextColor="#bbb"
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[exStyles.formBtn, { flex: 1, backgroundColor: '#F5F5F5', borderColor: '#E0D6F5' }]}
                  onPress={() => { resetForm(); setShowAddForm(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, color: '#888', fontWeight: '600' }}>
                    {t(isRTL, 'إلغاء', 'Cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[exStyles.formBtn, { flex: 1, backgroundColor: DOC_COLOR, opacity: saving ? 0.6 : 1 }]}
                  onPress={handleAdd}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600' }}>
                    {saving ? t(isRTL, 'جاري...', 'Saving...') : t(isRTL, 'حفظ', 'Save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={exStyles.bottomBar}>
            {!showAddForm && (
              <TouchableOpacity style={exStyles.addBtn} onPress={() => setShowAddForm(true)} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={20} color={DOC_COLOR} />
                <Text style={exStyles.addBtnText}>{t(isRTL, 'إضافة تمرين', 'Add Exercise')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={exStyles.saveBtn} onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={exStyles.saveBtnText}>{t(isRTL, 'حفظ وإغلاق', 'Save & Close')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const exStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0EBFA',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F0EBFA',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: '#2d2d2d' },
  headerSub:    { fontSize: 12, color: DOC_COLOR, marginTop: 2 },
  listContent:  { padding: 16, paddingBottom: 8, gap: 10 },
  emptyState:   { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText:    { fontSize: 14, color: '#B0BEC5', textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 0.5, borderColor: '#E8DFFA',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  cardEmoji:  { fontSize: 28, width: 40, textAlign: 'center' },
  cardTitle:  { fontSize: 14, fontWeight: '600', color: '#2d2d2d' },
  cardMeta:   { fontSize: 12, color: DOC_COLOR, fontWeight: '600' },
  cardDesc:   { fontSize: 11, color: '#B0BEC5', marginTop: 3, lineHeight: 16 },
  doneBadge:  { backgroundColor: '#E8F5EF', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  doneBadgeText: { fontSize: 11, fontWeight: '700', color: '#4CAF82' },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FDEAEA',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  addForm: {
    backgroundColor: '#F8F5FF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E8DFFA', gap: 10, marginTop: 4,
  },
  addFormTitle: { fontSize: 14, fontWeight: '700', color: DOC_COLOR },
  input: {
    borderWidth: 1.5, borderColor: '#E0D6F5',
    borderRadius: 10, fontSize: 14, padding: 10,
    backgroundColor: '#fff', color: '#333',
  },
  formBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  bottomBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0EBFA',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0EBFA', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1.5, borderColor: DOC_COLOR,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: DOC_COLOR },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: DOC_COLOR, borderRadius: 12, paddingVertical: 13,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ─── Main Screen ──────────────────────────────────────────
export default function Docpatient() {
  const { patientId, patientName, isOnline: isOnlineParam } =
    useLocalSearchParams<{ patientId: string; patientName: string; isOnline: string }>();

  const { isRTL }      = useLang();
  const { markAsRead } = useChats();
  const insets         = useSafeAreaInsets();
  const isOnline       = isOnlineParam === '1';

  const doctorId = auth.currentUser?.uid ?? '';
  const chatId   = doctorId && patientId ? `${doctorId}_${patientId}` : '';

  const [messages,       setMessages]       = useState<Message[]>([]);
  const [exerciseAccess, setExerciseAccess] = useState(false);
  const [showExercises,  setShowExercises]  = useState(false);
  const [inputText,      setInputText]      = useState('');
  const [showQuick,      setShowQuick]      = useState(false);
  const listRef   = useRef<FlatList>(null);
  const quickAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    if (patientId) markAsRead(patientId);
  }, [patientId]));

  // ─── onSnapshot: messages ─────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map(d => {
        const data = d.data() as FSMessage;
        return {
          id:     d.id,
          text:   data.text,
          sender: data.sender,
          time:   new Date(data.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          status: data.status,
          type:   data.type,
        };
      });
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    });
    return unsub;
  }, [chatId]);

  // ─── onSnapshot: exerciseAccess ───────────────────────
  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (snap.exists()) setExerciseAccess((snap.data() as FSChat).exerciseAccess ?? false);
    });
    return unsub;
  }, [chatId]);

  const initials = patientName
    ? patientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  const toggleQuick = () => {
    setShowQuick(prev => {
      Animated.spring(quickAnim, { toValue: prev ? 0 : 1, tension: 120, friction: 8, useNativeDriver: true }).start();
      return !prev;
    });
  };

  // ─── Shared chat updater ───────────────────────────────
  const updateChatMeta = useCallback((lastMessage: string, ts: number) =>
    updateDoc(doc(db, 'chats', chatId), {
      lastMessage, lastMessageTime: ts, lastMessageSender: 'doctor',
    }).catch(() => {}),
  [chatId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !chatId) return;
    const ts = Date.now();
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: text.trim(), sender: 'doctor', timestamp: ts, status: 'sent', type: 'text',
    }).catch(() => {});
    await updateChatMeta(text.trim(), ts);
    notifyMessageSent(patientName || 'مريض', patientId || '', text.trim()).catch(() => {});
    setInputText('');
    setShowQuick(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatId, patientId, patientName, updateChatMeta]);

  const requestExerciseAccess = useCallback(async () => {
    if (!chatId) return;
    const ts = Date.now();
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: 'طلب الدكتور إذنك لإدارة تمارينك',
      sender: 'doctor', timestamp: ts, status: 'sent', type: 'request_access',
    }).catch(() => {});
    await updateChatMeta('🏋️ طلب صلاحية التمارين', ts);
  }, [chatId, updateChatMeta]);

  const handleExerciseBtn = () => exerciseAccess ? setShowExercises(true) : requestExerciseAccess();

  const handleQuickReply = (text: string) => {
    sendMessage(text);
    Animated.timing(quickAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    setShowQuick(false);
  };

  const keyboardOffset = 68 + insets.top;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={DOC_COLOR} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={[styles.headerAvatar, isOnline && styles.headerAvatarOnline]}>
            <Text style={styles.headerInitials}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{patientName || 'مريض'}</Text>
            <View style={styles.onlineRow}>
              <View style={[styles.onlineDot, !isOnline && styles.offlineDot]} />
              <Text style={[styles.onlineText, !isOnline && styles.offlineText]}>
                {isOnline ? 'نشط الآن' : 'غير متصل'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.exerciseBtn, exerciseAccess && styles.exerciseBtnActive]}
          activeOpacity={0.8}
          onPress={handleExerciseBtn}
        >
          <Ionicons name="barbell-outline" size={20} color={exerciseAccess ? '#fff' : DOC_COLOR} />
          {exerciseAccess && <View style={styles.exerciseBtnDot} />}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={<DateDivider label="اليوم" />}
          renderItem={({ item }) => <MessageBubble msg={item} isRTL={isRTL} />}
        />

        {showQuick && (
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[
              styles.quickWrap,
              {
                opacity: quickAnim,
                transform: [{ translateY: quickAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}
            contentContainerStyle={styles.quickContent}
          >
            {QUICK_REPLIES.map((q, i) => (
              <TouchableOpacity key={i} onPress={() => handleQuickReply(q)} style={styles.quickChip} activeOpacity={0.8}>
                <Text style={styles.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </Animated.ScrollView>
        )}

        <View style={[styles.inputBar, rtlRow(isRTL)]}>
          <TouchableOpacity
            onPress={toggleQuick}
            style={[styles.iconBtn, showQuick && styles.iconBtnActive]}
            activeOpacity={0.8}
          >
            <Ionicons name={showQuick ? 'close' : 'flash'} size={20} color={showQuick ? '#fff' : DOC_COLOR} />
          </TouchableOpacity>

          <View style={[styles.inputWrap, rtlRow(isRTL)]}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="اكتب رسالة..."
              placeholderTextColor={Colors.textMuted}
              style={[styles.textInput, rtlAlign(isRTL)]}
              multiline
              maxLength={500}
              returnKeyType="default"
            />
          </View>

          <TouchableOpacity
            onPress={() => sendMessage(inputText)}
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            activeOpacity={0.8}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: isRTL ? 0 : 2 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ExerciseManagementModal
        visible={showExercises}
        onClose={() => setShowExercises(false)}
        patientId={patientId || ''}
        isRTL={isRTL}
        patientName={patientName}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5FF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.base, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0EBFA',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: DOC_COLOR + '40' },
  headerAvatarOnline: { borderColor: '#4CAF82' },
  headerInitials:     { fontSize: 16, fontWeight: '800', color: DOC_COLOR },
  headerName:         { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, maxWidth: 160 },
  onlineRow:          { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF82' },
  offlineDot:         { backgroundColor: '#B0BEC5' },
  onlineText:         { fontSize: 11, color: '#4CAF82', fontWeight: '600' },
  offlineText:        { color: '#B0BEC5' },
  exerciseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  exerciseBtnActive: { backgroundColor: DOC_COLOR },
  exerciseBtnDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#4CAF82',
    borderWidth: 1.5, borderColor: '#fff',
  },
  listContent:  { paddingHorizontal: Spacing.base, paddingBottom: 12 },
  quickWrap:    { maxHeight: 50, marginBottom: 4 },
  quickContent: { paddingHorizontal: Spacing.base, gap: 8, alignItems: 'center' },
  quickChip: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: DOC_COLOR + '40',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  quickChipText: { fontSize: 12, color: DOC_COLOR, fontWeight: '600' },
  inputBar: {
    alignItems: 'flex-end', gap: 8,
    paddingHorizontal: Spacing.base, paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F0EBFA',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  inputWrap: {
    flex: 1, backgroundColor: Colors.background,
    borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#E8DFFA',
    minHeight: 44, maxHeight: 120,
  },
  textInput:       { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0, lineHeight: 20 },
  iconBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive:   { backgroundColor: DOC_COLOR },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: DOC_COLOR, alignItems: 'center', justifyContent: 'center', shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  sendBtnDisabled: { backgroundColor: '#B0BEC5', shadowOpacity: 0 },
});