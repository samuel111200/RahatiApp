// app/(tabs)/exercises.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { notify, suppressTaskListNotifOnce } from './notificationService';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { ALL_DEFAULT_EXERCISES_MAP as SHARED_MAP } from '../../utils/defaultExercises';

const { width, height } = Dimensions.get('window');
const CARD_W = width * 0.75;
const CARD_H = height * 0.52;

// ─── Types ────────────────────────────────────────────────
type ExerciseType = 'therapy' | 'yoga' | 'aerobic' | 'endurance' | 'strength' | 'coordination';

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
  fromDoctor?: boolean;
  completed?: boolean;
  doctorItemId?: string;
};

// ─── Storage Keys ─────────────────────────────────────────
const THERAPY_KEY      = 'therapy_exercises';
const YOGA_KEY         = 'yoga_exercises';
const AEROBIC_KEY      = 'aerobic_exercises';
const ENDURANCE_KEY    = 'endurance_exercises';
const STRENGTH_KEY     = 'strength_exercises';
const COORDINATION_KEY = 'coordination_exercises';

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
  {
    key: 'coordination',
    labelAr: 'تناسق',
    labelEn: 'Coordination',
    icon: 'sync-outline',
    color: '#2A9D8F',
    descAr: 'تمارين التناسق الحركي والتوازن',
    descEn: 'Motor coordination & balance exercises',
    emoji: '🎯',
  },
];

// ─── Section color map ────────────────────────────────────
const SECTION_COLOR_MAP: Record<SectionKey, string> = {
  therapy:      '#5B9BD5',
  yoga:         '#4CAF82',
  aerobic:      '#E07B5C',
  endurance:    '#D45BAA',
  strength:     '#7B5EA7',
  coordination: '#2A9D8F',
};

// ─── Section badge styles ─────────────────────────────────
const SECTION_BADGE: Record<SectionKey, { bg: string; color: string; label: string }> = {
  therapy:      { bg: '#5B9BD522', color: '#5B9BD5', label: '🩺' },
  yoga:         { bg: '#4CAF8222', color: '#4CAF82', label: '🧘' },
  aerobic:      { bg: '#E07B5C22', color: '#E07B5C', label: '🏃' },
  endurance:    { bg: '#D45BAA22', color: '#D45BAA', label: '💪' },
  strength:     { bg: '#7B5EA722', color: '#7B5EA7', label: '🏋️' },
  coordination: { bg: '#2A9D8F22', color: '#2A9D8F', label: '🎯' },
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
    title: 'ثني الرسغ',
    titleEn: 'Wrist Curls',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#5B9BD5',
    bg: '#E8F1FB',
    accent: '#D0E5F7',
    desc: 'يساعد على تقوية عضلات اليد والرسغ وتحسين الثبات والدقة في حركة الأصابع.',
    descEn: 'Helps strengthen wrist and hand muscles and improves stability and fine motor control of the fingers and hands.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise',
    type: 'therapy',
  },
  {
    key: 'hipStrength',
    emoji: '🦵',
    title: 'السير في وضع الوقوف ',
    titleEn: 'Marching on the spot (Standing)',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#5B9BD5',
    bg: '#E8F1FB',
    accent: '#D0E5F7',
    desc: 'التحكم في تغيير الاتجاهات أثناء المشي، كما يعزز الثبات والحركة الوظيفية اليومية.',
    descEn: 'This exercise helps improve balance and coordination, enhance control when changing directions while walking, and support stability and functional mobility in daily activities.',
    steps: [],
    stepsEn: [
    ],
    animType: 'hipMarch',
    type: 'therapy',
  },
  {
    key: 'legSwingBalance',
    emoji: '🦵',
    title: 'تمرين تأرجح الساق والثبات أثناء الوقوف',
    titleEn: 'Leg swing and hold, (Standing)',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#5B9BD5',
    bg: '#E8F1FB',
    accent: '#D0E5F7',
    desc: 'يساعد هذا التمرين على تحسين التوازن والثبات أثناء الوقوف، وزيادة مرونة مفصل الورك، كما يساهم في تحسين التحكم في حركة الساق أثناء المشي.',
    descEn: 'This exercise helps improve balance and stability while standing, increase hip joint flexibility, and enhance leg control during walking.',
    steps: [ ],
    stepsEn: [],
    animType: 'hipMarch',
    type: 'therapy',
  },
  {
    key: 'pelvisTiltSeated',
    emoji: '🦶',
    title: 'تمرين دوران الركبة أثناء الوقوف ',
    titleEn: 'Knee rotation, standing',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#5B9BD5',
    bg: '#E8F1FB',
    accent: '#D0E5F7',
    desc: 'يساعد هذا التمرين على تحسين مرونة مفصل الركبة وزيادة مدى الحركة، كما يساهم في تنشيط العضلات المحيطة بالمفصل وتحسين التوازن أثناء الوقوف.',
    descEn: 'This exercise helps improve knee joint flexibility and range of motion, while activating the surrounding muscles and enhancing balance during standing.',
    steps: [],
    stepsEn: [],
    animType: 'achillesRelease',
    type: 'therapy',
  },
  {
    key: 'upperFlexArmStrength',
    emoji: '🧘‍♀️',
    title: 'لفّ الجسم مع مد الذراعين أثناء الاستلقاء ',
    titleEn: 'Body rotation with arms outstretched, lying down',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#5B9BD5',
    bg: '#E8F1FB',
    accent: '#D0E5F7',
    desc: 'يساعد هذا التمرين على تحسين مرونة الجذع وزيادة مدى الحركة، كما يعزز التناسق بين جانبي الجسم ويُحسّن التحكم في الحركات الدورانية.',
    descEn: 'This exercise helps improve trunk flexibility, increase range of motion, and enhance coordination and control during rotational movements.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise',
    type: 'therapy',
  },
];

const DEFAULT_YOGA_EXERCISES: Exercise[] = [
  {
    key: 'childsPose',
    emoji: '🧘',
    title: 'وضعية الطفل ',
    titleEn: "Child's Pose (Balasana)",
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#4CAF82',
    bg: '#E8F5EF',
    accent: '#D6EFE3',
    desc: 'تساعد وضعية الطفل على الاسترخاء وتقليل التوتر والإجهاد، كما تعمل على إطالة عضلات الظهر والوركين بلطف، وتحسين مرونة الجسم. وتُعد من الوضعيات المفيدة لمرضى الشلل الرعاش لأنها تساعد على تهدئة الجسم والعقل، وتخفيف تيبّس العضلات، وتحسين الراحة العامة.',
    descEn: 'Child’s Pose helps promote relaxation and reduce stress and fatigue. It gently stretches the back and hip muscles while improving overall flexibility. For people with Parkinson’s disease, it can help relieve muscle stiffness, encourage relaxation, and enhance overall comfort and well-being.',
    steps: [],
    stepsEn: [],
    animType: 'sway',
    type: 'yoga',
  },
  {
    key: 'warriorTwo',
    emoji: '🥋',
    title: 'وضعية المحارب الثاني ',
    titleEn: 'Warrior II (Virabhadrasana II)',
    duration: '3 دقائق',
    durationEn: '3 minutes',
    durationSeconds: 180,
    color: '#4CAF82',
    bg: '#E8F5EF',
    accent: '#D6EFE3',
    desc: 'تساعد وضعية المحارب الثاني على تحسين التوازن والثبات، وتقوية عضلات الساقين والوركين والجذع، وزيادة القدرة على التحمل. كما تساهم في تحسين وضعية الجسم وفتح منطقة الصدر والكتفين. وبالنسبة لمرضى الشلل الرعاش، يمكن أن تساعد على تعزيز التوازن والتحكم في الحركة وتقليل خطر السقوط.',
    descEn: 'Warrior II helps improve balance and stability while strengthening the legs, hips, and core muscles. It also enhances endurance, posture, and flexibility in the chest and shoulders. For people with Parkinson’s disease, this pose can support better balance, movement control, and confidence during daily activities.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise',
    type: 'yoga',
  },
  {
    key: 'jabPunches',
    emoji: '👊',
    title: 'اللكمات الأمامية ',
    titleEn: 'Jab Punches',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#4CAF82',
    bg: '#E8F5EF',
    accent: '#D6EFE3',
    desc: 'يساعد تمرين اللكمات الأمامية على تحسين التناسق الحركي وسرعة الحركة، وتقوية عضلات الذراعين والكتفين، مع دعم التوازن والتحكم في الحركة.',
    descEn: 'Jab punches help improve coordination, movement speed, and upper-body strength, while supporting balance and motor control.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise',
    type: 'yoga',
  },
  {
    key: 'comboPunches',
    emoji: '🥊',
    title: 'اللكمات المركبة',
    titleEn: 'Combination Punches',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#4CAF82',
    bg: '#E8F5EF',
    accent: '#D6EFE3',
    desc: 'يساعد على تحسين التناسق الحركي وسرعة الحركة وتقوية عضلات الذراعين والكتفين مع دعم التوازن والتحكم في الحركة.',
    descEn: 'Helps improve coordination, movement speed, and strengthen the arms and shoulders while supporting balance and motor control.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise',
    type: 'yoga',
  },
  {
    key: 'lyingTwistArms',
    emoji: '🤸',
    title: 'تمرين تقوس الظهر أثناء الاستلقاء',
    titleEn: 'Back bend, lying down',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#4CAF82',
    bg: '#E8F5EF',
    accent: '#D6EFE3',
    desc: 'يساعد هذا التمرين على تقوية عضلات الظهر والحوض، وتحسين ثبات الجذع ومرونة العمود الفقري.',
    descEn: 'This exercise helps strengthen the back and pelvic muscles, improve trunk stability and spinal flexibility.',
    steps: [],
    stepsEn: [],
    animType: 'rollUp',
    type: 'yoga',
  },
];

const DEFAULT_AEROBIC_EXERCISES: Exercise[] = [
  {
    key: 'singleLegStand',
    emoji: '🦩',
    title: 'الوقوف على قدم واحدة',
    titleEn: 'Single Leg Stand',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#E07B5C',
    bg: '#FDF0EB',
    accent: '#FAE2D6',
    desc: 'يساعد على تحسين التوازن أثناء الوقوف وتقوية عضلات الساقين وزيادة الثبات أثناء الحركة.',
    descEn: 'Helps improve standing balance, strengthen leg muscles, and increase stability during movement.',
    steps: [],
    stepsEn: [],
    animType: 'hipMarch',
    type: 'aerobic',
  },
  {
    key: 'heelTapStanding',
    emoji: '👣',
    title: 'تمرين النقر بكعب القدم أثناء الوقوف',
    titleEn: 'Standing Heel Tap',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#E07B5C',
    bg: '#FDF0EB',
    accent: '#FAE2D6',
    desc: 'يساعد على تحسين التوازن أثناء الوقوف وتقوية التحكم في حركة الساقين والكاحل، مع تعزيز التنسيق بين الحركة والاتزان.',
    descEn: 'Helps improve standing balance, strengthen ankle and leg control, and enhance coordination and stability.',
    steps: [],
    stepsEn: [],
    animType: 'hipMarch',
    type: 'aerobic',
  },
  {
    key: 'kneeCircleStanding',
    emoji: '🔵',
    title: 'ثني الركبتين باستخدام كرسي',
    titleEn: 'Knee bends with a chair',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#E07B5C',
    bg: '#FDF0EB',
    accent: '#FAE2D6',
    desc: 'يساعد هذا التمرين على تقوية عضلات الفخذين والساقين، وتحسين التوازن والثبات، ودعم القدرة على الجلوس والوقوف والحركة اليومية.',
    descEn: 'This exercise helps strengthen the thigh and leg muscles, improve balance and stability, and support daily activities such as sitting, standing, and walking.',
    steps: [],
    stepsEn: [],
    animType: 'hipMarch',
    type: 'aerobic',
  },
  {
    key: 'trunkRotationStanding',
    emoji: '🔄',
    title: 'تمرين دوران الجذع أثناء الوقوف',
    titleEn: 'Rotating torso, (Standing)',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#E07B5C',
    bg: '#FDF0EB',
    accent: '#FAE2D6',
    desc: 'يساعد هذا التمرين على تحسين مرونة الجذع والعمود الفقري، وزيادة مدى الحركة الدورانية، كما يعزز التوازن والتناسق الحركي بين جانبي الجسم.',
    descEn: 'This exercise helps improve trunk and spinal flexibility, increase rotational range of motion, and enhance balance and coordination between both sides of the body.',
    steps: [],
    stepsEn: [],
    animType: 'rollUp',
    type: 'aerobic',
  },
  {
    key: 'toeTipHeelStand',
    emoji: '🧦',
    title: 'تمرين الوقوف على أطراف الأصابع والكعبين',
    titleEn: 'Toe Tip and Heel Stand',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#E07B5C',
    bg: '#FDF0EB',
    accent: '#FAE2D6',
    desc: 'يساعد على تقوية عضلات الساقين والكاحل وتحسين التوازن أثناء الوقوف، مع دعم الثبات والتحكم في الحركة.',
    descEn: 'Helps strengthen the leg and ankle muscles, improve standing balance, and support stability and movement control.',
    steps: [],
    stepsEn: [],
    animType: 'bounce',
    type: 'aerobic',
  },
  {
    key: 'trunkFlexibilityStanding',
    emoji: '🌊',
    title: 'تمرين مرونة حركة الجذع أثناء الوقوف',
    titleEn: 'Standing Trunk Flexibility',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#E07B5C',
    bg: '#FDF0EB',
    accent: '#FAE2D6',
    desc: 'تحسين مرونة الجذع والعمود الفقري وتخفيف تيبس الظهر',
    descEn: 'Improves trunk and spinal flexibility and relieves back stiffness',
    steps: [],
    stepsEn: [],
    animType: 'sway',
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
    steps: [],
    stepsEn: [],
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
    steps: [],
    stepsEn: [],
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
    desc: 'يساعد على تحسين مرونة الرقبة وزيادة مدى الحركة وتقليل التيبس، مع دعم الاسترخاء العضلي أثناء الاستلقاء.',
    descEn: 'Helps improve neck flexibility and range of motion, reduce stiffness, and promote muscle relaxation while lying down.',
    steps: [],
    stepsEn: [],
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
    desc: 'يساعد على تقوية عضلات الساقين وتحسين القدرة على النهوض من الجلوس، مع دعم التوازن أثناء الحركة.',
    descEn: 'Helps strengthen the leg muscles and improve the ability to stand up from sitting while supporting balance and movement control.',
    steps: [],
    stepsEn: [],
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
    steps: [],
    stepsEn: [],
    animType: 'rollUp',
    type: 'endurance',
  },
  {
    key: 'trunkBackFlexibility',
    emoji: '🌀',
    title: 'تقوية الذراعين وجذع الجسم أثناء الوقوف',
    titleEn: 'Arm and torso strength with scarf ,(Standing)',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#D45BAA',
    bg: '#FCEEF8',
    accent: '#F8D6F0',
    desc: 'يساعد تمرين تقوية الذراعين وجذع الجسم  على تحسين القوة العضلية، زيادة الثبات، ودعم القدرة على التحكم في الحركة والوضعية أثناء الوقوف.',
    descEn: 'This exercise improves arm and core strength, enhances stability, and supports better posture and movement control while standing.',
    steps: [],
    stepsEn: [],
    animType: 'rollUp',
    type: 'endurance',
  },
];

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
    steps: [],
    stepsEn: [],
    animType: 'hipMarch',
    type: 'strength',
  },
  {
    key: 'chairSquat',
    emoji: '🪑',
    title: 'القرفصاء باستخدام الكرسي',
    titleEn: 'Hip strength, sideways, (Standing)',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'يساعد هذا التمرين على تقوية عضلات الورك وتحسين التوازن والثبات أثناء الحركة.',
    descEn: 'This exercise helps strengthen the hip muscles and improve balance and stability during movement.',
    steps: [],
    stepsEn: [
    ],
    animType: 'bounce',
    type: 'strength',
  },
  {
    key: 'armLegStrength',
    emoji: '💪',
    title: 'تمرين تقوية الذراعين والساقين',
    titleEn: 'Arm and leg strength, on all fours',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'يساعد تمرين تقوية الذراعين والساقين على تحسين القوة العضلية، التوازن، وتناسق الحركة بين الأطراف مع دعم ثبات الجسم أثناء الحركة.',
    descEn: ' This exercise strengthens the arms and legs, improving balance, coordination, and overall body stability during controlled movements.',
    steps: [],
    stepsEn: [
    ],
    animType: 'hipMarch',
    type: 'strength',
  },
  {
    key: 'standingArmTrunk',
    emoji: '🏋️',
    title: 'تمرين إطالة ودوران الجزء العلوي من الجسم',
    titleEn: 'Upper body, stretching and rotation with a towel, standing',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: ' تمرين إطالة ودوران الجزء العلوي لتحسين مرونة الكتفين والظهر العلوي.',
    descEn: 'Upper body stretch and rotation  to improve shoulder and upper back flexibility.',
    steps: [],
    stepsEn: [
    ],
    animType: 'standingRow',
    type: 'strength',
  },
  {
    key: 'backBridgeLying',
    emoji: '🌉',
    title: 'تمارين مرونة الجذع والظهر ',
    titleEn: 'Trunk and Back Flexibility Exercises',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#7B5EA7',
    bg: '#F0EBF8',
    accent: '#E0D5F2',
    desc: 'يساعد هذا التمرين على تحسين مرونة الجذع والظهر، وزيادة مدى الحركة في العمود الفقري، كما يساهم في تحسين وضعية الجسم وتقليل التيبّس',
    descEn: 'This exercise helps improve trunk and back flexibility, increase spinal range of motion, and promote better posture while reducing stiffness',
    steps: [],
    stepsEn: [],
    animType: 'bounce',
    type: 'strength',
  },
];

const DEFAULT_COORDINATION_EXERCISES: Exercise[] = [
  {
    key: 'towelArmStrength',
    emoji: '🧣',
    title: 'تقوية الذراعين بالمنشفة أثناء الجلوس',
    titleEn: 'Seated Arm Strengthening with Towel',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#2A9D8F',
    bg: '#E6F5F3',
    accent: '#C8EBE7',
    desc: 'يساعد هذا التمرين على تقوية عضلات الذراعين وتحسين التحكم الحركي وزيادة التناسق بين الطرفين أثناء أداء حركة بسيطة وآمنة.',
    descEn: 'This exercise helps strengthen the arm muscles, improve motor control, and enhance coordination between both sides of the body through simple and safe movement.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise',
    type: 'coordination',
  },
  {
    key: 'seatedBicycle',
    emoji: '🚴',
    title: 'تمرين الدراجة الهوائية أثناء الجلوس',
    titleEn: 'Seated Bicycle Exercise',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#2A9D8F',
    bg: '#E6F5F3',
    accent: '#C8EBE7',
    desc: 'يساعد هذا التمرين على تنشيط عضلات الساقين وتحسين الدورة الدموية وزيادة مرونة المفاصل بطريقة آمنة أثناء الجلوس.',
    descEn: 'This exercise activates leg muscles, improves blood circulation, and enhances joint mobility safely while sitting.',
    steps: [],
    stepsEn: [],
    animType: 'hipMarch',
    type: 'coordination',
  },
  {
    key: 'seatedTwistKnee',
    emoji: '🔄',
    title: 'لف الجسم ولمس الركبة المعاكسة أثناء الجلوس',
    titleEn: 'Seated Trunk Twist and Opposite Knee Touch',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#2A9D8F',
    bg: '#E6F5F3',
    accent: '#C8EBE7',
    desc: 'يساعد هذا التمرين على تحسين التوازن والتحكم في حركة الجذع أثناء الجلوس.',
    descEn: 'This exercise helps improve balance and trunk control while sitting.',
    steps: [],
    stepsEn: [],
    animType: 'rollUp',
    type: 'coordination',
  },
  {
    key: 'lateralBalanceSeated',
    emoji: '⚖️',
    title: 'تمرين إمالة الحوض أثناء الجلوس',
    titleEn: 'Pelvic tilt, (Sitting)',
    duration: '5 دقائق',
    durationEn: '5 minutes',
    durationSeconds: 300,
    color: '#2A9D8F',
    bg: '#E6F5F3',
    accent: '#C8EBE7',
    desc: 'يساعد هذا التمرين على تحسين مرونة الحوض وأسفل الظهر، وتعزيز التحكم في وضعية الجلوس، كما يساهم في زيادة حركة الجذع وتقليل التيبّس.',
    descEn: 'This exercise helps improve pelvic and lower back flexibility, enhance postural control while sitting, and increase trunk mobility while reducing stiffness.',
    steps: [],
    stepsEn: [],
    animType: 'sway',
    type: 'coordination',
  },
];

// ─── Default exercise lookup (key → Exercise) ─────────────
const ALL_DEFAULT_EXERCISES_MAP: Record<string, Exercise> = Object.fromEntries(
    [
      ...DEFAULT_THERAPY_EXERCISES,
      ...DEFAULT_YOGA_EXERCISES,
      ...DEFAULT_AEROBIC_EXERCISES,
      ...DEFAULT_ENDURANCE_EXERCISES,
      ...DEFAULT_STRENGTH_EXERCISES,
      ...DEFAULT_COORDINATION_EXERCISES,
    ].map(e => [e.key, e]),
);

// ════════════════════════════════════════════════════════════
// ─── Main Screen ──────────────────────────────────────────
// ════════════════════════════════════════════════════════════
export default function ExercisesScreen() {
  const { isRTL, t } = useLang();
  const { user }  = useAuth();
  const router = useRouter();
  const eid = user?.uid ?? 'guest';
  const ek = (base: string) => `${eid}_${base}`;

  const [therapyList,      setTherapyList]      = useState<Exercise[]>([]);
  const [yogaList,         setYogaList]         = useState<Exercise[]>([]);
  const [aerobicList,      setAerobicList]      = useState<Exercise[]>([]);
  const [enduranceList,    setEnduranceList]    = useState<Exercise[]>([]);
  const [strengthList,     setStrengthList]     = useState<Exercise[]>([]);
  const [coordinationList, setCoordinationList] = useState<Exercise[]>([]);

  // ── Doctor exercises from Firebase ────────────────────
  const [doctorExercises, setDoctorExercises] = useState<Exercise[]>([]);

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

  // ── Load doctor exercises from Firebase ───────────────
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const unsub = onSnapshot(
        collection(db, 'exercises', uid, 'items'),
        (snap) => {
          const list: Exercise[] = snap.docs.map(d => {
            const data = d.data() as any;
            const sectionKey = (data.type ?? 'therapy') as SectionKey;
            // Full data: prefer what doctor stored in Firestore, fall back to shared map
            const shared = SHARED_MAP[data.systemKey];
            return {
              key:             `doctor_${d.id}`,
              doctorItemId:    d.id,
              systemKey:       data.systemKey ?? '',
              emoji:           data.emoji || shared?.emoji || '🏋️',
              title:           data.title || shared?.title || '',
              titleEn:         data.titleEn || shared?.titleEn || data.title || '',
              duration:        `${data.durationMin} دقيقة`,
              durationEn:      `${data.durationMin} min`,
              durationSeconds: (data.durationMin ?? 5) * 60,
              color:           data.color  || shared?.color  || SECTION_COLOR_MAP[sectionKey] || '#7C5CBF',
              bg:              data.bg     || shared?.bg     || '#F0EBFA',
              accent:          data.accent || shared?.accent || '#E0D6F5',
              desc:            data.description || shared?.desc || '',
              descEn:          data.descEn      || shared?.descEn || data.description || '',
              // Steps: stored steps first (doctor may have customized), fall back to shared map
              steps:   (data.steps?.length   ? data.steps   : shared?.steps)   ?? [],
              stepsEn: (data.stepsEn?.length ? data.stepsEn : shared?.stepsEn) ?? [],
              animType:   (data.animType || shared?.animType || 'bounce') as Exercise['animType'],
              type:       sectionKey,
              fromDoctor: true,
              completed:  data.completed ?? false,
              doctorNote: data.doctorNote || '',
            } as Exercise & { doctorNote?: string };
          });
          setDoctorExercises(list.sort((a, b) =>
              (b as any).assignedAt - (a as any).assignedAt
          ));
        },
    );
    return unsub;
  }, [user?.uid]);

  // ── Toggle doctor exercise done ────────────────────────
  const toggleDoctorExerciseDone = async (item: Exercise) => {
    const uid = user?.uid;
    if (!uid || !item.doctorItemId) return;
    try {
      await updateDoc(doc(db, 'exercises', uid, 'items', item.doctorItemId), {
        completed: !item.completed,
      });
    } catch (e) {
      console.warn('[Exercises] toggleDone error:', e);
    }
  };

  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getListAndSetter(type: SectionKey): [Exercise[], React.Dispatch<React.SetStateAction<Exercise[]>>, string] {
    switch (type) {
      case 'therapy':      return [therapyList,      setTherapyList,      ek(THERAPY_KEY)];
      case 'yoga':         return [yogaList,          setYogaList,         ek(YOGA_KEY)];
      case 'aerobic':      return [aerobicList,       setAerobicList,      ek(AEROBIC_KEY)];
      case 'endurance':    return [enduranceList,     setEnduranceList,    ek(ENDURANCE_KEY)];
      case 'strength':     return [strengthList,      setStrengthList,     ek(STRENGTH_KEY)];
      case 'coordination': return [coordinationList,  setCoordinationList, ek(COORDINATION_KEY)];
    }
  }

  function getAllExercises(): Exercise[] {
    return [
      ...doctorExercises,
      ...therapyList, ...yogaList, ...aerobicList,
      ...enduranceList, ...strengthList, ...coordinationList,
    ];
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
    const migrated = await AsyncStorage.getItem(ek('exercises_v8_migrated'));
    if (!migrated) {
      await AsyncStorage.multiRemove([
        ek('core_exercises'), ek('extra_exercises'), ek('therapy_exercises'),
        ek('yoga_exercises'), ek('aerobic_exercises'), ek('endurance_exercises'),
        ek('strength_exercises'), ek('coordination_exercises'),
      ]);
      await AsyncStorage.setItem(ek('exercises_v8_migrated'), '1');
    }

    await AsyncStorage.removeItem(ek(THERAPY_KEY));
    await AsyncStorage.setItem(ek(THERAPY_KEY), JSON.stringify(DEFAULT_THERAPY_EXERCISES));
    setTherapyList(DEFAULT_THERAPY_EXERCISES);

    await AsyncStorage.removeItem(ek(YOGA_KEY));
    await AsyncStorage.setItem(ek(YOGA_KEY), JSON.stringify(DEFAULT_YOGA_EXERCISES));
    setYogaList(DEFAULT_YOGA_EXERCISES);

    await AsyncStorage.removeItem(ek(AEROBIC_KEY));
    await AsyncStorage.setItem(ek(AEROBIC_KEY), JSON.stringify(DEFAULT_AEROBIC_EXERCISES));
    setAerobicList(DEFAULT_AEROBIC_EXERCISES);

    await AsyncStorage.removeItem(ek(ENDURANCE_KEY));
    await AsyncStorage.setItem(ek(ENDURANCE_KEY), JSON.stringify(DEFAULT_ENDURANCE_EXERCISES));
    setEnduranceList(DEFAULT_ENDURANCE_EXERCISES);

    await AsyncStorage.removeItem(ek(STRENGTH_KEY));
    await AsyncStorage.setItem(ek(STRENGTH_KEY), JSON.stringify(DEFAULT_STRENGTH_EXERCISES));
    setStrengthList(DEFAULT_STRENGTH_EXERCISES);

    await AsyncStorage.removeItem(ek(COORDINATION_KEY));
    await AsyncStorage.setItem(ek(COORDINATION_KEY), JSON.stringify(DEFAULT_COORDINATION_EXERCISES));
    setCoordinationList(DEFAULT_COORDINATION_EXERCISES);
  }

  // ── Merge doctor exercises into section list ───────────
  const SECTION_EXERCISES = (() => {
    const docInSection = doctorExercises.filter(e => e.type === activeSection);
    // When doctor has assigned exercises, show only doctor exercises
    if (doctorExercises.length > 0) return docInSection;
    const base = (() => {
      switch (activeSection) {
        case 'therapy':      return therapyList;
        case 'yoga':         return yogaList;
        case 'aerobic':      return aerobicList;
        case 'endurance':    return enduranceList;
        case 'strength':     return strengthList;
        case 'coordination': return coordinationList;
      }
    })();
    return [...docInSection, ...base];
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
        videoKey:        (ex as any).systemKey ?? ex.key,
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

  async function handleDeleteExercise(item: Exercise) {
    suppressTaskListNotifOnce();
    const [list, setter, storageKey] = getListAndSetter(item.type);
    const updated = list.filter(e => e.key !== item.key);
    setter(updated);
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    if (selected === item.key && updated.length > 0) setSelected(updated[0].key);
    await AsyncStorage.setItem(ek('data_changed_at'), Date.now().toString());
    await notify({
      title: t.exerciseDeleted,
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
      Alert.alert(t.error, t.docEnterExerciseName);
      return;
    }
    if (!newMinutes.trim()) {
      Alert.alert(t.error, t.docEnterValidDuration);
      return;
    }
    const mins = parseInt(newMinutes);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert(t.error, t.docEnterValidDuration);
      return;
    }
    if (savingEx) return;
    setSavingEx(true);
    try {
      const sectionConfig = SECTION_CONFIGS.find(s => s.key === newType)!;
      const newEx: Exercise = {
        key: `custom_${Date.now()}`, emoji: newEmoji.trim() || '🏋️',
        title: newName.trim(), titleEn: newName.trim(),
        duration: `${mins} ${t.exerciseMinute}`, durationEn: `${mins} min`,
        durationSeconds: mins * 60, color: sectionConfig.color,
        bg: '#F8F8F8', accent: '#EEEEEE',
        desc: newDesc.trim() || t.customExercise.replace('✨ ', ''),
        descEn: newDesc.trim() || 'Custom exercise',
        steps: [], stepsEn: [], animType: 'bounce', type: newType, custom: true,
      };
      closeAddModal();
      const [list, setter, storageKey] = getListAndSetter(newType);
      const updated = [...list, newEx];
      setter(updated);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      await AsyncStorage.setItem(ek('data_changed_at'), Date.now().toString());
      setSelected(newEx.key);
      setActiveSection(newType);
      suppressTaskListNotifOnce();
      await notify({
        title: t.exerciseAdded,
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

  // ── Count for section tabs (include doctor exercises) ──
  function getSectionCount(key: SectionKey): number {
    const docCount = doctorExercises.filter(e => e.type === key).length;
    if (doctorExercises.length > 0) return docCount;
    switch (key) {
      case 'therapy':      return therapyList.length;
      case 'yoga':         return yogaList.length;
      case 'aerobic':      return aerobicList.length;
      case 'endurance':    return enduranceList.length;
      case 'strength':     return strengthList.length;
      case 'coordination': return coordinationList.length;
    }
  }

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
              onLongPress={() => {
                // Doctor exercises: toggle done on long press
                if (item.fromDoctor) {
                  toggleDoctorExerciseDone(item);
                  return;
                }
                if (!item.custom) return;
                const title = isRTL ? item.title : item.titleEn;
                Alert.alert(
                    t.exerciseOptions,
                    `"${title}"`,
                    [
                      { text: t.cancel, style: 'cancel' },
                      {
                        text: t.deleteTask,
                        style: 'destructive',
                        onPress: () => handleDeleteExercise(item),
                      },
                    ],
                );
              }}
              delayLongPress={600}
              activeOpacity={0.88}
              style={[
                styles.card,
                {
                  backgroundColor: item.fromDoctor
                      ? (item.completed ? '#F0FFF4' : '#F8F5FF')
                      : item.bg,
                  width: CARD_W,
                },
                iSel && { borderWidth: 2.5, borderColor: item.color },
                // Doctor exercises get a subtle purple border always
                item.fromDoctor && !iSel && {
                  borderWidth: 1.5,
                  borderColor: '#7C5CBF40',
                },
              ]}
          >
            <View style={[styles.cardTopRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[
                styles.emojiCircle,
                { backgroundColor: item.fromDoctor ? '#E8DFFA' : item.accent },
              ]}>
                <Text style={{ fontSize: 30 }}>{item.emoji}</Text>
              </View>

              {iSel && (
                  <View style={[styles.selectedCheck, { backgroundColor: item.color }]}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
              )}

              {/* ── Doctor badge ── */}
              {item.fromDoctor && (
                  <View style={styles.doctorBadge}>
                    <Ionicons name="medical" size={10} color="#fff" />
                    <Text style={styles.doctorBadgeText}>{t.doctorExercise}</Text>
                  </View>
              )}

              {/* ── Done badge for doctor exercises ── */}
              {item.fromDoctor && item.completed && (
                  <View style={styles.doneBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                    <Text style={styles.doneBadgeText}>{t.docExercisesDone}</Text>
                  </View>
              )}

              {!item.fromDoctor && (
                  <View style={[styles.exerciseTypeBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.exerciseTypeBadgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
              )}
            </View>

            <Text style={[
              styles.cardTitle,
              {
                color: item.fromDoctor ? '#7C5CBF' : item.color,
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}>
              {iTitle}
            </Text>

            <View style={[styles.durationRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="time-outline" size={13} color={item.fromDoctor ? '#7C5CBF' : item.color} />
              <Text style={[styles.durationText, { color: item.fromDoctor ? '#7C5CBF' : item.color }]}>
                {' '}{iDur}
              </Text>
            </View>

            {!!iDesc && (
                <Text style={[styles.cardDesc, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {iDesc}
                </Text>
            )}

            {/* Doctor exercise: steps + note + done button */}
            {item.fromDoctor ? (
                <View style={styles.doctorCardFooter}>
                  {/* Doctor note */}
                  {!!(item as any).doctorNote && (
                      <View style={styles.doctorNoteBox}>
                        <Ionicons name="information-circle-outline" size={13} color="#7C5CBF" />
                        <Text style={styles.doctorNoteText}>{(item as any).doctorNote}</Text>
                      </View>
                  )}
                  {/* Steps — same as regular exercises */}
                  {iSteps.length > 0 && (
                      <ScrollView
                          style={[styles.stepsScroll, { maxHeight: 140 }]}
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
                              <View style={[styles.stepNum, { backgroundColor: '#7C5CBF99' }]}>
                                <Text style={styles.stepNumText}>{i + 1}</Text>
                              </View>
                              <Text style={[styles.stepText, { textAlign: isRTL ? 'right' : 'left' }]}>{step}</Text>
                            </TouchableOpacity>
                        ))}
                      </ScrollView>
                  )}
                  <TouchableOpacity
                      style={[
                        styles.doctorDoneBtn,
                        { backgroundColor: item.completed ? '#4CAF5015' : '#7C5CBF15', marginTop: iSteps.length > 0 ? 8 : 0 },
                      ]}
                      onPress={() => toggleDoctorExerciseDone(item)}
                      activeOpacity={0.8}
                  >
                    <Ionicons
                        name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={item.completed ? '#4CAF50' : '#7C5CBF'}
                    />
                    <Text style={[styles.doctorDoneBtnText, { color: item.completed ? '#4CAF50' : '#7C5CBF' }]}>
                      {item.completed ? t.exerciseDoneDr : t.exerciseTapWhenDone}
                    </Text>
                  </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.stepsArea}>
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
                          <Text style={[styles.stepText, { textAlign: isRTL ? 'right' : 'left' }]}>
                            {step}
                          </Text>
                        </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {iSel && iSteps.length > 0 && (
                      <TouchableOpacity
                          style={[styles.speakBtn, { borderColor: item.color, backgroundColor: item.bg }]}
                          onPress={() => isSpeaking ? stopSpeaking() : speakAllSteps(item)}
                          activeOpacity={0.8}
                      >
                        <Ionicons
                            name={isSpeaking ? 'stop-circle-outline' : 'volume-high-outline'}
                            size={16}
                            color={item.color}
                        />
                        <Text style={[styles.speakBtnText, { color: item.color }]}>
                          {isSpeaking ? t.stopReadSteps : t.readSteps}
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
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.container}>

          <View style={[styles.navbar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={openAddModal} style={styles.navBtn}>
              <Ionicons name="add" size={24} color="#7C5CBF" />
            </TouchableOpacity>
            <Text style={styles.navTitle}>{t.dailyExercises}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* ── Section Tabs ── */}
          <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.sectionToggleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              style={styles.sectionToggleScroll}
          >
            {SECTION_CONFIGS.map((section) => {
              const isActive = activeSection === section.key;
              const count = getSectionCount(section.key);
              const docCountInSection = doctorExercises.filter(e => e.type === section.key).length;
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
                    <View style={[
                      styles.sectionCount,
                      { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : section.color + '22' },
                    ]}>
                      <Text style={[styles.sectionCountText, { color: isActive ? '#fff' : section.color }]}>
                        {count}
                      </Text>
                    </View>
                    {/* Small doctor indicator on tab if has doctor exercises */}
                    {docCountInSection > 0 && (
                        <View style={styles.tabDoctorDot} />
                    )}
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
                    style={[
                      styles.emptyAddBtn,
                      {
                        borderColor: activeSectionConfig.color,
                        backgroundColor: activeSectionConfig.color + '11',
                      },
                    ]}
                    onPress={() => { setNewType(activeSection); openAddModal(); }}
                >
                  <Ionicons name="add" size={16} color={activeSectionConfig.color} />
                  <Text style={[styles.emptyAddText, { color: activeSectionConfig.color }]}>{t.addExercise}</Text>
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
                  <View style={[
                    styles.dot,
                    selected === e.key && { width: 20, backgroundColor: activeSectionConfig.color },
                    e.fromDoctor && { backgroundColor: '#7C5CBF60' },
                  ]} />
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
                {t.startDot}{exDur}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Add Modal ── */}
        <Modal
            visible={showAdd} transparent animationType="slide"
            onRequestClose={closeAddModal} statusBarTranslucent={false}
        >
          <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
                activeOpacity={1} onPress={closeAddModal}
            />
            <View style={modal.addBox}>
              <View style={modal.addHeader}>
                <Text style={modal.addTitle}>{t.addNewExercise}</Text>
                <TouchableOpacity onPress={closeAddModal} style={modal.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color="#888" />
                </TouchableOpacity>
              </View>
              <ScrollView
                  contentContainerStyle={{ paddingBottom: 24 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
              >
                <Text style={modal.label}>{t.exerciseType}</Text>
                <ScrollView
                    horizontal showsHorizontalScrollIndicator={false}
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

                <Text style={modal.label}>{t.exerciseEmoji}</Text>
                <TextInput
                    style={modal.emojiInput}
                    value={newEmoji} onChangeText={setNewEmoji}
                    placeholder="🏋️" maxLength={4} textAlign="center"
                />

                <Text style={modal.label}>{t.exerciseNameLabel}</Text>
                <TextInput
                    style={[modal.input, { textAlign: isRTL ? 'right' : 'left' }]}
                    value={newName} onChangeText={setNewName}
                    placeholder={t.exerciseNamePlaceholder}
                    placeholderTextColor="#bbb" returnKeyType="next"
                />

                <Text style={modal.label}>{t.exerciseDurationLabel}</Text>
                <TextInput
                    style={[modal.input, { textAlign: isRTL ? 'right' : 'left' }]}
                    value={newMinutes} onChangeText={setNewMinutes}
                    placeholder={t.exerciseDurationPlaceholder}
                    placeholderTextColor="#bbb" keyboardType="numeric" returnKeyType="next"
                />

                <Text style={modal.label}>{t.exerciseDescLabel}</Text>
                <TextInput
                    style={[modal.input, modal.inputMulti, { textAlign: isRTL ? 'right' : 'left' }]}
                    value={newDesc} onChangeText={setNewDesc}
                    placeholder={t.exerciseDescPlaceholder}
                    placeholderTextColor="#bbb" multiline numberOfLines={2}
                />

                <TouchableOpacity
                    style={[
                      modal.saveBtn,
                      { backgroundColor: SECTION_CONFIGS.find(s => s.key === newType)?.color ?? '#7C5CBF' },
                      savingEx && { opacity: 0.6 },
                    ]}
                    onPress={handleAddExercise} disabled={savingEx} activeOpacity={0.85}
                >
                  <Text style={modal.saveBtnText}>
                    {savingEx ? t.saving : t.saveExercise}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 4,
    paddingBottom: 10,
    marginBottom: Spacing.sm,
  },
  navBtn:   {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  navTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },

  sectionToggleScroll: { flexGrow: 0, marginBottom: 8 },
  sectionToggleRow:    { paddingHorizontal: Spacing.xl, gap: 8, flexDirection: 'row' },
  sectionBtn:          {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 14, backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  sectionBtnText:   { fontSize: 12, fontWeight: '700' },
  sectionCount:     { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontSize: 10, fontWeight: '800' },

  // Small dot on tab indicating doctor exercises exist
  tabDoctorDot: {
    position: 'absolute', top: 4, right: 4,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#7C5CBF',
  },

  sectionDesc:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.xl, marginBottom: 8 },
  sectionDescText: { fontSize: 11, fontStyle: 'italic' },
  cardsRow:        { paddingHorizontal: Spacing.xl, gap: 14, paddingBottom: Spacing.sm },

  card: {
    borderRadius: Radius.xxl, padding: Spacing.sm,
    height: CARD_H,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  cardTopRow:  {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  emojiCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  selectedCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  exerciseTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  exerciseTypeBadgeText: { fontSize: 14 },

  // ── Doctor badge (top-right corner of card) ──
  doctorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#7C5CBF', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  doctorBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  // ── Done badge ──
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#4CAF5020', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  doneBadgeText: { fontSize: 10, color: '#4CAF50', fontWeight: '700' },

  // ── Doctor card footer ──
  doctorCardFooter: { flex: 1, justifyContent: 'flex-end', marginTop: 8 },
  doctorNoteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
    backgroundColor: '#7C5CBF12', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8,
  },
  doctorNoteText: { flex: 1, fontSize: 12, color: '#7C5CBF', fontWeight: '600', lineHeight: 18 },
  doctorDoneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  doctorDoneBtnText: { fontSize: 13, fontWeight: '700' },

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

  timerWrap:    { paddingHorizontal: Spacing.xl, paddingTop: Spacing.base, paddingBottom: 18, gap: 10, alignItems: 'center' },
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