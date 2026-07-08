import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import {
  db, doc, getDoc, updateDoc, serverTimestamp,
  ABSTRACTS_COLLECTION, ABSTRACT_REVIEWS_COLLECTION,
} from "./firebase-config.js";
import { syncAbstractReviewView } from "./abstract-review-sync.js";

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
const DECISION_STYLE = { accepted: "bg-emerald-50 text-emerald-700", rejected: "bg-red-50 text-red-700" };

let currentAbstract = null;
let abstractId = null;

guardPage({
  requireAdmin: true,
  onReady: async (user, profile) => {
    renderTopbar("admin", { isAdmin: true });
    attachLogout("logoutBtn");

    abstractId = new URLSearchParams(window.location.search).get("id");
    if (!abstractId) {
      showNotFound();
      return;
    }

    await loadAbstract();
  },
});

async function loadAbstract() {
  try {
    const snap = await getDoc(doc(db, ABSTRACTS_COLLECTION, abstractId));
    if (!snap.exists()) {
      showNotFound();
      return;
    }
    currentAbstract = { id: snap.id, ...snap.data() };
    render(currentAbstract);
    await loadRecommendations();
    wireControls();

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  } catch (err) {
    console.error("Failed to load abstract", err);
    showNotFound();
  }
}

function showNotFound() {
  document.getElementById("loadingState").classList.add("hidden");
  document.getElementById("notFoundState").classList.remove("hidden");
}

function render(a) {
  const p = a.personalInfo || {};
  const t = a.abstractType || {};
  const ab = a.abstract || {};
  const statusKey = a.status || "submitted";

  document.getElementById("reviewKey").textContent = a.reviewKey || "—";
  document.getElementById("title").textContent = ab.title || "Untitled abstract";

  const statusBadge = document.getElementById("statusBadge");
  statusBadge.textContent = STATUS_LABEL[statusKey] || statusKey;
  statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[statusKey] || "bg-slate-100 text-slate-600"}`;

  const trackBadge = document.getElementById("trackBadge");
  if (a.track) {
    trackBadge.textContent = TRACK_LABEL[a.track] || a.track;
    trackBadge.classList.remove("hidden");
  }

  const submittedAt = document.getElementById("submittedAt");
  if (a.createdAt?.seconds) {
    submittedAt.textContent = `Submitted ${new Date(a.createdAt.seconds * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;
  }

  document.getElementById("submitterName").textContent = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "—";
  document.getElementById("submitterEmail").textContent = p.email || "—";
  document.getElementById("submitterPhone").textContent = p.phone || "—";
  document.getElementById("submitterInstitute").textContent = p.institute || "—";
  document.getElementById("submitterField").textContent = [p.fieldOfStudy, p.yearOfStudy].filter(Boolean).join(" · ") || "—";
  document.getElementById("submitterLocation").textContent = [p.city, p.province].filter(Boolean).join(", ") || "—";

  document.getElementById("speciality").textContent = t.speciality || "—";
  document.getElementById("subSpeciality").textContent = t.subSpeciality || "—";
  document.getElementById("abstractType").textContent = t.abstractType || "—";

  document.getElementById("introduction").textContent = ab.introduction || "—";
  document.getElementById("objectives").textContent = ab.objectives || "—";
  document.getElementById("methodology").textContent = ab.methodology || "—";
  document.getElementById("results").textContent = ab.results || "—";
  document.getElementById("conclusion").textContent = ab.conclusion || "—";

  const keywordsEl = document.getElementById("keywords");
  keywordsEl.innerHTML = "";
  (ab.keywords || []).forEach((kw) => {
    const chip = document.createElement("span");
    chip.className = "inline-block bg-brand-50 text-brand-700 text-xs font-bold px-2.5 py-1 rounded-full";
    chip.textContent = kw;
    keywordsEl.appendChild(chip);
  });
  if (!(ab.keywords || []).length) keywordsEl.textContent = "—";

  const authorsList = document.getElementById("authorsList");
  const authorsEmpty = document.getElementById("authorsEmpty");
  authorsList.innerHTML = "";
  if (!(a.authors || []).length) {
    authorsEmpty.classList.remove("hidden");
  } else {
    authorsEmpty.classList.add("hidden");
    a.authors.forEach((au) => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm";
      li.innerHTML = `
        <div class="min-w-0">
          <p class="font-bold text-slate-900 truncate">${escapeHtml(au.firstName)} ${escapeHtml(au.lastName)}
            <span class="ml-2 inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${au.status === "Co Presenter" ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600"}">${escapeHtml(au.status)}</span>
          </p>
          <p class="text-xs text-slate-500 truncate">${escapeHtml(au.email)} · ${escapeHtml(au.affiliation)} · ${escapeHtml(au.rank)}</p>
        </div>`;
      authorsList.appendChild(li);
    });
  }

  document.getElementById("statusSelect").value = statusKey;
  document.getElementById("trackSelect").value = a.track || "";
}

async function loadRecommendations() {
  try {
    const snap = await getDoc(doc(db, ABSTRACT_REVIEWS_COLLECTION, abstractId));
    const data = snap.exists() ? snap.data() : {};
    setRecommendationBadge("studentRecommendationBadge", "Student", data.studentReviewDecision);
    setRecommendationBadge("facultyRecommendationBadge", "Faculty", data.facultyReviewDecision);
  } catch (err) {
    console.error("Failed to load reviewer recommendations", err);
  }
}

function setRecommendationBadge(elementId, roleLabel, decision) {
  const badge = document.getElementById(elementId);
  if (!badge) return;
  if (decision) {
    badge.textContent = `${roleLabel}: ${DECISION_LABEL[decision] || decision}`;
    badge.className = `px-3 py-1 rounded-full text-xs font-bold ${DECISION_STYLE[decision] || "bg-slate-100 text-slate-600"}`;
    badge.classList.remove("hidden");
  } else {
    badge.textContent = `${roleLabel}: Not yet reviewed`;
    badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500";
    badge.classList.remove("hidden");
  }
}

function wireControls() {
  document.getElementById("saveStatusBtn").addEventListener("click", saveStatusChange);
}

async function saveStatusChange() {
  const status = document.getElementById("statusSelect").value;
  const track = document.getElementById("trackSelect").value || null;
  const updates = { status, track, updatedAt: serverTimestamp() };
  const btn = document.getElementById("saveStatusBtn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    await updateDoc(doc(db, ABSTRACTS_COLLECTION, abstractId), updates);
    Object.assign(currentAbstract, updates);
    // Keep the reviewer-facing, PII-free copy in step with the new status/track.
    await syncAbstractReviewView(abstractId, currentAbstract);
    render(currentAbstract);
    showToast(`${currentAbstract.reviewKey} updated.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to update status. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
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
