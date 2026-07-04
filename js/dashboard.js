import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";

guardPage({
  requireAdmin: false,
  onReady: (user, profile) => {
    renderTopbar("dashboard", { isAdmin: profile.role === "admin" });
    attachLogout("logoutBtn");

    document.getElementById("userNameHeading").textContent = profile.fullName || "Participant";
    document.getElementById("userEmail").textContent = profile.email || user.email;

    const serialEl = document.getElementById("userSerial");
    if (profile.serial) {
      serialEl.textContent = `Serial: ${profile.serial}`;
      serialEl.classList.remove("hidden");
    }

    const badge = document.getElementById("statusBadge");
    const statusText = {
      pending: "Pending Approval",
      approved: "Approved",
    };
    badge.textContent = statusText[profile.status] || profile.status;

    // Prominent Cpack status — only shown once the account is approved,
    // since a pending account can't have a pack yet either way.
    if (profile.status === "approved") {
      const row = document.getElementById("cpackStatusRow");
      const cpackBadge = document.getElementById("cpackStatusBadge");
      row.classList.remove("hidden");
      if (profile.cpackIssued) {
        cpackBadge.textContent = "✔ Conference Pack Collected";
        cpackBadge.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-white text-brand-700";
      } else {
        cpackBadge.textContent = "Conference Pack Not Yet Collected";
        cpackBadge.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-white/15 text-white";
      }
    }

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  },
});