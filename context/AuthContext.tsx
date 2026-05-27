// context/AuthContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface User {
  firstName: string;
  lastName: string;
  age: string;
  gender: string;
  email: string;
  specialty?: string;       // ← جديد
  licenseNumber?: string;   // ← جديد
  provider?: 'email' | 'google' | 'facebook';
  photoUrl?: string;
}

interface StoredAccount {
  email: string;
  password: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (personal: Omit<User, 'email' | 'provider'>, account: { email: string; password: string }) => Promise<{ ok: boolean; error?: string }>;
  signInWithSocial: (provider: 'google' | 'facebook', profile: { email: string; firstName: string; lastName: string; photoUrl?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY  = 'rahati_current_user';
const ACCOUNTS_KEY = 'rahati_accounts';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,            setUser]            = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const u = JSON.parse(raw);
          setUser(u);
          setIsAuthenticated(true);
        } catch {}
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const persist = async (u: User) => {
    setUser(u);
    setIsAuthenticated(true);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
      const accounts: StoredAccount[] = raw ? JSON.parse(raw) : [];
      const found = accounts.find(
        a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
      );
      if (!found) return { ok: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
      await persist(found.user);
      return { ok: true };
    } catch {
      return { ok: false, error: 'حدث خطأ، حاول مرة أخرى' };
    }
  };

  const signUp = async (
    personal: Omit<User, 'email' | 'provider'>,
    account: { email: string; password: string }
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
      const accounts: StoredAccount[] = raw ? JSON.parse(raw) : [];
      if (accounts.find(a => a.email.toLowerCase() === account.email.toLowerCase()))
        return { ok: false, error: 'هذا البريد الإلكتروني مستخدم بالفعل' };

      const newUser: User = {
        ...personal,           // هيشمل specialty و licenseNumber تلقائياً لو اتبعتوا
        email: account.email,
        provider: 'email',
      };
      accounts.push({ email: account.email, password: account.password, user: newUser });
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      await persist(newUser);
      return { ok: true };
    } catch {
      return { ok: false, error: 'حدث خطأ، حاول مرة أخرى' };
    }
  };

  const signInWithSocial = async (
    provider: 'google' | 'facebook',
    profile: { email: string; firstName: string; lastName: string; photoUrl?: string }
  ) => {
    const socialUser: User = {
      firstName: profile.firstName,
      lastName:  profile.lastName,
      age:       '',
      gender:    '',
      email:     profile.email,
      provider,
      photoUrl:  profile.photoUrl,
    };
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    const accounts: StoredAccount[] = raw ? JSON.parse(raw) : [];
    const idx = accounts.findIndex(a => a.email.toLowerCase() === profile.email.toLowerCase());
    if (idx >= 0) accounts[idx].user = socialUser;
    else accounts.push({ email: profile.email, password: '', user: socialUser });
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    await persist(socialUser);
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    const accounts: StoredAccount[] = raw ? JSON.parse(raw) : [];
    const idx = accounts.findIndex(
      a => a.email.toLowerCase() === updated.email.toLowerCase()
    );
    if (idx >= 0) {
      accounts[idx].user = updated;
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }
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