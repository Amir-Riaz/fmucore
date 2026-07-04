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

const PAGE_SIZE = 25;

let allUsers = []; // full list from Firestore
let filtered = []; // after search/status filter
let currentPage = 1;
let currentAdmin = { name: "", email: "" }; // who is performing actions on this session

guardPage({
  requireAdmin: true,
  onReady: async (user, profile) => {
    currentAdmin = { name: profile.fullName || "Admin", email: user.email || "" };

    renderTopbar("admin", { isAdmin: true });
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
  // newest registrations first
  allUsers.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  document.getElementById("totalCount").textContent = allUsers.length;
  applyFilters();
}

function wireControls() {
  document.getElementById("searchInput").addEventListener("input", () => {
    currentPage = 1;
    applyFilters();
  });
  document.getElementById("statusFilter").addEventListener("change", () => {
    currentPage = 1;
    applyFilters();
  });
  document.getElementById("cpackFilter").addEventListener("change", () => {
    currentPage = 1;
    applyFilters();
  });
  document.getElementById("prevPageBtn").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });
  document.getElementById("nextPageBtn").addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;
  const cpackFilter = document.getElementById("cpackFilter").value;

  filtered = allUsers.filter((u) => {
    const matchesQuery =
      !q ||
      (u.fullName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === "blocked") matchesStatus = !!u.blocked;
    else if (statusFilter === "pending") matchesStatus = u.status === "pending" && !u.blocked;
    else if (statusFilter === "approved") matchesStatus = u.status === "approved" && !u.blocked;

    let matchesCpack = true;
    if (cpackFilter === "issued") matchesCpack = !!u.cpackIssued;
    else if (cpackFilter === "not_issued") matchesCpack = !u.cpackIssued;

    return matchesQuery && matchesStatus && matchesCpack;
  });

  renderTable();
}

function statusBadge(u) {
  if (u.blocked) {
    return `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700">Blocked</span>`;
  }
  if (u.status === "approved") {
    return `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700">Approved</span>`;
  }
  return `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">Pending</span>`;
}

// Prominent Cpack indicator — a solid, unmissable pill rather than a
// plain badge, since admins need to eyeball this quickly at scale.
function cpackBadge(u) {
  if (u.cpackIssued) {
    return `
      <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold bg-blue-600 text-white shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        CPACK ISSUED
      </span>`;
  }
  return `<span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">Not Issued</span>`;
}

function renderTable() {
  const tbody = document.getElementById("usersTableBody");
  const emptyState = document.getElementById("emptyState");
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  if (pageItems.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
    tbody.innerHTML = pageItems
      .map((u) => {
        const approveLabel = u.status === "approved" ? "Unapprove" : "Approve";
        const approveColor =
          u.status === "approved"
            ? "text-amber-700 hover:bg-amber-50"
            : "text-green-700 hover:bg-green-50";
        const blockLabel = u.blocked ? "Unblock" : "Block";
        const blockColor = u.blocked
          ? "text-slate-700 hover:bg-slate-100"
          : "text-red-700 hover:bg-red-50";

        // Once a cpack is issued, no "Revoke" button is rendered — issuance
        // is treated as a one-way, audited action. The revoke button markup
        // is kept below (commented out) in case it needs to be re-enabled.
        const cpackActionHtml = u.cpackIssued
          ? `<span class="text-[11px] text-slate-400">by ${escapeHtml(u.cpackIssuedByName || "—")}</span>`
          : `<button data-action="issue-cpack" data-uid="${u.id}"
               class="px-2.5 py-1 rounded-lg text-xs font-semibold transition text-blue-700 hover:bg-blue-50">
               Issue Cpack
             </button>`;

        /* --- Revoke button (disabled by request; uncomment to re-enable) ---
        const cpackRevokeHtml = u.cpackIssued
          ? `<button data-action="toggle-cpack" data-uid="${u.id}"
               class="px-2.5 py-1 rounded-lg text-xs font-semibold transition text-slate-600 hover:bg-slate-100">
               Revoke
             </button>`
          : "";
        --------------------------------------------------------------------- */

        return `
          <tr class="hover:bg-slate-50/60 transition">
            <td class="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">${escapeHtml(u.fullName || "—")}</td>
            <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${escapeHtml(u.email || "—")}</td>
            <td class="px-4 py-3 text-slate-600 hidden md:table-cell whitespace-nowrap">${escapeHtml(u.organization || "—")}</td>
            <td class="px-4 py-3">${statusBadge(u)}</td>
            <td class="px-4 py-3 text-center">
              <div class="flex flex-col items-center gap-1">
                ${cpackBadge(u)}
                ${cpackActionHtml}
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-1.5 flex-wrap">
                <a href="user-details.html?uid=${encodeURIComponent(u.id)}"
                   class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition">
                  View
                </a>
                <button data-action="toggle-approve" data-uid="${u.id}"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${approveColor}">
                  ${approveLabel}
                </button>
                <button data-action="toggle-block" data-uid="${u.id}"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${blockColor}">
                  ${blockLabel}
                </button>
              </div>
            </td>
          </tr>`;
      })
      .join("");
  }

  document.getElementById("rangeStart").textContent = filtered.length === 0 ? 0 : start + 1;
  document.getElementById("rangeEnd").textContent = Math.min(start + PAGE_SIZE, filtered.length);
  document.getElementById("filteredCount").textContent = filtered.length;
  document.getElementById("pageIndicator").textContent = `${currentPage} / ${totalPages}`;
  document.getElementById("prevPageBtn").disabled = currentPage <= 1;
  document.getElementById("nextPageBtn").disabled = currentPage >= totalPages;

  wireRowActions();
}

function wireRowActions() {
  document.querySelectorAll('[data-action="toggle-approve"]').forEach((btn) => {
    btn.addEventListener("click", () => handleToggleApprove(btn.dataset.uid));
  });
  document.querySelectorAll('[data-action="toggle-block"]').forEach((btn) => {
    btn.addEventListener("click", () => handleToggleBlock(btn.dataset.uid));
  });
  document.querySelectorAll('[data-action="issue-cpack"]').forEach((btn) => {
    btn.addEventListener("click", () => handleIssueCpack(btn.dataset.uid));
  });
  // Revoke wiring intentionally disabled — see cpackRevokeHtml comment above.
  // document.querySelectorAll('[data-action="toggle-cpack"]').forEach((btn) => {
  //   btn.addEventListener("click", () => handleToggleCpack(btn.dataset.uid));
  // });
}

async function handleToggleApprove(uid) {
  const u = allUsers.find((x) => x.id === uid);
  if (!u) return;

  const nextStatus = u.status === "approved" ? "pending" : "approved";
  const updates = { status: nextStatus };

  // Assign a serial only the first time a user is approved — keeps the same
  // QR/serial valid across future unapprove/reapprove cycles.
  if (nextStatus === "approved" && !u.serial) {
    updates.serial = generateSerial();
  }

  // Record which admin approved this account, and when — check-and-balance
  // trail so it's clear who signed off.
  if (nextStatus === "approved") {
    updates.approvedByName = currentAdmin.name;
    updates.approvedByEmail = currentAdmin.email;
    updates.approvedAt = serverTimestamp();
  }

  try {
    await updateDoc(doc(db, USERS_COLLECTION, uid), updates);
    Object.assign(u, updates);
    await syncPassDoc(u);
    renderTable();
    showToast(
      nextStatus === "approved" ? `${u.fullName} approved.` : `${u.fullName} set back to pending.`,
      "success"
    );
  } catch (err) {
    console.error(err);
    showToast("Failed to update status. Please try again.", "error");
  }
}

async function handleToggleBlock(uid) {
  const u = allUsers.find((x) => x.id === uid);
  if (!u) return;

  const nextBlocked = !u.blocked;

  try {
    await updateDoc(doc(db, USERS_COLLECTION, uid), { blocked: nextBlocked });
    u.blocked = nextBlocked;
    await syncPassDoc(u);
    renderTable();
    showToast(nextBlocked ? `${u.fullName} blocked.` : `${u.fullName} unblocked.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to update block status. Please try again.", "error");
  }
}

// Issuing a cpack is one-way from the UI — no toggle back to "not issued".
// This is the check-and-balance measure so nobody accidentally double-issues.
async function handleIssueCpack(uid) {
  const u = allUsers.find((x) => x.id === uid);
  if (!u || u.cpackIssued) return; // already issued — nothing to do

  const ok = confirm(
    `Issue conference pack to ${u.fullName}?\n\nThis is a one-time action and cannot be undone from here.`
  );
  if (!ok) return;

  const updates = {
    cpackIssued: true,
    cpackIssuedAt: serverTimestamp(),
    cpackIssuedByName: currentAdmin.name,
    cpackIssuedByEmail: currentAdmin.email,
  };

  try {
    await updateDoc(doc(db, USERS_COLLECTION, uid), updates);
    Object.assign(u, updates);
    await syncPassDoc(u);
    renderTable();
    showToast(`Cpack issued to ${u.fullName}.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to update cpack status. Please try again.", "error");
  }
}

/* --- Revoke handler (disabled by request; uncomment to re-enable) ---
async function handleToggleCpack(uid) {
  const u = allUsers.find((x) => x.id === uid);
  if (!u) return;

  const nextIssued = !u.cpackIssued;

  if (nextIssued) {
    const ok = confirm(`Issue conference pack to ${u.fullName}?`);
    if (!ok) return;
  }

  const updates = {
    cpackIssued: nextIssued,
    cpackIssuedAt: nextIssued ? serverTimestamp() : null,
    cpackIssuedByName: nextIssued ? currentAdmin.name : null,
    cpackIssuedByEmail: nextIssued ? currentAdmin.email : null,
  };

  try {
    await updateDoc(doc(db, USERS_COLLECTION, uid), updates);
    Object.assign(u, updates);
    await syncPassDoc(u);
    renderTable();
    showToast(
      nextIssued ? `Cpack issued to ${u.fullName}.` : `Cpack issuance reverted for ${u.fullName}.`,
      "success"
    );
  } catch (err) {
    console.error(err);
    showToast("Failed to update cpack status. Please try again.", "error");
  }
}
--------------------------------------------------------------------- */

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