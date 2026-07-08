import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import {
  db,
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  setDoc,
  ABSTRACTS_COLLECTION,
  ABSTRACT_REVIEWS_COLLECTION,
  USERS_COLLECTION,
  SETTINGS_COLLECTION,
} from "./firebase-config.js";
import { syncAbstractReviewView } from "./abstract-review-sync.js";

let allAbstracts = [];
let filtered = [];
let activeAbstractId = null;
let studentReviewers = []; // users flagged studrwr
let facultyReviewers = []; // users flagged facrwr
let reviewsById = {}; // reviewId (== abstractId) -> review doc data, for reviewer decisions
let certificatesIssuedToAll = false; // global override, backed by settings/global

const STATUS_LABEL = {
  submitted: "Submitted",
  under_review: "Under Review",
  accepted: "Accepted",
  rejected: "Not Accepted",
};
const STATUS_STYLE = {
  submitted: "bg-slate-100 text-slate-600",
  under_review: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};
const TRACK_LABEL = { poster: "Poster", oral: "Oral", observer: "Observer" };
const DECISION_LABEL = { accepted: "Accept", rejected: "Reject" };
const DECISION_STYLE = {
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

guardPage({
  requireAdmin: true,
  onReady: async (user, profile) => {
    renderTopbar("admin", { isAdmin: true });
    attachLogout("logoutBtn");
    await Promise.all([loadAbstracts(), loadReviewerPool(), loadReviews(), loadGlobalCertSetting()]);
    renderStats();
    wireControls();
    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  },
});

async function loadAbstracts() {
  const snap = await getDocs(collection(db, ABSTRACTS_COLLECTION));
  allAbstracts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  allAbstracts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  document.getElementById("totalCount").textContent = allAbstracts.length;
  applyFilters();
}

async function loadReviews() {
  // Review doc id === abstract id (see abstract-review-sync.js / abstract-detail.js)
  const snap = await getDocs(collection(db, ABSTRACT_REVIEWS_COLLECTION));
  reviewsById = {};
  snap.docs.forEach((d) => {
    reviewsById[d.id] = d.data();
  });
  applyFilters();
}

async function loadGlobalCertSetting() {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, "global"));
    certificatesIssuedToAll = !!(snap.exists() && snap.data().certificatesIssuedToAll);
  } catch (err) {
    console.error("Failed to load global certificate setting", err);
    certificatesIssuedToAll = false;
  }
  reflectGlobalCertToggle();
}

function reflectGlobalCertToggle() {
  const toggle = document.querySelector("[data-global-cert-toggle]");
  const label = document.getElementById("globalCertStatusLabel");
  if (toggle) toggle.checked = certificatesIssuedToAll;
  if (label) {
    label.textContent = certificatesIssuedToAll ? "On" : "Off";
    label.className = `text-sm font-bold ${certificatesIssuedToAll ? "text-emerald-600" : "text-slate-500"}`;
  }
}

async function saveGlobalCertSetting(value) {
  try {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, "global"),
      { certificatesIssuedToAll: value, updatedAt: serverTimestamp() },
      { merge: true }
    );
    certificatesIssuedToAll = value;
    reflectGlobalCertToggle();
    applyFilters();
    showToast(value ? "Certificates issued to all participants." : "Global certificate issuance turned off.", "success");
  } catch (err) {
    console.error(err);
    reflectGlobalCertToggle(); // revert toggle UI to last known good state
    showToast("Failed to update global certificate setting.", "error");
  }
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
  if (!select) return;
  select.innerHTML =
    `<option value="">Unassigned</option>` +
    users.map((u) => `<option value="${u.id}">${escapeHtml(u.fullName || u.email || u.id)}</option>`).join("");
}

function wireControls() {
  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("statusFilter").addEventListener("change", applyFilters);

  // Status modal
  document.querySelectorAll("[data-close-status-modal]").forEach((btn) =>
    btn.addEventListener("click", closeStatusModal)
  );
  document.querySelector("[data-save-status]").addEventListener("click", saveStatusChange);

  // Reviewer modal
  document.querySelectorAll("[data-close-reviewers-modal]").forEach((btn) =>
    btn.addEventListener("click", closeReviewersModal)
  );
  document.querySelector("[data-save-reviewers]").addEventListener("click", saveReviewerAssignments);

  // Global certificate toggle
  document.querySelector("[data-global-cert-toggle]")?.addEventListener("change", (e) => {
    saveGlobalCertSetting(e.target.checked);
  });
}

function closeStatusModal() {
  activeAbstractId = null;
  document.querySelector("[data-status-modal]").classList.add("hidden");
}

function closeReviewersModal() {
  activeAbstractId = null;
  document.querySelector("[data-reviewers-modal]").classList.add("hidden");
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;

  filtered = allAbstracts.filter((a) => {
    const matchesQuery =
      !q ||
      (a.abstract?.title || "").toLowerCase().includes(q) ||
      (a.reviewKey || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || (a.status || "submitted") === statusFilter;
    return matchesQuery && matchesStatus;
  });

  renderTable();
}

// --- Stats overview ---
function renderStats() {
  const total = allAbstracts.length;
  const assigned = allAbstracts.filter((a) => a.studentReviewerUid || a.facultyReviewerUid).length;
  const facultyReviewed = allAbstracts.filter((a) => reviewsById[a.id]?.facultyReviewDecision).length;
  const studentReviewed = allAbstracts.filter((a) => reviewsById[a.id]?.studentReviewDecision).length;
  const accepted = allAbstracts.filter((a) => (a.status || "submitted") === "accepted").length;

  const setStat = (id, value) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`renderStats: missing element #${id}`);
      return;
    }
    el.textContent = value;
  };

  setStat("statTotal", total);
  setStat("statAssigned", assigned);
  setStat("statFacultyReviewed", facultyReviewed);
  setStat("statStudentReviewed", studentReviewed);
  setStat("statAccepted", accepted);
}

function reviewersSummary(a) {
  const student = a.studentReviewerName ? escapeHtml(a.studentReviewerName) : `<span class="text-amber-600">unassigned</span>`;
  const faculty = a.facultyReviewerName ? escapeHtml(a.facultyReviewerName) : `<span class="text-amber-600">unassigned</span>`;
  return `S: ${student}<br>F: ${faculty}`;
}

function decisionBadge(decision) {
  if (!decision) return `<span class="text-slate-400">—</span>`;
  return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${DECISION_STYLE[decision] || "bg-slate-100 text-slate-600"}">${DECISION_LABEL[decision] || decision}</span>`;
}

function certBadge(a) {
  if (!a.isscert && !certificatesIssuedToAll) return "";
  const title = certificatesIssuedToAll && !a.isscert ? "Certificate issued (global)" : "Certificate issued";
  return `<span title="${title}" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 align-middle ml-1.5">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
      <circle cx="12" cy="8" r="6"></circle>
      <path d="M9.5 13.5 7 22l5-3 5 3-2.5-8.5"></path>
      <path d="M9.5 8.5 11 10l3.5-3.5"></path>
    </svg>
  </span>`;
}

function trackNote(track) {
  if (!track) return "";
  return ` <span class="text-slate-400">· suggested ${TRACK_LABEL[track] || track}</span>`;
}

function decisionsSummary(a) {
  const rev = reviewsById[a.id] || {};
  return `
    <div class="flex flex-col gap-1">
      <span>S: ${decisionBadge(rev.studentReviewDecision)}${trackNote(rev.studentReviewTrack)}</span>
      <span>F: ${decisionBadge(rev.facultyReviewDecision)}${trackNote(rev.facultyReviewTrack)}</span>
    </div>`;
}

function renderTable() {
  const tbody = document.getElementById("abstractsTableBody");
  const emptyState = document.getElementById("emptyState");

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  tbody.innerHTML = filtered
    .map((a) => {
      const statusKey = a.status || "submitted";
      const submitterName = `${a.personalInfo?.firstName || ""} ${a.personalInfo?.lastName || ""}`.trim() || "—";
      return `
        <tr class="hover:bg-slate-50/60 transition">
          <td class="px-4 py-3 font-mono text-xs font-bold text-brand-700 whitespace-nowrap">${escapeHtml(a.reviewKey || "—")}</td>
          <td class="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">${escapeHtml(a.abstract?.title || "Untitled")}${certBadge(a)}</td>
          <td class="px-4 py-3 text-slate-600 hidden md:table-cell whitespace-nowrap">${escapeHtml(submitterName)}</td>
          <td class="px-4 py-3 text-slate-600 hidden lg:table-cell whitespace-nowrap">${escapeHtml(a.abstractType?.speciality || "—")}</td>
          <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[statusKey] || "bg-slate-100 text-slate-600"}">${STATUS_LABEL[statusKey] || statusKey}</span></td>
          <td class="px-4 py-3">${a.track ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700">${TRACK_LABEL[a.track] || a.track}</span>` : `<span class="text-xs text-slate-400">—</span>`}</td>
          <td class="px-4 py-3 text-xs text-slate-600 hidden xl:table-cell">${reviewersSummary(a)}</td>
          <td class="px-4 py-3 text-xs text-slate-600 hidden xl:table-cell">${decisionsSummary(a)}</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-end gap-1.5 flex-wrap">
              <button data-action="view" data-id="${a.id}" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition">View</button>
              <button data-action="status" data-id="${a.id}" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">Change Status</button>
              <button data-action="reviewers" data-id="${a.id}" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition">Assign Reviewers</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

 
 tbody.querySelectorAll('[data-action="view"]').forEach((btn) =>
  btn.addEventListener("click", () => {
    window.location.href = `abstract-detail.html?id=${encodeURIComponent(btn.dataset.id)}`;
  })
);

tbody.querySelectorAll('[data-action="status"]').forEach((btn) => btn.addEventListener("click", () => openStatusModal(btn.dataset.id)));
  tbody.querySelectorAll('[data-action="reviewers"]').forEach((btn) => btn.addEventListener("click", () => openReviewersModal(btn.dataset.id)));
}

function openViewModal(id) {
  const a = allAbstracts.find((x) => x.id === id);
  if (!a) return;

  document.querySelector("[data-view-key]").textContent = a.reviewKey || "—";
  document.querySelector("[data-view-title]").textContent = a.abstract?.title || "Untitled abstract";

  const p = a.personalInfo || {};
  const t = a.abstractType || {};
  const ab = a.abstract || {};
  const authorsHtml = (a.authors || []).length
    ? `<ul class="list-disc list-inside space-y-1">${a.authors.map((au) => `<li>${escapeHtml(au.firstName)} ${escapeHtml(au.lastName)} — ${escapeHtml(au.affiliation)} (${escapeHtml(au.status)}, ${escapeHtml(au.rank)})</li>`).join("")}</ul>`
    : `<p class="text-slate-400">No authors added.</p>`;

  document.querySelector("[data-view-body]").innerHTML = `
    <div>
      <p class="font-bold text-slate-900 mb-1">Submitter</p>
      <p class="text-slate-600">${escapeHtml(p.firstName || "")} ${escapeHtml(p.lastName || "")} · ${escapeHtml(p.email || "")} · ${escapeHtml(p.phone || "")}</p>
      <p class="text-slate-600">${escapeHtml(p.institute || "")} — ${escapeHtml(p.fieldOfStudy || "")}, ${escapeHtml(p.yearOfStudy || "")}</p>
      <p class="text-slate-600">${escapeHtml(p.city || "")}, ${escapeHtml(p.province || "")}</p>
    </div>
    <div>
      <p class="font-bold text-slate-900 mb-1">Classification</p>
      <p class="text-slate-600">${escapeHtml(t.speciality || "")}${t.subSpeciality ? " — " + escapeHtml(t.subSpeciality) : ""} · ${escapeHtml(t.abstractType || "")}</p>
    </div>
    <div>
      <p class="font-bold text-slate-900 mb-1">Introduction</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.introduction || "")}</p>
    </div>
    <div>
      <p class="font-bold text-slate-900 mb-1">Objectives</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.objectives || "")}</p>
    </div>
    <div>
      <p class="font-bold text-slate-900 mb-1">Methodology</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.methodology || "")}</p>
    </div>
    <div>
      <p class="font-bold text-slate-900 mb-1">Results</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.results || "")}</p>
    </div>
    <div>
      <p class="font-bold text-slate-900 mb-1">Conclusion</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.conclusion || "")}</p>
    </div>
    <div>
      <p class="font-bold text-slate-900 mb-1">Keywords</p><p class="text-slate-600">${(ab.keywords || []).map(escapeHtml).join(", ") || "—"}</p>
    </div>
    <div>
      <p class="font-bold text-slate-900 mb-1">Authors</p>${authorsHtml}
    </div>
  `;

  document.querySelector("[data-view-modal]").classList.remove("hidden");
}

function openStatusModal(id) {
  const a = allAbstracts.find((x) => x.id === id);
  if (!a) return;
  activeAbstractId = id;
  document.querySelector("[data-status-select]").value = a.status || "submitted";
  document.querySelector("[data-track-select]").value = a.track || "";
  document.querySelector("[data-status-modal]").classList.remove("hidden");
document.querySelector("[data-cert-toggle]").checked = !!a.isscert;
}

async function saveStatusChange() {
  if (!activeAbstractId) return;
  const a = allAbstracts.find((x) => x.id === activeAbstractId);
  if (!a) return;
const isscert = document.querySelector("[data-cert-toggle]").checked;

  const status = document.querySelector("[data-status-select]").value;
  const track = document.querySelector("[data-track-select]").value || null;
const updates = { status, track, isscert, updatedAt: serverTimestamp() };

  try {
    await updateDoc(doc(db, ABSTRACTS_COLLECTION, activeAbstractId), updates);
    Object.assign(a, updates);
    await syncAbstractReviewView(activeAbstractId, a);
    document.querySelector("[data-status-modal]").classList.add("hidden");
    activeAbstractId = null;
    applyFilters();
    renderStats();
    showToast(`${a.reviewKey} updated.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to update status. Please try again.", "error");
  }
}

function openReviewersModal(id) {
  const a = allAbstracts.find((x) => x.id === id);
  if (!a) return;

  activeAbstractId = id;

  document.querySelector("[data-reviewers-current-decisions]").innerHTML = `
    <p><span class="font-semibold text-slate-600">Current Student Reviewer:</span> ${escapeHtml(a.studentReviewerName || "Unassigned")}</p>
    <p><span class="font-semibold text-slate-600">Current Faculty Reviewer:</span> ${escapeHtml(a.facultyReviewerName || "Unassigned")}</p>
  `;

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
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, ABSTRACTS_COLLECTION, activeAbstractId), updates);
    Object.assign(a, updates);
    await syncAbstractReviewView(activeAbstractId, a);
    document.querySelector("[data-reviewers-modal]").classList.add("hidden");
    activeAbstractId = null;
    applyFilters();
    renderStats();
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
