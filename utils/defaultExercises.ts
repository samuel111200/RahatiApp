// utils/defaultExercises.ts
// Single source of truth for all built-in exercise data.
// Imported by exercises.tsx (patient view) and Docpatient.tsx (doctor assign).

export type ExSectionKey = 'therapy' | 'yoga' | 'aerobic' | 'endurance' | 'strength' | 'coordination';
export type AnimType = 'hipMarch' | 'armRaise' | 'standingRow' | 'legCurl' | 'rollUp' | 'achillesRelease' | 'bounce' | 'sway';

export type DefaultExercise = {
  key: string;
  emoji: string;
  titleAr: string;
  titleEn: string;
  durationMin: number;
  durationSeconds: number;
  color: string;
  bg: string;
  accent: string;
  descAr: string;
  descEn: string;
  steps: string[];
  stepsEn: string[];
  animType: AnimType;
  type: ExSectionKey;
};

export const ALL_DEFAULT_EXERCISES: DefaultExercise[] = [
  // ─── Therapy ──────────────────────────────────────────────
  {
    key: 'wristCurls',
    emoji: '🤲',
    titleAr: 'ثني الرسغ ',
    titleEn: 'Wrist Curls',
    durationMin: 5, durationSeconds: 300,
    color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
    descAr: 'يساعد على تقوية عضلات اليد والرسغ وتحسين الثبات والدقة في حركة الأصابع.',
    descEn: 'Helps strengthen wrist and hand muscles and improves stability and fine motor control of the fingers and hands.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise', type: 'therapy',
  },

  // ─── Yoga ─────────────────────────────────────────────────
  {
    key: 'childsPose',
    emoji: '🧘',
    titleAr: 'وضعية الطفل (Balasana)',
    titleEn: "Child's Pose (Balasana)",
    durationMin: 5, durationSeconds: 300,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    descAr: 'تساعد وضعية الطفل على الاسترخاء وتقليل التوتر والإجهاد، كما تعمل على إطالة عضلات الظهر والوركين بلطف، وتحسين مرونة الجسم. وتُعد من الوضعيات المفيدة لمرضى الشلل الرعاش لأنها تساعد على تهدئة الجسم والعقل، وتخفيف تيبّس العضلات، وتحسين الراحة العامة.',
    descEn: 'Child’s Pose helps promote relaxation and reduce stress and fatigue. It gently stretches the back and hip muscles while improving overall flexibility. For people with Parkinson’s disease, it can help relieve muscle stiffness, encourage relaxation, and enhance overall comfort and well-being.',
    steps: [],
    stepsEn: [],
    animType: 'sway', type: 'yoga',
  },
  {
    key: 'warriorTwo',
    emoji: '🥋',
    titleAr: 'وضعية المحارب الثاني (Warrior II)',
    titleEn: 'Warrior II (Virabhadrasana II)',
    durationMin: 3, durationSeconds: 180,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    descAr: 'تساعد وضعية المحارب الثاني على تحسين التوازن والثبات، وتقوية عضلات الساقين والوركين والجذع، وزيادة القدرة على التحمل. كما تساهم في تحسين وضعية الجسم وفتح منطقة الصدر والكتفين. وبالنسبة لمرضى الشلل الرعاش، يمكن أن تساعد على تعزيز التوازن والتحكم في الحركة وتقليل خطر السقوط.',
    descEn: 'Warrior II helps improve balance and stability while strengthening the legs, hips, and core muscles. It also enhances endurance, posture, and flexibility in the chest and shoulders. For people with Parkinson’s disease, this pose can support better balance, movement control, and confidence during daily activities.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise', type: 'yoga',
  },
  {
    key: 'jabPunches',
    emoji: '👊',
    titleAr: 'اللكمات الأمامية (Jab Punches)',
    titleEn: 'Jab Punches',
    durationMin: 5, durationSeconds: 300,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    descAr: 'يساعد تمرين اللكمات الأمامية على تحسين التناسق الحركي وسرعة الحركة، وتقوية عضلات الذراعين والكتفين، مع دعم التوازن والتحكم في الحركة.',
    descEn: 'Jab punches help improve coordination, movement speed, and upper-body strength, while supporting balance and motor control.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise', type: 'yoga',
  },
  {
    key: 'comboPunches',
    emoji: '🥊',
    titleAr: 'اللكمات المركبة (Combination Punches)',
    titleEn: 'Combination Punches',
    durationMin: 5, durationSeconds: 300,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    descAr: 'يساعد على تحسين التناسق الحركي وسرعة الحركة وتقوية عضلات الذراعين والكتفين مع دعم التوازن والتحكم في الحركة.',
    descEn: 'Helps improve coordination, movement speed, and strengthen the arms and shoulders while supporting balance and motor control.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise', type: 'yoga',
  },

  // ─── Aerobic ──────────────────────────────────────────────
  {
    key: 'singleLegStand',
    emoji: '🦩',
    titleAr: 'الوقوف على قدم واحدة (Single Leg Stand)',
    titleEn: 'Single Leg Stand',
    durationMin: 5, durationSeconds: 300,
    color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
    descAr: 'يساعد على تحسين التوازن أثناء الوقوف وتقوية عضلات الساقين وزيادة الثبات أثناء الحركة.',
    descEn: 'Helps improve standing balance, strengthen leg muscles, and increase stability during movement.',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'hipMarch', type: 'aerobic',
  },

  // ─── Endurance ────────────────────────────────────────────
  {
    key: 'armBottles',
    emoji: '💪',
    titleAr: 'تمارين الذراعين باستخدام زجاجات أثناء الجلوس',
    titleEn: 'Seated Arm Exercises with Bottles',
    durationMin: 5, durationSeconds: 300,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    descAr: 'تقوية عضلات الذراعين والكتفين باستخدام زجاجات مياه كأوزان خفيفة أثناء الجلوس',
    descEn: 'Strengthen arm and shoulder muscles using water bottles as light weights while seated',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'armRaise', type: 'endurance',
  },
  {
    key: 'seatedEndurance',
    emoji: '🪑',
    titleAr: 'تمارين التحمل أثناء الجلوس',
    titleEn: 'Seated Endurance Exercises',
    durationMin: 5, durationSeconds: 300,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    descAr: 'تمارين تحمل شاملة تُؤدى أثناء الجلوس لتقوية الجسم بأمان',
    descEn: 'Comprehensive endurance exercises performed while seated to safely strengthen the body',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'hipMarch', type: 'endurance',
  },
  {
    key: 'neckFlexibility',
    emoji: '🧘',
    titleAr: 'مرونة الرقبة أثناء الاستلقاء',
    titleEn: 'Neck Flexibility While Lying Down',
    durationMin: 5, durationSeconds: 300,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    descAr: 'يساعد على تحسين مرونة الرقبة وزيادة مدى الحركة وتقليل التيبس، مع دعم الاسترخاء العضلي أثناء الاستلقاء.',
    descEn: 'Helps improve neck flexibility and range of motion, reduce stiffness, and promote muscle relaxation while lying down.',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'sway', type: 'endurance',
  },
  {
    key: 'standUpStrength',
    emoji: '🏋️',
    titleAr: 'تمرين النهوض لتقوية الساقين',
    titleEn: 'Stand Up Exercise for Leg Strength',
    durationMin: 5, durationSeconds: 300,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    descAr: 'يساعد على تقوية عضلات الساقين وتحسين القدرة على النهوض من الجلوس، مع دعم التوازن أثناء الحركة.',
    descEn: 'Helps strengthen the leg muscles and improve the ability to stand up from sitting while supporting balance and movement control.',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'bounce', type: 'endurance',
  },
  {
    key: 'upperBodyStretch',
    emoji: '🔄',
    titleAr: 'تمارين إطالة ودوران الجزء العلوي من الجسم',
    titleEn: 'Upper Body Stretching and Rotation Exercises',
    durationMin: 5, durationSeconds: 300,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    descAr: 'تحسين مرونة الجزء العلوي من الجسم وتخفيف تيبس الكتفين والظهر',
    descEn: 'Improve upper body flexibility and relieve stiffness in the shoulders and back',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'rollUp', type: 'endurance',
  },

  // ─── Strength ─────────────────────────────────────────────
  {
    key: 'marchingInPlace',
    emoji: '🚶',
    titleAr: 'السير في وضع الوقوف',
    titleEn: 'Marching in Place',
    durationMin: 5, durationSeconds: 300,
    color: '#7B5EA7', bg: '#F0EBF8', accent: '#E0D5F2',
    descAr: 'تحسين التوازن وتقوية عضلات الساقين والوركين مع تنشيط الدورة الدموية',
    descEn: 'Improves balance and strengthens leg and hip muscles while boosting circulation',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'hipMarch', type: 'strength',
  },
  {
    key: 'chairSquat',
    emoji: '🪑',
    titleAr: 'القرفصاء باستخدام الكرسي',
    titleEn: 'Chair Squat',
    durationMin: 5, durationSeconds: 300,
    color: '#7B5EA7', bg: '#F0EBF8', accent: '#E0D5F2',
    descAr: 'يساعد هذا التمرين على تقوية عضلات الورك وتحسين التوازن والثبات أثناء الحركة.',
    descEn: 'This exercise helps strengthen the hip muscles and improve balance and stability during movement.',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'bounce', type: 'strength',
  },

  // ─── Coordination ─────────────────────────────────────────
  {
    key: 'towelArmStrength',
    emoji: '🧣',
    titleAr: 'تقوية الذراعين بالمنشفة أثناء الجلوس',
    titleEn: 'Seated Arm Strengthening with Towel',
    durationMin: 5, durationSeconds: 300,
    color: '#2A9D8F', bg: '#E6F5F3', accent: '#C8EBE7',
    descAr: 'يساعد هذا التمرين على تقوية عضلات الذراعين وتحسين التحكم الحركي وزيادة التناسق بين الطرفين أثناء أداء حركة بسيطة وآمنة.',
    descEn: 'This exercise helps strengthen the arm muscles, improve motor control, and enhance coordination between both sides of the body through simple and safe movement.',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'armRaise', type: 'coordination',
  },
  {
    key: 'seatedBicycle',
    emoji: '🚴',
    titleAr: 'تمرين الدراجة الهوائية أثناء الجلوس',
    titleEn: 'Seated Bicycle Exercise',
    durationMin: 5, durationSeconds: 300,
    color: '#2A9D8F', bg: '#E6F5F3', accent: '#C8EBE7',
    descAr: 'يساعد هذا التمرين على تنشيط عضلات الساقين وتحسين الدورة الدموية وزيادة مرونة المفاصل بطريقة آمنة أثناء الجلوس.',
    descEn: 'This exercise activates leg muscles, improves blood circulation, and enhances joint mobility safely while sitting.',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'hipMarch', type: 'coordination',
  },
  {
    key: 'seatedTwistKnee',
    emoji: '🔄',
    titleAr: 'لف الجسم ولمس الركبة المعاكسة أثناء الجلوس',
    titleEn: 'Seated Trunk Twist and Opposite Knee Touch',
    durationMin: 5, durationSeconds: 300,
    color: '#2A9D8F', bg: '#E6F5F3', accent: '#C8EBE7',
    descAr: 'يساعد هذا التمرين على تحسين التوازن والتحكم في حركة الجذع أثناء الجلوس.',
    descEn: 'This exercise helps improve balance and trunk control while sitting.',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'rollUp', type: 'coordination',
  },
  {
    key: 'lateralBalanceSeated',
    emoji: '⚖️',
    titleAr: 'تمرين التوازن الجانبي أثناء الجلوس',
    titleEn: 'Seated Lateral Balance Exercise',
    durationMin: 5, durationSeconds: 300,
    color: '#2A9D8F', bg: '#E6F5F3', accent: '#C8EBE7',
    descAr: 'يساعد هذا التمرين على تحسين مرونة الحوض وأسفل الظهر، وتعزيز التحكم في وضعية الجلوس، كما يساهم في زيادة حركة الجذع وتقليل التيبّس.',
    descEn: 'This exercise helps improve pelvic and lower back flexibility, enhance postural control while sitting, and increase trunk mobility while reducing stiffness.',
    steps: [

    ],
    stepsEn: [

    ],
    animType: 'sway', type: 'coordination',
  },

  // ─── New Therapy Exercises ─────────────────────────────────
  {
    key: 'hipStrength',
    emoji: '🦵',
    titleAr: 'تمرين مشي الوركين (Hip Marching)',
    titleEn: 'Hip Marching',
    durationMin: 5, durationSeconds: 300,
    color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
    descAr: 'التحكم في تغيير الاتجاهات أثناء المشي، كما يعزز الثبات والحركة الوظيفية اليومية.',
    descEn: 'This exercise helps improve balance and coordination, enhance control when changing directions while walking, and support stability and functional mobility in daily activities.',
    steps: [

    ],
    stepsEn: [
    ],
    animType: 'hipMarch', type: 'therapy',
  },
  {
    key: 'legSwingBalance',
    emoji: '🦵',
    titleAr: 'تمرين ثني الساق للخلف',
    titleEn: 'Standing Leg Curl',
    durationMin: 5, durationSeconds: 300,
    color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
    descAr: 'يساعد هذا التمرين على تحسين التوازن والثبات أثناء الوقوف، وزيادة مرونة مفصل الورك، كما يساهم في تحسين التحكم في حركة الساق أثناء المشي.',
    descEn: 'This exercise helps improve balance and stability while standing, increase hip joint flexibility, and enhance leg control during walking.',
    steps: [],
    stepsEn: [],
    animType: 'hipMarch', type: 'therapy',
  },
  {
    key: 'pelvisTiltSeated',
    emoji: '🦶',
    titleAr: 'إرخاء وتر أكيليس (Achilles Tendon Release)',
    titleEn: 'Achilles Tendon Release',
    durationMin: 5, durationSeconds: 300,
    color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
    descAr: 'يساعد هذا التمرين على تحسين مرونة مفصل الركبة وزيادة مدى الحركة، كما يساهم في تنشيط العضلات المحيطة بالمفصل وتحسين التوازن أثناء الوقوف.',
    descEn: 'This exercise helps improve knee joint flexibility and range of motion, while activating the surrounding muscles and enhancing balance during standing.',
    steps: [],
    stepsEn: [],
    animType: 'achillesRelease', type: 'therapy',
  },
  {
    key: 'upperFlexArmStrength',
    emoji: '💺',
    titleAr: 'تمرين رفع الذراع على الكرسي (Arm Raise)',
    titleEn: 'Seated Arm Raise',
    durationMin: 5, durationSeconds: 300,
    color: '#5B9BD5', bg: '#E8F1FB', accent: '#D0E5F7',
    descAr: 'يساعد هذا التمرين على تحسين مرونة الجذع وزيادة مدى الحركة، كما يعزز التناسق بين جانبي الجسم ويُحسّن التحكم في الحركات الدورانية.',
    descEn: 'This exercise helps improve trunk flexibility, increase range of motion, and enhance coordination and control during rotational movements.',
    steps: [],
    stepsEn: [],
    animType: 'armRaise', type: 'therapy',
  },

  // ─── New Yoga Exercise ────────────────────────────────────
  {
    key: 'lyingTwistArms',
    emoji: '🤸',
    titleAr: 'تمرين التدحرج لأعلى (Roll-ups) - بيلاتس',
    titleEn: 'Roll-ups (Pilates)',
    durationMin: 5, durationSeconds: 300,
    color: '#4CAF82', bg: '#E8F5EF', accent: '#D6EFE3',
    descAr: 'يساعد هذا التمرين على تقوية عضلات الظهر والحوض، وتحسين ثبات الجذع ومرونة العمود الفقري.',
    descEn: 'This exercise helps strengthen the back and pelvic muscles, improve trunk stability and spinal flexibility.',
    steps: [],
    stepsEn: [],
    animType: 'rollUp', type: 'yoga',
  },

  // ─── New Aerobic Exercises ─────────────────────────────────
  {
    key: 'heelTapStanding',
    emoji: '👣',
    titleAr: 'تمرين النقر بكعب القدم أثناء الوقوف',
    titleEn: 'Standing Heel Tap',
    durationMin: 5, durationSeconds: 300,
    color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
    descAr: 'يساعد على تحسين التوازن أثناء الوقوف وتقوية التحكم في حركة الساقين والكاحل، مع تعزيز التنسيق بين الحركة والاتزان.',
    descEn: 'Helps improve standing balance, strengthen ankle and leg control, and enhance coordination and stability.',
    steps: [],
    stepsEn: [],
    animType: 'hipMarch', type: 'aerobic',
  },
  {
    key: 'kneeCircleStanding',
    emoji: '🔵',
    titleAr: 'تمرين دوران الركبة أثناء الوقوف',
    titleEn: 'Standing Knee Circle',
    durationMin: 5, durationSeconds: 300,
    color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
    descAr: 'يساعد هذا التمرين على تقوية عضلات الفخذين والساقين، وتحسين التوازن والثبات، ودعم القدرة على الجلوس والوقوف والحركة اليومية.',
    descEn: 'This exercise helps strengthen the thigh and leg muscles, improve balance and stability, and support daily activities such as sitting, standing, and walking.',
    steps: [],
    stepsEn: [],
    animType: 'hipMarch', type: 'aerobic',
  },
  {
    key: 'trunkRotationStanding',
    emoji: '🔄',
    titleAr: 'تمرين دوران الجذع أثناء الوقوف',
    titleEn: 'Standing Trunk Rotation',
    durationMin: 5, durationSeconds: 300,
    color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
    descAr: 'يساعد هذا التمرين على تحسين مرونة الجذع والعمود الفقري، وزيادة مدى الحركة الدورانية، كما يعزز التوازن والتناسق الحركي بين جانبي الجسم.',
    descEn: 'This exercise helps improve trunk and spinal flexibility, increase rotational range of motion, and enhance balance and coordination between both sides of the body.',
    steps: [],
    stepsEn: [],
    animType: 'rollUp', type: 'aerobic',
  },
  {
    key: 'toeTipHeelStand',
    emoji: '🧦',
    titleAr: 'تمرين الوقوف على أطراف الأصابع والكعبين',
    titleEn: 'Toe Tip and Heel Stand',
    durationMin: 5, durationSeconds: 300,
    color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
    descAr: 'يساعد على تقوية عضلات الساقين والكاحل وتحسين التوازن أثناء الوقوف، مع دعم الثبات والتحكم في الحركة.',
    descEn: 'Helps strengthen the leg and ankle muscles, improve standing balance, and support stability and movement control.',
    steps: [],
    stepsEn: [],
    animType: 'bounce', type: 'aerobic',
  },
  {
    key: 'trunkFlexibilityStanding',
    emoji: '🌊',
    titleAr: 'تمرين مرونة حركة الجذع أثناء الوقوف',
    titleEn: 'Standing Trunk Flexibility',
    durationMin: 5, durationSeconds: 300,
    color: '#E07B5C', bg: '#FDF0EB', accent: '#FAE2D6',
    descAr: 'تحسين مرونة الجذع والعمود الفقري وتخفيف تيبس الظهر',
    descEn: 'Improves trunk and spinal flexibility and relieves back stiffness',
    steps: [],
    stepsEn: [],
    animType: 'sway', type: 'aerobic',
  },

  // ─── New Strength Exercises ────────────────────────────────
  {
    key: 'armLegStrength',
    emoji: '💪',
    titleAr: 'تمرين تقوية الذراعين والساقين',
    titleEn: 'Arm and Leg Strengthening',
    durationMin: 5, durationSeconds: 300,
    color: '#7B5EA7', bg: '#F0EBF8', accent: '#E0D5F2',
    descAr: 'يساعد تمرين تقوية الذراعين والساقين على تحسين القوة العضلية، التوازن، وتناسق الحركة بين الأطراف مع دعم ثبات الجسم أثناء الحركة.',
    descEn: ' This exercise strengthens the arms and legs, improving balance, coordination, and overall body stability during controlled movements.',
    steps: [],
    stepsEn: [],
    animType: 'hipMarch', type: 'strength',
  },
  {
    key: 'standingArmTrunk',
    emoji: '🏋️',
    titleAr: 'تمرين السحب أثناء الوقوف (Standing Row)',
    titleEn: 'Standing Row',
    durationMin: 5, durationSeconds: 300,
    color: '#7B5EA7', bg: '#F0EBF8', accent: '#E0D5F2',
    descAr: ' تمرين إطالة ودوران الجزء العلوي لتحسين مرونة الكتفين والظهر العلوي.',
    descEn: 'Upper body stretch and rotation  to improve shoulder and upper back flexibility.',
    steps: [],
    stepsEn: [],
    animType: 'standingRow', type: 'strength',
  },
  {
    key: 'backBridgeLying',
    emoji: '🌉',
    titleAr: 'تمرين تقوس الظهر أثناء الاستلقاء (Back Bridge)',
    titleEn: 'Back Bridge (Lying)',
    durationMin: 5, durationSeconds: 300,
    color: '#7B5EA7', bg: '#F0EBF8', accent: '#E0D5F2',
    descAr: 'يساعد هذا التمرين على تحسين مرونة الجذع والظهر، وزيادة مدى الحركة في العمود الفقري، كما يساهم في تحسين وضعية الجسم وتقليل التيبّس',
    descEn: 'This exercise helps improve trunk and back flexibility, increase spinal range of motion, and promote better posture while reducing stiffness',
    steps: [],
    stepsEn: [],
    animType: 'bounce', type: 'strength',
  },

  // ─── New Endurance Exercise ────────────────────────────────
  {
    key: 'trunkBackFlexibility',
    emoji: '🌀',
    titleAr: 'تمارين مرونة الجذع والظهر',
    titleEn: 'Trunk and Back Flexibility Exercises',
    durationMin: 5, durationSeconds: 300,
    color: '#D45BAA', bg: '#FCEEF8', accent: '#F8D6F0',
    descAr: 'يساعد تمرين تقوية الذراعين وجذع الجسم  على تحسين القوة العضلية، زيادة الثبات، ودعم القدرة على التحكم في الحركة والوضعية أثناء الوقوف.',
    descEn: 'This exercise improves arm and core strength, enhances stability, and supports better posture and movement control while standing.',
    steps: [],
    stepsEn: [],
    animType: 'rollUp', type: 'endurance',
  },
];

export const ALL_DEFAULT_EXERCISES_MAP: Record<string, DefaultExercise> =
  Object.fromEntries(ALL_DEFAULT_EXERCISES.map(e => [e.key, e]));
