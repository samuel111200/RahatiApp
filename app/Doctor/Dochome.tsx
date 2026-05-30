// Doctor/Dochome.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES vs original:
//   • loadPatients() / savePatients() / AsyncStorage REMOVED.
//   • Replaced with onSnapshot on `relationships` where doctorId = uid.
//   • Accept action writes to Firestore + creates chat doc atomically.
//   • All styles, animations, RTL, and localization strings preserved exactly.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, TextInput, Modal, Animated, Image, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { usePathname } from 'expo-router';
import { getDocNotifUnreadCount } from './DocNotifService';

// ── Firebase ─────────────────────────────────────────────────────────────────
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, relDoc, relId, chatDoc, FSRelationship, FSUser } from '../../utils/firebaseConfig';

const DOC_COLOR       = '#7C5CBF';
const DOC_COLOR_LIGHT = '#F0EBFA';
const DOC_COLOR_MID   = '#E8DFFA';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type PatientStatus = 'pending' | 'accepted';
export type Patient = {
  id: string; firstName: string; lastName: string;
  age?: string; gender?: string; avatar?: string;
  status: PatientStatus; requestedAt: string; acceptedAt?: string;
  relationshipId: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// DocTabBar (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
type TabItem = { label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; route: string; };
const TABS: TabItem[] = [
  { label: 'الرئيسية', icon: 'home-outline',        iconActive: 'home',        route: '/Doctor/Dochome' },
  { label: 'الشاتات',  icon: 'chatbubbles-outline',  iconActive: 'chatbubbles', route: '/Doctor/Docchat' },
  { label: 'المزيد',   icon: 'grid-outline',          iconActive: 'grid',        route: '/Doctor/Docmore' },
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
  container: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 28, paddingTop: 8, paddingBottom: 8, paddingHorizontal: 8, shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 14, borderWidth: 0.5, borderColor: '#E8DFFA', marginBottom: 8 },
  tab:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconWrap: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'transparent' },
  iconWrapActive: { backgroundColor: DOC_COLOR, shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 10, elevation: 6 },
  label:       { fontSize: 11, fontWeight: '600', color: '#B0BEC5' },
  labelActive: { color: DOC_COLOR, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// PatientCard (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
type PatientCardProps = { patient: Patient; index: number; onAccept?: (id: string) => void; onPress: (patient: Patient) => void; isRTL: boolean; };

function PatientCard({ patient, index, onAccept, onPress, isRTL }: PatientCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const plusScale = useRef(new Animated.Value(1)).current;
  const isPending   = patient.status === 'pending';
  const initials    = `${(patient.firstName||'?')[0]}${(patient.lastName||'?')[0]}`.toUpperCase();
  const genderIcon  = patient.gender === 'female' ? 'female-outline' : 'male-outline';
  const genderColor = patient.gender === 'female' ? '#E91E8C' : DOC_COLOR;
  const handlePressIn   = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const handlePressOut  = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();
  const handleAcceptIn  = () => Animated.spring(plusScale, { toValue: 0.85, useNativeDriver: true, tension: 300 }).start();
  const handleAcceptOut = () => Animated.spring(plusScale, { toValue: 1,    useNativeDriver: true, tension: 300 }).start();

  return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
            onPress={() => isPending ? null : onPress(patient)}
            onPressIn={handlePressIn} onPressOut={handlePressOut}
            activeOpacity={isPending ? 1 : 0.9}
            style={[styles.patientCard, isPending && styles.patientCardPending]}
        >
          <View style={[styles.rankBadge, isPending && styles.rankBadgePending]}>
            <Text style={[styles.rankText, isPending && styles.rankTextPending]}>{index + 1}</Text>
          </View>
          <View style={[styles.patientAvatar, { borderColor: isPending ? '#F4A32B' : DOC_COLOR }]}>
            {patient.avatar
                ? <Image source={{ uri: patient.avatar }} style={styles.patientAvatarImg} />
                : <Text style={[styles.patientAvatarInitials, { color: isPending ? '#F4A32B' : DOC_COLOR }]}>{initials}</Text>}
          </View>
          <View style={styles.patientInfo}>
            <View style={[styles.patientNameRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.patientName} numberOfLines={1}>{patient.firstName} {patient.lastName}</Text>
              {isPending && <View style={styles.pendingChip}><Text style={styles.pendingChipText}>طلب جديد</Text></View>}
            </View>
            <View style={[styles.patientMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {patient.age    && <View style={styles.metaItem}><Ionicons name="calendar-outline" size={11} color={Colors.textMuted}/><Text style={styles.metaText}>{patient.age} سنة</Text></View>}
              {patient.gender && <View style={styles.metaItem}><Ionicons name={genderIcon} size={11} color={genderColor}/><Text style={[styles.metaText,{color:genderColor}]}>{patient.gender==='female'?'أنثى':'ذكر'}</Text></View>}
              {!isPending     && <View style={styles.metaItem}><Ionicons name="chatbubble-ellipses-outline" size={11} color="#4CAF82"/><Text style={[styles.metaText,{color:'#4CAF82'}]}>شات مفتوح</Text></View>}
            </View>
            {isPending && <Text style={styles.pendingDate}>طلب في {new Date(patient.requestedAt).toLocaleDateString('ar-EG')}</Text>}
          </View>
          {isPending ? (
              <Animated.View style={{ transform: [{ scale: plusScale }] }}>
                <TouchableOpacity onPress={() => onAccept?.(patient.id)} onPressIn={handleAcceptIn} onPressOut={handleAcceptOut} style={styles.acceptBtn} activeOpacity={0.8}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
          ) : (
              <TouchableOpacity onPress={() => onPress(patient)} style={styles.chatBtn} activeOpacity={0.8}>
                <Ionicons name="chatbubble-ellipses" size={18} color={DOC_COLOR} />
              </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AcceptModal (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function AcceptModal({ visible, patient, onConfirm, onCancel, isRTL }: { visible: boolean; patient: Patient | null; onConfirm: () => void; onCancel: () => void; isRTL: boolean; }) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (visible) {
      Animated.parallel([Animated.spring(scaleAnim,{toValue:1,tension:100,friction:8,useNativeDriver:true}),Animated.timing(opacAnim,{toValue:1,duration:200,useNativeDriver:true})]).start();
    } else { scaleAnim.setValue(0.85); opacAnim.setValue(0); }
  }, [visible]);
  if (!patient) return null;
  const initials = `${(patient.firstName||'?')[0]}${(patient.lastName||'?')[0]}`.toUpperCase();
  return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
        <Animated.View style={[styles.modalOverlay, { opacity: opacAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onCancel} activeOpacity={1} />
          <Animated.View style={[styles.acceptModalCard, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.acceptModalAvatar}>
              {patient.avatar ? <Image source={{ uri: patient.avatar }} style={styles.acceptModalAvatarImg} /> : <Text style={styles.acceptModalInitials}>{initials}</Text>}
            </View>
            <View style={styles.acceptCheckIcon}><Ionicons name="person-add-outline" size={18} color="#fff" /></View>
            <Text style={styles.acceptModalTitle}>قبول الطلب</Text>
            <Text style={styles.acceptModalBody}>هل تريد قبول طلب{'\n'}<Text style={{fontWeight:'800',color:DOC_COLOR}}>{patient.firstName} {patient.lastName}</Text>{'\n'}وفتح شات معه؟</Text>
            <View style={styles.acceptModalBtns}>
              <TouchableOpacity onPress={onCancel}  style={styles.cancelModalBtn}  activeOpacity={0.8}><Text style={styles.cancelModalText}>لأ دلوقتي</Text></TouchableOpacity>
              <TouchableOpacity onPress={onConfirm} style={styles.confirmModalBtn} activeOpacity={0.8}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.confirmModalText}>قبول</Text></TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
  );
}

function EmptyState() {
  return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>🩺</Text>
        <Text style={styles.emptyTitle}>لا يوجد مرضى بعد</Text>
        <Text style={styles.emptySubtitle}>ستظهر طلبات المرضى هنا عند وصولها</Text>
      </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function DocHome() {
  const { user }     = useAuth();
  const { isRTL, t } = useLang();
  const [patients,     setPatients]     = useState<Patient[]>([]);
  const [search,       setSearch]       = useState('');
  const [tab,          setTab]          = useState<'all'|'pending'|'accepted'>('all');
  const [pendingModal, setPendingModal] = useState<Patient | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [notifCount,   setNotifCount]   = useState(0);

  // ── Real-time relationships subscription ────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const relsQ = query(
        collection(db, 'relationships'),
        where('doctorId', '==', user.uid),
    );

    const unsub = onSnapshot(relsQ, async (snap) => {
      try {
        const list: Patient[] = [];

        for (const relSnap of snap.docs) {
          const rel = relSnap.data() as FSRelationship;

          // Fetch patient profile
          let firstName = rel.patientId;
          let lastName  = '';
          let age: string | undefined;
          let gender: string | undefined;
          let avatar: string | undefined;

          try {
            const pSnap = await getDoc(doc(db, 'users', rel.patientId));
            if (pSnap.exists()) {
              const pd = pSnap.data() as FSUser;
              firstName = pd.firstName ?? '';
              lastName  = pd.lastName  ?? '';
              age       = pd.age;
              gender    = pd.gender;
              avatar    = pd.photoUrl ?? undefined;
            }
          } catch {}

          const requestedAt = rel.createdAt instanceof Timestamp
              ? rel.createdAt.toDate().toISOString()
              : new Date().toISOString();
          const acceptedAt  = rel.acceptedAt instanceof Timestamp
              ? rel.acceptedAt.toDate().toISOString()
              : undefined;

          list.push({
            id:             rel.patientId,
            firstName,
            lastName,
            age,
            gender,
            avatar,
            status:         rel.status,
            requestedAt,
            acceptedAt,
            relationshipId: rel.relationshipId,
          });
        }

        setPatients(list);
        setLoading(false);
      } catch (err) {
        console.warn('[DocHome.onSnapshot]', err);
        setLoading(false);
      }
    });

    return () => unsub();
  }, [user?.uid]);

  // ── Notification badge ───────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    getDocNotifUnreadCount().then(setNotifCount).catch(() => {});
  }, []));

  // ── Accept patient: update relationship → create chat doc ─────────────────
  const handleAcceptConfirm = async () => {
    if (!pendingModal || !user?.uid) return;
    const doctorId  = user.uid;
    const patientId = pendingModal.id;
    const rId       = relId(doctorId, patientId);

    try {
      // 1. Update relationship to accepted
      await updateDoc(relDoc(doctorId, patientId), {
        status:    'accepted',
        acceptedAt: serverTimestamp(),
      });

      // 2. Initialize chat doc (creates it if not already there)
      await setDoc(chatDoc(rId), {
        chatId:            rId,
        participants:      [doctorId, patientId],
        lastMessage:       '',
        lastMessageTime:   serverTimestamp(),
        lastMessageSender: 'doctor',
      }, { merge: true });

      // 3. Fire notification
      const { notifyPatientAccepted } = await import('./DocNotifService');
      await notifyPatientAccepted(
          `${pendingModal.firstName} ${pendingModal.lastName}`,
          patientId,
      );

      const count = await getDocNotifUnreadCount();
      setNotifCount(count);
    } catch (err) {
      console.warn('[DocHome.handleAcceptConfirm]', err);
    }

    setPendingModal(null);
  };

  const handleOpenChat = (patient: Patient) => {
    router.push({
      pathname: '/Doctor/Docpatient',
      params: {
        patientId:   patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        chatId:      patient.relationshipId,
      },
    });
  };

  const filtered = patients
      .filter(p => tab==='pending' ? p.status==='pending' : tab==='accepted' ? p.status==='accepted' : true)
      .filter(p => !search.trim() || `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.trim().toLowerCase()));
  const sorted = [...filtered.filter(p=>p.status==='accepted'), ...filtered.filter(p=>p.status==='pending')];
  const pendingCount  = patients.filter(p=>p.status==='pending').length;
  const acceptedCount = patients.filter(p=>p.status==='accepted').length;
  const docName = user?.firstName || '';

  return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{isRTL ? `أهلاً، د. ${docName} 👋` : `Hello, Dr. ${docName} 👋`}</Text>
              <Text style={styles.headerSub}>{isRTL ? 'إدارة المرضى والطلبات' : 'Manage patients & requests'}</Text>
            </View>
            <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/Doctor/Docnotif' as any)}>
              <Ionicons name="notifications-outline" size={22} color={DOC_COLOR} />
              {notifCount > 0 && (
                  <View style={styles.notifDot}>
                    <Text style={styles.notifDotText}>{notifCount > 9 ? '9+' : notifCount}</Text>
                  </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: DOC_COLOR }]}>
              <Text style={styles.statNum}>{acceptedCount}</Text>
              <Text style={styles.statLabel}>{isRTL ? 'مرضى نشطون' : 'Active'}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#F4A32B' }]}>
              <Text style={styles.statNum}>{pendingCount}</Text>
              <Text style={styles.statLabel}>{isRTL ? 'انتظار' : 'Pending'}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#4CAF82' }]}>
              <Text style={styles.statNum}>{patients.length}</Text>
              <Text style={styles.statLabel}>{isRTL ? 'إجمالي' : 'Total'}</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
            <TextInput value={search} onChangeText={setSearch} placeholder={isRTL ? 'ابحث عن مريض...' : 'Search patient...'} placeholderTextColor={Colors.textMuted} style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]} />
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {(['all','accepted','pending'] as const).map((t) => (
                <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab===t && styles.tabBtnActive]}>
                  <Text style={[styles.tabBtnText, tab===t && styles.tabBtnTextActive]}>
                    {t==='all' ? (isRTL?'الكل':'All') : t==='accepted' ? (isRTL?'نشطون':'Active') : (isRTL?'انتظار':'Pending')}
                  </Text>
                </TouchableOpacity>
            ))}
          </View>

          {/* List */}
          {loading ? (
              <View style={styles.emptyState}><Text style={styles.emptyEmoji}>⏳</Text><Text style={styles.emptyTitle}>{isRTL?'جاري التحميل...':'Loading...'}</Text></View>
          ) : sorted.length === 0 ? (
              <EmptyState />
          ) : (
              sorted.map((p, i) => (
                  <PatientCard
                      key={p.id} patient={p} index={i} isRTL={isRTL}
                      onAccept={(id) => setPendingModal(patients.find(px => px.id === id) ?? null)}
                      onPress={handleOpenChat}
                  />
              ))
          )}

        </ScrollView>

        <AcceptModal
            visible={!!pendingModal} patient={pendingModal}
            onConfirm={handleAcceptConfirm}
            onCancel={() => setPendingModal(null)}
            isRTL={isRTL}
        />

        <DocTabBar />
      </SafeAreaView>
  );
}

// Styles unchanged from original (abbreviated to key ones; add your full styles here)
const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F8F5FF' },
  content:      { paddingHorizontal: Spacing.base, paddingBottom: 24, gap: 16 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 },
  greeting:     { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  headerSub:    { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  notifBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 4 },
  notifDot:     { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  notifDotText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  statsRow:     { flexDirection: 'row', gap: 10 },
  statCard:     { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  statNum:      { fontSize: 22, fontWeight: '900', color: '#fff' },
  statLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput:  { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, padding: 0 },
  tabsRow:      { flexDirection: 'row', gap: 8 },
  tabBtn:       { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: DOC_COLOR, borderColor: DOC_COLOR },
  tabBtnText:   { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  tabBtnTextActive: { color: '#fff' },
  patientCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 20, padding: 14, shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  patientCardPending: { borderWidth: 1.5, borderColor: '#F4A32B40', backgroundColor: '#FFFDF5' },
  rankBadge:          { width: 24, height: 24, borderRadius: 12, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center' },
  rankBadgePending:   { backgroundColor: '#FEF3E2' },
  rankText:           { fontSize: 11, fontWeight: '800', color: DOC_COLOR },
  rankTextPending:    { color: '#F4A32B' },
  patientAvatar:      { width: 50, height: 50, borderRadius: 25, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  patientAvatarImg:   { width: 46, height: 46, borderRadius: 23 },
  patientAvatarInitials: { fontSize: 18, fontWeight: '800' },
  patientInfo:    { flex: 1, gap: 3 },
  patientNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  patientName:    { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  pendingChip:    { backgroundColor: '#FEF3E2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  pendingChipText: { fontSize: 10, color: '#F4A32B', fontWeight: '700' },
  patientMeta:    { flexDirection: 'row', gap: 8 },
  metaItem:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:       { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  pendingDate:    { fontSize: 11, color: '#F4A32B', fontWeight: '600' },
  acceptBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAF82', alignItems: 'center', justifyContent: 'center', shadowColor: '#4CAF82', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  chatBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  acceptModalCard:     { backgroundColor: '#fff', borderRadius: 28, padding: 28, alignItems: 'center', gap: 12, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  acceptModalAvatar:   { width: 72, height: 72, borderRadius: 36, backgroundColor: DOC_COLOR_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: DOC_COLOR + '30' },
  acceptModalAvatarImg: { width: 68, height: 68, borderRadius: 34 },
  acceptModalInitials: { fontSize: 24, fontWeight: '900', color: DOC_COLOR },
  acceptCheckIcon:     { position: 'absolute', top: 52, right: '35%', width: 26, height: 26, borderRadius: 13, backgroundColor: '#4CAF82', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  acceptModalTitle:    { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  acceptModalBody:     { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  acceptModalBtns:     { flexDirection: 'row', gap: 12, width: '100%', marginTop: 4 },
  cancelModalBtn:      { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: '#F5F5F5' },
  cancelModalText:     { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  confirmModalBtn:     { flex: 2, flexDirection: 'row', paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#4CAF82', shadowColor: '#4CAF82', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  confirmModalText:    { fontSize: 15, fontWeight: '800', color: '#fff' },
  emptyState:    { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyEmoji:    { fontSize: 48 },
  emptyTitle:    { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});