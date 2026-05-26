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
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { notify, suppressTaskListNotifOnce } from './notificationService';

const { width, height } = Dimensions.get('window');
const CARD_W = width * 0.72;
const CARD_H = height * 0.57;

// ─── Types ────────────────────────────────────────────────
type ExerciseType = 'therapy' | 'yoga' | 'aerobic' | 'endurance';

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
};

// ─── Storage Keys ─────────────────────────────────────────
const THERAPY_KEY   = 'therapy_exercises';
const YOGA_KEY      = 'yoga_exercises';
const AEROBIC_KEY   = 'aerobic_exercises';
const ENDURANCE_KEY = 'endurance_exercises';

// ─── Section Config ───────────────────────────────────────
type SectionKey = ExerciseType;

type SectionConfig = {
  key: SectionKey;
  labelAr: string;
  labelEn: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  descAr: string;
  descEn: string;
  emoji: string;
};

const SECTION_CONFIGS: SectionConfig[] = [
  {
    key: 'therapy',
    labelAr: 'علاجي',
    labelEn: 'Therapy',
    icon: 'medkit-outline',
    color: '#5B9BD5',
    descAr: 'تمارين علاج طبيعي وتأهيل',
    descEn: 'Physical & occupational therapy exercises',
    emoji: '🩺',
  },
  {
    key: 'yoga',
    labelAr: 'يوغا',
    labelEn: 'Yoga',
    icon: 'leaf-outline',
    color: '#4CAF82',
    descAr: 'وضعيات اليوغا والاسترخاء',
    descEn: 'Yoga poses & relaxation',
    emoji: '🧘',
  },
  {
    key: 'aerobic',
    labelAr: 'هوائي',
    labelEn: 'Aerobic',
    icon: 'heart-outline',
    color: '#E07B5C',
    descAr: 'تمارين القلب والأوعية الدموية',
    descEn: 'Cardio & aerobic exercises',
    emoji: '🏃',
  },
  {
    key: 'endurance',
    labelAr: 'تحمّل',
    labelEn: 'Endurance',
    icon: 'flame-outline',
    color: '#D45BAA',
    descAr: 'تمارين القوة والتحمّل',
    descEn: 'Strength & endurance training',
    emoji: '💪',
  },
];

// ─── Section badge styles ─────────────────────────────────
const SECTION_BADGE: Record<SectionKey, { bg: string; color: string; label: string }> = {
  therapy:   { bg: '#5B9BD522', color: '#5B9BD5', label: '🩺' },
  yoga:      { bg: '#4CAF8222', color: '#4CAF82', label: '🧘' },
  aerobic:   { bg: '#E07B5C22', color: '#E07B5C', label: '🏃' },
  endurance: { bg: '#D45BAA22', color: '#D45BAA', label: '💪' },
};

function speakStep(text: string, isRTL: boolean) {
  Speech.stop();
  Speech.speak(text, {
    language: isRTL ? 'ar-SA' : 'en-US',
    pitch: 1.05,
    rate: isRTL ? 0.82 : 0.88,
  });
}

// ─── Default Exercises ────────────────────────────────────

const DEFAULT_THERAPY_EXERCISES: Exercise[] = [
  {
    key: 'wristCurls',
    emoji: '🤲', title: 'ثني الرسغ (Wrist Curls)', titleEn: 'Wrist Curls',
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
    desc: 'يزيد الثبات، ويقلل الرعشة، ويحسّن خفة حركة الأصابع واليدين',
    descEn: 'Increases stability, reduces tremors, and improves finger and hand dexterity',
    steps: [
      'استخدم دمبل بوزن من 1 إلى 5 أرطال (0.5 إلى 2.5 كجم)',
      'ضع يدك اليسرى ورسغك على حافة طاولة مع توجيه راحة اليد للأعلى',
      'امسك الوزن في يدك بإحكام',
      'ارفع الرسغ ببطء لأعلى قدر تستطيع',
      'حافظ على الوضعية لبضع ثوانٍ ثم أنزل ببطء',
      'اعمل من 1 إلى 2 مجموعة، كل مجموعة 12 تكراراً، ثم كرر على اليد اليمنى',
    ],
    stepsEn: [
      'Use a dumbbell weighing 1 to 5 pounds (0.5 to 2.5 kg)',
      'Place your left hand and wrist on the edge of a table with your palm facing up',
      'Hold the weight firmly in your hand',
      'Slowly raise your wrist upward as far as you can',
      'Hold the position for a few seconds then lower slowly',
      'Do 1 to 2 sets of 12 repetitions, then repeat with the right hand',
    ],
    animType: 'armRaise', type: 'therapy',
  },
];

const DEFAULT_YOGA_EXERCISES: Exercise[] = [
  {
    key: 'childsPose',
    emoji: '🧘',
    title: 'وضعية الطفل (Balasana)',
    titleEn: "Child's Pose (Balasana)",
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    desc: 'تخفف الإرهاق النفسي والجسدي وترخي مفاصل الورك والفخذين والكاحلين',
    descEn: 'Relieves mental and physical fatigue, relaxes hips, thighs, and ankles',
    steps: [
      'اجلس على كعبيك مع ضم الركبتين أو تركهما متباعدتين قليلاً',
      'انحنِ من عند مفصل الورك للأمام ببطء وهدوء',
      'مدّ ذراعيك للأمام أو اتركهما بجانب الجسم',
      'ضع الجبهة على الأرض أو على وسادة للراحة',
      'استرخِ بعمق واسمح للجسم بالتخلص من التوتر',
      'ثبّت الوضعية حتى 5 دقائق مع تنفس عميق وهادئ',
    ],
    stepsEn: [
      'Sit on your heels with knees together or slightly apart',
      'Slowly hinge forward from your hips',
      'Extend your arms forward or rest them alongside your body',
      'Rest your forehead on the floor or on a pillow',
      'Relax deeply and let your body release tension',
      'Hold the pose for up to 5 minutes with deep, calm breathing',
    ],
    animType: 'sway', type: 'yoga',
  },
  {
    key: 'warriorTwo',
    emoji: '🥋',
    title: 'وضعية المحارب الثاني (Warrior II)',
    titleEn: 'Warrior II (Virabhadrasana II)',
    duration: '3 دقائق', durationEn: '3 minutes', durationSeconds: 180,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    desc: 'تبني التحمل وتحسن التوازن مع تمديد وتقوية الجسم في نفس الوقت',
    descEn: 'Builds endurance and improves balance while stretching and strengthening the body',
    steps: [
      'قف في وضع مستقيم واخطُ بقدمك اليسرى للخلف بخطوة واسعة',
      'أدر القدم اليسرى قليلاً للخارج واجعل القدم اليمنى للأمام مباشرة',
      'افتح الوركين للجانب',
      'ارفع الذراعين لمستوى الكتفين أفقياً مع توجيه راحتي اليدين للأسفل',
      'اثنِ الركبة اليمنى بحيث تكون فوق الكاحل أو خلفه قليلاً',
      'حافظ على استقامة الساق الخلفية ووجّه نظرك للأمام فوق اليد الأمامية',
      'ثبّت الوضعية 20-60 ثانية ثم كرر على الجانب الآخر',
      'للدعم: استخدم كرسي تحت الفخذ الأمامي أو قف بجانب حائط',
    ],
    stepsEn: [
      'Stand tall and step your left foot back into a wide stance',
      'Turn your left foot slightly outward and point your right foot straight ahead',
      'Open your hips to the side',
      'Raise arms to shoulder height horizontally with palms facing down',
      'Bend your right knee so it is over or just behind the ankle',
      'Keep your back leg straight and gaze forward over your front hand',
      'Hold for 20-60 seconds then repeat on the other side',
      'Modification: use a chair under the front thigh or stand near a wall',
    ],
    animType: 'armRaise', type: 'yoga',
  },
  {
    key: 'jabPunches',
    emoji: '👊',
    title: 'اللكمات الأمامية (Jab Punches)',
    titleEn: 'Jab Punches',
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    desc: 'تنشط الدورة الدموية وتقوي عضلات الذراعين والكتفين',
    descEn: 'Boosts circulation and strengthens arm and shoulder muscles',
    steps: [
      'قف مستقيماً وافتح قدميك بعرض الكتفين لتحسين التوازن',
      'كوّن قبضتين وضعهما أمام كتفيك مع توجيه راحتي اليدين للأمام',
      'اضرب بقبضتك اليسرى للأمام مع مد الذراع بالكامل',
      'عد إلى وضع البداية',
      'كرر الحركة بالذراع اليمنى — هذا تكرار واحد',
      'اعمل من 1 إلى 2 مجموعة، كل مجموعة 20 تكراراً',
    ],
    stepsEn: [
      'Stand straight with feet shoulder-width apart for better balance',
      'Form two fists and hold them in front of your shoulders, palms facing forward',
      'Punch your left fist straight forward with arm fully extended',
      'Return to the starting position',
      'Repeat with the right arm — this counts as one repetition',
      'Do 1 to 2 sets of 20 repetitions',
    ],
    animType: 'armRaise', type: 'yoga',
  },
  {
    key: 'comboPunches',
    emoji: '🥊',
    title: 'اللكمات المركبة (Combination Punches)',
    titleEn: 'Combination Punches',
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    desc: 'تقوية عضلات الذراعين والكتفين مع تحسين التنسيق الحركي',
    descEn: 'Strengthens arms and shoulders while improving motor coordination',
    steps: [
      'قف مستقيماً وافتح قدميك بعرض الكتفين',
      'كوّن قبضتين وضعهما أمام كتفيك مع توجيه راحتي اليدين للداخل',
      'ارفع قبضة يدك اليسرى للأعلى مع فرد الذراع بالكامل',
      'ارجع إلى وضع البداية',
      'ارفع نفس القبضة اليسرى عبر جسمك أفقياً مع فرد الذراع بالكامل',
      'ارجع للبداية ثم كرر نفس الخطوات على الجانب الأيمن — هذا تكرار واحد',
      'اعمل من 1 إلى 2 مجموعة، كل مجموعة 20 تكراراً',
    ],
    stepsEn: [
      'Stand straight with feet shoulder-width apart',
      'Form two fists and hold them in front of your shoulders, palms facing inward',
      'Raise your left fist upward with arm fully extended',
      'Return to the starting position',
      'Raise the same left fist horizontally across your body with arm fully extended',
      'Return to start, then repeat on the right side — this counts as one repetition',
      'Do 1 to 2 sets of 20 repetitions',
    ],
    animType: 'armRaise', type: 'yoga',
  },
];

const DEFAULT_AEROBIC_EXERCISES: Exercise[] = [
  {
    key: 'bounce',
    emoji: '🏃', title: 'المشي في المكان', titleEn: 'Marching in Place',
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
    desc: 'تحريك الجسم وتنشيط الدورة الدموية',
    descEn: 'Get the body moving and boost blood circulation',
    steps: ['قف مستقيماً وحرك ذراعيك بشكل طبيعي', 'ارفع ركبتيك بالتناوب كأنك تمشي', 'حافظ على تنفس منتظم', 'استمر 5 دقائق بإيقاع مريح'],
    stepsEn: ['Stand straight and swing your arms naturally', 'Lift your knees alternately as if walking', 'Maintain a steady breathing rhythm', 'Continue for 5 minutes at a comfortable pace'],
    animType: 'bounce', type: 'aerobic',
  },
  {
    key: 'legCurl',
    emoji: '🦶', title: 'ثني الساق للخلف', titleEn: 'Leg Curl',
    duration: '3 دقائق', durationEn: '3 minutes', durationSeconds: 180,
    color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
    desc: 'تنشيط عضلات الجزء الخلفي من الساق',
    descEn: 'Activate the muscles of the back of the leg',
    steps: ['قف وأمسك مسند كرسي للتوازن', 'ارفع كعب قدمك للخلف وللأعلى ببطء', 'اقتصر الحركة على مفصل الركبة فقط', 'أنزل القدم ببطء وكرر'],
    stepsEn: ['Stand and hold chair back for balance', 'Slowly lift your heel backward and upward', 'Limit movement to the knee joint only', 'Lower your foot slowly and repeat'],
    animType: 'legCurl', type: 'aerobic',
  },
];

const DEFAULT_ENDURANCE_EXERCISES: Exercise[] = [
  {
    key: 'wallSit',
    emoji: '🏋️', title: 'الجلوس على الحائط', titleEn: 'Wall Sit',
    duration: '3 دقائق', durationEn: '3 minutes', durationSeconds: 180,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    desc: 'تقوية عضلات الفخذ وتحمّل الضغط',
    descEn: 'Strengthen quadriceps and build endurance',
    steps: ['قف بظهرك مقابل الحائط', 'انزلق للأسفل حتى تصبح ركبتاك بزاوية 90 درجة', 'اثبت في هذا الوضع قدر الإمكان', 'ارتفع ببطء ثم كرر'],
    stepsEn: ['Stand with your back against the wall', 'Slide down until your knees are at 90 degrees', 'Hold the position as long as possible', 'Slowly rise back up then repeat'],
    animType: 'bounce', type: 'endurance',
  },
  {
    key: 'calfRaise',
    emoji: '🦵', title: 'رفع الكعب (Calf Raise)', titleEn: 'Calf Raise',
    duration: '5 دقائق', durationEn: '5 minutes', durationSeconds: 300,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    desc: 'تقوية عضلة الساق السفلية وتحسين التوازن',
    descEn: 'Strengthen calf muscles and improve balance',
    steps: ['قف مستقيماً وأمسك مسند كرسي دعماً', 'ارفع كعبيك معاً ببطء لأعلى', 'اثبت ثانيتين على أصابع قدميك', 'أنزل ببطء وكرر 15 مرة'],
    stepsEn: ['Stand straight and hold a chair for support', 'Slowly raise both heels upward', 'Hold on your toes for 2 seconds', 'Lower slowly and repeat 15 times'],
    animType: 'hipMarch', type: 'endurance',
  },
  {
    key: 'plankKnee',
    emoji: '🔥', title: 'البلانك على الركبتين', titleEn: 'Knee Plank',
    duration: '3 دقائق', durationEn: '3 minutes', durationSeconds: 180,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    desc: 'تقوية عضلات الجذع والبطن',
    descEn: 'Strengthen core and abdominal muscles',
    steps: ['استلقِ بوضع كوعيك وركبتيك على الأرض', 'ارفع جسمك بحيث يكون مستقيماً من الركبتين للكتفين', 'شد عضلات البطن وتنفس بانتظام', 'اثبت 20-30 ثانية ثم استرح'],
    stepsEn: ['Get into position with elbows and knees on the floor', 'Lift your body so it is straight from knees to shoulders', 'Engage your core and breathe steadily', 'Hold for 20-30 seconds then rest'],
    animType: 'rollUp', type: 'endurance',
  },
];

// ════════════════════════════════════════════════════════════
// ─── Main Screen ──────────────────────────────────────────
// ════════════════════════════════════════════════════════════
export default function ExercisesScreen() {
  const { t, isRTL } = useLang();
  const router = useRouter();

  const [therapyList,   setTherapyList]   = useState<Exercise[]>([]);
  const [yogaList,      setYogaList]      = useState<Exercise[]>([]);
  const [aerobicList,   setAerobicList]   = useState<Exercise[]>([]);
  const [enduranceList, setEnduranceList] = useState<Exercise[]>([]);

  const [selected,      setSelected]      = useState('wristCurls');
  const [activeSection, setActiveSection] = useState<SectionKey>('therapy');
  const [showAdd,       setShowAdd]       = useState(false);
  const [newName,       setNewName]       = useState('');
  const [newEmoji,      setNewEmoji]      = useState('🏋️');
  const [newMinutes,    setNewMinutes]    = useState('');
  const [newDesc,       setNewDesc]       = useState('');
  const [newType,       setNewType]       = useState<SectionKey>('therapy');
  const [activeStep,    setActiveStep]    = useState(-1);
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [savingEx,      setSavingEx]      = useState(false);

  const stepTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Helper: get list + setter by type ──
  function getListAndSetter(type: SectionKey): [Exercise[], React.Dispatch<React.SetStateAction<Exercise[]>>, string] {
    switch (type) {
      case 'therapy':   return [therapyList,   setTherapyList,   THERAPY_KEY];
      case 'yoga':      return [yogaList,       setYogaList,      YOGA_KEY];
      case 'aerobic':   return [aerobicList,    setAerobicList,   AEROBIC_KEY];
      case 'endurance': return [enduranceList,  setEnduranceList, ENDURANCE_KEY];
    }
  }

  function getAllExercises(): Exercise[] {
    return [...therapyList, ...yogaList, ...aerobicList, ...enduranceList];
  }

  // ── Load ──
  useFocusEffect(useCallback(() => {
    loadAllExercises();
    return () => {
      Speech.stop();
      setIsSpeaking(false);
      setActiveStep(-1);
    };
  }, []));

  async function loadSection(
    key: string,
    defaults: Exercise[],
    setter: React.Dispatch<React.SetStateAction<Exercise[]>>,
  ) {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const parsed: Exercise[] = JSON.parse(stored);
      let updated = [...parsed];
      let changed = false;
      defaults.forEach((def, idx) => {
        if (!updated.find(e => e.key === def.key)) {
          const insertAt = Math.min(idx, updated.length);
          updated.splice(insertAt, 0, def);
          changed = true;
        }
      });
      if (changed) {
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      }
      setter(updated);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(defaults));
      setter(defaults);
    }
  }

  async function loadAllExercises() {
    const migrated = await AsyncStorage.getItem('exercises_v5_migrated');
    if (!migrated) {
      await AsyncStorage.multiRemove([
        'core_exercises', 'extra_exercises', 'therapy_exercises', 'yoga_exercises',
      ]);
      await AsyncStorage.setItem('exercises_v5_migrated', '1');
    }

    await loadSection(THERAPY_KEY,   DEFAULT_THERAPY_EXERCISES,   setTherapyList);
    await loadSection(YOGA_KEY,      DEFAULT_YOGA_EXERCISES,      setYogaList);
    await loadSection(AEROBIC_KEY,   DEFAULT_AEROBIC_EXERCISES,   setAerobicList);
    await loadSection(ENDURANCE_KEY, DEFAULT_ENDURANCE_EXERCISES, setEnduranceList);
  }

  const SECTION_EXERCISES = (() => {
    switch (activeSection) {
      case 'therapy':   return therapyList;
      case 'yoga':      return yogaList;
      case 'aerobic':   return aerobicList;
      case 'endurance': return enduranceList;
    }
  })();

  const ex = getAllExercises().find(e => e.key === selected)
    ?? therapyList[0]
    ?? DEFAULT_THERAPY_EXERCISES[0];

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
        onDone:    () => { stepTimerRef.current = setTimeout(() => readStep(index + 1), 600); },
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

  // ── Navigate to Session Screen ──
  function startSession() {
    stopSpeaking();
    router.push({
      pathname: '/tabs/Exercisesessionscreen',
      params: {
        exerciseKey:     ex.key,
        title:           ex.title,
        titleEn:         ex.titleEn,
        emoji:           ex.emoji,
        durationSeconds: String(ex.durationSeconds),
        color:           ex.color,
        bg:              ex.bg,
        accent:          ex.accent,
        steps:           JSON.stringify(ex.steps),
        stepsEn:         JSON.stringify(ex.stepsEn),
      },
    });
  }

  useEffect(() => {
    stopSpeaking();
  }, [selected]);

  // ── Long Press ──
  function handleLongPressStart(item: Exercise) {
    longPressTimers.current[item.key] = setTimeout(() => {
      const title = isRTL ? item.title : item.titleEn;
      const otherSections = SECTION_CONFIGS.filter(s => s.key !== item.type);
      const moveOptions = otherSections.map(s => ({
        text: `${s.emoji} ${isRTL ? 'نقل لـ ' + s.labelAr : 'Move to ' + s.labelEn}`,
        onPress: () => handleConvertExercise(item, s.key),
      }));

      Alert.alert(
        isRTL ? 'خيارات التمرين' : 'Exercise Options',
        `"${title}"`,
        [
          { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
          ...moveOptions,
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

  // ── Convert exercise between sections ──
  async function handleConvertExercise(item: Exercise, targetType: SectionKey) {
    const converted: Exercise = { ...item, type: targetType };

    const [oldList, oldSetter, oldKey] = getListAndSetter(item.type);
    const updatedOld = oldList.filter(e => e.key !== item.key);
    oldSetter(updatedOld);
    await AsyncStorage.setItem(oldKey, JSON.stringify(updatedOld));

    const [newList, newSetter, newStorageKey] = getListAndSetter(targetType);
    const updatedNew = [...newList, converted];
    newSetter(updatedNew);
    await AsyncStorage.setItem(newStorageKey, JSON.stringify(updatedNew));

    await AsyncStorage.setItem('data_changed_at', Date.now().toString());
    setActiveSection(targetType);
    setSelected(converted.key);

    const targetConfig = SECTION_CONFIGS.find(s => s.key === targetType)!;
    suppressTaskListNotifOnce();
    await notify({
      title: isRTL ? 'تم النقل ✅' : 'Exercise Moved ✅',
      body: isRTL
        ? `"${item.title}" اتنقل لـ${targetConfig.labelAr}`
        : `"${item.titleEn}" moved to ${targetConfig.labelEn}`,
      emoji: item.emoji,
      type: 'add',
    });
  }

  // ── Delete exercise ──
  async function handleDeleteExercise(item: Exercise) {
    suppressTaskListNotifOnce();

    const [list, setter, storageKey] = getListAndSetter(item.type);
    const updated = list.filter(e => e.key !== item.key);
    setter(updated);
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));

    if (selected === item.key && updated.length > 0) setSelected(updated[0].key);

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
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'يرجى إدخال اسم التمرين' : 'Please enter exercise name');
      return;
    }
    if (!newMinutes.trim()) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'يرجى إدخال المدة' : 'Please enter duration');
      return;
    }
    const mins = parseInt(newMinutes);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'أدخل عدداً صحيحاً للدقائق' : 'Enter a valid number of minutes');
      return;
    }
    if (savingEx) return;
    setSavingEx(true);

    try {
      const sectionConfig = SECTION_CONFIGS.find(s => s.key === newType)!;
      const newEx: Exercise = {
        key:             `custom_${Date.now()}`,
        emoji:           newEmoji.trim() || '🏋️',
        title:           newName.trim(),
        titleEn:         newName.trim(),
        duration:        `${mins} ${isRTL ? 'دقيقة' : 'min'}`,
        durationEn:      `${mins} min`,
        durationSeconds: mins * 60,
        color:           sectionConfig.color,
        bg:              '#F8F8F8',
        accent:          '#EEEEEE',
        desc:            newDesc.trim() || (isRTL ? 'تمرين مخصص' : 'Custom exercise'),
        descEn:          newDesc.trim() || 'Custom exercise',
        steps:           [],
        stepsEn:         [],
        animType:        'bounce',
        type:            newType,
        custom:          true,
      };

      closeAddModal();

      const [list, setter, storageKey] = getListAndSetter(newType);
      const updated = [...list, newEx];
      setter(updated);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));

      await AsyncStorage.setItem('data_changed_at', Date.now().toString());
      setSelected(newEx.key);
      setActiveSection(newType);

      suppressTaskListNotifOnce();
      await notify({
        title: isRTL ? 'تمت إضافة تمرين ✅' : 'Exercise Added ✅',
        body: isRTL
          ? `"${newEx.title}" اتضاف لـ${sectionConfig.labelAr}`
          : `"${newEx.titleEn}" added to ${sectionConfig.labelEn}`,
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

  const activeSectionConfig = SECTION_CONFIGS.find(s => s.key === activeSection)!;

  // ── Render cards ──
  function renderCards(list: Exercise[]) {
    return list.map((item) => {
      const iSel   = selected === item.key;
      const iTitle = isRTL ? item.title    : item.titleEn;
      const iDesc  = isRTL ? item.desc     : item.descEn;
      const iDur   = isRTL ? item.duration : item.durationEn;
      const iSteps = isRTL ? item.steps    : item.stepsEn;
      const badge  = SECTION_BADGE[item.type];

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
          {/* ── Top Row ── */}
          <View style={styles.cardTopRow}>
            <View style={[styles.emojiCircle, { backgroundColor: item.accent }]}>
              <Text style={{ fontSize: 30 }}>{item.emoji}</Text>
            </View>
            {iSel && (
              <View style={[styles.selectedCheck, { backgroundColor: item.color }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
            <View style={[styles.exerciseTypeBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.exerciseTypeBadgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          </View>

          {/* ── Title ── */}
          <Text style={[styles.cardTitle, { color: item.color, textAlign: isRTL ? 'right' : 'left' }]}>
            {iTitle}
          </Text>

          {/* ── Duration ── */}
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={13} color={item.color} />
            <Text style={[styles.durationText, { color: item.color }]}> {iDur}</Text>
          </View>

          {/* ── Description ── */}
          <Text style={[styles.cardDesc, { textAlign: isRTL ? 'right' : 'left' }]}>{iDesc}</Text>

          {/* ── Steps Area: ScrollView for steps + speak button pinned at bottom ── */}
          <View style={styles.stepsArea}>
            {/* Scrollable steps list */}
            <ScrollView
              style={styles.stepsScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
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
            </ScrollView>

            {/* Speak button pinned inside stepsArea, always visible */}
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
        </TouchableOpacity>
      );
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Navbar ── */}
        <View style={styles.navbar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
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

        {/* ── Section Toggle (4 sections) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionToggleRow}
          style={styles.sectionToggleScroll}
        >
          {SECTION_CONFIGS.map((section) => {
            const isActive = activeSection === section.key;
            const count = (() => {
              switch (section.key) {
                case 'therapy':   return therapyList.length;
                case 'yoga':      return yogaList.length;
                case 'aerobic':   return aerobicList.length;
                case 'endurance': return enduranceList.length;
              }
            })();
            return (
              <TouchableOpacity
                key={section.key}
                style={[
                  styles.sectionBtn,
                  isActive && { backgroundColor: section.color },
                ]}
                onPress={() => setActiveSection(section.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={section.icon} size={14} color={isActive ? '#fff' : section.color} />
                <Text style={[styles.sectionBtnText, { color: isActive ? '#fff' : section.color }]}>
                  {isRTL ? section.labelAr : section.labelEn}
                </Text>
                <View style={[
                  styles.sectionCount,
                  { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : section.color + '22' },
                ]}>
                  <Text style={[styles.sectionCountText, { color: isActive ? '#fff' : section.color }]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Section Description ── */}
        <View style={styles.sectionDesc}>
          <Ionicons name={activeSectionConfig.icon} size={13} color={activeSectionConfig.color + '99'} />
          <Text style={[styles.sectionDescText, { color: activeSectionConfig.color + '99' }]}>
            {isRTL ? activeSectionConfig.descAr : activeSectionConfig.descEn}
          </Text>
        </View>

        {/* ── Cards ── */}
        {SECTION_EXERCISES.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={{ fontSize: 44 }}>{activeSectionConfig.emoji}</Text>
            <Text style={styles.emptySectionText}>
              {isRTL
                ? `مفيش تمارين في قسم ${activeSectionConfig.labelAr} بعد`
                : `No ${activeSectionConfig.labelEn} exercises yet`}
            </Text>
            <TouchableOpacity
              style={[styles.emptyAddBtn, { borderColor: activeSectionConfig.color, backgroundColor: activeSectionConfig.color + '11' }]}
              onPress={() => { setNewType(activeSection); openAddModal(); }}
            >
              <Ionicons name="add" size={16} color={activeSectionConfig.color} />
              <Text style={[styles.emptyAddText, { color: activeSectionConfig.color }]}>
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
              <View style={[
                styles.dot,
                selected === e.key && { width: 20, backgroundColor: activeSectionConfig.color },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Start Session Button ── */}
        <View style={styles.timerWrap}>
          <TouchableOpacity
            style={[styles.timerBtn, { backgroundColor: ex.bg, borderColor: ex.color }]}
            onPress={startSession}
            activeOpacity={0.85}
          >
            <Ionicons name="play-circle-outline" size={26} color={ex.color} />
            <Text style={[styles.timerBtnText, { color: ex.color }]}>
              {isRTL ? `ابدأ التمرين · ${exDur}` : `Start · ${exDur}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={modal.typeRow}
              >
                {SECTION_CONFIGS.map((section) => {
                  const isActive = newType === section.key;
                  return (
                    <TouchableOpacity
                      key={section.key}
                      style={[
                        modal.typeBtn,
                        { borderColor: section.color },
                        isActive && { backgroundColor: section.color },
                      ]}
                      onPress={() => setNewType(section.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 16 }}>{section.emoji}</Text>
                      <Text style={[modal.typeBtnText, { color: isActive ? '#fff' : section.color }]}>
                        {isRTL ? section.labelAr : section.labelEn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

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
                style={[
                  modal.saveBtn,
                  { backgroundColor: SECTION_CONFIGS.find(s => s.key === newType)?.color ?? '#7C5CBF' },
                  savingEx && { opacity: 0.6 },
                ]}
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

  sectionToggleScroll: { flexGrow: 0, marginBottom: 8 },
  sectionToggleRow: {
    paddingHorizontal: Spacing.xl,
    gap: 8,
    flexDirection: 'row',
  },
  sectionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
  },
  sectionBtnText: { fontSize: 12, fontWeight: '700' },
  sectionCount: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionCountText: { fontSize: 10, fontWeight: '800' },

  sectionDesc: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.xl, marginBottom: 8,
  },
  sectionDescText: { fontSize: 11, fontStyle: 'italic' },

  cardsRow: { paddingHorizontal: Spacing.xl, gap: 14, paddingBottom: Spacing.sm },
  card: {
    borderRadius: Radius.xxl, padding: Spacing.sm,
    height: CARD_H,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  emojiCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  selectedCheck:         { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  exerciseTypeBadge:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  exerciseTypeBadgeText: { fontSize: 14 },
  cardTitle:    { fontSize: FontSize.base, fontWeight: '800', marginBottom: 3 },
  durationRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  durationText: { fontSize: FontSize.sm, fontWeight: '600' },
  cardDesc:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 8 },

  // ── Steps area: fixed height container with scroll inside ──
  stepsArea: {
    flex: 1,
    overflow: 'hidden',
  },
  stepsScroll: {
    flex: 1,
  },
  stepRow: {
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginBottom: 5,
  },
  stepNum:     { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  stepText:    { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },

  speakBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 7, paddingHorizontal: 12, marginTop: 6,
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
    borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  emptyAddText: { fontSize: 13, fontWeight: '700' },
});

const modal = StyleSheet.create({
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
    borderRadius: 16,
    paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 4, paddingBottom: 4 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderWidth: 1.5,
    borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12,
    backgroundColor: '#F8F8F8',
  },
  typeBtnText: { fontSize: 12, fontWeight: '700' },
});