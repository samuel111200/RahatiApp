// app/(tabs)/plan.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// ─── types ───────────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  timeFrom: string;
  timeTo: string;
  emoji: string;
  color: string;
  bg: string;
  date: string;
  effortScore: number;
}

// ─── helpers ─────────────────────────────────────────────
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

// ─── DEMO TASKS ──────────────────────────────────────────
const DEMO_TASKS: Task[] = [
  { id:'1', title:'استراحة',           timeFrom:'9:00 ص',  timeTo:'9:30 ص',  emoji:'🛋️', color:'#7C5CBF', bg:'#F0EBFA', date: toKey(new Date()), effortScore:1 },
  { id:'2', title:'شغل على الكمبيوتر', timeFrom:'10:00 ص', timeTo:'12:00 م', emoji:'💻', color:'#5B9BD5', bg:'#E8F1FB', date: toKey(new Date()), effortScore:3 },
  { id:'3', title:'استراحة',           timeFrom:'12:00 م', timeTo:'12:30 م', emoji:'💧', color:'#29B6D4', bg:'#E1F8FC', date: toKey(new Date()), effortScore:1 },
  { id:'4', title:'مذاكرة',            timeFrom:'12:50 م', timeTo:'2:00 م',  emoji:'📚', color:'#4CAF82', bg:'#E8F5EF', date: toKey(new Date()), effortScore:2 },
  { id:'5', title:'طبخ الغداء',        timeFrom:'2:00 م',  timeTo:'3:00 م',  emoji:'🍳', color:'#E05C5C', bg:'#FDEAEA', date: toKey(new Date()), effortScore:2 },
  { id:'6', title:'استراحة',           timeFrom:'3:30 م',  timeTo:'4:00 م',  emoji:'🧘', color:'#7C5CBF', bg:'#F0EBFA', date: toKey(new Date()), effortScore:1 },
  { id:'7', title:'تنظيف البيت',       timeFrom:'4:10 م',  timeTo:'5:00 م',  emoji:'🧹', color:'#C97B3A', bg:'#FEF3E2', date: toKey(new Date()), effortScore:3 },
];

// ─── Calendar Picker ─────────────────────────────────────
function CalendarPicker({ visible, selected, onSelect, onClose }: {
  visible: boolean; selected: Date; onSelect: (d: Date) => void; onClose: () => void;
}) {
  const [viewing, setViewing] = useState(new Date(selected));

  const startOfMonth = new Date(viewing.getFullYear(), viewing.getMonth(), 1);
  const daysInMonth  = new Date(viewing.getFullYear(), viewing.getMonth()+1, 0).getDate();
  const startDay     = startOfMonth.getDay();

  const cells: (number|null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i+1),
  ];

  const prevMonth = () => setViewing(new Date(viewing.getFullYear(), viewing.getMonth()-1, 1));
  const nextMonth = () => setViewing(new Date(viewing.getFullYear(), viewing.getMonth()+1, 1));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={cal.overlay} activeOpacity={1} onPress={onClose}>
        <View style={cal.box}>
          <View style={cal.header}>
            <TouchableOpacity onPress={prevMonth}><Ionicons name="chevron-back" size={20} color="#7C5CBF"/></TouchableOpacity>
            <Text style={cal.monthTitle}>{MONTHS_AR[viewing.getMonth()]} {viewing.getFullYear()}</Text>
            <TouchableOpacity onPress={nextMonth}><Ionicons name="chevron-forward" size={20} color="#7C5CBF"/></TouchableOpacity>
          </View>
          <View style={cal.dayNames}>
            {['أح','اث','ث','أر','خ','ج','س'].map(d=>(
              <Text key={d} style={cal.dayName}>{d}</Text>
            ))}
          </View>
          <View style={cal.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={cal.cell}/>;
              const d = new Date(viewing.getFullYear(), viewing.getMonth(), day);
              const isSelected = toKey(d) === toKey(selected);
              const isToday    = toKey(d) === toKey(new Date());
              return (
                <TouchableOpacity key={day} style={cal.cell} onPress={() => { onSelect(d); onClose(); }}>
                  <View style={[cal.dayCircle, isSelected && cal.selectedDay, isToday && !isSelected && cal.todayDay]}>
                    <Text style={[cal.dayText, isSelected && { color:'#fff' }, isToday && !isSelected && { color:'#7C5CBF'}]}>{day}</Text>
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
function TaskCard({ task, energy, isLast }: { task: Task; energy: number; isLast: boolean }) {
  const canDo = canDoTask(energy, task.effortScore);
  return (
    <View style={card.row}>
      <View style={card.timelineCol}>
        <View style={[card.dot, { backgroundColor: task.color }]} />
        {!isLast && <View style={card.line} />}
      </View>
      <View style={[card.box, { backgroundColor: task.bg }]}>
        <View style={card.cardTop}>
          <View style={[card.emojiWrap, { backgroundColor: task.color + '22' }]}>
            <Text style={{ fontSize: 22 }}>{task.emoji}</Text>
          </View>
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={[card.title, { color: task.color }]}>{task.title}</Text>
            <Text style={card.time}>{task.timeFrom} - {task.timeTo}</Text>
          </View>
          <View style={[card.badge, { backgroundColor: canDo ? '#E8F5EF' : '#FDEAEA' }]}>
            <Text style={{ fontSize: 12 }}>{canDo ? '✅' : '⚠️'}</Text>
          </View>
        </View>
        {!canDo && (
          <Text style={card.warning}>طاقتك قد لا تكفي لهذه المهمة</Text>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────
export default function PlanScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCal, setShowCal]           = useState(false);
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [energy, setEnergy]             = useState(50);

  useFocusEffect(useCallback(() => {
    (async () => {
      const e = await AsyncStorage.getItem('energy_level');
      if (e) setEnergy(Number(e));

      const stored = await AsyncStorage.getItem('tasks_data');
      if (stored) {
        setTasks(JSON.parse(stored));
      } else {
        await AsyncStorage.setItem('tasks_data', JSON.stringify(DEMO_TASKS));
        setTasks(DEMO_TASKS);
      }
    })();
  }, []));

  const dayTasks = tasks.filter(t => t.date === toKey(selectedDate));

  const totalEffort = dayTasks.reduce((sum, t) => sum + t.effortScore, 0);
  const maxEffort   = dayTasks.length * 3;
  const energyOk    = maxEffort === 0 || (totalEffort / maxEffort) * 100 <= energy;

  return (
    // ✅ Fix: استبدل SafeAreaView بـ View عادي
    <View style={s.safe}>

      {/* ✅ الـ StatusBar بنفس لون الخلفية */}
      <StatusBar backgroundColor="#af9dd6" barStyle="dark-content" translucent={false} />

      {/* ── Navbar ── */}
      <View style={s.navbar}>
        <Text style={s.navTitle}>خطتي اليوم</Text>
        <TouchableOpacity onPress={() => setShowCal(true)} style={s.calBtn}>
          <Ionicons name="calendar-outline" size={22} color="#7C5CBF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.datePill}>
          <Text style={s.dateText}>{formatDateAr(selectedDate)}</Text>
        </View>

        <View style={s.placeholderCard}>
          <Text style={s.placeholderEmoji}>🌿</Text>
          <Text style={s.placeholderText}>
            تم تنظيم يومك بناءً{'\n'}على طاقتك البالغة {energy}%
          </Text>
        </View>

        <View style={s.energySummary}>
          <View style={[s.energyBar, { backgroundColor: energyOk ? '#E8F5EF' : '#FDEAEA' }]}>
            <Text style={{ fontSize: 16 }}>{energyOk ? '⚡' : '⚠️'}</Text>
            <Text style={[s.energyText, { color: energyOk ? '#4CAF82' : '#E05C5C' }]}>
              {energyOk
                ? `طاقتك كافية لمهام اليوم (${energy}%)`
                : `طاقتك (${energy}%) قد لا تكفي لكل المهام`}
            </Text>
          </View>
        </View>

        {dayTasks.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>📭</Text>
            <Text style={s.emptyText}>لا توجد مهام في هذا اليوم</Text>
          </View>
        ) : (
          <View style={s.timeline}>
            {dayTasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                energy={energy}
                isLast={index === dayTasks.length - 1}
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
    // ✅ الحل الرئيسي: paddingTop بيساوي ارتفاع الـ status bar تلقائياً
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },

  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    shadowColor: '#7C5CBF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
  },
  navTitle: { fontSize: 18, fontWeight: '700', color: '#2d2d2d', textAlign: 'center', flex: 1 },
  calBtn: { position: 'absolute', right: 20 },

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
    minHeight: 120,
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
  placeholderText: { fontSize: 15, color: '#5a3fa0', fontWeight: '600', textAlign: 'right', lineHeight: 24 },

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
  emptyText: { fontSize: 15, color: '#aaa' },
});

const card = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 0,
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
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  emojiWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  time:  { fontSize: 12, color: '#999', marginTop: 2 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  warning: { fontSize: 11, color: '#E05C5C', marginTop: 6, textAlign: 'right' },
});

const cal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  box: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: 320, shadowColor: '#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.15, shadowRadius:12, elevation:8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthTitle: { fontSize: 16, fontWeight: '700', color: '#2d2d2d' },
  dayNames: { flexDirection: 'row', marginBottom: 8 },
  dayName: { flex: 1, textAlign: 'center', fontSize: 11, color: '#aaa', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100/7}%`, alignItems: 'center', marginBottom: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  selectedDay: { backgroundColor: '#7C5CBF' },
  todayDay: { borderWidth: 1.5, borderColor: '#7C5CBF' },
  dayText: { fontSize: 14, color: '#2d2d2d' },
});1