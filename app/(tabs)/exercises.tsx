// app/(tabs)/exercises.tsx  –  تمارين
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../../components/UI';
import RahatiLogo from '../../components/RahatiLogo';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

const { width } = Dimensions.get('window');
const CARD_W = width * 0.7;

const EXERCISES = [
  {
    key: 'deep',      emoji: '🧘', title: 'التنفس العميق',    duration: '5 دقائق',
    color: '#7C5CBF', bg: '#F0EBFA', accent: '#EDE4FA',
    desc: 'استرخِ وتنفس ببطء',
    steps: ['استنشق ببطء لمدة 4 ثوانٍ', 'احبس النفس 4 ثوانٍ', 'أخرج الهواء ببطء 6 ثوانٍ'],
  },
  {
    key: 'stretch',   emoji: '🤸', title: 'الإطالة الخفيفة',  duration: '10 دقائق',
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    desc: 'مدّ عضلاتك برفق',
    steps: ['مد ذراعيك للأعلى', 'دوّر رقبتك برفق', 'انحنِ للأمام ببطء'],
  },
  {
    key: 'eyes',      emoji: '👁️', title: 'راحة العيون',       duration: '3 دقائق',
    color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
    desc: 'أعطِ عينيك استراحة',
    steps: ['غطّ عينيك بكفيك', 'انظر إلى شيء بعيد', 'أغمض عينيك دقيقة'],
  },
  {
    key: 'water',     emoji: '💧', title: 'اشرب الماء',        duration: 'دقيقة واحدة',
    color: '#29B6D4', bg: '#E1F8FC', accent: '#C0EFF6',
    desc: 'حافظ على ترطيب جسمك',
    steps: ['اشرب كوباً كاملاً', 'انتظر دقيقة', 'اشرب كوباً آخر إذا أمكن'],
  },
];

export default function ExercisesScreen() {
  const [selected, setSelected] = useState('deep');
  const ex = EXERCISES.find(e => e.key === selected)!;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <RahatiLogo size={44} showBackground />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.title}>تمارين اليوم</Text>
            <Text style={styles.subtitle}>اختر تمريناً لتبدأ</Text>
          </View>
        </View>

        {/* Horizontal cards */}
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
              style={[
                styles.card,
                { backgroundColor: item.bg, width: CARD_W },
                selected === item.key && { borderWidth: 2.5, borderColor: item.color },
              ]}
            >
              {/* Top row */}
              <View style={styles.cardTopRow}>
                <View style={[styles.emojiCircle, { backgroundColor: item.accent }]}>
                  <Text style={{ fontSize: 34 }}>{item.emoji}</Text>
                </View>
                {selected === item.key && (
                  <View style={[styles.selectedCheck, { backgroundColor: item.color }]}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </View>

              <Text style={[styles.cardTitle, { color: item.color }]}>{item.title}</Text>

              <View style={styles.durationRow}>
                <Ionicons name="time-outline" size={14} color={item.color} />
                <Text style={[styles.durationText, { color: item.color }]}> {item.duration}</Text>
              </View>

              <Text style={styles.cardDesc}>{item.desc}</Text>

              <View style={styles.stepsList}>
                {item.steps.map((s, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={[styles.stepNum, { backgroundColor: item.color }]}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{s}</Text>
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

        {/* Selected summary */}
        <View style={styles.summaryCard}>
          <Text style={{ fontSize: 26 }}>{ex.emoji}</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.summaryTitle}>{ex.title}</Text>
            <Text style={styles.summaryDur}>{ex.duration}</Text>
          </View>
          <View style={[styles.summaryDot, { backgroundColor: ex.color }]} />
        </View>

        {/* CTA */}
        <View style={styles.btnWrap}>
          <PrimaryButton title="ابدأ التمرين" onPress={() => {}} color={ex.color} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingTop: Spacing.xl },

  header: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  cardsRow: { paddingHorizontal: Spacing.xl, gap: 14, paddingBottom: Spacing.base },
  card: { borderRadius: Radius.xxl, padding: Spacing.xl, marginRight: 0, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  cardTopRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: Spacing.base },
  emojiCircle: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  selectedCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '800', textAlign: 'right', marginBottom: 4 },
  durationRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8 },
  durationText: { fontSize: FontSize.sm, fontWeight: '600' },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: Spacing.base },
  stepsList: { gap: 10 },
  stepRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  stepText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.base },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },

  summaryCard: { flexDirection: 'row-reverse', alignItems: 'center', marginHorizontal: Spacing.xl, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, gap: 12, marginBottom: Spacing.base, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  summaryTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  summaryDur: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  summaryDot: { width: 10, height: 10, borderRadius: 5 },

  btnWrap: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },
});
