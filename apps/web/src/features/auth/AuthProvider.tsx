import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { firebaseAuth, isFirebaseConfigured } from '../../services/firebase';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    // onAuthStateChanged değil onIdTokenChanged: token yenilendiğinde de
    // haberdar olalım, api-client her istekte taze token okuyor.
    return onIdTokenChanged(firebaseAuth(), (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      async signIn(email, password) {
        await signInWithEmailAndPassword(firebaseAuth(), email, password);
      },
      async signUp(email, password) {
        await createUserWithEmailAndPassword(firebaseAuth(), email, password);
      },
      async signInWithGoogle() {
        await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      },
      async logout() {
        await signOut(firebaseAuth());
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
