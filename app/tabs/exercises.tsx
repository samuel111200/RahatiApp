// app/(tabs)/exercises.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { notify, suppressTaskListNotifOnce } from './notificationService';

const { width, height } = Dimensions.get('window');
const CARD_W = width * 0.72;
const CARD_H = height * 0.50;

// ─── Types ────────────────────────────────────────────────
type ExerciseType = 'core' | 'extra';

type Exercise = {
  key: string;
  emoji: string;
  title: string;
  titleEn: string;
  duration: string;
  durationEn: string;
  durationSeconds: number;
  color: string;
  bg: string;
  accent: string;
  desc: string;
  descEn: string;
  steps: string[];
  stepsEn: string[];
  animType: 'hipMarch' | 'armRaise' | 'standingRow' | 'legCurl' | 'rollUp' | 'achillesRelease' | 'bounce' | 'sway';
  type: ExerciseType;
  custom?: boolean;
  date?: string;
};

// ─── Storage Keys ─────────────────────────────────────────
const CORE_EXERCISES_KEY  = 'core_exercises';
const EXTRA_EXERCISES_KEY = 'extra_exercises';

// ─── Congrats ─────────────────────────────────────────────
const CONGRATS_AR = [
  'أحسنت! 🎉 استمر على هذا الإيقاع الرائع',
  'رائع جداً! 💪 جسمك يشكرك على هذه الاستراحة',
  'ممتاز! 🌟 كل تمرين صغير يصنع فرقاً كبيراً',
  'أنت بطل! 🏆 الاستمرارية هي سر النجاح',
  'جميل جداً! 🌸 استراحة قصيرة تعيد الطاقة والتركيز',
];
const CONGRATS_EN = [
  'Well done! 🎉 Keep up this amazing pace',
  'Awesome! 💪 Your body thanks you for this break',
  'Excellent! 🌟 Every small exercise makes a big difference',
  "You're a champion! 🏆 Consistency is the key to success",
  'Beautiful! 🌸 A short break restores energy and focus',
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function speakStep(text: string, isRTL: boolean) {
  Speech.stop();
  Speech.speak(text, {
    language: isRTL ? 'ar-SA' : 'en-US',
    pitch: 1.05,
    rate: isRTL ? 0.82 : 0.88,
  });
}

// ─── Default exercises ────────────────────────────────────
const DEFAULT_CORE_EXERCISES: Exercise[] = [
  {
    key: 'hipMarch',
    emoji: '🦵', title: 'رفع الركبة (Hip Marching)', titleEn: 'Hip Marching',
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#7C5CBF', bg: '#F0EBFA', accent: '#EDE4FA',
    desc: 'تقوية عضلات الفخذ والورك أثناء الجلوس',
    descEn: 'Strengthen thigh and hip muscles while sitting',
    steps: ['اجلس على كرسي وظهرك مستقيم', 'ارفع ساقك اليسرى ببطء مع ثني الركبة', 'اثبت 5 ثوانٍ ثم أنزلها', 'كرر مع الساق اليمنى'],
    stepsEn: ['Sit on a chair with your back straight', 'Slowly raise your left leg with knee bent', 'Hold for 5 seconds then lower it', 'Repeat with the right leg'],
    animType: 'hipMarch', type: 'core',
  },
  {
    key: 'armRaise',
    emoji: '🙌', title: 'رفع الذراع (Arm Raise)', titleEn: 'Arm Raise',
    duration: '3 دقائق', durationEn: '3 minutes', durationSeconds: 180,
    color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
    desc: 'تقوية عضلات الكتف والذراع',
    descEn: 'Strengthen shoulder and arm muscles',
    steps: ['اجلس على كرسي وظهرك مستقيم', 'مد إحدى ذراعيك على الجانب', 'ارفعها فوق رأسك مع الحفاظ على استقامتها', 'خذ نفساً عميقاً ثم أنزل الذراع'],
    stepsEn: ['Sit on a chair with your back straight', 'Extend one arm to the side', 'Raise it above your head keeping it straight', 'Take a deep breath then lower your arm'],
    animType: 'armRaise', type: 'core',
  },
  {
    key: 'standingRow',
    emoji: '💪', title: 'السحب الواقف (Standing Row)', titleEn: 'Standing Row',
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    desc: 'تقوية عضلات الظهر والكتفين بالشريط المطاطي',
    descEn: 'Strengthen back and shoulder muscles with resistance band',
    steps: ['ثبّت الشريط حول عمود ثابت وأمسك بمقابضه', 'ابتعد خطوات للخلف حتى يشتد الشريط', 'اسحب المقابض نحوك حتى يصل مرفقاك للخلف', 'اضغط لوحي الكتف ثم عد ببطء'],
    stepsEn: ['Fix band around a stable pole and hold handles', 'Step back until the band is taut', 'Pull handles toward you until elbows are behind you', 'Squeeze shoulder blades then slowly return'],
    animType: 'standingRow', type: 'core',
  },
];

const DEFAULT_EXTRA_EXERCISES: Exercise[] = [
  {
    key: 'legCurl',
    emoji: '🦶', title: 'ثني الساق للخلف', titleEn: 'Leg Curl',
    duration: '3 دقائق', durationEn: '3 minutes', durationSeconds: 180,
    color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
    desc: 'تقوية عضلات الجزء الخلفي من الساق',
    descEn: 'Strengthen the muscles of the back of the leg',
    steps: ['قف وأمسك مسند كرسي للتوازن', 'ارفع كعب قدمك للخلف وللأعلى ببطء', 'اقتصر الحركة على مفصل الركبة فقط', 'أنزل القدم ببطء وكرر'],
    stepsEn: ['Stand and hold chair back for balance', 'Slowly lift your heel backward and upward', 'Limit movement to the knee joint only', 'Lower your foot slowly and repeat'],
    animType: 'legCurl', type: 'extra',
  },
  {
    key: 'rollUp',
    emoji: '🧘', title: 'التدحرج لأعلى (Roll-ups)', titleEn: 'Roll-ups',
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    desc: 'تقوية عضلات البطن والظهر',
    descEn: 'Strengthen abdominal and back muscles',
    steps: ['استلقِ على سجادة مع مد ساقيك', 'مد يديك فوق رأسك', 'ارفع الكتفين والجزء العلوي من الظهر ببطء', 'توقف ثانيتين ثم انزل ببطء'],
    stepsEn: ['Lie on a mat with legs extended', 'Extend your arms above your head', 'Slowly raise shoulders and upper back', 'Hold 2 seconds then slowly lower'],
    animType: 'rollUp', type: 'extra',
  },
  {
    key: 'achillesRelease',
    emoji: '👟', title: 'إرخاء وتر أكيليس', titleEn: 'Achilles Tendon Release',
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#2A9D8F', bg: '#E8F7F5', accent: '#C8EDE9',
    desc: 'إطالة وعلاج العضلات المشدودة في الجزء الخلفي من الساق والكعب',
    descEn: 'Stretch and treat tightness in the back of the leg and heel',
    steps: ['اجلس على كرسي وافرد إحدى ساقيك للأمام، ثم لف شريطاً مطاطياً حول باطن قدمك', 'افرد ظهرك واجعل قوامك مستقيماً', 'اسحب الشريط ببطء نحوك لترجع قدمك باتجاهك', 'الحركة تقتصر على مفصل الكاحل فقط'],
    stepsEn: ['Sit on a chair, extend one leg forward, loop a band around the sole of your foot', 'Straighten your back and gently draw your belly inward', 'Slowly pull the band toward you to flex your foot back', 'Movement should come only from the ankle joint'],
    animType: 'achillesRelease', type: 'extra',
  },
];

// ════════════════════════════════════════════════════════════
// ─── Main Screen ──────────────────────────────────────────
// ════════════════════════════════════════════════════════════
export default function ExercisesScreen() {
  const { t, isRTL } = useLang();
  const navigation   = useNavigation();

  const [coreList,      setCoreList]      = useState<Exercise[]>([]);
  const [extraList,     setExtraList]     = useState<Exercise[]>([]);
  const [selected,      setSelected]      = useState('hipMarch');
  const [activeSection, setActiveSection] = useState<'core' | 'extra'>('core');
  const [energy,        setEnergy]        = useState(50);
  const [timerActive,   setTimerActive]   = useState(false);
  const [timeLeft,      setTimeLeft]      = useState(0);
  const [showDone,      setShowDone]      = useState(false);
  const [showAdd,       setShowAdd]       = useState(false);
  const [newName,       setNewName]       = useState('');
  const [newEmoji,      setNewEmoji]      = useState('🏋️');
  const [newMinutes,    setNewMinutes]    = useState('');
  const [newDesc,       setNewDesc]       = useState('');
  const [newType,       setNewType]       = useState<ExerciseType>('core');
  const [activeStep,    setActiveStep]    = useState(-1);
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [savingEx,      setSavingEx]      = useState(false);

  const congratsIdx  = useRef(Math.floor(Math.random() * CONGRATS_AR.length)).current;
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Load ──
  useFocusEffect(useCallback(() => {
    loadAllExercises();

    return () => {
      Speech.stop();
      setIsSpeaking(false);
      setActiveStep(-1);
    };
  }, []));

  async function loadAllExercises() {
    const storedEnergy = await AsyncStorage.getItem('energy_level');
    if (storedEnergy) setEnergy(Number(storedEnergy));

    const storedCore = await AsyncStorage.getItem(CORE_EXERCISES_KEY);
    if (storedCore) {
      setCoreList(JSON.parse(storedCore));
    } else {
      await AsyncStorage.setItem(CORE_EXERCISES_KEY, JSON.stringify(DEFAULT_CORE_EXERCISES));
      setCoreList(DEFAULT_CORE_EXERCISES);
    }

    const storedExtra = await AsyncStorage.getItem(EXTRA_EXERCISES_KEY);
    if (storedExtra) {
      const parsed: Exercise[] = JSON.parse(storedExtra);
      const today = todayKey();
      const filtered = parsed.filter((e: any) => !e.date || e.date === today);
      if (filtered.length !== parsed.length) {
        await AsyncStorage.setItem(EXTRA_EXERCISES_KEY, JSON.stringify(filtered));
      }
      setExtraList(filtered);
    } else {
      await AsyncStorage.setItem(EXTRA_EXERCISES_KEY, JSON.stringify(DEFAULT_EXTRA_EXERCISES));
      setExtraList(DEFAULT_EXTRA_EXERCISES);
    }
  }

  const SECTION_EXERCISES = activeSection === 'core' ? coreList : extraList;
  const ex = [...coreList, ...extraList].find(e => e.key === selected)
    ?? coreList[0]
    ?? DEFAULT_CORE_EXERCISES[0];

  // ── TTS ──
  function speakAllSteps(exercise: Exercise) {
    const stepsToRead = isRTL ? exercise.steps : exercise.stepsEn;
    if (!stepsToRead.length) return;
    setIsSpeaking(true);
    setActiveStep(0);
    function readStep(index: number) {
      if (index >= stepsToRead.length) { setIsSpeaking(false); setActiveStep(-1); return; }
      setActiveStep(index);
      Speech.speak(stepsToRead[index], {
        language: isRTL ? 'ar-SA' : 'en-US',
        pitch: 1.05,
        rate: isRTL ? 0.80 : 0.85,
        onDone: () => { stepTimerRef.current = setTimeout(() => readStep(index + 1), 600); },
        onStopped: () => { setIsSpeaking(false); setActiveStep(-1); },
      });
    }
    readStep(0);
  }

  function stopSpeaking() {
    Speech.stop();
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    setIsSpeaking(false);
    setActiveStep(-1);
  }

  // ── Timer ──
  function startTimer() {
    if (timerActive) {
      clearInterval(intervalRef.current!);
      setTimerActive(false);
      setTimeLeft(0);
      stopSpeaking();
      return;
    }
    setTimeLeft(ex.durationSeconds);
    setTimerActive(true);
    speakAllSteps(ex);
  }

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setTimerActive(false);
            setShowDone(true);
            stopSpeaking();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerActive]);

  useEffect(() => {
    clearInterval(intervalRef.current!);
    setTimerActive(false);
    setTimeLeft(0);
    stopSpeaking();
  }, [selected]);

  // ── Long Press ──
  function handleLongPressStart(item: Exercise) {
    longPressTimers.current[item.key] = setTimeout(() => {
      const title = isRTL ? item.title : item.titleEn;
      const convertLabel = item.type === 'core'
        ? (isRTL ? '⚡ حوّل لإضافي' : '⚡ Move to Extra')
        : (isRTL ? '⭐ حوّل لأساسي' : '⭐ Move to Core');

      Alert.alert(
        isRTL ? 'خيارات التمرين' : 'Exercise Options',
        `"${title}"`,
        [
          { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: convertLabel, onPress: () => handleConvertExercise(item) },
          {
            text: isRTL ? '🗑️ حذف' : '🗑️ Delete',
            style: 'destructive',
            onPress: () => handleDeleteExercise(item),
          },
        ]
      );
    }, 600);
  }

  function handleLongPressEnd(key: string) {
    if (longPressTimers.current[key]) {
      clearTimeout(longPressTimers.current[key]);
      delete longPressTimers.current[key];
    }
  }

  // ── Convert exercise (core ↔ extra) ──
  async function handleConvertExercise(item: Exercise) {
    const newExType: ExerciseType = item.type === 'core' ? 'extra' : 'core';
    const converted: Exercise = {
      ...item,
      type: newExType,
      ...(newExType === 'extra' ? { date: todayKey() } : { date: undefined }),
    };

    if (item.type === 'core') {
      const updatedCore = coreList.filter(e => e.key !== item.key);
      const updatedExtra = [...extraList, converted];
      setCoreList(updatedCore);
      setExtraList(updatedExtra);
      await AsyncStorage.setItem(CORE_EXERCISES_KEY, JSON.stringify(updatedCore));
      await AsyncStorage.setItem(EXTRA_EXERCISES_KEY, JSON.stringify(updatedExtra));
    } else {
      const updatedExtra = extraList.filter(e => e.key !== item.key);
      const updatedCore = [...coreList, converted];
      setExtraList(updatedExtra);
      setCoreList(updatedCore);
      await AsyncStorage.setItem(EXTRA_EXERCISES_KEY, JSON.stringify(updatedExtra));
      await AsyncStorage.setItem(CORE_EXERCISES_KEY, JSON.stringify(updatedCore));
    }

    await AsyncStorage.setItem('data_changed_at', Date.now().toString());
    setActiveSection(newExType);
    setSelected(converted.key);

    suppressTaskListNotifOnce();
    await notify({
      title: isRTL ? 'تم التحويل ✅' : 'Exercise Moved ✅',
      body: isRTL
        ? `"${item.title}" اتحول لـ${newExType === 'core' ? 'الأساسي' : 'الإضافي'}`
        : `"${item.titleEn}" moved to ${newExType === 'core' ? 'Core' : 'Extra'}`,
      emoji: item.emoji,
      type: 'add',
    });
  }

  // ── Delete exercise ──
  async function handleDeleteExercise(item: Exercise) {
    suppressTaskListNotifOnce();

    if (item.type === 'core') {
      const updated = coreList.filter(e => e.key !== item.key);
      setCoreList(updated);
      await AsyncStorage.setItem(CORE_EXERCISES_KEY, JSON.stringify(updated));
      if (selected === item.key && updated.length > 0) setSelected(updated[0].key);
    } else {
      const updated = extraList.filter(e => e.key !== item.key);
      setExtraList(updated);
      await AsyncStorage.setItem(EXTRA_EXERCISES_KEY, JSON.stringify(updated));
      if (selected === item.key && updated.length > 0) setSelected(updated[0].key);
    }

    await AsyncStorage.setItem('data_changed_at', Date.now().toString());

    await notify({
      title: isRTL ? 'تم حذف التمرين 🗑️' : 'Exercise Deleted 🗑️',
      body: isRTL
        ? `"${item.title}" تم حذفه`
        : `"${item.titleEn}" has been deleted`,
      emoji: item.emoji,
      type: 'delete',
    });
  }

  // ── Open / Close Add Modal ──
  const openAddModal = () => {
    setNewName('');
    setNewEmoji('🏋️');
    setNewMinutes('2');
    setNewDesc('');
    setNewType(activeSection);
    setSavingEx(false);
    setShowAdd(true);
  };

  const closeAddModal = () => {
    setShowAdd(false);
    setNewName('');
    setNewEmoji('🏋️');
    setNewMinutes('');
    setNewDesc('');
    setSavingEx(false);
  };

  // ── Add Custom Exercise ──
  async function handleAddExercise() {
    if (!newName.trim()) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Notice',
        isRTL ? 'يرجى إدخال اسم التمرين' : 'Please enter exercise name'
      );
      return;
    }
    if (!newMinutes.trim()) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Notice',
        isRTL ? 'يرجى إدخال المدة' : 'Please enter duration'
      );
      return;
    }
    const mins = parseInt(newMinutes);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Notice',
        isRTL ? 'أدخل عدداً صحيحاً للدقائق' : 'Enter a valid number of minutes'
      );
      return;
    }
    if (savingEx) return;
    setSavingEx(true);

    try {
      const newEx: Exercise = {
        key:             `custom_${Date.now()}`,
        emoji:           newEmoji.trim() || '🏋️',
        title:           newName.trim(),
        titleEn:         newName.trim(),
        duration:        `${mins} ${isRTL ? 'دقيقة' : 'min'}`,
        durationEn:      `${mins} min`,
        durationSeconds: mins * 60,
        color:           '#7C5CBF',
        bg:              '#F0EBFA',
        accent:          '#EDE4FA',
        desc:            newDesc.trim() || (isRTL ? 'تمرين مخصص' : 'Custom exercise'),
        descEn:          newDesc.trim() || 'Custom exercise',
        steps:           [],
        stepsEn:         [],
        animType:        'bounce',
        type:            newType,
        custom:          true,
        ...(newType === 'extra' ? { date: todayKey() } : {}),
      };

      closeAddModal();

      if (newType === 'core') {
        const updated = [...coreList, newEx];
        setCoreList(updated);
        await AsyncStorage.setItem(CORE_EXERCISES_KEY, JSON.stringify(updated));
      } else {
        const updated = [...extraList, newEx];
        setExtraList(updated);
        await AsyncStorage.setItem(EXTRA_EXERCISES_KEY, JSON.stringify(updated));
      }

      await AsyncStorage.setItem('data_changed_at', Date.now().toString());
      setSelected(newEx.key);
      setActiveSection(newType);

      suppressTaskListNotifOnce();
      await notify({
        title: isRTL ? 'تمت إضافة تمرين ✅' : 'Exercise Added ✅',
        body: isRTL
          ? `"${newEx.title}" اتضاف لقسم ${newType === 'core' ? 'الأساسي' : 'الإضافي'}`
          : `"${newEx.titleEn}" added to ${newType === 'core' ? 'Core' : 'Extra'} exercises`,
        emoji: newEx.emoji,
        type: 'add',
      });
    } catch (e) {
      console.warn('handleAddExercise error:', e);
      setSavingEx(false);
    }
  }

  const steps   = isRTL ? ex.steps    : ex.stepsEn;
  const exTitle = isRTL ? ex.title    : ex.titleEn;
  const exDesc  = isRTL ? ex.desc     : ex.descEn;
  const exDur   = isRTL ? ex.duration : ex.durationEn;

  // ── Render cards ──
  function renderCards(list: Exercise[]) {
    return list.map((item) => {
      const iSel   = selected === item.key;
      const iTitle = isRTL ? item.title    : item.titleEn;
      const iDesc  = isRTL ? item.desc     : item.descEn;
      const iDur   = isRTL ? item.duration : item.durationEn;
      const iSteps = isRTL ? item.steps    : item.stepsEn;

      return (
        <TouchableOpacity
          key={item.key}
          onPress={() => setSelected(item.key)}
          onPressIn={() => handleLongPressStart(item)}
          onPressOut={() => handleLongPressEnd(item.key)}
          delayLongPress={600}
          activeOpacity={0.88}
          style={[
            styles.card,
            { backgroundColor: item.bg, width: CARD_W },
            iSel && { borderWidth: 2.5, borderColor: item.color },
          ]}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.emojiCircle, { backgroundColor: item.accent }]}>
              <Text style={{ fontSize: 30 }}>{item.emoji}</Text>
            </View>
            {iSel && (
              <View style={[styles.selectedCheck, { backgroundColor: item.color }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
            <View style={[styles.exerciseTypeBadge, {
              backgroundColor: item.type === 'core' ? '#7C5CBF22' : '#F4A32B22',
            }]}>
              <Text style={[styles.exerciseTypeBadgeText, {
                color: item.type === 'core' ? '#7C5CBF' : '#C97B3A',
              }]}>
                {item.type === 'core' ? '⭐' : '⚡'}
              </Text>
            </View>
          </View>

          <Text style={[styles.cardTitle, { color: item.color, textAlign: isRTL ? 'right' : 'left' }]}>
            {iTitle}
          </Text>
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={13} color={item.color} />
            <Text style={[styles.durationText, { color: item.color }]}> {iDur}</Text>
          </View>
          <Text style={[styles.cardDesc, { textAlign: isRTL ? 'right' : 'left' }]}>{iDesc}</Text>

          {/* ── Timer active: show big emoji + active step ── */}
          {iSel && timerActive ? (
            <View style={styles.activeTimerBox}>
              <Text style={styles.activeTimerEmoji}>{item.emoji}</Text>
              {isSpeaking && activeStep >= 0 && iSteps.length > 0 && (
                <View style={[styles.activeStepBanner, { backgroundColor: item.color + '18', borderColor: item.color + '44' }]}>
                  <View style={styles.progressDots}>
                    {iSteps.map((_, i) => (
                      <View key={i} style={[styles.progressDot, { backgroundColor: i === activeStep ? item.color : item.color + '33' }, i === activeStep && { width: 16 }]} />
                    ))}
                  </View>
                  <View style={styles.activeStepRow}>
                    <Ionicons name="volume-high" size={13} color={item.color} />
                    <Text style={[styles.activeStepTxt, { color: item.color }]} numberOfLines={2}>
                      {iSteps[activeStep]}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.stepsArea}>
              {iSteps.map((step, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => speakStep(step, isRTL)}
                  style={[styles.stepRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.stepNum, { backgroundColor: item.color + 'AA' }]}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { textAlign: isRTL ? 'right' : 'left' }]}>{step}</Text>
                </TouchableOpacity>
              ))}
              {iSel && iSteps.length > 0 && (
                <TouchableOpacity
                  style={[styles.speakBtn, { borderColor: item.color, backgroundColor: item.bg }]}
                  onPress={() => speakAllSteps(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="volume-high-outline" size={16} color={item.color} />
                  <Text style={[styles.speakBtnText, { color: item.color }]}>
                    {isRTL ? 'اقرأ الخطوات' : 'Read steps aloud'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Navbar ── */}
        <View style={styles.navbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={22} color="#7C5CBF" />
          </TouchableOpacity>
          <View style={styles.navCenter}>
            <Text style={styles.navTitle}>{isRTL ? 'تمارين اليوم' : "Today's Exercises"}</Text>
            <Text style={styles.navSub}>{isRTL ? 'اضغط مطولاً للخيارات' : 'Long press for options'}</Text>
          </View>
          <TouchableOpacity onPress={openAddModal} style={styles.navBtn}>
            <Ionicons name="add" size={24} color="#7C5CBF" />
          </TouchableOpacity>
        </View>

        {/* ── Section Toggle ── */}
        <View style={styles.sectionToggle}>
          <TouchableOpacity
            style={[styles.sectionBtn, activeSection === 'core' && styles.sectionBtnActive]}
            onPress={() => setActiveSection('core')}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={14} color={activeSection === 'core' ? '#fff' : '#7C5CBF'} />
            <Text style={[styles.sectionBtnText, activeSection === 'core' && styles.sectionBtnTextActive]}>
              {isRTL ? 'الأساسي' : 'Core'}
            </Text>
            <View style={[styles.sectionCount, { backgroundColor: activeSection === 'core' ? 'rgba(255,255,255,0.3)' : '#7C5CBF22' }]}>
              <Text style={[styles.sectionCountText, { color: activeSection === 'core' ? '#fff' : '#7C5CBF' }]}>
                {coreList.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sectionBtn, activeSection === 'extra' && styles.sectionBtnActive]}
            onPress={() => setActiveSection('extra')}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={14} color={activeSection === 'extra' ? '#fff' : '#7C5CBF'} />
            <Text style={[styles.sectionBtnText, activeSection === 'extra' && styles.sectionBtnTextActive]}>
              {isRTL ? 'الإضافي' : 'Extra'}
            </Text>
            <View style={[styles.sectionCount, { backgroundColor: activeSection === 'extra' ? 'rgba(255,255,255,0.3)' : '#7C5CBF22' }]}>
              <Text style={[styles.sectionCountText, { color: activeSection === 'extra' ? '#fff' : '#7C5CBF' }]}>
                {extraList.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Section Description ── */}
        <View style={styles.sectionDesc}>
          <Ionicons
            name={activeSection === 'core' ? 'refresh-circle-outline' : 'calendar-outline'}
            size={14}
            color="#7C5CBF99"
          />
          <Text style={styles.sectionDescText}>
            {activeSection === 'core'
              ? (isRTL ? 'تمارين يومية ثابتة — موجودة دايماً' : 'Daily fixed exercises — always available')
              : (isRTL ? 'تمارين إضافية ليوم واحد فقط' : 'Extra exercises for today only')}
          </Text>
        </View>

        {/* ── Cards ── */}
        {SECTION_EXERCISES.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={{ fontSize: 44 }}>{activeSection === 'core' ? '⭐' : '⚡'}</Text>
            <Text style={styles.emptySectionText}>
              {isRTL
                ? (activeSection === 'core' ? 'مفيش تمارين أساسية بعد' : 'مفيش تمارين إضافية لليوم دة')
                : (activeSection === 'core' ? 'No core exercises yet' : 'No extra exercises for today')}
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => { setNewType(activeSection); openAddModal(); }}
            >
              <Ionicons name="add" size={16} color="#7C5CBF" />
              <Text style={styles.emptyAddText}>
                {isRTL ? 'أضف تمرين' : 'Add Exercise'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={CARD_W + 14}
            contentContainerStyle={styles.cardsRow}
            style={{ flexGrow: 0 }}
          >
            {renderCards(SECTION_EXERCISES)}
          </ScrollView>
        )}

        {/* ── Dots ── */}
        <View style={styles.dotsRow}>
          {SECTION_EXERCISES.map((e) => (
            <TouchableOpacity key={e.key} onPress={() => setSelected(e.key)}>
              <View style={[styles.dot, selected === e.key && { width: 20, backgroundColor: Colors.primary }]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Timer Button ── */}
        <View style={styles.timerWrap}>
          {(timerActive || timeLeft > 0) && (
            <Text style={[styles.timerCountdown, { color: ex.color }]}>
              {formatTime(timeLeft)}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.timerBtn, { backgroundColor: ex.bg, borderColor: ex.color }]}
            onPress={startTimer}
            activeOpacity={0.85}
          >
            <Ionicons
              name={timerActive ? 'stop-circle-outline' : 'play-circle-outline'}
              size={26}
              color={ex.color}
            />
            <Text style={[styles.timerBtnText, { color: ex.color }]}>
              {timerActive
                ? (isRTL ? 'إيقاف التمرين' : 'Stop Exercise')
                : (isRTL ? `ابدأ التمرين · ${exDur}` : `Start · ${exDur}`)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ Done Modal ══ */}
      <Modal visible={showDone} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={[modal.box, { borderTopColor: ex.color }]}>
            <Text style={modal.bigEmoji}>{ex.emoji}</Text>
            <Text style={[modal.doneTitle, { color: ex.color }]}>
              {isRTL ? 'أحسنت! انتهى التمرين 🎉' : 'Well done! Exercise complete 🎉'}
            </Text>
            <Text style={modal.doneMsg}>
              {isRTL ? CONGRATS_AR[congratsIdx] : CONGRATS_EN[congratsIdx]}
            </Text>
            <TouchableOpacity
              style={[modal.doneBtn, { backgroundColor: ex.color }]}
              onPress={() => setShowDone(false)}
            >
              <Text style={modal.doneBtnText}>
                {isRTL ? 'شكراً، متشجع! 💪' : 'Thanks, motivated! 💪'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ Add Exercise Modal ══ */}
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={closeAddModal}
        statusBarTranslucent={false}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1}
            onPress={closeAddModal}
          />

          <View style={modal.addBox}>
            <View style={modal.addHeader}>
              <Text style={modal.addTitle}>
                {isRTL ? 'إضافة تمرين جديد' : 'Add New Exercise'}
              </Text>
              <TouchableOpacity onPress={closeAddModal} style={modal.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#888" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={modal.label}>{isRTL ? 'نوع التمرين' : 'Exercise Type'}</Text>
              <View style={modal.typeRow}>
                <TouchableOpacity
                  style={[modal.typeBtn, newType === 'core' && modal.typeBtnActive]}
                  onPress={() => setNewType('core')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="star" size={16} color={newType === 'core' ? '#fff' : '#7C5CBF'} />
                  <Text style={[modal.typeBtnText, newType === 'core' && modal.typeBtnTextActive]}>
                    {isRTL ? 'أساسي 🔁' : 'Core 🔁'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modal.typeBtn, newType === 'extra' && modal.typeBtnActive]}
                  onPress={() => setNewType('extra')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash" size={16} color={newType === 'extra' ? '#fff' : '#7C5CBF'} />
                  <Text style={[modal.typeBtnText, newType === 'extra' && modal.typeBtnTextActive]}>
                    {isRTL ? 'إضافي ⚡ (اليوم بس)' : 'Extra ⚡ (Today only)'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={modal.label}>{isRTL ? 'الإيموجي' : 'Emoji'}</Text>
              <TextInput
                style={modal.emojiInput}
                value={newEmoji}
                onChangeText={setNewEmoji}
                placeholder="🏋️"
                maxLength={4}
                textAlign="center"
              />

              <Text style={modal.label}>{isRTL ? 'اسم التمرين *' : 'Exercise name *'}</Text>
              <TextInput
                style={[modal.input, { textAlign: isRTL ? 'right' : 'left' }]}
                value={newName}
                onChangeText={setNewName}
                placeholder={isRTL ? 'مثال: مشي على السلم' : 'e.g. Stair walking'}
                placeholderTextColor="#bbb"
                returnKeyType="next"
              />

              <Text style={modal.label}>{isRTL ? 'المدة بالدقائق *' : 'Duration (minutes) *'}</Text>
              <TextInput
                style={[modal.input, { textAlign: isRTL ? 'right' : 'left' }]}
                value={newMinutes}
                onChangeText={setNewMinutes}
                placeholder={isRTL ? 'مثال: 5' : 'e.g. 5'}
                placeholderTextColor="#bbb"
                keyboardType="numeric"
                returnKeyType="next"
              />

              <Text style={modal.label}>{isRTL ? 'وصف (اختياري)' : 'Description (optional)'}</Text>
              <TextInput
                style={[modal.input, modal.inputMulti, { textAlign: isRTL ? 'right' : 'left' }]}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder={isRTL ? 'وصف قصير للتمرين' : 'Short description'}
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={2}
              />

              <TouchableOpacity
                style={[modal.saveBtn, savingEx && { opacity: 0.6 }]}
                onPress={handleAddExercise}
                disabled={savingEx}
                activeOpacity={0.85}
              >
                <Text style={modal.saveBtnText}>
                  {savingEx
                    ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                    : (isRTL ? '✅ حفظ التمرين' : '✅ Save Exercise')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingTop: Spacing.base },

  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle:  { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  navSub:    { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },

  sectionToggle: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    backgroundColor: '#F0EBFA',
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
    gap: 4,
  },
  sectionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
  },
  sectionBtnActive:     { backgroundColor: '#7C5CBF' },
  sectionBtnText:       { fontSize: 13, fontWeight: '700', color: '#7C5CBF' },
  sectionBtnTextActive: { color: '#fff' },
  sectionCount: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionCountText: { fontSize: 10, fontWeight: '800' },

  sectionDesc: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.xl, marginBottom: 8,
  },
  sectionDescText: { fontSize: 11, color: '#7C5CBF99', fontStyle: 'italic' },

  cardsRow: { paddingHorizontal: Spacing.xl, gap: 14, paddingBottom: Spacing.sm },
  card: {
    borderRadius: Radius.xxl, padding: Spacing.sm,
    height: CARD_H,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  cardTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  emojiCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  selectedCheck:        { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  exerciseTypeBadge:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  exerciseTypeBadgeText:{ fontSize: 13 },
  cardTitle:      { fontSize: FontSize.base, fontWeight: '800', marginBottom: 3 },
  durationRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  durationText:   { fontSize: FontSize.sm, fontWeight: '600' },
  cardDesc:       { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 8 },

  // ── Active timer box (replaces animBox) ──
  activeTimerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  activeTimerEmoji: { fontSize: 72 },

  activeStepBanner: {
    width: '100%', borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 10, paddingVertical: 7, gap: 5,
  },
  progressDots:   { flexDirection: 'row', gap: 4, alignItems: 'center' },
  progressDot:    { height: 5, width: 5, borderRadius: 3 },
  activeStepRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  activeStepTxt:  { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },

  stepsArea: { gap: 5, flex: 1 },
  stepRow:   { alignItems: 'center', gap: 7, paddingHorizontal: 4, paddingVertical: 3 },
  stepNum:   { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  stepText:  { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },

  speakBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 7, paddingHorizontal: 12, marginTop: 4,
  },
  speakBtnText: { fontSize: 12, fontWeight: '700' },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm },
  dot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },

  timerWrap: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xl,
    gap: 10, alignItems: 'center',
  },
  timerCountdown: { fontSize: 44, fontWeight: '800', letterSpacing: 2 },
  timerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: Radius.xl, borderWidth: 2,
    paddingVertical: 14, paddingHorizontal: 28, width: '100%',
  },
  timerBtnText: { fontSize: FontSize.base, fontWeight: '700' },

  emptySection: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 40, gap: 12,
    height: CARD_H,
  },
  emptySectionText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#7C5CBF', borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: '#F0EBFA',
  },
  emptyAddText: { fontSize: 13, fontWeight: '700', color: '#7C5CBF' },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  box: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    width: width * 0.85, alignItems: 'center', borderTopWidth: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 14, elevation: 10,
  },
  bigEmoji:    { fontSize: 52, marginBottom: 12 },
  doneTitle:   { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  doneMsg:     { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 22 },
  doneBtn:     { borderRadius: 16, paddingVertical: 13, paddingHorizontal: 32 },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  addBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '80%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 10,
  },
  addHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  addTitle:   { fontSize: 17, fontWeight: '800', color: '#2d2d2d' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },
  label:      { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 6, marginTop: 10 },
  emojiInput: {
    borderWidth: 1.5, borderColor: '#e0d6f5', borderRadius: 12,
    fontSize: 28, padding: 10, textAlign: 'center', marginBottom: 4,
  },
  input: {
    borderWidth: 1.5, borderColor: '#e0d6f5', borderRadius: 12,
    fontSize: 14, padding: 12, color: '#333',
  },
  inputMulti: { height: 70, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: '#7C5CBF', borderRadius: 16,
    paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderColor: '#7C5CBF',
    borderRadius: 12, paddingVertical: 10, backgroundColor: '#F0EBFA',
  },
  typeBtnActive:     { backgroundColor: '#7C5CBF' },
  typeBtnText:       { fontSize: 12, fontWeight: '700', color: '#7C5CBF' },
  typeBtnTextActive: { color: '#fff' },
});