// ============================================================
// FMUCORE — Auth Guard
// Every protected page (dashboard, my-qr, admin, user-details)
// calls guardPage() on load. It:
//   1. Waits for Firebase to resolve auth state
//   2. Redirects to login.html if nobody is signed in
//   3. Loads the Firestore profile
//   4. Signs out + redirects if the account is blocked
//   5. Optionally enforces admin-only access
//   6. Also listens continuously — if the session ends
//      (token expires / signed out in another tab) it redirects
// ============================================================

import { auth, db, onAuthStateChanged, signOut, doc, getDoc, USERS_COLLECTION } from "./firebase-config.js";

/**
 * @param {Object} options
 * @param {boolean} [options.requireAdmin=false] - only allow role === "admin"
 * @param {(user, profile) => void} options.onReady - called once with the authenticated user + Firestore profile
 */
export function guardPage({ requireAdmin = false, onReady }) {
  let resolved = false;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Not logged in (or session just ended) — bounce to login
      window.location.href = "login.html";
      return;
    }

    let profile;

    try {
      const snap = await getDoc(doc(db, USERS_COLLECTION, user.uid));

      if (!snap.exists()) {
        await signOut(auth);
        window.location.href = "login.html";
        return;
      }

      profile = snap.data();

      if (profile.blocked) {
        await signOut(auth);
        window.location.href = "login.html?blocked=1";
        return;
      }

      if (requireAdmin && profile.role !== "admin") {
        window.location.href = "dashboard.html";
        return;
      }

      resolved = true;
    } catch (err) {
      console.error("Auth guard error (Firestore fetch):", err);
      window.location.href = "login.html";
      return;
    }

    // onReady runs OUTSIDE the auth try/catch — a bug in the page's own
    // rendering code (e.g. a chart or QR library failing) must never be
    // mistaken for an auth failure and bounce the user back to login.
    try {
      onReady(user, profile);
    } catch (err) {
      console.error("Error in page onReady handler:", err);
    }
  });
}

/** Wires up a logout button by id — signs out and redirects to login */
export function attachLogout(buttonId = "logoutBtn") {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } finally {
      window.location.href = "login.html";
    }
  });
}