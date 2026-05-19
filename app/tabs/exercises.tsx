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

const { width, height } = Dimensions.get('window');
const CARD_W = width * 0.7;
// ارتفاع ثابت للكارد عشان البوتن يبان تحته
const CARD_H = height * 0.42;

type Exercise = {
  key: string;
  emoji: string;
  title: string;
  duration: string;
  durationSeconds: number;
  color: string;
  bg: string;
  accent: string;
  desc: string;
  steps: string[];
  custom?: boolean;
};

const CONGRATS = [
  'أحسنت! 🎉 استمر على هذا الإيقاع الرائع',
  'رائع جداً! 💪 جسمك يشكرك على هذه الاستراحة',
  'ممتاز! 🌟 كل تمرين صغير يصنع فرقاً كبيراً',
  'أنت بطل! 🏆 الاستمرارية هي سر النجاح',
  'جميل جداً! 🌸 استراحة قصيرة تعيد الطاقة والتركيز',
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const EXERCISES_STORAGE_KEY = 'custom_exercises';

export default function ExercisesScreen() {
  const { t, isRTL } = useLang();
  const navigation   = useNavigation();

  const [selected,    setSelected]    = useState('deep');
  const [energy,      setEnergy]      = useState(50);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft,    setTimeLeft]    = useState(0);
  const [showDone,    setShowDone]    = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [customList,  setCustomList]  = useState<Exercise[]>([]);
  const [newName,     setNewName]     = useState('');
  const [newEmoji,    setNewEmoji]    = useState('🏋️');
  const [newMinutes,  setNewMinutes]  = useState('');
  const [newDesc,     setNewDesc]     = useState('');
  const [congratsMsg] = useState(CONGRATS[Math.floor(Math.random() * CONGRATS.length)]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const storedEnergy = await AsyncStorage.getItem('energy_level');
      if (storedEnergy) setEnergy(Number(storedEnergy));
      const storedCustom = await AsyncStorage.getItem(EXERCISES_STORAGE_KEY);
      if (storedCustom) setCustomList(JSON.parse(storedCustom));
    })();
  }, []));

  const BASE_EXERCISES: Exercise[] = [
    {
      key: 'deep', emoji: '🧘',
      title: isRTL ? 'التنفس العميق' : 'Deep Breathing',
      duration: isRTL ? '5 دقائق' : '5 minutes', durationSeconds: 300,
      color: '#7C5CBF', bg: '#F0EBFA', accent: '#EDE4FA',
      desc: isRTL ? 'استرخِ وتنفس ببطء' : 'Relax and breathe slowly',
      steps: isRTL
        ? ['استنشق ببطء لمدة 4 ثوانٍ', 'احبس النفس 4 ثوانٍ', 'أخرج الهواء ببطء 6 ثوانٍ']
        : ['Inhale slowly for 4 seconds', 'Hold for 4 seconds', 'Exhale slowly for 6 seconds'],
    },
    {
      key: 'stretch', emoji: '🤸',
      title: isRTL ? 'الإطالة الخفيفة' : 'Light Stretching',
      duration: isRTL ? '10 دقائق' : '10 minutes', durationSeconds: 600,
      color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
      desc: isRTL ? 'مدّ عضلاتك برفق' : 'Gently stretch your muscles',
      steps: isRTL
        ? ['مد ذراعيك للأعلى', 'دوّر رقبتك برفق', 'انحنِ للأمام ببطء']
        : ['Stretch your arms up', 'Gently rotate your neck', 'Slowly bend forward'],
    },
    {
      key: 'eyes', emoji: '👁️',
      title: isRTL ? 'راحة العيون' : 'Eye Rest',
      duration: isRTL ? '3 دقائق' : '3 minutes', durationSeconds: 180,
      color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
      desc: isRTL ? 'أعطِ عينيك استراحة' : 'Give your eyes a break',
      steps: isRTL
        ? ['غطّ عينيك بكفيك', 'انظر إلى شيء بعيد', 'أغمض عينيك دقيقة']
        : ['Cover your eyes with palms', 'Look at something far away', 'Close your eyes for a minute'],
    },
    {
      key: 'water', emoji: '💧',
      title: isRTL ? 'اشرب الماء' : 'Drink Water',
      duration: isRTL ? 'دقيقة واحدة' : '1 minute', durationSeconds: 60,
      color: '#29B6D4', bg: '#E1F8FC', accent: '#C0EFF6',
      desc: isRTL ? 'حافظ على ترطيب جسمك' : 'Stay hydrated',
      steps: isRTL
        ? ['اشرب كوباً كاملاً', 'انتظر دقيقة', 'اشرب كوباً آخر إذا أمكن']
        : ['Drink a full glass', 'Wait a minute', 'Drink another if possible'],
    },
    {
      key: 'walk', emoji: '🚶',
      title: isRTL ? 'مشي خفيف' : 'Light Walk',
      duration: isRTL ? 'دقيقتان' : '2 minutes', durationSeconds: 120,
      color: '#43A88C', bg: '#E6F6F2', accent: '#CCF0E6',
      desc: isRTL ? 'نشّط دورتك الدموية' : 'Activate your blood circulation',
      steps: isRTL
        ? ['قف من مكانك', 'امشِ حول الغرفة', 'عد وأنت تشعر بانتعاش']
        : ['Stand up', 'Walk around the room', 'Return feeling refreshed'],
    },
    {
      key: 'neck', emoji: '🔄',
      title: isRTL ? 'تمرين الرقبة' : 'Neck Exercise',
      duration: isRTL ? 'دقيقتان' : '2 minutes', durationSeconds: 120,
      color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
      desc: isRTL ? 'خفّف توتر رقبتك' : 'Relieve neck tension',
      steps: isRTL
        ? ['دوّر رقبتك يميناً ببطء', 'دوّرها يساراً ببطء', 'كرر 5 مرات']
        : ['Rotate neck slowly right', 'Rotate slowly left', 'Repeat 5 times'],
    },
    {
      key: 'jump', emoji: '🏃',
      title: isRTL ? 'قفز في المكان' : 'Jumping in Place',
      duration: isRTL ? '30 ثانية' : '30 seconds', durationSeconds: 30,
      color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
      desc: isRTL ? 'ارفع طاقتك بسرعة' : 'Boost your energy fast',
      steps: isRTL
        ? ['قف بشكل مستقيم', 'اقفز خفيفاً في مكانك', 'توقف وخذ نفساً']
        : ['Stand straight', 'Jump lightly in place', 'Stop and take a breath'],
    },
    {
      key: 'back', emoji: '🙆',
      title: isRTL ? 'تمدد الظهر' : 'Back Stretch',
      duration: isRTL ? 'دقيقة' : '1 minute', durationSeconds: 60,
      color: '#8E6BBF', bg: '#F2ECFB', accent: '#E4D5F7',
      desc: isRTL ? 'ريّح ظهرك من الجلوس' : 'Rest your back from sitting',
      steps: isRTL
        ? ['قف ومدّ ذراعيك للأعلى', 'انحنِ للخلف برفق', 'ارجع ببطء للوضع الطبيعي']
        : ['Stand and stretch arms up', 'Gently lean back', 'Slowly return to normal'],
    },
    {
      key: 'shoulders', emoji: '💪',
      title: isRTL ? 'تمرين الكتفين' : 'Shoulder Exercise',
      duration: isRTL ? 'دقيقة' : '1 minute', durationSeconds: 60,
      color: '#5B88D5', bg: '#EBF1FD', accent: '#D0E0FA',
      desc: isRTL ? 'أزل توتر الكتفين' : 'Release shoulder tension',
      steps: isRTL
        ? ['دوّر كتفيك للأمام 5 مرات', 'دوّرهما للخلف 5 مرات', 'ارخِ كتفيك ببطء']
        : ['Roll shoulders forward 5x', 'Roll backward 5x', 'Relax shoulders slowly'],
    },
    {
      key: 'belly', emoji: '🫁',
      title: isRTL ? 'تنفس بطني' : 'Belly Breathing',
      duration: isRTL ? 'دقيقتان' : '2 minutes', durationSeconds: 120,
      color: '#6BAF5B', bg: '#EDF7EB', accent: '#D6EFD3',
      desc: isRTL ? 'هدّئ جهازك العصبي' : 'Calm your nervous system',
      steps: isRTL
        ? ['ضع يدك على بطنك', 'استنشق ببطء وابرز بطنك', 'أخرج الهواء ببطء 5 مرات']
        : ['Place hand on belly', 'Inhale slowly and expand', 'Exhale slowly 5 times'],
    },
    {
      key: 'fingers', emoji: '🤲',
      title: isRTL ? 'تمرين الأصابع' : 'Finger Exercise',
      duration: isRTL ? 'دقيقة' : '1 minute', durationSeconds: 60,
      color: '#C97B3A', bg: '#FEF3E2', accent: '#FDE5C4',
      desc: isRTL ? 'أرِح أصابعك من الكتابة' : 'Rest fingers from typing',
      steps: isRTL
        ? ['افتح يديك بالكامل', 'أغلقهما بقوة', 'كرر 10 مرات']
        : ['Open hands fully', 'Close them firmly', 'Repeat 10 times'],
    },
  ];

  const EXERCISES = [...BASE_EXERCISES, ...customList];
  const ex = EXERCISES.find(e => e.key === selected) ?? EXERCISES[0];

  // ── Timer logic ───────────────────────────────────────
  function startTimer() {
    if (timerActive) {
      clearInterval(intervalRef.current!);
      setTimerActive(false);
      setTimeLeft(0);
      return;
    }
    setTimeLeft(ex.durationSeconds);
    setTimerActive(true);
  }

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setTimerActive(false);
            setShowDone(true);
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
  }, [selected]);

  // ── Add custom exercise ───────────────────────────────
  async function handleAddExercise() {
    if (!newName.trim() || !newMinutes.trim()) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'يرجى إدخال الاسم والمدة' : 'Please enter name and duration');
      return;
    }
    const mins = parseInt(newMinutes);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'أدخل عدداً صحيحاً للدقائق' : 'Enter a valid number of minutes');
      return;
    }
    const newEx: Exercise = {
      key:             `custom_${Date.now()}`,
      emoji:           newEmoji || '🏋️',
      title:           newName.trim(),
      duration:        isRTL ? `${mins} دقيقة` : `${mins} min`,
      durationSeconds: mins * 60,
      color:           '#7C5CBF',
      bg:              '#F0EBFA',
      accent:          '#EDE4FA',
      desc:            newDesc.trim() || (isRTL ? 'تمرين مخصص' : 'Custom exercise'),
      steps:           [],
      custom:          true,
    };
    const updated = [...customList, newEx];
    setCustomList(updated);
    await AsyncStorage.setItem(EXERCISES_STORAGE_KEY, JSON.stringify(updated));
    setSelected(newEx.key);
    setShowAdd(false);
    setNewName(''); setNewEmoji('🏋️'); setNewMinutes(''); setNewDesc('');
  }

  const energyOk = energy >= 50;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Navbar ── */}
        <View style={[styles.navbar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={22} color="#2d2d2d" />
          </TouchableOpacity>

          <View style={styles.navCenter}>
            <Text style={styles.navTitle}>{t.todayExercises ?? 'تمارين اليوم'}</Text>
            <Text style={styles.navSub}>{t.chooseExercise ?? 'اختر تمرينك'}</Text>
          </View>

          <TouchableOpacity onPress={() => setShowAdd(true)} style={[styles.navBtn, { backgroundColor: '#fff' }]}>
            <Ionicons name="add" size={24} color="#7C5CBF" />
          </TouchableOpacity>
        </View>

        {/* ── Cards ── */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={CARD_W + 14}
          contentContainerStyle={styles.cardsRow}
          style={{ flexGrow: 0 }}
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
              <View style={[styles.cardTopRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.emojiCircle, { backgroundColor: item.accent }]}>
                  <Text style={{ fontSize: 30 }}>{item.emoji}</Text>
                </View>
                {selected === item.key && (
                  <View style={[styles.selectedCheck, { backgroundColor: item.color }]}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[styles.cardTitle, { color: item.color, textAlign: isRTL ? 'right' : 'left' }]}>
                {item.title}
              </Text>
              <View style={[styles.durationRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="time-outline" size={13} color={item.color} />
                <Text style={[styles.durationText, { color: item.color }]}> {item.duration}</Text>
              </View>
              <Text style={[styles.cardDesc, { textAlign: isRTL ? 'right' : 'left' }]}>{item.desc}</Text>
              {item.steps.length > 0 && (
                <View style={styles.stepsList}>
                  {item.steps.map((step, i) => (
                    <View key={i} style={[styles.stepRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <View style={[styles.stepNum, { backgroundColor: item.color }]}>
                        <Text style={styles.stepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.stepText, { textAlign: isRTL ? 'right' : 'left' }]}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Dots ── */}
        <View style={styles.dotsRow}>
          {EXERCISES.map(e => (
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
                : (isRTL ? `ابدأ التمرين · ${ex.duration}` : `Start · ${ex.duration}`)}
            </Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* ══ مودال الانتهاء ══ */}
      <Modal visible={showDone} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={[modal.box, { borderTopColor: ex.color }]}>
            <Text style={modal.bigEmoji}>{ex.emoji}</Text>
            <Text style={[modal.doneTitle, { color: ex.color }]}>
              {isRTL ? 'أحسنت! انتهى التمرين 🎉' : 'Well done! Exercise complete 🎉'}
            </Text>
            <Text style={modal.doneMsg}>{congratsMsg}</Text>
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

      {/* ══ مودال إضافة تمرين ══ */}
      <Modal visible={showAdd} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={modal.overlay}
        >
          <View style={modal.addBox}>
            <View style={[modal.addHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={modal.addTitle}>
                {isRTL ? 'إضافة تمرين جديد' : 'Add New Exercise'}
              </Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={22} color="#aaa" />
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
            />

            <Text style={modal.label}>{isRTL ? 'المدة بالدقائق *' : 'Duration (minutes) *'}</Text>
            <TextInput
              style={[modal.input, { textAlign: isRTL ? 'right' : 'left' }]}
              value={newMinutes}
              onChangeText={setNewMinutes}
              placeholder={isRTL ? 'مثال: 5' : 'e.g. 5'}
              placeholderTextColor="#bbb"
              keyboardType="numeric"
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

            <TouchableOpacity style={modal.saveBtn} onPress={handleAddExercise}>
              <Text style={modal.saveBtnText}>
                {isRTL ? '✅ حفظ التمرين' : '✅ Save Exercise'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingTop: Spacing.base },

  navbar: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 10,
    marginBottom: Spacing.base,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#7C5CBF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle:  { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  navSub:    { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },


  cardsRow: { paddingHorizontal: Spacing.xl, gap: 14, paddingBottom: Spacing.sm },
  card: {
    // ✅ ارتفاع ثابت عشان الكارد ميمتدش ويغطي البوتن
    borderRadius: Radius.xxl, padding: Spacing.sm,
    height: CARD_H,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  cardTopRow:    { justifyContent: 'space-between', marginBottom: Spacing.sm },
  // ✅ صغّرنا الـ emoji circle شوية
  emojiCircle:   { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  selectedCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle:     { fontSize: FontSize.lg, fontWeight: '800', marginBottom: 3 },
  durationRow:   { alignItems: 'center', marginBottom: 6 },
  durationText:  { fontSize: FontSize.sm, fontWeight: '600' },
  // ✅ قلّلنا الـ marginBottom في cardDesc
  cardDesc:      { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  stepsList:     { gap: 7 },
  stepRow:       { alignItems: 'center', gap: 8 },
  stepNum:       { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepNumText:   { fontSize: 10, fontWeight: '700', color: '#fff' },
  stepText:      { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm },
  dot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },

  timerWrap: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xl,
    marginTop: 20,  // ✅ يدفع البوتن لأسفل بس فوق الـ nav bar
    gap: 10,
    alignItems: 'center',
  },
  timerCountdown: { fontSize: 44, fontWeight: '800', letterSpacing: 2 },
  timerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: Radius.xl, borderWidth: 2,
    paddingVertical: 14, paddingHorizontal: 28,
    width: '100%',
  },
  timerBtnText: { fontSize: FontSize.base, fontWeight: '700' },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  box: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    width: width * 0.85, alignItems: 'center',
    borderTopWidth: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 14, elevation: 10,
  },
  bigEmoji:    { fontSize: 52, marginBottom: 12 },
  doneTitle:   { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  doneMsg:     { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 22 },
  doneBtn:     { borderRadius: 16, paddingVertical: 13, paddingHorizontal: 32 },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  addBox: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    width: width * 0.9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 14, elevation: 10,
  },
  addHeader:  { justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  addTitle:   { fontSize: 17, fontWeight: '800', color: '#2d2d2d' },
  label:      { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 6, marginTop: 12 },
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
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});