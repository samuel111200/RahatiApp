// utils/firebaseConfig.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getFirestore,
    Firestore,
    collection,
    CollectionReference,
    doc,
    DocumentReference,
    Timestamp,
} from 'firebase/firestore';
import { Platform } from 'react-native';

// ── 1. Credentials from .env ──────────────────────────────
const firebaseClientConfig = {
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
    measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ── 2. Singleton app ──────────────────────────────────────
let app: FirebaseApp;
if (getApps().length === 0) {
    app = initializeApp(firebaseClientConfig);
} else {
    app = getApp();
}

// ── 3. Auth ───────────────────────────────────────────────
let auth: Auth;
try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
    // Auth already initialized (hot reload) — retrieve existing instance
    auth = getAuth(app);
}

// ── 4. Firestore ──────────────────────────────────────────
const db: Firestore = getFirestore(app);

export { app, auth, db };

// ── Collection helpers ────────────────────────────────────
export const usersCol    = () => collection(db, 'users')          as CollectionReference;
export const userDoc     = (uid: string) => doc(db, 'users', uid) as DocumentReference;

export const relsCol     = () => collection(db, 'relationships')  as CollectionReference;
export const relId       = (doctorId: string, patientId: string) => `${doctorId}_${patientId}`;
export const relDoc      = (doctorId: string, patientId: string) =>
    doc(db, 'relationships', relId(doctorId, patientId)) as DocumentReference;

export const chatsCol    = () => collection(db, 'chats')          as CollectionReference;
export const chatDoc     = (chatId: string) => doc(db, 'chats', chatId) as DocumentReference;
export const messagesCol = (chatId: string) =>
    collection(db, 'chats', chatId, 'messages')                     as CollectionReference;

// ── Firestore types ───────────────────────────────────────
export interface FSUser {
    uid:            string;
    firstName:      string;
    lastName:       string;
    email:          string;
    age:            string;
    gender:         'male' | 'female' | '';
    role:           'doctor' | 'patient';
    specialty?:     string;
    licenseNumber?: string;
    photoUrl:       string | null;
}

export interface FSRelationship {
    relationshipId: string;
    doctorId:       string;
    patientId:      string;
    status:         'pending' | 'accepted';
    exerciseAccess: 'locked' | 'granted';
    createdAt:      Timestamp;
    acceptedAt:     Timestamp | null;
}

export interface FSChat {
    chatId:            string;
    participants:      string[];
    lastMessage:       string;
    lastMessageTime:   Timestamp;
    lastMessageSender: 'doctor' | 'patient';
}

export interface FSMessage {
    id:           string;
    text:         string;
    sender:       'doctor' | 'patient';
    time:         string;
    timestamp:    Timestamp;
    type:         'text' | 'request_access';
    accessStatus: 'pending' | 'granted' | null;
}

export interface FSPatientExercise {
    id:          string;
    title:       string;
    emoji:       string;
    durationMin: number;
    description: string;
    assignedAt:  Timestamp;
    completed:   boolean;
}