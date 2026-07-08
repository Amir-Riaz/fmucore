import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import {
  db, collection, getDocs, query, where,
  ABSTRACT_REVIEWS_COLLECTION,
} from "./firebase-config.js";

let allReviews = [];
let filtered = [];
let currentUser = null;
let currentProfile = null;
let isAdminUser = false;

const DECISION_LABEL = { accepted: "Accept", rejected: "Reject" };
const DECISION_STYLE = {
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

guardPage({
  requireAdmin: false,
  onReady: (user, profile) => {
    // Student reviewer surface. Admins can also see it (all assignments) for QA.
    const isStudentReviewer = profile.studrwr === true || profile.role === "admin";
    if (!isStudentReviewer) {
      document.getElementById("loadingState").classList.add("hidden");
      document.getElementById("forbiddenState").classList.remove("hidden");
      return;
    }

    currentUser = user;
    currentProfile = profile;
    isAdminUser = profile.role === "admin";
    renderTopbar("student-review-abstracts", { isAdmin: isAdminUser });
    attachLogout("logoutBtn");

    loadReviews().then(() => {
      wireControls();
      document.getElementById("loadingState").classList.add("hidden");
      document.getElementById("content").classList.remove("hidden");
    });
  },
});

async function loadReviews() {
  const snap = isAdminUser
    ? await getDocs(collection(db, ABSTRACT_REVIEWS_COLLECTION))
    : await getDocs(query(collection(db, ABSTRACT_REVIEWS_COLLECTION), where("assignedStudentReviewerUid", "==", currentUser.uid)));

  allReviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  applyFilters();
}

function wireControls() {
  document.getElementById("decisionFilter").addEventListener("change", applyFilters);
}

function applyFilters() {
  const decisionFilter = document.getElementById("decisionFilter").value;

  filtered = allReviews.filter((r) => {
    if (decisionFilter === "none") return !r.studentReviewDecision;
    if (decisionFilter === "accepted" || decisionFilter === "rejected") return r.studentReviewDecision === decisionFilter;
    return true;
  });

  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("reviewTableBody");
  const emptyState = document.getElementById("emptyState");

  if (filtered.length === 0) {
    tbody.innerHTML = "";

    if (allReviews.length === 0) {
      emptyState.innerHTML = `
        <div class="py-8">
          <h3 class="text-lg font-semibold text-slate-900">
            No abstract reviews assigned
          </h3>
          <p class="mt-2 text-sm text-slate-500">
            You don't have any abstract reviews assigned yet.
          </p>
        </div>
      `;
    } else {
      emptyState.innerHTML = `
        <div class="py-8">
          <h3 class="text-lg font-semibold text-slate-900">
            No matching abstracts
          </h3>
          <p class="mt-2 text-sm text-slate-500">
            Try changing your filters to see more results.
          </p>
        </div>
      `;
    }

    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  tbody.innerHTML = filtered
    .map((r) => {
      return `
        <tr class="hover:bg-slate-50/60 transition">
          <td class="px-4 py-3 font-mono text-xs font-bold text-brand-700 whitespace-nowrap">${escapeHtml(r.reviewKey || r.id)}</td>
          <td class="px-4 py-3 text-slate-700 whitespace-nowrap">${escapeHtml(r.abstractType?.speciality || "—")}</td>
          <td class="px-4 py-3 text-slate-600 hidden md:table-cell whitespace-nowrap">${escapeHtml(r.abstractType?.abstractType || "—")}</td>
          <td class="px-4 py-3">${r.studentReviewDecision ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold ${DECISION_STYLE[r.studentReviewDecision]}">${DECISION_LABEL[r.studentReviewDecision]}</span>` : `<span class="text-xs text-slate-400">Not yet reviewed</span>`}</td>
          <td class="px-4 py-3 text-right">
            <a href="student-review-detail.html?id=${r.id}" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition">View & recommend</a>
          </td>
        </tr>`;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
