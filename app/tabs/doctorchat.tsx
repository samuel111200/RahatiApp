// app/tabs/doctorchat.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput, ScrollView,
  Platform, Animated, Alert, Linking, Image, Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, onSnapshot, addDoc, updateDoc, setDoc, doc, query, orderBy, increment, getDoc } from 'firebase/firestore';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import { db } from '../../utils/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { uploadFileToCloudinary } from '../../utils/uploadImage';
import { sendPushToUser } from '../../utils/pushNotifications';
import { subscribeToPresence } from '../../utils/presence';

type MessageStatus = 'sent' | 'delivered' | 'read';
type Message = {
  id: string; text: string; sender: 'patient' | 'doctor'; time: string;
  status?: MessageStatus; type?: 'text' | 'request_access' | 'file' | 'image';
  fileUrl?: string; fileName?: string; fileSize?: number;
};

function nowTime() {
  return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}
function tsToTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadFile(url: string, fileName: string, isImage: boolean, isRTL: boolean, t: any) {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(isRTL ? 'خطأ' : 'Error', t.storagePerm); return;
    }
    const destPath = Paths.join(Paths.cache.uri, fileName);
    const download = await FileSystem.downloadAsync(url, destPath);
    if (isImage) {
      await MediaLibrary.saveToLibraryAsync(download.uri);
      Alert.alert(t.saved, t.savedToGallery);
    } else {
      Alert.alert(
          t.downloaded, `${t.fileSaved}: ${fileName}`,
          [
            { text: isRTL ? 'حسناً' : 'OK' },
            { text: t.open, onPress: () => Linking.openURL(download.uri) },
          ],
      );
    }
  } catch {
    Alert.alert(isRTL ? 'خطأ' : 'Error', t.downloadFailed);
  }
}

// ─── Access Request Card ──────────────────────────────────
function AccessRequestCard({ isRTL, doctorColor, doctorBg, chatId, t }: {
  isRTL: boolean; doctorColor: string; doctorBg: string; chatId: string; t: any;
}) {
  const [loading,  setLoading]  = useState(false);
  const [accepted, setAccepted] = useState(false);

  // read exerciseAccess from Firestore so state survives logout/login
  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (snap.exists() && snap.data().exerciseAccess === true) setAccepted(true);
    });
    return unsub;
  }, [chatId]);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'chats', chatId), { exerciseAccess: true });
      setAccepted(true);
    } catch {
      Alert.alert(isRTL ? 'خطأ' : 'Error', t.failedToAccept);
    }
    setLoading(false);
  };

  if (accepted) {
    return (
        <View style={[styles.accessCard, { borderColor: '#4CAF5040', backgroundColor: '#E8F5E9' }]}>
          <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
          <Text style={[styles.accessTitle, { color: '#4CAF50' }]}>{t.accessGranted}</Text>
        </View>
    );
  }

  return (
      <View style={[styles.accessCard, { borderColor: doctorColor + '40', backgroundColor: doctorBg }]}>
        <Ionicons name="fitness-outline" size={28} color={doctorColor} />
        <Text style={[styles.accessTitle, { color: doctorColor, textAlign: isRTL ? 'right' : 'left' }]}>
          {t.exerciseAccessRequest}
        </Text>
        <Text style={[styles.accessDesc, { textAlign: 'center' }]}>{t.exerciseAccessDesc}</Text>
        <View style={[styles.accessBtns, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
              onPress={handleAccept} disabled={loading}
              style={[styles.accessBtn, styles.acceptBtn, { backgroundColor: doctorColor, opacity: loading ? 0.7 : 1 }]}
              activeOpacity={0.8}
          >
            <Text style={styles.acceptBtnText}>{t.accept}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.accessBtn, styles.declineBtn, { borderColor: doctorColor + '50' }]} activeOpacity={0.8}>
            <Text style={[styles.declineBtnText, { color: doctorColor }]}>{t.decline}</Text>
          </TouchableOpacity>
        </View>
      </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────
function MessageBubble({ msg, isRTL, doctorColor, doctorBg, chatId, t }: {
  msg: Message; isRTL: boolean; doctorColor: string; doctorBg: string; chatId: string; t: any;
}) {
  const isAccessRequest = msg.type === 'request_access';
  const isFile          = msg.type === 'file';
  const isImage         = msg.type === 'image';
  const isPatient       = msg.sender === 'patient';
  const fadeAnim        = useRef(new Animated.Value(0)).current;
  const slideAnim       = useRef(new Animated.Value(isPatient ? 20 : -20)).current;

  useEffect(() => {
    if (isAccessRequest) return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  if (isAccessRequest) {
    return (
        <View style={styles.accessCardWrap}>
          <AccessRequestCard isRTL={isRTL} doctorColor={doctorColor} doctorBg={doctorBg} chatId={chatId} t={t} />
        </View>
    );
  }

  if (isFile || isImage) {
    return (
        <Animated.View style={[styles.msgRow, isPatient ? styles.msgRowRight : styles.msgRowLeft, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
          {!isPatient && (
              <View style={[styles.docAvatar, { backgroundColor: doctorBg }]}>
                <Ionicons name="person" size={13} color={doctorColor} />
              </View>
          )}
          <TouchableOpacity
              style={[styles.fileBubble, isPatient ? { backgroundColor: Colors.primary } : { backgroundColor: '#fff', borderColor: doctorColor + '30', borderWidth: 1.5 }]}
              activeOpacity={0.8}
              onPress={() => { if (msg.fileUrl) downloadFile(msg.fileUrl, msg.fileName ?? 'file', !!isImage, isRTL, t); }}
          >
            <View style={styles.fileBubbleInner}>
              <View style={[styles.fileIconWrap, { backgroundColor: isPatient ? 'rgba(255,255,255,0.2)' : doctorColor + '15' }]}>
                <Ionicons name={isImage ? 'image-outline' : 'document-outline'} size={22} color={isPatient ? '#fff' : doctorColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fileName, { color: isPatient ? '#fff' : Colors.textPrimary }]} numberOfLines={1}>
                  {msg.fileName ?? (isImage ? (isRTL ? 'صورة' : 'Image') : (isRTL ? 'ملف' : 'File'))}
                </Text>
                {!!msg.fileSize && (
                    <Text style={[styles.fileSize, { color: isPatient ? 'rgba(255,255,255,0.7)' : Colors.textMuted }]}>
                      {formatFileSize(msg.fileSize)}
                    </Text>
                )}
              </View>
              <Ionicons name="download-outline" size={18} color={isPatient ? '#fff' : doctorColor} />
            </View>
            <View style={styles.bubbleMeta}>
              <Text style={[styles.timeText, isPatient && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
              {isPatient && (
                  <Ionicons
                      name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'}
                      size={12}
                      color={msg.status === 'read' ? '#93E0FF' : 'rgba(255,255,255,0.6)'}
                  />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
    );
  }

  return (
      <Animated.View style={[styles.msgRow, isPatient ? styles.msgRowRight : styles.msgRowLeft, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {!isPatient && (
            <View style={[styles.docAvatar, { backgroundColor: doctorBg }]}>
              <Ionicons name="person" size={13} color={doctorColor} />
            </View>
        )}
        <View style={[
          styles.bubble,
          isPatient ? [styles.bubblePatient, { backgroundColor: Colors.primary }] : [styles.bubbleDoctor, { backgroundColor: '#fff', borderColor: doctorColor + '30' }],
        ]}>
          <Text style={[styles.bubbleText, isPatient ? { color: '#fff' } : { color: Colors.textPrimary }, { textAlign: isRTL ? 'right' : 'left' }]}>
            {msg.text}
          </Text>
          <View style={styles.bubbleMeta}>
            <Text style={[styles.timeText, isPatient && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
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
  const { isRTL, t } = useLang();
  const params = useLocalSearchParams<{
    doctorId: string; doctorName: string; doctorEmoji: string;
    doctorColor: string; doctorBg: string; specialty: string; isFirebase: string;
  }>();

  const doctorId    = params.doctorId    ?? '1';
  const doctorName  = params.doctorName  ?? (isRTL ? 'الدكتور' : 'Doctor');
  const doctorEmoji = params.doctorEmoji ?? '🩺';
  const doctorColor = params.doctorColor ?? Colors.primary;
  const doctorBg    = params.doctorBg    ?? Colors.primaryUltraLight;
  const specialty   = params.specialty   ?? '';
  const isFirebase  = params.isFirebase  === '1';

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const patientId = user?.uid ?? '';
  const chatId    = isFirebase ? `${doctorId}_${patientId}` : '';

  const welcomeText = isRTL
      ? 'أهلاً! كيف يمكنني مساعدتك؟'
      : 'Hello! How can I help you?';

  const [messages,  setMessages]  = useState<Message[]>(
      isFirebase ? [] : [{ id: 'w1', text: welcomeText, sender: 'doctor', time: nowTime(), status: 'read' }],
  );
  const [inputText,       setInputText]       = useState('');
  const [showQuick,       setShowQuick]       = useState(false);
  const [showAttach,      setShowAttach]      = useState(false);
  const [kbHeight,        setKbHeight]        = useState(0);
  const [uploading,       setUploading]       = useState(false);
  const [doctorOnline,    setDoctorOnline]    = useState(false);
  const [doctorPhotoUrl,  setDoctorPhotoUrl]  = useState<string | null>(null);
  const listRef    = useRef<FlatList>(null);
  const quickAnim  = useRef(new Animated.Value(0)).current;
  const attachAnim = useRef(new Animated.Value(0)).current;

  const quickReplies: string[] = t.docQuickReplies;

  // scroll to end when keyboard opens
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      if (Platform.OS === 'android') setKbHeight(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      if (Platform.OS === 'android') setKbHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!isFirebase || !doctorId) return;
    return subscribeToPresence(doctorId, (online) => setDoctorOnline(online));
  }, [isFirebase, doctorId]);

  useEffect(() => {
    if (!isFirebase || !doctorId) return;
    getDoc(doc(db, 'users', doctorId)).then(snap => {
      if (snap.exists()) setDoctorPhotoUrl(snap.data().photoUrl ?? null);
    }).catch(() => {});
  }, [isFirebase, doctorId]);

  useEffect(() => {
    if (!isFirebase || !chatId) return;
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map(d => {
        const data = d.data();
        const raw = data.status as string | undefined;
        const status: MessageStatus | undefined = raw === 'read' || raw === 'delivered' || raw === 'sent' ? raw : undefined;
        return {
          id: d.id, text: data.text ?? '', sender: data.sender as 'patient' | 'doctor',
          time: tsToTime(data.timestamp ?? Date.now()),
          status, type: data.type ?? 'text',
          fileUrl: data.fileUrl, fileName: data.fileName, fileSize: data.fileSize,
        };
      });
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsub();
  }, [isFirebase, chatId]);

  const toggleQuick = () => {
    const toVal = showQuick ? 0 : 1;
    setShowQuick(!showQuick);
    if (showAttach) { setShowAttach(false); Animated.timing(attachAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(); }
    Animated.spring(quickAnim, { toValue: toVal, tension: 120, friction: 8, useNativeDriver: true }).start();
  };

  const toggleAttach = () => {
    const toVal = showAttach ? 0 : 1;
    setShowAttach(!showAttach);
    if (showQuick) { setShowQuick(false); Animated.timing(quickAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(); }
    Animated.spring(attachAnim, { toValue: toVal, tension: 120, friction: 8, useNativeDriver: true }).start();
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setInputText(''); setShowQuick(false);
    if (isFirebase && chatId && patientId) {
      try {
        const now = Date.now();
        await addDoc(collection(db, 'chats', chatId, 'messages'), { text: text.trim(), sender: 'patient', timestamp: now, status: 'sent', type: 'text' });
        await setDoc(doc(db, 'chats', chatId), {
          doctorId, patientId,
          patientName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || (isRTL ? 'مريض' : 'Patient'),
          lastMessage: text.trim(), lastMessageTime: now, lastMessageSender: 'patient',
          unreadCountDoctor: increment(1),
        }, { merge: true });
        sendPushToUser(doctorId, isRTL ? '💬 رسالة جديدة من مريضك' : '💬 New message from your patient', text.trim()).catch(() => {});
      } catch { Alert.alert(isRTL ? 'خطأ' : 'Error', t.sendFailed); }
      return;
    }
    const newMsg: Message = { id: Date.now().toString(), text: text.trim(), sender: 'patient', time: nowTime(), status: 'sent' };
    setMessages(prev => [...prev, newMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    setTimeout(() => {
      const autoReply: Message = {
        id: `auto_${Date.now()}`,
        text: isRTL ? 'شكراً على رسالتك، سأرد عليك في أقرب وقت ممكن 🙏' : 'Thank you for your message, I will reply as soon as possible 🙏',
        sender: 'doctor', time: nowTime(), status: 'read',
      };
      setMessages(prev => [...prev, autoReply]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }, 2000);
  }, [isRTL, isFirebase, chatId, patientId]);

  const sendFileMessage = async (fileUri: string, fileName: string, fileSize: number | undefined, type: 'file' | 'image', mimeType = 'application/octet-stream') => {
    setUploading(true); setShowAttach(false);
    Animated.timing(attachAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    try {
      const cloudUrl = await uploadFileToCloudinary(fileUri, mimeType, fileName);
      const now = Date.now();
      const status: MessageStatus = 'sent';
      const msgData = {
        text: type === 'image' ? (isRTL ? '📷 صورة' : '📷 Image') : `📎 ${fileName}`,
        sender: 'patient' as const, timestamp: now, status, type, fileUrl: cloudUrl, fileName, fileSize,
      };
      if (isFirebase && chatId && patientId) {
        await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
        await setDoc(doc(db, 'chats', chatId), {
          doctorId, patientId,
          patientName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || (isRTL ? 'مريض' : 'Patient'),
          lastMessage: msgData.text, lastMessageTime: now, lastMessageSender: 'patient',
          unreadCountDoctor: increment(1),
        }, { merge: true });
        sendPushToUser(doctorId, isRTL ? '💬 رسالة جديدة من مريضك' : '💬 New message from your patient', msgData.text).catch(() => {});
      } else {
        const localMsg: Message = { id: String(now), ...msgData, time: nowTime() };
        setMessages(prev => [...prev, localMsg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch { Alert.alert(isRTL ? 'خطأ' : 'Error', t.sendFileFailed); }
    finally { setUploading(false); }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      await sendFileMessage(asset.uri, asset.name, asset.size, 'file', asset.mimeType ?? 'application/octet-stream');
    } catch { Alert.alert(isRTL ? 'خطأ' : 'Error', t.sendFileFailed); }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(isRTL ? 'خطأ' : 'Error', t.galleryPerm); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    await sendFileMessage(asset.uri, asset.uri.split('/').pop() ?? 'image.jpg', undefined, 'image', asset.mimeType ?? `image/${ext}`);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert(isRTL ? 'خطأ' : 'Error', t.cameraPerm); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    await sendFileMessage(result.assets[0].uri, `photo_${Date.now()}.jpg`, undefined, 'image', 'image/jpeg');
  };

  const handleQuickReply = (text: string) => {
    sendMessage(text);
    Animated.timing(quickAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    setShowQuick(false);
  };

  return (
      <SafeAreaView style={styles.safeOuter} edges={['top', 'left', 'right']}>
        <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/tabs/doctors')} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={doctorColor} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={[styles.headerAvatar, { backgroundColor: doctorBg }]}>
              {doctorPhotoUrl
                  ? <Image source={{ uri: doctorPhotoUrl }} style={styles.headerAvatarImg} />
                  : <Text style={{ fontSize: 20 }}>{doctorEmoji}</Text>}
            </View>
            <View>
              <Text style={styles.headerName} numberOfLines={1}>{doctorName}</Text>
              {isFirebase ? (
                  <View style={styles.onlineRow}>
                    <View style={[styles.onlineDot, !doctorOnline && styles.offlineDot]} />
                    <Text style={[styles.onlineText, !doctorOnline && styles.offlineText]}>
                      {doctorOnline ? (isRTL ? 'متصل الآن' : 'Online') : (isRTL ? 'غير متصل' : 'Offline')}
                    </Text>
                  </View>
              ) : (
                  <Text style={[styles.headerSpec, { color: doctorColor }]} numberOfLines={1}>{specialty}</Text>
              )}
            </View>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {!isFirebase && (
            <View style={[styles.noticeBanner, { borderColor: doctorColor + '30' }]}>
              <Ionicons name="information-circle-outline" size={14} color={doctorColor} />
              <Text style={[styles.noticeText, { color: doctorColor }]}>{t.chatIsLocal}</Text>
            </View>
        )}

        <KeyboardAvoidingView
            style={{ flex: 1, marginBottom: kbHeight }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={item => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListHeaderComponent={<DateDivider label={t.today} />}
              renderItem={({ item }) => (
                  <MessageBubble msg={item} isRTL={isRTL} doctorColor={doctorColor} doctorBg={doctorBg} chatId={chatId} t={t} />
              )}
          />

          {showQuick && (
              <View style={styles.quickWrap}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
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
                </ScrollView>
              </View>
          )}

          {showAttach && (
              <Animated.View style={[styles.attachMenu, { opacity: attachAnim, transform: [{ translateY: attachAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                <TouchableOpacity style={styles.attachItem} onPress={handlePickDocument} activeOpacity={0.8}>
                  <View style={[styles.attachIcon, { backgroundColor: '#E8F1FB' }]}>
                    <Ionicons name="document-outline" size={22} color="#5B9BD5" />
                  </View>
                  <Text style={styles.attachLabel}>{t.file}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachItem} onPress={handlePickImage} activeOpacity={0.8}>
                  <View style={[styles.attachIcon, { backgroundColor: '#E8F5EF' }]}>
                    <Ionicons name="image-outline" size={22} color="#4CAF82" />
                  </View>
                  <Text style={styles.attachLabel}>{t.gallery}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachItem} onPress={handleTakePhoto} activeOpacity={0.8}>
                  <View style={[styles.attachIcon, { backgroundColor: '#FEF3E2' }]}>
                    <Ionicons name="camera-outline" size={22} color="#F4A32B" />
                  </View>
                  <Text style={styles.attachLabel}>{t.camera}</Text>
                </TouchableOpacity>
              </Animated.View>
          )}

          <View style={[styles.inputBarWrap, { paddingBottom: insets.bottom || 8 }]}>
            {uploading && (
                <View style={styles.uploadingBar}>
                  <Ionicons name="cloud-upload-outline" size={14} color={doctorColor} />
                  <Text style={[styles.uploadingText, { color: doctorColor }]}>{t.sending}</Text>
                </View>
            )}
            <View style={[styles.inputBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                  onPress={toggleQuick}
                  style={[styles.iconBtn, { backgroundColor: showQuick ? doctorColor : doctorBg }]}
                  activeOpacity={0.8}
              >
                <Ionicons name={showQuick ? 'close' : 'flash'} size={18} color={showQuick ? '#fff' : doctorColor} />
              </TouchableOpacity>
              <TouchableOpacity
                  onPress={toggleAttach}
                  style={[styles.iconBtn, { backgroundColor: showAttach ? doctorColor : doctorBg }]}
                  activeOpacity={0.8}
              >
                <Ionicons name={showAttach ? 'close' : 'attach'} size={18} color={showAttach ? '#fff' : doctorColor} />
              </TouchableOpacity>
              <View style={[styles.inputWrap, { borderColor: doctorColor + '40' }]}>
                <TextInput
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={t.writeMessage}
                    placeholderTextColor={Colors.textMuted}
                    style={[styles.textInput, { textAlign: isRTL ? 'right' : 'left' }]}
                    multiline maxLength={500}
                />
              </View>
              <TouchableOpacity
                  onPress={() => sendMessage(inputText)}
                  style={[styles.sendBtn, { backgroundColor: inputText.trim() ? doctorColor : '#B0BEC5' }]}
                  activeOpacity={0.8} disabled={!inputText.trim()}
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
  safeOuter: { flex: 1, backgroundColor: '#F8F5FF' },
  safe: { backgroundColor: '#F8F5FF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.base, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  backBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryUltraLight, alignItems: 'center', justifyContent: 'center' },
  headerInfo:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar:    { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  headerName:      { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  headerSpec:      { fontSize: 11, fontWeight: '600', marginTop: 1 },
  onlineRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  onlineDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF82', marginRight: 5 },
  offlineDot:      { backgroundColor: '#B0BEC5' },
  onlineText:      { fontSize: 11, color: '#4CAF82', fontWeight: '600' },
  offlineText:     { color: '#B0BEC5' },
  noticeBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: Spacing.base, marginTop: 10, marginBottom: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  noticeText:   { fontSize: 11, fontWeight: '500', flex: 1 },
  listContent:  { paddingHorizontal: Spacing.base, paddingBottom: 12, paddingTop: 8 },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginBottom: 8 },
  msgRowRight:  { justifyContent: 'flex-end' },
  msgRowLeft:   { justifyContent: 'flex-start' },
  docAvatar:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  bubble:        { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubblePatient: { borderBottomRightRadius: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  bubbleDoctor:  { borderBottomLeftRadius: 4, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  bubbleText:    { fontSize: FontSize.base, lineHeight: 22 },
  bubbleMeta:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, justifyContent: 'flex-end' },
  timeText:      { fontSize: 10, color: Colors.textMuted },
  fileBubble:      { maxWidth: '75%', borderRadius: 16, padding: 10 },
  fileBubbleInner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  fileIconWrap:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fileName:        { fontSize: 13, fontWeight: '600' },
  fileSize:        { fontSize: 10, marginTop: 2 },
  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14, paddingHorizontal: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', backgroundColor: '#F8F5FF', paddingHorizontal: 8, borderRadius: 8 },
  quickWrap:    { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 10 },
  quickContent: { paddingHorizontal: Spacing.base, gap: 8, alignItems: 'center', flexDirection: 'row' },
  quickChip:     { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  quickChipText: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  attachMenu:  { flexDirection: 'row', gap: 16, paddingHorizontal: Spacing.base, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border },
  attachItem:  { alignItems: 'center', gap: 6 },
  attachIcon:  { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  attachLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  inputBarWrap:  { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  uploadingBar:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.base, paddingTop: 6 },
  uploadingText: { fontSize: 11, fontWeight: '600' },
  inputBar:  { alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.base, paddingTop: 10, paddingBottom: 0 },
  inputWrap: { flex: 1, backgroundColor: Colors.background, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, minHeight: 44, maxHeight: 120 },
  textInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0, lineHeight: 20 },
  iconBtn:   { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sendBtn:   { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  accessCardWrap: { marginVertical: 6, alignItems: 'center' },
  accessCard:     { width: '90%', borderRadius: 16, borderWidth: 1.5, padding: 16, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  accessTitle:    { fontSize: FontSize.base, fontWeight: '700' },
  accessDesc:     { fontSize: 12, color: Colors.textSecondary },
  accessBtns:     { marginTop: 4, gap: 10 },
  accessBtn:      { paddingHorizontal: 24, paddingVertical: 9, borderRadius: 20 },
  acceptBtn:      { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  declineBtn:     { backgroundColor: '#fff', borderWidth: 1.5 },
  acceptBtnText:  { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  declineBtnText: { fontWeight: '700', fontSize: FontSize.sm },
});