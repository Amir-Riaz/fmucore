// ============================================================
// FMUCORE — Reviewer Manager
// Scoped-down abstracts screen: an rwrset-flagged (non-admin)
// account can assign a Student Reviewer + Faculty Reviewer to
// each abstract. No status/track editing, no full abstract
// view modal — that stays in abstracts-admin.js.
//
// ASSUMPTIONS (flag if wrong):
//   - Reviewer assignment fields on /abstracts/{id} are named
//     studentReviewerUid, studentReviewerName, facultyReviewerUid,
//     facultyReviewerName (inferred from the select names in
//     abstracts-admin.html's reviewers modal).
//   - The reviewer pool comes from /users docs flagged studrwr / facrwr.
// ============================================================

import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import {
  db,
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  ABSTRACTS_COLLECTION,
  USERS_COLLECTION,
} from "./firebase-config.js";
import { syncAbstractReviewView } from "./abstract-review-sync.js";

const TRACK_LABEL = { poster: "Poster", oral: "Oral", observer: "Observer" };

let allAbstracts = [];
let studentReviewers = []; // users flagged studrwr
let facultyReviewers = []; // users flagged facrwr
let activeAbstractId = null;
let currentManager = { name: "", email: "" };

guardPage({
  requireAdmin: false,
  onReady: async (user, profile) => {
    if (!profile.rwrset) {
      window.location.href = "dashboard.html";
      return;
    }

    currentManager = { name: profile.fullName || "Reviewer Manager", email: user.email || "" };

    renderTopbar("reviewer-manager", { isAdmin: false });
    attachLogout("logoutBtn");
    await Promise.all([loadAbstracts(), loadReviewerPool()]);
    wireControls();
    renderLists(); // <-- was missing: lists were loaded but never rendered

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  },
});
async function loadAbstracts() {
  const snap = await getDocs(collection(db, ABSTRACTS_COLLECTION));
  allAbstracts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  allAbstracts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  document.getElementById("totalCount").textContent = allAbstracts.length;
}

async function loadReviewerPool() {
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  studentReviewers = users.filter((u) => u.studrwr && !u.blocked);
  facultyReviewers = users.filter((u) => u.facrwr && !u.blocked);

  populateSelect(document.querySelector("[data-student-reviewer-select]"), studentReviewers);
  populateSelect(document.querySelector("[data-faculty-reviewer-select]"), facultyReviewers);
}

function populateSelect(select, users) {
  select.innerHTML =
    `<option value="">Unassigned</option>` +
    users.map((u) => `<option value="${u.id}">${escapeHtml(u.fullName || u.email || u.id)}</option>`).join("");
}

function wireControls() {
  document.getElementById("searchInput").addEventListener("input", renderLists);
  document.querySelectorAll("[data-close-reviewers-modal]").forEach((btn) =>
    btn.addEventListener("click", closeReviewersModal)
  );
  document.querySelector("[data-save-reviewers]").addEventListener("click", saveReviewerAssignments);
}

function closeReviewersModal() {
  activeAbstractId = null;
  document.querySelector("[data-reviewers-modal]").classList.add("hidden");
}

function renderLists() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();

  const matchesQuery = (a) =>
    !q ||
    (a.abstract?.title || "").toLowerCase().includes(q) ||
    (a.reviewKey || "").toLowerCase().includes(q);

  const isFullyAssigned = (a) => !!a.studentReviewerUid && !!a.facultyReviewerUid;

  const unassigned = allAbstracts.filter((a) => !isFullyAssigned(a) && matchesQuery(a));
  const assigned = allAbstracts.filter((a) => isFullyAssigned(a) && matchesQuery(a));

  renderTable("unassignedTableBody", "unassignedEmptyState", "unassignedCount", unassigned);
  renderTable("assignedTableBody", "assignedEmptyState", "assignedCount", assigned);
}

function reviewersSummary(a) {
  const parts = [];
  parts.push(a.studentReviewerName ? `Student: ${escapeHtml(a.studentReviewerName)}` : `Student: <span class="text-amber-600">unassigned</span>`);
  parts.push(a.facultyReviewerName ? `Faculty: ${escapeHtml(a.facultyReviewerName)}` : `Faculty: <span class="text-amber-600">unassigned</span>`);
  return parts.join(" · ");
}

function renderTable(bodyId, emptyId, countId, list) {
  const tbody = document.getElementById(bodyId);
  const emptyState = document.getElementById(emptyId);
  document.getElementById(countId).textContent = `(${list.length})`;

  if (list.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  tbody.innerHTML = list
    .map(
      (a) => `
        <tr class="hover:bg-slate-50/60 transition">
          <td class="px-4 py-3 font-mono text-xs font-bold text-brand-700 whitespace-nowrap">${escapeHtml(a.reviewKey || "—")}</td>
          <td class="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">${escapeHtml(a.abstract?.title || "Untitled")}</td>
          <td class="px-4 py-3">${a.track ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700">${TRACK_LABEL[a.track] || a.track}</span>` : `<span class="text-xs text-slate-400">—</span>`}</td>
          <td class="px-4 py-3 text-xs text-slate-600 hidden md:table-cell whitespace-nowrap">${reviewersSummary(a)}</td>
          <td class="px-4 py-3 text-right">
            <button data-action="assign" data-id="${a.id}" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition">
              Assign Reviewers
            </button>
          </td>
        </tr>`
    )
    .join("");

  tbody.querySelectorAll('[data-action="assign"]').forEach((btn) =>
    btn.addEventListener("click", () => openReviewersModal(btn.dataset.id))
  );
}

function openReviewersModal(id) {
  const a = allAbstracts.find((x) => x.id === id);
  if (!a) return;

  activeAbstractId = id;
  document.querySelector("[data-reviewers-modal-key]").textContent = a.reviewKey || "";
  document.querySelector("[data-student-reviewer-select]").value = a.studentReviewerUid || "";
  document.querySelector("[data-faculty-reviewer-select]").value = a.facultyReviewerUid || "";
  document.querySelector("[data-reviewers-modal]").classList.remove("hidden");
}

async function saveReviewerAssignments() {
  if (!activeAbstractId) return;
  const a = allAbstracts.find((x) => x.id === activeAbstractId);
  if (!a) return;

  const studentUid = document.querySelector("[data-student-reviewer-select]").value || null;
  const facultyUid = document.querySelector("[data-faculty-reviewer-select]").value || null;
  const studentUser = studentReviewers.find((u) => u.id === studentUid);
  const facultyUser = facultyReviewers.find((u) => u.id === facultyUid);

  const updates = {
    studentReviewerUid: studentUid,
    studentReviewerName: studentUser ? studentUser.fullName || studentUser.email : null,
    facultyReviewerUid: facultyUid,
    facultyReviewerName: facultyUser ? facultyUser.fullName || facultyUser.email : null,
    reviewersAssignedByName: currentManager.name,
    reviewersAssignedByEmail: currentManager.email,
    reviewersAssignedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, ABSTRACTS_COLLECTION, activeAbstractId), updates);
    Object.assign(a, updates);
    // Keep the reviewer-facing, PII-free mirror in step with the new assignment.
    await syncAbstractReviewView(activeAbstractId, a);
    closeReviewersModal();
    renderLists();
    showToast(`${a.reviewKey} reviewers updated.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to update reviewers. Please try again.", "error");
  }
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `fixed bottom-5 right-5 z-50 max-w-xs px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
    type === "success" ? "bg-slate-900 text-white" : "bg-red-600 text-white"
  }`;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 3000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}