// app/tabs/notificationService.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// ─── Active-user scoping ──────────────────────────────────
let _uid = '';
// Declared here so setNotifUid can reset them when the user changes
let lastDoneSnapshot: string | null = null;
let lastEnergy: number | null = null;

export function setNotifUid(uid: string) {
  if (_uid !== uid) {
    _uid = uid;
    // Re-baseline both watchers under the new uid-prefixed keys
    lastDoneSnapshot = null;
    lastEnergy       = null;
  }
}
function uk(base: string): string { return _uid ? `${_uid}_${base}` : base; }

// ─── Types ───────────────────────────────────────────────
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  emoji: string;
  type: "task" | "break" | "energy" | "add" | "delete" | "update";
  timestamp: number;
  read: boolean;
}

// ─── Lang helper ─────────────────────────────────────────
async function getLang(): Promise<"ar" | "en"> {
  try {
    const saved = await AsyncStorage.getItem("app_language");
    return saved === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

// ─── Lazy imports ────────────────────────────────────────
type NotificationsModule = typeof import("expo-notifications");
let _N: NotificationsModule | null = null;
async function N(): Promise<NotificationsModule | null> {
  if (_N) return _N;
  try { _N = await import("expo-notifications"); return _N; } catch { return null; }
}

let _TM: any = null;
async function TM(): Promise<any | null> {
  if (_TM) return _TM;
  try { _TM = await import("expo-task-manager"); return _TM; } catch { return null; }
}

let _BF: any = null;
async function BF(): Promise<any | null> {
  if (_BF) return _BF;
  try { _BF = await import("expo-background-fetch"); return _BF; } catch { return null; }
}

// ─── Background Task ─────────────────────────────────────
export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND_TASK_WATCHER";

export function registerBackgroundTask() {
  (async () => {
    const tm = await TM();
    const bf = await BF();
    if (!tm || !bf) return;
    if (!tm.isTaskDefined(BACKGROUND_NOTIFICATION_TASK)) {
      tm.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
        try {
          await runWatcherCycle();
          return bf.BackgroundFetchResult.NewData;
        } catch {
          return bf.BackgroundFetchResult.Failed;
        }
      });
    }
  })();
}

// ─── Helpers ─────────────────────────────────────────────
function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseArabicTime(
  timeStr: string
): { hours: number; minutes: number } | null {
  if (!timeStr || !timeStr.trim()) return null;
  try {
    const s = timeStr.trim();
    const isPM = s.includes("م") || s.toLowerCase().includes("pm");
    const isAM = s.includes("ص") || s.toLowerCase().includes("am");
    const clean = s
      .replace("ص", "").replace("م", "")
      .replace(/pm/i, "").replace(/am/i, "")
      .trim();
    const parts = clean.split(":");
    if (parts.length < 2) return null;
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return { hours, minutes };
  } catch { return null; }
}

function timeToMinutesLocal(timeStr: string): number {
  if (!timeStr) return -1;
  const parsed = parseArabicTime(timeStr);
  if (!parsed) return -1;
  return parsed.hours * 60 + parsed.minutes;
}

function nowInMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function addMinutesToTime(timeStr: string, addMin: number): string {
  const parsed = parseArabicTime(timeStr);
  if (!parsed) return timeStr;
  const totalMin = parsed.hours * 60 + parsed.minutes + addMin;
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const isPM = h >= 12;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const suffix = isPM ? "م" : "ص";
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// ─── Send push notification ───────────────────────────────
export async function sendPushNotification(
  title: string,
  body: string,
  channelId: string = "tasks",
  data?: Record<string, unknown>
) {
  const mod = await N();
  if (!mod) return;
  try {
    await mod.scheduleNotificationAsync({
      content: {
        title,
        body,
        ...(Platform.OS === "android" && {
          // @ts-ignore
          icon: "character",
          largeIcon: "character",
          color: "#7C5CBF",
          channelId,
        }),
        sound: Platform.OS === "ios" ? "notification_sound.wav" : undefined,
        data: { channelId, ...data },
        badge: 1,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("Push notification error:", e);
  }
}

// ─── Main notify ──────────────────────────────────────────
export async function notify(
  params: Omit<AppNotification, "id" | "timestamp" | "read"> & {
    dedupKey?: string;
  },
  channelId: string = "tasks"
) {
  if (params.dedupKey) {
    try {
      const already = await AsyncStorage.getItem(params.dedupKey);
      if (already) return;
      await AsyncStorage.setItem(params.dedupKey, "1");
    } catch {
      void 0;
    }
  }

  await sendPushNotification(
    `${params.emoji} ${params.title}`,
    params.body,
    channelId,
    { type: params.type }
  );
}

// ─── Get today's plan items ───────────────────────────────
async function getTodayPlanItems(): Promise<Array<{
  id: string;
  title: string;
  emoji: string;
  timeFrom: string;
  timeTo: string;
  timeFromMin: number;
  timeToMin: number;
  isExercise: boolean;
  durationMin: number;
}>> {
  const todayKey = getTodayDateKey();

  const [coreRaw, extraRaw, exRaw] = await Promise.all([
    AsyncStorage.getItem(uk("core_tasks")),
    AsyncStorage.getItem(uk("extra_tasks")),
    AsyncStorage.getItem(uk("core_exercises")),
  ]);

  const coreTasks: any[]  = coreRaw  ? JSON.parse(coreRaw)  : [];
  const extraTasks: any[] = extraRaw ? JSON.parse(extraRaw) : [];
  const exercises: any[]  = exRaw    ? JSON.parse(exRaw)    : [];

  const todayExtras = extraTasks.filter(
    (t: any) => !t.date || t.date === todayKey
  );

  const sortByTime = (arr: any[]) =>
    [...arr].sort((a, b) => {
      const aStr = a.timeFrom ?? (a.time ?? "").split(" - ")[0] ?? "";
      const bStr = b.timeFrom ?? (b.time ?? "").split(" - ")[0] ?? "";
      return timeToMinutesLocal(aStr) - timeToMinutesLocal(bStr);
    });

  const allTasks = [
    ...sortByTime(coreTasks).map((t: any) => ({ ...t, _type: "core" })),
    ...sortByTime(todayExtras).map((t: any) => ({ ...t, _type: "extra" })),
  ];

  const result: any[] = [];
  let exerciseIdx = 0;

  for (const raw of allTasks) {
    const timeParts = (raw.time ?? "").split(" - ");
    const timeFrom  = (raw.timeFrom ?? timeParts[0] ?? "").trim();
    const timeTo    = (raw.timeTo   ?? timeParts[1] ?? "").trim();

    const fromMin = timeToMinutesLocal(timeFrom);
    let   toMin   = timeToMinutesLocal(timeTo);
    let   durMin  = 30;
    if (fromMin >= 0 && toMin > fromMin) {
      durMin = toMin - fromMin;
    } else {
      toMin = fromMin >= 0 ? fromMin + durMin : -1;
    }

    result.push({
      id:          String(raw.key ?? raw.id ?? `task_${Date.now()}`),
      title:       raw.name ?? raw.title ?? raw.key ?? "مهمة",
      emoji:       raw.icon ?? raw.emoji ?? "📌",
      timeFrom, timeTo,
      timeFromMin: fromMin,
      timeToMin:   toMin,
      isExercise:  false,
      durationMin: durMin,
    });

    if (exercises.length > 0) {
      const ex         = exercises[exerciseIdx % exercises.length];
      const exTimeFrom = timeTo ? timeTo
        : fromMin >= 0 ? addMinutesToTime(timeFrom, durMin) : "";
      const exDurMin   = ex.durationSeconds
        ? Math.round(ex.durationSeconds / 60)
        : ex.durationMin ?? 5;
      const exTimeTo   = exTimeFrom ? addMinutesToTime(exTimeFrom, exDurMin) : "";
      const exFromMin  = timeToMinutesLocal(exTimeFrom);
      const exToMin    = timeToMinutesLocal(exTimeTo);
      const stableExId = `exercise_${String(ex.key ?? ex.id ?? exerciseIdx)}_slot${exerciseIdx}`;

      result.push({
        id: stableExId,
        title: ex.title ?? ex.titleAr ?? "تمرين",
        emoji: ex.emoji ?? "🏋️",
        timeFrom: exTimeFrom, timeTo: exTimeTo,
        timeFromMin: exFromMin, timeToMin: exToMin,
        isExercise: true, durationMin: exDurMin,
      });
      exerciseIdx++;
    }
  }

  return result;
}

// ─── Timing watcher cycle (10 / 5 / الآن) ────────────────
export async function runWatcherCycle() {
  const lang     = await getLang();
  const isAr     = lang === "ar";
  const todayKey = getTodayDateKey();
  const nowMin   = nowInMinutes();
  const planItems = await getTodayPlanItems();

  for (const item of planItems) {
    if (item.timeFromMin < 0) continue;
    const diffMin = item.timeFromMin - nowMin;

    // labels
    const taskLabel    = isAr ? "مهمة"    : "task";
    const exerciseLabel = isAr ? "تمرين"  : "exercise";
    const label        = item.isExercise ? exerciseLabel : taskLabel;
    const ch           = item.isExercise ? "exercises"   : "tasks";

    // 10 دقايق قبل
    if (diffMin > 9 && diffMin <= 11) {
      await notify(
        {
          title: isAr
            ? `موعد ${label} قريب ⏰`
            : `Upcoming ${label} ⏰`,
          body: isAr
            ? `${item.emoji} "${item.title}" هيبدأ بعد 10 دقايق`
            : `${item.emoji} "${item.title}" starts in 10 minutes`,
          emoji:    "⏰",
          type:     item.isExercise ? "break" : "task",
          dedupKey: `notified_10min_${item.id}_${todayKey}`,
        },
        ch
      );
    }

    // 5 دقايق قبل
    if (diffMin > 4 && diffMin <= 6) {
      await notify(
        {
          title: isAr
            ? `${label} قريب${item.isExercise ? "" : "ة"} ⏰`
            : `${label} coming up ⏰`,
          body: isAr
            ? `${item.emoji} "${item.title}" هيبدأ بعد 5 دقايق، استعد!`
            : `${item.emoji} "${item.title}" starts in 5 minutes, get ready!`,
          emoji:    "⏰",
          type:     item.isExercise ? "break" : "task",
          dedupKey: `notified_5min_${item.id}_${todayKey}`,
        },
        ch
      );
    }

    // دلوقتي
    if (diffMin >= 0 && diffMin <= 1) {
      await notify(
        {
          title: isAr
            ? `وقت ${item.isExercise ? "التمرين" : "المهمة"} دلوقتي! 🚀`
            : `Time for your ${label} now! 🚀`,
          body: isAr
            ? `${item.emoji} ابدأ "${item.title}" دلوقتي`
            : `${item.emoji} Start "${item.title}" now`,
          emoji:    "🚀",
          type:     item.isExercise ? "break" : "task",
          dedupKey: `notified_now_${item.id}_${todayKey}`,
        },
        ch
      );
    }
  }
}

// ─── Setup Notifications ─────────────────────────────────
export async function setupNotifications() {
  const mod = await N();
  if (!mod) return;

  // Note: notification handler is set in app/_layout.tsx at module level.
  // Do not override it here.

  if (Platform.OS === "web") return;

  try {
    if (Platform.OS === "android") {
      const channels = [
        { id: "tasks",      name: "تنبيهات المهام",     importance: mod.AndroidImportance.HIGH,    lightColor: "#7C5CBF", vibrationPattern: [0, 250, 150, 250] as number[] },
        { id: "exercises",  name: "تنبيهات التمارين",   importance: mod.AndroidImportance.HIGH,    lightColor: "#4CAF82", vibrationPattern: [0, 300, 100, 300, 100, 300] as number[] },
        { id: "completion", name: "إشعارات الإنجاز",    importance: mod.AndroidImportance.HIGH,    lightColor: "#4CAF82", vibrationPattern: [0, 100, 50, 100, 50, 200] as number[] },
        { id: "energy",     name: "تنبيهات الطاقة",     importance: mod.AndroidImportance.DEFAULT, lightColor: "#F5A623", vibrationPattern: [0, 200] as number[] },
        { id: "missed",     name: "مهام وتمارين فاتتك", importance: mod.AndroidImportance.HIGH,    lightColor: "#E05C5C", vibrationPattern: [0, 400, 200, 400] as number[] },
        { id: "summary",    name: "ملخص اليوم",          importance: mod.AndroidImportance.HIGH,    lightColor: "#7C5CBF", vibrationPattern: [0, 300, 150, 300, 150, 300] as number[] },
        { id: "chat",       name: "رسائل الدردشة",       importance: mod.AndroidImportance.HIGH,    lightColor: "#7C5CBF", vibrationPattern: [0, 250, 150, 250] as number[] },
      ];
      for (const ch of channels) {
        await mod.setNotificationChannelAsync(ch.id, {
          name: ch.name,
          importance: ch.importance,
          sound: "notification_sound",
          vibrationPattern: ch.vibrationPattern,
          lightColor: ch.lightColor,
          lockscreenVisibility: mod.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
          showBadge: ch.id !== "energy",
        });
      }
    }

    const { status: existingStatus } = await mod.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await mod.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("إذن الإشعارات مش متاح");
      return;
    }

    await registerBackgroundFetch();
  } catch (e) {
    console.warn("Notification setup error:", e);
  }
}

async function registerBackgroundFetch() {
  const bf = await BF();
  const tm = await TM();
  if (!bf || !tm) return;
  try {
    const status = await bf.getStatusAsync();
    if (
      status === bf.BackgroundFetchStatus.Restricted ||
      status === bf.BackgroundFetchStatus.Denied
    ) return;

    const tasks = await tm.getRegisteredTasksAsync();
    const alreadyRegistered = tasks.some(
      (t: { taskName: string }) => t.taskName === BACKGROUND_NOTIFICATION_TASK
    );
    if (!alreadyRegistered) {
      await bf.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
        minimumInterval: 60 * 15,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (e) {
    console.warn("Background fetch registration error:", e);
  }
}

// ════════════════════════════════════════════════════════════
// ─── Action Notifications ────────────────────────────────
// ════════════════════════════════════════════════════════════

export async function notifyTaskAdded(
  taskName: string,
  taskEmoji: string = "📌",
  taskType: "core" | "extra" = "core"
) {
  const isAr = (await getLang()) === "ar";
  await notify(
    {
      title: isAr ? "تمت إضافة مهمة جديدة ✅" : "New task added ✅",
      body: isAr
        ? `${taskEmoji} "${taskName}" اتضافت${taskType === "extra" ? " لليوم ده" : " للمهام الأساسية"}`
        : `${taskEmoji} "${taskName}" added to ${taskType === "extra" ? "today" : "core tasks"}`,
      emoji: "✅",
      type:  "add",
    },
    "tasks"
  );
}

export async function notifyTaskDeleted(
  taskName: string,
  taskEmoji: string = "📌"
) {
  const isAr = (await getLang()) === "ar";
  await notify(
    {
      title: isAr ? "تم حذف المهمة 🗑️" : "Task deleted 🗑️",
      body:  isAr ? `${taskEmoji} "${taskName}" تم حذفها` : `${taskEmoji} "${taskName}" has been deleted`,
      emoji: "🗑️",
      type:  "delete",
    },
    "tasks"
  );
}

export async function notifyTaskUpdated(
  taskName: string,
  taskEmoji: string = "📌",
  detail?: string
) {
  const isAr = (await getLang()) === "ar";
  await notify(
    {
      title: isAr ? "تم تحديث المهمة ✏️" : "Task updated ✏️",
      body:  detail ?? (isAr ? `${taskEmoji} "${taskName}" اتعدلت` : `${taskEmoji} "${taskName}" has been updated`),
      emoji: "✏️",
      type:  "update",
    },
    "tasks"
  );
}

export async function notifyExerciseAdded(
  exerciseName: string,
  exerciseEmoji: string = "🏋️"
) {
  const isAr = (await getLang()) === "ar";
  await notify(
    {
      title: isAr ? "تمت إضافة تمرين ✅" : "Exercise added ✅",
      body:  isAr
        ? `${exerciseEmoji} "${exerciseName}" اتضاف للتمارين`
        : `${exerciseEmoji} "${exerciseName}" added to exercises`,
      emoji: "✅",
      type:  "add",
    },
    "exercises"
  );
}

export async function notifyExerciseDeleted(
  exerciseName: string,
  exerciseEmoji: string = "🏋️"
) {
  const isAr = (await getLang()) === "ar";
  await notify(
    {
      title: isAr ? "تم حذف التمرين 🗑️" : "Exercise deleted 🗑️",
      body:  isAr
        ? `${exerciseEmoji} "${exerciseName}" تم حذفه`
        : `${exerciseEmoji} "${exerciseName}" has been deleted`,
      emoji: "🗑️",
      type:  "delete",
    },
    "exercises"
  );
}

export async function notifyExerciseUpdated(
  exerciseName: string,
  exerciseEmoji: string = "🏋️",
  detail?: string
) {
  const isAr = (await getLang()) === "ar";
  await notify(
    {
      title: isAr ? "تم تحديث التمرين ✏️" : "Exercise updated ✏️",
      body:  detail ?? (isAr
        ? `${exerciseEmoji} "${exerciseName}" اتعدل`
        : `${exerciseEmoji} "${exerciseName}" has been updated`),
      emoji: "✏️",
      type:  "update",
    },
    "exercises"
  );
}

export async function notifyTaskCompleted(
  taskName: string,
  taskEmoji: string = "📌"
) {
  // ⚠️ لا تنادي الفانكشن دي من home.tsx —
  // الـ completionWatcher هو المسؤول الوحيد عن إشعار الإتمام
  // استخدمها بس لو عندك سبب خاص خارج الـ watcher
  const isAr = (await getLang()) === "ar";
  await notify(
    {
      title: isAr ? "أحسنت! مهمة منجزة 🎉" : "Well done! Task completed 🎉",
      body:  isAr
        ? `لقد أتممت "${taskEmoji} ${taskName}" بنجاح! استمر في التقدم 💪`
        : `You completed "${taskEmoji} ${taskName}" successfully! Keep going 💪`,
      emoji: "🎉",
      type:  "task",
    },
    "completion"
  );
}

export async function notifyExerciseCompleted(
  exerciseName: string,
  exerciseEmoji: string = "🏋️"
) {
  // ⚠️ لا تنادي الفانكشن دي من home.tsx —
  // الـ completionWatcher هو المسؤول الوحيد عن إشعار الإتمام
  // استخدمها بس لو عندك سبب خاص خارج الـ watcher
  const isAr = (await getLang()) === "ar";
  await notify(
    {
      title: isAr ? "تمرين ناجح! 💪" : "Exercise complete! 💪",
      body:  isAr
        ? `أنجزت "${exerciseEmoji} ${exerciseName}" بنجاح! جسمك بيشكرك 🌟`
        : `You completed "${exerciseEmoji} ${exerciseName}" successfully! Your body thanks you 🌟`,
      emoji: "💪",
      type:  "break",
    },
    "completion"
  );
}

// ─── Misc (backward compat) ───────────────────────────────
export async function markAllRead() {}
export async function clearAllNotifications() {}
export async function getUnreadCount(): Promise<number> { return 0; }
export function suppressTaskListNotifOnce() {}

// ════════════════════════════════════════════════════════════
// ─── Watchers ────────────────────────────────────────────
// ════════════════════════════════════════════════════════════

// ── Timing watcher (10/5/الآن) ──
let taskWatcherInterval: ReturnType<typeof setInterval> | null = null;

export function startTaskWatcher() {
  if (taskWatcherInterval) return;
  taskWatcherInterval = setInterval(async () => {
    try { await runWatcherCycle(); }
    catch (e) { console.warn("Task watcher error:", e); }
  }, 30_000);
}

export function stopTaskWatcher() {
  if (taskWatcherInterval) { clearInterval(taskWatcherInterval); taskWatcherInterval = null; }
}

// ── Missed watcher ──
let missedWatcherInterval: ReturnType<typeof setInterval> | null = null;

export function startMissedWatcher() {
  if (missedWatcherInterval) return;

  missedWatcherInterval = setInterval(async () => {
    try {
      const lang     = await getLang();
      const isAr     = lang === "ar";
      const todayKey = getTodayDateKey();
      const nowMin   = nowInMinutes();
      const doneRaw  = await AsyncStorage.getItem(uk(`plan_done_${todayKey}`));
      const doneIds  = new Set<string>(doneRaw ? JSON.parse(doneRaw) : []);
      const planItems = await getTodayPlanItems();

      for (const item of planItems) {
        if (item.timeFromMin < 0)     continue;
        if (doneIds.has(item.id))     continue;
        if (nowMin <= item.timeToMin + 5) continue;

        const label = item.isExercise
          ? (isAr ? "تمرين" : "exercise")
          : (isAr ? "مهمة"  : "task");

        await notify(
          {
            title: isAr
              ? `${label} فاتتك! 😔`
              : `Missed ${label}! 😔`,
            body: isAr
              ? `${item.emoji} "${item.title}" فاتت ومعلمتهاش كمنجزة`
              : `${item.emoji} "${item.title}" passed and wasn't marked as done`,
            emoji:    "😔",
            type:     item.isExercise ? "break" : "task",
            dedupKey: `notified_missed_${item.id}_${todayKey}`,
          },
          "missed"
        );
      }
    } catch (e) { console.warn("Missed watcher error:", e); }
  }, 60_000);
}

export function stopMissedWatcher() {
  if (missedWatcherInterval) { clearInterval(missedWatcherInterval); missedWatcherInterval = null; }
}

// ── Completion watcher ──
let completionWatcherInterval: ReturnType<typeof setInterval> | null = null;
// ✅ lock يمنع التنفيذ المتوازي لو الـ interval اتشغل قبل ما السابق يخلص
let isCompletionRunning = false;

export function startCompletionWatcher() {
  if (completionWatcherInterval) return;

  completionWatcherInterval = setInterval(async () => {
    // لو في cycle شغال، تجاهل الـ tick ده تماماً
    if (isCompletionRunning) return;
    isCompletionRunning = true;

    try {
      const lang     = await getLang();
      const isAr     = lang === "ar";
      const todayKey = getTodayDateKey();
      const planDoneRaw = await AsyncStorage.getItem(uk(`plan_done_${todayKey}`));

      const currentSnapshot = planDoneRaw
        ? ([...JSON.parse(planDoneRaw)] as string[]).sort().join(",")
        : "";

      // لو الـ uid مش متحط بعد، استنّى — مش كوّن baseline بـ key غلط
      if (!_uid) return;

      // أول مرة: حمّل الـ baseline بدون ما تبعت إشعارات
      if (lastDoneSnapshot === null) {
        lastDoneSnapshot = currentSnapshot;
        return;
      }

      // مفيش تغيير — خروج سريع
      if (lastDoneSnapshot === currentSnapshot) return;

      const doneIds   = planDoneRaw ? (JSON.parse(planDoneRaw) as string[]) : [];
      const prevIds   = new Set(lastDoneSnapshot.split(",").filter(Boolean));
      const newlyDone = doneIds.filter((id) => id && !prevIds.has(id));

      // حدّث الـ snapshot الأول قبل أي await تاني لمنع الـ race condition
      lastDoneSnapshot = currentSnapshot;

      if (!newlyDone.length) return;

      // تأكد إن الـ IDs دي موجودة فعلاً في خطة اليوم — يمنع إشعارات وهمية
      const planItems = await getTodayPlanItems();
      if (!planItems.length) return;
      const planItemIds = new Set(planItems.map(p => p.id));
      const validNewlyDone = newlyDone.filter(id => planItemIds.has(id));
      if (!validNewlyDone.length) return;

      const [coreRaw, extraRaw, exRaw, fsCacheRaw] = await Promise.all([
        AsyncStorage.getItem(uk("core_tasks")),
        AsyncStorage.getItem(uk("extra_tasks")),
        AsyncStorage.getItem(uk("core_exercises")),
        AsyncStorage.getItem(uk("fs_tasks_cache")),
      ]);

      let coreTasks:  any[] = [];
      let extraTasks: any[] = [];
      if (fsCacheRaw) {
        const fsCache = JSON.parse(fsCacheRaw) as any[];
        coreTasks  = fsCache.filter((t) => t.type === "core");
        extraTasks = fsCache.filter((t) => t.type === "extra");
      } else {
        coreTasks  = coreRaw  ? JSON.parse(coreRaw)  : [];
        extraTasks = extraRaw ? JSON.parse(extraRaw) : [];
      }
      const exercises: any[] = exRaw ? JSON.parse(exRaw) : [];

      for (const id of validNewlyDone) {
        if (!id) continue;

        // ✅ dedupKey بدقة الثانية يمنع إرسال مزدوج في نفس اللحظة
        const dedupKey = `completion_sent_${id}_${Math.floor(Date.now() / 1000)}`;
        try {
          const alreadySent = await AsyncStorage.getItem(dedupKey);
          if (alreadySent) continue;
          await AsyncStorage.setItem(dedupKey, "1");
        } catch { /* تجاهل أخطاء الـ storage */ }

        if (id.startsWith("exercise_")) {
          const withoutPrefix = id.replace("exercise_", "");
          const slotIdx = withoutPrefix.lastIndexOf("_slot");
          const exKey   = slotIdx >= 0 ? withoutPrefix.substring(0, slotIdx) : withoutPrefix;
          const idx     = slotIdx >= 0 ? parseInt(withoutPrefix.substring(slotIdx + 5), 10) : 0;
          const ex      = exercises.find((e: any) => String(e.key ?? e.id ?? e.title) === exKey)
            ?? exercises[idx % Math.max(exercises.length, 1)];

          await sendPushNotification(
            isAr ? "تمرين ناجح! 💪" : "Exercise complete! 💪",
            isAr
              ? `أنجزت "${ex?.emoji ?? "🏋️"} ${ex?.title ?? ex?.titleAr ?? "التمرين"}" بنجاح! جسمك بيشكرك 🌟`
              : `You completed "${ex?.emoji ?? "🏋️"} ${ex?.titleEn ?? ex?.title ?? "the exercise"}" successfully! Your body thanks you 🌟`,
            "completion",
          );
          continue;
        }

        const task = [...coreTasks, ...extraTasks].find(
          (t: any) => (t.key ?? t.id) === id
        );
        if (!task) {
          await sendPushNotification(
            isAr ? "أحسنت! مهمة منجزة 🎉" : "Well done! Task completed 🎉",
            isAr
              ? "أتممت مهمة بنجاح! استمر في التقدم 💪"
              : "You completed a task successfully! Keep going 💪",
            "completion",
          );
          continue;
        }

        await sendPushNotification(
          isAr ? "أحسنت! مهمة منجزة 🎉" : "Well done! Task completed 🎉",
          isAr
            ? `لقد أتممت "${task.emoji ?? task.icon ?? "📌"} ${task.title ?? task.name ?? "المهمة"}" بنجاح! استمر في التقدم 💪`
            : `You completed "${task.emoji ?? task.icon ?? "📌"} ${task.name ?? task.title ?? "the task"}" successfully! Keep going 💪`,
          "completion",
        );
      }
    } catch (e) {
      console.warn("Completion watcher error:", e);
    } finally {
      // ✅ دايماً نفضي الـ lock حتى لو حصل error
      isCompletionRunning = false;
    }
  }, 3_000); // ✅ من 1000ms لـ 3000ms لتقليل الضغط
}

export function stopCompletionWatcher() {
  if (completionWatcherInterval) {
    clearInterval(completionWatcherInterval);
    completionWatcherInterval = null;
    lastDoneSnapshot  = null;
    isCompletionRunning = false;
  }
}

// ── Energy watcher ──
let energyWatcherInterval: ReturnType<typeof setInterval> | null = null;

export function startEnergyWatcher() {
  if (energyWatcherInterval) return;

  energyWatcherInterval = setInterval(async () => {
    try {
      const raw = await AsyncStorage.getItem(uk("energy_level"));
      if (!raw) return;
      const current = Number(raw);

      if (lastEnergy !== null && current !== lastEnergy) {
        const lang      = await getLang();
        const isAr      = lang === "ar";
        const todayKey  = getTodayDateKey();
        const diff      = current - lastEnergy;

        const dirAr = diff > 0 ? "ارتفع" : "انخفض";
        const dirEn = diff > 0 ? "increased" : "decreased";
        const emoji = diff > 0 ? "⚡" : "😴";

        await notify(
          {
            title: isAr
              ? `مستوى الطاقة ${dirAr}`
              : `Energy level ${dirEn}`,
            body: isAr
              ? `طاقتك دلوقتي ${current}% (${diff > 0 ? "+" : ""}${diff}%)`
              : `Your energy is now ${current}% (${diff > 0 ? "+" : ""}${diff}%)`,
            emoji,
            type:     "energy",
            dedupKey: `energy_notif_${current}_${todayKey}`,
          },
          "energy"
        );
      }
      lastEnergy = current;
    } catch (e) { console.warn("Energy watcher error:", e); }
  }, 10_000);
}

export function stopEnergyWatcher() {
  if (energyWatcherInterval) { clearInterval(energyWatcherInterval); energyWatcherInterval = null; }
}

// ── End-of-day summary watcher ──
let endOfDayWatcherInterval: ReturnType<typeof setInterval> | null = null;

export function startEndOfDayWatcher() {
  if (endOfDayWatcherInterval) return;

  endOfDayWatcherInterval = setInterval(async () => {
    try {
      const now = new Date();
      const h   = now.getHours();
      const m   = now.getMinutes();
      // Fire between 21:00 and 21:02 (one 2-minute window per day)
      if (h !== 21 || m > 2) return;

      const lang     = await getLang();
      const isAr     = lang === "ar";
      const todayKey = getTodayDateKey();
      const dedupKey = `endofday_summary_${todayKey}`;

      const alreadySent = await AsyncStorage.getItem(uk(dedupKey));
      if (alreadySent) return;

      const planItems = await getTodayPlanItems();
      if (!planItems.length) return;

      const doneRaw = await AsyncStorage.getItem(uk(`plan_done_${todayKey}`));
      const doneIds = new Set<string>(doneRaw ? JSON.parse(doneRaw) : []);

      const total = planItems.length;
      const done  = planItems.filter(item => doneIds.has(item.id)).length;
      const allDone = done === total;

      await AsyncStorage.setItem(uk(dedupKey), "1");

      await sendPushNotification(
        isAr
          ? (allDone ? "يوم رائع! أنجزت كل شيء 🎉" : `ملخص اليوم — ${done}/${total} مهمة`)
          : (allDone ? "Great day! Everything done 🎉" : `Day summary — ${done}/${total} tasks`),
        isAr
          ? (allDone
              ? "أتممت جميع مهام وتمارين اليوم بنجاح! 💪 استمر على هذا المستوى."
              : `أكملت ${done} من ${total} مهمة اليوم. غداً فرصة جديدة! 💙`)
          : (allDone
              ? "You completed all tasks and exercises today! 💪 Keep it up."
              : `You completed ${done} out of ${total} tasks today. Tomorrow is a new chance! 💙`),
        "tasks",
        { type: "summary" },
      );
    } catch (e) { console.warn("End-of-day watcher error:", e); }
  }, 60_000);
}

export function stopEndOfDayWatcher() {
  if (endOfDayWatcherInterval) { clearInterval(endOfDayWatcherInterval); endOfDayWatcherInterval = null; }
}

// ── Exercise watcher (backward compat) ──
let exerciseWatcherInterval: ReturnType<typeof setInterval> | null = null;
export function startExerciseWatcher() { /* covered by taskWatcher */ }
export function stopExerciseWatcher() {
  if (exerciseWatcherInterval) { clearInterval(exerciseWatcherInterval); exerciseWatcherInterval = null; }
}

// ── tasksListWatcher — disabled ──
export function startTasksListWatcher() { /* disabled */ }
export function stopTasksListWatcher()  { /* disabled */ }

// ─── Are watchers running? ────────────────────────────────
export function areWatchersRunning(): boolean {
  return (
    taskWatcherInterval       !== null ||
    completionWatcherInterval !== null ||
    energyWatcherInterval     !== null ||
    missedWatcherInterval     !== null ||
    endOfDayWatcherInterval   !== null
  );
}

// ─── Start / Stop all ────────────────────────────────────
export function startAllWatchers() {
  startTaskWatcher();
  startExerciseWatcher();
  startCompletionWatcher();
  startEnergyWatcher();
  startMissedWatcher();
  startEndOfDayWatcher();
}

export function stopAllWatchers() {
  stopTaskWatcher();
  stopExerciseWatcher();
  stopCompletionWatcher();
  stopEnergyWatcher();
  stopMissedWatcher();
  stopEndOfDayWatcher();
}