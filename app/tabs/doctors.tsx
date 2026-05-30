// app/tabs/doctors.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES vs original:
//   • "Contact Now" / "شات داخلي" → writes a `relationships` Firestore doc
//     with status:'pending' before navigating to doctorchat.
//   • All UI, layout, styles, and LanguageContext strings are preserved exactly.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { useAuth } from '../../context/AuthContext';

// ── Firebase ─────────────────────────────────────────────────────────────────
import {
  setDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db, relDoc, relId, chatDoc } from '../../utils/firebaseConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Static doctor directory (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
const DOCTORS = [
  {
    id: '1',
    name: 'د. أحمد محمود',      nameEn: 'Dr. Ahmed Mahmoud',
    specialty: 'علاج طبيعي',    specialtyEn: 'Physical Therapy',
    rating: 4.9, reviews: 128, experience: 12, available: true,
    emoji: '🩺', color: '#5B9BD5', bg: '#E8F1FB',
    tags: ['تمارين علاجية','إعادة تأهيل','آلام الظهر'],
    tagsEn: ['Therapeutic Exercises','Rehabilitation','Back Pain'],
    phone: '+201001234567',
    // Firebase UID of the doctor account – set this once real Auth is running
    uid: 'doctor_uid_1',
  },
  {
    id: '2',
    name: 'د. سارة علي',          nameEn: 'Dr. Sara Ali',
    specialty: 'طب الطاقة والعافية', specialtyEn: 'Energy & Wellness Medicine',
    rating: 4.8, reviews: 95,  experience: 8,  available: true,
    emoji: '💊', color: '#4CAF82', bg: '#E8F5EF',
    tags: ['إدارة الطاقة','تغذية','تأمل'],
    tagsEn: ['Energy Management','Nutrition','Meditation'],
    phone: '+201009876543',
    uid: 'doctor_uid_2',
  },
  {
    id: '3',
    name: 'د. خالد إبراهيم',   nameEn: 'Dr. Khaled Ibrahim',
    specialty: 'طب الرياضة',    specialtyEn: 'Sports Medicine',
    rating: 4.7, reviews: 204, experience: 15, available: false,
    emoji: '🏃', color: '#E07B5C', bg: '#FDF0EB',
    tags: ['تمارين رياضية','لياقة بدنية','إصابات رياضية'],
    tagsEn: ['Sports Exercises','Physical Fitness','Sports Injuries'],
    phone: '+201005556789',
    uid: 'doctor_uid_3',
  },
  {
    id: '4',
    name: 'د. فاطمة حسن',       nameEn: 'Dr. Fatma Hassan',
    specialty: 'طب نفسي وسلوكي', specialtyEn: 'Psychiatric & Behavioral Medicine',
    rating: 4.9, reviews: 167, experience: 10, available: true,
    emoji: '🧠', color: '#D45BAA', bg: '#FCEEF8',
    tags: ['صحة نفسية','إدارة التوتر','سلوك'],
    tagsEn: ['Mental Health','Stress Management','Behavior'],
    phone: '+201007778901',
    uid: 'doctor_uid_4',
  },
  {
    id: '5',
    name: 'د. محمد عمر',        nameEn: 'Dr. Mohamed Omar',
    specialty: 'تغذية علاجية',   specialtyEn: 'Clinical Nutrition',
    rating: 4.6, reviews: 89,  experience: 6,  available: true,
    emoji: '🥗', color: '#F4A32B', bg: '#FEF3E2',
    tags: ['تغذية','حمية','وزن صحي'],
    tagsEn: ['Nutrition','Diet','Healthy Weight'],
    phone: '+201002223344',
    uid: 'doctor_uid_5',
  },
];

export default function DoctorsScreen() {
  const navigation         = useNavigation();
  const { isRTL }          = useLang();
  const { user }           = useAuth();
  const [search,           setSearch]          = useState('');
  const [selectedDoc,      setSelectedDoc]     = useState<typeof DOCTORS[0] | null>(null);
  const [showModal,        setShowModal]       = useState(false);
  const [connecting,       setConnecting]      = useState(false);

  const filtered = DOCTORS.filter(d => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = isRTL ? d.name : d.nameEn;
    const spec = isRTL ? d.specialty : d.specialtyEn;
    return name.toLowerCase().includes(q) || spec.toLowerCase().includes(q);
  });

  const handleContact = (doc: typeof DOCTORS[0]) => {
    setSelectedDoc(doc);
    setShowModal(true);
  };

  // ── CHANGED: writes a Firestore relationship doc before navigating ─────────
  const handleInAppChat = async (selectedDoctor: typeof DOCTORS[0]) => {
    if (!user?.uid) return;

    setConnecting(true);
    try {
      const doctorId  = selectedDoctor.uid;
      const patientId = user.uid;
      const rId       = relId(doctorId, patientId);

      // Check if a relationship already exists
      const existing = await getDoc(relDoc(doctorId, patientId));

      if (!existing.exists()) {
        // Create a new PENDING relationship
        await setDoc(relDoc(doctorId, patientId), {
          relationshipId: rId,
          doctorId,
          patientId,
          status:         'pending',
          exerciseAccess: 'locked',
          createdAt:      serverTimestamp(),
          acceptedAt:     null,
        });
      }
      // If already pending or accepted, just navigate — no duplicate writes

      setShowModal(false);
      router.push({
        pathname: '/tabs/doctorchat',
        params: {
          doctorId:     doctorId,
          patientId:    patientId,
          chatId:       rId,
          doctorName:   isRTL ? selectedDoctor.name  : selectedDoctor.nameEn,
          doctorEmoji:  selectedDoctor.emoji,
          doctorColor:  selectedDoctor.color,
          doctorBg:     selectedDoctor.bg,
          specialty:    isRTL ? selectedDoctor.specialty : selectedDoctor.specialtyEn,
        },
      });
    } catch (err) {
      console.warn('[DoctorsScreen.handleInAppChat]', err);
    } finally {
      setConnecting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // UI — identical to original
  // ─────────────────────────────────────────────────────────────────────────
  return (
      <SafeAreaView style={styles.safe}>
        <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{isRTL ? 'تواصل مع دكتور' : 'Contact a Doctor'}</Text>
            <Text style={styles.headerSub}>{isRTL ? `${DOCTORS.length} دكاترة متاحون` : `${DOCTORS.length} doctors available`}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Search ── */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isRTL ? 'ابحث عن دكتور أو تخصص...' : 'Search doctor or specialty...'}
              placeholderTextColor={Colors.textMuted}
              style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
          />
          {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
          )}
        </View>

        {/* ── Available badge ── */}
        <View style={styles.availableBanner}>
          <View style={styles.greenDot} />
          <Text style={styles.availableText}>
            {isRTL
                ? `${DOCTORS.filter(d => d.available).length} دكاترة متاحون الآن للتواصل`
                : `${DOCTORS.filter(d => d.available).length} doctors available now`}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filtered.map((doc) => (
              <View key={doc.id} style={[styles.card, { borderLeftColor: doc.color, borderLeftWidth: 4 }]}>

                {/* ── Top Row ── */}
                <View style={[styles.cardTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.avatarCircle, { backgroundColor: doc.bg }]}>
                    <Text style={styles.avatarEmoji}>{doc.emoji}</Text>
                  </View>

                  <View style={[styles.cardInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <View style={[styles.nameRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <Text style={styles.docName}>{isRTL ? doc.name : doc.nameEn}</Text>
                      <View style={[styles.availBadge, { backgroundColor: doc.available ? '#E8F5EF' : '#F5F5F5' }]}>
                        <View style={[styles.availDot, { backgroundColor: doc.available ? '#4CAF82' : '#ccc' }]} />
                        <Text style={[styles.availText, { color: doc.available ? '#4CAF82' : '#aaa' }]}>
                          {doc.available
                              ? (isRTL ? 'متاح' : 'Available')
                              : (isRTL ? 'مشغول' : 'Busy')}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.specialty, { color: doc.color }]}>
                      {isRTL ? doc.specialty : doc.specialtyEn}
                    </Text>

                    <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <View style={styles.metaItem}>
                        <Ionicons name="star" size={12} color="#F4A32B" />
                        <Text style={styles.metaText}>{doc.rating}</Text>
                        <Text style={styles.metaLight}>({doc.reviews})</Text>
                      </View>
                      <View style={styles.metaDot} />
                      <View style={styles.metaItem}>
                        <Ionicons name="briefcase-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.metaText}>
                          {doc.experience} {isRTL ? 'سنة خبرة' : 'yrs exp'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* ── Tags ── */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
                  {(isRTL ? doc.tags : doc.tagsEn).map((tag, i) => (
                      <View key={i} style={[styles.tag, { backgroundColor: doc.bg }]}>
                        <Text style={[styles.tagText, { color: doc.color }]}>{tag}</Text>
                      </View>
                  ))}
                </ScrollView>

                {/* ── Contact Button ── */}
                <TouchableOpacity
                    style={[styles.contactBtn, { backgroundColor: doc.available ? doc.color : '#ddd' }]}
                    onPress={() => handleContact(doc)}
                    activeOpacity={doc.available ? 0.8 : 1}
                    disabled={!doc.available}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={doc.available ? '#fff' : '#aaa'} />
                  <Text style={[styles.contactBtnText, { color: doc.available ? '#fff' : '#aaa' }]}>
                    {doc.available
                        ? (isRTL ? 'تواصل الآن' : 'Contact Now')
                        : (isRTL ? 'غير متاح حالياً' : 'Not Available')}
                  </Text>
                </TouchableOpacity>
              </View>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Contact Modal ── */}
        <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModal(false)} />
          {selectedDoc && (
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />

                <View style={[styles.modalDocRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.modalAvatar, { backgroundColor: selectedDoc.bg }]}>
                    <Text style={{ fontSize: 32 }}>{selectedDoc.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                    <Text style={styles.modalDocName}>{isRTL ? selectedDoc.name : selectedDoc.nameEn}</Text>
                    <Text style={[styles.modalDocSpec, { color: selectedDoc.color }]}>
                      {isRTL ? selectedDoc.specialty : selectedDoc.specialtyEn}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.modalTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {isRTL ? 'اختر طريقة التواصل' : 'Choose contact method'}
                </Text>

                {/* ── In-app chat ── */}
                <TouchableOpacity
                    style={[styles.contactOption, { borderColor: Colors.primary }]}
                    onPress={() => handleInAppChat(selectedDoc)}
                    activeOpacity={0.8}
                    disabled={connecting}
                >
                  <View style={[styles.contactOptionIcon, { backgroundColor: Colors.primaryUltraLight }]}>
                    {connecting
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Ionicons name="chatbubbles-outline" size={24} color={Colors.primary} />}
                  </View>
                  <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                    <Text style={[styles.contactOptionTitle, { color: Colors.primary }]}>
                      {isRTL ? 'شات داخل التطبيق' : 'In-App Chat'}
                    </Text>
                    <Text style={styles.contactOptionSub}>
                      {isRTL ? 'راسل الدكتور مباشرة من هنا' : 'Message the doctor directly here'}
                    </Text>
                  </View>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={Colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
                </TouchableOpacity>
              </View>
          )}
        </Modal>
      </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — 100% unchanged
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, marginHorizontal: Spacing.base, marginBottom: 10, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  searchInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, padding: 0 },
  availableBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.base, marginBottom: 14, backgroundColor: '#E8F5EF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF82' },
  availableText: { fontSize: 12, color: '#4CAF82', fontWeight: '600' },
  list: { paddingHorizontal: Spacing.base, gap: 14 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, gap: 12, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  cardTop: { alignItems: 'center', gap: 12 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarEmoji: { fontSize: 28 },
  cardInfo: { flex: 1, gap: 4 },
  nameRow: { alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  docName: { fontSize: FontSize.base, fontWeight: '800', color: Colors.textPrimary },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 11, fontWeight: '700' },
  specialty: { fontSize: FontSize.sm, fontWeight: '600' },
  metaRow: { alignItems: 'center', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600' },
  metaLight: { fontSize: 11, color: Colors.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textMuted },
  tagsScroll: { flexGrow: 0 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 6 },
  tagText: { fontSize: 11, fontWeight: '700' },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.lg, paddingVertical: 12 },
  contactBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 10 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  modalDocRow: { alignItems: 'center', gap: 14, marginBottom: 4 },
  modalAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  modalDocName: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  modalDocSpec: { fontSize: FontSize.sm, fontWeight: '600', marginTop: 2 },
  modalTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textSecondary },
  contactOption: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1.5 },
  contactOptionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  contactOptionTitle: { fontSize: FontSize.base, fontWeight: '700' },
  contactOptionSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  cancelBtn: { paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.primaryUltraLight, borderRadius: Radius.lg, marginTop: 4 },
  cancelBtnText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary },
});