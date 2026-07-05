import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import { db, collection, query, where, getDocs, ABSTRACTS_COLLECTION } from "./firebase-config.js";

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

    loadAbstractSubmissions(user);

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  },
});

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

async function loadAbstractSubmissions(user) {
  const section = document.getElementById("abstractSection");
  const list = document.getElementById("abstractList");
  if (!section || !list) return; // dashboard.html not updated yet — skip quietly

  try {
    const q = query(collection(db, ABSTRACTS_COLLECTION), where("submittedBy.uid", "==", user.uid));
    const snap = await getDocs(q);
    if (snap.empty) return; // nothing submitted yet — leave the "Submit Abstract" tile as the call to action

    section.classList.remove("hidden");
    list.innerHTML = "";

    snap.docs.forEach((d) => {
      const a = d.data();
      const statusKey = a.status || "submitted";
      const li = document.createElement("li");
      li.className = "flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3";
      li.innerHTML = `
        <div class="min-w-0">
          <p class="font-bold text-sm text-slate-900 truncate">${escapeHtml(a.abstract?.title || "Untitled abstract")}</p>
          <p class="text-xs text-slate-500 font-mono mt-0.5">${escapeHtml(a.reviewKey || "—")}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${a.track ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700">${TRACK_LABEL[a.track] || a.track}</span>` : ""}
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[statusKey] || "bg-slate-100 text-slate-600"}">${STATUS_LABEL[statusKey] || statusKey}</span>
        </div>`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load abstract submissions", err);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
