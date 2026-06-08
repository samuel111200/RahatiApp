// context/Chatscontext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  collection, doc, addDoc, deleteDoc, updateDoc, query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from './AuthContext';
import type { FSChat } from '../utils/firebaseConfig';
import { subscribeToPresence } from '../utils/presence';

function onFirestoreError(op: string, e: unknown) {
  console.warn(`[Chats] Firestore error in ${op}:`, e);
}

// ─── Types ────────────────────────────────────────────────
export type ChatPreview = {
  patientId: string;
  patientName: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageTimestamp: number;
  lastMessageSender: 'doctor' | 'patient';
  unreadCount: number;
  isOnline: boolean;
  status: 'read' | 'delivered' | 'sent';
};

export type PatientExercise = {
  id: string;
  title: string;
  emoji: string;
  durationMin: number;
  description?: string;
  assignedAt: string;
  completed?: boolean;
};

type ChatsContextType = {
  chats: ChatPreview[];
  markAsRead: (patientId: string) => void;
  sendMessage: (patientId: string, text: string) => void;
  getExercises: (patientId: string) => PatientExercise[];
  assignExercise: (patientId: string, exercise: Omit<PatientExercise, 'id' | 'assignedAt'>) => void;
  removeExercise: (patientId: string, exerciseId: string) => void;
  totalUnread: number;
};

// ─── Context ──────────────────────────────────────────────
const ChatsContext = createContext<ChatsContextType | null>(null);

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [chats,     setChats]     = useState<ChatPreview[]>([]);
  const [exercises, setExercises] = useState<Record<string, PatientExercise[]>>({});
  const presenceSubsRef = useRef<Record<string, () => void>>({});

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  // ─── Real-time chat list subscription ─────────────────
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setChats([]); return; }

    const q = query(collection(db, 'chats'), where('doctorId', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      try {
        const list: ChatPreview[] = snap.docs.map(d => {
          const data = d.data() as FSChat;
          const ts = data.lastMessageTime ?? 0;
          const timeStr = ts
            ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : '';
          return {
            patientId:            data.patientId,
            patientName:          data.patientName ?? 'Patient',
            lastMessage:          data.lastMessage ?? '',
            lastMessageTime:      timeStr,
            lastMessageTimestamp: ts,
            lastMessageSender:    data.lastMessageSender ?? 'doctor',
            unreadCount:          data.unreadCountDoctor ?? 0,
            isOnline:             false,
            status:               'read' as const,
          };
        });
        setChats(list);

        // subscribe to presence for each patient (skip if already subscribed)
        list.forEach(({ patientId }) => {
          if (presenceSubsRef.current[patientId]) return;
          presenceSubsRef.current[patientId] = subscribeToPresence(
            patientId,
            (online) => setChats(prev =>
              prev.map(c => c.patientId === patientId ? { ...c, isOnline: online } : c)
            ),
          );
        });
      } catch (e) {
        console.warn('[Chats] onSnapshot error:', e);
      }
    });
    return () => {
      unsub();
      // clean up all presence subscriptions
      Object.values(presenceSubsRef.current).forEach(fn => fn());
      presenceSubsRef.current = {};
    };
  }, [user?.uid]);

  const markAsRead = useCallback((patientId: string) => {
    const uid = user?.uid;
    if (!uid) return;
    const chatId = `${uid}_${patientId}`;
    updateDoc(doc(db, 'chats', chatId), { unreadCountDoctor: 0 })
      .catch(e => onFirestoreError('markAsRead', e));
  }, [user?.uid]);

  const sendMessage = useCallback((patientId: string, text: string) => {
    const uid = user?.uid;
    if (!uid) return;
    const now    = Date.now();
    const chatId = `${uid}_${patientId}`;
    addDoc(collection(db, 'chats', chatId, 'messages'), {
      text, sender: 'doctor', timestamp: now, status: 'sent', type: 'text',
    }).catch(e => onFirestoreError('sendMessage/addDoc', e));
    updateDoc(doc(db, 'chats', chatId), {
      lastMessage: text, lastMessageTime: now, lastMessageSender: 'doctor',
    }).catch(e => onFirestoreError('sendMessage/updateDoc', e));
  }, [user?.uid]);

  const getExercises = useCallback((patientId: string): PatientExercise[] => {
    return exercises[patientId] ?? [];
  }, [exercises]);

  const assignExercise = useCallback((
    patientId: string,
    exercise: Omit<PatientExercise, 'id' | 'assignedAt'>,
  ) => {
    const uid = user?.uid;
    const newEx: PatientExercise = {
      ...exercise,
      id:         `ex_${Date.now()}`,
      assignedAt: new Date().toISOString(),
    };
    setExercises(prev => ({
      ...prev,
      [patientId]: [...(prev[patientId] ?? []), newEx],
    }));
    if (uid) {
      addDoc(collection(db, 'exercises', patientId, 'items'), {
        ...exercise,
        assignedAt: Date.now(),
        assignedBy: uid,
      }).catch(e => onFirestoreError('assignExercise', e));
    }
  }, [user?.uid]);

  const removeExercise = useCallback((patientId: string, exerciseId: string) => {
    setExercises(prev => ({
      ...prev,
      [patientId]: (prev[patientId] ?? []).filter(e => e.id !== exerciseId),
    }));
    deleteDoc(doc(db, 'exercises', patientId, 'items', exerciseId))
      .catch(e => onFirestoreError('removeExercise', e));
  }, []);

  return (
    <ChatsContext.Provider value={{
      chats, markAsRead, sendMessage, getExercises, assignExercise, removeExercise, totalUnread,
    }}>
      {children}
    </ChatsContext.Provider>
  );
}

export function useChats() {
  const ctx = useContext(ChatsContext);
  if (!ctx) throw new Error('useChats must be used within ChatsProvider');
  return ctx;
}
