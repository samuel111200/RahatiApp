import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
// @ts-ignore – firebase/auth types use web build; Metro resolves to RN build at runtime
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);

// ─── Firestore document types ─────────────────────────────
export type FSUser = {
  firstName: string;
  lastName: string;
  email: string;
  role: 'doctor' | 'patient';
  age?: string;
  gender?: string;
  specialty?: string;
  photoUrl?: string;
  isOnline?: boolean;
  lastSeen?: number;
  createdAt: number;
};

export type FSRelationship = {
  doctorId: string;
  patientId: string;
  patientName?: string;
  doctorName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  requestedAt: number;
  acceptedAt?: number;
};

export type FSMessage = {
  text: string;
  sender: 'doctor' | 'patient';
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'request_access';
};

export type FSChat = {
  doctorId: string;
  patientId: string;
  patientName?: string;
  lastMessage: string;
  lastMessageTime: number;
  lastMessageSender: 'doctor' | 'patient';
  exerciseAccess: boolean;
  unreadCountDoctor?: number;
  accepted?: boolean;
};

export type FSExercise = {
  title: string;
  emoji: string;
  durationMin: number;
  description?: string;
  assignedAt: number;
  assignedBy: string;
  completed?: boolean;
};
