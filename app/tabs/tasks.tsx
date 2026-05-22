// app/(tabs)/tasks.tsx
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  Keyboard, StatusBar, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Chip } from '../../components/UI';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import { notify, suppressTaskListNotifOnce } from './notificationService';

// ─── Types ───────────────────────────────────────────────
type TaskType = 'core' | 'extra';

type Task = {
  key: string;
  icon: string;
  cat: string;
  energy: number;
  color: string;
  bg: string;
  time: string;
  done: boolean;
  name?: string;
  date?: string;
  type: TaskType;
};

// ─── Storage Keys ─────────────────────────────────────────
const CORE_TASKS_KEY  = 'core_tasks';
const EXTRA_TASKS_KEY = 'extra_tasks';

// ─── Constants ───────────────────────────────────────────
const CAT_COLORS: Record<string, { color: string; bg: string }> = {
  work:  { color: '#5B9BD5', bg: '#E8F1FB' },
  study: { color: '#4CAF82', bg: '#E8F5EF' },
  home:  { color: '#C97B3A', bg: '#FEF3E2' },
};

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ─── Default core tasks ───────────────────────────────────
const DEFAULT_CORE_TASKS: Task[] = [
  { key: 'coding',   icon: '💻', cat: 'work',  energy: 25, color: '#5B9BD5', bg: '#E8F1FB', time: '09:00 - 10:30', done: false, type: 'core' },
  { key: 'reading',  icon: '📚', cat: 'study', energy: 20, color: '#4CAF82', bg: '#E8F5EF', time: '11:00 - 12:00', done: false, type: 'core' },
  { key: 'cooking',  icon: '🍲', cat: 'home',  energy: 30, color: '#C97B3A', bg: '#FEF3E2', time: '01:00 - 02:00', done: false, type: 'core' },
  { key: 'cleaning', icon: '🧹', cat: 'home',  energy: 15, color: '#D15DBF', bg: '#FAE8F8', time: '03:00 - 04:00', done: false, type: 'core' },
];

// ─── Main Screen ─────────────────────────────────────────
export default function TasksScreen() {
  const { t, isRTL } = useLang();
  const navigation   = useNavigation();

  const TODAY = todayKey();

  const CORE_LABELS: Record<string, string> = {
    coding:   t.taskCoding,
    reading:  t.taskReading,
    cooking:  t.taskCooking,
    cleaning: t.taskCleaning,
  };

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

  // ── State ──
  const [activeSection, setActiveSection] = useState<TaskType>('core');
  const [filter,        setFilter]        = useState('all');
  const [coreTasks,     setCoreTasks]     = useState<Task[]>([]);
  const [extraTasks,    setExtraTasks]    = useState<Task[]>([]);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [newName,       setNewName]       = useState('');
  const [newIcon,       setNewIcon]       = useState('');
  const [newTimeStart,  setNewTimeStart]  = useState('');
  const [newTimeEnd,    setNewTimeEnd]    = useState('');
  const [newEnergy,     setNewEnergy]     = useState('');
  const [newCat,        setNewCat]        = useState('work');
  const [newType,       setNewType]       = useState<TaskType>('core');
  const [nameError,     setNameError]     = useState(false);
  const [saving,        setSaving]        = useState(false);

  const longPressTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Load from AsyncStorage ──
  useFocusEffect(useCallback(() => {
    loadAllTasks();
  }, []));

  async function loadAllTasks() {
    // Core tasks
    const storedCore = await AsyncStorage.getItem(CORE_TASKS_KEY);
    if (storedCore) {
      setCoreTasks(JSON.parse(storedCore));
    } else {
      await AsyncStorage.setItem(CORE_TASKS_KEY, JSON.stringify(DEFAULT_CORE_TASKS));
      setCoreTasks(DEFAULT_CORE_TASKS);
    }

    // Extra tasks
    const storedExtra = await AsyncStorage.getItem(EXTRA_TASKS_KEY);
    if (storedExtra) {
      const parsed: Task[] = JSON.parse(storedExtra);
      const today = todayKey();
      const filtered = parsed.filter((tk: any) => !tk.date || tk.date === today);
      if (filtered.length !== parsed.length) {
        await AsyncStorage.setItem(EXTRA_TASKS_KEY, JSON.stringify(filtered));
      }
      setExtraTasks(filtered);
    } else {
      await AsyncStorage.setItem(EXTRA_TASKS_KEY, JSON.stringify([]));
      setExtraTasks([]);
    }
  }

  // ── Derived ──
  const SECTION_TASKS = activeSection === 'core' ? coreTasks : extraTasks;
  const visible       = filter === 'all'
    ? SECTION_TASKS
    : SECTION_TASKS.filter(tk => tk.cat === filter);
  const done          = SECTION_TASKS.filter(tk => tk.done).length;

  const getLabel = (task: Task) => task.name ?? CORE_LABELS[task.key] ?? task.key;

  // ── Toggle done ──
  const toggle = async (k: string) => {
    if (activeSection === 'core') {
      const updated = coreTasks.map(tk => tk.key === k ? { ...tk, done: !tk.done } : tk);
      setCoreTasks(updated);
      await AsyncStorage.setItem(CORE_TASKS_KEY, JSON.stringify(updated));
    } else {
      const updated = extraTasks.map(tk => tk.key === k ? { ...tk, done: !tk.done } : tk);
      setExtraTasks(updated);
      await AsyncStorage.setItem(EXTRA_TASKS_KEY, JSON.stringify(updated));
    }
  };

  // ── Long press handlers ──
  function handleLongPressStart(task: Task) {
    longPressTimers.current[task.key] = setTimeout(() => {
      const label = getLabel(task);
      const convertLabel = task.type === 'core'
        ? (isRTL ? '⚡ حوّل لإضافي' : '⚡ Move to Extra')
        : (isRTL ? '⭐ حوّل لأساسي' : '⭐ Move to Core');

      Alert.alert(
        isRTL ? 'خيارات المهمة' : 'Task Options',
        `"${label}"`,
        [
          { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: convertLabel, onPress: () => handleConvertTask(task) },
          {
            text: isRTL ? '🗑️ حذف' : '🗑️ Delete',
            style: 'destructive',
            onPress: () => handleDeleteTask(task),
          },
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

  // ── Convert task (core ↔ extra) ──
  async function handleConvertTask(task: Task) {
    const newTaskType: TaskType = task.type === 'core' ? 'extra' : 'core';
    const convertedTask: Task = {
      ...task,
      type: newTaskType,
      done: false,
      ...(newTaskType === 'extra' ? { date: TODAY } : { date: undefined }),
    };

    if (task.type === 'core') {
      const updatedCore = coreTasks.filter(tk => tk.key !== task.key);
      const updatedExtra = [...extraTasks, convertedTask];
      setCoreTasks(updatedCore);
      setExtraTasks(updatedExtra);
      await AsyncStorage.setItem(CORE_TASKS_KEY, JSON.stringify(updatedCore));
      await AsyncStorage.setItem(EXTRA_TASKS_KEY, JSON.stringify(updatedExtra));
    } else {
      const updatedExtra = extraTasks.filter(tk => tk.key !== task.key);
      const updatedCore = [...coreTasks, convertedTask];
      setExtraTasks(updatedExtra);
      setCoreTasks(updatedCore);
      await AsyncStorage.setItem(EXTRA_TASKS_KEY, JSON.stringify(updatedExtra));
      await AsyncStorage.setItem(CORE_TASKS_KEY, JSON.stringify(updatedCore));
    }

    await AsyncStorage.setItem('data_changed_at', Date.now().toString());
    setActiveSection(newTaskType);
    setFilter('all');

    suppressTaskListNotifOnce();
    await notify({
      title: isRTL ? 'تم التحويل ✅' : 'Task Moved ✅',
      body: isRTL
        ? `"${getLabel(task)}" اتحولت لـ${newTaskType === 'core' ? 'الأساسي' : 'الإضافي'}`
        : `"${getLabel(task)}" moved to ${newTaskType === 'core' ? 'Core' : 'Extra'}`,
      emoji: task.icon,
      type: 'add',
    });
  }

  // ── Delete task ──
  async function handleDeleteTask(task: Task) {
    suppressTaskListNotifOnce();

    if (task.type === 'core') {
      const updated = coreTasks.filter(tk => tk.key !== task.key);
      setCoreTasks(updated);
      await AsyncStorage.setItem(CORE_TASKS_KEY, JSON.stringify(updated));
    } else {
      const updated = extraTasks.filter(tk => tk.key !== task.key);
      setExtraTasks(updated);
      await AsyncStorage.setItem(EXTRA_TASKS_KEY, JSON.stringify(updated));
    }

    await AsyncStorage.setItem('data_changed_at', Date.now().toString());

    await notify({
      title: isRTL ? 'تم حذف المهمة 🗑️' : 'Task Deleted 🗑️',
      body: isRTL
        ? `"${getLabel(task)}" تم حذفها`
        : `"${getLabel(task)}" has been deleted`,
      emoji: task.icon,
      type: 'delete',
    });
  }

  // ── Open add modal ──
  const openModal = () => {
    setNewName('');
    setNewIcon('');
    setNewTimeStart('');
    setNewTimeEnd('');
    setNewEnergy('');
    setNewCat('work');
    setNewType(activeSection);
    setNameError(false);
    setSaving(false);
    setModalVisible(true);
  };

  // ── Close modal & reset ──
  const closeModal = () => {
    Keyboard.dismiss();
    setModalVisible(false);
    setNewName('');
    setNewIcon('');
    setNewTimeStart('');
    setNewTimeEnd('');
    setNewEnergy('');
    setNewCat('work');
    setNameError(false);
    setSaving(false);
  };

  // ── Add new task ──
  const addTask = async () => {
    if (!newName.trim()) {
      setNameError(true);
      return;
    }
    if (saving) return;
    setSaving(true);

    try {
      const catColors = CAT_COLORS[newCat] ?? CAT_COLORS.work;
      const timeStr   = newTimeStart && newTimeEnd
        ? `${newTimeStart.trim()} - ${newTimeEnd.trim()}`
        : newTimeStart.trim() || '--:--';
      const energy = Math.min(100, Math.max(5, parseInt(newEnergy) || 20));

      const newTask: Task = {
        key:   `task_${Date.now()}`,
        icon:  newIcon.trim() || '📌',
        cat:   newCat,
        energy,
        color: catColors.color,
        bg:    catColors.bg,
        time:  timeStr,
        done:  false,
        name:  newName.trim(),
        type:  newType,
        ...(newType === 'extra' ? { date: TODAY } : {}),
      };

      // أغلق المودال أولاً
      closeModal();

      // حدّث الـ state و AsyncStorage
      if (newType === 'core') {
        const updated = [...coreTasks, newTask];
        setCoreTasks(updated);
        await AsyncStorage.setItem(CORE_TASKS_KEY, JSON.stringify(updated));
      } else {
        const updated = [...extraTasks, newTask];
        setExtraTasks(updated);
        await AsyncStorage.setItem(EXTRA_TASKS_KEY, JSON.stringify(updated));
      }

      await AsyncStorage.setItem('data_changed_at', Date.now().toString());
      setActiveSection(newType);

      // ── إشعار الإضافة أُلغي عمداً ──
      // (الإشعار بيجي من الصفحة الرئيسية تلقائياً)

    } catch (e) {
      console.warn('addTask error:', e);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color="#7C5CBF" />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>{t.myTasks}</Text>
            <Text style={styles.subtitle}>
              {isRTL
                ? `${done} ${t.from} ${SECTION_TASKS.length} ${t.completedOf}`
                : `${done} ${t.completedOf} ${t.from} ${SECTION_TASKS.length}`}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={openModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Section Toggle ── */}
        <View style={styles.sectionToggle}>
          <TouchableOpacity
            style={[styles.sectionBtn, activeSection === 'core' && styles.sectionBtnActive]}
            onPress={() => { setActiveSection('core'); setFilter('all'); }}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={14} color={activeSection === 'core' ? '#fff' : '#7C5CBF'} />
            <Text style={[styles.sectionBtnText, activeSection === 'core' && styles.sectionBtnTextActive]}>
              {isRTL ? 'الأساسي' : 'Core'}
            </Text>
            <View style={[styles.sectionCount, { backgroundColor: activeSection === 'core' ? 'rgba(255,255,255,0.3)' : '#7C5CBF22' }]}>
              <Text style={[styles.sectionCountText, { color: activeSection === 'core' ? '#fff' : '#7C5CBF' }]}>
                {coreTasks.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sectionBtn, activeSection === 'extra' && styles.sectionBtnActive]}
            onPress={() => { setActiveSection('extra'); setFilter('all'); }}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={14} color={activeSection === 'extra' ? '#fff' : '#7C5CBF'} />
            <Text style={[styles.sectionBtnText, activeSection === 'extra' && styles.sectionBtnTextActive]}>
              {isRTL ? 'الإضافي' : 'Extra'}
            </Text>
            <View style={[styles.sectionCount, { backgroundColor: activeSection === 'extra' ? 'rgba(255,255,255,0.3)' : '#7C5CBF22' }]}>
              <Text style={[styles.sectionCountText, { color: activeSection === 'extra' ? '#fff' : '#7C5CBF' }]}>
                {extraTasks.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Section hint ── */}
        <View style={styles.sectionHint}>
          <Ionicons
            name={activeSection === 'core' ? 'refresh-circle-outline' : 'calendar-outline'}
            size={13}
            color="#7C5CBF99"
          />
          <Text style={styles.sectionHintText}>
            {activeSection === 'core'
              ? (isRTL ? 'مهام يومية ثابتة — اضغط مطولاً للخيارات' : 'Daily fixed tasks — long press for options')
              : (isRTL ? 'مهام إضافية ليوم واحد فقط — اضغط مطولاً للخيارات' : 'Extra tasks for today only — long press for options')}
          </Text>
        </View>

        {/* ── Progress ── */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressPct}>
              {SECTION_TASKS.length > 0 ? Math.round((done / SECTION_TASKS.length) * 100) : 0}%
            </Text>
            <Text style={styles.progressLabel}>{t.todayProgress}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${SECTION_TASKS.length > 0 ? (done / SECTION_TASKS.length) * 100 : 0}%` as any },
              ]}
            />
          </View>
        </View>

        {/* ── Filters ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filters, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          style={{ marginBottom: Spacing.base }}
          keyboardShouldPersistTaps="handled"
        >
          {FILTERS.map((f) => (
            <Chip key={f.k} label={f.l} active={filter === f.k} onPress={() => setFilter(f.k)} />
          ))}
        </ScrollView>

        {/* ── Tasks ── */}
        <View style={styles.taskList}>
          {SECTION_TASKS.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 44 }}>{activeSection === 'core' ? '⭐' : '⚡'}</Text>
              <Text style={styles.emptyText}>
                {isRTL
                  ? (activeSection === 'core' ? 'مفيش مهام أساسية بعد' : 'مفيش مهام إضافية لليوم دة')
                  : (activeSection === 'core' ? 'No core tasks yet' : 'No extra tasks for today')}
              </Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openModal}>
                <Ionicons name="add" size={16} color="#7C5CBF" />
                <Text style={styles.emptyAddText}>
                  {isRTL ? 'أضف مهمة' : 'Add Task'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : visible.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 36 }}>📭</Text>
              <Text style={styles.emptyText}>{isRTL ? 'لا توجد مهام في هذا التصنيف' : 'No tasks in this category'}</Text>
            </View>
          ) : (
            visible.map((task) => (
              <TouchableOpacity
                key={task.key}
                onPress={() => toggle(task.key)}
                onPressIn={() => handleLongPressStart(task)}
                onPressOut={() => handleLongPressEnd(task.key)}
                delayLongPress={600}
                activeOpacity={0.85}
                style={[
                  styles.taskCard,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                  task.done && { opacity: 0.65 },
                ]}
              >
                <View style={[styles.taskIcon, { backgroundColor: task.bg }]}>
                  <Text style={{ fontSize: 28 }}>{task.icon}</Text>
                </View>

                <View style={[styles.taskInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                  <View style={[styles.taskTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>
                      {getLabel(task)}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: task.type === 'core' ? '#7C5CBF22' : '#F4A32B22' }]}>
                      <Text style={[styles.typeBadgeText, { color: task.type === 'core' ? '#7C5CBF' : '#C97B3A' }]}>
                        {task.type === 'core' ? '⭐' : '⚡'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.taskMetaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.taskTime}> {task.time}</Text>
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

                <View style={[styles.checkbox, task.done && { backgroundColor: Colors.success, borderColor: Colors.success }]}>
                  {task.done && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ─── Add Task Modal ─── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
        statusBarTranslucent={false}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* خلفية شفافة — الضغط عليها يقفل المودال */}
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1}
            onPress={closeModal}
          />

          {/* محتوى المودال */}
          <View style={styles.modalSheet}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: 36 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHandle} />

              {/* Header */}
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {isRTL ? 'إضافة مهمة جديدة' : 'Add New Task'}
                </Text>
                <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Task Type */}
              <Text style={styles.fieldLabel}>{isRTL ? 'نوع المهمة' : 'Task Type'}</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, newType === 'core' && styles.typeBtnActive]}
                  onPress={() => setNewType('core')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="star" size={16} color={newType === 'core' ? '#fff' : '#7C5CBF'} />
                  <Text style={[styles.typeBtnText, newType === 'core' && styles.typeBtnTextActive]}>
                    {isRTL ? 'أساسي 🔁' : 'Core 🔁'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, newType === 'extra' && styles.typeBtnActive]}
                  onPress={() => setNewType('extra')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash" size={16} color={newType === 'extra' ? '#fff' : '#7C5CBF'} />
                  <Text style={[styles.typeBtnText, newType === 'extra' && styles.typeBtnTextActive]}>
                    {isRTL ? 'إضافي ⚡ (اليوم بس)' : 'Extra ⚡ (Today only)'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Task Name */}
              <Text style={styles.fieldLabel}>{isRTL ? 'اسم المهمة *' : 'Task name *'}</Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  nameError && styles.fieldInputError,
                  { textAlign: isRTL ? 'right' : 'left' },
                ]}
                placeholder={isRTL ? 'مثال: قراءة كتاب...' : 'e.g. Read a book...'}
                placeholderTextColor={Colors.textMuted}
                value={newName}
                onChangeText={(v) => { setNewName(v); if (v.trim()) setNameError(false); }}
                autoFocus={false}
                returnKeyType="next"
              />
              {nameError && (
                <Text style={styles.errorText}>{isRTL ? 'الرجاء إدخال اسم المهمة' : 'Please enter task name'}</Text>
              )}

              {/* Icon */}
              <Text style={styles.fieldLabel}>{isRTL ? 'الإيقونة (إيموجي)' : 'Icon (emoji)'}</Text>
              <TextInput
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder="📌"
                placeholderTextColor={Colors.textMuted}
                value={newIcon}
                onChangeText={setNewIcon}
              />

              {/* Time */}
              <Text style={styles.fieldLabel}>{isRTL ? 'الوقت' : 'Time'}</Text>
              <View style={[styles.timeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  placeholder={isRTL ? '09:00 ص' : '09:00 AM'}
                  placeholderTextColor={Colors.textMuted}
                  value={newTimeStart}
                  onChangeText={setNewTimeStart}
                  textAlign="center"
                />
                <Text style={styles.timeSep}>—</Text>
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  placeholder={isRTL ? '10:00 ص' : '10:00 AM'}
                  placeholderTextColor={Colors.textMuted}
                  value={newTimeEnd}
                  onChangeText={setNewTimeEnd}
                  textAlign="center"
                />
              </View>

              {/* Category */}
              <Text style={styles.fieldLabel}>{isRTL ? 'التصنيف' : 'Category'}</Text>
              <View style={[styles.catRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {CAT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.k}
                    style={[styles.catBtn, newCat === opt.k && styles.catBtnActive]}
                    onPress={() => setNewCat(opt.k)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.catBtnText, newCat === opt.k && styles.catBtnTextActive]}>
                      {opt.l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Energy */}
              <Text style={styles.fieldLabel}>{isRTL ? 'الطاقة المستهلكة (%)' : 'Energy consumed (%)'}</Text>
              <TextInput
                style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder={isRTL ? 'مثال: 20' : 'e.g. 20'}
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                value={newEnergy}
                onChangeText={setNewEnergy}
              />

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                onPress={addTask}
                activeOpacity={0.85}
                disabled={saving}
              >
                <Text style={styles.submitText}>
                  {saving
                    ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                    : (isRTL ? '✚ إضافة المهمة' : '✚ Add Task')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl },

  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.base },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 3, elevation: 2,
  },
  titleBlock: { flex: 1, alignItems: 'center' },
  title:      { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle:   { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  sectionToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0EBFA',
    borderRadius: 16,
    padding: 4,
    marginBottom: 6,
    gap: 4,
  },
  sectionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
  },
  sectionBtnActive:     { backgroundColor: '#7C5CBF' },
  sectionBtnText:       { fontSize: 13, fontWeight: '700', color: '#7C5CBF' },
  sectionBtnTextActive: { color: '#fff' },
  sectionCount: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionCountText: { fontSize: 10, fontWeight: '800' },

  sectionHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: Spacing.base,
  },
  sectionHintText: { fontSize: 11, color: '#7C5CBF99', fontStyle: 'italic' },

  progressCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.base, marginBottom: Spacing.xl,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  progressRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressLabel: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textSecondary },
  progressPct:   { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  progressTrack: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },

  filters: { gap: 8, paddingVertical: 4 },

  taskList: { gap: 14 },
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#7C5CBF', borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#F0EBFA',
  },
  emptyAddText: { fontSize: 13, fontWeight: '700', color: '#7C5CBF' },

  taskCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.base, alignItems: 'center', gap: 12,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  taskIcon:     { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  taskInfo:     { flex: 1, gap: 4 },
  taskTitleRow: { alignItems: 'center', gap: 6 },
  taskTitle:    { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  taskTitleDone:{ textDecorationLine: 'line-through', color: Colors.textMuted },
  typeBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText:{ fontSize: 11 },
  taskMetaRow:  { alignItems: 'center', gap: 2 },
  taskTime:     { fontSize: FontSize.xs, color: Colors.textMuted },
  energyRow:    { alignItems: 'center', gap: 8, width: '100%' },
  energyTrack:  { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  energyFill:   { height: '100%', borderRadius: 2 },
  energyBadge:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  energyPct:    { fontSize: 10, fontWeight: '700' },
  checkbox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Modal ──
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2,
    alignSelf: 'center', marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '800', color: Colors.textPrimary,
  },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderColor: '#7C5CBF',
    borderRadius: 12, paddingVertical: 10, backgroundColor: '#F0EBFA',
  },
  typeBtnActive:     { backgroundColor: '#7C5CBF' },
  typeBtnText:       { fontSize: 12, fontWeight: '700', color: '#7C5CBF' },
  typeBtnTextActive: { color: '#fff' },

  fieldLabel: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary,
    marginBottom: 6, textAlign: 'right',
  },
  fieldInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: 10, fontSize: FontSize.base, color: Colors.textPrimary,
    backgroundColor: Colors.background, marginBottom: 14,
  },
  fieldInputError: { borderColor: '#E24B4A' },
  errorText: {
    fontSize: FontSize.xs, color: '#E24B4A',
    textAlign: 'right', marginTop: -10, marginBottom: 8,
  },
  timeRow:          { gap: 10, marginBottom: 14, alignItems: 'center' },
  timeSep:          { color: Colors.textMuted, fontSize: 18, marginBottom: 14 },
  catRow:           { gap: 10, marginBottom: 14 },
  catBtn:           { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.background },
  catBtnActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catBtnText:       { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  catBtnTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  submitText: { fontSize: FontSize.base, fontWeight: '800', color: '#fff' },
});