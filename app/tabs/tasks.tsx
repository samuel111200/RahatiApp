// app/(tabs)/tasks.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '../../components/UI';
import RahatiLogo from '../../components/RahatiLogo';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function TasksScreen() {
  const { t, isRTL } = useLang();

  const TASKS = [
    { key: 'coding',   icon: '💻', cat: 'work',  energy: 25, color: '#5B9BD5', bg: '#E8F1FB', time: '09:00 - 10:30', done: false },
    { key: 'reading',  icon: '📚', cat: 'study', energy: 20, color: '#4CAF82', bg: '#E8F5EF', time: '11:00 - 12:00', done: true  },
    { key: 'cooking',  icon: '🍲', cat: 'home',  energy: 30, color: '#C97B3A', bg: '#FEF3E2', time: '01:00 - 02:00', done: false },
    { key: 'cleaning', icon: '🧹', cat: 'home',  energy: 15, color: '#D15DBF', bg: '#FAE8F8', time: '03:00 - 04:00', done: false },
  ];

  const LABELS: Record<string, string> = {
    coding:   t.taskCoding,
    reading:  t.taskReading,
    cooking:  t.taskCooking,
    cleaning: t.taskCleaning,
  };

  const FILTERS = [
    { k: 'all',   l: t.all   },
    { k: 'work',  l: t.work  },
    { k: 'study', l: t.study },
    { k: 'home',  l: t.atHome },
  ];

  const [filter, setFilter] = useState('all');
  const [tasks, setTasks] = useState(TASKS);

  const visible = filter === 'all' ? tasks : tasks.filter(t => t.cat === filter);
  const done = tasks.filter(t => t.done).length;
  const toggle = (k: string) => setTasks(prev => prev.map(t => t.key === k ? { ...t, done: !t.done } : t));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={styles.title}>{t.myTasks}</Text>
            <Text style={styles.subtitle}>
              {isRTL
                ? `${done} ${t.from} ${tasks.length} ${t.completedOf}`
                : `${done} ${t.completedOf} ${t.from} ${tasks.length}`}
            </Text>
          </View>
          <RahatiLogo/>
        </View>

        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={[styles.progressRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={styles.progressPct}>{Math.round((done / tasks.length) * 100)}%</Text>
            <Text style={styles.progressLabel}>{t.todayProgress}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(done / tasks.length) * 100}%` }]} />
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filters, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          style={{ marginBottom: Spacing.base }}>
          {FILTERS.map(f => (
            <Chip key={f.k} label={f.l} active={filter === f.k} onPress={() => setFilter(f.k)} />
          ))}
        </ScrollView>

        {/* Tasks */}
        <View style={styles.taskList}>
          {visible.map(task => (
            <TouchableOpacity
              key={task.key}
              onPress={() => toggle(task.key)}
              activeOpacity={0.85}
              style={[styles.taskCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }, task.done && { opacity: 0.65 }]}
            >
              <View style={[styles.taskIcon, { backgroundColor: task.bg }]}>
                <Text style={{ fontSize: 28 }}>{task.icon}</Text>
              </View>
              <View style={[styles.taskInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{LABELS[task.key]}</Text>
                <View style={[styles.taskMetaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.taskTime}> {task.time}</Text>
                </View>
                <View style={[styles.energyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={styles.energyTrack}>
                    <View style={[styles.energyFill, { width: `${task.energy}%`, backgroundColor: task.color }]} />
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
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl },
  topBar: { alignItems: 'center', marginBottom: Spacing.base, gap: 12 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  progressCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.xl, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  progressRow: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressLabel: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textSecondary },
  progressPct: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  progressTrack: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  filters: { gap: 8, paddingVertical: 4 },
  taskList: { gap: 14 },
  taskCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, alignItems: 'center', gap: 12, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  taskIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  taskInfo: { flex: 1, gap: 4 },
  taskTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  taskTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  taskMetaRow: { alignItems: 'center', gap: 2 },
  taskTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  energyRow: { alignItems: 'center', gap: 8, width: '100%' },
  energyTrack: { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  energyFill: { height: '100%', borderRadius: 2 },
  energyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  energyPct: { fontSize: 10, fontWeight: '700' },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
});