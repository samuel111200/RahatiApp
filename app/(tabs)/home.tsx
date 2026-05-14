// app/(tabs)/home.tsx  –  الأكل والعوامل المؤثرة
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RahatiLogo from '../../components/RahatiLogo';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

const USEFUL = [
  { key: 'vegetables', emoji: '🥦', label: 'خضروات', color: '#4CAF82', bg: '#E8F5EF' },
  { key: 'fruits',     emoji: '🍓', label: 'فواكه',   color: '#E05C5C', bg: '#FDEAEA' },
  { key: 'nuts',       emoji: '🥜', label: 'مكسرات',  color: '#C97B3A', bg: '#FEF3E2' },
  { key: 'fish',       emoji: '🐟', label: 'سمك',     color: '#5B9BD5', bg: '#E8F1FB' },
];
const TRIGGERS = [
  { key: 'heat',    emoji: '🌶️', label: 'حرارة عالية',   color: '#E05C5C', bg: '#FDEAEA' },
  { key: 'caffeine',emoji: '☕', label: 'كافيين',         color: '#8B5E3C', bg: '#F5ECE3' },
  { key: 'sugars',  emoji: '🍭', label: 'سكريات',         color: '#D15DBF', bg: '#FAE8F8' },
  { key: 'fatty',   emoji: '🍔', label: 'أطعمة دهنية',   color: '#C97B3A', bg: '#FEF3E2' },
];

function FoodGrid({ items, active, onPress }: { items: typeof USEFUL; active: string | null; onPress: (k: string) => void }) {
  return (
    <View style={styles.grid}>
      {items.map(item => (
        <TouchableOpacity
          key={item.key}
          onPress={() => onPress(item.key)}
          activeOpacity={0.82}
          style={[styles.foodCard, { backgroundColor: item.bg }, active === item.key && { borderWidth: 2.5, borderColor: item.color }]}
        >
          {active === item.key && <View style={[styles.activeDot, { backgroundColor: item.color }]} />}
          <Text style={styles.foodEmoji}>{item.emoji}</Text>
          <Text style={[styles.foodLabel, { color: item.color }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const [activeUseful, setActiveUseful] = useState<string | null>(null);
  const [activeTrigger, setActiveTrigger] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.topGreet}>صباح الخير 🌿</Text>
            <Text style={styles.topTitle}>الأكل والعوامل المؤثرة</Text>
          </View>
          <RahatiLogo size={44} showBackground />
        </View>

        {/* ── Tip card ── */}
        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}><Text style={{ fontSize: 22 }}>💡</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>نصيحة اليوم</Text>
            <Text style={styles.tipText}>تناول وجبة غنية بالخضروات والبروتين لتعزيز طاقتك خلال اليوم.</Text>
          </View>
        </View>

        {/* ── Useful foods ── */}
        <View style={styles.section}>
          <View style={styles.sectionHdr}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.sectionTitle}>الأطعمة المفيدة</Text>
              <Text style={styles.sectionSub}>مفيدة لصحتك</Text>
            </View>
            <View style={[styles.sectionBadge, { backgroundColor: '#E8F5EF' }]}>
              <Text style={{ fontSize: 16 }}>✅</Text>
            </View>
          </View>
          <FoodGrid items={USEFUL} active={activeUseful} onPress={k => setActiveUseful(activeUseful === k ? null : k)} />
        </View>

        {/* ── Trigger foods ── */}
        <View style={[styles.section, { marginBottom: 100 }]}>
          <View style={styles.sectionHdr}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.sectionTitle}>محفزات الأعراض</Text>
              <Text style={styles.sectionSub}>تجنبها قدر الإمكان</Text>
            </View>
            <View style={[styles.sectionBadge, { backgroundColor: '#FDEAEA' }]}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
            </View>
          </View>
          <FoodGrid items={TRIGGERS} active={activeTrigger} onPress={k => setActiveTrigger(activeTrigger === k ? null : k)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl },

  topBar: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: Spacing.xl, gap: 12 },
  topGreet: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right' },
  topTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right' },

  tipCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: Colors.primaryMid, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.xl, gap: 12 },
  tipIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primaryDark, textAlign: 'right', marginBottom: 2 },
  tipText: { fontSize: FontSize.xs, color: Colors.primary, textAlign: 'right', lineHeight: 18 },

  section: { marginBottom: Spacing.xl },
  sectionHdr: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: Spacing.base, gap: 10 },
  sectionBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 14 },
  foodCard: {
    width: '46.5%', borderRadius: Radius.xl, padding: Spacing.base,
    alignItems: 'center', justifyContent: 'center', minHeight: 110, position: 'relative',
    shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  activeDot: { position: 'absolute', top: 10, left: 10, width: 8, height: 8, borderRadius: 4 },
  foodEmoji: { fontSize: 38, marginBottom: 8 },
  foodLabel: { fontSize: FontSize.sm, fontWeight: '700', textAlign: 'center' },
});
