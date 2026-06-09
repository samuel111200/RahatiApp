import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, Alert, ScrollView, Animated, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, addDoc, onSnapshot, deleteDoc,
  doc, query, orderBy,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebaseConfig';
import * as Notifications from 'expo-notifications';
import { useLang } from '../context/Languagecontext';

// ─── Types ───────────────────────────────────────────────
export type MedicationEntry = {
  id: string; name: string; dose: string; time: string;
  days: string[]; notes?: string; createdAt: number; notifIds?: string[];
};

const DAYS_AR: Record<string, string> = {
  sat: 'السبت', sun: 'الأحد', mon: 'الاثنين',
  tue: 'الثلاثاء', wed: 'الأربعاء', thu: 'الخميس', fri: 'الجمعة',
  daily: 'يومياً',
};
const DAYS_EN: Record<string, string> = {
  sat: 'Sat', sun: 'Sun', mon: 'Mon',
  tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri',
  daily: 'Daily',
};
const DAY_KEYS = ['daily', 'sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

// ─── AM/PM helpers ────────────────────────────────────────
type Period = 'AM' | 'PM';

/** Convert "HH:MM" (24h) → { display: "hh:MM", period } */
function to12h(raw: string): { display: string; period: Period } {
  const [hStr, mStr] = raw.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  if (isNaN(h)) return { display: '', period: 'AM' };
  const period: Period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { display: `${String(h).padStart(2, '0')}:${m}`, period };
}

/** Convert "hh:MM" + period → "HH:MM" (24h) */
function to24h(display: string, period: Period): string {
  const [hStr, mStr] = display.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  if (isNaN(h)) return display;
  if (period === 'AM') {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return `${String(h).padStart(2, '0')}:${m}`;
}

/** Format stored 24h time for display with AM/PM label */
function formatTimeDisplay(time24: string, isRTL: boolean): string {
  if (!time24) return '';
  const { display, period } = to12h(time24);
  if (!display) return time24;
  const label = isRTL
    ? (period === 'AM' ? 'ص' : 'م')
    : period;
  return isRTL ? `${label} ${display}` : `${display} ${label}`;
}

// ─── AM/PM Toggle Component ───────────────────────────────
function AmPmToggle({ period, onChange, isRTL }: {
  period: Period; onChange: (p: Period) => void; isRTL: boolean;
}) {
  const options: { value: Period; label: string }[] = isRTL
    ? [{ value: 'AM', label: 'ص' }, { value: 'PM', label: 'م' }]
    : [{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }];

  return (
    <View style={ampmSt.wrap}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.8}
          style={[ampmSt.btn, period === opt.value && ampmSt.btnActive]}
        >
          <Text style={[ampmSt.text, period === opt.value && ampmSt.textActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const ampmSt = StyleSheet.create({
  wrap:       { borderWidth: 1.5, borderColor: '#E0D6F5', borderRadius: 12, overflow: 'hidden', flexDirection: 'column' },
  btn:        { paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F5FF' },
  btnActive:  { backgroundColor: '#7C5CBF' },
  text:       { fontSize: 12, fontWeight: '800', color: '#7C5CBF' },
  textActive: { color: '#fff' },
});

// ─── Notification helpers ────────────────────────────────
async function cancelMedNotifs(ids: string[] = []) {
  for (const id of ids) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  }
}

async function scheduleMedNotifs(
  med: Omit<MedicationEntry, 'id' | 'notifIds' | 'createdAt'>,
  isRTL: boolean,
): Promise<string[]> {
  const parts = med.time.split(':');
  const hour   = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return [];
  let remindMin = minute - 5;
  let remindHour = hour;
  if (remindMin < 0) { remindMin += 60; remindHour = (remindHour - 1 + 24) % 24; }
  const dayMap: Record<string, number> = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };
  const isDaily    = med.days.includes('daily');
  const targetDays = isDaily ? Object.keys(dayMap) : med.days;
  const ids: string[] = [];
  for (const dayKey of targetDays) {
    const weekday = dayMap[dayKey];
    if (!weekday) continue;
    try {
      const id1 = await Notifications.scheduleNotificationAsync({
        content: {
          title: isRTL ? '⏰ تذكير دواء قريب' : '⏰ Medication Reminder',
          body: `${med.name}${med.dose ? ' — ' + med.dose : ''} ${isRTL ? `بعد 5 دقائق (${formatTimeDisplay(med.time, isRTL)})` : `in 5 minutes (${formatTimeDisplay(med.time, isRTL)})`}`,
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: 'medications' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday, hour: remindHour, minute: remindMin,
        },
      });
      ids.push(id1);
    } catch {}
    try {
      const id2 = await Notifications.scheduleNotificationAsync({
        content: {
          title: isRTL ? '💊 وقت الدواء الآن' : '💊 Medication Time',
          body: isRTL
            ? `حان وقت ${med.name}${med.dose ? ' ' + med.dose : ''}`
            : `Time for ${med.name}${med.dose ? ' ' + med.dose : ''}`,
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: 'medications' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday, hour, minute,
        },
      });
      ids.push(id2);
    } catch {}
  }
  return ids;
}

async function setupMedChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('medications', {
      name: 'Medication Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 300, 150, 300],
      lightColor: '#7C5CBF',
    });
  } catch {}
}

// ─── Add Medication Modal ────────────────────────────────
function AddMedModal({ visible, onClose, onAdd, t, isRTL }: {
  visible: boolean; onClose: () => void;
  onAdd: (data: Omit<MedicationEntry, 'id' | 'notifIds' | 'createdAt'>) => Promise<void>;
  t: any; isRTL: boolean;
}) {
  const [name, setName]                 = useState('');
  const [dose, setDose]                 = useState('');
  const [timeDisplay, setTimeDisplay]   = useState(''); // 12h display e.g. "09:00"
  const [period, setPeriod]             = useState<Period>('AM');
  const [selectedDays, setSelectedDays] = useState<string[]>(['daily']);
  const [notes, setNotes]               = useState('');
  const [saving, setSaving]             = useState(false);

  const DAYS_DISPLAY = isRTL ? DAYS_AR : DAYS_EN;

  useEffect(() => {
    if (!visible) {
      setName(''); setDose(''); setTimeDisplay(''); setPeriod('AM');
      setSelectedDays(['daily']); setNotes(''); setSaving(false);
    }
  }, [visible]);

  const toggleDay = (key: string) => {
    if (key === 'daily') { setSelectedDays(['daily']); return; }
    setSelectedDays(prev => {
      const without = prev.filter(d => d !== 'daily');
      if (without.includes(key)) {
        const next = without.filter(d => d !== key);
        return next.length === 0 ? ['daily'] : next;
      }
      return [...without, key];
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert(isRTL ? 'تنبيه' : 'Notice', t.medicationNameRequired); return; }
    if (!timeDisplay.trim() || !/^\d{1,2}:\d{2}$/.test(timeDisplay.trim())) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', t.medicationTimeFormat); return;
    }
    if (saving) return;
    setSaving(true);
    // Convert to 24h for storage
    const time24 = to24h(timeDisplay.trim(), period);
    try {
      await onAdd({ name: name.trim(), dose: dose.trim(), time: time24, days: selectedDays, notes: notes.trim() });
      onClose();
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', t.medicationConnError);
      console.error('[MedNote] add error:', e);
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
        <TouchableOpacity style={addSt.overlay} activeOpacity={1} onPress={onClose} />
        <View style={addSt.sheet}>
          <View style={addSt.handle} />
          <View style={addSt.headerRow}>
            <Text style={addSt.title}>{t.addMedication}</Text>
            <TouchableOpacity onPress={onClose} style={addSt.closeBtn}>
              <Ionicons name="close" size={20} color="#888" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
            <Text style={[addSt.label, { textAlign: isRTL ? 'right' : 'left' }]}>{t.medicationName}</Text>
            <TextInput
              style={addSt.input} value={name} onChangeText={setName}
              placeholder={isRTL ? 'مثال: باراسيتامول' : 'e.g. Paracetamol'}
              placeholderTextColor="#B0BEC5" textAlign={isRTL ? 'right' : 'left'}
            />

            <Text style={[addSt.label, { textAlign: isRTL ? 'right' : 'left' }]}>{t.medicationDose}</Text>
            <TextInput
              style={addSt.input} value={dose} onChangeText={setDose}
              placeholder={isRTL ? 'مثال: حبة واحدة — 500mg' : 'e.g. One tablet — 500mg'}
              placeholderTextColor="#B0BEC5" textAlign={isRTL ? 'right' : 'left'}
            />

            <Text style={[addSt.label, { textAlign: isRTL ? 'right' : 'left' }]}>{t.medicationTime}</Text>
            <View style={addSt.timeRow}>
              <TextInput
                style={[addSt.input, addSt.timeInput]}
                value={timeDisplay}
                onChangeText={setTimeDisplay}
                placeholder="09:00"
                placeholderTextColor="#B0BEC5"
                keyboardType="numbers-and-punctuation"
                textAlign="center"
              />
              <AmPmToggle period={period} onChange={setPeriod} isRTL={isRTL} />
            </View>

            <Text style={[addSt.label, { textAlign: isRTL ? 'right' : 'left' }]}>{t.medicationDays}</Text>
            <View style={addSt.daysWrap}>
              {DAY_KEYS.map(k => {
                const isSelected = selectedDays.includes(k);
                return (
                  <TouchableOpacity key={k} onPress={() => toggleDay(k)}
                    style={[addSt.dayBtn, isSelected && addSt.dayBtnActive]} activeOpacity={0.8}>
                    <Text style={[addSt.dayBtnText, isSelected && addSt.dayBtnTextActive]}>
                      {DAYS_DISPLAY[k]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[addSt.label, { textAlign: isRTL ? 'right' : 'left' }]}>{t.medicationNotes}</Text>
            <TextInput
              style={[addSt.input, { height: 64, textAlignVertical: 'top' }]}
              value={notes} onChangeText={setNotes}
              placeholder={isRTL ? 'أي ملاحظات إضافية...' : 'Any additional notes...'}
              placeholderTextColor="#B0BEC5" multiline textAlign={isRTL ? 'right' : 'left'}
            />

            <TouchableOpacity
              style={[addSt.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving} activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={addSt.saveBtnText}>{saving ? t.savingMedication : t.saveMedication}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const addSt = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:         { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '88%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 10 },
  handle:        { width: 40, height: 4, backgroundColor: '#E0D6F5', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  headerRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title:         { fontSize: 17, fontWeight: '800', color: '#2d2d2d' },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  label:         { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input:         { borderWidth: 1.5, borderColor: '#E0D6F5', borderRadius: 12, fontSize: 14, padding: 10, backgroundColor: '#FAFAFA', color: '#333' },
  timeRow:       { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 4 },
  timeInput:     { flex: 1, marginBottom: 0 },
  daysWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  dayBtn:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0D6F5', backgroundColor: '#F8F5FF' },
  dayBtnActive:  { backgroundColor: '#7C5CBF', borderColor: '#7C5CBF' },
  dayBtnText:    { fontSize: 12, fontWeight: '700', color: '#7C5CBF' },
  dayBtnTextActive: { color: '#fff' },
  saveBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C5CBF', borderRadius: 16, paddingVertical: 14, marginTop: 20 },
  saveBtnText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ─── Main Component ──────────────────────────────────────
export default function MedicationNote() {
  const insets     = useSafeAreaInsets();
  const { t, isRTL } = useLang();
  const DAYS_DISPLAY = isRTL ? DAYS_AR : DAYS_EN;

  const [currentUid, setCurrentUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [open,    setOpen]    = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [meds,    setMeds]    = useState<MedicationEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.85)).current;
  const btnOpacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    setupMedChannel();
    const unsub = onAuthStateChanged(auth, user => { setCurrentUid(user?.uid ?? null); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUid) { setMeds([]); return; }
    setLoading(true);
    const q = query(collection(db, 'medications', currentUid, 'items'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q,
      snap => {
        setLoading(false);
        setMeds(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MedicationEntry, 'id'>) })));
      },
      err => { setLoading(false); console.error('[MedNote] snapshot error:', err); }
    );
    return unsub;
  }, [currentUid]);

  const openNote = () => {
    setOpen(true);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const closeNote = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 160, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  };

  const handleBtnIn  = () => Animated.timing(btnOpacity, { toValue: 1,    duration: 120, useNativeDriver: true }).start();
  const handleBtnOut = () => Animated.timing(btnOpacity, { toValue: 0.35, duration: 250, useNativeDriver: true }).start();

  const handleAdd = useCallback(async (data: Omit<MedicationEntry, 'id' | 'notifIds' | 'createdAt'>) => {
    const uid = auth.currentUser?.uid;
    if (!uid) { Alert.alert(isRTL ? 'خطأ' : 'Error', t.medicationNotAuthenticated); throw new Error('not authenticated'); }
    const { status } = await Notifications.requestPermissionsAsync();
    let notifIds: string[] = [];
    if (status === 'granted') { notifIds = await scheduleMedNotifs(data, isRTL); }
    await addDoc(collection(db, 'medications', uid, 'items'), { ...data, createdAt: Date.now(), notifIds });
  }, [isRTL, t]);

  const handleDelete = (med: MedicationEntry) => {
    Alert.alert(
      t.deleteMedTitle,
      `${t.deleteMedConfirm} "${med.name}"?\n${t.deleteMedNote}`,
      [
        { text: t.notNow, style: 'cancel' },
        {
          text: t.yesDelete, style: 'destructive',
          onPress: async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            try {
              await cancelMedNotifs(med.notifIds ?? []);
              await deleteDoc(doc(db, 'medications', uid, 'items', med.id));
            } catch (e) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', t.medicationDeleteFailed);
              console.error('[MedNote] delete error:', e);
            }
          },
        },
      ]
    );
  };

  const bottomPos = insets.bottom + 80 + 16;

  return (
    <>
      <Animated.View style={[floatSt.btnWrap, { bottom: bottomPos, opacity: btnOpacity }]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={openNote} onPressIn={handleBtnIn} onPressOut={handleBtnOut}
          style={floatSt.btn} activeOpacity={1}
        >
          <Ionicons name="medical-outline" size={20} color="#7C5CBF" />
        </TouchableOpacity>
      </Animated.View>

      {open && (
        <Modal visible={open} transparent animationType="none" onRequestClose={closeNote} statusBarTranslucent>
          <TouchableOpacity style={noteSt.overlay} activeOpacity={1} onPress={closeNote} />
          <Animated.View style={[noteSt.noteCard, { bottom: bottomPos + 56, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <View style={noteSt.header}>
              <TouchableOpacity onPress={closeNote} style={noteSt.closeBtn}>
                <Ionicons name="chevron-down" size={20} color="#7C5CBF" />
              </TouchableOpacity>
              <Text style={noteSt.title}>💊 {t.myMedications}</Text>
              <TouchableOpacity onPress={() => setShowAdd(true)} style={noteSt.addBtn}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false} contentContainerStyle={noteSt.listContent}>
              {loading ? (
                <View style={noteSt.empty}>
                  <Text style={noteSt.emptyText}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</Text>
                </View>
              ) : meds.length === 0 ? (
                <View style={noteSt.empty}>
                  <Text style={{ fontSize: 38 }}>💊</Text>
                  <Text style={noteSt.emptyText}>{t.noMedications}</Text>
                  <Text style={noteSt.emptyHint}>{t.addMedHint}</Text>
                </View>
              ) : (
                meds.map(med => (
                  <View key={med.id} style={noteSt.medCard}>
                    <View style={noteSt.medTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={noteSt.medName}>{med.name}</Text>
                        {!!med.dose && <Text style={noteSt.medDose}>{med.dose}</Text>}
                      </View>
                      {/* Time chip shows 12h + AM/PM label */}
                      <View style={noteSt.timeChip}>
                        <Ionicons name="time-outline" size={12} color="#7C5CBF" />
                        <Text style={noteSt.timeText}>{formatTimeDisplay(med.time, isRTL)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(med)} style={noteSt.deleteBtn}>
                        <Ionicons name="trash-outline" size={15} color="#E05C5C" />
                      </TouchableOpacity>
                    </View>
                    <View style={noteSt.daysRow}>
                      {med.days.map(d => (
                        <View key={d} style={noteSt.dayChip}>
                          <Text style={noteSt.dayChipText}>{DAYS_DISPLAY[d] ?? d}</Text>
                        </View>
                      ))}
                    </View>
                    {!!med.notes && <Text style={noteSt.medNotes} numberOfLines={2}>{med.notes}</Text>}
                    <View style={noteSt.notifBadge}>
                      <Ionicons name="notifications-outline" size={11} color="#4CAF82" />
                      <Text style={noteSt.notifBadgeText}>{t.medicationNotif}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </Modal>
      )}

      <AddMedModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} t={t} isRTL={isRTL} />
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────
const floatSt = StyleSheet.create({
  btnWrap: { position: 'absolute', right: 14, zIndex: 999 },
  btn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#EDE6F8', borderWidth: 1.5, borderColor: '#7C5CBF50',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
});

const noteSt = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  noteCard: {
    position: 'absolute', right: 12, left: 12,
    backgroundColor: '#fff', borderRadius: 22,
    shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 14,
    borderWidth: 1, borderColor: '#E8DFFA', overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F0EBFA',
  },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0EBFA', alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 15, fontWeight: '800', color: '#2d2d2d' },
  addBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: '#7C5CBF', alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 14, gap: 10 },
  empty:       { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText:   { fontSize: 14, fontWeight: '700', color: '#7C5CBF' },
  emptyHint:   { fontSize: 12, color: '#B0BEC5' },
  medCard:  { backgroundColor: '#F8F5FF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E8DFFA', gap: 6 },
  medTop:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medName:  { fontSize: 14, fontWeight: '800', color: '#2d2d2d' },
  medDose:  { fontSize: 12, color: '#7C5CBF', fontWeight: '600', marginTop: 2 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDE6F8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  timeText: { fontSize: 13, fontWeight: '800', color: '#7C5CBF' },
  deleteBtn:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FDEAEA', alignItems: 'center', justifyContent: 'center' },
  daysRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dayChip:      { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#E0D6F5' },
  dayChipText:  { fontSize: 10, fontWeight: '700', color: '#7C5CBF' },
  medNotes:     { fontSize: 11, color: '#888', lineHeight: 16, textAlign: 'right' },
  notifBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5EF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  notifBadgeText: { fontSize: 10, fontWeight: '700', color: '#4CAF82' },
});