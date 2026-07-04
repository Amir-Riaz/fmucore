// ============================================================
// FMUCORE — Firebase Configuration
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAaWst3omAGHpMMubycw1yRcnduD_bZ_Ss",
  authDomain: "fmucore-19f09.firebaseapp.com",
  projectId: "fmucore-19f09",
  storageBucket: "fmucore-19f09.firebasestorage.app",
  messagingSenderId: "1036393018951",
  appId: "1:1036393018951:web:e8c7abbc1851341a6e2362",
  measurementId: "G-42N7B10CBW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const USERS_COLLECTION = "users";
const PASSES_COLLECTION = "passes";

export {
  app,
  auth,
  db,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  USERS_COLLECTION,
  PASSES_COLLECTION,
};