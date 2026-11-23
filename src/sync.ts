import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { AppState } from './types';

export async function loadCloudState(uid: string): Promise<AppState | null> {
  if (!db) return null;
  const ref = doc(db, 'users', uid, 'app', 'state');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as { state?: AppState };
  return data.state ?? null;
}

export async function saveCloudState(uid: string, state: AppState) {
  if (!db) return;
  const ref = doc(db, 'users', uid, 'app', 'state');
  await setDoc(ref, { state, updatedAt: serverTimestamp() }, { merge: true });
}
