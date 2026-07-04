import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import { db, doc, getDoc, updateDoc, serverTimestamp, USERS_COLLECTION } from "./firebase-config.js";
import { generateSerial } from "./helpers.js";
import { syncPassDoc } from "./pass-sync.js";

const params = new URLSearchParams(window.location.search);
const targetUid = params.get("uid");

let targetProfile = null;
let currentAdmin = { name: "", email: "" };

guardPage({
  requireAdmin: true,
  onReady: async (user, profile) => {
    currentAdmin = { name: profile.fullName || "Admin", email: user.email || "" };

    renderTopbar("admin", { isAdmin: true });
    attachLogout("logoutBtn");

    if (!targetUid) {
      showNotFound();
      return;
    }

    const snap = await getDoc(doc(db, USERS_COLLECTION, targetUid));
    document.getElementById("loadingState").classList.add("hidden");

    if (!snap.exists()) {
      showNotFound();
      return;
    }

    targetProfile = snap.data();
    renderDetails();
    document.getElementById("content").classList.remove("hidden");
  },
});

function showNotFound() {
  document.getElementById("loadingState").classList.add("hidden");
  document.getElementById("notFoundState").classList.remove("hidden");
}

function formatDate(ts) {
  const d = ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : null;
  return d ? d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

function renderDetails() {
  const p = targetProfile;

  document.getElementById("detailName").textContent = p.fullName || "—";
  document.getElementById("detailEmail").textContent = p.email || "—";
  document.getElementById("detailPhone").textContent = p.phone || "—";
  document.getElementById("detailOrg").textContent = p.organization || "—";
  document.getElementById("detailRole").textContent = p.role || "participant";
  document.getElementById("detailSerial").textContent = p.serial || "Not assigned yet";
  document.getElementById("detailBlocked").textContent = p.blocked ? "Yes" : "No";

  document.getElementById("detailApprovedBy").textContent = p.approvedByName
    ? `${p.approvedByName} (${p.approvedByEmail || "—"}) on ${formatDate(p.approvedAt)}`
    : "—";

  document.getElementById("detailCpackBy").textContent = p.cpackIssuedByName
    ? `${p.cpackIssuedByName} (${p.cpackIssuedByEmail || "—"}) on ${formatDate(p.cpackIssuedAt)}`
    : "—";

  const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null;
  document.getElementById("detailCreatedAt").textContent = createdAt
    ? createdAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const badge = document.getElementById("detailStatusBadge");
  if (p.blocked) {
    badge.textContent = "Blocked";
    badge.className = "self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700";
  } else if (p.status === "approved") {
    badge.textContent = "Approved";
    badge.className = "self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700";
  } else {
    badge.textContent = "Pending";
    badge.className = "self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700";
  }

  // Prominent Cpack banner
  const banner = document.getElementById("cpackBanner");
  const bannerText = document.getElementById("cpackBannerText");
  const bannerMeta = document.getElementById("cpackBannerMeta");
  banner.classList.remove("hidden");
  if (p.cpackIssued) {
    banner.className = "mb-6 rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-blue-600 text-white";
    bannerText.textContent = "CONFERENCE PACK ISSUED";
    bannerMeta.textContent = p.cpackIssuedByName ? `by ${p.cpackIssuedByName} · ${formatDate(p.cpackIssuedAt)}` : "";
  } else {
    banner.className = "mb-6 rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-slate-100 text-slate-500 border border-slate-200";
    bannerText.textContent = "CONFERENCE PACK NOT ISSUED";
    bannerMeta.textContent = "";
  }

  const approveBtn = document.getElementById("toggleApproveBtn");
  approveBtn.textContent = p.status === "approved" ? "Unapprove Account" : "Approve Account";
  approveBtn.className = `px-4 py-2 rounded-lg text-sm font-semibold transition ${
    p.status === "approved" ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-green-600 text-white hover:bg-green-700"
  }`;
  approveBtn.onclick = handleToggleApprove;

  const blockBtn = document.getElementById("toggleBlockBtn");
  blockBtn.textContent = p.blocked ? "Unblock Account" : "Block Account (Temporary)";
  blockBtn.className = `px-4 py-2 rounded-lg text-sm font-semibold transition ${
    p.blocked ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-red-50 text-red-700 hover:bg-red-100"
  }`;
  blockBtn.onclick = handleToggleBlock;

  // Issue button — hidden once already issued (one-way action)
  const issueBtn = document.getElementById("issueCpackBtn");
  if (p.cpackIssued) {
    issueBtn.classList.add("hidden");
  } else {
    issueBtn.classList.remove("hidden");
    issueBtn.textContent = "Issue Cpack";
    issueBtn.className = "px-4 py-2 rounded-lg text-sm font-semibold transition bg-blue-600 text-white hover:bg-blue-700";
    issueBtn.onclick = handleIssueCpack;
  }

  /* --- Revoke Cpack button wiring (disabled by request; uncomment to re-enable) ---
  const revokeBtn = document.getElementById("revokeCpackBtn");
  if (revokeBtn) {
    if (!p.cpackIssued) {
      revokeBtn.classList.add("hidden");
    } else {
      revokeBtn.classList.remove("hidden");
      revokeBtn.textContent = "Revoke Cpack";
      revokeBtn.className = "px-4 py-2 rounded-lg text-sm font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200";
      revokeBtn.onclick = handleToggleCpack;
    }
  }
  --------------------------------------------------------------------------------- */
}

async function handleToggleApprove() {
  const nextStatus = targetProfile.status === "approved" ? "pending" : "approved";
  const updates = { status: nextStatus };
  if (nextStatus === "approved" && !targetProfile.serial) {
    updates.serial = generateSerial();
  }
  if (nextStatus === "approved") {
    updates.approvedByName = currentAdmin.name;
    updates.approvedByEmail = currentAdmin.email;
    updates.approvedAt = serverTimestamp();
  }

  try {
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), updates);
    Object.assign(targetProfile, updates);
    await syncPassDoc(targetProfile);
    renderDetails();
    showToast(nextStatus === "approved" ? "Account approved." : "Account set back to pending.");
  } catch (err) {
    console.error(err);
    showToast("Failed to update status.", "error");
  }
}

async function handleToggleBlock() {
  const nextBlocked = !targetProfile.blocked;
  try {
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), { blocked: nextBlocked });
    targetProfile.blocked = nextBlocked;
    await syncPassDoc(targetProfile);
    renderDetails();
    showToast(nextBlocked ? "Account blocked." : "Account unblocked.");
  } catch (err) {
    console.error(err);
    showToast("Failed to update block status.", "error");
  }
}

// One-way issuance — no toggle back once issued, matching the admin table.
async function handleIssueCpack() {
  if (targetProfile.cpackIssued) return;

  const ok = confirm(
    `Issue conference pack to ${targetProfile.fullName}?\n\nThis is a one-time action and cannot be undone from here.`
  );
  if (!ok) return;

  const updates = {
    cpackIssued: true,
    cpackIssuedAt: serverTimestamp(),
    cpackIssuedByName: currentAdmin.name,
    cpackIssuedByEmail: currentAdmin.email,
  };

  try {
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), updates);
    Object.assign(targetProfile, updates);
    await syncPassDoc(targetProfile);
    renderDetails();
    showToast("Cpack issued.");
  } catch (err) {
    console.error(err);
    showToast("Failed to update cpack status.", "error");
  }
}

/* --- Revoke handler (disabled by request; uncomment to re-enable) ---
async function handleToggleCpack() {
  const nextIssued = !targetProfile.cpackIssued;

  if (nextIssued) {
    const ok = confirm(`Issue conference pack to ${targetProfile.fullName}?`);
    if (!ok) return;
  }

  const updates = {
    cpackIssued: nextIssued,
    cpackIssuedAt: nextIssued ? serverTimestamp() : null,
    cpackIssuedByName: nextIssued ? currentAdmin.name : null,
    cpackIssuedByEmail: nextIssued ? currentAdmin.email : null,
  };

  try {
    await updateDoc(doc(db, USERS_COLLECTION, targetUid), updates);
    Object.assign(targetProfile, updates);
    await syncPassDoc(targetProfile);
    renderDetails();
    showToast(nextIssued ? "Cpack issued." : "Cpack issuance reverted.");
  } catch (err) {
    console.error(err);
    showToast("Failed to update cpack status.", "error");
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