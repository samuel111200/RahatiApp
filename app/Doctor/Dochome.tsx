import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, TextInput, Modal, FlatList,
  Animated, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { usePathname } from 'expo-router';

// ─── Constants ────────────────────────────────────────────
const DOC_COLOR       = '#7C5CBF';
const DOC_COLOR_LIGHT = '#F0EBFA';
const DOC_COLOR_MID   = '#E8DFFA';

// ─── Types ────────────────────────────────────────────────
export type PatientStatus = 'pending' | 'accepted';

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  age?: string;
  gender?: string;
  avatar?: string;
  status: PatientStatus;
  requestedAt: string;
  acceptedAt?: string;
};

// ─── Helpers ─────────────────────────────────────────────
const STORAGE_KEY = 'doc_patients';

async function loadPatients(): Promise<Patient[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function savePatients(patients: Patient[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

// ─── DocTabBar ────────────────────────────────────────────
type TabItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
};

const TABS: TabItem[] = [
  {
    label: 'الرئيسية',
    icon: 'home-outline',
    iconActive: 'home',
    route: '/Doctor/Dochome',
  },
  {
    label: 'الشاتات',
    icon: 'chatbubbles-outline',
    iconActive: 'chatbubbles',
    route: '/Doctor/Docchat',
  },
  {
    label: 'المزيد',
    icon: 'grid-outline',
    iconActive: 'grid',
    route: '/Doctor/Docmore',
  },
];

function DocTabBar() {
  const pathname = usePathname();

  return (
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
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0EBFA',
    paddingBottom: 12,
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: '#7C5CBF',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 48,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: DOC_COLOR,
    shadowColor: DOC_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B0BEC5',
  },
  labelActive: {
    color: DOC_COLOR,
    fontWeight: '700',
  },
});

// ─── PatientCard ─────────────────────────────────────────
type PatientCardProps = {
  patient: Patient;
  index: number;
  onAccept?: (id: string) => void;
  onPress: (patient: Patient) => void;
  isRTL: boolean;
};

function PatientCard({ patient, index, onAccept, onPress, isRTL }: PatientCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const plusScale = useRef(new Animated.Value(1)).current;

  const isPending  = patient.status === 'pending';
  const initials   = `${(patient.firstName || '?')[0]}${(patient.lastName || '?')[0]}`.toUpperCase();
  const genderIcon = patient.gender === 'female' ? 'female-outline' : 'male-outline';
  const genderColor = patient.gender === 'female' ? '#E91E8C' : DOC_COLOR;

  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  const handleAcceptPressIn  = () => Animated.spring(plusScale, { toValue: 0.85, useNativeDriver: true, tension: 300 }).start();
  const handleAcceptPressOut = () => Animated.spring(plusScale, { toValue: 1,    useNativeDriver: true, tension: 300 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={() => isPending ? null : onPress(patient)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={isPending ? 1 : 0.9}
        style={[styles.patientCard, isPending && styles.patientCardPending]}
      >
        <View style={[styles.rankBadge, isPending && styles.rankBadgePending]}>
          <Text style={[styles.rankText, isPending && styles.rankTextPending]}>{index + 1}</Text>
        </View>

        <View style={[styles.patientAvatar, { borderColor: isPending ? '#F4A32B' : DOC_COLOR }]}>
          {patient.avatar ? (
            <Image source={{ uri: patient.avatar }} style={styles.patientAvatarImg} />
          ) : (
            <Text style={[styles.patientAvatarInitials, { color: isPending ? '#F4A32B' : DOC_COLOR }]}>
              {initials}
            </Text>
          )}
        </View>

        <View style={styles.patientInfo}>
          <View style={[styles.patientNameRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={styles.patientName} numberOfLines={1}>
              {patient.firstName} {patient.lastName}
            </Text>
            {isPending && (
              <View style={styles.pendingChip}>
                <Text style={styles.pendingChipText}>طلب جديد</Text>
              </View>
            )}
          </View>
          <View style={[styles.patientMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {patient.age ? (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                <Text style={styles.metaText}>{patient.age} سنة</Text>
              </View>
            ) : null}
            {patient.gender ? (
              <View style={styles.metaItem}>
                <Ionicons name={genderIcon} size={11} color={genderColor} />
                <Text style={[styles.metaText, { color: genderColor }]}>
                  {patient.gender === 'female' ? 'أنثى' : 'ذكر'}
                </Text>
              </View>
            ) : null}
            {!isPending && (
              <View style={styles.metaItem}>
                <Ionicons name="chatbubble-ellipses-outline" size={11} color="#4CAF82" />
                <Text style={[styles.metaText, { color: '#4CAF82' }]}>شات مفتوح</Text>
              </View>
            )}
          </View>
          {isPending && (
            <Text style={styles.pendingDate}>
              طلب في {new Date(patient.requestedAt).toLocaleDateString('ar-EG')}
            </Text>
          )}
        </View>

        {isPending ? (
          <Animated.View style={{ transform: [{ scale: plusScale }] }}>
            <TouchableOpacity
              onPress={() => onAccept?.(patient.id)}
              onPressIn={handleAcceptPressIn}
              onPressOut={handleAcceptPressOut}
              style={styles.acceptBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            onPress={() => onPress(patient)}
            style={styles.chatBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={DOC_COLOR} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Accept Confirmation Modal ────────────────────────────
function AcceptModal({ visible, patient, onConfirm, onCancel, isRTL }: {
  visible: boolean;
  patient: Patient | null;
  onConfirm: () => void;
  onCancel: () => void;
  isRTL: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
        Animated.timing(opacAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacAnim.setValue(0);
    }
  }, [visible]);

  if (!patient) return null;

  const initials = `${(patient.firstName || '?')[0]}${(patient.lastName || '?')[0]}`.toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[styles.modalOverlay, { opacity: opacAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onCancel} activeOpacity={1} />
        <Animated.View style={[styles.acceptModalCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.acceptModalAvatar}>
            {patient.avatar ? (
              <Image source={{ uri: patient.avatar }} style={styles.acceptModalAvatarImg} />
            ) : (
              <Text style={styles.acceptModalInitials}>{initials}</Text>
            )}
          </View>
          <View style={styles.acceptCheckIcon}>
            <Ionicons name="person-add-outline" size={18} color="#fff" />
          </View>

          <Text style={styles.acceptModalTitle}>قبول الطلب</Text>
          <Text style={styles.acceptModalBody}>
            هل تريد قبول طلب{'\n'}
            <Text style={{ fontWeight: '800', color: DOC_COLOR }}>
              {patient.firstName} {patient.lastName}
            </Text>
            {'\n'}وفتح شات معه؟
          </Text>

          <View style={styles.acceptModalBtns}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelModalBtn} activeOpacity={0.8}>
              <Text style={styles.cancelModalText}>لأ دلوقتي</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={styles.confirmModalBtn} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.confirmModalText}>قبول</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Empty State ──────────────────────────────────────────
function EmptyState({ isRTL }: { isRTL: boolean }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🩺</Text>
      <Text style={styles.emptyTitle}>لا يوجد مرضى بعد</Text>
      <Text style={styles.emptySubtitle}>ستظهر طلبات المرضى هنا عند وصولها</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function DocHome() {
  const { user }    = useAuth();
  const { isRTL, t } = useLang();

  const [patients,     setPatients]    = useState<Patient[]>([]);
  const [search,       setSearch]      = useState('');
  const [tab,          setTab]         = useState<'all' | 'pending' | 'accepted'>('all');
  const [pendingModal, setPendingModal] = useState<Patient | null>(null);
  const [loading,      setLoading]     = useState(true);

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        setLoading(true);
        let list = await loadPatients();

        if (list.length === 0) {
          list = [
            { id: '1', firstName: 'أحمد',   lastName: 'محمود',   age: '32', gender: 'male',   status: 'accepted', requestedAt: new Date(Date.now() - 86400000 * 3).toISOString(), acceptedAt: new Date().toISOString() },
            { id: '2', firstName: 'سارة',   lastName: 'علي',     age: '28', gender: 'female', status: 'accepted', requestedAt: new Date(Date.now() - 86400000 * 2).toISOString(), acceptedAt: new Date().toISOString() },
            { id: '3', firstName: 'محمد',   lastName: 'حسن',     age: '45', gender: 'male',   status: 'pending',  requestedAt: new Date(Date.now() - 3600000).toISOString() },
            { id: '4', firstName: 'فاطمة',  lastName: 'إبراهيم', age: '35', gender: 'female', status: 'pending',  requestedAt: new Date(Date.now() - 7200000).toISOString() },
            { id: '5', firstName: 'خالد',   lastName: 'عمر',     age: '52', gender: 'male',   status: 'accepted', requestedAt: new Date(Date.now() - 86400000 * 5).toISOString(), acceptedAt: new Date().toISOString() },
          ];
          await savePatients(list);
        }
        setPatients(list);
        setLoading(false);
      };
      init();
    }, [])
  );

  const handleAcceptConfirm = async () => {
    if (!pendingModal) return;
    const updated = patients.map(p =>
      p.id === pendingModal.id
        ? { ...p, status: 'accepted' as PatientStatus, acceptedAt: new Date().toISOString() }
        : p
    );
    setPatients(updated);
    await savePatients(updated);
    setPendingModal(null);
  };

  const handleOpenChat = (patient: Patient) => {
    router.push({
      pathname: "/Doctor/Docpatient",
      params: {
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
      },
    });
  };

  const filtered = patients
    .filter(p => {
      if (tab === 'pending')  return p.status === 'pending';
      if (tab === 'accepted') return p.status === 'accepted';
      return true;
    })
    .filter(p => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
    });

  const sorted = [
    ...filtered.filter(p => p.status === 'accepted'),
    ...filtered.filter(p => p.status === 'pending'),
  ];

  const pendingCount  = patients.filter(p => p.status === 'pending').length;
  const acceptedCount = patients.filter(p => p.status === 'accepted').length;

  const docName = user ? `${user.firstName || ''}` : '';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor="#F8F5FF" barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {isRTL ? `أهلاً، د. ${docName} 👋` : `Hello, Dr. ${docName} 👋`}
            </Text>
            <Text style={styles.headerSub}>
              {isRTL ? 'إدارة المرضى والطلبات' : 'Manage patients & requests'}
            </Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/Doctor/DocNotif' as any)}>
            <Ionicons name="notifications-outline" size={22} color={DOC_COLOR} />
            {pendingCount > 0 && (
              <View style={styles.notifDot}>
                <Text style={styles.notifDotText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Stats strip ── */}
        <View style={styles.statsStrip}>
          <View style={[styles.statPill, { backgroundColor: DOC_COLOR_LIGHT }]}>
            <Text style={[styles.statPillNum, { color: DOC_COLOR }]}>{acceptedCount}</Text>
            <Text style={styles.statPillLabel}>مرضى نشطون</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: '#FEF3E2' }]}>
            <Text style={[styles.statPillNum, { color: '#F4A32B' }]}>{pendingCount}</Text>
            <Text style={styles.statPillLabel}>طلبات انتظار</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: '#E8F5EF' }]}>
            <Text style={[styles.statPillNum, { color: '#4CAF82' }]}>{patients.length}</Text>
            <Text style={styles.statPillLabel}>إجمالي</Text>
          </View>
        </View>

        {/* ── Search ── */}
        <View style={[styles.searchBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isRTL ? 'ابحث عن مريض...' : 'Search patient...'}
            placeholderTextColor={Colors.textMuted}
            style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Tabs ── */}
        <View style={[styles.tabs, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {([
            { key: 'all',      label: 'الكل',   count: patients.length },
            { key: 'accepted', label: 'نشطون',  count: acceptedCount },
            { key: 'pending',  label: 'انتظار', count: pendingCount },
          ] as const).map(item => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tabBtn, tab === item.key && styles.tabBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}>
                {item.label}
              </Text>
              {item.count > 0 && (
                <View style={[styles.tabCount, tab === item.key && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, tab === item.key && styles.tabCountTextActive]}>
                    {item.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Patient List ── */}
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⏳</Text>
            <Text style={styles.emptyTitle}>جاري التحميل...</Text>
          </View>
        ) : sorted.length === 0 ? (
          <EmptyState isRTL={isRTL} />
        ) : (
          <View style={styles.listWrap}>
            {tab !== 'accepted' && sorted.some(p => p.status === 'pending') && (
              <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={styles.sectionDot} />
                <Text style={styles.sectionTitle}>طلبات تحتاج قبول</Text>
                <View style={[styles.sectionDot, { flex: 1, height: 1, borderRadius: 0, backgroundColor: '#F4A32B30' }]} />
              </View>
            )}

            {sorted.filter(p => p.status === 'pending').map((p) => (
              <PatientCard
                key={p.id}
                patient={p}
                index={patients.indexOf(p)}
                onAccept={(id) => {
                  const found = patients.find(x => x.id === id);
                  if (found) setPendingModal(found);
                }}
                onPress={handleOpenChat}
                isRTL={isRTL}
              />
            ))}

            {tab !== 'pending' && sorted.some(p => p.status === 'accepted') && (
              <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 8 }]}>
                <View style={[styles.sectionDot, { backgroundColor: DOC_COLOR }]} />
                <Text style={[styles.sectionTitle, { color: DOC_COLOR }]}>المرضى النشطون</Text>
                <View style={[styles.sectionDot, { flex: 1, height: 1, borderRadius: 0, backgroundColor: DOC_COLOR + '25' }]} />
              </View>
            )}

            {sorted.filter(p => p.status === 'accepted').map((p) => (
              <PatientCard
                key={p.id}
                patient={p}
                index={patients.filter(x => x.status === 'accepted').indexOf(p)}
                onPress={handleOpenChat}
                isRTL={isRTL}
              />
            ))}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Bottom Tab Bar ── */}
      <DocTabBar />

      {/* ── Accept Modal ── */}
      <AcceptModal
        visible={!!pendingModal}
        patient={pendingModal}
        onConfirm={handleAcceptConfirm}
        onCancel={() => setPendingModal(null)}
        isRTL={isRTL}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#F8F5FF' },
  content: { padding: Spacing.xl, paddingBottom: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  greeting:  { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  notifDot: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E05C5C', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  notifDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  statsStrip: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  statPill: {
    flex: 1, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  statPillNum:   { fontSize: 22, fontWeight: '900' },
  statPillLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },

  searchBar: {
    alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: Spacing.base,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0 },

  tabs: { gap: 8, marginBottom: Spacing.xl },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8EEF3',
  },
  tabBtnActive:    { backgroundColor: DOC_COLOR, borderColor: DOC_COLOR },
  tabLabel:        { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textMuted },
  tabLabelActive:  { color: '#fff' },
  tabCount:        { backgroundColor: '#E8EEF3', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabCountActive:  { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText:    { fontSize: 11, fontWeight: '800', color: Colors.textMuted },
  tabCountTextActive: { color: '#fff' },

  sectionHeader: { alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F4A32B' },
  sectionTitle:  { fontSize: FontSize.sm, fontWeight: '700', color: '#F4A32B' },

  listWrap: { gap: 10 },

  patientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 20, padding: 14,
    shadowColor: DOC_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  patientCardPending: {
    borderColor: '#F4A32B30',
    backgroundColor: '#FFFDF7',
  },

  rankBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  rankBadgePending: { backgroundColor: '#FEF3E2' },
  rankText:         { fontSize: 13, fontWeight: '900', color: DOC_COLOR },
  rankTextPending:  { color: '#F4A32B' },

  patientAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  patientAvatarImg:      { width: 52, height: 52, borderRadius: 26 },
  patientAvatarInitials: { fontSize: 18, fontWeight: '800' },

  patientInfo:    { flex: 1, gap: 4 },
  patientNameRow: { alignItems: 'center', gap: 6 },
  patientName:    { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, flex: 1 },

  pendingChip: {
    backgroundColor: '#F4A32B20', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  pendingChipText: { fontSize: 10, fontWeight: '700', color: '#F4A32B' },

  patientMeta: { alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:    { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },

  pendingDate: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  acceptBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#4CAF82',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4CAF82', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },

  chatBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyState:    { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyEmoji:    { fontSize: 56, marginBottom: 16 },
  emptyTitle:    { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  acceptModalCard: {
    backgroundColor: '#fff', borderRadius: 28, padding: 28,
    width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
  },
  acceptModalAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: DOC_COLOR_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: DOC_COLOR_MID,
    marginBottom: 8,
  },
  acceptModalAvatarImg:  { width: 80, height: 80, borderRadius: 40 },
  acceptModalInitials:   { fontSize: 28, fontWeight: '900', color: DOC_COLOR },
  acceptCheckIcon: {
    position: 'absolute', top: 24, right: 24,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#4CAF82',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  acceptModalTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8 },
  acceptModalBody:  { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 26, marginBottom: 24 },
  acceptModalBtns:  { flexDirection: 'row', gap: 12, width: '100%' },

  cancelModalBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelModalText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textSecondary },

  confirmModalBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 16,
    backgroundColor: '#4CAF82',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: '#4CAF82', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  confirmModalText: { fontSize: FontSize.base, fontWeight: '700', color: '#fff' },
});