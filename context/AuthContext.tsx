// context/AuthContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocFromServer, updateDoc } from 'firebase/firestore';
import { auth, db, FSUser } from '../utils/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken, startTokenRefreshListener } from '../utils/pushNotifications';
import { startPresenceListener } from '../utils/presence';

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
  lastEnergyUpdate?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string, expectedRole?: 'doctor' | 'patient') => Promise<{ ok: boolean; error?: string; role?: 'doctor' | 'patient'; lastEnergyUpdate?: string | null }>;
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

  // Counter-based suppression gate for onAuthStateChanged.
  //
  // When signIn() rejects a wrong-role account it must call signOut(auth).
  // Firebase then fires onAuthStateChanged TWICE:
  //   Event 1 (fbUser set)  — the instant Firebase finishes authenticating
  //   Event 2 (fbUser null) — after our signOut(auth) resolves
  //
  // A boolean flag only skips one event. We need to skip BOTH, otherwise:
  //   • Event 1 sets user in context  → energy screen mounts
  //   • Event 2 clears user / isAuthenticated → redirects to login screen
  //
  // Setting the counter to 2 before signOut() means both events are swallowed
  // and the user simply stays on the login screen with the error alert.
  const suppressAuthEvents = useRef(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (suppressAuthEvents.current > 0) {
        suppressAuthEvents.current -= 1;
        // Only clear the loading spinner on the final suppressed event
        if (suppressAuthEvents.current === 0) setIsLoading(false);
        return;
      }

      if (fbUser) {
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          if (snap.exists()) {
            const data = snap.data() as FSUser;
            setUser({
              uid:              fbUser.uid,
              firstName:        data.firstName,
              lastName:         data.lastName,
              age:              data.age ?? '',
              gender:           data.gender ?? '',
              email:            data.email,
              role:             data.role,
              specialty:        data.specialty,
              provider:         'email',
              photoUrl:         data.photoUrl,
              createdAt:        data.createdAt,
              lastEnergyUpdate: data.lastEnergyUpdate,
            });
            setIsAuthenticated(true);
            registerPushToken(fbUser.uid).catch(() => {});
          }
        } catch {
          // Firestore error (permissions not set yet) — don't clear auth
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

  useEffect(() => {
    if (!user?.uid) return;
    return startPresenceListener(user.uid);
  }, [user?.uid]);

  const signIn = async (
      email: string,
      password: string,
      expectedRole?: 'doctor' | 'patient',
  ): Promise<{ ok: boolean; error?: string; role?: 'doctor' | 'patient'; lastEnergyUpdate?: string | null }> => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);

      // Force-refresh the Firebase ID token so the auth credential is fully
      // propagated before the Firestore read. Without this, getDocFromServer
      // fires before the token is ready and returns permission-denied, which
      // makes snap.data().role come back as undefined.
      await cred.user.getIdToken(true);

      // Retry the Firestore read up to 3 times — permission-denied can still
      // fire on the first attempt on slow connections even after token refresh.
      const snap = await (async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            return await getDocFromServer(doc(db, 'users', cred.user.uid));
          } catch (fsErr: any) {
            if (attempt === 3) throw fsErr;
            await new Promise(res => setTimeout(res, attempt * 300));
          }
        }
        throw new Error('Firestore read failed after 3 attempts');
      })();

      if (snap.exists()) {
        const data = snap.data() as FSUser;
        const role = data.role;

        if (expectedRole && role !== expectedRole) {
          // Suppress the next 2 onAuthStateChanged events:
          //   [0] fbUser set   (Firebase just authenticated them)
          //   [1] fbUser null  (our signOut below resolves)
          // Without this both fire and briefly mutate React state.
          suppressAuthEvents.current = 2;
          await signOut(auth);
          return { ok: false, error: 'wrongPortal', role };
        }

        // Role matches — safe to commit to React state
        setUser({
          uid:              cred.user.uid,
          firstName:        data.firstName,
          lastName:         data.lastName,
          age:              data.age ?? '',
          gender:           data.gender ?? '',
          email:            data.email,
          role,
          specialty:        data.specialty,
          provider:         'email',
          photoUrl:         data.photoUrl,
          createdAt:        data.createdAt,
          lastEnergyUpdate: data.lastEnergyUpdate,
        });
        setIsAuthenticated(true);
        registerPushToken(cred.user.uid).catch(() => {});
        await AsyncStorage.setItem('app_role', role);
        // Return lastEnergyUpdate from the same Firestore doc already read.
        // sign-in.tsx uses this directly — user context state is still null
        // at this point due to async React state updates.
        return { ok: true, role, lastEnergyUpdate: data.lastEnergyUpdate ?? null };
      }

      await signOut(auth);
      return { ok: false, error: 'userDataNotFound' };
    } catch (e: any) {
      const code = e?.code ?? '';
      const errorKey =
          code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential'
              ? 'invalidCredential'
              : 'authError';
      return { ok: false, error: errorKey };
    }
  };

  const signUp = async (
      personal: Omit<User, 'email' | 'provider' | 'uid'>,
      account: { email: string; password: string },
  ): Promise<{ ok: boolean; error?: string; role?: 'doctor' | 'patient'; lastEnergyUpdate?: string | null }> => {
    const normalizedEmail = account.email.trim().toLowerCase();
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, account.password);
      const uid  = cred.user.uid;
      const role: 'doctor' | 'patient' =
          personal.role ?? (personal.specialty ? 'doctor' : 'patient');

      const fsUser: Record<string, any> = {
        firstName: personal.firstName,
        lastName:  personal.lastName,
        age:       personal.age,
        gender:    personal.gender,
        email:     normalizedEmail,
        role,
        createdAt: Date.now(),
      };
      if (personal.specialty) fsUser.specialty = personal.specialty;
      if (personal.photoUrl)  fsUser.photoUrl  = personal.photoUrl;

      try {
        await setDoc(doc(db, 'users', uid), fsUser);
      } catch (fsErr: any) {
        console.warn('[signUp] Firestore save failed — rolling back auth user:', fsErr?.code ?? fsErr);
        try {
          await cred.user.delete();
        } catch (deleteErr) {
          console.error('[signUp] Failed to roll back auth user:', deleteErr);
        }
        return { ok: false, error: 'firestoreSaveFailed' };
      }

      setUser({ uid, ...personal, email: normalizedEmail, role, provider: 'email' });
      setIsAuthenticated(true);
      registerPushToken(uid).catch(() => {});
      return { ok: true, role };

    } catch (e: any) {
      const code = e?.code ?? '';
      const errorKey =
          code === 'auth/email-already-in-use'
              ? 'emailAlreadyInUse'
              : code === 'auth/weak-password'
                  ? 'weakPassword'
                  : 'authError';
      return { ok: false, error: errorKey };
    }
  };

  const signInWithSocial = async (
      provider: 'google' | 'facebook',
      profile: { email: string; firstName: string; lastName: string; photoUrl?: string },
  ) => {
    const fbUser = auth.currentUser;
    const uid = fbUser?.uid;

    const socialUser: User = {
      uid,
      firstName: profile.firstName,
      lastName:  profile.lastName,
      age:       '',
      gender:    '',
      email:     profile.email.trim().toLowerCase(),
      provider,
      photoUrl:  profile.photoUrl,
      role:      'patient',
    };

    if (uid) {
      try {
        await setDoc(
            doc(db, 'users', uid),
            {
              firstName: profile.firstName,
              lastName:  profile.lastName,
              email:     profile.email.trim().toLowerCase(),
              provider,
              photoUrl:  profile.photoUrl ?? null,
              role:      'patient',
              createdAt: Date.now(),
            },
            { merge: true },
        );
        registerPushToken(uid).catch(() => {});
      } catch (err) {
        console.warn('[signInWithSocial] Firestore upsert failed:', err);
      }
    }

    setUser(socialUser);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    const uid = user?.uid;

    // Clear React state first so components re-render and their useEffect
    // cleanups (unsubscribe calls) run before signOut revokes the token.
    // The 'terminated' flag in startPresenceListener ensures no writes fire
    // after cleanup. All onSnapshot listeners have silent error handlers.
    setUser(null);
    setIsAuthenticated(false);

    if (uid) {
      await AsyncStorage.removeItem(`${uid}_user_avatar`);
      await AsyncStorage.removeItem(`energy_level_${uid}`);
      // energy_date_${uid} is intentionally kept on logout.
      // If the same user signs back in the same day, they won't see
      // the energy screen again. The date is keyed by UID so it never
      // leaks between different users on the same device.
    }

    await AsyncStorage.multiRemove(['userRole', 'userData', 'role', 'app_role']);

    try {
      await signOut(auth);
    } catch (error) {
      console.error('Firebase signOut error: ', error);
    }
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