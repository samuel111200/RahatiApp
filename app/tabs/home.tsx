import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Platform, StatusBar, Animated, Alert,
  TextInput, KeyboardAvoidingView, Keyboard,
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
  notify,
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

// ─── Exercise Storage Keys ──
const THERAPY_KEY      = 'therapy_exercises';
const YOGA_KEY         = 'yoga_exercises';
const AEROBIC_KEY      = 'aerobic_exercises';
const ENDURANCE_KEY    = 'endurance_exercises';
const STRENGTH_KEY     = 'strength_exercises';
const COORDINATION_KEY = 'coordination_exercises';

async function loadLocalExercises(uid: string): Promise<any[]> {
  const ek = (base: string) => `${uid}_${base}`;
  try {
    const [therapy, yoga, aerobic, endurance, strength, coordination] = await Promise.all([
      AsyncStorage.getItem(ek(THERAPY_KEY)),
      AsyncStorage.getItem(ek(YOGA_KEY)),
      AsyncStorage.getItem(ek(AEROBIC_KEY)),
      AsyncStorage.getItem(ek(ENDURANCE_KEY)),
      AsyncStorage.getItem(ek(STRENGTH_KEY)),
      AsyncStorage.getItem(ek(COORDINATION_KEY)),
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

// ─── Energy Check Logic ─────────────────────────────────────────────────────
// يحسب متوسط الجهد المطلوب للمهام الحقيقية (بدون تمارين)
// ويحوّله لنسبة مئوية ويقارنها بمستوى الطاقة
function calcEnergyState(realTasks: PlanTask[], energy: number): {
  state: 'zero' | 'ok' | 'low';
  avgEffortPct: number;
  tasksAboveEnergy: PlanTask[];
} {
  if (realTasks.length === 0) {
    return { state: 'zero', avgEffortPct: 0, tasksAboveEnergy: [] };
  }

  // متوسط الـ effortScore (1-3) → نسبة من 100
  // effortScore 1 → 33%, 2 → 66%, 3 → 100%
  const avgEffort = realTasks.reduce((s, t) => s + t.effortScore, 0) / realTasks.length;
  const avgEffortPct = Math.round((avgEffort / 3) * 100);

  // المهام اللي الطاقة الحالية مش كافية ليها
  const tasksAboveEnergy = realTasks.filter(t => !canDoTask(energy, t.effortScore));

  let state: 'zero' | 'ok' | 'low';
  if (avgEffortPct <= energy) {
    state = 'ok';
  } else {
    state = 'low';
  }

  return { state, avgEffortPct, tasksAboveEnergy };
}

function getDoneStorageKey(date: Date, uid?: string | null) {
  const base = `plan_done_${toKey(date)}`;
  return uid ? `${uid}_${base}` : base;
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
  const raw = await AsyncStorage.getItem(getDoneStorageKey(date, uid));
  return raw ? new Set(JSON.parse(raw)) : new Set();
}

async function saveDoneIds(date: Date, ids: Set<string>, uid: string | null) {
  const arr = [...ids];
  await AsyncStorage.setItem(getDoneStorageKey(date, uid), JSON.stringify(arr));
  if (uid) {
    setDoc(doc(db, 'users', uid, 'planHistory', toKey(date)), { doneIds: arr }, { merge: true }).catch(() => {});
  }
}

function getTodayKey() { return toKey(new Date()); }

// ─── Add Task Helpers ────────────────────────────────────────────────────────
type Period = 'AM' | 'PM';

const CAT_COLORS: Record<string, { color: string; bg: string }> = {
  work:  { color: '#5B9BD5', bg: '#E8F1FB' },
  study: { color: '#4CAF82', bg: '#E8F5EF' },
  home:  { color: '#C97B3A', bg: '#FEF3E2' },
};

const CAT_OPTIONS = [
  { k: 'work',  labelAr: 'عمل',   labelEn: 'Work'  },
  { k: 'study', labelAr: 'دراسة', labelEn: 'Study' },
  { k: 'home',  labelAr: 'منزل',  labelEn: 'Home'  },
];

function to24h(display: string, period: Period): string {
  const [hStr, mStr] = display.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  if (isNaN(h)) return display;
  if (period === 'AM') { if (h === 12) h = 0; }
  else { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, '0')}:${m}`;
}

function AmPmToggle({ period, onChange, isRTL }: {
  period: Period; onChange: (p: Period) => void; isRTL: boolean;
}) {
  const options: { value: Period; label: string }[] = isRTL
    ? [{ value: 'AM', label: 'ص' }, { value: 'PM', label: 'م' }]
    : [{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }];
  return (
    <View style={ampmSt.wrap}>
      {options.map(opt => (
        <TouchableOpacity key={opt.value} onPress={() => onChange(opt.value)} activeOpacity={0.8}
          style={[ampmSt.btn, period === opt.value && ampmSt.btnActive]}>
          <Text style={[ampmSt.text, period === opt.value && ampmSt.textActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const ampmSt = StyleSheet.create({
  wrap:       { borderWidth: 1.5, borderColor: '#E0D6F5', borderRadius: 12, overflow: 'hidden', flexDirection: 'column' },
  btn:        { paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F5FF' },
  btnActive:  { backgroundColor: '#7C5CBF' },
  text:       { fontSize: 11, fontWeight: '800', color: '#7C5CBF' },
  textActive: { color: '#fff' },
});

function DoneBadge({ status }: { status: CompletionStatus }) {
  if (status === 'locked') {
    return (
      <View style={badge.lockWrap}>
        <Ionicons name="time-outline" size={14} color="#bbb" />
      </View>
    );
  }

  return (
    <View
      style={[
        badge.circle,
        status === 'done'    && badge.done,
        status === 'pending' && badge.pending,
      ]}
    >
      {status === 'done' ? (
        <Ionicons name="checkmark" size={14} color="#fff" />
      ) : (
        <View style={badge.emptyInner} />
      )}
    </View>
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

// ─── TaskCard with optional delete button ─────────────────────────────────
function TaskCard({ task, energy, isLast, status, selectedDate, t, showDeleteMode, onDelete }: {
  task: PlanTask;
  energy: number;
  isLast: boolean;
  status: CompletionStatus;
  selectedDate: Date;
  t: any;
  showDeleteMode?: boolean;
  onDelete?: (taskId: string) => void;
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
        showDeleteMode && !isExercise && card.deleteModeBorder,
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

          {/* زر الحذف يظهر فقط في وضع الحذف وللمهام غير التمارين */}
          {showDeleteMode && !isExercise ? (
            <TouchableOpacity
              style={card.deleteBtn}
              onPress={() => onDelete && onDelete(task.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#E05C5C" />
            </TouchableOpacity>
          ) : (
            <DoneBadge status={status} />
          )}
        </View>

        {!isExercise && !canDo && !isDone && !showDeleteMode && (
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

// ─── Energy Status Banner ────────────────────────────────────────────────────
function EnergyStatusBanner({
  realTasks,
  energy,
  t,
  isRTL,
  onEnterDeleteMode,
}: {
  realTasks: PlanTask[];
  energy: number;
  t: any;
  isRTL: boolean;
  onEnterDeleteMode: () => void;
}) {
  if (realTasks.length === 0) {
    return (
      <View style={[enBanner.wrap, { backgroundColor: '#F5F5F5' }]}>
        <Text style={{ fontSize: 16 }}>🌿</Text>
        <Text style={[enBanner.text, { color: '#888' }]}>{t.energyZero}</Text>
      </View>
    );
  }

  const { state, avgEffortPct, tasksAboveEnergy } = calcEnergyState(realTasks, energy);

  if (state === 'ok') {
    return (
      <View style={[enBanner.wrap, { backgroundColor: '#E8F5EF' }]}>
        <Text style={{ fontSize: 16 }}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={[enBanner.text, { color: '#4CAF82' }]}>
            {t.energySufficientNew
              ? t.energySufficientNew
              : `طاقتك تكفي لإتمام هذه المهام ✓`}
          </Text>
          <Text style={enBanner.subText}>
            {`متوسط الجهد المطلوب: ${avgEffortPct}% | طاقتك: ${energy}%`}
          </Text>
        </View>
      </View>
    );
  }

  // state === 'low'
  return (
    <View style={[enBanner.wrap, { backgroundColor: '#FDEAEA', borderColor: '#E05C5C', borderWidth: 1.5 }]}>
      <Text style={{ fontSize: 16 }}>⚠️</Text>
      <View style={{ flex: 1 }}>
        <Text style={[enBanner.text, { color: '#E05C5C', fontWeight: '800' }]}>
          {t.energyInsufficientNew
            ? t.energyInsufficientNew
            : `طاقتك لا تكفي لاستكمال هذه المهام`}
        </Text>
        <Text style={[enBanner.subText, { color: '#C04040' }]}>
          {`متوسط الجهد المطلوب: ${avgEffortPct}% | طاقتك: ${energy}%`}
        </Text>
        <Text style={[enBanner.subText, { color: '#C04040', marginTop: 2 }]}>
          {t.energyDeleteHint
            ? t.energyDeleteHint
            : `احذف إحدى هذه المهام لتتناسب مع طاقتك:`}
        </Text>

        <TouchableOpacity style={enBanner.deleteBtn} onPress={onEnterDeleteMode} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={15} color="#fff" />
          <Text style={enBanner.deleteBtnText}>
            {t.energyDeleteAction
              ? t.energyDeleteAction
              : `حذف مهمة`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const enBanner = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  subText: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    lineHeight: 16,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E05C5C',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});

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

  // ─── وضع الحذف: لما الطاقة مش كافية ──────────────────────────────────────
  const [deleteMode, setDeleteMode]     = useState(false);

  // ─── Add Task Modal ────────────────────────────────────────────────────────
  const [modalVisible,   setModalVisible]   = useState(false);
  const [newName,        setNewName]        = useState('');
  const [newIcon,        setNewIcon]        = useState('');
  const [newTimeStart,   setNewTimeStart]   = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState<Period>('AM');
  const [newTimeEnd,     setNewTimeEnd]     = useState('');
  const [newPeriodEnd,   setNewPeriodEnd]   = useState<Period>('AM');
  const [newEnergy,      setNewEnergy]      = useState('');
  const [newCat,         setNewCat]         = useState('work');
  const [newTaskType,    setNewTaskType]    = useState<'core' | 'extra'>('core');
  const [nameError,      setNameError]      = useState(false);
  const [saving,         setSaving]         = useState(false);

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
    loadLocalExercises(user?.uid ?? 'guest').then(setLocalExercises);
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

  const todayKey    = getTodayKey();
  const selectedKey = toKey(selectedDate);
  const yesterday   = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toKey(d); })();
  const isPastDay   = selectedKey < todayKey;
  const isFutureDay = selectedKey > todayKey;
  const isToday     = selectedKey === todayKey;

  const dayCoreTasks  = coreTasks.filter(t => !t.date || t.date === selectedKey);
  const dayExtraTasks = extraTasks.filter(t => t.date === selectedKey);

  const exercisePool = doctorExercises.length > 0 ? doctorExercises : localExercises;
  const withExercises = buildPlanList(dayCoreTasks, dayExtraTasks, exercisePool);

  // المهام الحقيقية (بدون تمارين)
  const realTasks = withExercises.filter(t => !t.isExercise);

  // ─── حساب حالة الطاقة بناءً على متوسط الجهد ────────────────────────────
  const { state: energyState } = calcEnergyState(realTasks, energy);

  // لما الطاقة تبقى كافية بعد حذف → اخرج من وضع الحذف تلقائياً
  useEffect(() => {
    if (deleteMode && energyState !== 'low') {
      setDeleteMode(false);
    }
  }, [energyState, deleteMode]);

  // ─── حذف مهمة (فقط locally من state) ──────────────────────────────────
  const handleDeleteTask = (taskId: string) => {
    // نحدد هي core ولا extra
    const isCoreTask = coreTasks.some(t => t.id === taskId);
    if (isCoreTask) {
      setCoreTasks(prev => prev.filter(t => t.id !== taskId));
    } else {
      setExtraTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const openModal = () => {
    setNewName(''); setNewIcon('');
    setNewTimeStart(''); setNewPeriodStart('AM');
    setNewTimeEnd('');   setNewPeriodEnd('AM');
    setNewEnergy(''); setNewCat('work'); setNewTaskType('core');
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
    const uid = user?.uid;
    if (!uid || saving) return;
    setSaving(true);
    try {
      const catColors = CAT_COLORS[newCat] ?? CAT_COLORS.work;
      const start24 = newTimeStart.trim() ? to24h(newTimeStart.trim(), newPeriodStart) : '';
      const end24   = newTimeEnd.trim()   ? to24h(newTimeEnd.trim(),   newPeriodEnd)   : '';
      const timeStr = start24 && end24 ? `${start24} - ${end24}` : start24 || '--:--';
      const energy  = Math.min(100, Math.max(5, parseInt(newEnergy) || 20));
      const key     = `task_${Date.now()}`;
      const today   = toKey(new Date());
      const newTask = {
        key, icon: newIcon.trim() || '📌',
        cat: newCat, energy, color: catColors.color, bg: catColors.bg,
        time: timeStr, done: false, name: newName.trim(), type: newTaskType,
        ...(newTaskType === 'extra' ? { date: today } : {}),
      };
      closeModal();
      await setDoc(doc(db, 'tasks', uid, 'items', key), newTask);
      await notify({
        title: t.taskAddedNotif ?? 'تمت الإضافة',
        body: isRTL
          ? `${newTask.icon} "${newTask.name}" ${newTaskType === 'extra' ? 'اتضافت لليوم ده' : 'اتضافت للمهام الأساسية'}`
          : `${newTask.icon} "${newTask.name}" added`,
        emoji: '✅', type: 'add',
        dedupKey: `task_added_${key}`,
      });
    } catch (e) { console.warn('addTask error:', e); setSaving(false); }
  };

  const handleExerciseTap = (task: PlanTask) => {
    const exerciseKey = task.id.replace(/^exercise_/, '');
    const ex = exercisePool.find((e: any) => (e.key ?? e.id) === exerciseKey) ?? exercisePool[0];
    if (!ex) return;
    router.push({
      pathname: '/tabs/Exercisesessionscreen',
      params: {
        exerciseKey: ex.key ?? ex.id ?? exerciseKey,
        videoKey:    ex.key ?? ex.id ?? exerciseKey,
        title:       ex.title ?? ex.titleAr ?? task.title,
        titleEn:     ex.titleEn ?? ex.title ?? task.title,
        emoji:       ex.emoji ?? task.emoji,
        color:       ex.color ?? task.color,
        bg:          ex.bg    ?? task.bg,
        accent:      ex.accent ?? '#E0D6F5',
        durationSeconds: ex.durationSeconds ?? 300,
        steps:   JSON.stringify(ex.steps   ?? []),
        stepsEn: JSON.stringify(ex.stepsEn ?? []),
      },
    });
  };

  const doneCount = realTasks.filter(t => doneIds.has(t.id)).length;

  const handleToggleDone = async (taskId: string) => {
    // منع التفاعل لو في وضع الحذف أو ليس اليوم
    if (deleteMode) return;
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
      saveDoneIds(selectedDate, next, user?.uid ?? null);
      return next;
    });
  };

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

      {/* بانر وضع الحذف في الأعلى */}
      {deleteMode && (
        <View style={s.deleteModeBar}>
          <Ionicons name="warning-outline" size={16} color="#E05C5C" />
          <Text style={s.deleteModeBarText}>
            {t.deleteModeActive
              ? t.deleteModeActive
              : `وضع الحذف — احذف مهمة لتتناسب مع طاقتك`}
          </Text>
          <TouchableOpacity onPress={() => setDeleteMode(false)} style={s.deleteModeClose}>
            <Ionicons name="close" size={16} color="#E05C5C" />
          </TouchableOpacity>
        </View>
      )}

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
            {exercisePool.length > 0 && (dayCoreTasks.length + dayExtraTasks.length) >= 2 && (
              <View style={[s.summaryPill, { backgroundColor: '#E8F5EF' }]}>
                <Text style={s.summaryEmoji}>🏋️</Text>
                <Text style={[s.summaryText, { color: '#4CAF82' }]}>{dayCoreTasks.length + dayExtraTasks.length} {t.exercisesCount}</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── بانر الطاقة الجديد بالحساب الصحيح ─── */}
        {hasTasks && (
          <EnergyStatusBanner
            realTasks={realTasks}
            energy={energy}
            t={t}
            isRTL={isRTL}
            onEnterDeleteMode={() => setDeleteMode(true)}
          />
        )}

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
                onPress={openModal}
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
              <TouchableOpacity
                key={task.id}
                onPress={() => task.isExercise ? handleExerciseTap(task) : handleToggleDone(task.id)}
                activeOpacity={deleteMode ? 1 : 0.85}
                disabled={deleteMode && !task.isExercise}
              >
                <TaskCard
                  task={task}
                  energy={energy}
                  isLast={index === withExercises.length - 1}
                  status={getStatus(task)}
                  selectedDate={selectedDate}
                  t={t}
                  showDeleteMode={deleteMode}
                  onDelete={handleDeleteTask}
                />
              </TouchableOpacity>
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

      {/* FAB: Add Task */}
      {!isPastDay && (
        <TouchableOpacity style={s.fab} onPress={openModal} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add Task Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal} statusBarTranslucent={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={closeModal} />
          <View style={s.modalSheet}>
            <ScrollView contentContainerStyle={{ paddingBottom: 36 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.modalHandle} />
              <View style={s.modalHeaderRow}>
                <Text style={s.modalTitle}>{t.addNewTask ?? 'إضافة مهمة'}</Text>
                <TouchableOpacity onPress={closeModal} style={s.modalCloseBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Task Type */}
              <Text style={[s.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskType ?? 'نوع المهمة'}</Text>
              <View style={s.typeRow}>
                <TouchableOpacity style={[s.typeBtn, newTaskType === 'core' && s.typeBtnActive]} onPress={() => setNewTaskType('core')} activeOpacity={0.8}>
                  <Ionicons name="star" size={16} color={newTaskType === 'core' ? '#fff' : '#7C5CBF'} />
                  <Text style={[s.typeBtnText, newTaskType === 'core' && s.typeBtnTextActive]}>{t.taskTypeCore ?? 'أساسية'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.typeBtn, newTaskType === 'extra' && s.typeBtnActive]} onPress={() => setNewTaskType('extra')} activeOpacity={0.8}>
                  <Ionicons name="flash" size={16} color={newTaskType === 'extra' ? '#fff' : '#7C5CBF'} />
                  <Text style={[s.typeBtnText, newTaskType === 'extra' && s.typeBtnTextActive]}>{t.taskTypeExtra ?? 'إضافية'}</Text>
                </TouchableOpacity>
              </View>

              {/* Task Name */}
              <Text style={[s.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskName ?? 'اسم المهمة'}</Text>
              <TextInput
                style={[s.fieldInput, nameError && s.fieldInputError, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder={t.taskNamePlaceholder ?? 'أدخل اسم المهمة'}
                placeholderTextColor="#aaa"
                value={newName} onChangeText={(v) => { setNewName(v); if (v.trim()) setNameError(false); }}
                returnKeyType="next"
              />
              {nameError && <Text style={[s.errorText, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskNameRequired ?? 'اسم المهمة مطلوب'}</Text>}

              {/* Icon */}
              <Text style={[s.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskIcon ?? 'أيقونة'}</Text>
              <TextInput
                style={[s.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder="📌" placeholderTextColor="#aaa"
                value={newIcon} onChangeText={setNewIcon}
              />

              {/* Time */}
              <Text style={[s.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskTime ?? 'الوقت'}</Text>
              <View style={[s.timeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={s.timeSlot}>
                  <TextInput
                    style={s.timeInput}
                    placeholder={t.taskTimeFromPlaceholder ?? '09:00'}
                    placeholderTextColor="#aaa"
                    value={newTimeStart} onChangeText={setNewTimeStart}
                    keyboardType="numbers-and-punctuation" textAlign="center"
                  />
                  <AmPmToggle period={newPeriodStart} onChange={setNewPeriodStart} isRTL={isRTL} />
                </View>
                <Text style={s.timeSep}>—</Text>
                <View style={s.timeSlot}>
                  <TextInput
                    style={s.timeInput}
                    placeholder={t.taskTimeToPlaceholder ?? '10:00'}
                    placeholderTextColor="#aaa"
                    value={newTimeEnd} onChangeText={setNewTimeEnd}
                    keyboardType="numbers-and-punctuation" textAlign="center"
                  />
                  <AmPmToggle period={newPeriodEnd} onChange={setNewPeriodEnd} isRTL={isRTL} />
                </View>
              </View>

              {/* Category */}
              <Text style={[s.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskCategory2 ?? 'التصنيف'}</Text>
              <View style={[s.catRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {CAT_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt.k}
                    style={[s.catBtn, newCat === opt.k && s.catBtnActive]}
                    onPress={() => setNewCat(opt.k)} activeOpacity={0.8}>
                    <Text style={[s.catBtnText, newCat === opt.k && s.catBtnTextActive]}>
                      {isRTL ? opt.labelAr : opt.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Energy */}
              <Text style={[s.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t.taskEnergyConsumed ?? 'الطاقة المستهلكة %'}</Text>
              <TextInput
                style={[s.fieldInput, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder={t.taskEnergyPlaceholder ?? '20'}
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
                value={newEnergy} onChangeText={setNewEnergy}
              />

              <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={addTask} activeOpacity={0.85} disabled={saving}>
                <Text style={s.submitText}>{saving ? (t.savingDots ?? '...') : (t.addTaskBtn ?? 'إضافة')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  // ─── وضع الحذف ──────────────────────────────────────────────────────────
  deleteModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F0',
    borderBottomWidth: 2,
    borderBottomColor: '#E05C5C',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  deleteModeBarText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#E05C5C',
  },
  deleteModeClose: {
    padding: 4,
  },
  // ─── FAB ───────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 155,
    right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#7C5CBF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  // ─── Add Task Modal ─────────────────────────────────────────────────────────
  modalSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '90%' },
  modalHandle:    { width: 40, height: 4, backgroundColor: '#E0D6F5', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: '#2d2d2d' },
  modalCloseBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  typeRow:        { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#7C5CBF', borderRadius: 12, paddingVertical: 10, backgroundColor: '#F0EBFA' },
  typeBtnActive:     { backgroundColor: '#7C5CBF' },
  typeBtnText:       { fontSize: 12, fontWeight: '700', color: '#7C5CBF' },
  typeBtnTextActive: { color: '#fff' },
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  fieldInput:     { borderWidth: 1.5, borderColor: '#E0D6F5', borderRadius: 12, padding: 10, fontSize: 15, color: '#2d2d2d', backgroundColor: '#F8F5FF', marginBottom: 14 },
  fieldInputError:{ borderColor: '#E24B4A' },
  errorText:      { fontSize: 11, color: '#E24B4A', marginTop: -10, marginBottom: 8 },
  timeRow:        { gap: 8, marginBottom: 14, alignItems: 'center' },
  timeSlot:       { flex: 1, flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  timeInput:      { flex: 1, borderWidth: 1.5, borderColor: '#E0D6F5', borderRadius: 12, padding: 10, fontSize: 15, color: '#2d2d2d', backgroundColor: '#F8F5FF' },
  timeSep:        { color: '#aaa', fontSize: 18 },
  catRow:         { gap: 10, marginBottom: 14 },
  catBtn:         { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0D6F5', alignItems: 'center', backgroundColor: '#F8F5FF' },
  catBtnActive:       { backgroundColor: '#7C5CBF', borderColor: '#7C5CBF' },
  catBtnText:         { fontSize: 13, fontWeight: '700', color: '#888' },
  catBtnTextActive:   { color: '#fff' },
  submitBtn:      { backgroundColor: '#7C5CBF', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitText:     { fontSize: 15, fontWeight: '800', color: '#fff' },
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
  deleteModeBorder: {
    borderWidth: 2, borderColor: '#E05C5C33',
    borderStyle: 'dashed',
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
  // ─── زر الحذف ─────────────────────────────────────────────────────────
  deleteBtn:   {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FDEAEA',
    borderWidth: 1.5,
    borderColor: '#E05C5C44',
  },
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