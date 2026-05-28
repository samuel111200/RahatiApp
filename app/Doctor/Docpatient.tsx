import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import { useChats } from '../../context/Chatscontext';

const DOC_COLOR       = '#7C5CBF';
const DOC_COLOR_LIGHT = '#F0EBFA';
const MESSAGES_KEY    = 'doc_messages'; // نفس الـ key في Docchat

type Message = {
  id: string;
  text: string;
  sender: 'doctor' | 'patient';
  time: string;
  status?: 'sent' | 'delivered' | 'read';
};

function now() {
  return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

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

// ─── Main Screen ──────────────────────────────────────────
export default function Docpatient() {
  const { patientId, patientName, isOnline: isOnlineParam } =
    useLocalSearchParams<{ patientId: string; patientName: string; isOnline: string }>();

  const { isRTL }      = useLang();
  const { markAsRead } = useChats();
  const insets         = useSafeAreaInsets();

  const isOnline = isOnlineParam === '1';

  useFocusEffect(useCallback(() => {
    if (patientId) markAsRead(patientId);
  }, [patientId]));

  const [messages, setMessages] = useState<Message[]>([]);

  // ── حمّل الرسايل المحفوظة لو موجودة ──
  useEffect(() => {
    const loadMsgs = async () => {
      try {
        const raw = await AsyncStorage.getItem(`doc_chat_${patientId}`);
        if (raw) {
          setMessages(JSON.parse(raw));
        } else {
          const initialMsgs: Message[] = [
            { id: 'd1', text: 'أهلاً دكتور، أنا عندي ألم في الظهر من يومين',                         sender: 'patient', time: '10:23 ص', status: 'read' },
            { id: 'd2', text: 'أهلاً، هل الألم مستمر ولا بيجي ويروح؟',                                sender: 'doctor',  time: '10:24 ص', status: 'read' },
            { id: 'd3', text: 'بيجي ويروح خصوصاً لما بقعد كتير',                                       sender: 'patient', time: '10:25 ص', status: 'read' },
            { id: 'd4', text: 'حسناً، ده غالباً من الجلوس الطويل. حاول تمشي كل ساعة وخد مسكن خفيف', sender: 'doctor',  time: '10:26 ص', status: 'read' },
          ];
          setMessages(initialMsgs);
          // احفظ الرسايل الابتدائية فوراً عشان Docchat يلاقيها
          await AsyncStorage.setItem(`doc_chat_${patientId}`, JSON.stringify(initialMsgs));
          // حدّث MESSAGES_KEY بآخر رسالة ابتدائية
          const lastMsg = initialMsgs[initialMsgs.length - 1];
          const msgsRaw = await AsyncStorage.getItem(MESSAGES_KEY);
          const store   = msgsRaw ? JSON.parse(msgsRaw) : {};
          store[patientId] = { text: lastMsg.text, time: lastMsg.time, sender: lastMsg.sender };
          await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(store));
        }
      } catch {}
    };
    if (patientId) loadMsgs();
  }, [patientId]);

  // ── احفظ الرسايل وحدّث آخر رسالة في الـ MESSAGES_KEY ──
  const saveMessages = useCallback(async (msgs: Message[]) => {
    if (!patientId) return;
    try {
      // 1) احفظ كل الرسايل
      await AsyncStorage.setItem(`doc_chat_${patientId}`, JSON.stringify(msgs));
      // 2) حدّث آخر رسالة في الـ store المشترك مع Docchat
      const last = msgs[msgs.length - 1];
      if (last) {
        const raw   = await AsyncStorage.getItem(MESSAGES_KEY);
        const store = raw ? JSON.parse(raw) : {};
        store[patientId] = { text: last.text, time: last.time, sender: last.sender };
        await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(store));
      }
    } catch {}
  }, [patientId]);

  const [inputText, setInputText] = useState('');
  const [showQuick, setShowQuick] = useState(false);
  const listRef   = useRef<FlatList>(null);
  const quickAnim = useRef(new Animated.Value(0)).current;

  const initials = patientName
    ? patientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  const toggleQuick = () => {
    const toVal = showQuick ? 0 : 1;
    setShowQuick(!showQuick);
    Animated.spring(quickAnim, { toValue: toVal, tension: 120, friction: 8, useNativeDriver: true }).start();
  };

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(), text: text.trim(),
      sender: 'doctor', time: now(), status: 'sent',
    };
    setMessages(prev => {
      const updated = [...prev, newMsg];
      saveMessages(updated);
      return updated;
    });
    setInputText('');
    setShowQuick(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [saveMessages]);

  const handleQuickReply = (text: string) => {
    sendMessage(text);
    Animated.timing(quickAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    setShowQuick(false);
  };

  const HEADER_HEIGHT  = 68;
  const keyboardOffset = HEADER_HEIGHT + insets.top;

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

        <TouchableOpacity style={styles.exerciseBtn} activeOpacity={0.8}>
          <Ionicons name="barbell-outline" size={20} color={DOC_COLOR} />
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
          keyExtractor={item => item.id}
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
            style={[styles.quickWrap, {
              opacity: quickAnim,
              transform: [{ translateY: quickAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }]}
            contentContainerStyle={styles.quickContent}
          >
            {QUICK_REPLIES.map((q, i) => (
              <TouchableOpacity key={i} onPress={() => handleQuickReply(q)} style={styles.quickChip} activeOpacity={0.8}>
                <Text style={styles.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </Animated.ScrollView>
        )}

        <View style={[styles.inputBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            onPress={toggleQuick}
            style={[styles.iconBtn, showQuick && styles.iconBtnActive]}
            activeOpacity={0.8}
          >
            <Ionicons name={showQuick ? 'close' : 'flash'} size={20} color={showQuick ? '#fff' : DOC_COLOR} />
          </TouchableOpacity>

          <View style={[styles.inputWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="اكتب رسالة..."
              placeholderTextColor={Colors.textMuted}
              style={[styles.textInput, { textAlign: isRTL ? 'right' : 'left' }]}
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
  headerInfo:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: DOC_COLOR + '40' },
  headerAvatarOnline:{ borderColor: '#4CAF82' },
  headerInitials:    { fontSize: 16, fontWeight: '800', color: DOC_COLOR },
  headerName:        { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, maxWidth: 160 },
  onlineRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF82' },
  offlineDot:        { backgroundColor: '#B0BEC5' },
  onlineText:        { fontSize: 11, color: '#4CAF82', fontWeight: '600' },
  offlineText:       { color: '#B0BEC5' },
  exerciseBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center' },
  listContent:       { paddingHorizontal: Spacing.base, paddingBottom: 12 },
  quickWrap:         { maxHeight: 50, marginBottom: 4 },
  quickContent:      { paddingHorizontal: Spacing.base, gap: 8, alignItems: 'center' },
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