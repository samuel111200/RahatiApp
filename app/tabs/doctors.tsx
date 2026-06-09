// app/tabs/doctors.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, TextInput, Modal, SectionList, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  collection, query, where, onSnapshot,
  addDoc, getDocs, getDoc, doc,
} from 'firebase/firestore';
import { db, FSUser } from '../../utils/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { sendPushToUser } from '../../utils/pushNotifications';

type DoctorCard = {
  id: string; firebaseUid: string;
  name: string; nameEn: string;
  specialty: string; specialtyEn: string;
  reviews: number; experience: number;
  available: boolean; emoji: string;
  color: string; bg: string;
  tags: string[]; tagsEn: string[];
  photoUrl?: string;
};

const PALETTE = [
  { color: '#7C5CBF', bg: '#F0EBFA', emoji: '🩺' },
  { color: '#5B9BD5', bg: '#E8F1FB', emoji: '💊' },
  { color: '#4CAF82', bg: '#E8F5EF', emoji: '🧠' },
  { color: '#E07B5C', bg: '#FDF0EB', emoji: '🏃' },
  { color: '#D45BAA', bg: '#FCEEF8', emoji: '⚕️' },
];
function fsPalette(idx: number) { return PALETTE[idx % PALETTE.length]; }

export default function DoctorsScreen() {
  const { isRTL, t } = useLang();
  const { user }     = useAuth();

  const [search,       setSearch]       = useState('');
  const [selectedDoc,  setSelectedDoc]  = useState<DoctorCard | null>(null);
  const [showModal,    setShowModal]    = useState(false);
  const [allDoctors,   setAllDoctors]   = useState<DoctorCard[]>([]);
  const [loadingDocs,  setLoadingDocs]  = useState(true);
  const [myDoctorIds,  setMyDoctorIds]  = useState<Set<string>>(new Set());
  const [loadingRelations, setLoadingRelations] = useState(true);
  const [showAllDoctorsPage, setShowAllDoctorsPage] = useState(false);
  const [pageSearch,   setPageSearch]   = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const unsub = onSnapshot(q, (snap) => {
      setLoadingDocs(false);
      const real: DoctorCard[] = snap.docs.map((d, i) => {
        const data = d.data() as FSUser;
        const p = fsPalette(i);
        return {
          id: d.id, firebaseUid: d.id,
          name:        `د. ${data.firstName} ${data.lastName}`,
          nameEn:      `Dr. ${data.firstName} ${data.lastName}`,
          specialty:   data.specialty ?? '',
          specialtyEn: data.specialty ?? '',
          reviews: 0, experience: 0, available: true,
          emoji: p.emoji, color: p.color, bg: p.bg,
          tags: [], tagsEn: [],
          photoUrl: data.photoUrl ?? undefined,
        };
      });
      setAllDoctors(real);
    }, (err) => { console.warn('[Doctors] error:', err); setLoadingDocs(false); });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'relationships'), where('patientId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setLoadingRelations(false);
      setMyDoctorIds(new Set(snap.docs.map(d => d.data().doctorId as string)));
    }, () => setLoadingRelations(false));
    return unsub;
  }, [user?.uid]);

  const loading      = loadingDocs || loadingRelations;
  const hasMyDoctors = myDoctorIds.size > 0;
  const myDoctors    = allDoctors.filter(d =>  myDoctorIds.has(d.firebaseUid));
  const otherDoctors = allDoctors.filter(d => !myDoctorIds.has(d.firebaseUid));
  const displayDoctors = hasMyDoctors ? myDoctors : allDoctors;

  const filtered = displayDoctors.filter(d => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (isRTL ? d.name : d.nameEn).toLowerCase().includes(q)
        || (isRTL ? d.specialty : d.specialtyEn).toLowerCase().includes(q);
  });

  const applyPageSearch = (list: DoctorCard[]) => {
    const q = pageSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(d =>
      (isRTL ? d.name : d.nameEn).toLowerCase().includes(q) ||
      (isRTL ? d.specialty : d.specialtyEn).toLowerCase().includes(q),
    );
  };

  const sections = [
    ...(myDoctors.length > 0 ? [{
      title: t.myDoctorsChats,
      data:  applyPageSearch(myDoctors),
      type:  'mine' as const,
    }] : []),
    ...(otherDoctors.length > 0 ? [{
      title: t.otherDoctors,
      data:  applyPageSearch(otherDoctors),
      type:  'other' as const,
    }] : []),
  ];

  const handleContact = (docItem: DoctorCard) => {
    setSelectedDoc(docItem); setShowModal(true);
  };

  const handleInAppChat = async (docItem: DoctorCard) => {
    setShowModal(false); setShowAllDoctorsPage(false);
    const patientUid = user?.uid;
    if (patientUid && docItem.firebaseUid) {
      let patientName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
      if (!patientName) {
        try {
          const snap = await getDoc(doc(db, 'users', patientUid));
          const data = snap.data();
          patientName = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim();
        } catch {}
      }
      if (!patientName) patientName = t.patientDefault;
      try {
        const existing = await getDocs(query(
          collection(db, 'relationships'),
          where('doctorId', '==', docItem.firebaseUid),
          where('patientId', '==', patientUid),
        ));
        if (existing.empty) {
          await addDoc(collection(db, 'relationships'), {
            doctorId: docItem.firebaseUid, patientId: patientUid, patientName,
            doctorName: isRTL ? docItem.name : docItem.nameEn,
            status: 'pending', requestedAt: Date.now(),
          });
          sendPushToUser(
            docItem.firebaseUid,
            { ar: '🆕 طلب انضمام جديد', en: '🆕 New join request' },
            { ar: `${patientName} أرسل طلب انضمام`, en: `${patientName} sent a join request` },
          ).catch(() => {});
        }
      } catch {}
    }
    router.push({
      pathname: '/tabs/doctorchat',
      params: {
        doctorId:   docItem.firebaseUid || docItem.id,
        doctorName: isRTL ? docItem.name : docItem.nameEn,
        doctorEmoji: docItem.emoji, doctorColor: docItem.color,
        doctorBg: docItem.bg,
        specialty: isRTL ? docItem.specialty : docItem.specialtyEn,
        isFirebase: docItem.firebaseUid ? '1' : '0',
      },
    });
  };

  const renderDoctorCardContent = (doc: DoctorCard, showContactBtn = true) => {
    const hasChat = myDoctorIds.has(doc.firebaseUid);
    return (
      <View style={[styles.card, { borderLeftColor: doc.color, borderLeftWidth: 4 }]}>
        <View style={[styles.cardTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.avatarCircle, { backgroundColor: doc.bg }]}>
            {doc.photoUrl
              ? <Image source={{ uri: doc.photoUrl }} style={styles.avatarImg} />
              : <Text style={styles.avatarEmoji}>{doc.emoji}</Text>}
          </View>
          <View style={[styles.cardInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <View style={[styles.nameRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.docName}>{isRTL ? doc.name : doc.nameEn}</Text>
              <View style={[styles.availBadge, { backgroundColor: doc.available ? '#E8F5EF' : '#F5F5F5' }]}>
                <View style={[styles.availDot, { backgroundColor: doc.available ? '#4CAF82' : '#ccc' }]} />
                <Text style={[styles.availText, { color: doc.available ? '#4CAF82' : '#aaa' }]}>
                  {doc.available ? t.available : t.busy}
                </Text>
              </View>
            </View>
            <Text style={[styles.specialty, { color: doc.color }]}>
              {isRTL ? doc.specialty : doc.specialtyEn}
            </Text>
            <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={styles.metaItem}>
                {doc.reviews > 0 && <Text style={styles.metaLight}>({doc.reviews})</Text>}
              </View>
              {doc.experience > 0 && (
                <>
                  <View style={styles.metaDot} />
                  <View style={styles.metaItem}>
                    <Ionicons name="briefcase-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{doc.experience} {t.yrsExperience}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {showContactBtn && !hasChat && (
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: doc.available ? doc.color : '#ddd' }]}
            onPress={() => handleContact(doc)}
            activeOpacity={doc.available ? 0.8 : 1}
            disabled={!doc.available}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={doc.available ? '#fff' : '#aaa'} />
            <Text style={[styles.contactBtnText, { color: doc.available ? '#fff' : '#aaa' }]}>
              {doc.available ? t.contactNow : t.notAvailableNow}
            </Text>
          </TouchableOpacity>
        )}

        {showContactBtn && hasChat && (
          <View style={[styles.openChatBadge, { backgroundColor: doc.bg }]}>
            <Ionicons name="chatbubbles" size={14} color={doc.color} />
            <Text style={[styles.openChatText, { color: doc.color }]}>{t.tapToOpenChat}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderDoctorCard = (doc: DoctorCard, showContactBtn = true) => {
    const hasChat = myDoctorIds.has(doc.firebaseUid);
    if (hasChat) {
      return (
        <TouchableOpacity key={doc.id} activeOpacity={0.85} onPress={() => handleInAppChat(doc)}>
          {renderDoctorCardContent(doc, showContactBtn)}
        </TouchableOpacity>
      );
    }
    return <View key={doc.id}>{renderDoctorCardContent(doc, showContactBtn)}</View>;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />

      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {hasMyDoctors ? t.myDoctors : t.contactDoctor}
          </Text>
          <Text style={styles.headerSub}>
            {loading
              ? t.loadingDots
              : `${displayDoctors.length} ${t.doctorsAvailable}`}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder={t.searchDoctorPlaceholder}
          placeholderTextColor={Colors.textMuted}
          style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.availableBanner}>
        <View style={styles.greenDot} />
        <Text style={styles.availableText}>
          {displayDoctors.filter(d => d.available).length} {t.doctorsAvailableNow}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {!loading && displayDoctors.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🩺</Text>
            <Text style={styles.emptyText}>{t.noDoctorsYet}</Text>
          </View>
        )}
        {filtered.map(doc => renderDoctorCard(doc))}

        {hasMyDoctors && otherDoctors.length > 0 && (
          <TouchableOpacity
            style={styles.addDoctorBtn}
            onPress={() => { setPageSearch(''); setShowAllDoctorsPage(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.addDoctorBtnText}>{t.addNewDoctor}</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* All Doctors Page Modal */}
      <Modal visible={showAllDoctorsPage} transparent={false} animationType="slide" onRequestClose={() => setShowAllDoctorsPage(false)}>
        <SafeAreaView style={styles.safe}>
          <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowAllDoctorsPage(false)} style={styles.backBtn} activeOpacity={0.8}>
              <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={Colors.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{t.myDoctors}</Text>
              <Text style={styles.headerSub}>{allDoctors.length} {t.doctorsWord}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              value={pageSearch} onChangeText={setPageSearch}
              placeholder={t.searchDoctorPlaceholder}
              placeholderTextColor={Colors.textMuted}
              style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
            />
            {pageSearch.length > 0 && (
              <TouchableOpacity onPress={() => setPageSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, {
                backgroundColor: section.type === 'mine' ? Colors.primaryUltraLight : '#F5F5F5',
                borderLeftColor: section.type === 'mine' ? Colors.primary : Colors.textMuted,
              }]}>
                <Text style={[styles.sectionHeaderText, { color: section.type === 'mine' ? Colors.primary : Colors.textSecondary }]}>
                  {section.title}
                </Text>
                <Text style={[styles.sectionCount, { color: section.type === 'mine' ? Colors.primary : Colors.textMuted }]}>
                  {section.data.length}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 14 }}>{renderDoctorCard(item)}</View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyText}>{t.noResults}</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Contact Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModal(false)} />
        {selectedDoc && (
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={[styles.modalDocRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.modalAvatar, { backgroundColor: selectedDoc.bg }]}>
                {selectedDoc.photoUrl
                  ? <Image source={{ uri: selectedDoc.photoUrl }} style={styles.modalAvatarImg} />
                  : <Text style={{ fontSize: 32 }}>{selectedDoc.emoji}</Text>}
              </View>
              <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <Text style={styles.modalDocName}>{isRTL ? selectedDoc.name : selectedDoc.nameEn}</Text>
                <Text style={[styles.modalDocSpec, { color: selectedDoc.color }]}>
                  {isRTL ? selectedDoc.specialty : selectedDoc.specialtyEn}
                </Text>
              </View>
            </View>
            <Text style={[styles.modalTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t.chooseContactMethod}
            </Text>
            <TouchableOpacity
              style={[styles.contactOption, { borderColor: Colors.primary }]}
              onPress={() => handleInAppChat(selectedDoc)} activeOpacity={0.8}
            >
              <View style={[styles.contactOptionIcon, { backgroundColor: Colors.primaryUltraLight }]}>
                <Ionicons name="chatbubbles-outline" size={24} color={Colors.primary} />
              </View>
              <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <Text style={[styles.contactOptionTitle, { color: Colors.primary }]}>{t.inAppChat}</Text>
                <Text style={styles.contactOptionSub}>{t.inAppChatDesc}</Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 12 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.textPrimary },
  headerSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryUltraLight, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, marginHorizontal: Spacing.base, marginBottom: 10, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  searchInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0 },
  availableBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.base, marginBottom: 14, backgroundColor: '#E8F5EF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  greenDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF82' },
  availableText: { fontSize: 12, color: '#4CAF82', fontWeight: '600' },
  list: { paddingHorizontal: Spacing.base, gap: 14 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, gap: 12, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  cardTop:     { alignItems: 'center', gap: 12 },
  avatarCircle:{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  avatarEmoji: { fontSize: 28 },
  avatarImg:   { width: 60, height: 60, borderRadius: 30 },
  cardInfo:    { flex: 1, gap: 4 },
  nameRow:     { alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  docName:     { fontSize: FontSize.base, fontWeight: '800', color: Colors.textPrimary },
  availBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  availDot:    { width: 6, height: 6, borderRadius: 3 },
  availText:   { fontSize: 11, fontWeight: '700' },
  specialty:   { fontSize: FontSize.sm, fontWeight: '600' },
  metaRow:     { alignItems: 'center', gap: 8 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:    { fontSize: 12, color: Colors.textPrimary, fontWeight: '600' },
  metaLight:   { fontSize: 11, color: Colors.textMuted },
  metaDot:     { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textMuted },
  contactBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.lg, paddingVertical: 12 },
  contactBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  openChatBadge:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.lg, paddingVertical: 10 },
  openChatText:   { fontSize: FontSize.sm, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderLeftWidth: 4 },
  sectionHeaderText: { fontSize: FontSize.base, fontWeight: '800', flex: 1 },
  sectionCount:      { fontSize: 13, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  addDoctorBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.lg, paddingVertical: 14, borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed', backgroundColor: Colors.primaryUltraLight },
  addDoctorBtnText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:   { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 10 },
  modalHandle:  { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  modalDocRow:  { alignItems: 'center', gap: 14, marginBottom: 4 },
  modalAvatar:    { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modalAvatarImg: { width: 64, height: 64, borderRadius: 32 },
  modalDocName: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  modalDocSpec: { fontSize: FontSize.sm, fontWeight: '600', marginTop: 2 },
  modalTitle:   { fontSize: FontSize.base, fontWeight: '700', color: Colors.textSecondary },
  contactOption:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1.5 },
  contactOptionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  contactOptionTitle: { fontSize: FontSize.base, fontWeight: '700' },
  contactOptionSub:   { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  cancelBtn:     { paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.primaryUltraLight, borderRadius: Radius.lg, marginTop: 4 },
  cancelBtnText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText:  { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center' },
});