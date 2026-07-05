import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import { db, collection, getDocs, doc, updateDoc, serverTimestamp, ABSTRACTS_COLLECTION } from "./firebase-config.js";
import { syncAbstractReviewView } from "./abstract-review-sync.js";

let allAbstracts = [];
let filtered = [];
let activeAbstractId = null;

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

guardPage({
  requireAdmin: true,
  onReady: async (user, profile) => {
    renderTopbar("admin", { isAdmin: true });
    attachLogout("logoutBtn");
    await loadAbstracts();
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

function wireControls() {
  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("statusFilter").addEventListener("change", applyFilters);

  document.querySelectorAll("[data-close-status-modal]").forEach((btn) =>
    btn.addEventListener("click", () => document.querySelector("[data-status-modal]").classList.add("hidden"))
  );
  document.querySelector("[data-save-status]").addEventListener("click", saveStatusChange);
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
          <td class="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">${escapeHtml(a.abstract?.title || "Untitled")}</td>
          <td class="px-4 py-3 text-slate-600 hidden md:table-cell whitespace-nowrap">${escapeHtml(submitterName)}</td>
          <td class="px-4 py-3 text-slate-600 hidden lg:table-cell whitespace-nowrap">${escapeHtml(a.abstractType?.speciality || "—")}</td>
          <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[statusKey] || "bg-slate-100 text-slate-600"}">${STATUS_LABEL[statusKey] || statusKey}</span></td>
          <td class="px-4 py-3">${a.track ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700">${TRACK_LABEL[a.track] || a.track}</span>` : `<span class="text-xs text-slate-400">—</span>`}</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-end gap-1.5">
              <a href="abstract-detail.html?id=${a.id}" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition">View</a>
              <button data-action="status" data-id="${a.id}" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">Change Status</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll('[data-action="status"]').forEach((btn) => btn.addEventListener("click", () => openStatusModal(btn.dataset.id)));
}

function openStatusModal(id) {
  const a = allAbstracts.find((x) => x.id === id);
  if (!a) return;
  activeAbstractId = id;
  document.querySelector("[data-status-select]").value = a.status || "submitted";
  document.querySelector("[data-track-select]").value = a.track || "";
  document.querySelector("[data-status-modal]").classList.remove("hidden");
}

async function saveStatusChange() {
  if (!activeAbstractId) return;
  const a = allAbstracts.find((x) => x.id === activeAbstractId);
  if (!a) return;

  const status = document.querySelector("[data-status-select]").value;
  const track = document.querySelector("[data-track-select]").value || null;
  const updates = { status, track, updatedAt: serverTimestamp() };

  try {
    await updateDoc(doc(db, ABSTRACTS_COLLECTION, activeAbstractId), updates);
    Object.assign(a, updates);
    // Keep the reviewer-facing, PII-free copy in step with the new status/track.
    await syncAbstractReviewView(activeAbstractId, a);
    document.querySelector("[data-status-modal]").classList.add("hidden");
    applyFilters();
    showToast(`${a.reviewKey} updated.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to update status. Please try again.", "error");
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
