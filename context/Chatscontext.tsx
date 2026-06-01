// context/Chatscontext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  collection, doc, addDoc, deleteDoc, updateDoc, query, where, getDocs,
} from 'firebase/firestore';
import { Alert } from 'react-native';
import { auth, db } from '../utils/firebaseConfig';
import { saveInAppNotification } from '../app/tabs/notificationService';

function onFirestoreError(op: string, e: unknown) {
  console.warn(`[Chats] Firestore error in ${op}:`, e);
}

// ─── Types ────────────────────────────────────────────────
export type ChatPreview = {
  patientId: string;
  patientName: string;
  lastMessage: string;
  lastMessageTime: string;
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
  const [chats,    setChats]    = useState<ChatPreview[]>([]);
  const [exercises, setExercises] = useState<Record<string, PatientExercise[]>>({});

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  const doctorId = () => auth.currentUser?.uid ?? '';

  const markAsRead = useCallback((patientId: string) => {
    const uid = doctorId();
    if (uid) {
      const chatId = `${uid}_${patientId}`;
      updateDoc(doc(db, 'chats', chatId), { unreadCountDoctor: 0 }).catch(e => onFirestoreError('markAsRead', e));
    }
    setChats(prev =>
      prev.map(c =>
        c.patientId === patientId
          ? { ...c, unreadCount: 0, status: 'read' as const }
          : c,
      ),
    );
  }, []);

  const sendMessage = useCallback((patientId: string, text: string) => {
    const uid  = doctorId();
    const now  = Date.now();
    const timeStr = new Date(now).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    if (uid) {
      const chatId = `${uid}_${patientId}`;
      addDoc(collection(db, 'chats', chatId, 'messages'), {
        text, sender: 'doctor', timestamp: now, status: 'sent', type: 'text',
      }).catch(e => onFirestoreError('sendMessage/addDoc', e));
      updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text, lastMessageTime: now, lastMessageSender: 'doctor',
      }).catch(e => onFirestoreError('sendMessage/updateDoc', e));
    }

    setChats(prev =>
      prev.map(c =>
        c.patientId === patientId
          ? { ...c, lastMessage: text, lastMessageTime: timeStr, lastMessageSender: 'doctor', status: 'sent' as const }
          : c,
      ),
    );

    saveInAppNotification({
      title: 'رسالة مُرسَلة ✅',
      body: `أرسلت رسالة: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`,
      emoji: '💬',
      type: 'update',
    }).catch(() => {});
  }, []);

  const getExercises = useCallback((patientId: string): PatientExercise[] => {
    return exercises[patientId] ?? [];
  }, [exercises]);

  const assignExercise = useCallback((
    patientId: string,
    exercise: Omit<PatientExercise, 'id' | 'assignedAt'>,
  ) => {
    const uid  = doctorId();
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

    saveInAppNotification({
      title: `تمرين مُضاف 🏋️`,
      body: `تم تعيين "${exercise.emoji} ${exercise.title}" للمريض`,
      emoji: '🏋️',
      type: 'add',
    }).catch(() => {});
  }, []);

  const removeExercise = useCallback((patientId: string, exerciseId: string) => {
    setExercises(prev => ({
      ...prev,
      [patientId]: (prev[patientId] ?? []).filter(e => e.id !== exerciseId),
    }));
    deleteDoc(doc(db, 'exercises', patientId, 'items', exerciseId)).catch(e => onFirestoreError('removeExercise', e));
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
