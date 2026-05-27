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
type ExerciseType = 'therapy' | 'yoga' | 'aerobic' | 'endurance' | 'strength';

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
const STRENGTH_KEY  = 'strength_exercises';

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
  {
    key: 'strength',
    labelAr: 'قوة',
    labelEn: 'Strength',
    icon: 'barbell-outline',
    color: '#7B5EA7',
    descAr: 'تمارين تقوية العضلات والمفاصل',
    descEn: 'Muscle & joint strengthening exercises',
    emoji: '🏋️',
  },
];

// ─── Section badge styles ─────────────────────────────────
const SECTION_BADGE: Record<SectionKey, { bg: string; color: string; label: string }> = {
  therapy:   { bg: '#5B9BD522', color: '#5B9BD5', label: '🩺' },
  yoga:      { bg: '#4CAF8222', color: '#4CAF82', label: '🧘' },
  aerobic:   { bg: '#E07B5C22', color: '#E07B5C', label: '🏃' },
  endurance: { bg: '#D45BAA22', color: '#D45BAA', label: '💪' },
  strength:  { bg: '#7B5EA722', color: '#7B5EA7', label: '🏋️' },
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
    emoji: '🤲',
    title: 'ثني الرسغ (Wrist Curls)',
    titleEn: 'Wrist Curls',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#5B9BD5',
    bg: '#E8F1FB',
    accent: '#D0E5F7',
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
    animType: 'armRaise',
    type: 'therapy',
  },
];

const DEFAULT_YOGA_EXERCISES: Exercise[] = [
  {
    key: 'childsPose',
    emoji: '🧘',
    title: 'وضعية الطفل (Balasana)',
    titleEn: "Child's Pose (Balasana)",
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#4CAF82',
    bg: '#E8F5EF',
    accent: '#D6EFE3',
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
    animType: 'sway',
    type: 'yoga',
  },
  {
    key: 'warriorTwo',
    emoji: '🥋',
    title: 'وضعية المحارب الثاني (Warrior II)',
    titleEn: 'Warrior II (Virabhadrasana II)',
    duration: '3 دقائق',
    durationEn: '3 minutes',
    durationSeconds: 180,
    color: '#4CAF82',
    bg: '#E8F5EF',
    accent: '#D6EFE3',
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
    animType: 'armRaise',
    type: 'yoga',
  },
  {
    key: 'jabPunches',
    emoji: '👊',
    title: 'اللكمات الأمامية (Jab Punches)',
    titleEn: 'Jab Punches',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#4CAF82',
    bg: '#E8F5EF',
    accent: '#D6EFE3',
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
    animType: 'armRaise',
    type: 'yoga',
  },
  {
    key: 'comboPunches',
    emoji: '🥊',
    title: 'اللكمات المركبة (Combination Punches)',
    titleEn: 'Combination Punches',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#4CAF82',
    bg: '#E8F5EF',
    accent: '#D6EFE3',
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
    animType: 'armRaise',
    type: 'yoga',
  },
];

const DEFAULT_AEROBIC_EXERCISES: Exercise[] = [
  {
    key: 'singleLegStand',
    emoji: '🦩',
    title: 'الوقوف على قدم واحدة (Single Leg Stand)',
    titleEn: 'Single Leg Stand',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#E07B5C',
    bg: '#FDF0EB',
    accent: '#FAE2D6',
    desc: 'يساعد على تحسين التوازن أثناء الوقوف والقدرة على المشي',
    descEn: 'Helps improve standing balance and walking ability',
    steps: [
      'للدعم، ضع يديك على الحائط أو على ظهر كرسي',
      'انقل وزنك إلى الساق الأقل استخداماً أو الأقل قوة',
      'ارفع القدم الأخرى ببطء عن الأرض',
      'حافظ على الوضع لمدة 20 ثانية، وحاول استخدام ذراعيك بأقل قدر ممكن للحفاظ على التوازن',
      'أنزل قدمك ببطء إلى الأرض',
      'كرر التمرين على الجانب الآخر',
      'يمكنك البدء بمدة أو عدد أقل من التكرارات، ثم زيادتها تدريجياً مع تحسن قدرتك',
    ],
    stepsEn: [
      'For support, place your hands on a wall or the back of a chair',
      'Shift your weight to your less-used or weaker leg',
      'Slowly lift the other foot off the ground',
      'Hold the position for 20 seconds, trying to use your arms as little as possible to maintain balance',
      'Slowly lower your foot back to the ground',
      'Repeat on the other side',
      'You can start with shorter durations or fewer repetitions, then gradually increase as your ability improves',
    ],
    animType: 'hipMarch',
    type: 'aerobic',
  },
];

const DEFAULT_ENDURANCE_EXERCISES: Exercise[] = [
  {
    key: 'armBottles',
    emoji: '💪',
    title: 'تمارين الذراعين باستخدام زجاجات أثناء الجلوس',
    titleEn: 'Seated Arm Exercises with Bottles',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#D45BAA',
    bg: '#FCEEF8',
    accent: '#F8D6F0',
    desc: 'تقوية عضلات الذراعين والكتفين باستخدام زجاجات مياه كأوزان خفيفة أثناء الجلوس',
    descEn: 'Strengthen arm and shoulder muscles using water bottles as light weights while seated',
    steps: [
      'اجلس على كرسي بظهر مستقيم وقدمان مسطحتان على الأرض',
      'أمسك زجاجة مياه في كل يد',
      'ارفع ذراعيك للأمام حتى مستوى الكتفين ببطء',
      'أنزل ذراعيك ببطء إلى وضع البداية',
      'ارفع ذراعيك للجانبين حتى مستوى الكتفين ببطء',
      'أنزل ذراعيك ببطء واكرر التمرين',
      'اعمل من 10 إلى 15 تكراراً لكل حركة',
    ],
    stepsEn: [
      'Sit on a chair with a straight back and feet flat on the floor',
      'Hold a water bottle in each hand',
      'Slowly raise both arms forward to shoulder level',
      'Slowly lower your arms back to the starting position',
      'Slowly raise both arms out to the sides to shoulder level',
      'Slowly lower your arms and repeat',
      'Do 10 to 15 repetitions for each movement',
    ],
    animType: 'armRaise',
    type: 'endurance',
  },
  {
    key: 'seatedEndurance',
    emoji: '🪑',
    title: 'تمارين التحمل أثناء الجلوس',
    titleEn: 'Seated Endurance Exercises',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#D45BAA',
    bg: '#FCEEF8',
    accent: '#F8D6F0',
    desc: 'تمارين تحمل شاملة تُؤدى أثناء الجلوس لتقوية الجسم بأمان',
    descEn: 'Comprehensive endurance exercises performed while seated to safely strengthen the body',
    steps: [
      'اجلس على حافة الكرسي مع استقامة الظهر',
      'ارفع ركبتك اليمنى ببطء نحو صدرك ثم أنزلها',
      'كرر مع الركبة اليسرى — هذا تكرار واحد',
      'مد ساقك اليمنى للأمام بشكل مستقيم ثم أنزلها',
      'كرر مع الساق اليسرى',
      'اعمل من 10 إلى 15 تكراراً لكل حركة مع تنفس منتظم',
    ],
    stepsEn: [
      'Sit on the edge of a chair with your back straight',
      'Slowly lift your right knee toward your chest then lower it',
      'Repeat with the left knee — this counts as one repetition',
      'Extend your right leg straight out in front then lower it',
      'Repeat with the left leg',
      'Do 10 to 15 repetitions for each movement with steady breathing',
    ],
    animType: 'hipMarch',
    type: 'endurance',
  },
  {
    key: 'neckFlexibility',
    emoji: '🧘',
    title: 'مرونة الرقبة أثناء الاستلقاء',
    titleEn: 'Neck Flexibility While Lying Down',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#D45BAA',
    bg: '#FCEEF8',
    accent: '#F8D6F0',
    desc: 'تحسين مرونة الرقبة وتخفيف التوتر في عضلاتها بشكل آمن أثناء الاستلقاء',
    descEn: 'Improve neck flexibility and relieve muscle tension safely while lying down',
    steps: [
      'استلقِ على ظهرك على سطح مستوٍ مريح',
      'أدر رأسك ببطء نحو الكتف الأيمن بقدر ما تستطيع دون ألم',
      'اثبت 5 ثوانٍ ثم عد للمنتصف ببطء',
      'أدر رأسك ببطء نحو الكتف الأيسر',
      'اثبت 5 ثوانٍ ثم عد للمنتصف ببطء',
      'أمِل رأسك ببطء للأمام نحو الصدر واثبت 5 ثوانٍ',
      'عد للمنتصف واكرر 5 إلى 10 مرات لكل اتجاه',
    ],
    stepsEn: [
      'Lie on your back on a comfortable flat surface',
      'Slowly turn your head toward your right shoulder as far as comfortable without pain',
      'Hold for 5 seconds then slowly return to center',
      'Slowly turn your head toward your left shoulder',
      'Hold for 5 seconds then slowly return to center',
      'Slowly tilt your head forward toward your chest and hold for 5 seconds',
      'Return to center and repeat 5 to 10 times in each direction',
    ],
    animType: 'sway',
    type: 'endurance',
  },
  {
    key: 'standUpStrength',
    emoji: '🏋️',
    title: 'تمرين النهوض لتقوية الساقين',
    titleEn: 'Stand Up Exercise for Leg Strength',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#D45BAA',
    bg: '#FCEEF8',
    accent: '#F8D6F0',
    desc: 'تقوية عضلات الساقين والركبتين وتحسين القدرة على النهوض والجلوس بأمان',
    descEn: 'Strengthen leg and knee muscles and improve the ability to stand and sit safely',
    steps: [
      'اجلس على كرسي ثابت بدون مسندين للذراعين إن أمكن',
      'ضع يديك على فخذيك أو امسك جانبي الكرسي للدعم',
      'أمِل جسمك للأمام قليلاً وانقل وزنك على قدميك',
      'ادفع من قدميك وانهض ببطء حتى تقف بشكل مستقيم',
      'اثبت واقفاً لثانية أو ثانيتين',
      'انحنِ ببطء للأمام وأنزل جسمك بتحكم حتى تجلس',
      'كرر من 8 إلى 10 مرات مع أخذ استراحة عند الحاجة',
    ],
    stepsEn: [
      'Sit on a stable chair without armrests if possible',
      'Place your hands on your thighs or hold the sides of the chair for support',
      'Lean your body slightly forward and shift your weight onto your feet',
      'Push through your feet and slowly rise until you are standing straight',
      'Hold the standing position for one or two seconds',
      'Slowly lean forward and lower your body in a controlled manner until seated',
      'Repeat 8 to 10 times, resting when needed',
    ],
    animType: 'bounce',
    type: 'endurance',
  },
  {
    key: 'upperBodyStretch',
    emoji: '🔄',
    title: 'تمارين إطالة ودوران الجزء العلوي من الجسم',
    titleEn: 'Upper Body Stretching and Rotation Exercises',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#D45BAA',
    bg: '#FCEEF8',
    accent: '#F8D6F0',
    desc: 'تحسين مرونة الجزء العلوي من الجسم وتخفيف تيبس الكتفين والظهر',
    descEn: 'Improve upper body flexibility and relieve stiffness in the shoulders and back',
    steps: [
      'اجلس أو قف باستقامة مع إبقاء الوركين ثابتين',
      'ضع يدك اليمنى على كتفك الأيسر',
      'أدر الجزء العلوي من جسمك ببطء نحو اليسار بقدر ما تستطيع بدون ألم',
      'اثبت 5 ثوانٍ ثم عد للمركز ببطء',
      'كرر على الجانب الأيمن',
      'مد ذراعيك للأعلى فوق رأسك ببطء واثبت 5 ثوانٍ',
      'أنزل ذراعيك ببطء واكرر كل حركة من 5 إلى 8 مرات',
    ],
    stepsEn: [
      'Sit or stand straight while keeping your hips still',
      'Place your right hand on your left shoulder',
      'Slowly rotate your upper body to the left as far as comfortable without pain',
      'Hold for 5 seconds then slowly return to center',
      'Repeat on the right side',
      'Slowly raise both arms above your head and hold for 5 seconds',
      'Slowly lower your arms and repeat each movement 5 to 8 times',
    ],
    animType: 'rollUp',
    type: 'endurance',
  },
];

// ─── Default Strength Exercises ───────────────────────────
const DEFAULT_STRENGTH_EXERCISES: Exercise[] = [
  {
    key: 'marchingInPlace',
    emoji: '🚶',
    title: 'السير في وضع الوقوف',
    titleEn: 'Marching in Place',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تحسين التوازن وتقوية عضلات الساقين والوركين مع تنشيط الدورة الدموية',
    descEn: 'Improves balance and strengthens leg and hip muscles while boosting circulation',
    steps: [
      'قف بجانب كرسي أو حائط للدعم عند الحاجة',
      'قف مستقيماً مع توزيع وزنك بالتساوي على قدميك',
      'ارفع ركبتك اليمنى ببطء نحو مستوى الورك',
      'أنزل القدم اليمنى ببطء إلى الأرض',
      'ارفع ركبتك اليسرى ببطء بنفس الطريقة',
      'استمر في رفع الركبتين بالتناوب كأنك تمشي في مكانك',
      'اعمل من 15 إلى 20 تكراراً لكل ساق مع تنفس منتظم',
    ],
    stepsEn: [
      'Stand next to a chair or wall for support if needed',
      'Stand straight with weight evenly distributed on both feet',
      'Slowly raise your right knee toward hip level',
      'Slowly lower your right foot back to the ground',
      'Slowly raise your left knee in the same way',
      'Continue alternating knees as if marching in place',
      'Do 15 to 20 repetitions for each leg with steady breathing',
    ],
    animType: 'hipMarch',
    type: 'strength',
  },
  {
    key: 'chairSquat',
    emoji: '🪑',
    title: 'القرفصاء باستخدام الكرسي',
    titleEn: 'Chair Squat',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تقوية عضلات الفخذين والأرداف وتحسين القدرة على الجلوس والنهوض بأمان',
    descEn: 'Strengthens thigh and glute muscles and improves the ability to sit and stand safely',
    steps: [
      'ضع كرسياً ثابتاً خلفك وقف أمامه بمواجهة الأمام',
      'افتح قدميك بعرض الكتفين مع توجيه أصابع القدم للخارج قليلاً',
      'مد ذراعيك للأمام للتوازن أو امسك ظهر كرسي آخر للدعم',
      'انحنِ ببطء نحو الأسفل كأنك ستجلس حتى تلمس مؤخرتك الكرسي',
      'اثبت في الوضع لثانية أو ثانيتين',
      'ادفع من كعبيك وانهض ببطء إلى وضع الوقوف',
      'كرر من 8 إلى 12 مرة مع أخذ استراحة عند الحاجة',
    ],
    stepsEn: [
      'Place a stable chair behind you and stand in front of it facing forward',
      'Open your feet shoulder-width apart with toes pointing slightly outward',
      'Extend your arms forward for balance or hold another chair for support',
      'Slowly bend downward as if sitting until your bottom touches the chair',
      'Hold the position for one or two seconds',
      'Push through your heels and slowly rise to standing',
      'Repeat 8 to 12 times, resting when needed',
    ],
    animType: 'bounce',
    type: 'strength',
  },
  {
    key: 'hipStrength',
    emoji: '🦴',
    title: 'تقوية مفصل وعضلات الورك',
    titleEn: 'Hip Joint & Muscle Strengthening',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تقوية عضلات ومفصل الورك لتحسين الثبات وتسهيل المشي والحركة اليومية',
    descEn: 'Strengthens hip muscles and joint to improve stability and ease daily walking and movement',
    steps: [
      'قف بجانب كرسي أو حائط للدعم',
      'قف مستقيماً مع توزيع الوزن بالتساوي',
      'ارفع ساقك اليمنى للجانب ببطء مع إبقاء الجسم مستقيماً',
      'اثبت في الوضع لثانيتين ثم أنزل الساق ببطء',
      'كرر 10 مرات ثم انتقل للساق اليسرى',
      'ارفع ساقك للخلف ببطء دون أن تنحني للأمام',
      'اثبت لثانيتين ثم أنزل ببطء، وكرر 10 مرات لكل ساق',
    ],
    stepsEn: [
      'Stand next to a chair or wall for support',
      'Stand straight with weight evenly distributed',
      'Slowly lift your right leg out to the side while keeping your body upright',
      'Hold for two seconds then slowly lower your leg',
      'Repeat 10 times then switch to the left leg',
      'Slowly lift your leg backward without leaning forward',
      'Hold for two seconds then lower slowly, repeat 10 times for each leg',
    ],
    animType: 'legCurl',
    type: 'strength',
  },
  {
    key: 'seatedTwistKnee',
    emoji: '🔄',
    title: 'لف الجسم ولمس الركبة المعاكسة أثناء الجلوس',
    titleEn: 'Seated Twist & Opposite Knee Touch',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تحسين مرونة العمود الفقري وتقوية عضلات الجذع والبطن أثناء الجلوس',
    descEn: 'Improves spinal flexibility and strengthens core and abdominal muscles while seated',
    steps: [
      'اجلس على كرسي باستقامة مع إبقاء قدميك مسطحتين على الأرض',
      'ضع يديك على صدرك أو مدّ ذراعيك للأمام',
      'أدر جسمك ببطء نحو اليمين وامتد بيدك اليسرى لتلمس ركبتك اليمنى',
      'اثبت في الوضع لثانيتين مع التنفس',
      'عد ببطء إلى وضع البداية',
      'أدر جسمك نحو اليسار وامتد بيدك اليمنى لتلمس ركبتك اليسرى',
      'اثبت لثانيتين ثم عد للبداية — هذا تكرار واحد، اعمل 10 إلى 15 تكراراً',
    ],
    stepsEn: [
      'Sit straight on a chair with feet flat on the floor',
      'Place your hands on your chest or extend them forward',
      'Slowly rotate your body to the right and reach your left hand to touch your right knee',
      'Hold for two seconds while breathing',
      'Slowly return to the starting position',
      'Rotate your body to the left and reach your right hand to touch your left knee',
      'Hold for two seconds then return — this is one repetition, do 10 to 15 repetitions',
    ],
    animType: 'rollUp',
    type: 'strength',
  },
  {
    key: 'armLegStrength',
    emoji: '💪',
    title: 'تقوية الذراعين والساقين',
    titleEn: 'Arm & Leg Strengthening',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تمرين شامل لتقوية عضلات الذراعين والساقين في نفس الوقت لتحسين القوة العامة',
    descEn: 'A comprehensive exercise to strengthen arm and leg muscles simultaneously for overall strength improvement',
    steps: [
      'اجلس على كرسي باستقامة أو قف مستنداً لدعم خفيف',
      'أمسك زجاجتي مياه أو أوزاناً خفيفة في يديك',
      'ارفع ذراعيك ببطء نحو الكتفين (رفع بايسبس) وأنزلهما',
      'مد ساقك اليمنى بشكل مستقيم واثبت لثانيتين ثم أنزل',
      'كرر رفع الذراعين ثم مد الساق اليسرى',
      'استمر في التناوب بين الذراعين والساقين',
      'اعمل من 10 إلى 12 تكراراً لكل طرف مع تنفس منتظم',
    ],
    stepsEn: [
      'Sit straight on a chair or stand with light support',
      'Hold two water bottles or light weights in your hands',
      'Slowly raise your arms toward your shoulders (bicep curl) then lower them',
      'Extend your right leg straight and hold for two seconds then lower',
      'Repeat the arm raise then extend the left leg',
      'Continue alternating between arms and legs',
      'Do 10 to 12 repetitions for each limb with steady breathing',
    ],
    animType: 'armRaise',
    type: 'strength',
  },
  {
    key: 'standingArmTrunk',
    emoji: '🧍',
    title: 'تقوية الذراعين وجذع الجسم أثناء الوقوف',
    titleEn: 'Standing Arm & Trunk Strengthening',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تقوية عضلات الذراعين وجذع الجسم لتحسين الثبات والوضعية الصحيحة',
    descEn: 'Strengthens arm and trunk muscles to improve stability and correct posture',
    steps: [
      'قف مستقيماً بجانب كرسي أو حائط للدعم عند الحاجة',
      'افتح قدميك بعرض الكتفين مع توزيع الوزن بالتساوي',
      'أمسك وزناً خفيفاً أو زجاجة مياه في يدك اليمنى',
      'ارفع ذراعك اليمنى ببطء للأمام حتى مستوى الكتف مع إبقاء الجذع مستقيماً',
      'اثبت لثانيتين ثم أنزل الذراع ببطء',
      'كرر 10 مرات ثم انتقل لليد اليسرى',
      'أضف دوراناً خفيفاً للجذع مع رفع الذراع لزيادة تنشيط عضلات الجذع',
    ],
    stepsEn: [
      'Stand straight next to a chair or wall for support if needed',
      'Open your feet shoulder-width apart with weight evenly distributed',
      'Hold a light weight or water bottle in your right hand',
      'Slowly raise your right arm forward to shoulder level while keeping the trunk straight',
      'Hold for two seconds then slowly lower your arm',
      'Repeat 10 times then switch to the left hand',
      'Add a slight trunk rotation with the arm raise to further activate core muscles',
    ],
    animType: 'standingRow',
    type: 'strength',
  },
  {
    key: 'lyingTwistArms',
    emoji: '🛌',
    title: 'لفّ الجسم مع مد الذراعين أثناء الاستلقاء',
    titleEn: 'Lying Twist with Arm Extension',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تحسين مرونة العمود الفقري وتمديد عضلات الجذع والكتفين بشكل آمن أثناء الاستلقاء',
    descEn: 'Improves spinal flexibility and stretches trunk and shoulder muscles safely while lying down',
    steps: [
      'استلقِ على ظهرك على سطح مستوٍ ومريح',
      'افتح ذراعيك للجانبين بشكل أفقي على مستوى الكتفين',
      'اثنِ ركبتيك مع إبقاء قدميك مسطحتين على الأرض',
      'أمِل ركبتيك ببطء نحو اليمين حتى الأرض أو أقرب ما تستطيع',
      'أبقِ كتفيك ملامستين للأرض وانظر نحو اليسار',
      'اثبت 5 ثوانٍ مع تنفس عميق ثم عد للمنتصف ببطء',
      'كرر نحو اليسار واثبت 5 ثوانٍ، ثم كرر الحركة من 5 إلى 8 مرات لكل جانب',
    ],
    stepsEn: [
      'Lie on your back on a comfortable flat surface',
      'Extend both arms out to the sides at shoulder level',
      'Bend your knees while keeping your feet flat on the ground',
      'Slowly lower both knees to the right toward the floor or as far as comfortable',
      'Keep both shoulders touching the floor and look to the left',
      'Hold for 5 seconds with deep breathing then slowly return to center',
      'Repeat to the left and hold for 5 seconds, then repeat 5 to 8 times on each side',
    ],
    animType: 'sway',
    type: 'strength',
  },
  {
    key: 'backBridgeLying',
    emoji: '🌉',
    title: 'تمرين تقوس الظهر أثناء الاستلقاء',
    titleEn: 'Back Bridge While Lying Down',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تقوية عضلات الظهر والأرداف والجذع مع تخفيف آلام أسفل الظهر',
    descEn: 'Strengthens back, glute, and core muscles while relieving lower back pain',
    steps: [
      'استلقِ على ظهرك مع ثني ركبتيك وإبقاء قدميك مسطحتين على الأرض',
      'ضع ذراعيك بجانبك بشكل مريح على الأرض',
      'اضغط ببطء بكعبيك على الأرض وارفع وركيك نحو الأعلى',
      'استمر في الرفع حتى يصبح جسمك خطاً مستقيماً من الكتفين حتى الركبتين',
      'اثبت في القمة لثانيتين إلى خمس ثوانٍ مع إبقاء البطن مشدوداً',
      'أنزل وركيك ببطء إلى الأرض فقرة فقرة',
      'استرِح لثانيتين ثم كرر من 8 إلى 12 مرة',
    ],
    stepsEn: [
      'Lie on your back with knees bent and feet flat on the floor',
      'Place your arms comfortably at your sides on the ground',
      'Slowly press your heels into the floor and lift your hips upward',
      'Continue lifting until your body forms a straight line from shoulders to knees',
      'Hold at the top for two to five seconds while keeping your core engaged',
      'Slowly lower your hips back to the floor one vertebra at a time',
      'Rest for two seconds then repeat 8 to 12 times',
    ],
    animType: 'rollUp',
    type: 'strength',
  },
  {
    key: 'upperFlexArmStrength',
    emoji: '🤸',
    title: 'تمرين مرونة الجزء العلوي وتقوية الذراعين',
    titleEn: 'Upper Body Flexibility & Arm Strengthening',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تحسين مرونة الجزء العلوي من الجسم وتقوية عضلات الذراعين والكتفين معاً',
    descEn: 'Improves upper body flexibility and strengthens arm and shoulder muscles together',
    steps: [
      'اجلس على كرسي أو قف باستقامة',
      'ابدأ بتمديد الرقبة: أمِل رأسك ببطء نحو الكتف الأيمن واثبت 5 ثوانٍ ثم كرر للأيسر',
      'دوّر كتفيك للأمام 5 مرات ثم للخلف 5 مرات ببطء',
      'أمسك وزناً خفيفاً أو زجاجة مياه وارفع ذراعيك ببطء للأمام حتى مستوى الكتف',
      'أنزل الذراعين ببطء ثم ارفعهما للجانبين حتى مستوى الكتف',
      'أنزل ببطء واثنِ الذراعين نحو الكتفين (رفع بايسبس)',
      'اعمل من 10 إلى 12 تكراراً لكل حركة مع تنفس منتظم',
    ],
    stepsEn: [
      'Sit on a chair or stand straight',
      'Start with neck stretching: slowly tilt your head toward the right shoulder and hold for 5 seconds, then repeat to the left',
      'Roll your shoulders forward 5 times then backward 5 times slowly',
      'Hold a light weight or water bottle and slowly raise both arms forward to shoulder level',
      'Slowly lower your arms then raise them out to the sides to shoulder level',
      'Lower slowly then bend your arms toward your shoulders (bicep curl)',
      'Do 10 to 12 repetitions for each movement with steady breathing',
    ],
    animType: 'armRaise',
    type: 'strength',
  },
  {
    key: 'trunkBackFlexibility',
    emoji: '🌀',
    title: 'تمارين مرونة الجذع والظهر',
    titleEn: 'Trunk & Back Flexibility Exercises',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'تحسين مرونة الجذع والظهر وتخفيف التيبس وآلام أسفل الظهر',
    descEn: 'Improves trunk and back flexibility while reducing stiffness and lower back pain',
    steps: [
      'اجلس على كرسي باستقامة مع إبقاء قدميك مسطحتين على الأرض',
      'ضع يديك على ركبتيك أو على جانبي الكرسي للدعم',
      'انحنِ ببطء للأمام من منطقة الخصر حتى تشعر بتمديد خفيف في الظهر',
      'اثبت 5 ثوانٍ مع تنفس عميق ثم ارجع للوضع المستقيم ببطء',
      'انحنِ ببطء للجانب الأيمن واثبت 5 ثوانٍ ثم عد للمركز',
      'انحنِ للجانب الأيسر واثبت 5 ثوانٍ ثم عد',
      'أدر الجذع ببطء يميناً ويساراً 5 مرات لكل جانب مع إبقاء الوركين ثابتين',
    ],
    stepsEn: [
      'Sit straight on a chair with feet flat on the floor',
      'Place your hands on your knees or on the sides of the chair for support',
      'Slowly bend forward from the waist until you feel a gentle stretch in your back',
      'Hold for 5 seconds with deep breathing then slowly return upright',
      'Slowly bend to the right side and hold for 5 seconds then return to center',
      'Bend to the left side and hold for 5 seconds then return',
      'Slowly rotate the trunk right and left 5 times each side while keeping hips still',
    ],
    animType: 'sway',
    type: 'strength',
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
  const [strengthList,  setStrengthList]  = useState<Exercise[]>([]);

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

  function getListAndSetter(type: SectionKey): [Exercise[], React.Dispatch<React.SetStateAction<Exercise[]>>, string] {
    switch (type) {
      case 'therapy':   return [therapyList,   setTherapyList,   THERAPY_KEY];
      case 'yoga':      return [yogaList,       setYogaList,      YOGA_KEY];
      case 'aerobic':   return [aerobicList,    setAerobicList,   AEROBIC_KEY];
      case 'endurance': return [enduranceList,  setEnduranceList, ENDURANCE_KEY];
      case 'strength':  return [strengthList,   setStrengthList,  STRENGTH_KEY];
    }
  }

  function getAllExercises(): Exercise[] {
    return [...therapyList, ...yogaList, ...aerobicList, ...enduranceList, ...strengthList];
  }

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
      if (changed) await AsyncStorage.setItem(key, JSON.stringify(updated));
      setter(updated);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(defaults));
      setter(defaults);
    }
  }

  async function loadAllExercises() {
    const migrated = await AsyncStorage.getItem('exercises_v7_migrated');
    if (!migrated) {
      await AsyncStorage.multiRemove([
        'core_exercises', 'extra_exercises', 'therapy_exercises',
        'yoga_exercises', 'aerobic_exercises', 'endurance_exercises',
        'strength_exercises',
      ]);
      await AsyncStorage.setItem('exercises_v7_migrated', '1');
    }

    await loadSection(THERAPY_KEY, DEFAULT_THERAPY_EXERCISES, setTherapyList);
    await loadSection(YOGA_KEY,    DEFAULT_YOGA_EXERCISES,    setYogaList);

    // aerobic — fixed single exercise
    await AsyncStorage.removeItem(AEROBIC_KEY);
    await AsyncStorage.setItem(AEROBIC_KEY, JSON.stringify(DEFAULT_AEROBIC_EXERCISES));
    setAerobicList(DEFAULT_AEROBIC_EXERCISES);

    // endurance — 5 fixed exercises
    await AsyncStorage.removeItem(ENDURANCE_KEY);
    await AsyncStorage.setItem(ENDURANCE_KEY, JSON.stringify(DEFAULT_ENDURANCE_EXERCISES));
    setEnduranceList(DEFAULT_ENDURANCE_EXERCISES);

    // strength — 10 fixed exercises
    await AsyncStorage.removeItem(STRENGTH_KEY);
    await AsyncStorage.setItem(STRENGTH_KEY, JSON.stringify(DEFAULT_STRENGTH_EXERCISES));
    setStrengthList(DEFAULT_STRENGTH_EXERCISES);
  }

  const SECTION_EXERCISES = (() => {
    switch (activeSection) {
      case 'therapy':   return therapyList;
      case 'yoga':      return yogaList;
      case 'aerobic':   return aerobicList;
      case 'endurance': return enduranceList;
      case 'strength':  return strengthList;
    }
  })();

  const ex = getAllExercises().find(e => e.key === selected)
    ?? therapyList[0]
    ?? DEFAULT_THERAPY_EXERCISES[0];

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

  useEffect(() => { stopSpeaking(); }, [selected]);

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
          { text: isRTL ? '🗑️ حذف' : '🗑️ Delete', style: 'destructive', onPress: () => handleDeleteExercise(item) },
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
      emoji: item.emoji, type: 'add',
    });
  }

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
      body: isRTL ? `"${item.title}" تم حذفه` : `"${item.titleEn}" has been deleted`,
      emoji: item.emoji, type: 'delete',
    });
  }

  const openAddModal = () => {
    setNewName(''); setNewEmoji('🏋️'); setNewMinutes('2');
    setNewDesc(''); setNewType(activeSection); setSavingEx(false); setShowAdd(true);
  };

  const closeAddModal = () => {
    setShowAdd(false); setNewName(''); setNewEmoji('🏋️');
    setNewMinutes(''); setNewDesc(''); setSavingEx(false);
  };

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
        key: `custom_${Date.now()}`, emoji: newEmoji.trim() || '🏋️',
        title: newName.trim(), titleEn: newName.trim(),
        duration: `${mins} ${isRTL ? 'دقيقة' : 'min'}`, durationEn: `${mins} min`,
        durationSeconds: mins * 60, color: sectionConfig.color,
        bg: '#F8F8F8', accent: '#EEEEEE',
        desc: newDesc.trim() || (isRTL ? 'تمرين مخصص' : 'Custom exercise'),
        descEn: newDesc.trim() || 'Custom exercise',
        steps: [], stepsEn: [], animType: 'bounce', type: newType, custom: true,
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
        emoji: newEx.emoji, type: 'add',
      });
    } catch (e) {
      console.warn('handleAddExercise error:', e);
      setSavingEx(false);
    }
  }

  const exDur = isRTL ? ex.duration : ex.durationEn;
  const activeSectionConfig = SECTION_CONFIGS.find(s => s.key === activeSection)!;

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
              <Text style={[styles.exerciseTypeBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>
          <Text style={[styles.cardTitle, { color: item.color, textAlign: isRTL ? 'right' : 'left' }]}>{iTitle}</Text>
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={13} color={item.color} />
            <Text style={[styles.durationText, { color: item.color }]}> {iDur}</Text>
          </View>
          <Text style={[styles.cardDesc, { textAlign: isRTL ? 'right' : 'left' }]}>{iDesc}</Text>
          <View style={styles.stepsArea}>
            <ScrollView style={styles.stepsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
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

        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
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
                case 'strength':  return strengthList.length;
              }
            })();
            return (
              <TouchableOpacity
                key={section.key}
                style={[styles.sectionBtn, isActive && { backgroundColor: section.color }]}
                onPress={() => setActiveSection(section.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={section.icon} size={14} color={isActive ? '#fff' : section.color} />
                <Text style={[styles.sectionBtnText, { color: isActive ? '#fff' : section.color }]}>
                  {isRTL ? section.labelAr : section.labelEn}
                </Text>
                <View style={[styles.sectionCount, { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : section.color + '22' }]}>
                  <Text style={[styles.sectionCountText, { color: isActive ? '#fff' : section.color }]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sectionDesc}>
          <Ionicons name={activeSectionConfig.icon} size={13} color={activeSectionConfig.color + '99'} />
          <Text style={[styles.sectionDescText, { color: activeSectionConfig.color + '99' }]}>
            {isRTL ? activeSectionConfig.descAr : activeSectionConfig.descEn}
          </Text>
        </View>

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
            horizontal showsHorizontalScrollIndicator={false}
            decelerationRate="fast" snapToInterval={CARD_W + 14}
            contentContainerStyle={styles.cardsRow} style={{ flexGrow: 0 }}
          >
            {renderCards(SECTION_EXERCISES)}
          </ScrollView>
        )}

        <View style={styles.dotsRow}>
          {SECTION_EXERCISES.map((e) => (
            <TouchableOpacity key={e.key} onPress={() => setSelected(e.key)}>
              <View style={[styles.dot, selected === e.key && { width: 20, backgroundColor: activeSectionConfig.color }]} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.timerWrap}>
          <TouchableOpacity
            style={[styles.timerBtn, { backgroundColor: ex.bg, borderColor: ex.color }]}
            onPress={startSession} activeOpacity={0.85}
          >
            <Ionicons name="play-circle-outline" size={26} color={ex.color} />
            <Text style={[styles.timerBtnText, { color: ex.color }]}>
              {isRTL ? `ابدأ التمرين · ${exDur}` : `Start · ${exDur}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ Add Exercise Modal ══ */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={closeAddModal} statusBarTranslucent={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={closeAddModal} />
          <View style={modal.addBox}>
            <View style={modal.addHeader}>
              <Text style={modal.addTitle}>{isRTL ? 'إضافة تمرين جديد' : 'Add New Exercise'}</Text>
              <TouchableOpacity onPress={closeAddModal} style={modal.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={modal.label}>{isRTL ? 'نوع التمرين' : 'Exercise Type'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={modal.typeRow}>
                {SECTION_CONFIGS.map((section) => {
                  const isActive = newType === section.key;
                  return (
                    <TouchableOpacity
                      key={section.key}
                      style={[modal.typeBtn, { borderColor: section.color }, isActive && { backgroundColor: section.color }]}
                      onPress={() => setNewType(section.key)} activeOpacity={0.8}
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
              <TextInput style={modal.emojiInput} value={newEmoji} onChangeText={setNewEmoji} placeholder="🏋️" maxLength={4} textAlign="center" />
              <Text style={modal.label}>{isRTL ? 'اسم التمرين *' : 'Exercise name *'}</Text>
              <TextInput style={[modal.input, { textAlign: isRTL ? 'right' : 'left' }]} value={newName} onChangeText={setNewName} placeholder={isRTL ? 'مثال: مشي على السلم' : 'e.g. Stair walking'} placeholderTextColor="#bbb" returnKeyType="next" />
              <Text style={modal.label}>{isRTL ? 'المدة بالدقائق *' : 'Duration (minutes) *'}</Text>
              <TextInput style={[modal.input, { textAlign: isRTL ? 'right' : 'left' }]} value={newMinutes} onChangeText={setNewMinutes} placeholder={isRTL ? 'مثال: 5' : 'e.g. 5'} placeholderTextColor="#bbb" keyboardType="numeric" returnKeyType="next" />
              <Text style={modal.label}>{isRTL ? 'وصف (اختياري)' : 'Description (optional)'}</Text>
              <TextInput style={[modal.input, modal.inputMulti, { textAlign: isRTL ? 'right' : 'left' }]} value={newDesc} onChangeText={setNewDesc} placeholder={isRTL ? 'وصف قصير للتمرين' : 'Short description'} placeholderTextColor="#bbb" multiline numberOfLines={2} />
              <TouchableOpacity
                style={[modal.saveBtn, { backgroundColor: SECTION_CONFIGS.find(s => s.key === newType)?.color ?? '#7C5CBF' }, savingEx && { opacity: 0.6 }]}
                onPress={handleAddExercise} disabled={savingEx} activeOpacity={0.85}
              >
                <Text style={modal.saveBtnText}>
                  {savingEx ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? '✅ حفظ التمرين' : '✅ Save Exercise')}
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
  navbar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: 10, marginBottom: Spacing.sm },
  navBtn:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle:  { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  navSub:    { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  sectionToggleScroll: { flexGrow: 0, marginBottom: 8 },
  sectionToggleRow:    { paddingHorizontal: Spacing.xl, gap: 8, flexDirection: 'row' },
  sectionBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#F5F5F5' },
  sectionBtnText:      { fontSize: 12, fontWeight: '700' },
  sectionCount:        { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionCountText:    { fontSize: 10, fontWeight: '800' },
  sectionDesc:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.xl, marginBottom: 8 },
  sectionDescText:     { fontSize: 11, fontStyle: 'italic' },
  cardsRow:            { paddingHorizontal: Spacing.xl, gap: 14, paddingBottom: Spacing.sm },
  card:                { borderRadius: Radius.xxl, padding: Spacing.sm, height: CARD_H, shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  cardTopRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  emojiCircle:         { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  selectedCheck:       { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  exerciseTypeBadge:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  exerciseTypeBadgeText: { fontSize: 14 },
  cardTitle:    { fontSize: FontSize.base, fontWeight: '800', marginBottom: 3 },
  durationRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  durationText: { fontSize: FontSize.sm, fontWeight: '600' },
  cardDesc:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 8 },
  stepsArea:    { flex: 1, overflow: 'hidden' },
  stepsScroll:  { flex: 1 },
  stepRow:      { alignItems: 'center', gap: 7, paddingHorizontal: 4, paddingVertical: 3, marginBottom: 5 },
  stepNum:      { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText:  { fontSize: 10, fontWeight: '700', color: '#fff' },
  stepText:     { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  speakBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12, marginTop: 6 },
  speakBtnText: { fontSize: 12, fontWeight: '700' },
  dotsRow:      { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm },
  dot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  timerWrap:    { paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: Spacing.xl, gap: 10, alignItems: 'center' },
  timerBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: Radius.xl, borderWidth: 2, paddingVertical: 14, paddingHorizontal: 28, width: '100%' },
  timerBtnText: { fontSize: FontSize.base, fontWeight: '700' },
  emptySection: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12, height: CARD_H },
  emptySectionText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  emptyAddBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16 },
  emptyAddText: { fontSize: 13, fontWeight: '700' },
});

const modal = StyleSheet.create({
  addBox:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 10 },
  addHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  addTitle:    { fontSize: 17, fontWeight: '800', color: '#2d2d2d' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  label:       { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 6, marginTop: 10 },
  emojiInput:  { borderWidth: 1.5, borderColor: '#e0d6f5', borderRadius: 12, fontSize: 28, padding: 10, textAlign: 'center', marginBottom: 4 },
  input:       { borderWidth: 1.5, borderColor: '#e0d6f5', borderRadius: 12, fontSize: 14, padding: 12, color: '#333' },
  inputMulti:  { height: 70, textAlignVertical: 'top' },
  saveBtn:     { borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  typeRow:     { flexDirection: 'row', gap: 8, marginBottom: 4, paddingBottom: 4 },
  typeBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#F8F8F8' },
  typeBtnText: { fontSize: 12, fontWeight: '700' },
});