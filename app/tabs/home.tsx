// app/(tabs)/home.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native';
import RahatiLogo from '../../components/RahatiLogo';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

function FoodGrid({ items, active, onPress, isRTL }: { items: any[]; active: string | null; onPress: (k: string) => void; isRTL: boolean }) {
  return (
    <View style={[styles.grid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
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
  const { t, isRTL } = useLang();
  const [activeUseful, setActiveUseful] = useState<string | null>(null);
  const [activeTrigger, setActiveTrigger] = useState<string | null>(null);

  const USEFUL = [
    { key: 'vegetables', emoji: '🥦', label: t.vegetables, color: '#4CAF82', bg: '#E8F5EF' },
    { key: 'fruits',     emoji: '🍓', label: t.fruits,     color: '#E05C5C', bg: '#FDEAEA' },
    { key: 'nuts',       emoji: '🥜', label: t.nuts,       color: '#C97B3A', bg: '#FEF3E2' },
    { key: 'fish',       emoji: '🐟', label: t.fish,       color: '#5B9BD5', bg: '#E8F1FB' },
  ];
  const TRIGGERS = [
    { key: 'heat',     emoji: '🌶️', label: t.heat,     color: '#E05C5C', bg: '#FDEAEA' },
    { key: 'caffeine', emoji: '☕', label: t.caffeine,  color: '#8B5E3C', bg: '#F5ECE3' },
    { key: 'sugars',   emoji: '🍭', label: t.sugars,    color: '#D15DBF', bg: '#FAE8F8' },
    { key: 'fatty',    emoji: '🍔', label: t.fatty,     color: '#C97B3A', bg: '#FEF3E2' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={styles.topGreet}>{t.goodMorning}</Text>
            <Text style={styles.topTitle}>{t.foodFactors}</Text>
          </View>
          <RahatiLogo />
        </View>

        {/* Tip card */}
        <View style={[styles.tipCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={styles.tipIconWrap}><Text style={{ fontSize: 22 }}>💡</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tipTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t.todayTip}</Text>
            <Text style={[styles.tipText, { textAlign: isRTL ? 'right' : 'left' }]}>{t.tipText}</Text>
          </View>
        </View>

        {/* Useful foods */}
        <View style={styles.section}>
          <View style={[styles.sectionHdr, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={styles.sectionTitle}>{t.usefulFoods}</Text>
              <Text style={styles.sectionSub}>{t.usefulSub}</Text>
            </View>
            <View style={[styles.sectionBadge, { backgroundColor: '#E8F5EF' }]}>
              <Text style={{ fontSize: 16 }}>✅</Text>
            </View>
          </View>
          <FoodGrid items={USEFUL} active={activeUseful} onPress={k => setActiveUseful(activeUseful === k ? null : k)} isRTL={isRTL} />
        </View>

        {/* Trigger foods */}
        <View style={[styles.section, { marginBottom: 100 }]}>
          <View style={[styles.sectionHdr, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={styles.sectionTitle}>{t.symptomTriggers}</Text>
              <Text style={styles.sectionSub}>{t.triggerSub}</Text>
            </View>
            <View style={[styles.sectionBadge, { backgroundColor: '#FDEAEA' }]}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
            </View>
          </View>
          <FoodGrid items={TRIGGERS} active={activeTrigger} onPress={k => setActiveTrigger(activeTrigger === k ? null : k)} isRTL={isRTL} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl },
  topBar: { alignItems: 'center', marginBottom: Spacing.xl, gap: 12 },
  topGreet: { fontSize: FontSize.xs, color: Colors.textMuted },
  topTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  tipCard: { alignItems: 'center', backgroundColor: Colors.primaryMid, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.xl, gap: 12 },
  tipIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primaryDark, marginBottom: 2 },
  tipText: { fontSize: FontSize.xs, color: Colors.primary, lineHeight: 18 },
  section: { marginBottom: Spacing.xl },
  sectionHdr: { alignItems: 'center', marginBottom: Spacing.base, gap: 10 },
  sectionBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  grid: { flexWrap: 'wrap', gap: 14 },
  foodCard: { width: '46.5%', borderRadius: Radius.xl, padding: Spacing.base, alignItems: 'center', justifyContent: 'center', minHeight: 110, position: 'relative', shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  activeDot: { position: 'absolute', top: 10, left: 10, width: 8, height: 8, borderRadius: 4 },
  foodEmoji: { fontSize: 38, marginBottom: 8 },
  foodLabel: { fontSize: FontSize.sm, fontWeight: '700', textAlign: 'center' },
});