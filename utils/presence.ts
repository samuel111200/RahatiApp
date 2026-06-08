import { AppState, AppStateStatus } from 'react-native';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';

async function setPresence(uid: string, isOnline: boolean): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      isOnline,
      lastSeen: Date.now(),
    }, { merge: true });
  } catch (e) {
    console.warn('[presence] setPresence:', e);
  }
}

export function startPresenceListener(uid: string): () => void {
  setPresence(uid, true);

  const handleChange = (state: AppStateStatus) => {
    setPresence(uid, state === 'active');
  };

  const sub = AppState.addEventListener('change', handleChange);

  return () => {
    setPresence(uid, false);
    sub.remove();
  };
}

export function subscribeToPresence(
  uid: string,
  onChange: (isOnline: boolean, lastSeen: number) => void,
): () => void {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    onChange(data.isOnline === true, data.lastSeen ?? 0);
  });
}
