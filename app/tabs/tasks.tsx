import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  Keyboard, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { Chip } from '../../components/UI';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { notify } from './notificationService';
import PatientTabBar from '../../components/PatientTabBar';

type TaskType = 'core' | 'extra';
type Task = {
  key: string; icon: string; cat: string; energy: number;
  color: string; bg: string; time: string; done: boolean;
  name?: string; date?: string; type: TaskType;
};

type Period = 'AM' | 'PM';

const CAT_COLORS: Record<string, { color: string; bg: string }> = {
  work:  { color: '#5B9BD5', bg: '#E8F1FB' },
  study: { color: '#4CAF82', bg: '#E8F5EF' },
  home:  { color: '#C97B3A', bg: '#FEF3E2' },
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── AM/PM helpers ────────────────────────────────────────
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

function to12h(raw: string): { display: string; period: Period } {
  const [hStr, mStr] = raw.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  if (isNaN(h)) return { display: raw, period: 'AM' };
  const period: Period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { display: `${String(h).padStart(2, '0')}:${m}`, period };
}

/** Format a stored 24h time string for display with AM/PM or ص/م */
function formatTime(time: string, isRTL: boolean): string {
  if (!time || time === '--:--') return time;
  // Handle range like "09:00 - 10:00"
  if (time.includes(' - ')) {
    const [start, end] = time.split(' - ');
    return `${formatTime(start.trim(), isRTL)} — ${formatTime(end.trim(), isRTL)}`;
  }
  const { display, period } = to12h(time);
  const label = isRTL ? (period === 'AM' ? 'ص' : 'م') : period;
  return isRTL ? `${label} ${display}` : `${display} ${label}`;
}

// ─── AM/PM Toggle ─────────────────────────────────────────
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
  wrap:       { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden', flexDirection: 'column' },
  btn:        { paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  btnActive:  { backgroundColor: Colors.primary },
  text:       { fontSize: 11, fontWeight: '800', color: Colors.primary },
  textActive: { color: '#fff' },
});

export default function TasksScreen() {
  const { t, isRTL } = useLang();
  const { user }     = useAuth();
  const uid          = user?.uid ?? '';
  const TODAY        = todayKey();

  const FILTERS = [
    { k: 'all',   l: t.all    },
    { k: 'work',  l: t.work   },
    { k: 'study', l: t.study  },
    { k: 'home',  l: t.atHome },
  ];

  const CAT_OPTIONS = [
    { k: 'work',  l: t.work   },
    { k: 'study', l: t.study  },
    { k: 'home',  l: t.atHome },
  ];

  const [activeSection, setActiveSection] = useState<TaskType>('core');
  const [filter,        setFilter]        = useState('all');
  const [coreTasks,     setCoreTasks]     = useState<Task[]>([]);
  const [extraTasks,    setExtraTasks]    = useState<Task[]>([]);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [newName,       setNewName]       = useState('');
  const [newIcon,       setNewIcon]       = useState('');
  const [newTimeStart,  setNewTimeStart]  = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState<Period>('AM');
  const [newTimeEnd,    setNewTimeEnd]    = useState('');
  const [newPeriodEnd,  setNewPeriodEnd]  = useState<Period>('AM');
  const [newEnergy,     setNewEnergy]     = useState('');
  const [newCat,        setNewCat]        = useState('work');
  const [newType,       setNewType]       = useState<TaskType>('core');
  const [nameError,     setNameError]     = useState(false);
  const [saving,        setSaving]        = useState(false);

  const longPressTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, 'tasks', uid, 'items'), (snap) => {
      const today = todayKey();
      const all: Task[] = snap.docs.map(d => d.data() as Task);
      const core  = all.filter(tk => tk.type === 'core');
      const extra = all.filter(tk => tk.type === 'extra' && (!tk.date || tk.date === today));
      snap.docs.forEach(d => {
        const tk = d.data() as Task;
        if (tk.type === 'extra' && tk.date && tk.date !== today) {
          deleteDoc(d.ref).catch(() => {});
        }
      });
      setCoreTasks(core);
      setExtraTasks(extra);
    });
    return unsub;
  }, [uid]);

  const SECTION_TASKS = activeSection === 'core' ? coreTasks : extraTasks;
  const visible = filter === 'all' ? SECTION_TASKS : SECTION_TASKS.filter(tk => tk.cat === filter);
  const getLabel = (task: Task) => task.name ?? task.key;

  function handleLongPressStart(task: Task) {
    longPressTimers.current[task.key] = setTimeout(() => {
      const label        = getLabel(task);
      const convertLabel = task.type === 'core' ? t.moveToExtra : t.moveToCore;
      Alert.alert(
        t.taskOptions, `"${label}"`,
        [
          { text: t.cancel, style: 'cancel' },
          { text: convertLabel, onPress: () => handleConvertTask(task) },
          { text: t.deleteTask, style: 'destructive', onPress: () => handleDeleteTask(task) },
        ]
      );
    }, 600);
  }

  function handleLongPressEnd(key: string) {
    if (longPressTimers.current[key]) {
      clearTimeout(longPressTimers.current[key]);
      delete longPressTimers.current[key];
    }
  }

  async function handleConvertTask(task: Task) {
    if (!uid) return;
    const newTaskType: TaskType = task.type === 'core' ? 'extra' : 'core';
    const updates: Partial<Task> = {
      type: newTaskType, done: false,
      ...(newTaskType === 'extra' ? { date: TODAY } : { date: undefined }),
    };
    try {
      await updateDoc(doc(db, 'tasks', uid, 'items', task.key), updates);
      setActiveSection(newTaskType); setFilter('all');
      await notify({
        title: t.taskMoved,
        body: isRTL
          ? `"${getLabel(task)}" اتحولت لـ${newTaskType === 'core' ? t.taskMovedToCore : t.taskMovedToExtra}`
          : `"${getLabel(task)}" moved to ${newTaskType === 'core' ? t.taskMovedToCore : t.taskMovedToExtra}`,
        emoji: task.icon, type: 'add',
        dedupKey: `task_convert_${task.key}_${newTaskType}_${todayKey()}`,
      });
    } catch (e) { console.warn('handleConvertTask error:', e); }
  }

  async function handleDeleteTask(task: Task) {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, 'tasks', uid, 'items', task.key));
      await notify({
        title: t.taskDeleted,
        body:  isRTL ? `"${getLabel(task)}" تم حذفها` : `"${getLabel(task)}" has been deleted`,
        emoji: task.icon, type: 'delete',
        dedupKey: `task_deleted_${task.key}_${Date.now()}`,
      });
    } catch (e) { console.warn('handleDeleteTask error:', e); }
  }

  const openModal = () => {
    setNewName(''); setNewIcon('');
    setNewTimeStart(''); setNewPeriodStart('AM');
    setNewTimeEnd('');   setNewPeriodEnd('AM');
    setNewEnergy(''); setNewCat('work'); setNewType(activeSection);
    setNameError(false); setSaving(false); setModalVisible(true);
  };

  const closeModal = () => {
    Keyboard.dismiss(); setModalVisible(false);
    setNewName(''); setNewIcon('');
    setNewTimeStart(''); setNewPeriodStart('AM');
    setNewTimeEnd('');   setNewPeriodEnd('AM');
    setNewEnergy(''); setNewCat('work'); setNameError(false); setSaving(false);
  };

  const addTask = async () => {
    if (!newName.trim()) { setNameError(true); return; }
    if (!uid || saving) return;
    setSaving(true);
    try {
      const catColors = CAT_COLORS[newCat] ?? CAT_COLORS.work;

      // Convert 12h → 24h before building the time string
      const start24 = newTimeStart.trim() ? to24h(newTimeStart.trim(), newPeriodStart) : '';
      const end24   = newTimeEnd.trim()   ? to24h(newTimeEnd.trim(),   newPeriodEnd)   : '';
      const timeStr = start24 && end24
        ? `${start24} - ${end24}`
        : start24 || '--:--';

      const energy = Math.min(100, Math.max(5, parseInt(newEnergy) || 20));
      const key = `task_${Date.now()}`;
      const newTask: Task = {
        key, icon: newIcon.trim() || '📌',
        cat: newCat, energy, color: catColors.color, bg: catColors.bg,
        time: timeStr, done: false, name: newName.trim(), type: newType,
        ...(newType === 'extra' ? { date: TODAY } : {}),
      };
      closeModal();
      await setDoc(doc(db, 'tasks', uid, 'items', key), newTask);
      setActiveSection(newType);
      await notify({
        title: t.taskAddedNotif,
        body: isRTL
          ? `${newTask.icon} "${newTask.name}" ${newType === 'extra' ? 'اتضافت لليوم ده' : 'اتضافت للمهام الأساسية'}`
          : `${newTask.icon} "${newTask.name}" added to ${newType === 'extra' ? 'today' : 'core tasks'}`,
        emoji: '✅', type: 'add',
        dedupKey: `task_added_${key}`,
      });
    } catch (e) { console.warn('addTask error:', e); setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={openModal} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t.myTasks}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Section Toggle */}
        <View style={styles.sectionToggle}>
          <TouchableOpacity
            style={[styles.sectionBtn, activeSection === 'core' && styles.sectionBtnActive]}
            onPress={() => { setActiveSection('core'); setFilter('all'); }} activeOpacity={0.8}
          >
            <Ionicons name="star" size={14} color={activeSection === 'core' ? '#fff' : '#7C5CBF'} />
            <Text style={[styles.sectionBtnText, activeSection === 'core' && styles.sectionBtnTextActive]}>
              {t.coreTasks}
            </Text>
            <View style={[styles.sectionCount, { backgroundColor: activeSection === 'core' ? 'rgba(255,255,255,0.3)' : '#7C5CBF22' }]}>
              <Text style={[styles.sectionCountText, { color: activeSection === 'core' ? '#fff' : '#7C5CBF' }]}>
                {coreTasks.length}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionBtn, activeSection === 'extra' && styles.sectionBtnActive]}
            onPress={() => { setActiveSection('extra'); setFilter('all'); }} activeOpacity={0.8}
          >
            <Ionicons name="flash" size={14} color={activeSection === 'extra' ? '#fff' : '#7C5CBF'} />
            <Text style={[styles.sectionBtnText, activeSection === 'extra' && styles.sectionBtnTextActive]}>
              {t.extraTasks}
            </Text>
            <View style={[styles.sectionCount, { backgroundColor: activeSection === 'extra' ? 'rgba(255,255,255,0.3)' : '#7C5CBF22' }]}>
              <Text style={[styles.sectionCountText, { color: activeSection === 'extra' ? '#fff' : '#7C5CBF' }]}>
                {extraTasks.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionHint, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name={activeSection === 'core' ? 'refresh-circle-outline' : 'calendar-outline'} size={13} color="#7C5CBF99" />
          <Text style={styles.sectionHintText}>
            {activeSection === 'core' ? t.coreTasksHint : t.extraTasksHint}
          </Text>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filters, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          style={{ marginBottom: Spacing.base, alignSelf: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          {FILTERS.map(f => (
            <Chip key={f.k} label={f.l} active={filter === f.k} onPress={() => setFilter(f.k)} />
          ))}
        </ScrollView>

        {/* Task List */}
        <View style={styles.taskList}>
          {SECTION_TASKS.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 44 }}>{activeSection === 'core' ? '⭐' : '⚡'}</Text>
              <Text style={styles.emptyText}>
                {activeSection === 'core' ? t.noCoreTasksYet : t.noExtraTasksToday}
              </Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openModal}>
                <Ionicons name="add" size={16} color="#7C5CBF" />
                <Text style={styles.emptyAddText}>{t.addTask}</Text>
              </TouchableOpacity>
            </View>
          ) : visible.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 36 }}>📭</Text>
              <Text style={styles.emptyText}>{t.noTasksInCategory}</Text>
            </View>
          ) : (
            visible.map((task) => (
              <TouchableOpacity
                key={task.key}
                onPressIn={() => handleLongPressStart(task)}
                onPressOut={() => handleLongPressEnd(task.key)}
                activeOpacity={0.85}
                style={[styles.taskCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <View style={[styles.taskIcon, { backgroundColor: task.bg }]}>
                  <Text style={{ fontSize: 28 }}>{task.icon}</Text>
                </View>
                <View style={[styles.taskInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                  <View style={[styles.taskTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Text style={styles.taskTitle}>{getLabel(task)}</Text>
                    <View style={[styles.typeBadge, { backgroundColor: task.type === 'core' ? '#7C5CBF22' : '#F4A32B22' }]}>
                      <Text style={[styles.typeBadgeText, { color: task.type === 'core' ? '#7C5CBF' : '#C97B3A' }]}>
                        {task.type === 'core' ? '⭐' : '⚡'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.taskMetaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                    {/* Display time with AM/PM label */}
                    <Text style={styles.taskTime}> {formatTime(task.time, isRTL)}</Text>
                  </View>
                  <View style={[styles.energyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={styles.energyTrack}>
                      <View style={[styles.energyFill, { width: `${task.energy}%` as any, backgroundColor: task.color }]} />
                    </View>
                    <View style={[styles.energyBadge, { backgroundColor: task.bg }]}>
                      <Text style={[styles.energyPct, { color: task.color }]}>{task.energy}%</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Task Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal} statusBarTranslucent={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={closeModal} />
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={{ paddingBottom: 36 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{t.addNewTask}</Text>
                <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Task Type */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskType}</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity style={[styles.typeBtn, newType === 'core' && styles.typeBtnActive]} onPress={() => setNewType('core')} activeOpacity={0.8}>
                  <Ionicons name="star" size={16} color={newType === 'core' ? '#fff' : '#7C5CBF'} />
                  <Text style={[styles.typeBtnText, newType === 'core' && styles.typeBtnTextActive]}>{t.taskTypeCore}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeBtn, newType === 'extra' && styles.typeBtnActive]} onPress={() => setNewType('extra')} activeOpacity={0.8}>
                  <Ionicons name="flash" size={16} color={newType === 'extra' ? '#fff' : '#7C5CBF'} />
                  <Text style={[styles.typeBtnText, newType === 'extra' && styles.typeBtnTextActive]}>{t.taskTypeExtra}</Text>
                </TouchableOpacity>
              </View>

              {/* Task Name */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskName}</Text>
              <TextInput
                style={[styles.fieldInput, nameError && styles.fieldInputError, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder={t.taskNamePlaceholder}
                placeholderTextColor={Colors.textMuted}
                value={newName} onChangeText={(v) => { setNewName(v); if (v.trim()) setNameError(false); }}
                autoFocus={false} returnKeyType="next"
              />
              {nameError && <Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskNameRequired}</Text>}

              {/* Icon */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskIcon}</Text>
              <TextInput
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder="📌" placeholderTextColor={Colors.textMuted}
                value={newIcon} onChangeText={setNewIcon}
              />

              {/* Time with AM/PM toggles */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskTime}</Text>
              <View style={[styles.timeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {/* Start time */}
                <View style={styles.timeSlot}>
                  <TextInput
                    style={styles.timeInput}
                    placeholder={t.taskTimeFromPlaceholder}
                    placeholderTextColor={Colors.textMuted}
                    value={newTimeStart} onChangeText={setNewTimeStart}
                    keyboardType="numbers-and-punctuation"
                    textAlign="center"
                  />
                  <AmPmToggle period={newPeriodStart} onChange={setNewPeriodStart} isRTL={isRTL} />
                </View>

                <Text style={styles.timeSep}>—</Text>

                {/* End time */}
                <View style={styles.timeSlot}>
                  <TextInput
                    style={styles.timeInput}
                    placeholder={t.taskTimeToPlaceholder}
                    placeholderTextColor={Colors.textMuted}
                    value={newTimeEnd} onChangeText={setNewTimeEnd}
                    keyboardType="numbers-and-punctuation"
                    textAlign="center"
                  />
                  <AmPmToggle period={newPeriodEnd} onChange={setNewPeriodEnd} isRTL={isRTL} />
                </View>
              </View>

              {/* Category */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskCategory2}</Text>
              <View style={[styles.catRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {CAT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.k}
                    style={[styles.catBtn, newCat === opt.k && styles.catBtnActive]}
                    onPress={() => setNewCat(opt.k)} activeOpacity={0.8}
                  >
                    <Text style={[styles.catBtnText, newCat === opt.k && styles.catBtnTextActive]}>{opt.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Energy */}
              <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskEnergyConsumed}</Text>
              <TextInput
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder={t.taskEnergyPlaceholder}
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                value={newEnergy} onChangeText={setNewEnergy}
              />

              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                onPress={addTask} activeOpacity={0.85} disabled={saving}
              >
                <Text style={styles.submitText}>
                  {saving ? t.savingDots : t.addTaskBtn}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <PatientTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl },
  topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.base },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 3, elevation: 2 },
  title:   { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  sectionToggle: { flexDirection: 'row', backgroundColor: '#F0EBFA', borderRadius: 16, padding: 4, marginBottom: 6, gap: 4 },
  sectionBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  sectionBtnActive:  { backgroundColor: '#7C5CBF' },
  sectionBtnText:    { fontSize: 13, fontWeight: '700', color: '#7C5CBF' },
  sectionBtnTextActive: { color: '#fff' },
  sectionCount:     { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontSize: 10, fontWeight: '800' },
  sectionHint:     { alignItems: 'center', gap: 5, marginBottom: Spacing.base },
  sectionHintText: { fontSize: 11, color: '#7C5CBF99', fontStyle: 'italic' },
  filters: { gap: 8, paddingVertical: 4 },
  taskList: { gap: 14 },
  emptyState:  { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText:   { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#7C5CBF', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#F0EBFA' },
  emptyAddText:{ fontSize: 13, fontWeight: '700', color: '#7C5CBF' },
  taskCard:    { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, alignItems: 'center', gap: 12, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  taskIcon:    { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  taskInfo:    { flex: 1, gap: 4 },
  taskTitleRow:{ alignItems: 'center', gap: 6 },
  taskTitle:   { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  typeBadge:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 11 },
  taskMetaRow: { alignItems: 'center', gap: 2 },
  taskTime:    { fontSize: FontSize.xs, color: Colors.textMuted },
  energyRow:   { alignItems: 'center', gap: 8, width: '100%' },
  energyTrack: { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  energyFill:  { height: '100%', borderRadius: 2 },
  energyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  energyPct:   { fontSize: 10, fontWeight: '700' },
  modalSheet:     { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, maxHeight: '90%' },
  modalHandle:    { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  modalCloseBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  typeRow:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#7C5CBF', borderRadius: 12, paddingVertical: 10, backgroundColor: '#F0EBFA' },
  typeBtnActive:     { backgroundColor: '#7C5CBF' },
  typeBtnText:       { fontSize: 12, fontWeight: '700', color: '#7C5CBF' },
  typeBtnTextActive: { color: '#fff' },
  fieldLabel:     { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput:     { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 10, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.background, marginBottom: 14 },
  fieldInputError:{ borderColor: '#E24B4A' },
  errorText:      { fontSize: FontSize.xs, color: '#E24B4A', marginTop: -10, marginBottom: 8 },
  // Time row: two slots side by side with a separator
  timeRow:     { gap: 8, marginBottom: 14, alignItems: 'center' },
  timeSlot:    { flex: 1, flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  timeInput:   { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 10, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.background, textAlign: 'center' },
  timeSep:     { color: Colors.textMuted, fontSize: 18 },
  catRow:      { gap: 10, marginBottom: 14 },
  catBtn:      { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.background },
  catBtnActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catBtnText:      { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  catBtnTextActive:{ color: '#fff' },
  submitBtn:  { backgroundColor: Colors.primary, borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitText: { fontSize: FontSize.base, fontWeight: '800', color: '#fff' },
});