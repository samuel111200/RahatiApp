import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

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
  breakDescription?: string; // ← وصف التمرين
}

// ─── Helpers ─────────────────────────────────────────────
const DAYS_AR   = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function formatDateAr(date: Date) {
  return `${DAYS_AR[date.getDay()]}، ${date.getDate()} ${MONTHS_AR[date.getMonth()]}`;
}

function toKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function canDoTask(energy: number, effortScore: number): boolean {
  if (effortScore === 1) return energy >= 20;
  if (effortScore === 2) return energy >= 45;
  return energy >= 70;
}

// ─── قائمة التمارين المتنوعة ──────────────────────────────
const BREAK_EXERCISES = [
  { title: 'تمطط وتنفس',         emoji: '🧘', description: 'خذ نفساً عميقاً وتمطط لمدة دقيقة 🌬️' },
  { title: 'مشي خفيف',           emoji: '🚶', description: 'امشِ حول الغرفة دقيقتين لتنشيط الدورة الدموية' },
  { title: 'تمرين الرقبة',       emoji: '🔄', description: 'دوّر رقبتك ببطء يميناً ويساراً 5 مرات' },
  { title: 'قفز في المكان',      emoji: '🏃', description: 'قفز خفيف في مكانك لمدة 30 ثانية لرفع الطاقة' },
  { title: 'تمرين العيون',       emoji: '👁️', description: 'انظر للبعيد 20 ثانية لإراحة عينيك' },
  { title: 'تمدد الظهر',         emoji: '🙆', description: 'قف ومدّ ذراعيك للأعلى واشعر بتمدد ظهرك' },
  { title: 'اسقِ نفسك',         emoji: '💧', description: 'اشرب كوب ماء واستروح قليلاً' },
  { title: 'تمرين الكتفين',      emoji: '💪', description: 'دوّر كتفيك للخلف 10 مرات لإراحة التوتر' },
  { title: 'تنفس بطني',          emoji: '🫁', description: 'ضع يدك على بطنك وخذ 5 أنفاس عميقة بطيئة' },
  { title: 'تمرين الأصابع',      emoji: '🤲', description: 'افتح وأغلق يديك 10 مرات لإراحة الأصابع' },
];

// ─── Map tasks.tsx shape → PlanTask shape ────────────────
const CAT_TO_EFFORT: Record<string, number> = {
  work: 3, study: 2, home: 2,
};

function mapFromTasksScreen(raw: any, fallbackDate: string): PlanTask {
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
  };
}

// ─── Insert a DIFFERENT exercise break between every two real tasks ──
function injectBreaks(tasks: PlanTask[]): PlanTask[] {
  if (tasks.length === 0) return [];
  const result: PlanTask[] = [];
  tasks.forEach((task, i) => {
    result.push(task);
    if (i < tasks.length - 1) {
      // Pick exercise based on position so every break is different
      const exercise = BREAK_EXERCISES[i % BREAK_EXERCISES.length];
      result.push({
        id:               `break_${i}`,
        title:            exercise.title,
        timeFrom:         '',
        timeTo:           '',
        emoji:            exercise.emoji,
        color:            '#7C5CBF',
        bg:               '#EDE6F8',
        date:             task.date,
        effortScore:      1,
        isBreak:          true,
        breakDescription: exercise.description,
      });
    }
  });
  return result;
}

// ─── Fallback demo tasks ──────────────────────────────────
const TODAY_KEY = toKey(new Date());

const DEMO_TASKS: PlanTask[] = [
  { id:'1', title:'استراحة',           timeFrom:'9:00 ص',  timeTo:'9:30 ص',  emoji:'🛋️', color:'#7C5CBF', bg:'#F0EBFA', date: TODAY_KEY, effortScore:1 },
  { id:'2', title:'شغل على الكمبيوتر', timeFrom:'10:00 ص', timeTo:'12:00 م', emoji:'💻', color:'#5B9BD5', bg:'#E8F1FB', date: TODAY_KEY, effortScore:3 },
  { id:'3', title:'مذاكرة',            timeFrom:'12:50 م', timeTo:'2:00 م',  emoji:'📚', color:'#4CAF82', bg:'#E8F5EF', date: TODAY_KEY, effortScore:2 },
  { id:'4', title:'طبخ الغداء',        timeFrom:'2:00 م',  timeTo:'3:00 م',  emoji:'🍳', color:'#E05C5C', bg:'#FDEAEA', date: TODAY_KEY, effortScore:2 },
  { id:'5', title:'تنظيف البيت',       timeFrom:'4:10 م',  timeTo:'5:00 م',  emoji:'🧹', color:'#C97B3A', bg:'#FEF3E2', date: TODAY_KEY, effortScore:3 },
];

// ─── Calendar Picker ─────────────────────────────────────
function CalendarPicker({ visible, selected, onSelect, onClose }: {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const [viewing, setViewing] = useState(new Date(selected));

  const daysInMonth = new Date(viewing.getFullYear(), viewing.getMonth() + 1, 0).getDate();
  const startDay    = new Date(viewing.getFullYear(), viewing.getMonth(), 1).getDay();

  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

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
              const isSelected = toKey(d) === toKey(selected);
              const isToday    = toKey(d) === toKey(new Date());
              return (
                <TouchableOpacity key={day} style={cal.cell} onPress={() => { onSelect(d); onClose(); }}>
                  <View style={[
                    cal.dayCircle,
                    isSelected && cal.selectedDay,
                    isToday && !isSelected && cal.todayDay,
                  ]}>
                    <Text style={[
                      cal.dayText,
                      isSelected && { color: '#fff' },
                      isToday && !isSelected && { color: '#7C5CBF' },
                    ]}>
                      {day}
                    </Text>
                  </View>
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
function TaskCard({ task, energy, isLast }: {
  task: PlanTask;
  energy: number;
  isLast: boolean;
}) {
  const canDo   = canDoTask(energy, task.effortScore);
  const isBreak = !!task.isBreak;

  return (
    <View style={card.row}>
      {/* Timeline */}
      <View style={card.timelineCol}>
        <View style={[card.dot, { backgroundColor: isBreak ? '#c9b8f0' : task.color }]} />
        {!isLast && <View style={card.line} />}
      </View>

      {/* Card */}
      <View style={[
        card.box,
        { backgroundColor: task.bg },
        isBreak && card.breakBox,
      ]}>
        <View style={card.cardTop}>
          <View style={[card.emojiWrap, { backgroundColor: isBreak ? '#e4d9f8' : task.color + '22' }]}>
            <Text style={{ fontSize: 22 }}>{task.emoji}</Text>
          </View>

          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={[card.title, { color: isBreak ? '#7C5CBF' : task.color }]}>
              {task.title}
            </Text>
            {task.timeFrom ? (
              <Text style={card.time}>{task.timeFrom}{task.timeTo ? ` - ${task.timeTo}` : ''}</Text>
            ) : isBreak && task.breakDescription ? (
              <Text style={card.time}>{task.breakDescription}</Text>
            ) : null}
          </View>

          {isBreak ? (
            <View style={[card.badge, { backgroundColor: '#EDE6F8' }]}>
              <Text style={{ fontSize: 12 }}>⏸️</Text>
            </View>
          ) : (
            <View style={[card.badge, { backgroundColor: canDo ? '#E8F5EF' : '#FDEAEA' }]}>
              <Text style={{ fontSize: 12 }}>{canDo ? '✅' : '⚠️'}</Text>
            </View>
          )}
        </View>

        {!isBreak && !canDo && (
          <Text style={card.warning}>طاقتك قد لا تكفي لهذه المهمة</Text>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────
export default function PlanScreen() {
  const navigation = useNavigation();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCal, setShowCal]           = useState(false);
  const [tasks, setTasks]               = useState<PlanTask[]>([]);
  const [energy, setEnergy]             = useState(50);

  useFocusEffect(useCallback(() => {
    (async () => {
      const storedEnergy = await AsyncStorage.getItem('energy_level');
      if (storedEnergy) setEnergy(Number(storedEnergy));

      const today = toKey(new Date());

      const tasksListRaw = await AsyncStorage.getItem('tasks_list');
      if (tasksListRaw) {
        const parsed: any[] = JSON.parse(tasksListRaw);
        setTasks(parsed.map(t => mapFromTasksScreen(t, today)));
        return;
      }

      const planRaw = await AsyncStorage.getItem('tasks_data');
      if (planRaw) {
        setTasks(JSON.parse(planRaw));
      } else {
        await AsyncStorage.setItem('tasks_data', JSON.stringify(DEMO_TASKS));
        setTasks(DEMO_TASKS);
      }
    })();
  }, []));

  const dayTasks   = tasks.filter(t => t.date === toKey(selectedDate));
  const withBreaks = injectBreaks(dayTasks);

  const totalEffort = dayTasks.reduce((s, t) => s + t.effortScore, 0);
  const maxEffort   = dayTasks.length * 3;
  const energyOk    = maxEffort === 0 || (totalEffort / maxEffort) * 100 <= energy;

  return (
    <View style={s.safe}>
      <StatusBar
        backgroundColor="#f8f5ff"
        barStyle="dark-content"
        translucent={false}
      />

      {/* ── Navbar ── */}
      <View style={s.navbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.navIconBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#7C5CBF" />
        </TouchableOpacity>

        <View style={s.navCenter}>
          <Text style={s.navTitle}>خطتي اليوم</Text>
        </View>

        <View style={s.calWrapper}>
          <TouchableOpacity
            onPress={() => setShowCal(true)}
            style={s.navIconBtn}
          >
            <Ionicons name="calendar-outline" size={22} color="#7C5CBF" />
          </TouchableOpacity>
          <View style={s.calDot} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.datePill}>
          <Text style={s.dateText}>{formatDateAr(selectedDate)}</Text>
        </View>

        <View style={s.placeholderCard}>
          <Text style={s.placeholderEmoji}>🌿</Text>
          <Text style={s.placeholderText}>
            تم تنظيم يومك بناءً{"\n"}على طاقتك البالغة {energy}%
          </Text>
        </View>

        <View style={s.energySummary}>
          <View
            style={[
              s.energyBar,
              { backgroundColor: energyOk ? "#E8F5EF" : "#FDEAEA" },
            ]}
          >
            <Text style={{ fontSize: 16 }}>{energyOk ? "⚡" : "⚠️"}</Text>
            <Text
              style={[
                s.energyText,
                { color: energyOk ? "#4CAF82" : "#E05C5C" },
              ]}
            >
              {energyOk
                ? `طاقتك كافية لمهام اليوم (${energy}%)`
                : `طاقتك (${energy}%) قد لا تكفي لكل المهام`}
            </Text>
          </View>
        </View>

        {withBreaks.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>📭</Text>
            <Text style={s.emptyText}>لا توجد مهام في هذا اليوم</Text>
          </View>
        ) : (
          <View style={s.timeline}>
            {withBreaks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                energy={energy}
                isLast={index === withBreaks.length - 1}
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#f8f5ff',
  },
  navIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#7C5CBF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  navCenter: {
    flex: 1,
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d2d2d',
  },
  calWrapper: {
    alignItems: 'center',
    gap: 3,
  },
  calDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C5CBF',
  },
  scroll: { padding: 20, paddingBottom: 100 },
  datePill: {
    alignSelf: 'center',
    backgroundColor: '#EDE6F8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  dateText: { fontSize: 13, color: '#7C5CBF', fontWeight: '600' },
  placeholderCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
    shadowColor: '#7C5CBF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    gap: 12,
  },
  placeholderEmoji: { fontSize: 40 },
  placeholderText: {
    fontSize: 15,
    color: '#5a3fa0',
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 24,
  },
  energySummary: { marginBottom: 16 },
  energyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  energyText: { fontSize: 13, fontWeight: '600' },
  timeline: {},
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:  { fontSize: 15, color: '#aaa' },
});

const card = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineCol: {
    width: 24,
    alignItems: 'center',
    paddingTop: 18,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 1,
  },
  line: {
    flex: 1,
    width: 1.5,
    backgroundColor: '#e0d6f5',
    marginTop: 4,
  },
  box: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  breakBox: {
    borderWidth: 1.5,
    borderColor: '#c9b8f0',
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: '#F5F0FE',
  },
  cardTop:  { flexDirection: 'row', alignItems: 'center' },
  emojiWrap:{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 14, fontWeight: '700' },
  time:     { fontSize: 12, color: '#888', marginTop: 2 },
  badge:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  warning:  { fontSize: 11, color: '#E05C5C', marginTop: 6, textAlign: 'right' },
});

const cal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthTitle: { fontSize: 16, fontWeight: "700", color: "#7C5CBF" },
  dayNames: { flexDirection: "row", marginBottom: 8 },
  dayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: "#7C5CBF",
    fontWeight: "600",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, alignItems: "center", marginBottom: 4 },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedDay: { backgroundColor: "#7C5CBF" },
  todayDay: { borderWidth: 1.5, borderColor: "#7C5CBF" },
  dayText: { fontSize: 14, color: "#7C5CBF" },
});