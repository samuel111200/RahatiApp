// app/tabs/doctorchat.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, TextInput, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';

type Message = {
  id: string;
  text: string;
  sender: 'patient' | 'doctor';
  time: string;
  status?: 'sent' | 'delivered' | 'read';
};

function nowTime() {
  return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

const WELCOME_MESSAGES: Record<string, string> = {
  '1': 'أهلاً! أنا د. أحمد. كيف أستطيع مساعدتك في برنامج التمارين العلاجية؟',
  '2': 'مرحباً! أنا د. سارة. هل لديك أسئلة عن الطاقة أو التغذية؟',
  '3': 'أهلاً بك! أنا د. خالد. كيف يمكنني مساعدتك اليوم؟',
  '4': 'مرحباً! أنا د. فاطمة. أنا هنا للاستماع ومساعدتك.',
  '5': 'أهلاً! أنا د. محمد. هل لديك أسئلة عن التغذية أو الحمية؟',
};

const WELCOME_EN: Record<string, string> = {
  '1': "Hello! I'm Dr. Ahmed. How can I help you with your therapy program?",
  '2': "Hi! I'm Dr. Sara. Any questions about energy or nutrition?",
  '3': "Hello! I'm Dr. Khaled. How can I help you today?",
  '4': "Hi! I'm Dr. Fatma. I'm here to listen and help you.",
  '5': "Hello! I'm Dr. Mohamed. Any questions about nutrition or diet?",
};

const QUICK_REPLIES_AR = [
  'عندي سؤال عن التمارين',
  'أشعر بألم',
  'شكراً دكتور',
  'هل يمكنني تغيير موعدي؟',
  'أريد نصيحة',
];

const QUICK_REPLIES_EN = [
  'I have a question about exercises',
  'I feel pain',
  'Thank you doctor',
  'Can I change my appointment?',
  'I need advice',
];

function MessageBubble({
  msg, isRTL, doctorColor, doctorBg,
}: {
  msg: Message; isRTL: boolean; doctorColor: string; doctorBg: string;
}) {
  const isPatient = msg.sender === 'patient';
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isPatient ? 20 : -20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

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

export default function DoctorChatScreen() {
  const { isRTL } = useLang();
  const params = useLocalSearchParams<{
    doctorId: string; doctorName: string; doctorEmoji: string;
    doctorColor: string; doctorBg: string; specialty: string;
  }>();

  const doctorId    = params.doctorId    ?? '1';
  const doctorName  = params.doctorName  ?? 'الدكتور';
  const doctorEmoji = params.doctorEmoji ?? '🩺';
  const doctorColor = params.doctorColor ?? Colors.primary;
  const doctorBg    = params.doctorBg    ?? Colors.primaryUltraLight;
  const specialty   = params.specialty   ?? '';

  const welcomeText = isRTL
    ? (WELCOME_MESSAGES[doctorId] ?? 'أهلاً! كيف يمكنني مساعدتك؟')
    : (WELCOME_EN[doctorId]       ?? 'Hello! How can I help you?');

  const [messages, setMessages] = useState<Message[]>([
    { id: 'w1', text: welcomeText, sender: 'doctor', time: nowTime(), status: 'read' },
  ]);

  const [inputText, setInputText] = useState('');
  const [showQuick, setShowQuick] = useState(false);
  const listRef   = useRef<FlatList>(null);
  const quickAnim = useRef(new Animated.Value(0)).current;

  const quickReplies = isRTL ? QUICK_REPLIES_AR : QUICK_REPLIES_EN;

  const toggleQuick = () => {
    const toVal = showQuick ? 0 : 1;
    setShowQuick(!showQuick);
    Animated.spring(quickAnim, { toValue: toVal, tension: 120, friction: 8, useNativeDriver: true }).start();
  };

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'patient',
      time: nowTime(),
      status: 'sent',
    };
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setShowQuick(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    setTimeout(() => {
      const autoReply: Message = {
        id: `auto_${Date.now()}`,
        text: isRTL
          ? 'شكراً على رسالتك، سأرد عليك في أقرب وقت ممكن 🙏'
          : 'Thank you for your message, I will reply as soon as possible 🙏',
        sender: 'doctor',
        time: nowTime(),
        status: 'read',
      };
      setMessages(prev => [...prev, autoReply]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }, 2000);
  }, [isRTL]);

  const handleQuickReply = (text: string) => {
    sendMessage(text);
    Animated.timing(quickAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    setShowQuick(false);
  };

  return (
    // ✅ استخدم SafeAreaView بدل View عشان يحترم الـ notch والـ status bar
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={doctorColor} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={[styles.headerAvatar, { backgroundColor: doctorBg }]}>
            <Text style={{ fontSize: 20 }}>{doctorEmoji}</Text>
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{doctorName}</Text>
            <Text style={[styles.headerSpec, { color: doctorColor }]} numberOfLines={1}>
              {specialty}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.callBtn, { backgroundColor: doctorBg }]} activeOpacity={0.8}>
          <Ionicons name="call-outline" size={18} color={doctorColor} />
        </TouchableOpacity>
      </View>

      {/* ── Notice ── */}
      <View style={[styles.noticeBanner, { borderColor: doctorColor + '30' }]}>
        <Ionicons name="information-circle-outline" size={14} color={doctorColor} />
        <Text style={[styles.noticeText, { color: doctorColor }]}>
          {isRTL
            ? 'الشات دلوقتي محلي — هيتربط بالسيرفر قريباً'
            : 'Chat is currently local — will connect to server soon'}
        </Text>
      </View>

      {/* ✅ KeyboardAvoidingView بيملا باقي الشاشة بعد الهيدر */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
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
            />
          )}
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
            {quickReplies.map((q, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleQuickReply(q)}
                style={[styles.quickChip, { borderColor: doctorColor + '50' }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.quickChipText, { color: doctorColor }]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </Animated.ScrollView>
        )}

        {/* ✅ Input bar بدون أي padding تحت — مفيش tab bar هنا */}
        <View style={styles.inputBarWrap}>
          <View style={[styles.inputBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              onPress={toggleQuick}
              style={[styles.iconBtn, { backgroundColor: showQuick ? doctorColor : doctorBg }]}
              activeOpacity={0.8}
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
                placeholder={isRTL ? 'اكتب رسالتك...' : 'Write your message...'}
                placeholderTextColor={Colors.textMuted}
                style={[styles.textInput, { textAlign: isRTL ? 'right' : 'left' }]}
                multiline
                maxLength={500}
              />
            </View>

            <TouchableOpacity
              onPress={() => sendMessage(inputText)}
              style={[styles.sendBtn, { backgroundColor: inputText.trim() ? doctorColor : '#B0BEC5' }]}
              activeOpacity={0.8}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ✅ SafeAreaView بيتعامل مع الـ status bar تلقائياً على iOS و Android
  safe: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.base, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  headerName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  headerSpec: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  callBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.base, marginTop: 10, marginBottom: 4,
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  noticeText: { fontSize: 11, fontWeight: '500', flex: 1 },

  listContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 12,
    paddingTop: 8,
  },

  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginBottom: 8 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft:  { justifyContent: 'flex-start' },

  docAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },

  bubble: {
    maxWidth: '75%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bubblePatient: {
    borderBottomRightRadius: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  bubbleDoctor: {
    borderBottomLeftRadius: 4, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  bubbleText: { fontSize: FontSize.base, lineHeight: 22 },
  bubbleMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    marginTop: 4, justifyContent: 'flex-end',
  },
  timeText: { fontSize: 10, color: Colors.textMuted },

  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginVertical: 14, paddingHorizontal: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '600',
    backgroundColor: '#F8F5FF', paddingHorizontal: 8, borderRadius: 8,
  },

  quickWrap:    { maxHeight: 50, marginBottom: 4 },
  quickContent: { paddingHorizontal: Spacing.base, gap: 8, alignItems: 'center' },
  quickChip: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 1,
  },
  quickChipText: { fontSize: 12, fontWeight: '600' },

  // ✅ مفيش paddingBottom هنا — SafeAreaView بيتكلم بدالنا
  inputBarWrap: {
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  inputBar: {
    alignItems: 'flex-end', gap: 8,
    paddingHorizontal: Spacing.base,
    paddingTop: 10,
    paddingBottom: 12, // ✅ padding بسيط بس — مش محتاج قيمة كبيرة
  },
  inputWrap: {
    flex: 1, backgroundColor: Colors.background,
    borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, minHeight: 44, maxHeight: 120,
  },
  textInput: {
    flex: 1, fontSize: FontSize.base,
    color: Colors.textPrimary, padding: 0, lineHeight: 20,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
});