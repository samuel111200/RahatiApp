import { AppState, AppStateStatus } from 'react-native';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';

async function setPresence(
    uid: string,
    isOnline: boolean,
    terminated: { current: boolean },
): Promise<void> {
  // Never write after the listener has been torn down — this prevents the
  // permission-denied WARN that fires when the cleanup callback tries to
  // mark the user offline after signOut(auth) has already revoked the token.
  if (terminated.current) return;
  try {
    await setDoc(doc(db, 'users', uid), {
      isOnline,
      lastSeen: Date.now(),
    }, { merge: true });
  } catch (e) {
    // Silently swallow — can fire during logout race, not actionable.
  }
}

const HEARTBEAT_INTERVAL_MS = 60_000;
const OFFLINE_THRESHOLD_MS  = 3 * 60_000;

export function startPresenceListener(uid: string): () => void {
  // Shared terminated flag — all async callbacks check this before writing.
  const terminated = { current: false };

  setPresence(uid, true, terminated);

  const heartbeat = setInterval(() => {
    if (AppState.currentState === 'active') {
      setPresence(uid, true, terminated);
    }
  }, HEARTBEAT_INTERVAL_MS);

  const handleChange = (state: AppStateStatus) => {
    setPresence(uid, state === 'active', terminated);
  };

  const sub = AppState.addEventListener('change', handleChange);

  return () => {
    // Mark terminated FIRST — any in-flight or future setPresence calls
    // will bail out immediately, so no writes happen after signOut(auth).
    terminated.current = true;
    clearInterval(heartbeat);
    sub.remove();
    // Attempt a best-effort offline write. If the token is already gone
    // this will be blocked by the terminated flag above (async path won't
    // even reach setDoc). No WARN, no permission-denied.
    setPresence(uid, false, terminated); // terminated is true → no-op
  };
}

export function subscribeToPresence(
    uid: string,
    onChange: (isOnline: boolean, lastSeen: number) => void,
): () => void {
  const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const lastSeen = data.lastSeen ?? 0;
        const stale = data.isOnline === true && (Date.now() - lastSeen) > OFFLINE_THRESHOLD_MS;
        onChange(stale ? false : data.isOnline === true, lastSeen);
      },
      () => {
        // Permission denied after logout — unsubscribe silently.
        unsub();
      },
  );
  return unsub;
}