// app/(tabs)/exercises.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../../components/UI';
import RahatiLogo from '../../components/RahatiLogo';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get('window');
const CARD_W = width * 0.7;
type Task = {
  id: string;
  title: string;
  completed: boolean;
};

async function saveTask(newTask: Task) {
  const stored = await AsyncStorage.getItem("tasks_data");
  const tasks: Task[] = stored ? JSON.parse(stored) : [];
  tasks.push(newTask);
  await AsyncStorage.setItem("tasks_data", JSON.stringify(tasks));
}

async function deleteTask(taskId: string) {
  const stored = await AsyncStorage.getItem("tasks_data");
  const tasks: Task[] = stored ? JSON.parse(stored) : [];
  const updated = tasks.filter((t) => t.id !== taskId);
  await AsyncStorage.setItem("tasks_data", JSON.stringify(updated));
}

export default function ExercisesScreen() {
  const { t, isRTL } = useLang();
  const [selected, setSelected] = useState('deep');

  const EXERCISES = [
    {
      key: 'deep',    emoji: '🧘', title: isRTL ? 'التنفس العميق'   : 'Deep Breathing',  duration: isRTL ? '5 دقائق'       : '5 minutes',
      color: '#7C5CBF', bg: '#F0EBFA', accent: '#EDE4FA',
      desc: isRTL ? 'استرخِ وتنفس ببطء' : 'Relax and breathe slowly',
      steps: isRTL
        ? ['استنشق ببطء لمدة 4 ثوانٍ', 'احبس النفس 4 ثوانٍ', 'أخرج الهواء ببطء 6 ثوانٍ']
        : ['Inhale slowly for 4 seconds', 'Hold for 4 seconds', 'Exhale slowly for 6 seconds'],
    },
    {
      key: 'stretch', emoji: '🤸', title: isRTL ? 'الإطالة الخفيفة' : 'Light Stretching', duration: isRTL ? '10 دقائق'      : '10 minutes',
      color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
      desc: isRTL ? 'مدّ عضلاتك برفق' : 'Gently stretch your muscles',
      steps: isRTL
        ? ['مد ذراعيك للأعلى', 'دوّر رقبتك برفق', 'انحنِ للأمام ببطء']
        : ['Stretch your arms up', 'Gently rotate your neck', 'Slowly bend forward'],
    },
    {
      key: 'eyes',    emoji: '👁️', title: isRTL ? 'راحة العيون'      : 'Eye Rest',         duration: isRTL ? '3 دقائق'       : '3 minutes',
      color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
      desc: isRTL ? 'أعطِ عينيك استراحة' : 'Give your eyes a break',
      steps: isRTL
        ? ['غطّ عينيك بكفيك', 'انظر إلى شيء بعيد', 'أغمض عينيك دقيقة']
        : ['Cover your eyes with palms', 'Look at something far away', 'Close your eyes for a minute'],
    },
    {
      key: 'water',   emoji: '💧', title: isRTL ? 'اشرب الماء'       : 'Drink Water',      duration: isRTL ? 'دقيقة واحدة'   : '1 minute',
      color: '#29B6D4', bg: '#E1F8FC', accent: '#C0EFF6',
      desc: isRTL ? 'حافظ على ترطيب جسمك' : 'Stay hydrated',
      steps: isRTL
        ? ['اشرب كوباً كاملاً', 'انتظر دقيقة', 'اشرب كوباً آخر إذا أمكن']
        : ['Drink a full glass', 'Wait a minute', 'Drink another if possible'],
    },
  ];

  const ex = EXERCISES.find(e => e.key === selected)!;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header */}
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <RahatiLogo />
          <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={styles.title}>{t.todayExercises}</Text>
            <Text style={styles.subtitle}>{t.chooseExercise}</Text>
          </View>
        </View>

        {/* Cards */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={CARD_W + 14}
          contentContainerStyle={styles.cardsRow}
        >
          {EXERCISES.map(item => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setSelected(item.key)}
              activeOpacity={0.88}
              style={[styles.card, { backgroundColor: item.bg, width: CARD_W }, selected === item.key && { borderWidth: 2.5, borderColor: item.color }]}
            >
              <View style={[styles.cardTopRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.emojiCircle, { backgroundColor: item.accent }]}>
                  <Text style={{ fontSize: 34 }}>{item.emoji}</Text>
                </View>
                {selected === item.key && (
                  <View style={[styles.selectedCheck, { backgroundColor: item.color }]}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[styles.cardTitle, { color: item.color, textAlign: isRTL ? 'right' : 'left' }]}>{item.title}</Text>
              <View style={[styles.durationRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="time-outline" size={14} color={item.color} />
                <Text style={[styles.durationText, { color: item.color }]}> {item.duration}</Text>
              </View>
              <Text style={[styles.cardDesc, { textAlign: isRTL ? 'right' : 'left' }]}>{item.desc}</Text>
              <View style={styles.stepsList}>
                {item.steps.map((s, i) => (
                  <View key={i} style={[styles.stepRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={[styles.stepNum, { backgroundColor: item.color }]}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.stepText, { textAlign: isRTL ? 'right' : 'left' }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {EXERCISES.map(e => (
            <TouchableOpacity key={e.key} onPress={() => setSelected(e.key)}>
              <View style={[styles.dot, selected === e.key && { width: 20, backgroundColor: Colors.primary }]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary */}
        <View style={[styles.summaryCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={{ fontSize: 26 }}>{ex.emoji}</Text>
          <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={styles.summaryTitle}>{ex.title}</Text>
            <Text style={styles.summaryDur}>{ex.duration}</Text>
          </View>
          <View style={[styles.summaryDot, { backgroundColor: ex.color }]} />
        </View>

        <View style={styles.btnWrap}>
          <PrimaryButton title={t.startExercise} onPress={() => {}} color={ex.color} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingTop: Spacing.xl },
  header: { alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  cardsRow: { paddingHorizontal: Spacing.xl, gap: 14, paddingBottom: Spacing.base },
  card: { borderRadius: Radius.xxl, padding: Spacing.xl, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  cardTopRow: { justifyContent: 'space-between', marginBottom: Spacing.base },
  emojiCircle: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  selectedCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '800', marginBottom: 4 },
  durationRow: { alignItems: 'center', marginBottom: 8 },
  durationText: { fontSize: FontSize.sm, fontWeight: '600' },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.base },
  stepsList: { gap: 10 },
  stepRow: { alignItems: 'center', gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  stepText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.base },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  summaryCard: { alignItems: 'center', marginHorizontal: Spacing.xl, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, gap: 12, marginBottom: Spacing.base, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  summaryTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  summaryDur: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  summaryDot: { width: 10, height: 10, borderRadius: 5 },
  btnWrap: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
});