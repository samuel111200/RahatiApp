// context/Chatscontext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveInAppNotification } from '../app/tabs/notificationService';

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

// ─── Initial Chat Data ────────────────────────────────────
const INITIAL_CHATS: ChatPreview[] = [
  {
    patientId: 'p1',
    patientName: 'أحمد محمد علي',
    lastMessage: 'حسناً، ده غالباً من الجلوس الطويل. حاول تمشي كل ساعة',
    lastMessageTime: '10:26 ص',
    lastMessageSender: 'doctor',
    unreadCount: 0,
    isOnline: true,
    status: 'read',
  },
  {
    patientId: 'p2',
    patientName: 'فاطمة حسن إبراهيم',
    lastMessage: 'عندي ألم في الرأس من الصباح وما قدرت أنام',
    lastMessageTime: 'أمس',
    lastMessageSender: 'patient',
    unreadCount: 3,
    isOnline: false,
    status: 'delivered',
  },
  {
    patientId: 'p3',
    patientName: 'محمود عبد الله',
    lastMessage: 'تمام يا دكتور، هاخد الدواء زي ما قلت',
    lastMessageTime: 'الثلاثاء',
    lastMessageSender: 'patient',
    unreadCount: 0,
    isOnline: false,
    status: 'read',
  },
  {
    patientId: 'p4',
    patientName: 'نورا سعيد',
    lastMessage: 'هل لازم أجي للعيادة ولا ممكن يكون عن بُعد؟',
    lastMessageTime: 'الاثنين',
    lastMessageSender: 'patient',
    unreadCount: 1,
    isOnline: true,
    status: 'delivered',
  },
  {
    patientId: 'p5',
    patientName: 'خالد إبراهيم مصطفى',
    lastMessage: 'شكراً جزيلاً دكتور، ربنا يسلمك',
    lastMessageTime: '12/5',
    lastMessageSender: 'patient',
    unreadCount: 0,
    isOnline: false,
    status: 'read',
  },
];

// ─── Initial Exercises per patient ───────────────────────
const INITIAL_EXERCISES: Record<string, PatientExercise[]> = {
  p1: [
    { id: 'e1', title: 'مشي خفيف', emoji: '🚶', durationMin: 10, description: 'مشي بطيء كل ساعة', assignedAt: new Date().toISOString() },
    { id: 'e2', title: 'تمدد الظهر', emoji: '🧘', durationMin: 5, description: 'تمارين إطالة لعضلات الظهر', assignedAt: new Date().toISOString() },
  ],
  p2: [
    { id: 'e3', title: 'تنفس عميق', emoji: '💨', durationMin: 5, description: 'تمارين تنفس لتخفيف الصداع', assignedAt: new Date().toISOString() },
  ],
  p3: [],
  p4: [
    { id: 'e4', title: 'إطالة الرقبة', emoji: '🏋️', durationMin: 7, description: 'تمارين لتخفيف توتر الرقبة', assignedAt: new Date().toISOString() },
  ],
  p5: [],
};

// ─── Context ──────────────────────────────────────────────
const ChatsContext = createContext<ChatsContextType | null>(null);

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<ChatPreview[]>(INITIAL_CHATS);
  const [exercises, setExercises] = useState<Record<string, PatientExercise[]>>(INITIAL_EXERCISES);

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  const markAsRead = useCallback((patientId: string) => {
    setChats(prev =>
      prev.map(c =>
        c.patientId === patientId
          ? { ...c, unreadCount: 0, status: 'read' as const }
          : c
      )
    );
  }, []);

  const sendMessage = useCallback((patientId: string, text: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setChats(prev =>
      prev.map(c =>
        c.patientId === patientId
          ? {
              ...c,
              lastMessage: text,
              lastMessageTime: timeStr,
              lastMessageSender: 'doctor',
              status: 'sent' as const,
            }
          : c
      )
    );
    // Save notification for sent message
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

  const assignExercise = useCallback((patientId: string, exercise: Omit<PatientExercise, 'id' | 'assignedAt'>) => {
    const newEx: PatientExercise = {
      ...exercise,
      id: `ex_${Date.now()}`,
      assignedAt: new Date().toISOString(),
    };
    setExercises(prev => ({
      ...prev,
      [patientId]: [...(prev[patientId] ?? []), newEx],
    }));
    // Persist to AsyncStorage
    AsyncStorage.getItem('doc_patient_exercises').then(raw => {
      const all = raw ? JSON.parse(raw) : {};
      all[patientId] = [...(all[patientId] ?? []), newEx];
      AsyncStorage.setItem('doc_patient_exercises', JSON.stringify(all));
    }).catch(() => {});
    // Notification
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
    AsyncStorage.getItem('doc_patient_exercises').then(raw => {
      const all = raw ? JSON.parse(raw) : {};
      all[patientId] = (all[patientId] ?? []).filter((e: PatientExercise) => e.id !== exerciseId);
      AsyncStorage.setItem('doc_patient_exercises', JSON.stringify(all));
    }).catch(() => {});
  }, []);

  return (
    <ChatsContext.Provider value={{ chats, markAsRead, sendMessage, getExercises, assignExercise, removeExercise, totalUnread }}>
      {children}
    </ChatsContext.Provider>
  );
}

export function useChats() {
  const ctx = useContext(ChatsContext);
  if (!ctx) throw new Error('useChats must be used within ChatsProvider');
  return ctx;
}