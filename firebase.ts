import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocFromServer, getDocs, limit } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const googleDriveProvider = new GoogleAuthProvider();
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

// In-memory cache for Google Drive OAuth access token (never persisted to storage)
let cachedDriveAccessToken: string | null = null;
let cachedDriveTokenExpiresAt = 0;
let cachedDriveUserEmail: string | null = null;
let inFlightDriveConnect: Promise<{ user: User | null; accessToken: string }> | null = null;
let isDriveSigningIn = false;

onAuthStateChanged(auth, (user) => {
  if (!user && !isDriveSigningIn) {
    cachedDriveAccessToken = null;
    cachedDriveTokenExpiresAt = 0;
    cachedDriveUserEmail = null;
  }
});

export const getGoogleDriveAccessToken = (): string | null => {
  if (!cachedDriveAccessToken) return null;
  if (cachedDriveTokenExpiresAt > 0 && Date.now() >= cachedDriveTokenExpiresAt) {
    cachedDriveAccessToken = null;
    cachedDriveTokenExpiresAt = 0;
    return null;
  }
  return cachedDriveAccessToken;
};

export const getGoogleDriveUserEmail = (): string | null =>
  cachedDriveUserEmail || auth.currentUser?.email || null;

export const connectGoogleDrive = async (): Promise<{ user: User | null; accessToken: string }> => {
  const activeToken = getGoogleDriveAccessToken();
  if (activeToken) {
    return { user: auth.currentUser, accessToken: activeToken };
  }

  if (inFlightDriveConnect) {
    return inFlightDriveConnect;
  }

  inFlightDriveConnect = (async () => {
    isDriveSigningIn = true;
    try {
      const hintEmail = auth.currentUser?.email;
      if (hintEmail) {
        googleDriveProvider.setCustomParameters({ login_hint: hintEmail });
      }
      const result = await signInWithPopup(auth, googleDriveProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Não foi possível obter o token de acesso do Google Drive.');
      }
      cachedDriveAccessToken = credential.accessToken;
      // OAuth access tokens expire after ~3600s; refresh after 50 minutes
      cachedDriveTokenExpiresAt = Date.now() + 50 * 60 * 1000;
      cachedDriveUserEmail = result.user?.email || hintEmail || null;
      return { user: result.user, accessToken: cachedDriveAccessToken };
    } finally {
      isDriveSigningIn = false;
      inFlightDriveConnect = null;
    }
  })();

  return inFlightDriveConnect;
};

export const clearGoogleDriveAccessToken = () => {
  cachedDriveAccessToken = null;
  cachedDriveTokenExpiresAt = 0;
  cachedDriveUserEmail = null;
};

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit
};
export type { User };
