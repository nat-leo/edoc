// lib/firebase/auth.ts
import { auth } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged as _onAuthStateChanged,
  onIdTokenChanged as _onIdTokenChanged,
  type User,
} from "firebase/auth";

export function onAuthStateChanged(cb: (user: User | null) => void) {
  return _onAuthStateChanged(auth, cb);
}

export function onIdTokenChanged(cb: (user: User | null) => void) {
  return _onIdTokenChanged(auth, cb);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOut() {
  return auth.signOut();
}

export async function signInWithEmailPassword(opts: {
  email: string;
  password: string;
  remember: boolean;
}) {
  // "Remember me" controls whether the Firebase session survives browser restart
  await setPersistence(auth, opts.remember ? browserLocalPersistence : browserSessionPersistence);

  return signInWithEmailAndPassword(auth, opts.email, opts.password);
}

export async function signUpWithEmailPassword(opts: { email: string; password: string }) {
  return createUserWithEmailAndPassword(auth, opts.email, opts.password);
}

