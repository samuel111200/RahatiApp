// context/Chatscontext.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Full Firestore replacement for the old AsyncStorage + in-memory mock.
//
// KEY DESIGN DECISIONS
// ─────────────────────────────────────────────────────────────────────────────
// 1. ChatPreview list is built by a single onSnapshot on
//    `relationships` where doctorId == currentUser.uid AND status == 'accepted'.
//    Each relationship doc also acts as the chatId.
//
// 2. Exercise CRUD operates directly on
//    `users/{patientId}/exercises/{exerciseId}` so the patient gets real-time
//    updates the moment a doctor assigns or removes a programme item.
//
// 3. The public ChatsContextType interface is 100% backward-compatible:
//    every method name and parameter list is preserved exactly.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  getDoc,
} from 'firebase/firestore';

import { db, relId, FSRelationship, FSPatientExercise } from '../utils/firebaseConfig';
import { useAuth } from './AuthContext';
import { saveInAppNotification } from '../app/tabs/notificationService';

// ─────────────────────────────────────────────────────────────────────────────
// Public types (surface unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export type ChatPreview = {
  patientId:         string;
  patientName:       string;
  lastMessage:       string;
  lastMessageTime:   string;
  lastMessageSender: 'doctor' | 'patient';
  unreadCount:       number;
  isOnline:          boolean;
  status:            'read' | 'delivered' | 'sent';
  // Extra field exposed for Docpatient / Dochome
  exerciseAccess:    'locked' | 'granted';
  relationshipId:    string;
};

export type PatientExercise = {
  id:          string;
  title:       string;
  emoji:       string;
  durationMin: number;
  description?: string;
  assignedAt:  string;         // ISO string for display compatibility
  completed?:  boolean;
};

type ChatsContextType = {
  chats:          ChatPreview[];
  markAsRead:     (patientId: string) => void;
  sendMessage:    (patientId: string, text: string) => void;
  getExercises:   (patientId: string) => PatientExercise[];
  assignExercise: (
      patientId: string,
      exercise:  Omit<PatientExercise, 'id' | 'assignedAt'>,
  ) => void;
  removeExercise: (patientId: string, exerciseId: string) => void;
  totalUnread:    number;
  // Exposed so Docpatient can subscribe to a patient's exercise list reactively
  subscribeToExercises: (
      patientId: string,
      cb: (exercises: PatientExercise[]) => void,
  ) => () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function tsToDisplayTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  return ts.toDate().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fsExToLocal(id: string, data: any): PatientExercise {
  return {
    id,
    title:       data.title       ?? '',
    emoji:       data.emoji       ?? '🏋️',
    durationMin: data.durationMin ?? 0,
    description: data.description,
    assignedAt:  data.assignedAt instanceof Timestamp
        ? data.assignedAt.toDate().toISOString()
        : (data.assignedAt ?? new Date().toISOString()),
    completed:   data.completed   ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const ChatsContext = createContext<ChatsContextType | null>(null);

export function ChatsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [chats,     setChats]     = useState<ChatPreview[]>([]);
  // Local exercise cache: { [patientId]: PatientExercise[] }
  const [exercises, setExercises] = useState<Record<string, PatientExercise[]>>({});

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  // Keep track of active exercise subscriptions so we can clean them up
  const exSubsRef = useRef<Record<string, () => void>>({});

  // ── Main real-time subscription: relationships + chat previews ─────────────
  useEffect(() => {
    if (!user?.uid || user.role !== 'doctor') return;

    // Listen to all accepted relationships where this doctor is the owner
    const relsQ = query(
        collection(db, 'relationships'),
        where('doctorId', '==', user.uid),
        where('status',   '==', 'accepted'),
    );

    const unsubRels = onSnapshot(relsQ, async (snap) => {
      try {
        const previews: ChatPreview[] = [];

        for (const relSnap of snap.docs) {
          const rel = relSnap.data() as FSRelationship;

          // Fetch patient display name (first+last) from users collection
          let patientName = rel.patientId;
          try {
            const pSnap = await getDoc(doc(db, 'users', rel.patientId));
            if (pSnap.exists()) {
              const pd = pSnap.data();
              patientName = `${pd.firstName ?? ''} ${pd.lastName ?? ''}`.trim();
            }
          } catch {}

          // Fetch the latest chat preview from the chat doc
          let lastMessage      = '';
          let lastMessageTime  = '';
          let lastSender: 'doctor' | 'patient' = 'patient';

          try {
            const chatSnap = await getDoc(doc(db, 'chats', rel.relationshipId));
            if (chatSnap.exists()) {
              const cd = chatSnap.data();
              lastMessage     = cd.lastMessage     ?? '';
              lastMessageTime = cd.lastMessageTime instanceof Timestamp
                  ? tsToDisplayTime(cd.lastMessageTime)
                  : (cd.lastMessageTime ?? '');
              lastSender      = cd.lastMessageSender ?? 'patient';
            }
          } catch {}

          previews.push({
            patientId:         rel.patientId,
            patientName,
            lastMessage,
            lastMessageTime,
            lastMessageSender: lastSender,
            unreadCount:       0,   // managed locally / per-screen
            isOnline:          false,
            status:            'delivered',
            exerciseAccess:    rel.exerciseAccess ?? 'locked',
            relationshipId:    rel.relationshipId,
          });
        }

        setChats(previews);
      } catch (err) {
        console.warn('[ChatsContext.doctor onSnapshot]', err);
      }
    });

    return () => unsubRels();
  }, [user?.uid, user?.role]);

  // ── Also allow PATIENT-side to see their own chats ─────────────────────────
  useEffect(() => {
    if (!user?.uid || user.role !== 'patient') return;

    const relsQ = query(
        collection(db, 'relationships'),
        where('patientId', '==', user.uid),
        where('status',    '==', 'accepted'),
    );

    const unsub = onSnapshot(relsQ, async (snap) => {
      try {
        const previews: ChatPreview[] = [];

        for (const relSnap of snap.docs) {
          const rel = relSnap.data() as FSRelationship;

          let doctorName = rel.doctorId;
          try {
            const dSnap = await getDoc(doc(db, 'users', rel.doctorId));
            if (dSnap.exists()) {
              const dd = dSnap.data();
              doctorName = `${dd.firstName ?? ''} ${dd.lastName ?? ''}`.trim();
            }
          } catch {}

          let lastMessage     = '';
          let lastMessageTime = '';
          let lastSender: 'doctor' | 'patient' = 'doctor';

          try {
            const chatSnap = await getDoc(doc(db, 'chats', rel.relationshipId));
            if (chatSnap.exists()) {
              const cd = chatSnap.data();
              lastMessage     = cd.lastMessage ?? '';
              lastMessageTime = cd.lastMessageTime instanceof Timestamp
                  ? tsToDisplayTime(cd.lastMessageTime)
                  : (cd.lastMessageTime ?? '');
              lastSender      = cd.lastMessageSender ?? 'doctor';
            }
          } catch {}

          previews.push({
            patientId:         rel.patientId,
            patientName:       doctorName,   // from patient's PoV, this is the doctor
            lastMessage,
            lastMessageTime,
            lastMessageSender: lastSender,
            unreadCount:       0,
            isOnline:          false,
            status:            'delivered',
            exerciseAccess:    rel.exerciseAccess ?? 'locked',
            relationshipId:    rel.relationshipId,
          });
        }

        setChats(previews);
      } catch (err) {
        console.warn('[ChatsContext.patient onSnapshot]', err);
      }
    });

    return () => unsub();
  }, [user?.uid, user?.role]);

  // ── markAsRead ─────────────────────────────────────────────────────────────
  const markAsRead = useCallback((patientId: string) => {
    setChats(prev =>
        prev.map(c =>
            c.patientId === patientId
                ? { ...c, unreadCount: 0, status: 'read' as const }
                : c,
        ),
    );
  }, []);

  // ── sendMessage (updates chat doc preview + writes message subcollection) ──
  const sendMessage = useCallback(
      async (patientId: string, text: string) => {
        if (!user?.uid) return;

        // relId(doctorId, patientId) — when patient sends, patientId param is actually the doctorId
        const chatId   = user.role === 'doctor'
            ? relId(user.uid, patientId)
            : relId(patientId, user.uid);
        const sender   = user.role as 'doctor' | 'patient';
        const timeStr  = new Date().toLocaleTimeString('ar-EG', {
          hour:   '2-digit',
          minute: '2-digit',
        });

        try {
          // Write message document
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            text,
            sender,
            time:         timeStr,
            timestamp:    serverTimestamp(),
            type:         'text',
            accessStatus: null,
          });

          // Update chat preview doc
          await setDoc(
              doc(db, 'chats', chatId),
              {
                chatId,
                participants:      [user.uid, patientId],
                lastMessage:       text,
                lastMessageTime:   serverTimestamp(),
                lastMessageSender: sender,
              },
              { merge: true },
          );

          // Local optimistic update for immediate UI feedback
          const now = new Date().toLocaleTimeString('ar-EG', {
            hour: '2-digit', minute: '2-digit',
          });
          setChats(prev =>
              prev.map(c =>
                  c.patientId === patientId
                      ? { ...c, lastMessage: text, lastMessageTime: now, lastMessageSender: sender, status: 'sent' }
                      : c,
              ),
          );

          // In-app notification
          await saveInAppNotification({
            title: 'رسالة مُرسَلة ✅',
            body:  `أرسلت رسالة: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`,
            emoji: '💬',
            type:  'update',
          }).catch(() => {});
        } catch (err) {
          console.warn('[ChatsContext.sendMessage]', err);
        }
      },
      [user],
  );

  // ── getExercises (synchronous cache read) ─────────────────────────────────
  const getExercises = useCallback(
      (patientId: string): PatientExercise[] => exercises[patientId] ?? [],
      [exercises],
  );

  // ── subscribeToExercises (reactive) ───────────────────────────────────────
  const subscribeToExercises = useCallback(
      (patientId: string, cb: (exercises: PatientExercise[]) => void) => {
        const exCol = collection(db, 'users', patientId, 'exercises');
        const q     = query(exCol, orderBy('assignedAt', 'asc'));

        const unsub = onSnapshot(q, (snap) => {
          const list: PatientExercise[] = snap.docs.map(d =>
              fsExToLocal(d.id, d.data()),
          );
          cb(list);
          setExercises(prev => ({ ...prev, [patientId]: list }));
        });

        return unsub;
      },
      [],
  );

  // ── assignExercise ────────────────────────────────────────────────────────
  const assignExercise = useCallback(
      async (
          patientId: string,
          exercise:  Omit<PatientExercise, 'id' | 'assignedAt'>,
      ) => {
        try {
          const exRef = await addDoc(
              collection(db, 'users', patientId, 'exercises'),
              {
                ...exercise,
                assignedAt: serverTimestamp(),
                completed:  false,
              },
          );

          // Optimistic local update
          const newEx: PatientExercise = {
            ...exercise,
            id:         exRef.id,
            assignedAt: new Date().toISOString(),
            completed:  false,
          };
          setExercises(prev => ({
            ...prev,
            [patientId]: [...(prev[patientId] ?? []), newEx],
          }));

          // In-app notification for doctor
          await saveInAppNotification({
            title: `تمرين مُضاف 🏋️`,
            body:  `تم تعيين "${exercise.emoji} ${exercise.title}" للمريض`,
            emoji: '🏋️',
            type:  'add',
          }).catch(() => {});
        } catch (err) {
          console.warn('[ChatsContext.assignExercise]', err);
        }
      },
      [],
  );

  // ── removeExercise ────────────────────────────────────────────────────────
  const removeExercise = useCallback(
      async (patientId: string, exerciseId: string) => {
        try {
          await deleteDoc(doc(db, 'users', patientId, 'exercises', exerciseId));

          setExercises(prev => ({
            ...prev,
            [patientId]: (prev[patientId] ?? []).filter(e => e.id !== exerciseId),
          }));
        } catch (err) {
          console.warn('[ChatsContext.removeExercise]', err);
        }
      },
      [],
  );

  // ── Cleanup exercise subscriptions on unmount ─────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(exSubsRef.current).forEach(unsub => unsub());
    };
  }, []);

  return (
      <ChatsContext.Provider
          value={{
            chats,
            markAsRead,
            sendMessage,
            getExercises,
            assignExercise,
            removeExercise,
            totalUnread,
            subscribeToExercises,
          }}
      >
        {children}
      </ChatsContext.Provider>
  );
}

export function useChats() {
  const ctx = useContext(ChatsContext);
  if (!ctx) throw new Error('useChats must be used within ChatsProvider');
  return ctx;
}