import { getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let cached: Auth | null = null;

/**
 * Modül import edilirken değil ilk kullanımda kurulur; aksi halde Firebase
 * yapılandırması olmayan bir ortamda (testler) sadece api-client'ı import etmek
 * bile patlardı.
 */
export function firebaseAuth(): Auth {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase yapılandırılmamış: .env içindeki VITE_FIREBASE_* değerlerini doldurun.',
    );
  }
  if (cached) return cached;
  cached = getAuth(getApps()[0] ?? initializeApp(config));
  return cached;
}

/** Oturum yoksa null döner; api-client bu durumda başlığı hiç göndermez. */
export async function currentIdToken(): Promise<string | null> {
  if (!isFirebaseConfigured) return null;
  const user = firebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}
