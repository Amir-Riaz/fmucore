import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import { db, collection, getDocs, doc, updateDoc, serverTimestamp, ABSTRACT_REVIEWS_COLLECTION } from "./firebase-config.js";

let allReviews = [];
let filtered = [];
let activeReviewId = null;
let currentUser = null;

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
const DECISION_LABEL = { accepted: "Accept", rejected: "Reject" };
const DECISION_STYLE = {
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

guardPage({
  requireAdmin: false,
  onReady: (user, profile) => {
    // Reviewer-only surface. Admins can also see it for QA, but participants
    // without either role are bounced back to their dashboard.
    const isReviewer = profile.role === "reviewer" || profile.role === "admin";
    if (!isReviewer) {
      document.getElementById("loadingState").classList.add("hidden");
      document.getElementById("forbiddenState").classList.remove("hidden");
      return;
    }

    currentUser = user;
    renderTopbar("review-abstracts", { isAdmin: profile.role === "admin" });
    attachLogout("logoutBtn");

    loadReviews().then(() => {
      wireControls();
      document.getElementById("loadingState").classList.add("hidden");
      document.getElementById("content").classList.remove("hidden");
    });
  },
});

async function loadReviews() {
  const snap = await getDocs(collection(db, ABSTRACT_REVIEWS_COLLECTION));
  allReviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  applyFilters();
}

function wireControls() {
  document.getElementById("statusFilter").addEventListener("change", applyFilters);
  document.getElementById("decisionFilter").addEventListener("change", applyFilters);

  document.querySelectorAll("[data-close-review-modal]").forEach((btn) =>
    btn.addEventListener("click", () => document.querySelector("[data-review-modal]").classList.add("hidden"))
  );
  document.querySelectorAll("[data-recommend]").forEach((btn) =>
    btn.addEventListener("click", () => saveRecommendation(btn.dataset.recommend))
  );
}

function applyFilters() {
  const statusFilter = document.getElementById("statusFilter").value;
  const decisionFilter = document.getElementById("decisionFilter").value;

  filtered = allReviews.filter((r) => {
    const matchesStatus = statusFilter === "all" || (r.status || "submitted") === statusFilter;
    let matchesDecision = true;
    if (decisionFilter === "none") matchesDecision = !r.reviewDecision;
    else if (decisionFilter === "accepted" || decisionFilter === "rejected") matchesDecision = r.reviewDecision === decisionFilter;
    return matchesStatus && matchesDecision;
  });

  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("reviewTableBody");
  const emptyState = document.getElementById("emptyState");

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  tbody.innerHTML = filtered
    .map((r) => {
      const statusKey = r.status || "submitted";
      return `
        <tr class="hover:bg-slate-50/60 transition">
          <td class="px-4 py-3 font-mono text-xs font-bold text-brand-700 whitespace-nowrap">${escapeHtml(r.reviewKey || r.id)}</td>
          <td class="px-4 py-3 text-slate-700 whitespace-nowrap">${escapeHtml(r.abstractType?.speciality || "—")}</td>
          <td class="px-4 py-3 text-slate-600 hidden md:table-cell whitespace-nowrap">${escapeHtml(r.abstractType?.abstractType || "—")}</td>
          <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[statusKey] || "bg-slate-100 text-slate-600"}">${STATUS_LABEL[statusKey] || statusKey}</span></td>
          <td class="px-4 py-3">${r.reviewDecision ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold ${DECISION_STYLE[r.reviewDecision]}">${DECISION_LABEL[r.reviewDecision]}</span>` : `<span class="text-xs text-slate-400">Not yet reviewed</span>`}</td>
          <td class="px-4 py-3 text-right">
            <button data-action="view" data-id="${r.id}" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition">View & recommend</button>
          </td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll('[data-action="view"]').forEach((btn) => btn.addEventListener("click", () => openReviewModal(btn.dataset.id)));
}

function openReviewModal(id) {
  const r = allReviews.find((x) => x.id === id);
  if (!r) return;
  activeReviewId = id;

  document.querySelector("[data-modal-key]").textContent = r.reviewKey || r.id;
  document.querySelector("[data-modal-title]").textContent = r.abstract?.title || "Untitled abstract";

  const t = r.abstractType || {};
  const ab = r.abstract || {};

  document.querySelector("[data-modal-body]").innerHTML = `
    <div>
      <p class="font-bold text-slate-900 mb-1">Classification</p>
      <p class="text-slate-600">${escapeHtml(t.speciality || "")}${t.subSpeciality ? " — " + escapeHtml(t.subSpeciality) : ""} · ${escapeHtml(t.abstractType || "")}</p>
    </div>
    <div><p class="font-bold text-slate-900 mb-1">Introduction</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.introduction || "")}</p></div>
    <div><p class="font-bold text-slate-900 mb-1">Objectives</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.objectives || "")}</p></div>
    <div><p class="font-bold text-slate-900 mb-1">Methodology</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.methodology || "")}</p></div>
    <div><p class="font-bold text-slate-900 mb-1">Results</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.results || "")}</p></div>
    <div><p class="font-bold text-slate-900 mb-1">Conclusion</p><p class="text-slate-600 whitespace-pre-wrap">${escapeHtml(ab.conclusion || "")}</p></div>
    <div><p class="font-bold text-slate-900 mb-1">Keywords</p><p class="text-slate-600">${(ab.keywords || []).map(escapeHtml).join(", ") || "—"}</p></div>
  `;

  document.querySelector("[data-review-modal]").classList.remove("hidden");
}

async function saveRecommendation(decision) {
  if (!activeReviewId) return;
  const r = allReviews.find((x) => x.id === activeReviewId);
  if (!r) return;

  const updates = {
    reviewDecision: decision,
    reviewedByUid: currentUser?.uid || null,
    reviewedAt: serverTimestamp(),
  };

  try {
    // Reviewers only ever write to the anonymized review view — never to the
    // `abstracts` collection, which is where submitter identity lives.
    await updateDoc(doc(db, ABSTRACT_REVIEWS_COLLECTION, activeReviewId), updates);
    Object.assign(r, updates);
    document.querySelector("[data-review-modal]").classList.add("hidden");
    applyFilters();
    showToast(`Recommendation saved: ${DECISION_LABEL[decision]}.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to save your recommendation. Please try again.", "error");
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
