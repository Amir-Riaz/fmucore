// ============================================================
// FMUCORE — Enrollment Manager
// Scoped-down version of admin.js: lists participants and lets
// an enrolmngr-flagged (non-admin) account approve registrations
// only. Approval is one-way from this screen (no unapprove) —
// mirrors the Cpack issuance pattern in admin.js. No block,
// cpack, or permissions controls here.
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
  USERS_COLLECTION,
} from "./firebase-config.js";
import { generateSerial } from "./helpers.js";
import { syncPassDoc } from "./pass-sync.js";

let allUsers = [];
let currentManager = { name: "", email: "" };

guardPage({
  requireAdmin: false, // enrolmngr is a permission flag, not the admin role
  onReady: async (user, profile) => {
    if (!profile.enrolmngr) {
      // Not granted this permission — bounce back to the regular dashboard
      window.location.href = "dashboard.html";
      return;
    }

    currentManager = { name: profile.fullName || "Enrollment Manager", email: user.email || "" };

    renderTopbar("enrollment-manager", { isAdmin: false });
    attachLogout("logoutBtn");
    await loadUsers();
    wireControls();

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  },
});

async function loadUsers() {
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  allUsers.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  document.getElementById("totalCount").textContent = allUsers.length;
  renderLists();
}

function wireControls() {
  document.getElementById("searchInput").addEventListener("input", renderLists);
}

function renderLists() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();

  // Blocked accounts are out of scope for enrolment approval either way
  const inScope = allUsers.filter((u) => !u.blocked);
  const matchesQuery = (u) =>
    !q ||
    (u.fullName || "").toLowerCase().includes(q) ||
    (u.email || "").toLowerCase().includes(q);

  const pending = inScope.filter((u) => u.status !== "approved" && matchesQuery(u));
  const approved = inScope.filter((u) => u.status === "approved" && matchesQuery(u));

  renderPending(pending);
  renderApproved(approved);
}

function renderPending(list) {
  const tbody = document.getElementById("pendingTableBody");
  const emptyState = document.getElementById("pendingEmptyState");
  document.getElementById("pendingCount").textContent = `(${list.length})`;

  if (list.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  tbody.innerHTML = list
    .map(
      (u) => `
        <tr class="hover:bg-slate-50/60 transition">
          <td class="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">${escapeHtml(u.fullName || "—")}</td>
          <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${escapeHtml(u.email || "—")}</td>
          <td class="px-4 py-3 text-slate-600 hidden md:table-cell whitespace-nowrap">${escapeHtml(u.organization || "—")}</td>
          <td class="px-4 py-3 text-right">
            <button data-action="approve" data-uid="${u.id}"
              class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-700 hover:bg-green-50 transition">
              Approve
            </button>
          </td>
        </tr>`
    )
    .join("");

  tbody.querySelectorAll('[data-action="approve"]').forEach((btn) => {
    btn.addEventListener("click", () => handleApprove(btn.dataset.uid));
  });
}

function renderApproved(list) {
  const tbody = document.getElementById("approvedTableBody");
  const emptyState = document.getElementById("approvedEmptyState");
  document.getElementById("approvedCount").textContent = `(${list.length})`;

  if (list.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  tbody.innerHTML = list
    .map(
      (u) => `
        <tr class="hover:bg-slate-50/60 transition">
          <td class="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">${escapeHtml(u.fullName || "—")}</td>
          <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${escapeHtml(u.email || "—")}</td>
          <td class="px-4 py-3 text-slate-600 hidden md:table-cell whitespace-nowrap">${escapeHtml(u.organization || "—")}</td>
          <td class="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">${escapeHtml(u.approvedByName || "—")}</td>
        </tr>`
    )
    .join("");
}

// Approval is one-way from this screen — no unapprove control here.
// If a mistaken approval needs reverting, that goes through the full
// admin panel, which retains that control.
async function handleApprove(uid) {
  const u = allUsers.find((x) => x.id === uid);
  if (!u || u.status === "approved") return; // already approved — nothing to do

  const ok = confirm(`Approve ${u.fullName}?\n\nThis cannot be undone from this screen.`);
  if (!ok) return;

  const updates = {
    status: "approved",
    approvedByName: currentManager.name,
    approvedByEmail: currentManager.email,
    approvedAt: serverTimestamp(),
  };

  // Assign a serial only the first time a user is approved
  if (!u.serial) {
    updates.serial = generateSerial();
  }

  try {
    await updateDoc(doc(db, USERS_COLLECTION, uid), updates);
    Object.assign(u, updates);
    await syncPassDoc(u);
    renderLists();
    showToast(`${u.fullName} approved.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to approve. Please try again.", "error");
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
  div.textContent = str;
  return div.innerHTML;
}