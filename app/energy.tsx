// app/energy.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../utils/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { useLang } from '../context/Languagecontext';

const SIZE = 220;
const RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_PERCENT = 0.75;
const ARC_LENGTH = CIRCUMFERENCE * ARC_PERCENT;
const ROTATION = 135;

const MARKS = [0, 25, 50, 75, 100];

export default function EnergyScreen() {
  const [energy, setEnergy] = useState(55);
  const router = useRouter();
  const { isRTL } = useLang();

  const getState = (val: number) => {
    if (val <= 25) return { face: '😩', label: isRTL ? 'منهك' : 'Exhausted', color: '#E24B4A' };
    if (val <= 50) return { face: '😐', label: isRTL ? 'متوسطة' : 'Average', color: '#EF9F27' };
    if (val <= 75) return { face: '🙂', label: isRTL ? 'جيدة' : 'Good', color: '#7C5CBF' };
    return           { face: '😄', label: isRTL ? 'ممتازة' : 'Excellent', color: '#1D9E75' };
  };

  const state = getState(energy);

  const filledLength = ARC_LENGTH * (energy / 100);
  const emptyLength  = CIRCUMFERENCE - filledLength;

  const handleSave = async () => {
    const today = new Date().toISOString().split('T')[0];
    const uid   = auth.currentUser?.uid ?? 'guest';

    await AsyncStorage.setItem(`energy_level_${uid}`, String(energy));
    await AsyncStorage.setItem(`energy_date_${uid}`, today);

    if (uid !== 'guest') {
      // FIX: Added 'lastEnergyUpdate: today' to the Firestore document
      setDoc(doc(db, 'users', uid), {
        energyLevel: energy,
        lastEnergyUpdate: today
      }, { merge: true }).catch((err) => {
        console.error("Error saving energy to Firebase:", err);
      });
    }

    router.replace('/tabs/home');
  };

  return (
      <LinearGradient
          colors={["#7C5CBF", "#EDE6F8", "#ffffff"]}
          style={styles.container}
      >
        <StatusBar barStyle="light-content" />

        <View style={styles.navbar}>
          <Text style={styles.navTitle}>{isRTL ? 'طاقتي اليوم' : 'My Energy Today'}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.headingBlock}>
            <Text style={styles.heading1}>{isRTL ? 'ما هي طاقتك اليوم؟' : 'What is your energy today?'}</Text>
            <Text style={styles.heading2}>{isRTL ? 'اختر نسبة طاقتك اليوم' : 'Select your energy percentage'}</Text>
          </View>

          <View style={styles.arcSliderBlock}>
            <View style={styles.arcWrapper}>
              <Svg
                  width={SIZE}
                  height={SIZE}
                  style={{ transform: [{ rotate: `${ROTATION}deg` }] }}
              >
                <Circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth={14}
                    fill="none"
                    strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE - ARC_LENGTH}`}
                    strokeLinecap="round"
                />
                <Circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    stroke={state.color}
                    strokeWidth={14}
                    fill="none"
                    strokeDasharray={`${filledLength} ${emptyLength}`}
                    strokeLinecap="round"
                />
              </Svg>
              <View style={styles.arcCenter}>
                <Text style={styles.percentText}>{energy}%</Text>
                <Text style={styles.faceEmoji}>{state.face}</Text>
                <Text style={[styles.statusLabel, { color: state.color }]}>
                  {state.label}
                </Text>
              </View>
            </View>

            <View style={styles.sliderSection}>
              <View style={styles.marksRow}>
                {MARKS.map((m) => (
                    <View key={m} style={styles.markItem}>
                      <Text style={styles.markLabel}>{m}%</Text>
                      <View style={styles.markTick} />
                    </View>
                ))}
              </View>
              <Slider
                  style={{
                    width: "100%",
                    marginTop: 2,
                    borderWidth: 0.5,
                    borderColor: "#7C5CBF",
                    borderRadius:20,
                  }}
                  minimumValue={1}
                  maximumValue={100}
                  step={1}
                  value={energy}
                  onValueChange={(v) => setEnergy(Math.round(v))}
                  minimumTrackTintColor={state.color}
                  maximumTrackTintColor="rgba(255,255,255,0.4)"
                  thumbTintColor={state.color}
              />
            </View>
          </View>

          <TouchableOpacity
              style={styles.saveBtn}
              activeOpacity={1}
              onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>{isRTL ? 'حفظ الطاقة' : 'Save Energy'}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  navbar: {
    width: "100%",
    paddingTop: 56,
    paddingBottom: 16,
    alignItems: "center",
  },
  navTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
    alignItems: "center",

    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 28,
    paddingBottom: 36,
  },
  headingBlock: { alignItems: "center", gap: 8 },
  heading1: {
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
    alignItems: "center",

    textAlign: "center",
  },
  heading2: {
    fontSize: 18,
    fontWeight: "400",
    color: "#ffffff",
    alignItems: "center",

    textAlign: "center",
  },
  arcSliderBlock: { width: "100%", alignItems: "center", gap: 8 },
  arcWrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  arcCenter: { position: "absolute", alignItems: "center", bottom: 20 },
  percentText: { fontSize: 34, fontWeight: "700", color: "#2d2d2d" },
  faceEmoji: { fontSize: 36, marginVertical: 4 },
  statusLabel: { fontSize: 15, fontWeight: "600" },
  sliderSection: { width: "100%" },
  marksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  markItem: { alignItems: "center", gap: 3 },
  markLabel: { fontSize: 11, color: "#7C5CBF" },
  markTick: {
    width: 1.5,
    height: 6,
    backgroundColor: "#7C5CBF",
    borderRadius: 2,
  },
  saveBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 70,
    alignItems: "center",
    backgroundColor: "#7C5CBF",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});