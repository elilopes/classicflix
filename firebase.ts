import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, updateDoc, deleteDoc, getDoc, getDocs, limit } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
export const googleDriveProvider = new GoogleAuthProvider();
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

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
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  limit
};
export type { User };
