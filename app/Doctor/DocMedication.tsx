import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '../../context/Languagecontext';
import DocTabBar from '../../components/DocTabBar';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DOC_COLOR = '#4A90D9';

type Medication = {
  nameAr: string;
  nameEn: string;
  color: string;
  notesAr: string;
  notesEn: string;
};

const MEDICATIONS: Medication[] = [
  {
    nameAr: 'ليفودوبا / كاربيدوبا',
    nameEn: 'Levodopa / Carbidopa',
    color: '#7C5CBF',
    notesAr: 'الدواء الأساسي لعلاج الباركنسون. يتحول إلى دوبامين داخل الدماغ. يُؤخذ قبل الأكل بـ30 دقيقة على الأقل. قد يسبب غثيانًا في البداية، وتقل مع الوقت.',
    notesEn: 'The primary drug for Parkinson\'s. Converts to dopamine in the brain. Take at least 30 minutes before meals. May cause nausea initially, which usually subsides over time.',
  },
  {
    nameAr: 'براميبيكسول',
    nameEn: 'Pramipexole',
    color: '#4CAF82',
    notesAr: 'ناهض الدوبامين. يُستخدم في المراحل المبكرة أو بالتزامن مع ليفودوبا. قد يسبب نعاسًا أو حركات لاإرادية. يجب الحذر عند القيادة.',
    notesEn: 'Dopamine agonist. Used in early stages or alongside Levodopa. May cause drowsiness or involuntary movements. Caution advised when driving.',
  },
  {
    nameAr: 'روبينيرول',
    nameEn: 'Ropinirole',
    color: '#2196F3',
    notesAr: 'ناهض الدوبامين. يُستخدم في المراحل المبكرة من المرض. يمكن أن يسبب تورمًا في الساقين وانخفاضًا في ضغط الدم عند الوقوف.',
    notesEn: 'Dopamine agonist. Used in early-stage Parkinson\'s. Can cause leg edema and postural hypotension.',
  },
  {
    nameAr: 'إنتاكابون',
    nameEn: 'Entacapone',
    color: '#FF9800',
    notesAr: 'يُؤخذ مع ليفودوبا لتمديد مفعوله وتقليل فترات الانقطاع. قد يُلوّن البول باللون البرتقالي وهذا طبيعي تمامًا.',
    notesEn: 'Taken with Levodopa to extend its effect and reduce "off" periods. May turn urine orange — this is normal.',
  },
  {
    nameAr: 'أمانتادين',
    nameEn: 'Amantadine',
    color: '#E07A5F',
    notesAr: 'يُقلل من الحركات اللاإرادية الناجمة عن ليفودوبا. يُستخدم أيضًا لتخفيف التصلب والرعشة. قد يسبب تلوينًا للجلد (شبكة وعائية).',
    notesEn: 'Reduces involuntary movements caused by Levodopa. Also used to relieve stiffness and tremor. May cause a mottled skin appearance (livedo reticularis).',
  },
  {
    nameAr: 'سيليجيلين',
    nameEn: 'Selegiline',
    color: '#9C27B0',
    notesAr: 'مثبط MAO-B. يُبطئ تكسّر الدوبامين في الدماغ. يُستخدم في المراحل المبكرة. يجب تجنب تناوله مساءً لأنه قد يسبب الأرق.',
    notesEn: 'MAO-B inhibitor. Slows dopamine breakdown in the brain. Used in early stages. Avoid taking it in the evening as it may cause insomnia.',
  },
  {
    nameAr: 'تراي هيكسي فينيديل',
    nameEn: 'Trihexyphenidyl',
    color: '#607D8B',
    notesAr: 'مضاد كوليني. يُقلل الرعشة بشكل فعّال. غير مُنصح به لكبار السن بسبب تأثيره على الذاكرة والإدراك.',
    notesEn: 'Anticholinergic. Effectively reduces tremor. Not recommended for elderly patients due to cognitive side effects.',
  },
];

export default function DocMedicationScreen() {
  const { t, isRTL } = useLang();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(prev => (prev === i ? null : i));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F6FF" />

      {/* Header */}
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={styles.headerIconWrap}>
          <Text style={{ fontSize: 22 }}>💊</Text>
        </View>
        <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
          <Text style={[styles.headerTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
            {t.docMedicationInfo}
          </Text>
          <Text style={[styles.headerSub, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'أدوية الباركنسون الشائعة وملاحظات سريرية' : 'Common Parkinson\'s medications & clinical notes'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {MEDICATIONS.map((med, i) => {
          const isOpen = expandedIndex === i;
          const name   = isRTL ? med.nameAr : med.nameEn;
          const notes  = isRTL ? med.notesAr : med.notesEn;

          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.85}
              onPress={() => toggle(i)}
              style={[styles.card, { borderLeftColor: med.color, borderLeftWidth: 4 }]}
            >
              <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.dot, { backgroundColor: med.color }]} />
                <Text style={[styles.medName, { color: med.color, textAlign: isRTL ? 'right' : 'left', flex: 1 }]}>
                  {name}
                </Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : (isRTL ? 'chevron-back' : 'chevron-forward')}
                  size={18}
                  color={med.color}
                />
              </View>
              {isOpen && (
                <Text style={[styles.medNotes, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {notes}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 16 }} />
      </ScrollView>

      <DocTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F6FF' },
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0EAF8',
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  list: {
    padding: Spacing.base,
    gap: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: 14,
    shadowColor: DOC_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  medName: {
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  medNotes: {
    marginTop: 10,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
});
