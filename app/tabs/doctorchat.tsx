// app/tabs/doctorchat.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput, ScrollView, Modal,
  Platform, Animated, Alert, Image, Keyboard,
  ActivityIndicator, Linking,
} from 'react-native';
import { Audio } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, onSnapshot, addDoc, updateDoc, setDoc, doc, query, orderBy, increment } from 'firebase/firestore';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import { db } from '../../utils/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { uploadFileToCloudinary } from '../../utils/uploadImage';
import { sendPushToUser } from '../../utils/pushNotifications';
import { subscribeToPresence } from '../../utils/presence';
import { activeChatRef } from '../../utils/activeChatRef';
import { useFocusEffect } from 'expo-router';

type MessageStatus = 'sent' | 'delivered' | 'read';
type Message = {
  id: string; text: string; sender: 'patient' | 'doctor'; time: string;
  status?: MessageStatus; type?: 'text' | 'request_access' | 'file' | 'image' | 'audio';
  fileUrl?: string; fileName?: string; fileSize?: number; mimeType?: string;
  audioDuration?: number;
};
type PickedAttachment = { uri: string; name: string; mimeType: string; size?: number; type: 'image' | 'file'; };

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function fmtTime(ts: number, isRTL: boolean): string {
  const d  = new Date(ts);
  const h  = d.getHours();
  const m  = d.getMinutes();
  const am = h < 12;
  const h12 = h % 12 || 12;
  if (isRTL) {
    const toAr = (n: number, pad = 0) =>
      n.toString().padStart(pad, '0').replace(/\d/g, x => AR_DIGITS[+x]);
    return `${toAr(h12)}:${toAr(m, 2)} ${am ? 'ص' : 'م'}`;
  }
  return `${h12}:${m.toString().padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}
function nowTime(isRTL: boolean) { return fmtTime(Date.now(), isRTL); }
function tsToTime(ts: number, isRTL: boolean) { return fmtTime(ts, isRTL); }

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadFile(url: string, fileName: string, mimeType: string | undefined, isRTL: boolean, t: any = {}) {
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

  const getLocalUri = async (): Promise<string> => {
    const dest = (FileSystem.cacheDirectory ?? '') + fileName;
    return (await FileSystem.downloadAsync(url, dest)).uri;
  };

  const saveToGallery = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (status !== 'granted') { Alert.alert(t.error, t.galleryPermissionRequired); return; }
      await MediaLibrary.saveToLibraryAsync(await getLocalUri());
      Alert.alert(t.saved, t.imageSavedGallery);
    } catch (e) { Alert.alert(t.error, t.imageSaveFailed); }
  };

  const chooseFolder = async () => {
    try {
      const localUri = await getLocalUri();
      const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!perm.granted) return;
      const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
        perm.directoryUri, fileName, mimeType ?? 'application/octet-stream',
      );
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      Alert.alert(t.saved, t.fileSavedSuccess);
    } catch (e) { Alert.alert(t.error, t.fileSaveFailed); }
  };

  const buttons: any[] = [];
  if (isImage) buttons.push({ text: t.saveToGalleryBtn, onPress: saveToGallery });
  buttons.push({ text: t.chooseFolderBtn, onPress: chooseFolder });
  buttons.push({ text: t.cancel, style: 'cancel' });
  Alert.alert(t.downloadTitle, t.downloadSubtitle, buttons);
}

// ─── Access Request Card ──────────────────────────────────
function AccessRequestCard({ isRTL, doctorColor, doctorBg, chatId, t }: {
  isRTL: boolean; doctorColor: string; doctorBg: string; chatId: string; t: any;
}) {
  const [loading,  setLoading]  = useState(false);
  const [accepted, setAccepted] = useState(false);

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
    } catch { Alert.alert(t.error, t.failedToAccept); }
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
function MessageBubble({ msg, isRTL, doctorColor, doctorBg, chatId, t, doctorPhotoUrl, onReply }: {
  msg: Message; isRTL: boolean; doctorColor: string; doctorBg: string; chatId: string; t: any;
  doctorPhotoUrl?: string | null; onReply?: (msg: Message) => void;
}) {
  const isPatient   = msg.sender === 'patient';
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(isPatient ? 20 : -20)).current;
  const [viewingFull, setViewingFull] = useState(false);
  const [saving,      setSaving]      = useState(false);

  const handleSave = async () => {
    if (!msg.fileUrl || saving) return;
    setSaving(true);
    await downloadFile(msg.fileUrl, msg.fileName ?? 'file', msg.mimeType, isRTL, t);
    setSaving(false);
  };

  const openFile = async () => {
    if (!msg.fileUrl) return;
    try { await Linking.openURL(msg.fileUrl); }
    catch { Alert.alert(t.error, t.couldNotOpenFile); }
  };

  useEffect(() => {
    if (msg.type === 'request_access') return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const DoctorAvatar = () => (
    <View style={[styles.docAvatar, { backgroundColor: doctorBg }]}>
      {doctorPhotoUrl
        ? <Image source={{ uri: doctorPhotoUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
        : <Ionicons name="person" size={13} color={doctorColor} />}
    </View>
  );

  if (msg.type === 'request_access') {
    return (
      <View style={styles.accessCardWrap}>
        <AccessRequestCard isRTL={isRTL} doctorColor={doctorColor} doctorBg={doctorBg} chatId={chatId} t={t} />
      </View>
    );
  }

  if (msg.type === 'image') {
    const imgUri = msg.fileUrl;
    return (
      <Animated.View style={[styles.msgRow, isPatient ? styles.msgRowRight : styles.msgRowLeft, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {!isPatient && <DoctorAvatar />}
        <View style={[styles.fileBubble, isPatient
          ? { backgroundColor: Colors.primary, padding: 4 }
          : { backgroundColor: '#fff', borderColor: doctorColor + '30', borderWidth: 1.5, padding: 4 }]}>
          <TouchableOpacity onPress={() => imgUri && setViewingFull(true)} activeOpacity={0.9}>
            {imgUri
              ? <Image source={{ uri: imgUri }} style={{ width: 200, height: 160, borderRadius: 12 }} resizeMode="cover" />
              : <View style={{ width: 200, height: 160, borderRadius: 12, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="image-outline" size={32} color="#bbb" />
                </View>}
          </TouchableOpacity>
          <TouchableOpacity
            style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}
            onPress={handleSave} activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download" size={17} color="#fff" />}
          </TouchableOpacity>
          <View style={[styles.bubbleMeta, { paddingHorizontal: 6, paddingBottom: 4 }]}>
            <Text style={[styles.timeText, isPatient && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
            {isPatient && <Ionicons name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'} size={12} color={msg.status === 'read' ? '#93E0FF' : 'rgba(255,255,255,0.6)'} />}
          </View>
        </View>
        {viewingFull && imgUri && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setViewingFull(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}>
              <TouchableOpacity
                style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setViewingFull(false)}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
              <Image source={{ uri: imgUri }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
            </View>
          </Modal>
        )}
      </Animated.View>
    );
  }

  if (msg.type === 'file') {
    return (
      <Animated.View style={[styles.msgRow, isPatient ? styles.msgRowRight : styles.msgRowLeft, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {!isPatient && <DoctorAvatar />}
        <View style={[styles.fileBubble, isPatient
          ? { backgroundColor: Colors.primary }
          : { backgroundColor: '#fff', borderColor: doctorColor + '30', borderWidth: 1.5 }]}>
          <View style={styles.fileBubbleInner}>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={openFile} activeOpacity={0.8}>
              <View style={[styles.fileIconWrap, { backgroundColor: isPatient ? 'rgba(255,255,255,0.2)' : doctorColor + '15' }]}>
                <Ionicons name="document-outline" size={22} color={isPatient ? '#fff' : doctorColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fileName, { color: isPatient ? '#fff' : Colors.textPrimary }]} numberOfLines={1}>
                  {msg.fileName ?? t.fileDefault}
                </Text>
                {!!msg.fileSize && (
                  <Text style={[styles.fileSize, { color: isPatient ? 'rgba(255,255,255,0.7)' : Colors.textMuted }]}>
                    {formatFileSize(msg.fileSize)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} activeOpacity={0.8} style={{ paddingLeft: 8 }}>
              {saving
                ? <ActivityIndicator size="small" color={isPatient ? '#fff' : doctorColor} />
                : <Ionicons name="download-outline" size={18} color={isPatient ? '#fff' : doctorColor} />}
            </TouchableOpacity>
          </View>
          <View style={styles.bubbleMeta}>
            <Text style={[styles.timeText, isPatient && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
            {isPatient && <Ionicons name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'} size={12} color={msg.status === 'read' ? '#93E0FF' : 'rgba(255,255,255,0.6)'} />}
          </View>
        </View>
      </Animated.View>
    );
  }

  if (msg.type === 'audio') {
    return (
      <Animated.View style={[styles.msgRow, isPatient ? styles.msgRowRight : styles.msgRowLeft, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {!isPatient && <DoctorAvatar />}
        <AudioBubble msg={msg} isPatient={isPatient} doctorColor={doctorColor} doctorBg={doctorBg} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.msgRow, isPatient ? styles.msgRowRight : styles.msgRowLeft, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
      {!isPatient && <DoctorAvatar />}
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => onReply?.(msg)}
        delayLongPress={400}
        style={[
          styles.bubble,
          isPatient
            ? [styles.bubblePatient, { backgroundColor: Colors.primary }]
            : [styles.bubbleDoctor, { backgroundColor: '#fff', borderColor: doctorColor + '30' }],
        ]}
      >
        <Text style={[styles.bubbleText, isPatient ? { color: '#fff' } : { color: Colors.textPrimary }, { textAlign: isRTL ? 'right' : 'left' }]}>
          {msg.text}
        </Text>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.timeText, isPatient && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
          {isPatient && (
            <Ionicons name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'} size={12} color={msg.status === 'read' ? '#93E0FF' : 'rgba(255,255,255,0.6)'} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Attachment Sheet ─────────────────────────────────────
function AttachmentSheet({ visible, onClose, onPick, isRTL, t }: {
  visible: boolean; onClose: () => void; onPick: (a: PickedAttachment) => void; isRTL: boolean; t: any;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: visible ? 0 : 300, tension: 100, friction: 10, useNativeDriver: true }).start();
  }, [visible]);

  const pickCamera = async () => {
    onClose();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t.error, t.cameraPerm); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      onPick({ uri: a.uri, name: `photo_${Date.now()}.jpg`, mimeType: 'image/jpeg', size: a.fileSize, type: 'image' });
    }
  };
  const pickGallery = async () => {
    onClose();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t.error, t.galleryPerm); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const ext = a.uri.split('.').pop() || 'jpg';
      onPick({ uri: a.uri, name: `img_${Date.now()}.${ext}`, mimeType: a.mimeType || `image/${ext}`, size: a.fileSize, type: 'image' });
    }
  };
  const pickFile = async () => {
    onClose();
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      onPick({ uri: a.uri, name: a.name, mimeType: a.mimeType || 'application/octet-stream', size: a.size, type: 'file' });
    }
  };

  if (!visible) return null;
  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={sheetStyles.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[sheetStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={sheetStyles.handle} />
        <Text style={sheetStyles.title}>{t.sendAttachment}</Text>
        <View style={sheetStyles.options}>
          <TouchableOpacity style={sheetStyles.option} onPress={pickCamera} activeOpacity={0.8}>
            <View style={[sheetStyles.optionIcon, { backgroundColor: '#E8F5FF' }]}>
              <Ionicons name="camera" size={28} color="#2196F3" />
            </View>
            <Text style={sheetStyles.optionLabel}>{t.camera}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sheetStyles.option} onPress={pickGallery} activeOpacity={0.8}>
            <View style={[sheetStyles.optionIcon, { backgroundColor: Colors.primaryUltraLight }]}>
              <Ionicons name="image" size={28} color={Colors.primary} />
            </View>
            <Text style={sheetStyles.optionLabel}>{t.gallery}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sheetStyles.option} onPress={pickFile} activeOpacity={0.8}>
            <View style={[sheetStyles.optionIcon, { backgroundColor: '#FFF3E2' }]}>
              <Ionicons name="document-attach" size={28} color="#F4A32B" />
            </View>
            <Text style={sheetStyles.optionLabel}>{t.file}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 },
  handle:      { width: 44, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:       { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 22 },
  options:     { flexDirection: 'row', justifyContent: 'space-around' },
  option:      { alignItems: 'center', gap: 8 },
  optionIcon:  { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 13, fontWeight: '600', color: '#555' },
});

function DateDivider({ label }: { label: string }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ─── Audio Bubble ─────────────────────────────────────────
const BARS = [3, 9, 5, 18, 8, 24, 6, 22, 13, 20, 15, 26, 9, 20, 6, 15, 11, 24, 5, 17, 10, 23, 7, 19, 12];

function AudioBubble({ msg, isPatient, doctorColor, doctorBg }: {
  msg: Message; isPatient: boolean; doctorColor: string; doctorBg: string;
}) {
  const [sound,     setSound]     = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [posMs,     setPosMs]     = useState(0);
  const totalMs  = (msg.audioDuration ?? 0) * 1000;
  const progress = totalMs > 0 ? Math.min(posMs / totalMs, 1) : 0;

  useEffect(() => { return () => { sound?.unloadAsync(); }; }, [sound]);

  const togglePlay = async () => {
    if (!msg.fileUrl) return;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, playThroughEarpieceAndroid: false, shouldDuckAndroid: true });
    if (!sound) {
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: msg.fileUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPosMs(status.positionMillis ?? 0);
          if (status.didJustFinish) { setIsPlaying(false); setPosMs(0); }
        },
      );
      setSound(s); setIsPlaying(true);
    } else if (isPlaying) {
      await sound.pauseAsync(); setIsPlaying(false);
    } else {
      await sound.playAsync(); setIsPlaying(true);
    }
  };

  const fmtDur = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const primary       = '#7C5CBF';
  const activeColor   = isPatient ? 'rgba(255,255,255,0.92)' : primary;
  const inactiveColor = isPatient ? 'rgba(255,255,255,0.28)' : 'rgba(124,92,191,0.2)';

  return (
    <View style={[
      audioStyles.wrap,
      isPatient
        ? { backgroundColor: primary }
        : { backgroundColor: '#fff', borderWidth: 2.5, borderColor: 'rgba(124,92,191,0.45)' },
    ]}>
      <View style={audioStyles.mainRow}>
        <TouchableOpacity onPress={togglePlay} activeOpacity={0.7}
          style={[audioStyles.playBtn, { backgroundColor: isPatient ? 'rgba(255,255,255,0.18)' : 'rgba(124,92,191,0.08)' }]}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={isPatient ? '#fff' : primary} />
        </TouchableOpacity>
        <View style={audioStyles.waveRow}>
          {BARS.map((h, i) => (
            <View key={i} style={[audioStyles.bar, { height: Math.max(4, h), backgroundColor: (i / BARS.length) < progress ? activeColor : inactiveColor }]} />
          ))}
        </View>
        <Text style={[audioStyles.dur, { color: isPatient ? 'rgba(255,255,255,0.75)' : '#aaa' }]}>
          {fmtDur(posMs > 0 ? posMs : totalMs)}
        </Text>
      </View>
      <View style={audioStyles.metaRow}>
        <Text style={[audioStyles.timeStamp, { color: isPatient ? 'rgba(255,255,255,0.65)' : '#bbb' }]}>{msg.time}</Text>
        {isPatient && (
          <Ionicons name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'} size={12} color={msg.status === 'read' ? '#93E0FF' : 'rgba(255,255,255,0.6)'} />
        )}
      </View>
    </View>
  );
}

const audioStyles = StyleSheet.create({
  wrap:      { flexDirection: 'column', borderRadius: 20, overflow: 'hidden', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, minWidth: 240, maxWidth: 300 },
  mainRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  waveRow:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 32 },
  bar:       { width: 3, borderRadius: 2 },
  dur:       { fontSize: 12, fontWeight: '600', minWidth: 36, textAlign: 'right', flexShrink: 0 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 },
  timeStamp: { fontSize: 10, fontWeight: '600' },
});

// ═══════════════════════════════════════════════════════════
// ─── Main Screen ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
export default function DoctorChatScreen() {
  const { isRTL, t } = useLang();
  const params = useLocalSearchParams<{
    doctorId: string; doctorName: string; doctorEmoji: string;
    doctorColor: string; doctorBg: string; specialty: string; isFirebase: string;
  }>();

  const doctorId    = params.doctorId    ?? '1';
  const doctorName  = params.doctorName  ?? t.doctorDefault;
  const doctorEmoji = params.doctorEmoji ?? '🩺';
  const doctorColor = params.doctorColor ?? Colors.primary;
  const doctorBg    = params.doctorBg    ?? Colors.primaryUltraLight;
  const specialty   = params.specialty   ?? '';
  const isFirebase  = params.isFirebase  === '1';

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const patientId = user?.uid ?? '';
  const chatId    = isFirebase ? `${doctorId}_${patientId}` : '';

  const welcomeText = isRTL ? 'أهلاً! كيف يمكنني مساعدتك؟' : 'Hello! How can I help you?';

  const [messages,        setMessages]        = useState<Message[]>(
    isFirebase ? [] : [{ id: 'w1', text: welcomeText, sender: 'doctor', time: nowTime(isRTL), status: 'read' }],
  );
  const [inputText,       setInputText]       = useState('');
  const [showQuick,       setShowQuick]       = useState(false);
  const [showAttach,      setShowAttach]      = useState(false);
  const [uploading,       setUploading]       = useState(false);
  const [doctorOnline,    setDoctorOnline]    = useState(false);
  const [doctorPhotoUrl,  setDoctorPhotoUrl]  = useState<string | null>(null);
  const [isRecording,     setIsRecording]     = useState(false);
  const [recDuration,     setRecDuration]     = useState(0);
  const [recStopped,      setRecStopped]      = useState(false);
  const [stoppedUri,      setStoppedUri]      = useState<string | null>(null);
  const [stoppedDuration, setStoppedDuration] = useState(0);
  const [isDoctorTyping,  setIsDoctorTyping]  = useState(false);
  const [replyToMsg,      setReplyToMsg]      = useState<Message | null>(null);
  // ── keyboard height state (replaces KeyboardAvoidingView) ──
  const [keyboardHeight, setKeyboardHeight]   = useState(0);

  const recordingRef      = useRef<Audio.Recording | null>(null);
  const recTimerRef       = useRef<any>(null);
  const typingTimerRef    = useRef<any>(null);
  const waveAnims         = useRef([0,1,2,3,4].map(() => new Animated.Value(0.3))).current;
  const listRef           = useRef<FlatList>(null);
  const quickAnim         = useRef(new Animated.Value(0)).current;
  const initialScrollDone = useRef(false);

  const quickReplies: string[] = t.docQuickReplies;

  // ── Keyboard listeners — scroll up with keyboard, no layout jump ──
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useFocusEffect(useCallback(() => {
    if (isFirebase && chatId) {
      activeChatRef.chatId = chatId;
      updateDoc(doc(db, 'chats', chatId), { unreadCountPatient: 0 }).catch(() => {});
    }
    return () => { activeChatRef.chatId = ''; };
  }, [isFirebase, chatId]));

  useEffect(() => {
    if (!isFirebase || !doctorId) return;
    return subscribeToPresence(doctorId, (online) => setDoctorOnline(online));
  }, [isFirebase, doctorId]);

  useEffect(() => {
    if (!isFirebase || !doctorId) return;
    const unsub = onSnapshot(doc(db, 'users', doctorId), (snap) => {
      if (snap.exists()) setDoctorPhotoUrl(snap.data().photoUrl ?? null);
    });
    return unsub;
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
          time: tsToTime(data.timestamp ?? Date.now(), isRTL),
          status, type: data.type ?? 'text',
          fileUrl: data.fileUrl, fileName: data.fileName, fileSize: data.fileSize, mimeType: data.mimeType,
          audioDuration: data.audioDuration,
        };
      });
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsub();
  }, [isFirebase, chatId]);

  useEffect(() => {
    if (!isFirebase || !chatId) return;
    const unsub = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const typingAt = d.doctorTypingAt as number | undefined;
      setIsDoctorTyping(!!typingAt && Date.now() - typingAt < 5000);
    });
    return unsub;
  }, [isFirebase, chatId]);

  const notifyPatientTyping = () => {
    if (!isFirebase || !chatId) return;
    setDoc(doc(db, 'chats', chatId), { patientTypingAt: Date.now() }, { merge: true }).catch(() => {});
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setDoc(doc(db, 'chats', chatId), { patientTypingAt: 0 }, { merge: true }).catch(() => {});
    }, 3000);
  };

  const clearPatientTyping = () => {
    clearTimeout(typingTimerRef.current);
    if (isFirebase && chatId) setDoc(doc(db, 'chats', chatId), { patientTypingAt: 0 }, { merge: true }).catch(() => {});
  };

  const toggleQuick = () => {
    const toVal = showQuick ? 0 : 1;
    setShowQuick(!showQuick);
    if (showAttach) setShowAttach(false);
    Animated.spring(quickAnim, { toValue: toVal, tension: 120, friction: 8, useNativeDriver: true }).start();
  };

  const openAttach = () => {
    if (showQuick) { setShowQuick(false); Animated.timing(quickAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(); }
    setShowAttach(true);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setInputText(''); setShowQuick(false); setReplyToMsg(null); clearPatientTyping();
    if (isFirebase && chatId && patientId) {
      try {
        const now        = Date.now();
        const senderName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || t.patientDefault;
        await addDoc(collection(db, 'chats', chatId, 'messages'), { text: text.trim(), sender: 'patient', timestamp: now, status: 'sent', type: 'text' });
        await setDoc(doc(db, 'chats', chatId), {
          doctorId, patientId, patientName: senderName,
          lastMessage: text.trim(), lastMessageTime: now, lastMessageSender: 'patient',
          unreadCountDoctor: increment(1),
        }, { merge: true });
        sendPushToUser(doctorId, senderName, text.trim(), chatId, { screen: 'Docpatient', patientId, patientName: senderName }).catch(() => {});
      } catch { Alert.alert(t.error, t.sendFailed); }
      return;
    }
    const newMsg: Message = { id: Date.now().toString(), text: text.trim(), sender: 'patient', time: nowTime(isRTL), status: 'sent' };
    setMessages(prev => [...prev, newMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    setTimeout(() => {
      const autoReply: Message = { id: `auto_${Date.now()}`, text: t.thanksAutoReply, sender: 'doctor', time: nowTime(isRTL), status: 'read' };
      setMessages(prev => [...prev, autoReply]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }, 2000);
  }, [isRTL, isFirebase, chatId, patientId]);

  const handleSendAttachment = async (a: PickedAttachment) => {
    setUploading(true);
    try {
      const cloudUrl = await uploadFileToCloudinary(a.uri, a.mimeType, a.name);
      const now      = Date.now();
      const preview  = a.type === 'image' ? t.imageMsgLabel : `📎 ${a.name}`;
      const msgData  = { text: preview, sender: 'patient' as const, timestamp: now, status: 'sent' as MessageStatus, type: a.type, fileUrl: cloudUrl, fileName: a.name, fileSize: a.size ?? undefined, mimeType: a.mimeType };
      if (isFirebase && chatId && patientId) {
        const senderName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || t.patientDefault;
        await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
        await setDoc(doc(db, 'chats', chatId), { doctorId, patientId, patientName: senderName, lastMessage: preview, lastMessageTime: now, lastMessageSender: 'patient', unreadCountDoctor: increment(1) }, { merge: true });
        sendPushToUser(doctorId, senderName, preview, chatId, { screen: 'Docpatient', patientId, patientName: senderName }).catch(() => {});
      } else {
        const localMsg: Message = { id: String(now), ...msgData, time: nowTime(isRTL) };
        setMessages(prev => [...prev, localMsg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch { Alert.alert(t.error, t.sendFileFailed); }
    finally { setUploading(false); }
  };

  const handleQuickReply = (text: string) => {
    sendMessage(text);
    Animated.timing(quickAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    setShowQuick(false);
  };

  useEffect(() => {
    if (!isRecording) { waveAnims.forEach(a => a.setValue(0.3)); return; }
    const loops = waveAnims.map((anim, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 250 + i * 80, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: 250 + i * 80, useNativeDriver: true }),
      ])),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      if (recordingRef.current) { try { await recordingRef.current.stopAndUnloadAsync(); } catch {} recordingRef.current = null; }
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert(t.error, t.micPerm); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, shouldDuckAndroid: false, playThroughEarpieceAndroid: false });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true); setRecStopped(false); setStoppedUri(null); setRecDuration(0);
      recTimerRef.current = setInterval(() => setRecDuration(d => d + 1), 1000);
    } catch (e) { Alert.alert(t.error, t.recordFailed); }
  }, [t]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    clearInterval(recTimerRef.current);
    const rec = recordingRef.current;
    recordingRef.current = null;
    const dur = recDuration;
    setIsRecording(false);
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
      const uri = rec.getURI();
      if (uri) { setStoppedUri(uri); setStoppedDuration(dur); setRecStopped(true); }
    } catch (e) { Alert.alert(t.error, t.sendFailed); }
  }, [recDuration, t]);

  const cancelRecordingOrPreview = useCallback(async () => {
    clearInterval(recTimerRef.current);
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false }); } catch {}
      recordingRef.current = null;
    }
    setIsRecording(false); setRecStopped(false); setStoppedUri(null); setRecDuration(0); setStoppedDuration(0);
  }, []);

  const sendStoppedAudio = useCallback(async () => {
    if (!stoppedUri) return;
    const uri = stoppedUri; const duration = stoppedDuration;
    setRecStopped(false); setStoppedUri(null); setStoppedDuration(0); setUploading(true);
    try {
      const name     = `voice_${Date.now()}.m4a`;
      const cloudUrl = await uploadFileToCloudinary(uri, 'audio/m4a', name);
      const now      = Date.now();
      const preview  = t.voiceMessage;
      const senderName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || t.patientDefault;
      if (isFirebase && chatId && patientId) {
        await addDoc(collection(db, 'chats', chatId, 'messages'), { text: preview, sender: 'patient', timestamp: now, status: 'sent', type: 'audio', fileUrl: cloudUrl, fileName: name, audioDuration: duration });
        await setDoc(doc(db, 'chats', chatId), { doctorId, patientId, patientName: senderName, lastMessage: preview, lastMessageTime: now, lastMessageSender: 'patient', unreadCountDoctor: increment(1) }, { merge: true });
        sendPushToUser(doctorId, senderName, preview, chatId, { screen: 'Docpatient', patientId, patientName: senderName }).catch(() => {});
      }
    } catch { Alert.alert(t.error, t.sendFailed); }
    finally { setUploading(false); }
  }, [stoppedUri, stoppedDuration, isFirebase, chatId, patientId, doctorId, user, t]);

  return (
    // ── SafeAreaView بتاخد top فقط — bottom بنتحكم فيه يدوياً ──
    <SafeAreaView style={styles.safeOuter} edges={['top', 'left', 'right']}>
      <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/tabs/doctors')} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={doctorColor} />
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
                  {doctorOnline ? t.docActiveNow : t.docOffline}
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

      {/* ── الجزء الأساسي: FlatList + input bar في View واحد ──
           paddingBottom بيتحرك مع الكيبورد بدون KeyboardAvoidingView */}
      <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          extraData={doctorPhotoUrl}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<DateDivider label={t.today} />}
          onContentSizeChange={() => {
            if (!initialScrollDone.current && messages.length > 0) {
              listRef.current?.scrollToEnd({ animated: false });
              initialScrollDone.current = true;
            }
          }}
          renderItem={({ item }) => (
            <MessageBubble msg={item} isRTL={isRTL} doctorColor={doctorColor} doctorBg={doctorBg} chatId={chatId} t={t} doctorPhotoUrl={doctorPhotoUrl} onReply={setReplyToMsg} />
          )}
        />

        {/* Doctor typing indicator */}
        {isDoctorTyping && (
          <View style={[styles.typingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.typingAvatar, { backgroundColor: doctorBg }]}>
              <Ionicons name="person" size={11} color={doctorColor} />
            </View>
            <View style={[styles.typingBubble, { borderColor: doctorColor + '30' }]}>
              <Text style={[styles.typingText, { color: doctorColor }]}>
                {isRTL ? 'الطبيب يكتب...' : 'Doctor is typing...'}
              </Text>
            </View>
          </View>
        )}

        {/* Reply preview bar */}
        {replyToMsg && (
          <View style={[styles.replyBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.replyAccent, { backgroundColor: doctorColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyFrom, { color: doctorColor, textAlign: isRTL ? 'right' : 'left' }]}>
                {replyToMsg.sender === 'patient' ? (isRTL ? 'أنت' : 'You') : (isRTL ? 'الطبيب' : 'Doctor')}
              </Text>
              <Text style={[styles.replyPreview, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                {replyToMsg.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyToMsg(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick replies */}
        {showQuick && (
          <View style={styles.quickWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickContent}>
              {quickReplies.map((q, i) => (
                <TouchableOpacity key={i} onPress={() => handleQuickReply(q)} style={[styles.quickChip, { borderColor: doctorColor + '50' }]} activeOpacity={0.8}>
                  <Text style={[styles.quickChipText, { color: doctorColor }]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input bar wrapper */}
        <View style={[styles.inputBarWrap, { paddingBottom: insets.bottom || 8 }]}>
          {uploading && (
            <View style={styles.uploadingBar}>
              <ActivityIndicator size="small" color={doctorColor} style={{ marginRight: 6 }} />
              <Text style={[styles.uploadingText, { color: doctorColor }]}>{t.sending}</Text>
            </View>
          )}

          {/* Recording bar */}
          {(isRecording || recStopped) && (
            <View style={[styles.recordingBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity onPress={cancelRecordingOrPreview} style={styles.recCancelBtn}>
                <Ionicons name="trash-outline" size={18} color="#E05C5C" />
              </TouchableOpacity>
              {isRecording ? (
                <View style={styles.waveform}>
                  {waveAnims.map((anim, i) => (
                    <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: anim }] }]} />
                  ))}
                </View>
              ) : (
                <Text style={[styles.recText, { flex: 1, textAlign: 'center' }]}>
                  🎙 {`${Math.floor(stoppedDuration / 60)}:${String(stoppedDuration % 60).padStart(2, '0')}`}
                </Text>
              )}
              <Text style={[styles.recText, { minWidth: 36 }]}>
                {isRecording ? `${Math.floor(recDuration / 60)}:${String(recDuration % 60).padStart(2, '0')}` : ''}
              </Text>
              {isRecording ? (
                <TouchableOpacity onPress={stopRecording} style={[styles.recSendBtn, { backgroundColor: doctorColor }]}>
                  <Ionicons name="stop" size={16} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={sendStoppedAudio} style={[styles.recSendBtn, { backgroundColor: doctorColor }]}>
                  <Ionicons name="send" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Text input bar */}
          {!(isRecording || recStopped) && (
            <View style={[styles.inputBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity onPress={toggleQuick} style={[styles.iconBtn, { backgroundColor: showQuick ? doctorColor : doctorBg }]} activeOpacity={0.8}>
                <Ionicons name={showQuick ? 'close' : 'flash'} size={18} color={showQuick ? '#fff' : doctorColor} />
              </TouchableOpacity>
              <TouchableOpacity onPress={openAttach} style={[styles.iconBtn, { backgroundColor: doctorBg }]} activeOpacity={0.8}>
                <Ionicons name="attach" size={18} color={doctorColor} />
              </TouchableOpacity>
              <View style={[styles.inputWrap, { borderColor: doctorColor + '40' }]}>
                <TextInput
                  value={inputText}
                  onChangeText={(text) => { setInputText(text); notifyPatientTyping(); }}
                  placeholder={isRecording ? '' : t.writeMessage}
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.textInput, { textAlign: isRTL ? 'right' : 'left' }]}
                  multiline maxLength={500}
                  editable={!isRecording}
                />
              </View>
              {inputText.trim() ? (
                <TouchableOpacity onPress={() => sendMessage(inputText)} style={[styles.sendBtn, { backgroundColor: doctorColor }]} activeOpacity={0.8}>
                  <Ionicons name="send" size={16} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={startRecording} style={[styles.sendBtn, { backgroundColor: doctorColor }]} activeOpacity={0.8}>
                  <Ionicons name="mic" size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      <AttachmentSheet
        visible={showAttach}
        onClose={() => setShowAttach(false)}
        onPick={(a) => { setShowAttach(false); handleSendAttachment(a); }}
        isRTL={isRTL} t={t}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeOuter:       { flex: 1, backgroundColor: '#F8F5FF' },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.base, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
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
  noticeBanner:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: Spacing.base, marginTop: 10, marginBottom: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  noticeText:      { fontSize: 11, fontWeight: '500', flex: 1 },
  listContent:     { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: Spacing.base, paddingBottom: 12, paddingTop: 8 },
  msgRow:          { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginBottom: 8 },
  msgRowRight:     { justifyContent: 'flex-end' },
  msgRowLeft:      { justifyContent: 'flex-start' },
  docAvatar:       { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent', overflow: 'hidden' },
  bubble:          { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubblePatient:   { borderBottomRightRadius: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  bubbleDoctor:    { borderBottomLeftRadius: 4, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  bubbleText:      { fontSize: FontSize.base, lineHeight: 22 },
  bubbleMeta:      { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, justifyContent: 'flex-end' },
  timeText:        { fontSize: 10, color: Colors.textMuted },
  fileBubble:      { maxWidth: '75%', borderRadius: 16, padding: 10 },
  fileBubbleInner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  fileIconWrap:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fileName:        { fontSize: 13, fontWeight: '600' },
  fileSize:        { fontSize: 10, marginTop: 2 },
  dividerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14, paddingHorizontal: 8 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText:     { fontSize: 11, color: Colors.textMuted, fontWeight: '600', backgroundColor: '#F8F5FF', paddingHorizontal: 8, borderRadius: 8 },
  quickWrap:       { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 10 },
  quickContent:    { paddingHorizontal: Spacing.base, gap: 8, alignItems: 'center', flexDirection: 'row' },
  quickChip:       { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  quickChipText:   { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  inputBarWrap:    { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  typingRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.base, paddingVertical: 6 },
  typingAvatar:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typingBubble:    { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderWidth: 1 },
  typingText:      { fontSize: 11, fontWeight: '600', fontStyle: 'italic' },
  replyBar:        { alignItems: 'center', gap: 8, paddingHorizontal: Spacing.base, paddingVertical: 8, backgroundColor: '#F8F8F8', borderTopWidth: 1, borderTopColor: '#EEE', minHeight: 52 },
  replyAccent:     { width: 3, alignSelf: 'stretch', borderRadius: 2, minHeight: 30 },
  replyFrom:       { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyPreview:    { fontSize: 12, color: Colors.textMuted },
  uploadingBar:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.base, paddingTop: 6 },
  uploadingText:   { fontSize: 11, fontWeight: '600' },
  recordingBar:    { alignItems: 'center', gap: 10, paddingHorizontal: Spacing.base, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEE' },
  recText:         { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  recCancelBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDEAEA' },
  recSendBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  waveform:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 36 },
  waveBar:         { width: 4, height: 24, borderRadius: 2, backgroundColor: '#E05C5C' },
  inputBar:        { alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.base, paddingTop: 10, paddingBottom: 0 },
  inputWrap:       { flex: 1, backgroundColor: Colors.background, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, minHeight: 44, maxHeight: 120 },
  textInput:       { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0, lineHeight: 20 },
  iconBtn:         { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  accessCardWrap:  { marginVertical: 6, alignItems: 'center' },
  accessCard:      { width: '90%', borderRadius: 16, borderWidth: 1.5, padding: 16, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  accessTitle:     { fontSize: FontSize.base, fontWeight: '700' },
  accessDesc:      { fontSize: 12, color: Colors.textSecondary },
  accessBtns:      { marginTop: 4, gap: 10 },
  accessBtn:       { paddingHorizontal: 24, paddingVertical: 9, borderRadius: 20 },
  acceptBtn:       { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  declineBtn:      { backgroundColor: '#fff', borderWidth: 1.5 },
  acceptBtnText:   { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  declineBtnText:  { fontWeight: '700', fontSize: FontSize.sm },
});