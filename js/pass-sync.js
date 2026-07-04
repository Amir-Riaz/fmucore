// ============================================================
// FMUCORE — Pass Sync
// Keeps a public-safe `passes/{serial}` document in sync whenever
// an admin changes a participant's approval/block/cpack status.
// This document intentionally excludes email/phone so the public
// verify.html page can read it without exposing PII.
// ============================================================

import { db, doc, setDoc, PASSES_COLLECTION } from "./firebase-config.js";

/**
 * @param {Object} profile - the user's Firestore profile (users/{uid} data)
 */
export async function syncPassDoc(profile) {
  if (!profile.serial) return; // nothing to sync until a serial exists

  const combinedStatus = profile.blocked ? "blocked" : profile.status === "approved" ? "approved" : "pending";

  await setDoc(doc(db, PASSES_COLLECTION, profile.serial), {
    serial: profile.serial,
    fullName: profile.fullName || "",
    organization: profile.organization || "",
    status: combinedStatus,
    cpackIssued: !!profile.cpackIssued,
  });
}