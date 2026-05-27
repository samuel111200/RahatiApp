// app/tabs/Exercisesessionscreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import * as Speech from 'expo-speech';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

const EXERCISE_VIDEOS: Record<string, any> = {
  // ── Therapy ──────────────────────────────────────────────
  wristCurls:        require("../../assets/videos/first.mp4"),

  // ── Yoga ─────────────────────────────────────────────────
  childsPose:        require("../../assets/videos/2.mp4"),
  warriorTwo:        require("../../assets/videos/3.mp4"),
  jabPunches:        require("../../assets/videos/4.mp4"),
  comboPunches:      require("../../assets/videos/5.mp4"),

  // ── Aerobic ──────────────────────────────────────────────
  singleLegStand:    require("../../assets/videos/6.mp4"),

  // ── Endurance ────────────────────────────────────────────
  armBottles:        require("../../assets/videos/7.mp4"),
  seatedEndurance:   require("../../assets/videos/8.mp4"),
  neckFlexibility:   require("../../assets/videos/9.mp4"),
  standUpStrength:   require("../../assets/videos/10.mp4"),
  upperBodyStretch:  require("../../assets/videos/11.mp4"),

  // ── Strength Training ─────────────────────────────────────
  // TODO: ضع اسم الفيديو الصح بدل "REPLACE_ME_XX.mp4"
  marchingInPlace:   require("../../assets/videos/12.mp4"),
  chairSquat:        require("../../assets/videos/13.mp4"),
  hipStrength:       require("../../assets/videos/14.mp4"),
  seatedTwistKnee:   require("../../assets/videos/15.mp4"),
  armLegStrength:    require("../../assets/videos/16.mp4"),
  standingArmTrunk:  require("../../assets/videos/17.mp4"),
  lyingTwistArms:    require("../../assets/videos/18.mp4"),
  backBridgeLying:   require("../../assets/videos/19.mp4"),
  upperFlexArmStrength: require("../../assets/videos/20.mp4"),
  trunkBackFlexibility: require("../../assets/videos/21.mp4"),
};


const { width } = Dimensions.get('window');

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

export default function ExerciseSessionScreen() {
  const { isRTL } = useLang();
  const router = useRouter();

  const params = useLocalSearchParams<Record<string, string>>();

  const exerciseKey     = params.exerciseKey ?? '';
  const title           = params.title ?? '';
  const titleEn         = params.titleEn ?? '';
  const emoji           = params.emoji ?? '🏋️';
  const color           = params.color ?? '#5B9BD5';
  const bg              = params.bg ?? '#E8F1FB';
  const accent          = params.accent ?? '#D0E5F7';
  const durationSeconds = parseInt(params.durationSeconds ?? '300');

  const steps   = (() => { try { return JSON.parse(params.steps   ?? '[]'); } catch { return []; } })();
  const stepsEn = (() => { try { return JSON.parse(params.stepsEn ?? '[]'); } catch { return []; } })();

  const videoSource = EXERCISE_VIDEOS[exerciseKey] || null;

  const [timeLeft,    setTimeLeft]    = useState(durationSeconds);
  const [isPaused,    setIsPaused]    = useState(false);
  const [showDone,    setShowDone]    = useState(false);
  const [activeStep,  setActiveStep]  = useState(-1);
  const [currentText, setCurrentText] = useState('');

  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef    = useRef(false);
  const stepIndexRef   = useRef(0);
  const congratsIdx    = useRef(Math.floor(Math.random() * CONGRATS_AR.length)).current;

  const displayTitle = isRTL ? title : titleEn;
  const stepsToRead  = isRTL ? steps : stepsEn;
  const progress     = durationSeconds > 0
    ? ((durationSeconds - timeLeft) / durationSeconds) * 100
    : 0;

  // ── Speech ───────────────────────────────────────────────
  const readStep = useCallback((index: number) => {
    if (isPausedRef.current) return;
    if (!stepsToRead || stepsToRead.length === 0) return;

    if (index >= stepsToRead.length) {
      setActiveStep(-1);
      setCurrentText('');
      return;
    }

    stepIndexRef.current = index;
    setActiveStep(index);
    setCurrentText(stepsToRead[index]);

    Speech.speak(stepsToRead[index], {
      language: isRTL ? 'ar-SA' : 'en-US',
      pitch: 1.05,
      rate: isRTL ? 0.80 : 0.85,
      onDone: () => {
        if (!isPausedRef.current && index + 1 < stepsToRead.length) {
          stepTimerRef.current = setTimeout(() => readStep(index + 1), 800);
        } else {
          setActiveStep(-1);
          setCurrentText('');
        }
      },
      onStopped: () => {
        setActiveStep(-1);
        setCurrentText('');
      },
    });
  }, [stepsToRead, isRTL]);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    setActiveStep(-1);
    setCurrentText('');
  }, []);

  // ── Timer ────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setShowDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  // ── Mount ────────────────────────────────────────────────
  useEffect(() => {
    setTimeLeft(durationSeconds);
    setIsPaused(false);
    setShowDone(false);
    setActiveStep(-1);
    setCurrentText('');
    isPausedRef.current = false;
    stepIndexRef.current = 0;

    startTimer();
    const delay = setTimeout(() => readStep(0), 800);

    return () => {
      stopTimer();
      clearTimeout(delay);
      stopSpeaking();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseKey]);

  // ── Pause / Resume ───────────────────────────────────────
  function togglePause() {
    if (isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      startTimer();
      if (stepIndexRef.current < stepsToRead.length) {
        readStep(stepIndexRef.current);
      }
    } else {
      isPausedRef.current = true;
      setIsPaused(true);
      stopTimer();
      stopSpeaking();
    }
  }

  // ── Stop ─────────────────────────────────────────────────
  function handleStop() {
    stopTimer();
    stopSpeaking();
    router.back();
  }

  function handleDone() {
    stopSpeaking();
    setShowDone(false);
    router.back();
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Navbar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={handleStop} style={styles.navBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#7C5CBF" />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle} numberOfLines={1}>{displayTitle}</Text>
          <Text style={styles.navSub}>
            {isPaused
              ? (isRTL ? 'متوقف مؤقتاً ⏸' : 'Paused ⏸')
              : (isRTL ? 'جلسة التمرين جارية' : 'Exercise session running')}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Video ── */}
      <View style={[styles.videoWrap, { borderColor: color + '33' }]}>
        <Video
          source={videoSource}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!isPaused}
          isLooping
          isMuted={false}
        />

        {currentText !== '' && !isPaused && (
          <View style={styles.speechOverlay}>
            {stepsToRead.length > 0 && (
              <View style={styles.dotsRow}>
                {stepsToRead.map((_: any, i: number) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: i === activeStep ? '#fff' : 'rgba(255,255,255,0.35)',
                        width: i === activeStep ? 18 : 6,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
            <View style={styles.speechBubble}>
              <Ionicons name="volume-high" size={14} color="#fff" style={{ marginTop: 2 }} />
              <Text
                style={[styles.speechText, { textAlign: isRTL ? 'right' : 'left' }]}
                numberOfLines={3}
              >
                {currentText}
              </Text>
            </View>
          </View>
        )}

        {isPaused && (
          <View style={styles.pausedOverlay}>
            <Ionicons name="pause-circle" size={72} color="rgba(255,255,255,0.85)" />
            <Text style={styles.pausedText}>
              {isRTL ? 'متوقف مؤقتاً' : 'Paused'}
            </Text>
          </View>
        )}
      </View>

      {/* ── Timer Block ── */}
      <View style={[styles.timerBlock, { backgroundColor: bg }]}>
        <View style={styles.timerRow}>
          <View style={[styles.emojiBubble, { backgroundColor: accent, borderColor: color + '55' }]}>
            <Text style={styles.emojiText}>{emoji}</Text>
          </View>
          <View style={styles.timerTextCol}>
            <Text style={[styles.countdown, { color }]}>{formatTime(timeLeft)}</Text>
            <Text style={[styles.timerLabel, { color: color + '99' }]}>
              {isRTL ? 'الوقت المتبقي' : 'Time remaining'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.pauseBtn, { backgroundColor: color + '18', borderColor: color + '55' }]}
            onPress={togglePause}
            activeOpacity={0.8}
          >
            <Ionicons name={isPaused ? 'play' : 'pause'} size={22} color={color} />
            <Text style={[styles.pauseBtnText, { color }]}>
              {isPaused
                ? (isRTL ? 'تشغيل' : 'Resume')
                : (isRTL ? 'إيقاف\nمؤقت' : 'Pause')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressBarWrap}>
          <View style={[styles.progressBar, { backgroundColor: color + '22' }]}>
            <View style={[styles.progressFill, { backgroundColor: color, width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressPct, { color }]}>{Math.round(progress)}%</Text>
        </View>
      </View>

      {/* ── Stop Button ── */}
      <View style={styles.bottomWrap}>
        <TouchableOpacity
          style={[styles.stopBtn, { backgroundColor: bg, borderColor: color }]}
          onPress={handleStop}
          activeOpacity={0.85}
        >
          <Ionicons name="stop-circle-outline" size={26} color={color} />
          <Text style={[styles.stopBtnText, { color }]}>
            {isRTL ? 'إنهاء التمرين' : 'End Exercise'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══ Done Modal ══ */}
      <Modal visible={showDone} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={[modal.box, { borderTopColor: color }]}>
            <Text style={modal.bigEmoji}>{emoji}</Text>
            <Text style={[modal.doneTitle, { color }]}>
              {isRTL ? 'أحسنت! انتهى التمرين 🎉' : 'Well done! Exercise complete 🎉'}
            </Text>
            <Text style={modal.doneMsg}>
              {isRTL ? CONGRATS_AR[congratsIdx] : CONGRATS_EN[congratsIdx]}
            </Text>
            <TouchableOpacity
              style={[modal.doneBtn, { backgroundColor: color }]}
              onPress={handleDone}
              activeOpacity={0.85}
            >
              <Text style={modal.doneBtnText}>
                {isRTL ? 'شكراً، متشجع! 💪' : 'Thanks, motivated! 💪'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
  videoWrap: {
    flex: 1, marginHorizontal: Spacing.xl,
    borderRadius: Radius.xxl, overflow: 'hidden', borderWidth: 2,
    backgroundColor: '#f0f0f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  video: { width: '100%', height: '100%' },
  speechOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingBottom: 14, paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.45)', gap: 8,
  },
  dotsRow: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  dot:     { height: 6, borderRadius: 3 },
  speechBubble: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  speechText: {
    flex: 1, fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  pausedText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  timerBlock: {
    marginHorizontal: Spacing.xl, marginTop: 14,
    borderRadius: Radius.xxl, paddingHorizontal: 20, paddingVertical: 16,
    gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  timerRow:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
  emojiBubble: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  emojiText:    { fontSize: 28 },
  timerTextCol: { flex: 1, gap: 2 },
  countdown:    { fontSize: 46, fontWeight: '800', letterSpacing: 2, lineHeight: 52 },
  timerLabel:   { fontSize: 12, fontWeight: '600' },
  pauseBtn: {
    width: 56, height: 56, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0,
  },
  pauseBtnText: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  progressBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar:     { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: 4 },
  progressPct:     { fontSize: 12, fontWeight: '800', width: 36, textAlign: 'right' },
  bottomWrap: {
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.base,
    paddingBottom: Spacing.xl, alignItems: 'center',
  },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: Radius.xl, borderWidth: 2,
    paddingVertical: 14, paddingHorizontal: 28, width: '100%',
  },
  stopBtnText: { fontSize: FontSize.base, fontWeight: '700' },
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
});