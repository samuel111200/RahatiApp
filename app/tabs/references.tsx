import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLang } from '../../context/Languagecontext';

type RefEntry = { id: number; citation: string; url?: string };

const REFERENCES: RefEntry[] = [
  {
    id: 1,
    citation: 'Bhidayasiri, R., & Tarsy, D. (2012). Movement disorders: A video atlas. Humana Press.',
    url: 'https://doi.org/10.1007/978-1-60327-426-5',
  },
  {
    id: 2,
    citation: "Bloem, B. R., Hausdorff, J. M., Visser, J. E., & Giladi, N. (2004). Falls and freezing of gait in Parkinson's disease: A review of two interconnected, episodic phenomena. Movement Disorders, 19(8), 871–884.",
    url: 'https://doi.org/10.1002/mds.20115',
  },
  {
    id: 3,
    citation: "Dibble, L. E., Hale, T. F., Marcus, R. L., Droge, J., Gerber, J. P., & LaStayo, P. C. (2006). High-intensity resistance training amplifies muscle hypertrophy and functional gains in persons with Parkinson's disease. Movement Disorders, 21(9), 1444–1452.",
    url: 'https://doi.org/10.1002/mds.20997',
  },
  {
    id: 4,
    citation: "Ellis, T., de Goede, C. J., Feldman, R. G., Wolters, E. C., Kwakkel, G., & Wagenaar, R. C. (2005). Efficacy of a physical therapy program in patients with Parkinson's disease: A randomized controlled trial. Archives of Physical Medicine and Rehabilitation, 86(4), 626–632.",
    url: 'https://doi.org/10.1016/j.apmr.2004.08.008',
  },
  {
    id: 5,
    citation: "Farley, B. G., & Koshland, G. F. (2005). Training BIG to move faster: The application of the speed–amplitude relation as a rehabilitation strategy for people with Parkinson's disease. Experimental Brain Research, 167(3), 462–467.",
    url: 'https://doi.org/10.1007/s00221-005-0179-7',
  },
  {
    id: 6,
    citation: "Fisher, B. E., Wu, A. D., Salem, G. J., Song, J., Lin, C. H., Yip, J., Cen, S., Gordon, J., Jakowec, M., & Petzinger, G. (2008). The effect of exercise training in improving motor performance and corticomotor excitability in people with early Parkinson's disease. Archives of Physical Medicine and Rehabilitation, 89(7), 1221–1229.",
    url: 'https://doi.org/10.1016/j.apmr.2008.01.013',
  },
  {
    id: 7,
    citation: "Goodwin, V. A., Richards, S. H., Taylor, R. S., Taylor, A. H., & Campbell, J. L. (2008). The effectiveness of exercise interventions for people with Parkinson's disease: A systematic review and meta-analysis. Movement Disorders, 23(5), 631–640.",
    url: 'https://doi.org/10.1002/mds.21922',
  },
  {
    id: 8,
    citation: 'Hirsch, M. A., Toole, T., Maitland, C. G., & Rider, R. A. (2003). The effects of balance training and high-intensity resistance training on persons with idiopathic Parkinson\'s disease. Archives of Physical Medicine and Rehabilitation, 84(8), 1109–1117.',
    url: 'https://doi.org/10.1016/S0003-9993(03)00148-3',
  },
  {
    id: 9,
    citation: 'Keus, S. H., Bloem, B. R., Hendricks, E. J., Bredero-Cohen, A. B., & Munneke, M. (2007). Evidence-based analysis of physical therapy in Parkinson\'s disease with recommendations for practice and research. Movement Disorders, 22(4), 451–460.',
    url: 'https://doi.org/10.1002/mds.21244',
  },
  {
    id: 10,
    citation: "Liang, K. Y., Mintun, M. A., Fagan, A. M., Goate, A. M., Bugg, J. M., Holtzman, D. M., Morris, J. C., & Head, D. (2010). Exercise and Alzheimer's disease biomarkers in cognitively normal older adults. Annals of Neurology, 68(3), 311–318.",
    url: 'https://doi.org/10.1002/ana.22096',
  },
  {
    id: 11,
    citation: "Morris, M. E., Iansek, R., Matyas, T. A., & Summers, J. J. (1996). Stride length regulation in Parkinson's disease: Normalization strategies and underlying mechanisms. Brain, 119(2), 551–568.",
    url: 'https://doi.org/10.1093/brain/119.2.551',
  },
  {
    id: 12,
    citation: "Nieuwboer, A., Kwakkel, G., Rochester, L., Jones, D., van Wegen, E., Willems, A. M., Chavret, F., Hetherington, V., Baker, K., & Lim, I. (2007). Cueing training in the home improves gait-related mobility in Parkinson's disease: The RESCUE trial. Journal of Neurology, Neurosurgery & Psychiatry, 78(2), 134–140.",
    url: 'https://doi.org/10.1136/jnnp.200X.097923',
  },
  {
    id: 13,
    citation: "Petzinger, G. M., Fisher, B. E., McEwen, S., Beeler, J. A., Walsh, J. P., & Jakowec, M. W. (2013). Exercise-enhanced neuroplasticity targeting motor and cognitive circuitry in Parkinson's disease. The Lancet Neurology, 12(7), 716–726.",
    url: 'https://doi.org/10.1016/S1474-4422(13)70123-6',
  },
  {
    id: 14,
    citation: "Sage, M. D., Johnston, R. B., Almeida, Q. J., & Bherer, L. (2009). Motor learning and Parkinson's disease. Journal of Neurophysiology, 102(5), 2752–2760.",
  },
  {
    id: 15,
    citation: 'Toole, T., Hirsch, M. A., Forkink, A., Lehman, D. A., & Maitland, C. G. (2000). The effects of a balance and strength training program on equilibrium in Parkinsonism: A preliminary study. NeuroRehabilitation, 14(3), 165–174.',
    url: 'https://doi.org/10.3233/NRE-2000-14305',
  },
  {
    id: 16,
    citation: 'Uc, E. Y., Doerschug, K. C., Magnotta, V., Dawson, J. D., Thomsen, T. R., Kline, J. N., Rizzo, M., Newman, S. W., Mehta, S., Grabowski, T. J., Bruss, J., Blangero, J., Sigmundsson, T., Andreasen, N. C., Nopoulos, P., & Darling, W. G. (2014). Phase I/II randomized trial of aerobic exercise in Parkinson disease in a community setting. Neurology, 83(5), 413–425.',
    url: 'https://doi.org/10.1212/WNL.0000000000000644',
  },
];

export default function ReferencesScreen() {
  const router = useRouter();
  const { isRTL } = useLang();

  const introText = isRTL
    ? 'يستند هذا التطبيق إلى أحدث الأبحاث العلمية في مجال التأهيل الحركي وعلاج باركنسون'
    : "This app is grounded in the latest scientific research on motor rehabilitation and Parkinson's treatment";

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn} activeOpacity={0.7}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color="#7C5CBF" />
        </TouchableOpacity>
        <Text style={st.headerTitle} numberOfLines={1}>
          {isRTL ? 'المراجع العلمية' : 'Scientific References'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.introCard}>
          <Ionicons name="book-outline" size={26} color="#7C5CBF" />
          <Text style={[st.introText, { textAlign: isRTL ? 'right' : 'left' }]}>
            {introText}
          </Text>
        </View>

        {REFERENCES.map((ref) => (
          <View key={ref.id} style={st.refCard}>
            <View style={[st.refRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={st.refNum}>
                <Text style={st.refNumText}>{ref.id}</Text>
              </View>
              <View style={st.refBody}>
                <Text style={[st.refCitation, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {ref.citation}
                </Text>
                {ref.url && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(ref.url!)}
                    activeOpacity={0.7}
                    style={st.linkRow}
                  >
                    <Ionicons name="link-outline" size={13} color="#7C5CBF" />
                    <Text style={st.linkText} numberOfLines={1}>{ref.url}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F8F5FF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE6F8',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#7C5CBF', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2d2d2d',
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  introCard: {
    backgroundColor: '#EDE6F8',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  introText: {
    flex: 1,
    fontSize: 13,
    color: '#5a3fa0',
    fontWeight: '600',
    lineHeight: 21,
  },
  refCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#7C5CBF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  refRow: {
    alignItems: 'flex-start',
    gap: 12,
  },
  refNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#7C5CBF',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  refNumText: {
    fontSize: 11, fontWeight: '800', color: '#fff',
  },
  refBody: {
    flex: 1,
    gap: 8,
  },
  refCitation: {
    fontSize: 12.5,
    color: '#333',
    lineHeight: 20,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0EBFA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  linkText: {
    fontSize: 11,
    color: '#7C5CBF',
    fontWeight: '600',
    flexShrink: 1,
  },
});
