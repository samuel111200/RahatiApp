import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

const DOC_COLOR = '#4A90D9';

// ─── Hoehn & Yahr questions ──────────────────────────────
// Each question selects a single H&Y stage value
type HYOption = { labelAr: string; labelEn: string; value: number };
type HYQuestion = { questionAr: string; questionEn: string; options: HYOption[] };

const HY_QUESTIONS: HYQuestion[] = [
  {
    questionAr: 'هل الأعراض موجودة في جهة واحدة فقط من الجسم؟',
    questionEn: 'Are symptoms present on only one side of the body?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 1 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل الأعراض موجودة في جهة واحدة مع تأثر الرقبة أو الجذع؟',
    questionEn: 'Are symptoms present on one side of the body with involvement of the neck or trunk (axial symptoms)?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 1.5 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل الأعراض موجودة في الجانبين بدون مشاكل في الاتزان؟',
    questionEn: 'Are symptoms present on both sides of the body without balance impairment?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 2 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل الأعراض موجودة في الجانبين مع عدم اتزان بسيط ويتعافى المريض في Pull Test؟',
    questionEn: 'Are symptoms present on both sides of the body with mild balance impairment, but the patient recovers on the Pull Test?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 2.5 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يوجد عدم اتزان بسيط إلى متوسط لكن المريض ما زال مستقلاً؟',
    questionEn: 'Does the patient have mild to moderate postural instability while remaining physically independent?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 3 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يعاني المريض من إعاقة شديدة لكنه يستطيع المشي أو الوقوف دون مساعدة؟',
    questionEn: 'Does the patient have severe disability but is still able to walk or stand without assistance?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 4 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'مستخدم دائم للكرسي المتحرك أو ملازم للفراش ما لم يتلق مساعدة؟',
    questionEn: 'Is the patient wheelchair-bound or bedridden unless assisted?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 5 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
];

// H&Y stage interpretation — range-based per clinical spec
function hyInterpretation(stage: number, isRTL: boolean): string {
  if (stage >= 1 && stage <= 1.5) return isRTL ? 'مرحلة مبكرة'                                   : 'Early stage';
  if (stage >= 2 && stage <= 2.5) return isRTL ? 'مرحلة خفيفة إلى متوسطة'                        : 'Mild to moderate stage';
  if (stage === 3)                 return isRTL ? 'مرحلة متوسطة مع بداية مشاكل الاتزان'           : 'Moderate stage with the onset of balance impairment';
  if (stage === 4)                 return isRTL ? 'مرحلة متقدمة مع إعاقة شديدة'                   : 'Advanced stage with severe disability';
  if (stage === 5)                 return isRTL ? 'مرحلة متقدمة جداً واعتماد كبير على الآخرين'    : 'Very advanced stage with significant dependence on others';
  return isRTL ? 'لا توجد أعراض واضحة' : 'No visible signs';
}

// ─── Schwab & England questions ──────────────────────────
type SEOption = { labelAr: string; labelEn: string; value: number };
type SEQuestion = { questionAr: string; questionEn: string; options: SEOption[] };

const SE_QUESTIONS: SEQuestion[] = [
  {
    questionAr: 'هل يستطيع المريض أداء جميع الأنشطة اليومية بشكل طبيعي تماماً دون أي صعوبة؟',
    questionEn: 'Can the patient perform all daily activities normally without any difficulty?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 100 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يستطيع أداء جميع الأنشطة اليومية مع بعض البطء أو الصعوبة؟',
    questionEn: 'Can the patient perform all daily activities independently, with only slight slowness or difficulty?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 90 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يستطيع أداء جميع الأنشطة اليومية لكنه يحتاج وقتاً أطول من المعتاد؟',
    questionEn: 'Can the patient perform all daily activities independently but requires more time than usual?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 80 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يستطيع أداء معظم الأنشطة اليومية لكن يحتاج وقتاً أطول بكثير لبعضها؟',
    questionEn: 'Can the patient perform most daily activities independently but requires significantly more time for some tasks?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 70 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يستطيع أداء معظم الأنشطة اليومية ولكن ببطء شديد ومع مجهود وأخطاء؟',
    questionEn: 'Can the patient perform most daily activities, but very slowly and with considerable effort and occasional errors?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 60 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يحتاج إلى مساعدة في حوالي نصف الأنشطة اليومية؟',
    questionEn: 'Does the patient require assistance with approximately half of daily activities?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 50 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يعتمد على الآخرين بدرجة كبيرة لكنه يشارك في بعض الأنشطة؟',
    questionEn: 'Is the patient largely dependent on others but still participates in some daily activities?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 40 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يستطيع بدء بعض الأنشطة بنفسه لكنه يحتاج مساعدة كبيرة لإكمالها؟',
    questionEn: 'Can the patient initiate some activities independently but requires substantial assistance to complete them?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 30 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يستطيع المساعدة بشكل محدود جداً فقط؟',
    questionEn: 'Is the patient able to provide only very limited assistance in daily activities?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 20 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل يعتمد بشكل شبه كامل على الآخرين؟',
    questionEn: 'Is the patient almost completely dependent on others for daily care?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 10 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
  {
    questionAr: 'هل المريض طريح الفراش ويعتمد كلياً على الآخرين؟',
    questionEn: 'Is the patient bedridden and completely dependent on others for care?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes', value: 0 },
      { labelAr: 'لا',  labelEn: 'No',  value: 0 },
    ],
  },
];

function seInterpretation(pct: number, isRTL: boolean): string {
  if (pct >= 90) return isRTL ? 'استقلالية ممتازة'                              : 'Excellent independence';
  if (pct >= 70) return isRTL ? 'استقلالية جيدة مع بعض الصعوبات'               : 'Good independence with some difficulties';
  if (pct >= 50) return isRTL ? 'استقلالية متوسطة ويحتاج مساعدة أحيانًا'       : 'Moderate independence; occasional assistance required';
  if (pct >= 30) return isRTL ? 'اعتماد ملحوظ على الآخرين'                      : 'Significant dependence on others';
  if (pct >= 10) return isRTL ? 'اعتماد شديد على الآخرين'                       : 'Severe dependence on others';
  return isRTL ? 'اعتماد كامل على الرعاية' : 'Completely dependent on care and assistance from others';
}

type ScaleType = 'hy' | 'se' | null;

export default function DocAssessmentScreen() {
  const { t, isRTL } = useLang();

  const [scale,       setScale]       = useState<ScaleType>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers,     setAnswers]     = useState<number[]>([]);
  const [showResult,  setShowResult]  = useState(false);

  const questions = scale === 'hy' ? HY_QUESTIONS : SE_QUESTIONS;
  const total     = questions.length;

  // ── compute result ───────────────────────────────────────
  const computeHY = (): number => {
    // Take the highest non-zero stage selected across all questions
    const vals = answers.filter(v => v > 0);
    return vals.length ? Math.max(...vals) : 0;
  };

  const computeSE = (): number => {
    // Take the highest percentage selected across all questions (most capable answer chosen)
    const vals = answers.filter(v => v > 0);
    return vals.length ? Math.max(...vals) : 0;
  };

  const hyStage   = scale === 'hy' ? computeHY() : 0;
  const sePct     = scale === 'se' ? computeSE() : 0;

  // ── navigation ───────────────────────────────────────────
  const selectAnswer = (value: number) => {
    const updated = [...answers];
    updated[questionIdx] = value;
    setAnswers(updated);

    if (questionIdx < total - 1) {
      setQuestionIdx(i => i + 1);
    } else {
      setShowResult(true);
    }
  };

  const goBack = () => {
    if (questionIdx > 0) setQuestionIdx(i => i - 1);
  };

  const reset = () => {
    setScale(null);
    setQuestionIdx(0);
    setAnswers([]);
    setShowResult(false);
  };


  // ── Scale selection screen ────────────────────────────────
  if (!scale) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0F6FF" />
        <View style={styles.header}>
          <Text style={styles.pageTitle}>{t.docAssessmentTitle}</Text>
          <Text style={styles.pageSub}>{t.docAssessmentSelectScale}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scaleList}>
          <TouchableOpacity
            style={[styles.scaleCard, { borderColor: DOC_COLOR }]}
            onPress={() => setScale('hy')}
            activeOpacity={0.85}
          >
            <View style={[styles.scaleIconWrap, { backgroundColor: '#E8F1FF' }]}>
              <Ionicons name="analytics-outline" size={32} color={DOC_COLOR} />
            </View>
            <Text style={[styles.scaleTitle, { color: DOC_COLOR, textAlign: isRTL ? 'right' : 'left' }]}>
              {t.assessmentHoehnYahr}
            </Text>
            <Text style={[styles.scaleDesc, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t.docAssessmentHoehnDesc}
            </Text>
            <View style={[styles.scaleBadge, { backgroundColor: DOC_COLOR }]}>
              <Text style={styles.scaleBadgeText}>{isRTL ? `${HY_QUESTIONS.length} أسئلة` : `${HY_QUESTIONS.length} Questions`}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scaleCard, { borderColor: '#4CAF82' }]}
            onPress={() => setScale('se')}
            activeOpacity={0.85}
          >
            <View style={[styles.scaleIconWrap, { backgroundColor: '#E8F5EF' }]}>
              <Ionicons name="body-outline" size={32} color="#4CAF82" />
            </View>
            <Text style={[styles.scaleTitle, { color: '#4CAF82', textAlign: isRTL ? 'right' : 'left' }]}>
              {t.assessmentSchwabEngland}
            </Text>
            <Text style={[styles.scaleDesc, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t.docAssessmentSchwabDesc}
            </Text>
            <View style={[styles.scaleBadge, { backgroundColor: '#4CAF82' }]}>
              <Text style={styles.scaleBadgeText}>{isRTL ? `${SE_QUESTIONS.length} أسئلة` : `${SE_QUESTIONS.length} Questions`}</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const accentColor = scale === 'hy' ? DOC_COLOR : '#4CAF82';

  // ── Result screen ─────────────────────────────────────────
  if (showResult) {
    const resultVal  = scale === 'hy' ? hyStage : sePct;
    const interp     = scale === 'hy' ? hyInterpretation(hyStage, isRTL) : seInterpretation(sePct, isRTL);
    const label      = scale === 'hy' ? t.docAssessmentStageLabel : t.docAssessmentPercentLabel;
    const displayVal = scale === 'hy' ? String(resultVal) : `${resultVal}%`;

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0F6FF" />
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <View style={[styles.resultBubble, { borderColor: accentColor }]}>
            <Ionicons name="checkmark-circle" size={56} color={accentColor} />
            <Text style={[styles.resultTitle, { color: accentColor }]}>
              {scale === 'hy' ? t.assessmentHoehnYahr : t.assessmentSchwabEngland}
            </Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>{label}</Text>
              <Text style={[styles.resultValue, { color: accentColor }]}>{displayVal}</Text>
            </View>
            <View style={[styles.resultDivider, { backgroundColor: accentColor + '33' }]} />
            <Text style={[styles.resultInterp, { textAlign: isRTL ? 'right' : 'left' }]}>{interp}</Text>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#F0F0F0' }]}
            onPress={reset}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh-outline" size={20} color={Colors.textMuted} />
            <Text style={[styles.actionBtnText, { color: Colors.textMuted }]}>{t.docAssessmentNewAssessment}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Question screen ────────────────────────────────────────
  const q        = questions[questionIdx];
  const progress = (questionIdx + 1) / total;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F6FF" />

      {/* Progress header */}
      <View style={styles.progressHeader}>
        <TouchableOpacity onPress={reset} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close-outline" size={26} color={Colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.progressBarWrap}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
        </View>
        <Text style={styles.progressLabel}>
          {t.docAssessmentQuestion} {questionIdx + 1} {t.docAssessmentOf} {total}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.questionContainer}>
        <Text style={[styles.scaleName, { color: accentColor, textAlign: isRTL ? 'right' : 'left' }]}>
          {scale === 'hy' ? t.assessmentHoehnYahr : t.assessmentSchwabEngland}
        </Text>

        <Text style={[styles.questionText, { textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL ? q.questionAr : q.questionEn}
        </Text>

        <View style={styles.optionsWrap}>
          {q.options.map((opt, i) => {
            const selected = answers[questionIdx] === opt.value && answers[questionIdx] !== undefined;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.optionBtn,
                  { borderColor: selected ? accentColor : '#E0E0E0' },
                  selected && { backgroundColor: accentColor + '15' },
                ]}
                onPress={() => selectAnswer(opt.value)}
                activeOpacity={0.8}
              >
                <View style={[styles.optionRadio, selected && { borderColor: accentColor }]}>
                  {selected && <View style={[styles.optionRadioFill, { backgroundColor: accentColor }]} />}
                </View>
                <Text style={[
                  styles.optionLabel,
                  { textAlign: isRTL ? 'right' : 'left', flex: 1 },
                  selected && { color: accentColor, fontWeight: '700' },
                ]}>
                  {isRTL ? opt.labelAr : opt.labelEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Navigation buttons */}
      <View style={[styles.navRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {questionIdx > 0 && (
          <TouchableOpacity style={styles.navBtn} onPress={goBack} activeOpacity={0.8}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color={Colors.textMuted} />
            <Text style={styles.navBtnText}>{t.docAssessmentPrev}</Text>
          </TouchableOpacity>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F6FF' },

  // Scale selection
  header: { paddingHorizontal: Spacing.xl, paddingVertical: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0EAF8' },
  pageTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  pageSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  scaleList: { padding: Spacing.xl, gap: 16 },
  scaleCard: {
    backgroundColor: '#fff', borderRadius: Radius.xl, padding: 20,
    borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 10,
  },
  scaleIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  scaleTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  scaleDesc: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 20 },
  scaleBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  scaleBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Progress
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.xl, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0EAF8' },
  progressBarWrap: { flex: 1, height: 6, backgroundColor: '#E0EAF8', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', minWidth: 60, textAlign: 'right' },

  // Question
  questionContainer: { padding: Spacing.xl, gap: 20 },
  scaleName: { fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 0.5 },
  questionText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, lineHeight: 28 },
  optionsWrap: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: Radius.lg, padding: 14, borderWidth: 1.5 },
  optionRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CCC', alignItems: 'center', justifyContent: 'center' },
  optionRadioFill: { width: 12, height: 12, borderRadius: 6 },
  optionLabel: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22 },

  // Navigation
  navRow: { paddingHorizontal: Spacing.xl, paddingBottom: 8, paddingTop: 4 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  navBtnText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },

  // Result
  resultContainer: { padding: Spacing.xl, alignItems: 'center', gap: 16 },
  resultBubble: {
    width: '100%', backgroundColor: '#fff', borderRadius: Radius.xl,
    padding: 28, alignItems: 'center', gap: 12, borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  resultTitle: { fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultLabel: { fontSize: FontSize.base, color: Colors.textMuted, fontWeight: '500' },
  resultValue: { fontSize: 36, fontWeight: '800' },
  resultDivider: { width: '100%', height: 1, marginVertical: 4 },
  resultInterp: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '600', lineHeight: 24, width: '100%' },
  actionBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: Radius.xl, paddingVertical: 14,
  },
  actionBtnText: { fontSize: FontSize.base, fontWeight: '700', color: '#fff' },
});
