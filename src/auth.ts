import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseEnabled, googleProvider } from './firebase';

export type AuthUser = { uid: string; email: string; name?: string; provider: 'email' | 'google' };

function toAuthUser(user: User): AuthUser {
  const provider = user.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'email';
  return { uid: user.uid, email: user.email || '', name: user.displayName || undefined, provider };
}

export async function ensureUserDoc(user: AuthUser) {
  if (!db) return;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { email: user.email, name: user.name || '', provider: user.provider, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(ref, { email: user.email, name: user.name || '', provider: user.provider, updatedAt: serverTimestamp() }, { merge: true });
  }
}

export function watchAuth(cb: (user: AuthUser | null) => void) {
  if (!firebaseEnabled || !auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) { cb(null); return; }
    const authUser = toAuthUser(user);
    try { await ensureUserDoc(authUser); } catch { /* ignore */ }
    cb(authUser);
  });
}

export async function emailSignIn(email: string, password: string) {
  if (!auth) throw new Error('Sign-in is not available right now.');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return toAuthUser(cred.user);
}

export async function emailSignUp(email: string, password: string, name?: string) {
  if (!auth) throw new Error('Sign-in is not available right now.');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name?.trim()) await updateProfile(cred.user, { displayName: name.trim() });
  const user = toAuthUser({ ...cred.user, displayName: name?.trim() || cred.user.displayName } as User);
  await ensureUserDoc(user);
  return user;
}

export async function googleSignIn() {
  if (!auth || !googleProvider) throw new Error('Google sign-in is not available right now.');
  const cred = await signInWithPopup(auth, googleProvider);
  const user = toAuthUser(cred.user);
  await ensureUserDoc(user);
  return user;
}

export async function resetPassword(email: string) {
  if (!auth) throw new Error('Sign-in is not available right now.');
  await sendPasswordResetEmail(auth, email);
}

export async function logOut() {
  if (!auth) return;
  await signOut(auth);
}

export { firebaseEnabled };
