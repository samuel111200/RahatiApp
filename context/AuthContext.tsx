// context/AuthContext.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Full Firebase Auth + Firestore replacement for the old AsyncStorage-based
// AuthContext.  ALL UI-facing interfaces (User type, hook names, method
// signatures) are intentionally kept identical so every existing screen
// continues to compile without changes.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile as fbUpdateProfile,
  User as FBUser,
} from 'firebase/auth';

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db, userDoc, FSUser } from '../utils/firebaseConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Public types (unchanged surface)
// ─────────────────────────────────────────────────────────────────────────────
export interface User {
  uid:           string;
  firstName:     string;
  lastName:      string;
  age:           string;
  gender:        string;
  email:         string;
  role:          'doctor' | 'patient';
  specialty?:    string;
  licenseNumber?: string;
  provider?:     'email' | 'google' | 'facebook';
  photoUrl?:     string;
}

interface AuthContextType {
  user:             User | null;
  isAuthenticated:  boolean;
  isLoading:        boolean;
  signIn:           (email: string, password: string)     => Promise<{ ok: boolean; error?: string }>;
  signUp:           (
      personal: Omit<User, 'email' | 'provider' | 'uid'>,
      account:  { email: string; password: string },
  ) => Promise<{ ok: boolean; error?: string }>;
  signInWithSocial: (
      provider: 'google' | 'facebook',
      profile: { email: string; firstName: string; lastName: string; photoUrl?: string },
  ) => Promise<void>;
  logout:           ()                                    => Promise<void>;
  updateProfile:    (data: Partial<User>)                 => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: read user doc from Firestore and map to our User shape
// ─────────────────────────────────────────────────────────────────────────────
async function fetchUserProfile(uid: string): Promise<User | null> {
  try {
    const snap = await getDoc(userDoc(uid));
    if (!snap.exists()) return null;
    return snap.data() as User;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: write / merge user doc to Firestore
// ─────────────────────────────────────────────────────────────────────────────
async function persistUserProfile(uid: string, data: Partial<FSUser>) {
  await setDoc(userDoc(uid), { ...data, uid }, { merge: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Context & Provider
// ─────────────────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,            setUser]            = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);

  // ── Subscribe to Firebase Auth state changes ───────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser: FBUser | null) => {
      if (fbUser) {
        // Try to load the full profile from Firestore
        const profile = await fetchUserProfile(fbUser.uid);
        if (profile) {
          setUser(profile);
          setIsAuthenticated(true);
        } else {
          // Edge-case: auth user exists but no Firestore doc yet (race condition)
          // Build a minimal user object from the Firebase Auth record
          const minimal: User = {
            uid:          fbUser.uid,
            firstName:    fbUser.displayName?.split(' ')[0] ?? '',
            lastName:     fbUser.displayName?.split(' ').slice(1).join(' ') ?? '',
            email:        fbUser.email ?? '',
            age:          '',
            gender:       '',
            role:         'patient',
            photoUrl:     fbUser.photoURL ?? undefined,
          };
          setUser(minimal);
          setIsAuthenticated(true);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return unsub; // cleanup subscription on unmount
  }, []);

  // ── signIn ─────────────────────────────────────────────────────────────────
  const signIn = async (
      email: string,
      password: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged will update user state automatically
      return { ok: true };
    } catch (e: any) {
      // Map Firebase error codes to Arabic/English user messages
      const code: string = e?.code ?? '';
      let error = 'حدث خطأ، حاول مرة أخرى';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' ||
          code === 'auth/invalid-credential') {
        error = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      } else if (code === 'auth/too-many-requests') {
        error = 'تم تجاوز عدد المحاولات المسموح به. حاول لاحقاً';
      }
      return { ok: false, error };
    }
  };

  // ── signUp ─────────────────────────────────────────────────────────────────
  const signUp = async (
      personal: Omit<User, 'email' | 'provider' | 'uid'>,
      account: { email: string; password: string },
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const credential = await createUserWithEmailAndPassword(
          auth,
          account.email.trim(),
          account.password,
      );
      const fbUser = credential.user;

      // Update Firebase Auth display name
      await fbUpdateProfile(fbUser, {
        displayName: `${personal.firstName} ${personal.lastName}`,
      });

      // Write full profile to Firestore
      const newUser: FSUser = {
        uid:           fbUser.uid,
        firstName:     personal.firstName,
        lastName:      personal.lastName,
        email:         account.email.trim(),
        age:           personal.age ?? '',
        gender:        (personal.gender as FSUser['gender']) ?? '',
        role:          personal.role ?? 'patient',
        specialty:     personal.specialty,
        licenseNumber: personal.licenseNumber,
        photoUrl:      personal.photoUrl ?? null,
      };
      await persistUserProfile(fbUser.uid, newUser);

      // onAuthStateChanged will load the profile; no manual setState needed
      return { ok: true };
    } catch (e: any) {
      const code: string = e?.code ?? '';
      let error = 'حدث خطأ، حاول مرة أخرى';
      if (code === 'auth/email-already-in-use') {
        error = 'هذا البريد الإلكتروني مستخدم بالفعل';
      } else if (code === 'auth/weak-password') {
        error = 'كلمة المرور ضعيفة جداً';
      }
      return { ok: false, error };
    }
  };

  // ── signInWithSocial ───────────────────────────────────────────────────────
  // NOTE: Full Google/Facebook OAuth flows require expo-auth-session or
  // @react-native-google-signin. This stub preserves the existing interface
  // and writes a Firestore user doc after you obtain an OAuth credential.
  const signInWithSocial = async (
      provider: 'google' | 'facebook',
      profile: { email: string; firstName: string; lastName: string; photoUrl?: string },
  ) => {
    // The caller is responsible for completing the OAuth flow and calling
    // signInWithCredential(auth, oauthCredential) before invoking this method.
    // Here we only upsert the Firestore user doc using the current Auth user.
    const fbUser = auth.currentUser;
    if (!fbUser) return;

    const socialUser: FSUser = {
      uid:      fbUser.uid,
      firstName: profile.firstName,
      lastName:  profile.lastName,
      email:     profile.email,
      age:       '',
      gender:    '',
      role:      'patient',
      photoUrl:  profile.photoUrl ?? null,
    };
    await persistUserProfile(fbUser.uid, socialUser);
    // State will be updated by onAuthStateChanged
  };

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = async () => {
    await signOut(auth);
    // onAuthStateChanged will set user → null automatically
  };

  // ── updateProfile ──────────────────────────────────────────────────────────
  const updateProfile = async (data: Partial<User>) => {
    if (!user?.uid) return;
    const updated: User = { ...user, ...data };
    setUser(updated);

    // Persist to Firestore (merge so we never wipe fields)
    await persistUserProfile(user.uid, data as Partial<FSUser>);

    // Keep Firebase Auth display name in sync
    const fbUser = auth.currentUser;
    if (fbUser && (data.firstName || data.lastName)) {
      await fbUpdateProfile(fbUser, {
        displayName: `${updated.firstName} ${updated.lastName}`,
      }).catch(() => {});
    }
  };

  return (
      <AuthContext.Provider
          value={{
            user,
            isAuthenticated,
            isLoading,
            signIn,
            signUp,
            signInWithSocial,
            logout,
            updateProfile,
          }}
      >
        {children}
      </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}