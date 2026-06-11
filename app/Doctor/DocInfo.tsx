import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '../../context/Languagecontext';
import { Colors, Spacing, Radius } from '../../constants/Theme';
import DocTabBar from '../../components/DocTabBar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DOC_COLOR = '#4A90D9';

interface InfoSection {
  id: string;
  titleAr: string;
  titleEn: string;
  icon: string;
  color: string;
  bodyAr: string;
  bodyEn: string;
}

const INFO_SECTIONS: InfoSection[] = [
  {
    id: 'what',
    titleAr: 'ما هو مرض الشلل الرعاش؟',
    titleEn: "What is Parkinson's Disease?",
    icon: '🧠',
    color: '#7C5CBF',
    bodyAr: `مرض الشلل الرعاش هو اضطراب عصبي مزمن يؤثر بشكل أساسي على حركة الجسم. يحدث نتيجة موت تدريجي لبعض الخلايا العصبية في الدماغ المسؤولة عن إنتاج مادة كيميائية مهمة اسمها الدوبامين.

الدوبامين يساعد الدماغ في التحكم في الحركة بسلاسة. عندما يقل الدوبامين، تبدأ الأعراض تظهر تدريجياً.`,
    bodyEn: `Parkinson's disease is a chronic neurological disorder that mainly affects movement. It happens when certain nerve cells in the brain that produce a chemical called dopamine gradually die.

Dopamine acts like a messenger that helps the brain control smooth and coordinated movements. When dopamine levels decrease, movement becomes slower and more difficult.`,
  },
  {
    id: 'movement',
    titleAr: 'الأعراض الشائعة في الحركة',
    titleEn: 'Common Movement Symptoms',
    icon: '🚶',
    color: '#E07A5F',
    bodyAr: `• رعشة (خاصة في اليدين أو الذراعين)
• تصلب العضلات (الشعور بأن الجسم صلب وليس مرن)
• بطء في الحركة (كل حاجة بتاخد وقت أطول: المشي، لبس الملابس، الأكل...)
• المشي بخطوات قصيرة، وقلة تحريك الذراعين أثناء المشي
• الميل بالانحناء للأمام أثناء المشي
• صعوبة في التوازن، وقد يؤدي ذلك للسقوط
• ظاهرة التجميد (Freezing): القدمين تلتصق فجأة بالأرض، خاصة عند بدء المشي أو تغيير الاتجاه أو المرور من باب ضيق`,
    bodyEn: `• Tremor (shaking), especially in the hands or arms
• Muscle stiffness (rigidity) – the body feels tight and less flexible
• Slowness of movement (bradykinesia) – everyday activities like walking, dressing, or eating take longer
• Short steps while walking and reduced arm swing
• Tendency to lean forward when walking
• Balance problems – increased risk of falling
• Freezing of gait – sudden feeling that the feet are "glued" to the floor, especially when starting to walk, turning, or walking through narrow spaces`,
  },
  {
    id: 'other',
    titleAr: 'أعراض أخرى في الجسم',
    titleEn: 'Other Symptoms',
    icon: '⚠️',
    color: '#FF9800',
    bodyAr: `• الصوت يصبح أضعف وغير واضح
• صعوبة في البلع، وقد يحدث سعال أثناء الأكل أو الشرب
• سيلان اللعاب (بسبب صعوبة البلع)
• تغيرات في الكلام (يصبح أبطأ أو أقل إيقاعاً)

ملاحظة مهمة: هناك أعراض تظهر قبل سنوات من مشاكل الحركة، مثل:
• فقدان حاسة الشم
• الإمساك
• اضطرابات النوم
• اكتئاب أو تغيرات في المزاج
• إرهاق أو ألم`,
    bodyEn: `• Softer and less clear voice
• Difficulty swallowing, which may cause coughing while eating or drinking
• Drooling (due to swallowing problems)
• Changes in speech rhythm and clarity

Important note: Some symptoms can appear years before the movement problems, such as:
• Loss of smell
• Constipation
• Sleep disturbances
• Depression or mood changes
• Fatigue or pain`,
  },
  {
    id: 'motor',
    titleAr: 'الأعراض الحركية',
    titleEn: 'Motor Symptoms',
    icon: '💪',
    color: '#4CAF82',
    bodyAr: `التصلب العضلي (Rigidity):
هو زيادة التوتر والتصلب في العضلات، مما يجعل الحركة صعبة وقد يسبب ألماً ومشاكل في الوقوف.

الرعشة (Tremor):
اهتزاز أو رعشة، غالباً في اليدين عند الراحة. قد تظهر أيضاً في الساقين أو الذقن. عادةً تقل الرعشة عند الحركة أو التركيز.

بطء الحركة (Bradykinesia):
كل الحركات تبطؤ بشكل واضح. الأنشطة اليومية مثل المشي ولبس الملابس والأكل تأخذ وقت أطول.`,
    bodyEn: `Rigidity:
Rigidity is the medical term for increased muscle tension or stiffness. It makes movements difficult and can lead to poor posture and pain.

Tremor:
Tremor is shaking or trembling. In Parkinson's disease, it usually appears as a resting tremor in the hands. It may also affect the legs or chin. Tremor often decreases when the person is moving or focusing on a task.

Bradykinesia:
Bradykinesia means slowness of movement. It affects all activities — walking, dressing, eating, and repetitive movements become slower and smaller.`,
  },
  {
    id: 'posture',
    titleAr: 'وضعية الجسم',
    titleEn: 'Body Posture',
    icon: '🏃',
    color: '#2196F3',
    bodyAr: `في المراحل المتقدمة من مرض الشلل الرعاش، قد يحدث تقصير في العضلات المسؤولة عن انحناء الرأس والجذع والورك. هذا يؤدي إلى الوضعية المعتادة للانحناء للأمام (Camptocormia) مع انحناء الحوض، أو ميل الجزء العلوي من الجسم إلى أحد الجانبين (Pisa syndrome).

لكي يقف الشخص مستقيماً وينظر إلى الأمام، غالباً ما يمد المريض رقبته وظهره السفلي ويثني ركبتيه. هذا يسبب ضغطاً على المفاصل، مما قد يؤدي إلى تآكل مبكر (خشونة المفاصل) وألم.

يمكن تحسين تشوهات الوضعية والمشاكل الناتجة عنها بالأدوية والعلاج الطبيعي. من المهم جداً البدء في تمارين العلاج الطبيعي في مرحلة مبكرة وممارستها بانتظام.`,
    bodyEn: `In advanced Parkinson's disease, shortening of the muscles involved in head, trunk, and hip flexion may occur. This leads to the typical bent-over posture (camptocormia) with a bent pelvis, or the upper body turned to one side (Pisa syndrome).

To stand up straight and look forward, patients often overstretched their neck and lower back and bend their knees. This causes stress on the joints, which can lead to premature wear and tear (arthrosis) and pain.

Postural deformities and the resulting problems can be improved with medications and physiotherapy. It is very important to start physiotherapy exercises early and to do them consistently.`,
  },
  {
    id: 'balance',
    titleAr: 'اضطراب التوازن (Postural Instability)',
    titleEn: 'Postural Instability',
    icon: '⚖️',
    color: '#9C27B0',
    bodyAr: `في مرض الشلل الرعاش، تقل الحركات التلقائية. هذا لا يؤثر فقط على تحريك الذراعين أثناء المشي، بل أيضاً على ردود الفعل الواقية التي تساعدنا على استعادة التوازن عندما نبدأ في السقوط.

غالباً ما يتفاعل مرضى باركنسون ببطء شديد أو لا يتفاعلون على الإطلاق عند فقدان التوازن، خاصة في فترات "Off" (عندما يكون تأثير الدواء ضعيفاً أو معدوماً).

حسب مرحلة المرض، يمكن تحسين هذه الردود الفعل الناقصة من خلال تمارين العلاج الطبيعي الموجهة وتمارين التوازن.`,
    bodyEn: `In Parkinson's disease, automatic movements decrease. This affects not only the usual arm swing while walking, but also the protective reflexes that help us regain balance when we start to fall.

Parkinson's patients often react too late or not at all when they lose their balance, especially during "Off" periods (when medication effect is low or absent). Depending on the stage of the disease, these missing protective reflexes can be improved through targeted physiotherapy and balance exercises.`,
  },
  {
    id: 'freezing',
    titleAr: 'ظاهرة التجميد (Freezing)',
    titleEn: 'Freezing',
    icon: '🦶',
    color: '#5B9BD5',
    bodyAr: `التجميد هو الشعور بأن القدمين ملتصقتان بالأرض وكأنهما مثبتتين أو مغروستين. يحدث غالباً عند بدء المشي، أو أثناء الدوران، أو عند المرور من أماكن ضيقة مثل الأبواب. كما يمكن أن يحدث عند القيام بنشاطين في نفس الوقت، مثل المشي والكلام معاً.

قد يؤدي التجميد إلى السقوط، ويزداد سوءًا مع القلق أو التوتر. هو أكثر شيوعاً في المراحل المتقدمة من مرض الشلل الرعاش.

من المهم جداً أن يتعلم كل مريض طرق وإستراتيجيات للوقاية من التجميد وتجاوزه. وعلى الرغم من أنه يحدث أكثر في فترات "Off"، إلا أن الدواء وحده غالباً لا يكفي للسيطرة عليه بشكل كامل.`,
    bodyEn: `Freezing is when the feet feel "glued" to the floor. It commonly happens when starting to walk, turning, or walking through narrow spaces. It can also happen when doing two things at the same time, like walking and talking.

It can lead to falls and gets worse with anxiety or stress. More common in advanced stages. Every patient should learn strategies to prevent and overcome freezing. Although freezing is more common during "Off" periods (when medication effect is low), it is often not fully controlled by medication alone.`,
  },
  {
    id: 'dyskinesia',
    titleAr: 'الحركات اللاإرادية (Dyskinesia)',
    titleEn: 'Dyskinesia',
    icon: '🔄',
    color: '#E07A5F',
    bodyAr: `الحركات اللاإرادية هي حركات غير مقصودة تحدث عندما تكون جرعة دواء باركنسون مرتفعة نسبياً. بالنسبة لمعظم مرضى باركنسون، الحركات الخفيفة أسهل تحملاً من بطء الحركة. ولكنها قد تكون مزعجة أو مؤلمة أحياناً.

معلومة مهمة للمريض:
عادةً يكون تناول جرعات صغيرة من الدواء على فترات متقاربة (مثلاً 4 أو 5 أو 6 مرات في اليوم) أفضل من جرعات كبيرة على فترات متباعدة. حاول تجنب استخدام الأدوية سريعة المفعول لعلاج الانسداد الحركي إن أمكن، لأنها قد تزيد من احتمال حدوث الحركات اللاإرادية على المدى الطويل.`,
    bodyEn: `Dyskinesia is involuntary (uncontrolled) movements that can occur when the medication dose is relatively high. Although some patients tolerate mild dyskinesia better than slowness, it can sometimes be uncomfortable or embarrassing.

Important Information for the Patient:
Generally, taking smaller doses of medication at shorter intervals (for example, 4, 5, or 6 times a day) works better than taking large doses at longer intervals. You should avoid using fast-acting medications to relieve movement blockages if possible, because they may increase the chance of dyskinesia in the long term.`,
  },
  {
    id: 'fluctuations',
    titleAr: 'تقلبات الحركة (Motor Fluctuations)',
    titleEn: 'Motor Fluctuations',
    icon: '📈',
    color: '#C97B3A',
    bodyAr: `مع مرور الوقت، يعاني المرضى من تغيرات بين حالة "On" (تأثير جيد للدواء وحركة أفضل) وحالة "Off" (تأثير ضعيف للدواء). تتأثر هذه التقلبات بالتوتر وتوقيت تناول الدواء.

يمكن تحسين حدوث هذه التقلبات عن طريق تعديل الدواء (الجرعة والتوقيت) بطريقة مدروسة. تناول الدواء في مواعيده الدقيقة أمر مهم جداً. من المفيد تسجيل توقيت حدوث الديسكينيزيا والانغلاقات بدقة، حتى يتمكن الطبيب من تعديل العلاج بشكل فردي حسب حالة المريض.`,
    bodyEn: `Over time, patients experience changes between "On" (good medication effect and mobility) and "Off" (poor medication effect). These fluctuations can be affected by stress and the timing of medication.

The occurrence of fluctuations can be improved by adjusting the medication (dose and timing) in a targeted way. Taking the medication at exact times is very important. It is helpful to carefully document the timing of dyskinesia and blockages so the doctor can adjust the treatment individually.`,
  },
  {
    id: 'falls',
    titleAr: 'السقوط',
    titleEn: 'Falls',
    icon: '⚡',
    color: '#E07A5F',
    bodyAr: `في مراحل مرض الباركنسون المتقدمة، يُعد السقوط مشكلة شائعة. تشمل المواقف النمطية: الدوخة بعد النهوض من وضعية الجلوس أو الاستلقاء، والتجميد، وانخفاض ردود الفعل الوضعية، وضعف الحركة أو الديسكينيزيا.

معلومات مهمة للمريض:
عند تسجيل سقوط، يُفضل أن يدوّن:
• توقيت السقوط
• هل كان بطيئًا أم يتحرك بشكل جيد أم يعاني من ديسكينيزيا
• هل شعر بدوخة قبل السقوط مباشرة

يساعد الوصف الدقيق لظروف السقوط الطبيب العصبي على تحديد السبب واتخاذ الإجراءات الوقائية المناسبة.`,
    bodyEn: `In advanced Parkinson's disease, falls are a common problem, though the causes can be quite different. Typical situations include dizziness after rising from a sitting or lying position, freezing, reduced positional reflexes (postural instability), and poor mobility or dyskinesia.

Important information for the patient:
When recording a fall, it is important to note:
• The time of the fall
• Whether they were slowed down, moving well, or experiencing dyskinesia
• Whether they felt dizzy immediately prior to the fall

An accurate description of the circumstances of the fall will allow the neurologist to determine the cause and take specific countermeasures.`,
  },
  {
    id: 'mental',
    titleAr: 'الصحة النفسية والتغيرات الإدراكية',
    titleEn: 'Mental Health & Cognitive Changes',
    icon: '💙',
    color: '#2196F3',
    bodyAr: `التعامل مع القلق في مرض باركنسون:
إذا كان المريض يعاني من القلق بشكل يؤثر على حياته اليومية، فإن الخطوة الأولى بسيطة: التحدث عنه خلال موعد الطبيب القادم.

• تقنيات الاسترخاء: تمارين التنفس وتمارين الاسترخاء البسيطة
• تعديل أدوية باركنسون: غالبًا ما يزداد القلق خلال فترات "Off"، وقد يساعد تحسين خطة العلاج
• العلاج الطبيعي (في حالة الخوف من السقوط): يمكنه تحسين التوازن وتعليم استراتيجيات للتغلب على نوبات التجمد الحركي
• الأدوية والعلاج النفسي: إذا كان القلق شديدًا أو مستمراً ويصعب السيطرة عليه`,
    bodyEn: `Managing Anxiety in Parkinson's:
If a patient is dealing with anxiety that is affecting their daily life, the first step is simple: bring it up at the next doctor's appointment. Management depends on the underlying cause and may include:

• Relaxation Techniques: Simple, non-pharmacological approaches such as breathing exercises and relaxation training
• Adjusting Parkinson's Medications: Anxiety often worsens during "off" periods when mobility is impaired. Optimizing medications may help
• Physical Therapy (for Fear of Falling): Can help improve balance and teach strategies to overcome freezing episodes
• Medication and Psychotherapy: If anxiety is severe, persistent, and difficult to manage`,
  },
  {
    id: 'nutrition',
    titleAr: 'التغذية',
    titleEn: 'Nutrition',
    icon: '🥗',
    color: '#4CAF50',
    bodyAr: `1. التوصيات الغذائية العامة:
• تناول الطعام ببطء وامضغه جيدًا
• تجنب تناول الطعام أثناء القيام بأنشطة أخرى
• فضّل الأطعمة الطازجة على الأطعمة الجاهزة
• اشرب من 1.5 إلى 2 لتر من الماء يوميًا
• أخبر الطبيب إذا كان المريض يعاني من صعوبة في البلع

2. الوقاية من الإمساك:
• الإمساك مشكلة شائعة لدى مرضى الشلل الرعاش
• اشرب كمية كافية من السوائل، حافظ على النشاط البدني، اتبع نظامًا غذائيًا متوازنًا
• إذا لم تتحسن الحالة، استشر الطبيب بشأن استخدام ماكروجول (Macrogol)

3. البروتين والليفودوبا:
• البروتينات تثبط امتصاص الليفودوبا
• تناول الدواء قبل الطعام بنصف ساعة على الأقل، أو بعده بساعة
• قد يوصي الطبيب بتناول معظم البروتين خلال وجبة العشاء لبعض المرضى

4. الفيتامينات الضرورية:
• B6, B12, وحمض الفوليك: للحفاظ على وظائف الأعصاب وتحسين فعالية الليفودوبا
• فيتامين D: للوقاية من هشاشة العظام، مع التعرض الكافي لأشعة الشمس

5. مشكلات الجهاز الهضمي:
• الانتفاخ والغثيان: 4-5 وجبات صغيرة يومياً بدلاً من 3 وجبات كبيرة
• فقدان الوزن غير المقصود: زيادة السعرات الحرارية والبروتينات، مراقبة الوزن
• زيادة الوزن بعد DBS: الحفاظ على النشاط البدني وتقليل الحلويات`,
    bodyEn: `1. General Nutritional Recommendations:
• Eat deliberately, chew the food well
• Avoid eating when doing something else
• Prioritize fresh goods over ready-to-eat food
• Drink 1.5–2 liters of water every day
• Notify the doctor in case the patient experiences difficulty swallowing

2. Constipation Prevention:
• Constipation is common in Parkinson's patients
• Drink enough fluids, be physically active, follow a balanced diet
• If not resolved, ask about Macrogol intake

3. Proteins and Levodopa:
• Proteins inhibit levodopa absorption
• Take the drug at least 30 min before a meal or 1 hour after eating
• High protein intake may be recommended during dinner for some patients

4. Necessary Vitamins:
• B6, B12, and Folic Acid: contribute to normal nerve function and better levodopa work
• Vitamin D: helpful in preventing bone fragility, ensure sufficient sunshine and physical activity

5. Digestive Problems & Weight:
• Bloating/Nausea: 4-5 small meals per day instead of 3 large ones
• Unintentional Weight Loss: increase calories and proteins, monitor weight
• Weight Gain after DBS: stay physically active, reduce sweets and sugary products`,
  },
  {
    id: 'sleep',
    titleAr: 'النوم',
    titleEn: 'Sleep',
    icon: '🌙',
    color: '#607D8B',
    bodyAr: `مشاكل المرضى الشائعة:
• صعوبة الدخول في النوم (Insomnia)
• تقطع النوم والاستيقاظ المتكرر طوال الليل

الأسباب الرئيسية:
• عوامل نفسية (تزاحم الأفكار): غياب المشتتات والهدوء وقت النوم يحفز التفكير السلبي والقلق المستمر
• عوامل جسدية (الآلام التصلبية): الاستلقاء في وضعية واحدة لفترات طويلة يسبب تيبس العضلات وظهور الأوجاع، مما يقطع نوم المريض`,
    bodyEn: `Common Patient Complaints:
• Difficulty falling asleep
• Inability to stay asleep (frequent nighttime awakenings)

Primary Underlying Causes:
• Psychological (Circling Thoughts): The lack of daytime distractions at bedtime triggers racing thoughts and elevated anxiety
• Physical (Onset of Pain): Prolonged immobility in a single position leads to muscle stiffness and discomfort, which disrupts the sleep cycle`,
  },
];

function Section({ sec, isRTL }: { sec: InfoSection; isRTL: boolean }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(o => !o);
  };

  return (
    <View style={[
      styles.card,
      {
        borderLeftWidth: isRTL ? 0 : 4,
        borderRightWidth: isRTL ? 4 : 0,
        borderLeftColor: sec.color,
        borderRightColor: sec.color,
      },
    ]}>
      <TouchableOpacity
        style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        onPress={toggle}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBadge, { backgroundColor: sec.color + '20' }]}>
          <Text style={{ fontSize: 20 }}>{sec.icon}</Text>
        </View>
        <Text style={[styles.cardTitle, { textAlign: isRTL ? 'right' : 'left', flex: 1, marginHorizontal: 10, color: sec.color }]}>
          {isRTL ? sec.titleAr : sec.titleEn}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={sec.color} />
      </TouchableOpacity>
      {open && (
        <Text style={[styles.cardBody, { textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL ? sec.bodyAr : sec.bodyEn}
        </Text>
      )}
    </View>
  );
}

export default function DocInfoScreen() {
  const { t, isRTL } = useLang();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar backgroundColor="#F0F6FF" barStyle="dark-content" translucent={false} />

      <View style={[styles.navbar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={{ width: 40 }} />
        <Text style={styles.navTitle}>{t.infoPageTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroBanner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={{ fontSize: 32 }}>🧠</Text>
          <Text style={[styles.heroText, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL
              ? 'مرجع سريع عن مرض الشلل الرعاش لمساعدة مرضاك'
              : "A quick clinical reference about Parkinson's disease to help your patients"}
          </Text>
        </View>

        {INFO_SECTIONS.map(sec => (
          <Section key={sec.id} sec={sec} isRTL={isRTL} />
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <DocTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F6FF' },
  navbar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    backgroundColor: '#F0F6FF',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DOC_COLOR,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: 4,
  },
  heroBanner: {
    backgroundColor: DOC_COLOR + '15',
    borderRadius: Radius.lg,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  heroText: {
    flex: 1,
    fontSize: 14,
    color: DOC_COLOR,
    fontWeight: '600',
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: DOC_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    padding: 14,
    alignItems: 'center',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
