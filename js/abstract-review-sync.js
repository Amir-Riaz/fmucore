// ============================================================
// FMUCORE — Abstract Review Sync
// Keeps a PII-free `abstractReviewViews/{abstractId}` document in sync
// whenever an abstract is submitted or its status changes. Reviewers are
// granted Firestore read access to THIS collection only (via security
// rules) — never to the `abstracts` collection, which holds submitter
// names, emails, institutes, and author lists.
//
// Deliberately excluded from this view: submittedBy, personalInfo, authors.
// Author names are excluded too, since co-author identity can be as
// identifying as the submitter's own name.
// ============================================================

import { db, doc, setDoc, ABSTRACT_REVIEWS_COLLECTION } from "./firebase-config.js";

/**
 * @param {string} abstractId - the Firestore doc id in the `abstracts` collection
 * @param {Object} abstract - the full abstract document being written/updated
 */
export async function syncAbstractReviewView(abstractId, abstract) {
  await setDoc(doc(db, ABSTRACT_REVIEWS_COLLECTION, abstractId), {
    reviewKey: abstract.reviewKey,
    abstractType: abstract.abstractType,
    abstract: {
      title: abstract.abstract.title,
      introduction: abstract.abstract.introduction,
      objectives: abstract.abstract.objectives,
      methodology: abstract.abstract.methodology,
      results: abstract.abstract.results,
      conclusion: abstract.abstract.conclusion,
      keywords: abstract.abstract.keywords,
    },
    status: abstract.status,
    track: abstract.track,
    reviewDecision: abstract.reviewDecision,
  });
}
