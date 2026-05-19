// app/(tabs)/tasks.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  Keyboard, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Chip } from '../../components/UI';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

// ─── Types ───────────────────────────────────────────────
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
};

// ─── Constants ───────────────────────────────────────────
const CAT_COLORS: Record<string, { color: string; bg: string }> = {
  work:  { color: '#5B9BD5', bg: '#E8F1FB' },
  study: { color: '#4CAF82', bg: '#E8F5EF' },
  home:  { color: '#C97B3A', bg: '#FEF3E2' },
};

function toKey(date: Date) {
  return date.toISOString().split('T')[0];
}

const STORAGE_KEY = 'tasks_list';

// ─── Main Screen ─────────────────────────────────────────
export default function TasksScreen() {
  const { t, isRTL } = useLang();
  const navigation   = useNavigation();

  const TODAY = toKey(new Date());

  const INITIAL_TASKS: Task[] = [
    { key: 'coding',   icon: '💻', cat: 'work',  energy: 25, color: '#5B9BD5', bg: '#E8F1FB', time: '09:00 - 10:30', done: false, date: TODAY },
    { key: 'reading',  icon: '📚', cat: 'study', energy: 20, color: '#4CAF82', bg: '#E8F5EF', time: '11:00 - 12:00', done: false, date: TODAY },
    { key: 'cooking',  icon: '🍲', cat: 'home',  energy: 30, color: '#C97B3A', bg: '#FEF3E2', time: '01:00 - 02:00', done: false, date: TODAY },
    { key: 'cleaning', icon: '🧹', cat: 'home',  energy: 15, color: '#D15DBF', bg: '#FAE8F8', time: '03:00 - 04:00', done: false, date: TODAY },
  ];

  const LABELS: Record<string, string> = {
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

  const [filter, setFilter]             = useState('all');
  const [tasks, setTasks]               = useState<Task[]>(INITIAL_TASKS);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName]           = useState('');
  const [newIcon, setNewIcon]           = useState('');
  const [newTimeStart, setNewTimeStart] = useState('');
  const [newTimeEnd, setNewTimeEnd]     = useState('');
  const [newEnergy, setNewEnergy]       = useState('');
  const [newCat, setNewCat]             = useState('work');
  const [nameError, setNameError]       = useState(false);

  // ── Load from AsyncStorage on screen focus ──
  useFocusEffect(useCallback(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTasks(JSON.parse(stored));
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TASKS));
        setTasks(INITIAL_TASKS);
      }
    })();
  }, []));

  // ── Derived ──
  const visible = filter === 'all' ? tasks : tasks.filter(tk => tk.cat === filter);
  const done    = tasks.filter(tk => tk.done).length;

  // ── Toggle done ──
  const toggle = async (k: string) => {
    const updated = tasks.map(tk => tk.key === k ? { ...tk, done: !tk.done } : tk);
    setTasks(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // ── Open add modal ──
  const openModal = () => {
    setNewName(''); setNewIcon(''); setNewTimeStart('');
    setNewTimeEnd(''); setNewEnergy(''); setNewCat('work');
    setNameError(false);
    setModalVisible(true);
  };

  // ── Add new task ──
  const addTask = async () => {
    if (!newName.trim()) { setNameError(true); return; }
    const catColors = CAT_COLORS[newCat] ?? CAT_COLORS.work;
    const timeStr   = newTimeStart && newTimeEnd
      ? `${newTimeStart} - ${newTimeEnd}`
      : newTimeStart || '--:--';
    const energy = Math.min(100, Math.max(5, parseInt(newEnergy) || 20));
    const newTask: Task = {
      key:    `task_${Date.now()}`,
      icon:   newIcon.trim() || '📌',
      cat:    newCat,
      energy,
      color:  catColors.color,
      bg:     catColors.bg,
      time:   timeStr,
      done:   false,
      name:   newName.trim(),
      date:   TODAY,
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    // ✅ Persist so plan.tsx reads the same data
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setModalVisible(false);
  };

  const getLabel = (task: Task) => task.name ?? LABELS[task.key] ?? task.key;

  const backIcon = isRTL ? 'chevron-forward' : 'chevron-back';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.topBar}>
          {isRTL ? (
            <>
              {/* RTL: + left | title center | back right */}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={openModal}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={22} color="#7C5CBF" />
              </TouchableOpacity>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>{t.myTasks}</Text>
                <Text
                  style={styles.subtitle}
                >{`${done} ${t.from} ${tasks.length} ${t.completedOf}`}</Text>
              </View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Ionicons name={backIcon} size={22} color="#7C5CBF" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* LTR: back left | title center | + right */}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Ionicons name={backIcon} size={22} color="#7C5CBF" />
              </TouchableOpacity>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>{t.myTasks}</Text>
                <Text
                  style={styles.subtitle}
                >{`${done} ${t.completedOf} ${t.from} ${tasks.length}`}</Text>
              </View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={openModal}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Progress ── */}
        <View style={styles.progressCard}>
          <View
            style={[
              styles.progressRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Text style={styles.progressPct}>
              {tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0}%
            </Text>
            <Text style={styles.progressLabel}>{t.todayProgress}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    `${tasks.length > 0 ? (done / tasks.length) * 100 : 0}%` as any,
                },
              ]}
            />
          </View>
        </View>

        {/* ── Filters ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.filters,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
          style={{ marginBottom: Spacing.base }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.k}
              label={f.l}
              active={filter === f.k}
              onPress={() => setFilter(f.k)}
            />
          ))}
        </ScrollView>

        {/* ── Tasks ── */}
        <View style={styles.taskList}>
          {visible.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 36 }}>📭</Text>
              <Text style={styles.emptyText}>لا توجد مهام</Text>
            </View>
          ) : (
            visible.map((task) => (
              <TouchableOpacity
                key={task.key}
                onPress={() => toggle(task.key)}
                activeOpacity={0.85}
                style={[
                  styles.taskCard,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                  task.done && { opacity: 0.65 },
                ]}
              >
                <View style={[styles.taskIcon, { backgroundColor: task.bg }]}>
                  <Text style={{ fontSize: 28 }}>{task.icon}</Text>
                </View>

                <View
                  style={[
                    styles.taskInfo,
                    { alignItems: isRTL ? "flex-end" : "flex-start" },
                  ]}
                >
                  <Text
                    style={[
                      styles.taskTitle,
                      task.done && styles.taskTitleDone,
                    ]}
                  >
                    {getLabel(task)}
                  </Text>
                  <View
                    style={[
                      styles.taskMetaRow,
                      { flexDirection: isRTL ? "row-reverse" : "row" },
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={Colors.textMuted}
                    />
                    <Text style={styles.taskTime}> {task.time}</Text>
                  </View>
                  <View
                    style={[
                      styles.energyRow,
                      { flexDirection: isRTL ? "row-reverse" : "row" },
                    ]}
                  >
                    <View style={styles.energyTrack}>
                      <View
                        style={[
                          styles.energyFill,
                          {
                            width: `${task.energy}%` as any,
                            backgroundColor: task.color,
                          },
                        ]}
                      />
                    </View>
                    <View
                      style={[styles.energyBadge, { backgroundColor: task.bg }]}
                    >
                      <Text style={[styles.energyPct, { color: task.color }]}>
                        {task.energy}%
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.checkbox,
                    task.done && {
                      backgroundColor: Colors.success,
                      borderColor: Colors.success,
                    },
                  ]}
                >
                  {task.done && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
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
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>إضافة مهمة جديدة</Text>

              <Text style={styles.fieldLabel}>اسم المهمة</Text>
              <TextInput
                style={[styles.fieldInput, nameError && styles.fieldInputError]}
                placeholder="مثال: قراءة كتاب..."
                placeholderTextColor={Colors.textMuted}
                value={newName}
                onChangeText={(v) => {
                  setNewName(v);
                  setNameError(false);
                }}
                textAlign="right"
              />
              {nameError && (
                <Text style={styles.errorText}>الرجاء إدخال اسم المهمة</Text>
              )}

              <Text style={styles.fieldLabel}>الإيقونة (إيموجي)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="مثال: 📖"
                placeholderTextColor={Colors.textMuted}
                value={newIcon}
                onChangeText={setNewIcon}
                textAlign="right"
              />

              <Text style={styles.fieldLabel}>الوقت</Text>
              <View
                style={[
                  styles.timeRow,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  placeholder="09:00 ص"
                  placeholderTextColor={Colors.textMuted}
                  value={newTimeStart}
                  onChangeText={setNewTimeStart}
                  textAlign="right"
                />
                <Text style={styles.timeSep}>—</Text>
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  placeholder="10:00 ص"
                  placeholderTextColor={Colors.textMuted}
                  value={newTimeEnd}
                  onChangeText={setNewTimeEnd}
                  textAlign="right"
                />
              </View>

              <Text style={styles.fieldLabel}>التصنيف</Text>
              <View
                style={[
                  styles.catRow,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                {CAT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.k}
                    style={[
                      styles.catBtn,
                      newCat === opt.k && styles.catBtnActive,
                    ]}
                    onPress={() => setNewCat(opt.k)}
                  >
                    <Text
                      style={[
                        styles.catBtnText,
                        newCat === opt.k && styles.catBtnTextActive,
                      ]}
                    >
                      {opt.l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>الطاقة المستهلكة (%)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="مثال: 20"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                value={newEnergy}
                onChangeText={setNewEnergy}
                textAlign="right"
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={addTask}
                activeOpacity={0.85}
              >
                <Text style={styles.submitText}>✚ إضافة المهمة</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: { padding: Spacing.xl },

  // Header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 2,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title:    { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  // Progress
  progressCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  progressRow:   { justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressLabel: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textSecondary },
  progressPct:   { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  progressTrack: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },

  // Filters
  filters: { gap: 8, paddingVertical: 4 },

  // Tasks
  taskList:      { gap: 14 },
  emptyState:    { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText:     { fontSize: 15, color: Colors.textMuted },
  taskCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    gap: 12,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  taskIcon:      { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  taskInfo:      { flex: 1, gap: 4 },
  taskTitle:     { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  taskTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  taskMetaRow:   { alignItems: 'center', gap: 2 },
  taskTime:      { fontSize: FontSize.xs, color: Colors.textMuted },
  energyRow:     { alignItems: 'center', gap: 8, width: '100%' },
  energyTrack:   { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  energyFill:    { height: '100%', borderRadius: 2 },
  energyBadge:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  energyPct:     { fontSize: 10, fontWeight: '700' },
  checkbox:      {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalContainer: { justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40, height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: FontSize.sm, fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6, textAlign: 'right',
  },
  fieldInput: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 10,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    marginBottom: 14,
  },
  fieldInputError:  { borderColor: '#E24B4A' },
  errorText: {
    fontSize: FontSize.xs, color: '#E24B4A',
    textAlign: 'right', marginTop: -10, marginBottom: 8,
  },
  timeRow:          { gap: 10, marginBottom: 14 },
  timeSep:          { alignSelf: 'center', color: Colors.textMuted, fontSize: 18, marginBottom: 14 },
  catRow:           { gap: 10, marginBottom: 14 },
  catBtn:           { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.background },
  catBtnActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catBtnText:       { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  catBtnTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: { fontSize: FontSize.base, fontWeight: '800', color: '#fff' },
});