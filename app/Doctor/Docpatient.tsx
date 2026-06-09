import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput, KeyboardAvoidingView, Keyboard,
  Platform, Animated, Modal, ScrollView, Alert,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  collection, doc, addDoc, onSnapshot, updateDoc, deleteDoc,
  orderBy, query, setDoc, getDoc,
} from 'firebase/firestore';
import { auth, db } from '../../utils/firebaseConfig';
import { uploadFileToCloudinary } from '../../utils/uploadImage';
import { Colors, Spacing, FontSize } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import { useChats } from '../../context/Chatscontext';
import { notifyMessageSent } from './DocNotifService';
import { sendPushToUser } from '../../utils/pushNotifications';
import { subscribeToPresence } from '../../utils/presence';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

const DOC_COLOR       = '#7C5CBF';
const DOC_COLOR_LIGHT = '#F0EBFA';

// ─── Types ────────────────────────────────────────────────
type FSMessage = {
  text: string;
  sender: 'doctor' | 'patient';
  timestamp: number;
  status?: 'sent' | 'delivered' | 'read';
  type?: 'text' | 'request_access' | 'image' | 'file';
  fileUri?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
};

type FSChat = {
  lastMessage?: string;
  lastMessageTime?: number;
  lastMessageSender?: string;
  exerciseAccess?: boolean;
};

type ExSectionKey = 'therapy' | 'yoga' | 'aerobic' | 'endurance' | 'strength' | 'coordination';

const _AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function fmtMsgTime(ts: number, isRTL: boolean): string {
  const d = new Date(ts);
  const h = d.getHours(), m = d.getMinutes(), am = h < 12, h12 = h % 12 || 12;
  if (isRTL) {
    const toAr = (n: number, pad = 0) =>
      n.toString().padStart(pad, '0').replace(/\d/g, x => _AR_DIGITS[+x]);
    return `${toAr(h12)}:${toAr(m, 2)} ${am ? 'ص' : 'م'}`;
  }
  return `${h12}:${m.toString().padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

const EX_SECTION_CONFIGS = [
  { key: 'therapy'      as ExSectionKey, labelAr: 'علاجي',  labelEn: 'Therapy',      color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7', emoji: '🩺' },
  { key: 'yoga'         as ExSectionKey, labelAr: 'يوغا',   labelEn: 'Yoga',         color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3', emoji: '🧘' },
  { key: 'aerobic'      as ExSectionKey, labelAr: 'هوائي',  labelEn: 'Aerobic',      color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6', emoji: '🏃' },
  { key: 'endurance'    as ExSectionKey, labelAr: 'تحمّل',  labelEn: 'Endurance',    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0', emoji: '💪' },
  { key: 'strength'     as ExSectionKey, labelAr: 'قوة',    labelEn: 'Strength',     color: '#7B5EA7', bg: '#F0EBF8', accent: '#E0D5F2', emoji: '🏋️' },
  { key: 'coordination' as ExSectionKey, labelAr: 'تناسق',  labelEn: 'Coordination', color: '#2A9D8F', bg: '#E6F5F3', accent: '#C8EBE7', emoji: '🎯' },
];

type SysEx = { key: string; emoji: string; titleAr: string; titleEn: string; type: ExSectionKey; durationMin: number; descAr: string; descEn: string; };
const SYSTEM_EXERCISES: SysEx[] = [
  { key: 'wristCurls',      emoji: '🤲', titleAr: 'ثني الرسغ',                 titleEn: 'Wrist Curls',              type: 'therapy',      durationMin: 5, descAr: 'يزيد الثبات ويقلل الرعشة',              descEn: 'Increases stability and reduces tremors' },
  { key: 'childsPose',      emoji: '🧘', titleAr: 'وضعية الطفل',               titleEn: "Child's Pose",             type: 'yoga',         durationMin: 5, descAr: 'تخفف الإرهاق وترخي المفاصل',            descEn: 'Relieves fatigue and relaxes joints' },
  { key: 'warriorTwo',      emoji: '🥋', titleAr: 'وضعية المحارب الثاني',      titleEn: 'Warrior II',               type: 'yoga',         durationMin: 3, descAr: 'تبني التحمل وتحسن التوازن',              descEn: 'Builds endurance and improves balance' },
  { key: 'jabPunches',      emoji: '👊', titleAr: 'اللكمات الأمامية',           titleEn: 'Jab Punches',              type: 'yoga',         durationMin: 5, descAr: 'تنشط الدورة الدموية',                   descEn: 'Boosts circulation' },
  { key: 'comboPunches',    emoji: '🥊', titleAr: 'اللكمات المركبة',            titleEn: 'Combination Punches',      type: 'yoga',         durationMin: 5, descAr: 'تقوي الذراعين والكتفين',                descEn: 'Strengthens arms and shoulders' },
  { key: 'singleLegStand',  emoji: '🦩', titleAr: 'الوقوف على ساق واحدة',      titleEn: 'Single Leg Stand',         type: 'aerobic',      durationMin: 5, descAr: 'يحسن التوازن والتنسيق',                 descEn: 'Improves balance and coordination' },
  { key: 'armBottles',      emoji: '💪', titleAr: 'تمارين الذراعين بالزجاجات', titleEn: 'Arm Exercises with Bottles', type: 'endurance',  durationMin: 5, descAr: 'تقوي العضلات بأدوات بسيطة',             descEn: 'Strengthens muscles with simple tools' },
  { key: 'seatedEndurance', emoji: '🪑', titleAr: 'تمارين التحمل الجلوسية',    titleEn: 'Seated Endurance',         type: 'endurance',    durationMin: 5, descAr: 'مناسب للجلوس الطويل',                   descEn: 'Suitable for extended sitting' },
  { key: 'neckFlexibility', emoji: '🧘', titleAr: 'مرونة الرقبة (استلقاء)',    titleEn: 'Neck Flexibility (Lying)', type: 'endurance',    durationMin: 5, descAr: 'يخفف توتر الرقبة والكتفين',             descEn: 'Relieves neck and shoulder tension' },
  { key: 'standUpStrength', emoji: '🏋️', titleAr: 'النهوض لقوة الساقين',       titleEn: 'Stand Up for Leg Strength', type: 'endurance',   durationMin: 5, descAr: 'يقوي عضلات الفخذ والساقين',             descEn: 'Strengthens thigh and leg muscles' },
  { key: 'upperBodyStretch',emoji: '🔄', titleAr: 'تمدد الجزء العلوي',         titleEn: 'Upper Body Stretch',       type: 'endurance',    durationMin: 5, descAr: 'يحسن المرونة ويخفف التوتر',             descEn: 'Improves flexibility and relieves tension' },
  { key: 'marchingInPlace', emoji: '🚶', titleAr: 'المشي في المكان',            titleEn: 'Marching in Place',        type: 'strength',     durationMin: 5, descAr: 'ينشط الدورة الدموية',                   descEn: 'Activates circulation' },
  { key: 'chairSquat',      emoji: '🪑', titleAr: 'القرفصاء مع الكرسي',        titleEn: 'Chair Squat',              type: 'strength',     durationMin: 5, descAr: 'يقوي عضلات الفخذ والأرداف',             descEn: 'Strengthens thigh and glute muscles' },
  { key: 'towelArmStrength',emoji: '🧣', titleAr: 'تقوية الذراع بالمنشفة',     titleEn: 'Arm Strength with Towel',  type: 'coordination', durationMin: 5, descAr: 'يحسن قوة الذراع والتنسيق',              descEn: 'Improves arm strength and coordination' },
  { key: 'seatedBicycle',   emoji: '🚴', titleAr: 'الدراجة الجلوسية',           titleEn: 'Seated Bicycle',           type: 'coordination', durationMin: 5, descAr: 'يحسن التنسيق الحركي',                   descEn: 'Improves motor coordination' },
];

type AttachmentType = 'image' | 'file';
type PickedAttachment = {
  uri: string; name: string; mimeType: string; size?: number; type: AttachmentType;
};

type Message = {
  id: string; text: string; sender: 'doctor' | 'patient'; time: string;
  status?: 'sent' | 'delivered' | 'read';
  type?: 'text' | 'request_access' | 'image' | 'file';
  fileUri?: string; fileUrl?: string; fileName?: string; fileSize?: number; mimeType?: string;
};

type FirebaseExercise = {
  id: string; title: string; emoji: string; durationMin: number;
  description?: string; assignedAt: number; completed?: boolean; type?: ExSectionKey;
  fileUrl?: string; fileUri?: string; fileName?: string; mimeType?: string; source: 'doctor';
  pendingEdit?: {
    title?: string; emoji?: string; durationMin?: number; description?: string;
    type?: ExSectionKey; requestedAt: number; requestedBy: 'doctor';
    status?: 'pending' | 'rejected';
  } | null;
};

type PatientExercise = {
  key: string; emoji: string; title: string; titleEn: string;
  duration: string; durationEn: string; durationSeconds: number;
  color: string; bg: string; desc: string; descEn: string;
  type: ExSectionKey; custom?: boolean; completed?: boolean; source: 'patient';
};

// ─── Helpers ─────────────────────────────────────────────
const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

async function saveAttachmentToDevice(uri: string, fileName: string, mimeType?: string, isRTL = false) {
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

  const getLocalUri = async (): Promise<string> => {
    if (!uri.startsWith('http')) return uri;
    const dest = (FileSystem.cacheDirectory ?? '') + fileName;
    return (await FileSystem.downloadAsync(uri, dest)).uri;
  };

  const saveToGallery = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (status !== 'granted') {
        Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'مطلوب إذن الوصول للمعرض' : 'Gallery permission required');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(await getLocalUri());
      Alert.alert(isRTL ? '✅ تم الحفظ' : '✅ Saved', isRTL ? 'تم حفظ الصورة في معرض الصور' : 'Image saved to gallery');
    } catch (e) { console.warn('[saveToGallery]', e); Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل حفظ الصورة' : 'Failed to save image'); }
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
      Alert.alert(isRTL ? '✅ تم الحفظ' : '✅ Saved', isRTL ? 'تم حفظ الملف بنجاح' : 'File saved successfully');
    } catch (e) { console.warn('[chooseFolder]', e); Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل حفظ الملف' : 'Failed to save file'); }
  };

  const buttons: any[] = [];
  if (isImage) buttons.push({ text: isRTL ? '🖼️ حفظ في المعرض' : '🖼️ Save to Gallery', onPress: saveToGallery });
  buttons.push({ text: isRTL ? '📁 اختر مجلد الحفظ' : '📁 Choose Folder', onPress: chooseFolder });
  buttons.push({ text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' });

  Alert.alert(
    isRTL ? 'تحميل' : 'Download',
    isRTL ? 'اختر مكان الحفظ' : 'Choose where to save',
    buttons,
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
    if (status !== 'granted') { Alert.alert(isRTL ? 'خطأ' : 'Error', t.docCameraPerm); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      onPick({ uri: a.uri, name: `photo_${Date.now()}.jpg`, mimeType: 'image/jpeg', size: a.fileSize, type: 'image' });
    }
  };
  const pickGallery = async () => {
    onClose();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(isRTL ? 'خطأ' : 'Error', t.docGalleryPerm); return; }
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
        <Text style={sheetStyles.title}>{t.docSendAttachment}</Text>
        <View style={sheetStyles.options}>
          <TouchableOpacity style={sheetStyles.option} onPress={pickCamera} activeOpacity={0.8}>
            <View style={[sheetStyles.optionIcon, { backgroundColor: '#E8F5FF' }]}>
              <Ionicons name="camera" size={28} color="#2196F3" />
            </View>
            <Text style={sheetStyles.optionLabel}>{t.docCamera}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sheetStyles.option} onPress={pickGallery} activeOpacity={0.8}>
            <View style={[sheetStyles.optionIcon, { backgroundColor: DOC_COLOR_LIGHT }]}>
              <Ionicons name="image" size={28} color={DOC_COLOR} />
            </View>
            <Text style={sheetStyles.optionLabel}>{t.docGallery}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sheetStyles.option} onPress={pickFile} activeOpacity={0.8}>
            <View style={[sheetStyles.optionIcon, { backgroundColor: '#FFF3E2' }]}>
              <Ionicons name="document-attach" size={28} color="#F4A32B" />
            </View>
            <Text style={sheetStyles.optionLabel}>{t.docFile}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 },
  handle:      { width: 44, height: 4, backgroundColor: '#E0D6F5', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:       { fontSize: 16, fontWeight: '700', color: '#2d2d2d', textAlign: 'center', marginBottom: 22 },
  options:     { flexDirection: 'row', justifyContent: 'space-around' },
  option:      { alignItems: 'center', gap: 8 },
  optionIcon:  { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 13, fontWeight: '600', color: '#555' },
});

// ─── Message Bubble ──────────────────────────────────────
function MessageBubble({ msg, isRTL, t, patientPhotoUrl }: { msg: Message; isRTL: boolean; t: any; patientPhotoUrl?: string | null }) {
  const isDoc     = msg.sender === 'doctor';
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isDoc ? 20 : -20)).current;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const [viewingFull, setViewingFull] = useState(false);

  const handleSave = async () => {
    const uri = msg.fileUri || msg.fileUrl;
    if (!uri || saving) return;
    setSaving(true);
    await saveAttachmentToDevice(uri, msg.fileName || 'file', msg.mimeType, isRTL);
    setSaving(false);
  };

  const openFile = async () => {
    const uri = msg.fileUri || msg.fileUrl;
    if (!uri) return;
    try {
      if (uri.startsWith('http')) {
        await WebBrowser.openBrowserAsync(uri);
      } else {
        await Sharing.shareAsync(uri, { mimeType: msg.mimeType, dialogTitle: msg.fileName || 'File' });
      }
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'تعذر فتح الملف' : 'Could not open file');
    }
  };

  if (msg.type === 'request_access') {
    return (
      <Animated.View style={[msgStyles.row, msgStyles.rowRight, { opacity: fadeAnim }]}>
        <View style={msgStyles.requestCard}>
          <Ionicons name="barbell-outline" size={22} color={DOC_COLOR} />
          <Text style={msgStyles.requestTitle}>{t.docAccessRequestTitle}</Text>
          <Text style={msgStyles.requestSub}>{t.docAccessRequestBody}</Text>
          <View style={msgStyles.requestBadge}>
            <Ionicons name="time-outline" size={13} color="#F4A32B" />
            <Text style={msgStyles.requestBadgeText}>{t.docAccessPending}</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  if (msg.type === 'image') {
    const imgUri = msg.fileUri || msg.fileUrl;
    return (
      <Animated.View style={[msgStyles.row, isDoc ? msgStyles.rowRight : msgStyles.rowLeft, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {!isDoc && (
          <View style={msgStyles.patientAvatar}>
            {patientPhotoUrl
              ? <Image source={{ uri: patientPhotoUrl }} style={{ width: 30, height: 30, borderRadius: 15 }} />
              : <Ionicons name="person" size={14} color={DOC_COLOR} />}
          </View>
        )}
        <View style={[msgStyles.bubble, isDoc ? msgStyles.bubbleDoc : msgStyles.bubblePatient, { padding: 4 }]}>
          <TouchableOpacity onPress={() => imgUri && setViewingFull(true)} activeOpacity={0.9}>
            {imgUri
              ? <Image source={{ uri: imgUri }} style={msgStyles.imageThumb} resizeMode="cover" />
              : <View style={[msgStyles.imageThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#eee' }]}><Ionicons name="image-outline" size={32} color="#bbb" /></View>}
          </TouchableOpacity>
          <TouchableOpacity style={msgStyles.downloadOverlay} onPress={handleSave} activeOpacity={0.8}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download" size={18} color="#fff" />}
          </TouchableOpacity>
          <View style={[msgStyles.bubbleMeta, { paddingHorizontal: 6, paddingBottom: 4 }]}>
            <Text style={[msgStyles.timeText, isDoc && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
            {isDoc && <Ionicons name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'} size={13} color={msg.status === 'read' ? '#D4BBFF' : 'rgba(255,255,255,0.6)'} />}
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
      <Animated.View style={[msgStyles.row, isDoc ? msgStyles.rowRight : msgStyles.rowLeft, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {!isDoc && (
          <View style={msgStyles.patientAvatar}>
            {patientPhotoUrl
              ? <Image source={{ uri: patientPhotoUrl }} style={{ width: 30, height: 30, borderRadius: 15 }} />
              : <Ionicons name="person" size={14} color={DOC_COLOR} />}
          </View>
        )}
        <View style={[msgStyles.bubble, isDoc ? msgStyles.bubbleDoc : msgStyles.bubblePatient, { minWidth: 190 }]}>
          <View style={msgStyles.fileRow}>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={openFile} activeOpacity={0.8}>
              <View style={[msgStyles.fileIcon, { backgroundColor: isDoc ? 'rgba(255,255,255,0.2)' : DOC_COLOR_LIGHT }]}>
                <Ionicons name="document-attach" size={22} color={isDoc ? '#fff' : DOC_COLOR} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[msgStyles.fileName, isDoc && { color: '#fff' }]} numberOfLines={2}>{msg.fileName || (isRTL ? 'ملف' : 'File')}</Text>
                {!!msg.fileSize && <Text style={[msgStyles.fileSize, isDoc && { color: 'rgba(255,255,255,0.7)' }]}>{formatSize(msg.fileSize)}</Text>}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} activeOpacity={0.8} style={{ paddingLeft: 8 }}>
              {saving
                ? <ActivityIndicator size="small" color={isDoc ? '#fff' : DOC_COLOR} />
                : <Ionicons name="download-outline" size={20} color={isDoc ? 'rgba(255,255,255,0.8)' : DOC_COLOR} />}
            </TouchableOpacity>
          </View>
          <View style={msgStyles.bubbleMeta}>
            <Text style={[msgStyles.timeText, isDoc && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
            {isDoc && <Ionicons name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'} size={13} color={msg.status === 'read' ? '#D4BBFF' : 'rgba(255,255,255,0.6)'} />}
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[msgStyles.row, isDoc ? msgStyles.rowRight : msgStyles.rowLeft, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
      {!isDoc && (
        <View style={msgStyles.patientAvatar}>
          {patientPhotoUrl
            ? <Image source={{ uri: patientPhotoUrl }} style={{ width: 30, height: 30, borderRadius: 15 }} />
            : <Ionicons name="person" size={14} color={DOC_COLOR} />}
        </View>
      )}
      <View style={[msgStyles.bubble, isDoc ? msgStyles.bubbleDoc : msgStyles.bubblePatient]}>
        <Text style={[msgStyles.bubbleText, isDoc ? msgStyles.bubbleTextDoc : msgStyles.bubbleTextPatient]}>{msg.text}</Text>
        <View style={msgStyles.bubbleMeta}>
          <Text style={[msgStyles.timeText, isDoc && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
          {isDoc && <Ionicons name={msg.status === 'read' ? 'checkmark-done' : 'checkmark-done-outline'} size={13} color={msg.status === 'read' ? '#D4BBFF' : 'rgba(255,255,255,0.6)'} />}
        </View>
      </View>
    </Animated.View>
  );
}

const msgStyles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft:  { justifyContent: 'flex-start' },
  patientAvatar:     { width: 30, height: 30, borderRadius: 15, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: DOC_COLOR + '30', marginRight: 8, overflow: 'hidden' },
  bubble:            { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleDoc:         { backgroundColor: DOC_COLOR, borderBottomRightRadius: 4, shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  bubblePatient:     { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 1, borderWidth: 1, borderColor: Colors.border },
  bubbleText:        { fontSize: FontSize.base, lineHeight: 22 },
  bubbleTextDoc:     { color: '#fff', fontWeight: '500' },
  bubbleTextPatient: { color: Colors.textPrimary },
  bubbleMeta:        { flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' },
  timeText:          { fontSize: 10, color: Colors.textMuted, marginRight: 4 },
  requestCard:       { maxWidth: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: DOC_COLOR + '40', shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  requestTitle:      { fontSize: 14, fontWeight: '800', color: DOC_COLOR, textAlign: 'center', marginTop: 6 },
  requestSub:        { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 4 },
  requestBadge:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  requestBadgeText:  { fontSize: 11, color: '#F4A32B', fontWeight: '700', marginLeft: 4 },
  imageThumb:        { width: 200, height: 160, borderRadius: 14 },
  downloadOverlay:   { position: 'absolute', top: 6, right: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  fileRow:           { flexDirection: 'row', alignItems: 'center' },
  fileIcon:          { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  fileName:          { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, lineHeight: 18 },
  fileSize:          { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
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
  wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, paddingHorizontal: 8 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  text: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', backgroundColor: '#F8F5FF', paddingHorizontal: 8, borderRadius: 8, marginHorizontal: 10 },
});

// ═══════════════════════════════════════════════════════════
// ─── Exercise Management Modal ───────────────────────────
// ═══════════════════════════════════════════════════════════
function ExerciseManagementModal({
  visible, onClose, patientId, isRTL, patientName, t,
}: {
  visible: boolean; onClose: () => void; patientId: string;
  isRTL: boolean; patientName?: string; t: any;
}) {
  const [doctorExercises,  setDoctorExercises]  = useState<FirebaseExercise[]>([]);
  const [patientExercises, setPatientExercises] = useState<PatientExercise[]>([]);
  const [loadingPatient,   setLoadingPatient]   = useState(true);
  const [mode,          setMode]          = useState<'library' | 'assigned'>('library');
  const [activeSection, setActiveSection] = useState<ExSectionKey | 'all'>('therapy');
  const [showAddForm,   setShowAddForm]   = useState(false);
  const [editingEx,     setEditingEx]     = useState<FirebaseExercise | null>(null);
  const [newTitle,   setNewTitle]   = useState('');
  const [newEmoji,   setNewEmoji]   = useState('🏋️');
  const [newMins,    setNewMins]    = useState('');
  const [newDesc,    setNewDesc]    = useState('');
  const [newType,    setNewType]    = useState<ExSectionKey>('therapy');
  const [saving,     setSaving]     = useState(false);
  const [attachFile, setAttachFile] = useState<PickedAttachment | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [savingId,   setSavingId]   = useState<string | null>(null);
  const [editTitle,  setEditTitle]  = useState('');
  const [editEmoji,  setEditEmoji]  = useState('');
  const [editMins,   setEditMins]   = useState('');
  const [editDesc,   setEditDesc]   = useState('');
  const [editType,   setEditType]   = useState<ExSectionKey>('therapy');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!visible || !patientId) return;
    const unsub = onSnapshot(collection(db, 'exercises', patientId, 'items'), (snap) => {
      const list: FirebaseExercise[] = snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<FirebaseExercise, 'id'>), source: 'doctor' as const,
      }));
      setDoctorExercises(list.sort((a, b) => b.assignedAt - a.assignedAt));
    });
    return unsub;
  }, [visible, patientId]);

  useEffect(() => {
    if (!visible || !patientId) return;
    setLoadingPatient(true);
    const unsub = onSnapshot(doc(db, 'patientExercises', patientId), (snap) => {
      setLoadingPatient(false);
      if (snap.exists()) {
        const data = snap.data();
        const list: PatientExercise[] = (data.exercises ?? []).map((e: any) => ({ ...e, source: 'patient' as const }));
        setPatientExercises(list);
      } else { setPatientExercises([]); }
    }, () => setLoadingPatient(false));
    return unsub;
  }, [visible, patientId]);

  useEffect(() => {
    if (!visible || !patientId) return;
    const unsub = onSnapshot(collection(db, 'exercises', patientId, 'items'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const data = change.doc.data() as FirebaseExercise;
          if ((data.pendingEdit as any)?.status === 'rejected') {
            Alert.alert(
              t.docEditRejected,
              `${t.docEditRejectedBody} "${data.title}"`,
            );
            updateDoc(doc(db, 'exercises', patientId, 'items', change.doc.id), { pendingEdit: null }).catch(() => {});
          }
        }
      });
    });
    return unsub;
  }, [visible, patientId, isRTL]);

  const resetForm = () => {
    setNewTitle(''); setNewEmoji('🏋️'); setNewMins('');
    setNewDesc(''); setAttachFile(null); setSaving(false);
  };

  const activeCfg = EX_SECTION_CONFIGS.find((s) => s.key === activeSection) ?? EX_SECTION_CONFIGS[0];
  const doctorInSection  = doctorExercises.filter(e => (e.type ?? 'therapy') === activeSection);
  const patientInSection = patientExercises.filter(e => e.type === activeSection);
  const assignedDoctor  = activeSection === 'all' ? doctorExercises  : doctorInSection;
  const assignedPatient = activeSection === 'all' ? patientExercises : patientInSection;

  const getSectionCount = (key: ExSectionKey) => {
    const dCount = doctorExercises.filter(e => (e.type ?? 'therapy') === key).length;
    const pCount = patientExercises.filter(e => e.type === key).length;
    return dCount + pCount;
  };

  const totalExercises = doctorExercises.length + patientExercises.length;
  const doneCount      = doctorExercises.filter(e => e.completed).length
                       + patientExercises.filter(e => e.completed).length;

  const assignSystemExercise = async (ex: SysEx) => {
    try {
      const title = isRTL ? ex.titleAr : ex.titleEn;
      await addDoc(collection(db, 'exercises', patientId, 'items'), {
        title, emoji: ex.emoji, durationMin: ex.durationMin,
        description: isRTL ? ex.descAr : ex.descEn,
        assignedAt: Date.now(), completed: false, type: ex.type,
        pendingEdit: null, source: 'doctor', systemKey: ex.key,
      });
      sendPushToUser(patientId,
        isRTL ? '🏋️ تمرين جديد من طبيبك' : '🏋️ New exercise from your doctor',
        `${ex.emoji} ${title}`,
      ).catch(() => {});
    } catch (e) { console.warn('[assignSysEx]', e); }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) { Alert.alert(t.docExerciseNotice, t.docEnterExerciseName); return; }
    const mins = parseInt(newMins);
    if (!newMins.trim() || isNaN(mins) || mins <= 0) { Alert.alert(t.docExerciseNotice, t.docEnterValidDuration); return; }
    if (saving) return;
    setSaving(true);
    try {
      let fileExtra: Record<string, any> = {};
      if (attachFile) {
        const fileUrl = await uploadFileToCloudinary(attachFile.uri, attachFile.mimeType, attachFile.name);
        fileExtra = { fileUrl, fileName: attachFile.name, mimeType: attachFile.mimeType };
      }
      await addDoc(collection(db, 'exercises', patientId, 'items'), {
        title: newTitle.trim(), emoji: newEmoji.trim() || '🏋️',
        durationMin: mins, description: newDesc.trim() || '',
        assignedAt: Date.now(), completed: false, type: newType, pendingEdit: null,
        source: 'doctor', ...fileExtra,
      });
      sendPushToUser(
        patientId,
        isRTL ? '🏋️ تمرين جديد من طبيبك' : '🏋️ New exercise from your doctor',
        `${newEmoji.trim() || '🏋️'} ${newTitle.trim()}`,
      ).catch(() => {});
      resetForm(); setShowAddForm(false);
    } catch (e) { console.warn('[ExerciseModal] add error:', e); setSaving(false); }
  };

  const openEdit = (ex: FirebaseExercise) => {
    setEditingEx(ex); setEditTitle(ex.title); setEditEmoji(ex.emoji);
    setEditMins(String(ex.durationMin)); setEditDesc(ex.description ?? '');
    setEditType((ex.type ?? 'therapy') as ExSectionKey); setEditSaving(false);
  };

  const handleSubmitEdit = async () => {
    if (!editingEx) return;
    const mins = parseInt(editMins);
    if (!editTitle.trim()) { Alert.alert(t.docExerciseNotice, t.docEnterExerciseName); return; }
    if (isNaN(mins) || mins <= 0) { Alert.alert(t.docExerciseNotice, t.docEnterValidDuration); return; }
    if (editSaving) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, 'exercises', patientId, 'items', editingEx.id), {
        pendingEdit: {
          title: editTitle.trim(), emoji: editEmoji.trim() || editingEx.emoji,
          durationMin: mins, description: editDesc.trim(),
          type: editType, requestedAt: Date.now(), requestedBy: 'doctor', status: 'pending',
        },
      });
      setEditingEx(null);
      Alert.alert(t.docEditRequestSent, t.docEditRequestSentBody);
    } catch (e) { console.warn('[ExerciseModal] edit error:', e); }
    finally { setEditSaving(false); }
  };

  const handleDelete = (ex: FirebaseExercise) => {
    Alert.alert(
      t.docDeleteExerciseTitle,
      `${t.docDeleteExerciseConfirm} "${ex.title}"?`,
      [
        { text: t.docCancelBtn, style: 'cancel' },
        { text: isRTL ? 'حذف' : 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteDoc(doc(db, 'exercises', patientId, 'items', ex.id)); } catch (e) { console.warn(e); }
        }},
      ],
    );
  };

  const handleSaveExFile = async (ex: FirebaseExercise) => {
    const uri = ex.fileUrl || ex.fileUri;
    if (!uri || savingId === ex.id) return;
    setSavingId(ex.id);
    await saveAttachmentToDevice(uri, ex.fileName || 'file', ex.mimeType, isRTL);
    setSavingId(null);
  };

  const exTitle = patientName
    ? (isRTL ? `تمارين ${patientName}` : `${patientName}'s Exercises`)
    : (isRTL ? 'تمارين المريض' : "Patient's Exercises");

  const subTitle = loadingPatient
    ? t.docExercisesLoading
    : `${totalExercises} ${t.docExercisesCount}${doneCount > 0 ? ` · ${doneCount} ${t.docExercisesDone}` : ''}`;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F5FF' }} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={exStyles.header}>
          <TouchableOpacity onPress={onClose} style={exStyles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={DOC_COLOR} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={exStyles.headerTitle}>{exTitle}</Text>
            <Text style={exStyles.headerSub}>{subTitle}</Text>
          </View>
          <TouchableOpacity style={exStyles.addHeaderBtn} onPress={() => { setMode('assigned'); setActiveSection('all'); setNewType(activeSection === 'all' ? 'therapy' : activeSection as ExSectionKey); setShowAddForm(true); }} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Mode Toggle ── */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#EDE9F8', borderRadius: 12, padding: 3 }}>
          <TouchableOpacity
            style={[{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' }, mode === 'library' && { backgroundColor: DOC_COLOR }]}
            onPress={() => { setMode('library'); setShowAddForm(false); setActiveSection('therapy'); }} activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: mode === 'library' ? '#fff' : DOC_COLOR }}>
              {isRTL ? '📚 المكتبة' : '📚 Library'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' }, mode === 'assigned' && { backgroundColor: DOC_COLOR }]}
            onPress={() => { setMode('assigned'); setShowAddForm(false); setActiveSection('all'); }} activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: mode === 'assigned' ? '#fff' : DOC_COLOR }}>
              {isRTL ? `✅ المُعيَّنة (${doctorExercises.length})` : `✅ Assigned (${doctorExercises.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Section Tabs ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={exStyles.tabsRow} style={exStyles.tabsScroll}>
          {/* All tab — only in assigned mode */}
          {mode === 'assigned' && (() => {
            const isAct = activeSection === 'all';
            const total = doctorExercises.length + patientExercises.length;
            return (
              <TouchableOpacity
                key="all"
                style={[exStyles.tabBtn, isAct && { backgroundColor: DOC_COLOR }]}
                onPress={() => setActiveSection('all')} activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13 }}>📋</Text>
                <Text style={[exStyles.tabLabel, { color: isAct ? '#fff' : DOC_COLOR }]}>
                  {isRTL ? 'الكل' : 'All'}
                </Text>
                {total > 0 && (
                  <View style={[exStyles.tabBadge, { backgroundColor: isAct ? 'rgba(255,255,255,0.3)' : DOC_COLOR + '22' }]}>
                    <Text style={[exStyles.tabBadgeText, { color: isAct ? '#fff' : DOC_COLOR }]}>{total}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })()}
          {EX_SECTION_CONFIGS.map((sec) => {
            const isAct = activeSection === sec.key;
            const cnt   = mode === 'library'
              ? SYSTEM_EXERCISES.filter(e => e.type === sec.key).length
              : getSectionCount(sec.key);
            return (
              <TouchableOpacity
                key={sec.key}
                style={[exStyles.tabBtn, isAct && { backgroundColor: sec.color }]}
                onPress={() => setActiveSection(sec.key)} activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13 }}>{sec.emoji}</Text>
                <Text style={[exStyles.tabLabel, { color: isAct ? '#fff' : sec.color }]}>
                  {isRTL ? sec.labelAr : sec.labelEn}
                </Text>
                {cnt > 0 && (
                  <View style={[exStyles.tabBadge, { backgroundColor: isAct ? 'rgba(255,255,255,0.3)' : sec.color + '22' }]}>
                    <Text style={[exStyles.tabBadgeText, { color: isAct ? '#fff' : sec.color }]}>{cnt}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={exStyles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Library Mode ── */}
          {mode === 'library' && (() => {
            const libList = SYSTEM_EXERCISES.filter(e => e.type === activeSection);
            const libCfg  = EX_SECTION_CONFIGS.find(s => s.key === activeSection)!;
            if (libList.length === 0) return (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>{libCfg.emoji}</Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted, textAlign: 'center' }}>
                  {isRTL ? 'لا توجد تمارين في هذه الفئة' : 'No exercises in this category'}
                </Text>
              </View>
            );
            return libList.map((ex) => {
              const alreadyAssigned = doctorExercises.some(d => (d as any).systemKey === ex.key);
              return (
                <View key={ex.key} style={[exStyles.patientCard, { backgroundColor: libCfg.bg, borderLeftColor: libCfg.color, flexDirection: 'row', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 26, marginRight: 12 }}>{ex.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[exStyles.patientCardTitle, { color: libCfg.color }]} numberOfLines={1}>
                      {isRTL ? ex.titleAr : ex.titleEn}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <Ionicons name="time-outline" size={11} color={libCfg.color} />
                      <Text style={[exStyles.patientCardMeta, { color: libCfg.color }]}>{ex.durationMin} {isRTL ? 'دقيقة' : 'min'}</Text>
                    </View>
                    <Text style={[exStyles.patientCardDesc, { marginTop: 3 }]} numberOfLines={1}>
                      {isRTL ? ex.descAr : ex.descEn}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                      backgroundColor: alreadyAssigned ? '#4CAF50' : libCfg.color,
                      opacity: alreadyAssigned ? 0.7 : 1, marginLeft: 8,
                    }}
                    onPress={() => !alreadyAssigned && assignSystemExercise(ex)}
                    activeOpacity={alreadyAssigned ? 1 : 0.8}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                      {alreadyAssigned ? (isRTL ? '✓ مُضاف' : '✓ Added') : (isRTL ? '+ إضافة' : '+ Add')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            });
          })()}

          {/* ── Assigned Mode ── */}
          {/* Patient base exercises */}
          {mode === 'assigned' && assignedPatient.length > 0 && (
            <View style={exStyles.sectionGroup}>
              <View style={exStyles.sectionGroupHeader}>
                <Ionicons name="person-outline" size={14} color={activeCfg.color} />
                <Text style={[exStyles.sectionGroupTitle, { color: activeCfg.color }]}>
                  {t.docPatientBaseExercises}
                </Text>
                <View style={[exStyles.sectionGroupBadge, { backgroundColor: activeCfg.color + '20' }]}>
                  <Text style={[exStyles.sectionGroupBadgeText, { color: activeCfg.color }]}>{assignedPatient.length}</Text>
                </View>
              </View>
              {assignedPatient.map((pe) => {
                const cfg = EX_SECTION_CONFIGS.find(s => s.key === pe.type) ?? activeCfg;
                return (
                  <View key={pe.key} style={[exStyles.patientCard, { backgroundColor: cfg.bg, borderLeftColor: cfg.color }]}>
                    <Text style={exStyles.patientCardEmoji}>{pe.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[exStyles.patientCardTitle, { color: cfg.color }]}>
                        {isRTL ? pe.title : pe.titleEn}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
                        <Ionicons name="time-outline" size={11} color={cfg.color} />
                        <Text style={[exStyles.patientCardMeta, { color: cfg.color }]}>
                          {isRTL ? pe.duration : pe.durationEn}
                        </Text>
                        {pe.custom && (
                          <View style={[exStyles.customBadge, { backgroundColor: cfg.color + '20' }]}>
                            <Text style={[exStyles.customBadgeText, { color: cfg.color }]}>{t.docExerciseCustom}</Text>
                          </View>
                        )}
                        {pe.completed && (
                          <View style={exStyles.patientDoneBadge}>
                            <Ionicons name="checkmark-circle" size={11} color="#4CAF50" />
                            <Text style={exStyles.patientDoneBadgeText}>{t.docExercisesDone}</Text>
                          </View>
                        )}
                      </View>
                      {!!(isRTL ? pe.desc : pe.descEn) && (
                        <Text style={exStyles.patientCardDesc} numberOfLines={2}>
                          {isRTL ? pe.desc : pe.descEn}
                        </Text>
                      )}
                    </View>
                    <View style={exStyles.readOnlyBadge}>
                      <Ionicons name="eye-outline" size={12} color="#B0BEC5" />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Doctor exercises */}
          {mode === 'assigned' && assignedDoctor.length > 0 && (
            <View style={[exStyles.sectionGroup, { marginTop: assignedPatient.length > 0 ? 10 : 0 }]}>
              <View style={exStyles.sectionGroupHeader}>
                <Ionicons name="medical-outline" size={14} color={DOC_COLOR} />
                <Text style={[exStyles.sectionGroupTitle, { color: DOC_COLOR }]}>
                  {t.docDoctorExercises}
                </Text>
                <View style={[exStyles.sectionGroupBadge, { backgroundColor: DOC_COLOR + '20' }]}>
                  <Text style={[exStyles.sectionGroupBadgeText, { color: DOC_COLOR }]}>{assignedDoctor.length}</Text>
                </View>
              </View>
              {assignedDoctor.map((ex) => {
                const cfg        = EX_SECTION_CONFIGS.find((s) => s.key === (ex.type ?? 'therapy'))!;
                const hasPending = !!ex.pendingEdit && (ex.pendingEdit as any).status === 'pending';
                return (
                  <View key={ex.id} style={[exStyles.card, { backgroundColor: cfg.bg }]}>
                    <View style={[exStyles.cardBar, { backgroundColor: cfg.color }]} />
                    <Text style={exStyles.cardEmoji}>{ex.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={exStyles.cardTitleRow}>
                        <Text style={[exStyles.cardTitle, { color: cfg.color }]}>{ex.title}</Text>
                        {ex.completed && (
                          <View style={exStyles.doneBadge}>
                            <Text style={exStyles.doneBadgeText}>{t.docExerciseDoneBadgeFull}</Text>
                          </View>
                        )}
                        {hasPending && (
                          <View style={exStyles.pendingBadge}>
                            <Ionicons name="time-outline" size={11} color="#F4A32B" />
                            <Text style={exStyles.pendingBadgeText}>{t.docExercisePendingBadge}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                        <Ionicons name="time-outline" size={11} color={cfg.color} />
                        <Text style={[exStyles.cardMeta, { color: cfg.color, marginLeft: 4 }]}>
                          {ex.durationMin} {t.docExerciseMin}
                        </Text>
                        <View style={[exStyles.sectionPill, { backgroundColor: cfg.color + '20', marginLeft: 6 }]}>
                          <Text style={[exStyles.sectionPillText, { color: cfg.color }]}>
                            {cfg.emoji} {isRTL ? cfg.labelAr : cfg.labelEn}
                          </Text>
                        </View>
                      </View>
                      {!!ex.description && <Text style={exStyles.cardDesc} numberOfLines={2}>{ex.description}</Text>}
                      {hasPending && ex.pendingEdit && (
                        <View style={exStyles.pendingPreview}>
                          <Text style={exStyles.pendingPreviewLabel}>{t.docExerciseProposed}</Text>
                          {ex.pendingEdit.title      && <Text style={exStyles.pendingPreviewText}>{t.docExerciseNameLabel} {ex.pendingEdit.title}</Text>}
                          {ex.pendingEdit.durationMin && <Text style={exStyles.pendingPreviewText}>{t.docExerciseDurationLabel2} {ex.pendingEdit.durationMin} {t.docExerciseMin}</Text>}
                        </View>
                      )}
                      {!!(ex.fileUrl || ex.fileUri) && (
                        <TouchableOpacity style={exStyles.fileChip} onPress={() => handleSaveExFile(ex)} activeOpacity={0.8}>
                          {savingId === ex.id ? <ActivityIndicator size="small" color={DOC_COLOR} /> : <Ionicons name="document-attach-outline" size={13} color={DOC_COLOR} />}
                          <Text style={exStyles.fileChipText} numberOfLines={1}>{ex.fileName || t.docExerciseAttachment}</Text>
                          <Ionicons name="download-outline" size={13} color={DOC_COLOR} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={exStyles.cardActions}>
                      {!hasPending && (
                        <TouchableOpacity style={exStyles.editBtn} onPress={() => openEdit(ex)} activeOpacity={0.8}>
                          <Ionicons name="pencil-outline" size={16} color={cfg.color} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={exStyles.deleteBtn} onPress={() => handleDelete(ex)} activeOpacity={0.8}>
                        <Ionicons name="trash-outline" size={16} color="#E05C5C" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Empty state */}
          {mode === 'assigned' && assignedPatient.length === 0 && assignedDoctor.length === 0 && !showAddForm && (
            <View style={exStyles.emptyState}>
              <Text style={{ fontSize: 48 }}>{activeSection === 'all' ? '📋' : activeCfg.emoji}</Text>
              <Text style={exStyles.emptyText}>
                {activeSection === 'all'
                  ? (isRTL ? 'لا توجد تمارين مُعيَّنة بعد' : 'No exercises assigned yet')
                  : (isRTL ? `${t.docNoExercisesSection} ${activeCfg.labelAr}` : `${t.docNoExercisesSection} ${activeCfg.labelEn}`)}
              </Text>
              <TouchableOpacity
                style={[exStyles.emptyAddBtn, { borderColor: activeCfg.color }]}
                onPress={() => { setNewType(activeSection === 'all' ? 'therapy' : activeSection as ExSectionKey); setShowAddForm(true); }}
              >
                <Ionicons name="add" size={16} color={activeCfg.color} />
                <Text style={[exStyles.emptyAddText, { color: activeCfg.color }]}>{t.docAddExerciseBtn}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Add Form */}
          {mode === 'assigned' && showAddForm && (
            <View style={exStyles.addForm}>
              <Text style={exStyles.addFormTitle}>{t.docNewExerciseTitle}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={exStyles.typeRow}>
                {EX_SECTION_CONFIGS.map((sec) => {
                  const isAct = newType === sec.key;
                  return (
                    <TouchableOpacity key={sec.key} style={[exStyles.typeBtn, { borderColor: sec.color }, isAct && { backgroundColor: sec.color }]} onPress={() => setNewType(sec.key)} activeOpacity={0.8}>
                      <Text style={{ fontSize: 14 }}>{sec.emoji}</Text>
                      <Text style={[exStyles.typeBtnText, { color: isAct ? '#fff' : sec.color }]}>{isRTL ? sec.labelAr : sec.labelEn}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: 'row' }}>
                <TextInput style={[exStyles.input, { width: 54, textAlign: 'center', marginRight: 8 }]} value={newEmoji} onChangeText={setNewEmoji} placeholder="🏋️" maxLength={4} />
                <TextInput style={[exStyles.input, { flex: 1 }]} value={newTitle} onChangeText={setNewTitle} placeholder={t.docEnterExerciseName} placeholderTextColor="#bbb" />
              </View>
              <TextInput style={exStyles.input} value={newMins} onChangeText={setNewMins} placeholder={t.docEnterValidDuration} placeholderTextColor="#bbb" keyboardType="numeric" />
              <TextInput style={[exStyles.input, { height: 64, textAlignVertical: 'top' }]} value={newDesc} onChangeText={setNewDesc} placeholder={isRTL ? 'وصف (اختياري)' : 'Description (optional)'} placeholderTextColor="#bbb" multiline />
              <TouchableOpacity style={exStyles.attachRow} onPress={() => setShowAttach(true)} activeOpacity={0.8}>
                <Ionicons name="attach-outline" size={18} color={DOC_COLOR} />
                <Text style={exStyles.attachRowText} numberOfLines={1}>
                  {attachFile ? attachFile.name : t.docAttachFile}
                </Text>
                {attachFile && <TouchableOpacity onPress={() => setAttachFile(null)}><Ionicons name="close-circle" size={18} color="#E05C5C" /></TouchableOpacity>}
              </TouchableOpacity>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[exStyles.formBtn, { flex: 1, backgroundColor: '#F5F5F5', borderColor: '#E0D6F5', marginRight: 8 }]} onPress={() => { resetForm(); setShowAddForm(false); }} activeOpacity={0.8}>
                  <Text style={{ fontSize: 14, color: '#888', fontWeight: '600' }}>{t.docCancelBtn}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[exStyles.formBtn, { flex: 1, backgroundColor: EX_SECTION_CONFIGS.find(s => s.key === newType)?.color ?? DOC_COLOR, opacity: saving ? 0.6 : 1 }]} onPress={handleAdd} disabled={saving} activeOpacity={0.85}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={16} color="#fff" />}
                  <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600', marginLeft: 4 }}>
                    {saving ? t.docSavingDots : t.docSaveBtn}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        <AttachmentSheet visible={showAttach} onClose={() => setShowAttach(false)} onPick={(a) => { setAttachFile(a); setShowAttach(false); }} isRTL={isRTL} t={t} />

        {/* Edit Modal */}
        <Modal visible={!!editingEx} transparent animationType="slide" onRequestClose={() => setEditingEx(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={() => setEditingEx(null)} />
            <View style={exStyles.editBox}>
              <View style={exStyles.editBoxHeader}>
                <Text style={exStyles.editBoxTitle}>{t.docEditExerciseTitle}</Text>
                <TouchableOpacity onPress={() => setEditingEx(null)} style={exStyles.editBoxClose}>
                  <Ionicons name="close" size={20} color="#888" />
                </TouchableOpacity>
              </View>
              <Text style={exStyles.editBoxNote}>{t.docEditWarning}</Text>
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={exStyles.typeRow}>
                  {EX_SECTION_CONFIGS.map((sec) => {
                    const isAct = editType === sec.key;
                    return (
                      <TouchableOpacity key={sec.key} style={[exStyles.typeBtn, { borderColor: sec.color }, isAct && { backgroundColor: sec.color }]} onPress={() => setEditType(sec.key)} activeOpacity={0.8}>
                        <Text style={{ fontSize: 14 }}>{sec.emoji}</Text>
                        <Text style={[exStyles.typeBtnText, { color: isAct ? '#fff' : sec.color }]}>{isRTL ? sec.labelAr : sec.labelEn}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <TextInput style={[exStyles.input, { width: 54, textAlign: 'center', marginRight: 8 }]} value={editEmoji} onChangeText={setEditEmoji} placeholder="🏋️" maxLength={4} />
                  <TextInput style={[exStyles.input, { flex: 1 }]} value={editTitle} onChangeText={setEditTitle} placeholder={t.docEnterExerciseName} placeholderTextColor="#bbb" />
                </View>
                <TextInput style={[exStyles.input, { marginTop: 10 }]} value={editMins} onChangeText={setEditMins} placeholder={t.docEnterValidDuration} placeholderTextColor="#bbb" keyboardType="numeric" />
                <TextInput style={[exStyles.input, { height: 64, textAlignVertical: 'top', marginTop: 10 }]} value={editDesc} onChangeText={setEditDesc} placeholder={isRTL ? 'وصف (اختياري)' : 'Description (optional)'} placeholderTextColor="#bbb" multiline />
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <TouchableOpacity style={[exStyles.formBtn, { flex: 1, backgroundColor: '#F5F5F5', borderColor: '#E0D6F5', marginRight: 8 }]} onPress={() => setEditingEx(null)} activeOpacity={0.8}>
                    <Text style={{ fontSize: 14, color: '#888', fontWeight: '600' }}>{t.docCancelBtn}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[exStyles.formBtn, { flex: 1, backgroundColor: DOC_COLOR, opacity: editSaving ? 0.6 : 1 }]} onPress={handleSubmitEdit} disabled={editSaving} activeOpacity={0.85}>
                    {editSaving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send-outline" size={16} color="#fff" />}
                    <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600', marginLeft: 4 }}>
                      {editSaving ? t.docSendingDots : t.docSendToPatient}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </SafeAreaView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
export function useDoctorEditRequests(isRTL: boolean, t: any) {
  const uid = auth.currentUser?.uid;
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, 'exercises', uid, 'items'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== 'modified') return;
        const data = change.doc.data() as FirebaseExercise;
        if ((data.pendingEdit as any)?.status !== 'pending') return;
        const pe = data.pendingEdit!;
        Alert.alert(
          isRTL ? '🩺 طلب تعديل من الدكتور' : '🩺 Doctor Edit Request',
          isRTL
            ? `يريد دكتورك تعديل تمرين "${data.title}"${pe.title !== data.title ? `\n➡️ الاسم الجديد: ${pe.title}` : ''}${pe.durationMin !== data.durationMin ? `\n⏱ المدة الجديدة: ${pe.durationMin} دقيقة` : ''}`
            : `Your doctor wants to edit "${data.title}"${pe.title !== data.title ? `\n➡️ New name: ${pe.title}` : ''}${pe.durationMin !== data.durationMin ? `\n⏱ New duration: ${pe.durationMin} min` : ''}`,
          [
            {
              text: isRTL ? '✅ قبول' : '✅ Accept',
              onPress: async () => {
                try {
                  await updateDoc(doc(db, 'exercises', uid, 'items', change.doc.id), {
                    title: pe.title ?? data.title, emoji: pe.emoji ?? data.emoji,
                    durationMin: pe.durationMin ?? data.durationMin, description: pe.description ?? data.description,
                    type: pe.type ?? data.type, pendingEdit: null,
                  });
                } catch (e) { console.warn(e); }
              },
            },
            {
              text: isRTL ? '❌ رفض' : '❌ Reject', style: 'destructive',
              onPress: async () => {
                try { await updateDoc(doc(db, 'exercises', uid, 'items', change.doc.id), { pendingEdit: { ...pe, status: 'rejected' } }); }
                catch (e) { console.warn(e); }
              },
            },
          ],
          { cancelable: false },
        );
      });
    });
    return unsub;
  }, [uid, isRTL]);
}

// ─── Main Screen ──────────────────────────────────────────
export default function Docpatient() {
  const { patientId, patientName, isOnline: isOnlineParam } =
    useLocalSearchParams<{ patientId: string; patientName: string; isOnline: string }>();

  const { isRTL, t }   = useLang();
  const { markAsRead } = useChats();
  const insets         = useSafeAreaInsets();
  const [isOnline, setIsOnline] = useState(isOnlineParam === '1');

  const doctorId = auth.currentUser?.uid ?? '';
  const chatId   = doctorId && patientId ? `${doctorId}_${patientId}` : '';

  const [messages,        setMessages]        = useState<Message[]>([]);
  const [exerciseAccess,  setExerciseAccess]  = useState(false);
  const [showExercises,   setShowExercises]   = useState(false);
  const [inputText,       setInputText]       = useState('');
  const [showQuick,       setShowQuick]       = useState(false);
  const [showAttach,      setShowAttach]      = useState(false);
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | null>(null);
  const [kbHeight,        setKbHeight]        = useState(0);

  const listRef          = useRef<any>(null);
  const quickAnim        = useRef(new Animated.Value(0)).current;
  const initialScrollDone = useRef(false);

  useFocusEffect(useCallback(() => { if (patientId) markAsRead(patientId); }, [patientId]));

  useEffect(() => {
    if (!patientId) return;
    return subscribeToPresence(patientId, (online) => setIsOnline(online));
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    getDoc(doc(db, 'users', patientId)).then(snap => {
      if (snap.exists()) setPatientPhotoUrl(snap.data().photoUrl ?? null);
    }).catch(() => {});
  }, [patientId]);

  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map(d => {
        const data = d.data() as FSMessage;
        return {
          id: d.id, text: data.text, sender: data.sender,
          time: fmtMsgTime(data.timestamp, isRTL),
          status: data.status, type: data.type, fileUri: data.fileUri, fileUrl: data.fileUrl,
          fileName: data.fileName, fileSize: data.fileSize, mimeType: data.mimeType,
        };
      });
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    });
    return unsub;
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (snap.exists()) setExerciseAccess((snap.data() as FSChat).exerciseAccess ?? false);
    });
    return unsub;
  }, [chatId]);

  const initials = patientName
    ? patientName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  const toggleQuick = () => {
    setShowQuick((prev: boolean) => {
      Animated.spring(quickAnim, { toValue: prev ? 0 : 1, tension: 120, friction: 8, useNativeDriver: true }).start();
      return !prev;
    });
  };

  const updateChatMeta = useCallback((lastMessage: string, ts: number) =>
    updateDoc(doc(db, 'chats', chatId), { lastMessage, lastMessageTime: ts, lastMessageSender: 'doctor' }).catch(() => {}),
  [chatId]);

  const sendAccessRequest = useCallback(async () => {
    if (!chatId) return;
    const ts = Date.now();
    const text = isRTL ? '🏋️ طلب الوصول لبرنامج التمارين' : '🏋️ Exercise access request';
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text, sender: 'doctor', timestamp: ts, status: 'sent', type: 'request_access',
    }).catch(() => {});
    await updateChatMeta(text, ts);
  }, [chatId, isRTL, updateChatMeta]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !chatId) return;
    const ts = Date.now();
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: text.trim(), sender: 'doctor', timestamp: ts, status: 'sent', type: 'text',
    }).catch(() => {});
    await updateChatMeta(text.trim(), ts);
    notifyMessageSent(patientName || (isRTL ? 'مريض' : 'Patient'), patientId || '', text.trim()).catch(() => {});
    if (patientId) sendPushToUser(patientId, isRTL ? '💬 رسالة من طبيبك' : '💬 Message from your doctor', text.trim()).catch(() => {});
    setInputText('');
    setShowQuick(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatId, patientId, patientName, updateChatMeta]);

  const handleSendAttachment = useCallback(async (a: PickedAttachment) => {
    if (!chatId) return;
    let fileUrl: string;
    try {
      fileUrl = await uploadFileToCloudinary(a.uri, a.mimeType, a.name);
    } catch {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل رفع الملف، حاول مرة أخرى' : 'File upload failed, try again');
      return;
    }
    const ts      = Date.now();
    const msgType = a.type === 'image' ? 'image' : 'file';
    const preview = a.type === 'image' ? t.docImageMsg : `📎 ${a.name}`;
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: preview, sender: 'doctor', timestamp: ts, status: 'sent', type: msgType,
      fileUrl, fileName: a.name, fileSize: a.size ?? null, mimeType: a.mimeType,
    }).catch(() => {});
    await updateChatMeta(preview, ts);
    notifyMessageSent(patientName || (isRTL ? 'مريض' : 'Patient'), patientId || '', preview).catch(() => {});
    if (patientId) sendPushToUser(patientId, isRTL ? '💬 رسالة من طبيبك' : '💬 Message from your doctor', preview).catch(() => {});
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatId, patientId, patientName, isRTL, updateChatMeta]);

  const handleQuickReply = (text: string) => {
    sendMessage(text);
    Animated.timing(quickAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    setShowQuick(false);
  };

  const rtlRow   = (r: boolean): { flexDirection: 'row' | 'row-reverse' } => ({ flexDirection: r ? 'row-reverse' : 'row' });
  const rtlAlign = (r: boolean): { textAlign: 'right' | 'left' } => ({ textAlign: r ? 'right' : 'left' });
  const keyboardOffset = 68 + insets.top;

  const QUICK_REPLIES: string[] = t.docQuickReplies;

  useEffect(() => {
    if (messages.length > 0 && !initialScrollDone.current) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: false });
        initialScrollDone.current = true;
      }, 150);
    }
  }, [messages]);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={DOC_COLOR} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.headerAvatar, isOnline && styles.headerAvatarOnline]}>
            {patientPhotoUrl
              ? <Image source={{ uri: patientPhotoUrl }} style={styles.headerAvatarImg} />
              : <Text style={styles.headerInitials}>{initials}</Text>}
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{patientName || (isRTL ? 'مريض' : 'Patient')}</Text>
            <View style={styles.onlineRow}>
              <View style={[styles.onlineDot, !isOnline && styles.offlineDot]} />
              <Text style={[styles.onlineText, !isOnline && styles.offlineText]}>
                {isOnline ? t.docActiveNow : t.docOffline}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.exerciseBtn, exerciseAccess && styles.exerciseBtnActive]}
          activeOpacity={0.8}
          onPress={() => exerciseAccess ? setShowExercises(true) : sendAccessRequest()}
        >
          <Ionicons name="barbell-outline" size={20} color={exerciseAccess ? '#4CAF82' : DOC_COLOR} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1, marginBottom: kbHeight }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          extraData={patientPhotoUrl}
          ListHeaderComponent={<DateDivider label={t.docToday} />}
          renderItem={({ item }) => <MessageBubble msg={item} isRTL={isRTL} t={t} patientPhotoUrl={patientPhotoUrl} />}
        />

        {showQuick && (
          <Animated.View style={[styles.quickWrap, {
            opacity: quickAnim,
            transform: [{ translateY: quickAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }]}>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={styles.quickContent}
            >
              {QUICK_REPLIES.map((qr, i) => (
                <TouchableOpacity key={i} onPress={() => handleQuickReply(qr)} style={styles.quickChip} activeOpacity={0.8}>
                  <Text style={styles.quickChipText}>{qr}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        <View style={[styles.inputBar, rtlRow(isRTL), { paddingBottom: 10 + insets.bottom }]}>
          <TouchableOpacity onPress={toggleQuick} style={[styles.iconBtn, showQuick && styles.iconBtnActive]} activeOpacity={0.8}>
            <Ionicons name={showQuick ? 'close' : 'flash'} size={20} color={showQuick ? '#fff' : DOC_COLOR} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAttach(true)} style={styles.iconBtn} activeOpacity={0.8}>
            <Ionicons name="attach" size={22} color={DOC_COLOR} />
          </TouchableOpacity>
          <View style={[styles.inputWrap, rtlRow(isRTL)]}>
            <TextInput
              value={inputText} onChangeText={setInputText}
              placeholder={t.docWriteMessage}
              placeholderTextColor={Colors.textMuted}
              style={[styles.textInput, rtlAlign(isRTL)]}
              multiline maxLength={500} returnKeyType="default"
            />
          </View>
          <TouchableOpacity
            onPress={() => sendMessage(inputText)}
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            activeOpacity={0.8} disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: isRTL ? 0 : 2 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ExerciseManagementModal
        visible={showExercises} onClose={() => setShowExercises(false)}
        patientId={patientId || ''} isRTL={isRTL} patientName={patientName} t={t}
      />

      <AttachmentSheet
        visible={showAttach} onClose={() => setShowAttach(false)}
        onPick={(a) => { setShowAttach(false); handleSendAttachment(a); }}
        isRTL={isRTL} t={t}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: '#F8F5FF' },
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0EBFA', shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  backBtn:            { width: 40, height: 40, borderRadius: 20, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerInfo:         { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: DOC_COLOR + '40', marginRight: 10, overflow: 'hidden' },
  headerAvatarImg:    { width: 44, height: 44, borderRadius: 22 },
  headerAvatarOnline: { borderColor: '#4CAF82' },
  headerInitials:     { fontSize: 16, fontWeight: '800', color: DOC_COLOR },
  headerName:         { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, maxWidth: 160 },
  onlineRow:          { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  onlineDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4CAF82', marginRight: 5 },
  offlineDot:         { backgroundColor: '#B0BEC5' },
  onlineText:         { fontSize: 11, color: '#4CAF82', fontWeight: '600' },
  offlineText:        { color: '#B0BEC5' },
  exerciseBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  exerciseBtnActive:  { backgroundColor: '#E8F8F2', borderWidth: 1.5, borderColor: '#4CAF82' },
  listContent:        { paddingHorizontal: Spacing.base, paddingBottom: 12 },
  quickWrap:          { height: 56, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0EBFA' },
  quickContent:       { paddingHorizontal: Spacing.base, alignItems: 'center', flexDirection: 'row' },
  quickChip:          { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: DOC_COLOR + '40', shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, marginRight: 8 },
  quickChipText:      { fontSize: 12, color: DOC_COLOR, fontWeight: '600', lineHeight: 18 },
  inputBar:           { alignItems: 'flex-end', paddingHorizontal: Spacing.base, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0EBFA', shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  inputWrap:          { flex: 1, backgroundColor: Colors.background, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: '#E8DFFA', minHeight: 44, maxHeight: 120, marginHorizontal: 8 },
  textInput:          { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0, lineHeight: 20 },
  iconBtn:            { width: 44, height: 44, borderRadius: 22, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive:      { backgroundColor: DOC_COLOR },
  sendBtn:            { width: 44, height: 44, borderRadius: 22, backgroundColor: DOC_COLOR, alignItems: 'center', justifyContent: 'center', shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  sendBtnDisabled:    { backgroundColor: '#B0BEC5', shadowOpacity: 0 },
});

const exStyles = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0EBFA', shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EBFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  addHeaderBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DOC_COLOR, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: '#2d2d2d' },
  headerSub:    { fontSize: 12, color: DOC_COLOR, marginTop: 2 },
  tabsScroll:   { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0EBFA' },
  tabsRow:      { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row' },
  tabBtn:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F5F5F5', marginRight: 8 },
  tabLabel:     { fontSize: 12, fontWeight: '700', marginLeft: 5 },
  tabBadge:     { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 5 },
  tabBadgeText: { fontSize: 10, fontWeight: '800' },
  listContent: { padding: 16, paddingBottom: 40 },
  emptyState:  { alignItems: 'center', paddingVertical: 60 },
  emptyText:   { fontSize: 14, color: '#B0BEC5', textAlign: 'center', marginTop: 12 },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16, marginTop: 12 },
  emptyAddText:{ fontSize: 13, fontWeight: '700', marginLeft: 6 },
  sectionGroup:        { marginBottom: 6 },
  sectionGroupHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingHorizontal: 4 },
  sectionGroupTitle:   { fontSize: 13, fontWeight: '700', flex: 1 },
  sectionGroupBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionGroupBadgeText: { fontSize: 11, fontWeight: '800' },
  patientCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    padding: 12, marginBottom: 8, borderLeftWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  patientCardEmoji: { fontSize: 26, width: 38, textAlign: 'center', marginRight: 10 },
  patientCardTitle: { fontSize: 13, fontWeight: '700' },
  patientCardMeta:  { fontSize: 12, fontWeight: '600' },
  patientCardDesc:  { fontSize: 11, color: '#B0BEC5', marginTop: 3 },
  readOnlyBadge:    { padding: 4 },
  customBadge:      { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  customBadgeText:  { fontSize: 10, fontWeight: '700' },
  patientDoneBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF5020', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, gap: 3 },
  patientDoneBadgeText: { fontSize: 10, fontWeight: '700', color: '#4CAF50' },
  card:         { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: '#E8DFFA', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1, overflow: 'hidden', marginBottom: 10 },
  cardBar:      { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 4 },
  cardEmoji:    { fontSize: 28, width: 40, textAlign: 'center', marginRight: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardTitle:    { fontSize: 14, fontWeight: '600', marginRight: 8 },
  cardMeta:     { fontSize: 12, fontWeight: '600' },
  cardDesc:     { fontSize: 11, color: '#B0BEC5', marginTop: 3, lineHeight: 16 },
  sectionPill:  { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sectionPillText: { fontSize: 10, fontWeight: '700' },
  doneBadge:    { backgroundColor: '#E8F5EF', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  doneBadgeText:{ fontSize: 11, fontWeight: '700', color: '#4CAF82' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3E2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  pendingBadgeText: { fontSize: 10, fontWeight: '700', color: '#F4A32B', marginLeft: 3 },
  pendingPreview:       { marginTop: 6, backgroundColor: 'rgba(244,163,43,0.1)', borderRadius: 8, padding: 8 },
  pendingPreviewLabel:  { fontSize: 11, fontWeight: '700', color: '#F4A32B' },
  pendingPreviewText:   { fontSize: 11, color: '#888', marginTop: 2 },
  cardActions: { flexDirection: 'column', flexShrink: 0, marginLeft: 6 },
  editBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F8FF', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  deleteBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FDEAEA', alignItems: 'center', justifyContent: 'center' },
  fileChip:    { flexDirection: 'row', alignItems: 'center', marginTop: 6, backgroundColor: DOC_COLOR_LIGHT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  fileChipText:{ fontSize: 11, color: DOC_COLOR, fontWeight: '600', maxWidth: 120, marginHorizontal: 4 },
  addForm:      { backgroundColor: '#F8F5FF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E8DFFA', marginTop: 4 },
  addFormTitle: { fontSize: 14, fontWeight: '700', color: DOC_COLOR, marginBottom: 10 },
  typeRow:      { paddingBottom: 4 },
  typeBtn:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#F8F8F8', marginRight: 8 },
  typeBtnText:  { fontSize: 11, fontWeight: '700', marginLeft: 5 },
  input:        { borderWidth: 1.5, borderColor: '#E0D6F5', borderRadius: 10, fontSize: 14, padding: 10, backgroundColor: '#fff', color: '#333', marginTop: 10 },
  attachRow:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E0D6F5', borderStyle: 'dashed', borderRadius: 10, padding: 10, backgroundColor: '#fff', marginTop: 10 },
  attachRowText:{ flex: 1, fontSize: 13, color: '#888', marginLeft: 8 },
  formBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', marginTop: 10 },
  editBox:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 10 },
  editBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  editBoxTitle:  { fontSize: 16, fontWeight: '800', color: '#2d2d2d' },
  editBoxClose:  { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  editBoxNote:   { fontSize: 12, color: '#F4A32B', backgroundColor: '#FEF3E2', borderRadius: 10, padding: 10, marginBottom: 12, lineHeight: 18 },
});