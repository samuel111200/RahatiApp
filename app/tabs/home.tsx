import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Platform, StatusBar, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from "expo-router";
import {
  setupNotifications,
  startAllWatchers,
  areWatchersRunning,
  sendPushNotification,
} from './notificationService';
import MedicationNote from '../../components/Medicationnote';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/Languagecontext';
import { db } from '../../utils/firebaseConfig';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';

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
  isExercise?: boolean;
  breakDescription?: string;
  taskType?: 'core' | 'extra';
}

type CompletionStatus = 'done' | 'pending' | 'locked';

// ─── Exercise Storage Keys (نفس الـ keys في exercises.tsx) ──
const THERAPY_KEY      = 'therapy_exercises';
const YOGA_KEY         = 'yoga_exercises';
const AEROBIC_KEY      = 'aerobic_exercises';
const ENDURANCE_KEY    = 'endurance_exercises';
const STRENGTH_KEY     = 'strength_exercises';
const COORDINATION_KEY = 'coordination_exercises';

async function loadLocalExercises(): Promise<any[]> {
  try {
    const [therapy, yoga, aerobic, endurance, strength, coordination] = await Promise.all([
      AsyncStorage.getItem(THERAPY_KEY),
      AsyncStorage.getItem(YOGA_KEY),
      AsyncStorage.getItem(AEROBIC_KEY),
      AsyncStorage.getItem(ENDURANCE_KEY),
      AsyncStorage.getItem(STRENGTH_KEY),
      AsyncStorage.getItem(COORDINATION_KEY),
    ]);
    return [
      ...(therapy      ? JSON.parse(therapy)      : []),
      ...(yoga         ? JSON.parse(yoga)          : []),
      ...(aerobic      ? JSON.parse(aerobic)       : []),
      ...(endurance    ? JSON.parse(endurance)     : []),
      ...(strength     ? JSON.parse(strength)      : []),
      ...(coordination ? JSON.parse(coordination)  : []),
    ];
  } catch {
    return [];
  }
}

function formatDate(date: Date, t: any, isRTL: boolean) {
  const day   = (t.calFullDays as string[])[date.getDay()];
  const month = (t.calMonths   as string[])[date.getMonth()];
  return isRTL
    ? `${day}، ${date.getDate()} ${month}`
    : `${day}, ${month} ${date.getDate()}`;
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

function mapRawTask(raw: any, fallbackDate: string, type: 'core' | 'extra'): PlanTask {
  const timeParts = (raw.time ?? '').split(' - ');

  const catBgMap: Record<string, { color: string; bg: string }> = {
    work:  { color: '#5B9BD5', bg: '#E8F1FB' },
    study: { color: '#4CAF82', bg: '#E8F5EF' },
    home:  { color: '#C97B3A', bg: '#FEF3E2' },
  };
  const catStyle = catBgMap[raw.cat] ?? { color: '#7C5CBF', bg: '#F0EBFA' };

  return {
    id:          raw.key   ?? raw.id   ?? String(Date.now()),
    title:       raw.name  ?? raw.title ?? raw.key ?? 'مهمة',
    timeFrom:    raw.timeFrom ?? timeParts[0] ?? '',
    timeTo:      raw.timeTo   ?? timeParts[1] ?? '',
    emoji:       raw.icon  ?? raw.emoji ?? '📌',
    color:       raw.color ?? catStyle.color,
    bg:          raw.bg    ?? catStyle.bg,
    date:        raw.date  ?? fallbackDate,
    effortScore: raw.effortScore ?? CAT_TO_EFFORT[raw.cat] ?? 2,
    taskType:    type,
  };
}

function mapExerciseToTask(exercise: any, index: number, afterTaskDate: string): PlanTask {
  return {
    id: `exercise_${exercise.key ?? exercise.id ?? index}`,
    title: exercise.title ?? exercise.titleEn ?? "تمرين",
    timeFrom: "",
    timeTo: "",
    emoji: exercise.emoji ?? "🏋️",
    color: exercise.color ?? "#4CAF82",
    bg: exercise.bg ?? "#EDE6F8",
    date: afterTaskDate,
    effortScore: 1,
    isExercise: true,
    breakDescription: exercise.desc ?? exercise.descEn ?? exercise.description ?? "",
  };
}


function buildPlanList(
  coreTasks: PlanTask[],
  extraTasks: PlanTask[],
  exercises: any[],
): PlanTask[] {
  const allTasks = [
    ...sortTasksByTime(coreTasks),
    ...sortTasksByTime(extraTasks),
  ];
  if (allTasks.length === 0) return [];

  // لو مفيش exercises خالص، متضيفش تمارين بين المهام
  if (exercises.length === 0) return allTasks;
  const exercisePool = exercises;

  const result: PlanTask[] = [];
  allTasks.forEach((task, index) => {
    result.push(task);
    if (index < allTasks.length - 1) {
      const ex = exercisePool[index % exercisePool.length];
      result.push(mapExerciseToTask(ex, index, task.date));
    }
  });
  return result;
}

function getDoneStorageKey(date: Date) {
  return `plan_done_${toKey(date)}`;
}

async function loadDoneIds(date: Date, uid: string | null): Promise<Set<string>> {
  const dateKey = toKey(date);
  if (uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'planHistory', dateKey));
      if (snap.exists()) {
        const ids = snap.data().doneIds as string[] | undefined;
        return new Set(ids ?? []);
      }
    } catch {}
  }
  const raw = await AsyncStorage.getItem(getDoneStorageKey(date));
  return raw ? new Set(JSON.parse(raw)) : new Set();
}

async function saveDoneIds(date: Date, ids: Set<string>, uid: string | null) {
  const arr = [...ids];
  await AsyncStorage.setItem(getDoneStorageKey(date), JSON.stringify(arr));
  if (uid) {
    setDoc(doc(db, 'users', uid, 'planHistory', toKey(date)), { doneIds: arr }, { merge: true }).catch(() => {});
  }
}

function getTodayKey() { return toKey(new Date()); }

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

function CalendarPicker({ visible, selected, onSelect, onClose, minDateKey, t, isRTL }: {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
  minDateKey: string;
  t: any;
  isRTL: boolean;
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

  const todayKey    = getTodayKey();
  const selectedKey = toKey(selected);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={cal.overlay} activeOpacity={1} onPress={onClose}>
        <View style={cal.box}>
          <View style={cal.header}>
            <TouchableOpacity onPress={() => setViewing(new Date(viewing.getFullYear(), viewing.getMonth() - 1, 1))}>
              <Ionicons name="chevron-back" size={20} color="#7C5CBF" />
            </TouchableOpacity>
            <Text style={cal.monthTitle}>{(t.calMonths as string[])[viewing.getMonth()]} {viewing.getFullYear()}</Text>
            <TouchableOpacity onPress={() => setViewing(new Date(viewing.getFullYear(), viewing.getMonth() + 1, 1))}>
              <Ionicons name="chevron-forward" size={20} color="#7C5CBF" />
            </TouchableOpacity>
          </View>

          <View style={cal.dayNames}>
            {(t.calDays as string[]).map((d: string) => (
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
              const isBlocked  = dKey < minDateKey;
              const isYesterday = dKey === minDateKey && dKey < todayKey;
              return (
                <TouchableOpacity
                  key={day}
                  style={cal.cell}
                  onPress={() => { if (!isBlocked) { onSelect(d); onClose(); } }}
                  activeOpacity={isBlocked ? 1 : 0.7}
                  disabled={isBlocked}
                >
                  <View style={[
                    cal.dayCircle,
                    isSelected && cal.selectedDay,
                    isToday && !isSelected && cal.todayDay,
                    isBlocked && cal.blockedDay,
                    isYesterday && !isSelected && cal.yesterdayDay,
                  ]}>
                    <Text style={[
                      cal.dayText,
                      isSelected && cal.selectedDayText,
                      isToday && !isSelected && cal.todayDayText,
                      isBlocked && cal.blockedDayText,
                    ]}>
                      {day}
                    </Text>
                  </View>
                  {isToday && <View style={cal.todayDot} />}
                  {isYesterday && !isSelected && <View style={[cal.todayDot, { backgroundColor: '#aaa' }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={cal.legend}>
            <View style={cal.legendItem}>
              <View style={[cal.legendDot, { backgroundColor: '#7C5CBF' }]} />
              <Text style={cal.legendText}>{t.today}</Text>
            </View>
            <View style={cal.legendItem}>
              <View style={[cal.legendDot, { backgroundColor: '#bbb' }]} />
              <Text style={cal.legendText}>{t.yesterday}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function TaskCard({ task, energy, isLast, status, onToggleDone, selectedDate, t }: {
  task: PlanTask;
  energy: number;
  isLast: boolean;
  status: CompletionStatus;
  onToggleDone: (id: string) => void;
  selectedDate: Date;
  t: any;
}) {
  const canDo      = canDoTask(energy, task.effortScore);
  const isExercise = !!task.isExercise;
  const isDone     = status === 'done';

  return (
    <View style={card.row}>
      <View style={card.timelineCol}>
        <View style={[
          card.dot,
          { backgroundColor: isExercise ? '#4CAF82' : task.color },
          isDone && card.dotDone,
        ]} />
        {!isLast && <View style={[card.line, isDone && card.lineDone]} />}
      </View>

      <View style={[
        card.box,
        { backgroundColor: task.bg },
        isDone && card.boxDone,
        isExercise && card.exerciseBox,
      ]}>
        {isExercise && (
          <View style={card.exerciseBadgeRow}>
            <View style={card.exerciseBadge}>
              <Ionicons name="fitness-outline" size={11} color="#4CAF82" />
              <Text style={card.exerciseBadgeText}>{t.quickExerciseBadge}</Text>
            </View>
          </View>
        )}

        <View style={card.cardTop}>
          <View style={[
            card.emojiWrap,
            { backgroundColor: isDone ? '#d4f0e1' : isExercise ? '#d4f0e1' : task.color + '22' },
          ]}>
            <Text style={[{ fontSize: 22 }, isDone && { opacity: 0.7 }]}>{task.emoji}</Text>
          </View>

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

            {!isExercise && task.taskType && (
              <View style={[card.typePill, { backgroundColor: task.taskType === 'core' ? '#7C5CBF18' : '#F4A32B18' }]}>
                <Text style={[card.typePillText, { color: task.taskType === 'core' ? '#7C5CBF' : '#C97B3A' }]}>
                  {task.taskType === 'core' ? t.basicTask : t.extraTaskBadge}
                </Text>
              </View>
            )}

            {status === 'locked' && (
              <Text style={card.lockedLabel}>{t.lockedLabel}</Text>
            )}
            {status === 'done' && (
              <Text style={card.doneLabel}>{t.doneLabel}</Text>
            )}
          </View>

          <DoneBadge
            status={status}
            onPress={() => onToggleDone(task.id)}
          />
        </View>

        {!isExercise && !canDo && !isDone && (
          <Text style={card.warning}>{t.energyWarning}</Text>
        )}
      </View>
    </View>
  );
}

function ProgressBar({ total, done, t }: { total: number; done: number; t: any }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  const color = pct === 100 ? '#4CAF82' : pct >= 50 ? '#F4A32B' : '#7C5CBF';

  return (
    <View style={prog.wrap}>
      <View style={prog.labelRow}>
        <Text style={[prog.pct, { color }]}>{pct}%</Text>
        <Text style={prog.label}>{done} / {total} {t.completedCount}</Text>
      </View>
      <View style={prog.barBg}>
        <Animated.View style={[prog.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      {pct === 100 && (
        <Text style={prog.congrats}>{t.allDone}</Text>
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

export default function PlanScreen() {
  const { user } = useAuth();
  const { t, isRTL } = useLang();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCal, setShowCal]           = useState(false);
  const [coreTasks,   setCoreTasks]     = useState<PlanTask[]>([]);
  const [extraTasks,  setExtraTasks]    = useState<PlanTask[]>([]);
  const [doctorExercises, setDoctorExercises] = useState<any[]>([]);
  const [localExercises,  setLocalExercises]  = useState<any[]>([]);
  const [energy, setEnergy]             = useState(50);
  const [doneIds, setDoneIds]           = useState<Set<string>>(new Set());

  const watchersStarted = useRef(false);

  useEffect(() => {
    if (watchersStarted.current) return;
    watchersStarted.current = true;
    (async () => {
      await setupNotifications();
      startAllWatchers();
    })();
  }, []);

  // Tasks — real-time from Firestore
  useEffect(() => {
    if (!user?.uid) { setCoreTasks([]); setExtraTasks([]); return; }
    const unsub = onSnapshot(collection(db, 'tasks', user.uid, 'items'), (snap) => {
      const today = toKey(new Date());
      const all   = snap.docs.map(d => d.data() as any);
      setCoreTasks(all.filter(t => t.type === 'core').map((t: any) => mapRawTask(t, today, 'core')));
      setExtraTasks(all.filter(t => t.type === 'extra' && (!t.date || t.date === today)).map((t: any) => mapRawTask(t, today, 'extra')));
    });
    return unsub;
  }, [user?.uid]);

  // Doctor exercises — real-time from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(collection(db, 'exercises', user.uid, 'items'), (snap) => {
      setDoctorExercises(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    return unsub;
  }, [user?.uid]);

  // Energy + local exercises — load on focus
  useFocusEffect(useCallback(() => {
    loadAllData();
    loadLocalExercises().then(setLocalExercises);
  }, [user?.uid]));

  async function loadAllData() {
    if (user?.uid) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const fsEnergy = snap.exists() ? snap.data().energyLevel : undefined;
        if (fsEnergy != null) {
          setEnergy(Number(fsEnergy));
        } else {
          const stored = await AsyncStorage.getItem(`energy_level_${user.uid}`);
          if (stored) setEnergy(Number(stored));
        }
      } catch {
        const stored = await AsyncStorage.getItem(`energy_level_${user.uid}`);
        if (stored) setEnergy(Number(stored));
      }
    } else {
      const storedEnergy = await AsyncStorage.getItem('energy_level');
      if (storedEnergy) setEnergy(Number(storedEnergy));
    }
  }

  useEffect(() => {
    (async () => {
      const ids = await loadDoneIds(selectedDate, user?.uid ?? null);
      setDoneIds(ids);
    })();
  }, [selectedDate, user?.uid]);

  // ✅ تم حذف useFocusEffect الخاص بـ checkNotifDone —
  // الـ completionWatcher في notificationService هو المسؤول الوحيد
  // عن إشعارات الإتمام، ومحتاجش نبعتها من هنا تاني

  const todayKey    = getTodayKey();
  const selectedKey = toKey(selectedDate);
  const yesterday   = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toKey(d); })();
  const isPastDay   = selectedKey < todayKey;
  const isFutureDay = selectedKey > todayKey;
  const isToday     = selectedKey === todayKey;

  const dayCoreTasks  = coreTasks.filter(t => !t.date || t.date === selectedKey);
  const dayExtraTasks = extraTasks.filter(t => t.date === selectedKey);

  // لو في doctor exercises استخدمها، غير كده استخدم التمارين المحفوظة محلياً
  const exercisePool = doctorExercises.length > 0 ? doctorExercises : localExercises;
  const withExercises = buildPlanList(dayCoreTasks, dayExtraTasks, exercisePool);

  const handleToggleDone = async (taskId: string) => {
    if (isPastDay || isFutureDay) return;
    const task = withExercises.find(tk => tk.id === taskId);
    if (!task) return;
    const status = getStatus(task);
    if (status === 'locked') return;

    setDoneIds(prev => {
      const isCompleting = !prev.has(taskId);
      const next = new Set(prev);
      if (isCompleting) {
        next.add(taskId);
        sendPushNotification(
          t.taskDoneNotifTitle,
          task.title,
          'completion',
        ).catch(() => {});
      } else {
        next.delete(taskId);
      }
      // ✅ saveDoneIds هنا بس — الـ completionWatcher هيشوف التغيير ويبعت الإشعار
      saveDoneIds(selectedDate, next, user?.uid ?? null);
      return next;
    });
  };

  const totalEffort = [...dayCoreTasks, ...dayExtraTasks].reduce((s, t) => s + t.effortScore, 0);
  const maxEffort   = (dayCoreTasks.length + dayExtraTasks.length) * 3;
  const energyOk    = maxEffort === 0 || (totalEffort / maxEffort) * 100 <= energy;

  const realTasks = withExercises.filter(t => !t.isExercise);
  const doneCount = realTasks.filter(t => doneIds.has(t.id)).length;

  function getStatus(task: PlanTask): CompletionStatus {
    if (doneIds.has(task.id)) return 'done';
    if (isFutureDay) return 'pending';
    if (isPastDay) return 'pending';
    if (!isTaskAvailable(task, selectedDate)) return 'locked';
    return 'pending';
  }

  const hasTasks = dayCoreTasks.length > 0 || dayExtraTasks.length > 0;

  return (
    <View style={s.safe}>
      <StatusBar backgroundColor="#f8f5ff" barStyle="dark-content" translucent={false} />

      <View style={s.navbar}>
        <TouchableOpacity
          style={[s.navIconBtn, { opacity: isToday ? 0.3 : 1 }]}
          onPress={() => setSelectedDate(new Date())}
          disabled={isToday}
        >
          <Ionicons name="today-outline" size={20} color="#7C5CBF" />
        </TouchableOpacity>
        <Text style={s.navTitle}>
          {isToday ? t.planToday : selectedKey === yesterday ? t.yesterday : formatDate(selectedDate, t, isRTL)}
        </Text>
        <View style={s.calBtnWrapper}>
          <TouchableOpacity onPress={() => setShowCal(true)} style={s.navIconBtn}>
            <Ionicons name="calendar-outline" size={22} color="#7C5CBF" />
          </TouchableOpacity>
          <View style={s.calDot} />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.datePill}>
          <Text style={s.dateText}>{formatDate(selectedDate, t, isRTL)}</Text>
        </View>

        {isPastDay && (
          <View style={s.modeBanner}>
            <Ionicons name="eye-outline" size={15} color="#888" />
            <Text style={s.modeBannerText}>{t.pastDayViewMode}</Text>
          </View>
        )}

        {isFutureDay && (
          <View style={s.modeBanner}>
            <Ionicons name="calendar-outline" size={15} color="#7C5CBF" />
            <Text style={[s.modeBannerText, { color: '#7C5CBF' }]}>{t.futureDayPlanMode}</Text>
          </View>
        )}

        <View style={s.placeholderCard}>
          <Text style={s.placeholderEmoji}>🌿</Text>
          <Text style={s.placeholderText}>
            {t.organizedByEnergy} {energy}%
          </Text>
        </View>

        {hasTasks && (
          <ProgressBar total={realTasks.length} done={doneCount} t={t} />
        )}

        {hasTasks && (
          <View style={s.summaryRow}>
            <View style={s.summaryPill}>
              <Text style={s.summaryEmoji}>⭐</Text>
              <Text style={s.summaryText}>{dayCoreTasks.length} {t.coreTasksCount}</Text>
            </View>
            {dayExtraTasks.length > 0 && (
              <View style={[s.summaryPill, { backgroundColor: '#FEF3E2' }]}>
                <Text style={s.summaryEmoji}>⚡</Text>
                <Text style={[s.summaryText, { color: '#C97B3A' }]}>{dayExtraTasks.length} {t.extraTasksCount}</Text>
              </View>
            )}
            {exercisePool.length > 0 && (
              <View style={[s.summaryPill, { backgroundColor: '#E8F5EF' }]}>
                <Text style={s.summaryEmoji}>🏋️</Text>
                <Text style={[s.summaryText, { color: '#4CAF82' }]}>{dayCoreTasks.length + dayExtraTasks.length} {t.exercisesCount}</Text>
              </View>
            )}
          </View>
        )}

        <View style={s.energySummary}>
          <View style={[s.energyBar, { backgroundColor: energyOk ? "#E8F5EF" : "#FDEAEA" }]}>
            <Text style={{ fontSize: 16 }}>{energyOk ? "⚡" : "⚠️"}</Text>
            <Text style={[s.energyText, { color: energyOk ? "#4CAF82" : "#E05C5C" }]}>
              {energyOk
                ? `${t.energySufficient} (${energy}%)`
                : `${t.energyInsufficient} (${energy}%)`}
            </Text>
          </View>
        </View>

        {hasTasks && (
          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#4CAF82' }]} />
              <Text style={s.legendText}>{t.done}</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#ddd' }]} />
              <Text style={s.legendText}>{t.notDoneYet}</Text>
            </View>
            <View style={s.legendItem}>
              <Ionicons name="time-outline" size={12} color="#bbb" />
              <Text style={s.legendText}>{t.notTimeYet}</Text>
            </View>
            <View style={s.legendItem}>
              <Ionicons name="fitness-outline" size={12} color="#4CAF82" />
              <Text style={s.legendText}>{t.exercise}</Text>
            </View>
          </View>
        )}

        {!hasTasks ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>{isPastDay ? '📋' : '📭'}</Text>
            <Text style={s.emptyText}>
              {isPastDay ? t.noTasksPastDay : t.noTasksToday}
            </Text>
            {!isPastDay && (
              <TouchableOpacity
                style={s.goToTasksBtn}
                onPress={() => router.push('/tabs/tasks')}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color="#7C5CBF" />
                <Text style={s.goToTasksText}>
                  {isFutureDay ? t.planForDay : t.addTasksFromTasksPage}
                </Text>
              </TouchableOpacity>
            )}
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
                t={t}
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
        minDateKey={yesterday}
        t={t}
        isRTL={isRTL}
      />
      <MedicationNote />
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8f5ff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 8,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  navTitle: { fontSize: 18, fontWeight: '700', color: '#2d2d2d' },
  navRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  modeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#f5f5f5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9, marginBottom: 14,
    borderWidth: 1, borderColor: '#e8e8e8',
  },
  modeBannerText: { fontSize: 13, color: '#888', fontWeight: '500' },
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
  boxDone: {
    borderWidth: 1.5, borderColor: '#b8e6c9',
    shadowOpacity: 0, elevation: 0,
  },
  exerciseBox: {
    borderWidth: 1.5, borderColor: '#b8e6c9',
    borderStyle: 'dashed', shadowOpacity: 0, elevation: 0,
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
  blockedDay:      { opacity: 0.2 },
  blockedDayText:  { color: '#999' },
  yesterdayDay:    { borderWidth: 1.5, borderColor: '#bbb' },
  legend:          { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0ebfa' },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:       { width: 8, height: 8, borderRadius: 4 },
  legendText:      { fontSize: 11, color: '#888' },
});