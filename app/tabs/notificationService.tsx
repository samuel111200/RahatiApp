// app/tabs/notificationService.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

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

// ─── Lazy import: expo-notifications ─────────────────────
type NotificationsModule = typeof import("expo-notifications");
let _N: NotificationsModule | null = null;

async function N(): Promise<NotificationsModule | null> {
  if (_N) return _N;
  try {
    _N = await import("expo-notifications");
    return _N;
  } catch {
    return null;
  }
}

// ─── Lazy import: expo-task-manager ──────────────────────
let _TM: any = null;
async function TM(): Promise<any | null> {
  if (_TM) return _TM;
  try {
    _TM = await import("expo-task-manager");
    return _TM;
  } catch {
    return null;
  }
}

// ─── Lazy import: expo-background-fetch ──────────────────
let _BF: any = null;
async function BF(): Promise<any | null> {
  if (_BF) return _BF;
  try {
    _BF = await import("expo-background-fetch");
    return _BF;
  } catch {
    return null;
  }
}

// ─── Background Task Name ────────────────────────────────
export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND_TASK_WATCHER";

// ─── Register Background Task ────────────────────────────
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

/** حول وقت عربي (09:00 ص / 03:00 م / أو 24h) لدقائق من منتصف الليل */
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

    // تحويل 12h → 24h
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return { hours, minutes };
  } catch {
    return null;
  }
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
    AsyncStorage.getItem("core_tasks"),
    AsyncStorage.getItem("extra_tasks"),
    AsyncStorage.getItem("core_exercises"),
  ]);

  const coreTasks: any[] = coreRaw ? JSON.parse(coreRaw) : [];
  const extraTasks: any[] = extraRaw ? JSON.parse(extraRaw) : [];
  const exercises: any[] = exRaw ? JSON.parse(exRaw) : [];

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
    const timeFrom = (raw.timeFrom ?? timeParts[0] ?? "").trim();
    const timeTo = (raw.timeTo ?? timeParts[1] ?? "").trim();

    const fromMin = timeToMinutesLocal(timeFrom);
    let toMin = timeToMinutesLocal(timeTo);
    let durMin = 30;
    if (fromMin >= 0 && toMin > fromMin) {
      durMin = toMin - fromMin;
    } else {
      toMin = fromMin >= 0 ? fromMin + durMin : -1;
    }

    result.push({
      id: String(raw.key ?? raw.id ?? `task_${Date.now()}`),
      title: raw.name ?? raw.title ?? raw.key ?? "مهمة",
      emoji: raw.icon ?? raw.emoji ?? "📌",
      timeFrom,
      timeTo,
      timeFromMin: fromMin,
      timeToMin: toMin,
      isExercise: false,
      durationMin: durMin,
    });

    if (exercises.length > 0) {
      const ex = exercises[exerciseIdx % exercises.length];
      const exTimeFrom = timeTo
        ? timeTo
        : fromMin >= 0
        ? addMinutesToTime(timeFrom, durMin)
        : "";
      const exDurMin = ex.durationSeconds
        ? Math.round(ex.durationSeconds / 60)
        : ex.durationMin ?? 5;
      const exTimeTo = exTimeFrom
        ? addMinutesToTime(exTimeFrom, exDurMin)
        : "";
      const exFromMin = timeToMinutesLocal(exTimeFrom);
      const exToMin = timeToMinutesLocal(exTimeTo);
      const stableExId = `exercise_${String(
        ex.key ?? ex.id ?? exerciseIdx
      )}_slot${exerciseIdx}`;

      result.push({
        id: stableExId,
        title: ex.title ?? ex.titleAr ?? "تمرين",
        emoji: ex.emoji ?? "🏋️",
        timeFrom: exTimeFrom,
        timeTo: exTimeTo,
        timeFromMin: exFromMin,
        timeToMin: exToMin,
        isExercise: true,
        durationMin: exDurMin,
      });
      exerciseIdx++;
    }
  }

  return result;
}

// ─── Run watcher cycle (timing notifications) ─────────────
export async function runWatcherCycle() {
  const todayKey = getTodayDateKey();
  const nowMin = nowInMinutes();
  const planItems = await getTodayPlanItems();

  for (const item of planItems) {
    // تجاهل المهام اللي مفيهاش وقت
    if (item.timeFromMin < 0) continue;

    const diffMin = item.timeFromMin - nowMin;

    // 10 دقايق قبل
    if (diffMin > 9 && diffMin <= 11) {
      const key = `notified_10min_${item.id}_${todayKey}`;
      const already = await AsyncStorage.getItem(key);
      if (!already) {
        const label = item.isExercise ? "تمرين" : "مهمة";
        await notify(
          {
            title: `موعد ${label} قريب ⏰`,
            body: `${item.emoji} "${item.title}" هيبدأ بعد 10 دقايق`,
            emoji: "⏰",
            type: item.isExercise ? "break" : "task",
          },
          item.isExercise ? "exercises" : "tasks"
        );
        await AsyncStorage.setItem(key, "1");
      }
    }

    // 5 دقايق قبل
    if (diffMin > 4 && diffMin <= 6) {
      const key = `notified_5min_${item.id}_${todayKey}`;
      const already = await AsyncStorage.getItem(key);
      if (!already) {
        const label = item.isExercise ? "تمرين" : "مهمة";
        await notify(
          {
            title: `${label} قريب${item.isExercise ? "" : "ة"} ⏰`,
            body: `${item.emoji} "${item.title}" هيبدأ بعد 5 دقايق، استعد!`,
            emoji: "⏰",
            type: item.isExercise ? "break" : "task",
          },
          item.isExercise ? "exercises" : "tasks"
        );
        await AsyncStorage.setItem(key, "1");
      }
    }

    // دلوقتي (خلال دقيقة واحدة)
    if (diffMin >= 0 && diffMin <= 1) {
      const key = `notified_now_${item.id}_${todayKey}`;
      const already = await AsyncStorage.getItem(key);
      if (!already) {
        await notify(
          {
            title: `وقت ${item.isExercise ? "التمرين" : "المهمة"} دلوقتي! 🚀`,
            body: `${item.emoji} ابدأ "${item.title}" دلوقتي`,
            emoji: "🚀",
            type: item.isExercise ? "break" : "task",
          },
          item.isExercise ? "exercises" : "tasks"
        );
        await AsyncStorage.setItem(key, "1");
      }
    }
  }
}

// ─── Setup Notifications ─────────────────────────────────
export async function setupNotifications() {
  const mod = await N();
  if (!mod) return;

  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === "web") return;

  try {
    if (Platform.OS === "android") {
      const channels = [
        {
          id: "tasks",
          name: "تنبيهات المهام",
          importance: mod.AndroidImportance.HIGH,
          lightColor: "#7C5CBF",
          vibrationPattern: [0, 250, 150, 250] as number[],
        },
        {
          id: "exercises",
          name: "تنبيهات التمارين",
          importance: mod.AndroidImportance.HIGH,
          lightColor: "#4CAF82",
          vibrationPattern: [0, 300, 100, 300, 100, 300] as number[],
        },
        {
          id: "completion",
          name: "إشعارات الإنجاز",
          importance: mod.AndroidImportance.HIGH,
          lightColor: "#4CAF82",
          vibrationPattern: [0, 100, 50, 100, 50, 200] as number[],
        },
        {
          id: "energy",
          name: "تنبيهات الطاقة",
          importance: mod.AndroidImportance.DEFAULT,
          lightColor: "#F5A623",
          vibrationPattern: [0, 200] as number[],
        },
        {
          id: "missed",
          name: "مهام وتمارين فاتتك",
          importance: mod.AndroidImportance.HIGH,
          lightColor: "#E05C5C",
          vibrationPattern: [0, 400, 200, 400] as number[],
        },
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

// ─── Register Background Fetch ────────────────────────────
async function registerBackgroundFetch() {
  const bf = await BF();
  const tm = await TM();
  if (!bf || !tm) return;
  try {
    const isRegistered = await bf.getStatusAsync();
    if (
      isRegistered === bf.BackgroundFetchStatus.Restricted ||
      isRegistered === bf.BackgroundFetchStatus.Denied
    )
      return;
    const tasks = await tm.getRegisteredTasksAsync();
    const alreadyRegistered = tasks.some(
      (t: { taskName: string }) =>
        t.taskName === BACKGROUND_NOTIFICATION_TASK
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

// ─── Save in-app notification ─────────────────────────────
export async function saveInAppNotification(
  notif: Omit<AppNotification, "id" | "timestamp" | "read">
) {
  const raw = await AsyncStorage.getItem("app_notifications");
  const list: AppNotification[] = raw ? JSON.parse(raw) : [];
  const newNotif: AppNotification = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    read: false,
  };
  const updated = [newNotif, ...list].slice(0, 50);
  await AsyncStorage.setItem("app_notifications", JSON.stringify(updated));
  return newNotif;
}

// ─── Send local push notification ────────────────────────
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
          icon: "ic_notification",
          largeIcon: "ic_launcher",
          color: "#7C5CBF",
          channelId,
        }),
        sound:
          Platform.OS === "ios" ? "notification_sound.wav" : undefined,
        data: { channelId, ...data },
        badge: 1,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("Push notification error:", e);
  }
}

// ─── Main notify function ─────────────────────────────────
export async function notify(
  params: Omit<AppNotification, "id" | "timestamp" | "read">,
  channelId: string = "tasks"
) {
  await saveInAppNotification(params);
  await sendPushNotification(
    `${params.emoji} ${params.title}`,
    params.body,
    channelId,
    { type: params.type }
  );
}

// ─── Notify task/exercise completion ─────────────────────
export async function notifyTaskCompleted(
  taskName: string,
  taskEmoji: string = "📌"
) {
  await notify(
    {
      title: "أحسنت! مهمة منجزة 🎉",
      body: `لقد أتممت "${taskEmoji} ${taskName}" بنجاح! استمر في التقدم 💪`,
      emoji: "🎉",
      type: "task",
    },
    "completion"
  );
}

export async function notifyExerciseCompleted(
  exerciseName: string,
  exerciseEmoji: string = "🏋️"
) {
  await notify(
    {
      title: "تمرين ناجح! 💪",
      body: `أنجزت "${exerciseEmoji} ${exerciseName}" بنجاح! جسمك بيشكرك 🌟`,
      emoji: "💪",
      type: "break",
    },
    "completion"
  );
}

// ─── Mark all as read ─────────────────────────────────────
export async function markAllRead() {
  const raw = await AsyncStorage.getItem("app_notifications");
  if (!raw) return;
  const list: AppNotification[] = JSON.parse(raw);
  const updated = list.map((n) => ({ ...n, read: true }));
  await AsyncStorage.setItem("app_notifications", JSON.stringify(updated));
}

// ─── Clear all ───────────────────────────────────────────
export async function clearAllNotifications() {
  await AsyncStorage.setItem("app_notifications", JSON.stringify([]));
}

// ─── Get unread count ─────────────────────────────────────
export async function getUnreadCount(): Promise<number> {
  const raw = await AsyncStorage.getItem("app_notifications");
  if (!raw) return 0;
  const list: AppNotification[] = JSON.parse(raw);
  return list.filter((n) => !n.read).length;
}

// ─── Guard: منع إرسال إشعار تغيير المهام أثناء الإنجاز ──
let _suppressTaskListNotif = false;
export function suppressTaskListNotifOnce() {
  _suppressTaskListNotif = true;
  setTimeout(() => {
    _suppressTaskListNotif = false;
  }, 8000);
}

// ════════════════════════════════════════════════════════════
// ─── Foreground Watchers ─────────────────────────────────
// ════════════════════════════════════════════════════════════

// ── Task/Exercise timing watcher ──
let taskWatcherInterval: ReturnType<typeof setInterval> | null = null;

export function startTaskWatcher() {
  if (taskWatcherInterval) return;
  taskWatcherInterval = setInterval(async () => {
    try {
      await runWatcherCycle();
    } catch (e) {
      console.warn("Task watcher error:", e);
    }
  }, 30000); // كل 30 ثانية
}

export function stopTaskWatcher() {
  if (taskWatcherInterval) {
    clearInterval(taskWatcherInterval);
    taskWatcherInterval = null;
  }
}

// ── Missed items watcher ──
let missedWatcherInterval: ReturnType<typeof setInterval> | null = null;

export function startMissedWatcher() {
  if (missedWatcherInterval) return;

  missedWatcherInterval = setInterval(async () => {
    try {
      const todayKey = getTodayDateKey();
      const nowMin = nowInMinutes();

      const doneRaw = await AsyncStorage.getItem(`plan_done_${todayKey}`);
      const doneIds = new Set<string>(doneRaw ? JSON.parse(doneRaw) : []);
      const planItems = await getTodayPlanItems();

      for (const item of planItems) {
        // تجاهل لو مفيش وقت أو لو منجزة
        if (item.timeFromMin < 0) continue;
        if (doneIds.has(item.id)) continue;

        // تجاهل لو المهمة لسه مجيتش
        if (nowMin <= item.timeToMin) continue;

        const missedKey = `notified_missed_${item.id}_${todayKey}`;
        if (await AsyncStorage.getItem(missedKey)) continue;

        const label = item.isExercise ? "تمرين" : "مهمة";
        await notify(
          {
            title: `${label} فاتتك! 😔`,
            body: `${item.emoji} "${item.title}" فاتت ومعلمتهاش كمنجزة`,
            emoji: "😔",
            type: item.isExercise ? "break" : "task",
          },
          "missed"
        );
        await AsyncStorage.setItem(missedKey, "1");
      }
    } catch (e) {
      console.warn("Missed watcher error:", e);
    }
  }, 60000);
}

export function stopMissedWatcher() {
  if (missedWatcherInterval) {
    clearInterval(missedWatcherInterval);
    missedWatcherInterval = null;
  }
}

// ── Exercise watcher (backward compat) ──
let exerciseWatcherInterval: ReturnType<typeof setInterval> | null = null;
export function startExerciseWatcher() {
  /* covered by taskWatcher */
}
export function stopExerciseWatcher() {
  if (exerciseWatcherInterval) {
    clearInterval(exerciseWatcherInterval);
    exerciseWatcherInterval = null;
  }
}

// ── Completion watcher ──
let completionWatcherInterval: ReturnType<typeof setInterval> | null = null;
let lastDoneSnapshot: string = "";

export function startCompletionWatcher() {
  if (completionWatcherInterval) return;

  completionWatcherInterval = setInterval(async () => {
    try {
      const todayKey = getTodayDateKey();
      const planDoneRaw = await AsyncStorage.getItem(`plan_done_${todayKey}`);
      if (!planDoneRaw) return;

      const doneIds: string[] = JSON.parse(planDoneRaw);
      const currentSnapshot = [...doneIds].sort().join(",");
      if (lastDoneSnapshot === currentSnapshot) return;

      const prevIds = new Set(
        lastDoneSnapshot ? lastDoneSnapshot.split(",").filter(Boolean) : []
      );
      const newlyDone = doneIds.filter((id) => id && !prevIds.has(id));
      lastDoneSnapshot = currentSnapshot;
      if (newlyDone.length === 0) return;

      const [coreRaw, extraRaw, exRaw] = await Promise.all([
        AsyncStorage.getItem("core_tasks"),
        AsyncStorage.getItem("extra_tasks"),
        AsyncStorage.getItem("core_exercises"),
      ]);

      const coreTasks: any[] = coreRaw ? JSON.parse(coreRaw) : [];
      const extraTasks: any[] = extraRaw ? JSON.parse(extraRaw) : [];
      const exercises: any[] = exRaw ? JSON.parse(exRaw) : [];

      for (const id of newlyDone) {
        if (!id) continue;

        if (id.startsWith("exercise_")) {
          const withoutPrefix = id.replace("exercise_", "");
          const slotIdx = withoutPrefix.lastIndexOf("_slot");
          const exKey =
            slotIdx >= 0
              ? withoutPrefix.substring(0, slotIdx)
              : withoutPrefix;
          const idx =
            slotIdx >= 0
              ? parseInt(withoutPrefix.substring(slotIdx + 5), 10)
              : 0;

          const ex =
            exercises.find(
              (e: any) => String(e.key ?? e.id ?? e.title) === exKey
            ) ?? exercises[idx % Math.max(exercises.length, 1)];

          const sentKey = `completion_notif_${id}_${todayKey}`;
          if (!(await AsyncStorage.getItem(sentKey))) {
            suppressTaskListNotifOnce();
            await notifyExerciseCompleted(
              ex?.title ?? ex?.titleAr ?? "التمرين",
              ex?.emoji ?? "🏋️"
            );
            await AsyncStorage.setItem(sentKey, "1");
          }
          continue;
        }

        const task = [...coreTasks, ...extraTasks].find(
          (t: any) => (t.key ?? t.id) === id
        );
        if (!task) continue;

        const sentKey = `completion_notif_${id}_${todayKey}`;
        if (!(await AsyncStorage.getItem(sentKey))) {
          await notifyTaskCompleted(
            task.title ?? task.name ?? "المهمة",
            task.emoji ?? task.icon ?? "📌"
          );
          await AsyncStorage.setItem(sentKey, "1");
        }
      }
    } catch (e) {
      console.warn("Completion watcher error:", e);
    }
  }, 5000);
}

export function stopCompletionWatcher() {
  if (completionWatcherInterval) {
    clearInterval(completionWatcherInterval);
    completionWatcherInterval = null;
  }
}

// ── Energy watcher ──
let lastEnergy: number | null = null;
let energyWatcherInterval: ReturnType<typeof setInterval> | null = null;
// منع إشعارات الطاقة المتكررة (cooldown 5 دقايق)
let lastEnergyNotifTime: number = 0;
const ENERGY_NOTIF_COOLDOWN_MS = 5 * 60 * 1000;

export function startEnergyWatcher() {
  if (energyWatcherInterval) return;

  energyWatcherInterval = setInterval(async () => {
    try {
      const raw = await AsyncStorage.getItem("energy_level");
      if (!raw) return;
      const current = Number(raw);

      if (lastEnergy !== null && current !== lastEnergy) {
        const now = Date.now();
        if (now - lastEnergyNotifTime >= ENERGY_NOTIF_COOLDOWN_MS) {
          const diff = current - lastEnergy;
          const direction = diff > 0 ? "ارتفع" : "انخفض";
          const emoji = diff > 0 ? "⚡" : "😴";
          await notify(
            {
              title: `مستوى الطاقة ${direction}`,
              body: `طاقتك دلوقتي ${current}% (${diff > 0 ? "+" : ""}${diff}%)`,
              emoji,
              type: "energy",
            },
            "energy"
          );
          lastEnergyNotifTime = now;
        }
      }
      lastEnergy = current;
    } catch (e) {
      console.warn("Energy watcher error:", e);
    }
  }, 10000);
}

export function stopEnergyWatcher() {
  if (energyWatcherInterval) {
    clearInterval(energyWatcherInterval);
    energyWatcherInterval = null;
  }
}

// ── Tasks list watcher ──
let lastTasksHash: string | null = null;
let lastTaskKeys: Set<string> = new Set();
let tasksListWatcherInterval: ReturnType<typeof setInterval> | null = null;

export function startTasksListWatcher() {
  if (tasksListWatcherInterval) return;

  tasksListWatcherInterval = setInterval(async () => {
    try {
      const [coreRaw, extraRaw] = await Promise.all([
        AsyncStorage.getItem("core_tasks"),
        AsyncStorage.getItem("extra_tasks"),
      ]);

      const coreTasks: any[] = coreRaw ? JSON.parse(coreRaw) : [];
      const extraTasks: any[] = extraRaw ? JSON.parse(extraRaw) : [];
      const allTasks = [...coreTasks, ...extraTasks];

      const currentHash = `${allTasks.length}_${allTasks
        .map(
          (t) =>
            `${t.id ?? t.key}:${t.title ?? t.name}:${t.timeFrom ?? ""}:${t.timeTo ?? ""}`
        )
        .join(",")}`;

      const currentKeys = new Set<string>(
        allTasks.map((t) => String(t.id ?? t.key))
      );

      if (lastTasksHash !== null && currentHash !== lastTasksHash) {
        if (!_suppressTaskListNotif) {
          const addedKeys = [...currentKeys].filter(
            (k) => !lastTaskKeys.has(k)
          );
          const removedKeys = [...lastTaskKeys].filter(
            (k) => !currentKeys.has(k)
          );

          if (addedKeys.length > 0) {
            const newTask = allTasks.find((t) =>
              addedKeys.includes(String(t.id ?? t.key))
            );
            await notify(
              {
                title: "تمت إضافة مهمة جديدة ✅",
                body: newTask
                  ? `"${newTask.title ?? newTask.name}" اتضافت للخطة`
                  : `تمت إضافة ${addedKeys.length} مهمة للخطة`,
                emoji: "✅",
                type: "add",
              },
              "tasks"
            );
          }

          if (removedKeys.length > 0) {
            await notify(
              {
                title: "تم حذف مهمة 🗑️",
                body: `اتحذفت ${removedKeys.length} مهمة من الخطة`,
                emoji: "🗑️",
                type: "delete",
              },
              "tasks"
            );
          }
        }
      }

      lastTasksHash = currentHash;
      lastTaskKeys = currentKeys;
    } catch (e) {
      console.warn("Tasks list watcher error:", e);
    }
  }, 5000);
}

export function stopTasksListWatcher() {
  if (tasksListWatcherInterval) {
    clearInterval(tasksListWatcherInterval);
    tasksListWatcherInterval = null;
  }
}

// ─── Are watchers running? ────────────────────────────────
export function areWatchersRunning(): boolean {
  return (
    taskWatcherInterval !== null ||
    exerciseWatcherInterval !== null ||
    completionWatcherInterval !== null ||
    energyWatcherInterval !== null ||
    tasksListWatcherInterval !== null ||
    missedWatcherInterval !== null
  );
}

// ─── Start / Stop all watchers ───────────────────────────
export function startAllWatchers() {
  startTaskWatcher();
  startExerciseWatcher();
  startCompletionWatcher();
  startEnergyWatcher();
  startTasksListWatcher();
  startMissedWatcher();
}

export function stopAllWatchers() {
  stopTaskWatcher();
  stopExerciseWatcher();
  stopCompletionWatcher();
  stopEnergyWatcher();
  stopTasksListWatcher();
  stopMissedWatcher();
}