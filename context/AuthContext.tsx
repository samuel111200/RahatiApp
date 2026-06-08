// context/AuthContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, FSUser } from '../utils/firebaseConfig';
import { registerPushToken, startTokenRefreshListener } from '../utils/pushNotifications';

export interface User {
  uid?: string;
  firstName: string;
  lastName: string;
  age: string;
  gender: string;
  email: string;
  role?: 'doctor' | 'patient';
  specialty?: string;
  provider?: 'email' | 'google' | 'facebook';
  photoUrl?: string;
  createdAt?: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string; role?: 'doctor' | 'patient' }>;
  signUp: (personal: Omit<User, 'email' | 'provider' | 'uid'>, account: { email: string; password: string }) => Promise<{ ok: boolean; error?: string; role?: 'doctor' | 'patient' }>;
  signInWithSocial: (provider: 'google' | 'facebook', profile: { email: string; firstName: string; lastName: string; photoUrl?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,            setUser]            = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          if (snap.exists()) {
            const data = snap.data() as FSUser;
            setUser({
              uid:       fbUser.uid,
              firstName: data.firstName,
              lastName:  data.lastName,
              age:       data.age ?? '',
              gender:    data.gender ?? '',
              email:     data.email,
              role:      data.role,
              specialty: data.specialty,
              provider:  'email',
              photoUrl:  data.photoUrl,
              createdAt: data.createdAt,
            });
            setIsAuthenticated(true);
          }
          // Doc not found yet (sign-up race condition) — signUp() already set state, leave it alone
        } catch {
          // Firestore error (permissions not set yet) — don't clear auth, signUp() already set state
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    return startTokenRefreshListener(user.uid);
  }, [user?.uid]);

  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ ok: boolean; error?: string; role?: 'doctor' | 'patient' }> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (snap.exists()) {
        const data = snap.data() as FSUser;
        setUser({
          uid:       cred.user.uid,
          firstName: data.firstName,
          lastName:  data.lastName,
          age:       data.age ?? '',
          gender:    data.gender ?? '',
          email:     data.email,
          role:      data.role,
          specialty: data.specialty,
          provider:  'email',
          photoUrl:  data.photoUrl,
          createdAt: data.createdAt,
        });
        setIsAuthenticated(true);
        registerPushToken(cred.user.uid).catch(() => {});
        return { ok: true, role: data.role };
      }
      return { ok: true, role: 'patient' };
    } catch (e: any) {
      const code = e?.code ?? '';
      const msg =
        code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          : 'حدث خطأ، حاول مرة أخرى';
      return { ok: false, error: msg };
    }
  };

  const signUp = async (
    personal: Omit<User, 'email' | 'provider' | 'uid'>,
    account: { email: string; password: string },
  ): Promise<{ ok: boolean; error?: string; role?: 'doctor' | 'patient' }> => {
    try {
      // Step 1 — create Firebase Auth user (only this can return ok:false)
      const cred = await createUserWithEmailAndPassword(auth, account.email, account.password);
      const uid  = cred.user.uid;
      const role: 'doctor' | 'patient' =
        personal.role ?? (personal.specialty ? 'doctor' : 'patient');

      // Step 2 — save full profile to Firestore (separate try so rules errors
      // don't block navigation; user is already authenticated at this point)
      const fsUser: Record<string, any> = {
        firstName: personal.firstName,
        lastName:  personal.lastName,
        age:       personal.age,
        gender:    personal.gender,
        email:     account.email,
        role,
        createdAt: Date.now(),
      };
      if (personal.specialty) fsUser.specialty = personal.specialty;
      if (personal.photoUrl)  fsUser.photoUrl  = personal.photoUrl;

      try {
        await setDoc(doc(db, 'users', uid), fsUser);
      } catch (fsErr: any) {
        console.warn('[signUp] Firestore save failed — check security rules:', fsErr?.code ?? fsErr);
      }

      setUser({ uid, ...personal, email: account.email, role, provider: 'email' });
      setIsAuthenticated(true);
      registerPushToken(uid).catch(() => {});
      return { ok: true, role };
    } catch (e: any) {
      const code = e?.code ?? '';
      const msg =
        code === 'auth/email-already-in-use'
          ? 'هذا البريد الإلكتروني مستخدم بالفعل'
          : code === 'auth/weak-password'
          ? 'كلمة المرور ضعيفة جداً'
          : 'حدث خطأ، حاول مرة أخرى';
      return { ok: false, error: msg };
    }
  };

  const signInWithSocial = async (
    provider: 'google' | 'facebook',
    profile: { email: string; firstName: string; lastName: string; photoUrl?: string },
  ) => {
    const socialUser: User = {
      firstName: profile.firstName,
      lastName:  profile.lastName,
      age:       '',
      gender:    '',
      email:     profile.email,
      provider,
      photoUrl:  profile.photoUrl,
      role:      'patient',
    };
    setUser(socialUser);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user?.uid) return;
    const updated = { ...user, ...data };
    setUser(updated);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...data,
        updatedAt: Date.now(),
      });
    } catch {}
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoading,
      signIn, signUp, signInWithSocial, logout, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
