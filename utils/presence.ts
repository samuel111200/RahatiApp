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

const HEARTBEAT_INTERVAL_MS = 60_000;
const OFFLINE_THRESHOLD_MS  = 3 * 60_000;

export function startPresenceListener(uid: string): () => void {
  setPresence(uid, true);

  const heartbeat = setInterval(() => {
    if (AppState.currentState === 'active') {
      setPresence(uid, true);
    }
  }, HEARTBEAT_INTERVAL_MS);

  const handleChange = (state: AppStateStatus) => {
    setPresence(uid, state === 'active');
  };

  const sub = AppState.addEventListener('change', handleChange);

  return () => {
    clearInterval(heartbeat);
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
    const lastSeen = data.lastSeen ?? 0;
    const stale = data.isOnline === true && (Date.now() - lastSeen) > OFFLINE_THRESHOLD_MS;
    onChange(stale ? false : data.isOnline === true, lastSeen);
  });
}
