import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Platform, StatusBar, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { router } from "expo-router";
import {
  setupNotifications,
  startAllWatchers,
  areWatchersRunning,
  getUnreadCount,
} from './notificationService';

// ─── Types ───────────────────────────────────────────────
interface PlanTask {
  id: string;
  title: string;
  timeFrom: string;
  timeTo: string;
  emoji: string;
  color: string;
  bg: string;
  date: string;
  effortScore: number;
  isBreak?: boolean;
  isExercise?: boolean;      // ← تمييز التمارين
  breakDescription?: string;
  taskType?: 'core' | 'extra'; // ← نوع المهمة الأصلية
}

type CompletionStatus = 'done' | 'pending' | 'locked';

// ─── Storage Keys ─────────────────────────────────────────
const CORE_TASKS_KEY      = 'core_tasks';
const EXTRA_TASKS_KEY     = 'extra_tasks';
const CORE_EXERCISES_KEY  = 'core_exercises';

// ─── Helpers ─────────────────────────────────────────────
const DAYS_AR   = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function formatDateAr(date: Date) {
  return `${DAYS_AR[date.getDay()]}، ${date.getDate()} ${MONTHS_AR[date.getMonth()]}`;
}

function toKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function canDoTask(energy: number, effortScore: number): boolean {
  if (effortScore === 1) return energy >= 20;
  if (effortScore === 2) return energy >= 45;
  return energy >= 70;
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 9999;
  const clean = timeStr.trim();
  const isAM = clean.includes('ص');
  const isPM = clean.includes('م');
  const numPart = clean.replace('ص', '').replace('م', '').trim();
  const parts   = numPart.split(':');
  let hours   = parseInt(parts[0], 10) || 0;
  const mins  = parseInt(parts[1], 10) || 0;
  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return hours * 60 + mins;
}

function nowInMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isTaskAvailable(task: PlanTask, selectedDate: Date): boolean {
  const todayKey    = toKey(new Date());
  const selectedKey = toKey(selectedDate);
  if (selectedKey !== todayKey) return true;
  if (!task.timeFrom) return true;
  const taskStart = timeToMinutes(task.timeFrom);
  return nowInMinutes() >= taskStart;
}

function sortTasksByTime(tasks: PlanTask[]): PlanTask[] {
  return [...tasks].sort((a, b) => timeToMinutes(a.timeFrom) - timeToMinutes(b.timeFrom));
}

const CAT_TO_EFFORT: Record<string, number> = { work: 3, study: 2, home: 2 };

// ─── Map raw task from tasks screen → PlanTask ────────────
function mapRawTask(raw: any, fallbackDate: string, type: 'core' | 'extra'): PlanTask {
  const timeParts = (raw.time ?? '').split(' - ');
  return {
    id:          raw.key   ?? raw.id   ?? String(Date.now()),
    title:       raw.name  ?? raw.title ?? raw.key ?? 'مهمة',
    timeFrom:    raw.timeFrom ?? timeParts[0] ?? '',
    timeTo:      raw.timeTo   ?? timeParts[1] ?? '',
    emoji:       raw.icon  ?? raw.emoji ?? '📌',
    color:       raw.color ?? '#7C5CBF',
    bg:          raw.bg    ?? '#F0EBFA',
    date:        raw.date  ?? fallbackDate,
    effortScore: raw.effortScore ?? CAT_TO_EFFORT[raw.cat] ?? 2,
    taskType:    type,
  };
}

// ─── Map core exercise → PlanTask (تمرين بين المهام) ──────
function mapExerciseToTask(exercise: any, index: number, afterTaskDate: string): PlanTask {
  return {
    id: `exercise_${exercise.key ?? index}`,
    title: exercise.title ?? exercise.titleEn ?? "تمرين",
    timeFrom: "",
    timeTo: "",
    emoji: exercise.emoji ?? "🏋️",
    color: exercise.color ?? "#7C5CBF",
    bg: exercise.bg ?? "#EDE6F8",
    date: afterTaskDate,
    effortScore: 1,
    isExercise: true,
    breakDescription: exercise.desc ?? exercise.descEn ?? "",
  };
}

// ─── Inject exercises between tasks ──────────────────────
// الترتيب: core tasks (مرتبة بالوقت) → [تمرين] → extra tasks → [تمرين]
function buildPlanList(
  coreTasks: PlanTask[],
  extraTasks: PlanTask[],
  coreExercises: any[],
): PlanTask[] {
  if (coreTasks.length === 0 && extraTasks.length === 0) return [];

  const result: PlanTask[] = [];
  let exerciseIdx = 0;

  // ── Core tasks أولاً مع تمرين بعد كل واحدة ──
  const sortedCore = sortTasksByTime(coreTasks);
  sortedCore.forEach((task) => {
    result.push(task);
    if (coreExercises.length > 0) {
      const ex = coreExercises[exerciseIdx % coreExercises.length];
      result.push(mapExerciseToTask(ex, exerciseIdx, task.date));
      exerciseIdx++;
    }
  });

  // ── Extra tasks بعدين مع تمرين بعد كل واحدة ──
  const sortedExtra = sortTasksByTime(extraTasks);
  sortedExtra.forEach((task) => {
    result.push(task);
    if (coreExercises.length > 0) {
      const ex = coreExercises[exerciseIdx % coreExercises.length];
      result.push(mapExerciseToTask(ex, exerciseIdx, task.date));
      exerciseIdx++;
    }
  });

  return result;
}

// ─── Storage key للمهام المنجزة ──────────────────────────
function getDoneStorageKey(date: Date) {
  return `plan_done_${toKey(date)}`;
}

async function loadDoneIds(date: Date): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(getDoneStorageKey(date));
  if (!raw) return new Set();
  return new Set(JSON.parse(raw));
}

async function saveDoneIds(date: Date, ids: Set<string>) {
  await AsyncStorage.setItem(getDoneStorageKey(date), JSON.stringify([...ids]));
}

const TODAY_KEY = toKey(new Date());

// ─── Done Badge Component ─────────────────────────────────
function DoneBadge({ status, onPress }: {
  status: CompletionStatus;
  onPress: () => void;
}) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  if (status === 'locked') {
    return (
      <View style={badge.lockWrap}>
        <Ionicons name="time-outline" size={14} color="#bbb" />
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View
        style={[
          badge.circle,
          status === 'done'    && badge.done,
          status === 'pending' && badge.pending,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {status === 'done' ? (
          <Ionicons name="checkmark" size={14} color="#fff" />
        ) : (
          <View style={badge.emptyInner} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const badge = StyleSheet.create({
  circle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  done: {
    backgroundColor: '#4CAF82',
    borderColor: '#4CAF82',
  },
  pending: {
    backgroundColor: 'transparent',
    borderColor: '#ccc',
  },
  emptyInner: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ddd',
  },
  lockWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
});

// ─── Calendar Picker ──────────────────────────────────────
function CalendarPicker({ visible, selected, onSelect, onClose }: {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const [viewing, setViewing] = useState(new Date(selected));

  useEffect(() => {
    if (visible) setViewing(new Date(selected));
  }, [visible]);

  const daysInMonth = new Date(viewing.getFullYear(), viewing.getMonth() + 1, 0).getDate();
  const startDay    = new Date(viewing.getFullYear(), viewing.getMonth(), 1).getDay();

  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const todayKey    = toKey(new Date());
  const selectedKey = toKey(selected);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={cal.overlay} activeOpacity={1} onPress={onClose}>
        <View style={cal.box}>
          <View style={cal.header}>
            <TouchableOpacity onPress={() => setViewing(new Date(viewing.getFullYear(), viewing.getMonth() - 1, 1))}>
              <Ionicons name="chevron-back" size={20} color="#7C5CBF" />
            </TouchableOpacity>
            <Text style={cal.monthTitle}>{MONTHS_AR[viewing.getMonth()]} {viewing.getFullYear()}</Text>
            <TouchableOpacity onPress={() => setViewing(new Date(viewing.getFullYear(), viewing.getMonth() + 1, 1))}>
              <Ionicons name="chevron-forward" size={20} color="#7C5CBF" />
            </TouchableOpacity>
          </View>

          <View style={cal.dayNames}>
            {['أح','اث','ث','أر','خ','ج','س'].map(d => (
              <Text key={d} style={cal.dayName}>{d}</Text>
            ))}
          </View>

          <View style={cal.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={cal.cell} />;
              const d          = new Date(viewing.getFullYear(), viewing.getMonth(), day);
              const dKey       = toKey(d);
              const isSelected = dKey === selectedKey;
              const isToday    = dKey === todayKey;
              return (
                <TouchableOpacity key={day} style={cal.cell} onPress={() => { onSelect(d); onClose(); }}>
                  <View style={[
                    cal.dayCircle,
                    isSelected && cal.selectedDay,
                    isToday && !isSelected && cal.todayDay,
                  ]}>
                    <Text style={[
                      cal.dayText,
                      isSelected && cal.selectedDayText,
                      isToday && !isSelected && cal.todayDayText,
                    ]}>
                      {day}
                    </Text>
                  </View>
                  {isToday && <View style={cal.todayDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Task Card ───────────────────────────────────────────
function TaskCard({ task, energy, isLast, status, onToggleDone, selectedDate }: {
  task: PlanTask;
  energy: number;
  isLast: boolean;
  status: CompletionStatus;
  onToggleDone: (id: string) => void;
  selectedDate: Date;
}) {
  const canDo      = canDoTask(energy, task.effortScore);
  const isExercise = !!task.isExercise;
  const isDone     = status === 'done';

  return (
    <View style={card.row}>
      {/* ── Timeline ── */}
      <View style={card.timelineCol}>
        <View style={[
          card.dot,
          { backgroundColor: isExercise ? '#4CAF82' : task.color },
          isDone && card.dotDone,
        ]} />
        {!isLast && <View style={[card.line, isDone && card.lineDone]} />}
      </View>

      {/* ── Card ── */}
      <View style={[
        card.box,
        { backgroundColor: isDone ? '#f0faf4' : task.bg },
        isExercise && !isDone && card.exerciseBox,
        isDone && card.boxDone,
      ]}>
        {/* Exercise label header */}
        {isExercise && (
          <View style={card.exerciseBadgeRow}>
            <View style={card.exerciseBadge}>
              <Ionicons name="fitness-outline" size={11} color="#4CAF82" />
              <Text style={card.exerciseBadgeText}>تمرين سريع</Text>
            </View>
          </View>
        )}

        <View style={card.cardTop}>
          {/* Emoji */}
          <View style={[
            card.emojiWrap,
            { backgroundColor: isDone ? '#d4f0e1' : isExercise ? '#d4f0e1' : task.color + '22' },
          ]}>
            <Text style={[{ fontSize: 22 }, isDone && { opacity: 0.7 }]}>{task.emoji}</Text>
          </View>

          {/* Title & Time */}
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={[
              card.title,
              { color: isDone ? '#4CAF82' : isExercise ? '#4CAF82' : task.color },
              isDone && card.titleDone,
            ]}>
              {task.title}
              {isDone && ' ✓'}
            </Text>
            {task.timeFrom ? (
              <Text style={[card.time, isDone && { color: '#4CAF82', opacity: 0.7 }]}>
                {task.timeFrom}{task.timeTo ? ` - ${task.timeTo}` : ''}
              </Text>
            ) : isExercise && task.breakDescription ? (
              <Text style={[card.time, isDone && { color: '#4CAF82', opacity: 0.7 }]}>
                {task.breakDescription}
              </Text>
            ) : null}

            {/* Task type badge */}
            {!isExercise && task.taskType && (
              <View style={[card.typePill, { backgroundColor: task.taskType === 'core' ? '#7C5CBF18' : '#F4A32B18' }]}>
                <Text style={[card.typePillText, { color: task.taskType === 'core' ? '#7C5CBF' : '#C97B3A' }]}>
                  {task.taskType === 'core' ? '⭐ أساسي' : '⚡ إضافي'}
                </Text>
              </View>
            )}

            {status === 'locked' && (
              <Text style={card.lockedLabel}>⏳ لسه وقته ماجاش</Text>
            )}
            {status === 'done' && (
              <Text style={card.doneLabel}>✅ تم الإنجاز</Text>
            )}
          </View>

          <DoneBadge
            status={status}
            onPress={() => onToggleDone(task.id)}
          />
        </View>

        {!isExercise && !canDo && !isDone && (
          <Text style={card.warning}>طاقتك قد لا تكفي لهذه المهمة</Text>
        )}
      </View>
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────
function ProgressBar({ total, done }: { total: number; done: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  const color = pct === 100 ? '#4CAF82' : pct >= 50 ? '#F4A32B' : '#7C5CBF';

  return (
    <View style={prog.wrap}>
      <View style={prog.labelRow}>
        <Text style={[prog.pct, { color }]}>{pct}%</Text>
        <Text style={prog.label}>{done} / {total} مكتملة</Text>
      </View>
      <View style={prog.barBg}>
        <Animated.View style={[prog.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      {pct === 100 && (
        <Text style={prog.congrats}>🎉 أنهيت كل مهام اليوم! عظيم!</Text>
      )}
    </View>
  );
}

const prog = StyleSheet.create({
  wrap:      { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, shadowColor: '#7C5CBF', shadowOffset: { width:0,height:2 }, shadowOpacity:0.07, shadowRadius:6, elevation:2 },
  labelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pct:       { fontSize: 18, fontWeight: '900' },
  label:     { fontSize: 12, color: '#888' },
  barBg:     { height: 8, backgroundColor: '#f0ebfa', borderRadius: 4, overflow: 'hidden' },
  barFill:   { height: 8, borderRadius: 4 },
  congrats:  { fontSize: 13, color: '#4CAF82', fontWeight: '700', textAlign: 'center', marginTop: 8 },
});

// ─── Main Screen ─────────────────────────────────────────
export default function PlanScreen() {
  const navigation = useNavigation();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCal, setShowCal]           = useState(false);
  const [coreTasks,   setCoreTasks]     = useState<PlanTask[]>([]);
  const [extraTasks,  setExtraTasks]    = useState<PlanTask[]>([]);
  const [coreExercises, setCoreExercises] = useState<any[]>([]);
  const [energy, setEnergy]             = useState(50);
  const [notifCount, setNotifCount]     = useState(0);
  const [doneIds, setDoneIds]           = useState<Set<string>>(new Set());

  // ── Notification watchers ──
const watchersStarted = useRef(false);

useEffect(() => {
  if (watchersStarted.current) return;
  watchersStarted.current = true;
  (async () => {
    await setupNotifications();
    startAllWatchers();
  })();
}, []);

  // ── Load data when screen focused ──
  useFocusEffect(useCallback(() => {
    loadAllData();
  }, []));

  async function loadAllData() {
    // طاقة المستخدم
    const storedEnergy = await AsyncStorage.getItem('energy_level');
    if (storedEnergy) setEnergy(Number(storedEnergy));

    // عدد الإشعارات
    const unread = await getUnreadCount();
    setNotifCount(unread);

    const today = toKey(new Date());

    // ── Core tasks ──
    const coreRaw = await AsyncStorage.getItem(CORE_TASKS_KEY);
    if (coreRaw) {
      const parsed = JSON.parse(coreRaw);
      setCoreTasks(parsed.map((t: any) => mapRawTask(t, today, 'core')));
    } else {
      setCoreTasks([]);
    }

    // ── Extra tasks (اليوم بس) ──
    const extraRaw = await AsyncStorage.getItem(EXTRA_TASKS_KEY);
    if (extraRaw) {
      const parsed = JSON.parse(extraRaw);
      const todayExtras = parsed.filter((t: any) => !t.date || t.date === today);
      setExtraTasks(todayExtras.map((t: any) => mapRawTask(t, today, 'extra')));
    } else {
      setExtraTasks([]);
    }

    // ── Core exercises ──
    const exRaw = await AsyncStorage.getItem(CORE_EXERCISES_KEY);
    if (exRaw) {
      setCoreExercises(JSON.parse(exRaw));
    } else {
      setCoreExercises([]);
    }
  }

  // ── Listen for data_changed_at (when tasks are added/deleted) ──
  useFocusEffect(useCallback(() => {
    let lastChanged = '';
    const checkChanges = async () => {
      const changed = await AsyncStorage.getItem('data_changed_at');
      if (changed && changed !== lastChanged) {
        lastChanged = changed;
        await loadAllData();
      }
    };
    const interval = setInterval(checkChanges, 2000);
    return () => clearInterval(interval);
  }, []));

  // ── Load doneIds when selectedDate changes ──
  useEffect(() => {
    (async () => {
      const ids = await loadDoneIds(selectedDate);
      setDoneIds(ids);
    })();
  }, [selectedDate]);

  // ── Auto-mark done from notification ──
  useFocusEffect(useCallback(() => {
    const checkNotifDone = async () => {
      const raw = await AsyncStorage.getItem('last_completed_task_id');
      if (!raw) return;
      await AsyncStorage.removeItem('last_completed_task_id');
      const taskId = raw.trim();
      if (!taskId) return;
      setDoneIds(prev => {
        const next = new Set(prev);
        next.add(taskId);
        saveDoneIds(selectedDate, next);
        return next;
      });
    };
    checkNotifDone();
    const interval = setInterval(checkNotifDone, 3000);
    return () => clearInterval(interval);
  }, [selectedDate]));

  // ─── Toggle Done ──────────────────────────────────────
  const handleToggleDone = async (taskId: string) => {
    const task = withExercises.find(t => t.id === taskId);
    if (!task) return;
    const status = getStatus(task);
    if (status === 'locked') return;

    setDoneIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      saveDoneIds(selectedDate, next);
      return next;
    });
  };

  // ─── Build plan list ──────────────────────────────────
  // فلتر المهام للتاريخ المحدد
  const selectedKey = toKey(selectedDate);
  
  // Core tasks: دايمًا تظهر (مفيهاش date محددة في الغالب)
  const dayCoreTasks = coreTasks.filter(t => !t.date || t.date === selectedKey || t.date === TODAY_KEY);
  
  // Extra tasks: تظهر بس لو نفس اليوم
  const dayExtraTasks = extraTasks.filter(t => t.date === selectedKey);

  const withExercises = buildPlanList(dayCoreTasks, dayExtraTasks, coreExercises);

  const totalEffort = [...dayCoreTasks, ...dayExtraTasks].reduce((s, t) => s + t.effortScore, 0);
  const maxEffort   = (dayCoreTasks.length + dayExtraTasks.length) * 3;
  const energyOk    = maxEffort === 0 || (totalEffort / maxEffort) * 100 <= energy;

  // عدد المهام المنجزة (بدون التمارين)
  const realTasks = withExercises.filter(t => !t.isExercise);
  const doneCount = realTasks.filter(t => doneIds.has(t.id)).length;

  const badgeColor = notifCount > 0 ? '#4CAF82' : '#ccc';

  function getStatus(task: PlanTask): CompletionStatus {
    if (doneIds.has(task.id)) return 'done';
    if (!isTaskAvailable(task, selectedDate)) return 'locked';
    return 'pending';
  }

  const hasTasks = dayCoreTasks.length > 0 || dayExtraTasks.length > 0;

  return (
    <View style={s.safe}>
      <StatusBar backgroundColor="#f8f5ff" barStyle="dark-content" translucent={false} />

      {/* ── Navbar ── */}
      <View style={s.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.navIconBtn}>
          <Ionicons name="chevron-back" size={22} color="#7C5CBF" />
        </TouchableOpacity>

        <View style={s.navCenter}>
          <Text style={s.navTitle}>خطتي اليوم</Text>
        </View>

        <View style={s.navRight}>
          <TouchableOpacity onPress={() => router.push("/tabs/notification")} style={s.navIconBtn}>
            <Ionicons name="notifications-outline" size={22} color="#7C5CBF" />
            {notifCount > 0 && (
              <View style={[s.notifBadge, { backgroundColor: badgeColor }]} />
            )}
          </TouchableOpacity>

          <View style={s.calBtnWrapper}>
            <TouchableOpacity onPress={() => setShowCal(true)} style={s.navIconBtn}>
              <Ionicons name="calendar-outline" size={22} color="#7C5CBF" />
            </TouchableOpacity>
            <View style={s.calDot} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Date pill */}
        <View style={s.datePill}>
          <Text style={s.dateText}>{formatDateAr(selectedDate)}</Text>
        </View>

        {/* Placeholder card */}
        <View style={s.placeholderCard}>
          <Text style={s.placeholderEmoji}>🌿</Text>
          <Text style={s.placeholderText}>
            تم تنظيم يومك بناءً{"\n"}على طاقتك البالغة {energy}%
          </Text>
        </View>

        {/* ✅ Progress bar */}
        {hasTasks && (
          <ProgressBar total={realTasks.length} done={doneCount} />
        )}

        {/* Tasks summary pills */}
        {hasTasks && (
          <View style={s.summaryRow}>
            <View style={s.summaryPill}>
              <Text style={s.summaryEmoji}>⭐</Text>
              <Text style={s.summaryText}>{dayCoreTasks.length} أساسي</Text>
            </View>
            {dayExtraTasks.length > 0 && (
              <View style={[s.summaryPill, { backgroundColor: '#FEF3E2' }]}>
                <Text style={s.summaryEmoji}>⚡</Text>
                <Text style={[s.summaryText, { color: '#C97B3A' }]}>{dayExtraTasks.length} إضافي</Text>
              </View>
            )}
            {coreExercises.length > 0 && (
              <View style={[s.summaryPill, { backgroundColor: '#E8F5EF' }]}>
                <Text style={s.summaryEmoji}>🏋️</Text>
                <Text style={[s.summaryText, { color: '#4CAF82' }]}>{dayCoreTasks.length + dayExtraTasks.length} تمرين</Text>
              </View>
            )}
          </View>
        )}

        {/* Energy summary */}
        <View style={s.energySummary}>
          <View style={[s.energyBar, { backgroundColor: energyOk ? "#E8F5EF" : "#FDEAEA" }]}>
            <Text style={{ fontSize: 16 }}>{energyOk ? "⚡" : "⚠️"}</Text>
            <Text style={[s.energyText, { color: energyOk ? "#4CAF82" : "#E05C5C" }]}>
              {energyOk
                ? `طاقتك كافية لمهام اليوم (${energy}%)`
                : `طاقتك (${energy}%) قد لا تكفي لكل المهام`}
            </Text>
          </View>
        </View>

        {/* Legend */}
        {hasTasks && (
          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#4CAF82' }]} />
              <Text style={s.legendText}>منجز</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#ddd' }]} />
              <Text style={s.legendText}>لم يتم بعد</Text>
            </View>
            <View style={s.legendItem}>
              <Ionicons name="time-outline" size={12} color="#bbb" />
              <Text style={s.legendText}>لسه وقته ماجاش</Text>
            </View>
            <View style={s.legendItem}>
              <Ionicons name="fitness-outline" size={12} color="#4CAF82" />
              <Text style={s.legendText}>تمرين</Text>
            </View>
          </View>
        )}

        {/* Empty state when no tasks exist in tasks screen */}
        {!hasTasks ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>📭</Text>
            <Text style={s.emptyText}>لا توجد مهام في هذا اليوم</Text>
            <TouchableOpacity
              style={s.goToTasksBtn}
              onPress={() => router.push('/tabs/tasks')}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color="#7C5CBF" />
              <Text style={s.goToTasksText}>أضف مهام من صفحة المهام</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.timeline}>
            {withExercises.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                energy={energy}
                isLast={index === withExercises.length - 1}
                status={getStatus(task)}
                onToggleDone={handleToggleDone}
                selectedDate={selectedDate}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <CalendarPicker
        visible={showCal}
        selected={selectedDate}
        onSelect={setSelectedDate}
        onClose={() => setShowCal(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8f5ff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 8,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f5ff',
  },
  navIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle:  { fontSize: 18, fontWeight: '700', color: '#2d2d2d' },
  navRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1.5, borderColor: '#fff',
  },
  calBtnWrapper: { position: 'relative', alignItems: 'center' },
  calDot: {
    position: 'absolute', bottom: -5,
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#7C5CBF',
  },
  scroll:           { padding: 20, paddingBottom: 100 },
  datePill:         { alignSelf: 'center', backgroundColor: '#EDE6F8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 16 },
  dateText:         { fontSize: 13, color: '#7C5CBF', fontWeight: '600' },
  placeholderCard:  { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 14, alignItems: 'center', minHeight: 100, justifyContent: 'center', shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2, flexDirection: 'row', gap: 12 },
  placeholderEmoji: { fontSize: 40 },
  placeholderText:  { fontSize: 15, color: '#5a3fa0', fontWeight: '600', textAlign: 'right', lineHeight: 24 },

  summaryRow:   { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  summaryPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0EBFA', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  summaryEmoji: { fontSize: 13 },
  summaryText:  { fontSize: 12, fontWeight: '700', color: '#7C5CBF' },

  energySummary:    { marginBottom: 14 },
  energyBar:        { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  energyText:       { fontSize: 13, fontWeight: '600' },
  timeline:         {},
  emptyState:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:        { fontSize: 15, color: '#aaa' },
  goToTasksBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0EBFA', borderRadius: 14, borderWidth: 1.5, borderColor: '#7C5CBF',
    paddingHorizontal: 18, paddingVertical: 10, marginTop: 8,
  },
  goToTasksText: { fontSize: 14, fontWeight: '700', color: '#7C5CBF' },

  legend: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginBottom: 14, paddingHorizontal: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#888' },
});

const card = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'stretch' },
  timelineCol: { width: 24, alignItems: 'center', paddingTop: 18 },
  dot:         { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  dotDone:     { backgroundColor: '#4CAF82' },
  line:        { flex: 1, width: 1.5, backgroundColor: '#e0d6f5', marginTop: 4 },
  lineDone:    { backgroundColor: '#b8e6c9' },
  box:         {
    flex: 1, borderRadius: 16, padding: 12,
    marginBottom: 12, marginLeft: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  boxDone:     {
    borderWidth: 1.5, borderColor: '#b8e6c9',
    shadowOpacity: 0, elevation: 0,
  },
  exerciseBox: {
    borderWidth: 1.5, borderColor: '#b8e6c9',
    borderStyle: 'dashed', shadowOpacity: 0, elevation: 0,
    backgroundColor: '#f0faf4',
  },
  exerciseBadgeRow: { marginBottom: 4 },
  exerciseBadge:    {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: '#4CAF8218', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  exerciseBadgeText: { fontSize: 10, fontWeight: '700', color: '#4CAF82' },
  cardTop:     { flexDirection: 'row', alignItems: 'center' },
  emojiWrap:   { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 14, fontWeight: '700' },
  titleDone:   { textDecorationLine: 'line-through', opacity: 0.7 },
  time:        { fontSize: 12, color: '#888', marginTop: 2 },
  typePill:    { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  typePillText:{ fontSize: 10, fontWeight: '700' },
  doneLabel:   { fontSize: 11, color: '#4CAF82', fontWeight: '700', marginTop: 3 },
  lockedLabel: { fontSize: 11, color: '#bbb', marginTop: 3 },
  warning:     { fontSize: 11, color: '#E05C5C', marginTop: 6, textAlign: 'right' },
});

const cal = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  box:             { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: 320, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthTitle:      { fontSize: 16, fontWeight: '700', color: '#7C5CBF' },
  dayNames:        { flexDirection: 'row', marginBottom: 8 },
  dayName:         { flex: 1, textAlign: 'center', fontSize: 11, color: '#7C5CBF', fontWeight: '600' },
  grid:            { flexDirection: 'row', flexWrap: 'wrap' },
  cell:            { width: `${100 / 7}%`, alignItems: 'center', marginBottom: 4 },
  dayCircle:       { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  selectedDay:     { backgroundColor: '#7C5CBF' },
  todayDay:        { borderWidth: 1.5, borderColor: '#7C5CBF' },
  dayText:         { fontSize: 14, color: '#333' },
  selectedDayText: { color: '#fff', fontWeight: '700' },
  todayDayText:    { color: '#7C5CBF', fontWeight: '700' },
  todayDot:        { width: 4, height: 4, borderRadius: 2, backgroundColor: '#7C5CBF', marginTop: 2 },
});