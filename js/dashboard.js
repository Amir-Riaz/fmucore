import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import { db, collection, query, where, getDocs, getDoc, doc, ABSTRACTS_COLLECTION, SETTINGS_COLLECTION } from "./firebase-config.js";
import { generateCertificate, showCertificateInNewTab } from "./certificate.js";

let certificatesIssuedToAll = false;
let currentTicketAbstract = null; // tracks which abstract is shown in the ticket modal, for the download filename

guardPage({
  requireAdmin: false,
  onReady: async (user, profile) => {
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

    // Reveal management tiles for accounts holding special (non-admin) permissions
    toggleTile("studrwrTile", profile.studrwr);
    toggleTile("facrwrTile", profile.facrwr);
    toggleTile("enrolmngrTile", profile.enrolmngr);
    toggleTile("rwrsetTile", profile.rwrset);

    if (profile.studrwr || profile.facrwr || profile.enrolmngr || profile.rwrset) {
      document.getElementById("specialRolesSection")?.classList.remove("hidden");
    }

    // Gate abstract submission behind approval status
    guardSubmitAbstractTile(profile);

    await loadGlobalCertSetting();
    loadAbstractSubmissions(user, profile);

    document.getElementById("closeTicketModal")?.addEventListener("click", () => {
      document.getElementById("ticketModal").classList.add("hidden");
    });
    document.getElementById("downloadTicketBtn")?.addEventListener("click", downloadTicketPng);

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  },
});

async function loadGlobalCertSetting() {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, "global"));
    certificatesIssuedToAll = !!(snap.exists() && snap.data().certificatesIssuedToAll);
  } catch (err) {
    console.error("Failed to load global certificate setting", err);
    certificatesIssuedToAll = false;
  }
}

function toggleTile(id, enabled) {
  const el = document.getElementById(id);
  if (el && enabled) el.classList.remove("hidden");
}

function openTicketModal(abstractData, profile) {
  currentTicketAbstract = abstractData;
  document.getElementById("ticketName").textContent = profile.fullName || "—";
  document.getElementById("ticketEmail").textContent = profile.email || "—";
  document.getElementById("ticketSerial").textContent = profile.serial || "—";
  document.getElementById("ticketTitle").textContent = abstractData.abstract?.title || "Untitled abstract";
  document.getElementById("ticketTrack").textContent = TRACK_LABEL[abstractData.track] || "To be announced";
  document.getElementById("ticketModal").classList.remove("hidden");
}

async function downloadTicketPng() {
  const card = document.getElementById("ticketCard");
  if (!card) return;

  if (typeof html2canvas === "undefined") {
    console.error("html2canvas is not loaded — add the script tag to dashboard.html");
    return;
  }

  const btn = document.getElementById("downloadTicketBtn");
  const originalLabel = btn ? btn.textContent : null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Preparing…";
  }

  try {
    await document.fonts.ready;
    const canvas = await html2canvas(card, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    const key = currentTicketAbstract?.reviewKey || "pass";
    link.download = `FMU-CORE-2026-Pass-${key}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error("Failed to generate pass image", err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
}

async function downloadCertificate(abstractData, profile) {
  await document.fonts.ready;
  const canvas = generateCertificate({
    name: profile.fullName,
    title: abstractData.abstract?.title,
    track: TRACK_LABEL[abstractData.track] || "General",
    serial: profile.serial,
  });
  showCertificateInNewTab(canvas, `FMU-CORE-2026-Certificate-${abstractData.reviewKey || "cert"}.png`);
}

function guardSubmitAbstractTile(profile) {
  const tile = document.getElementById("submitAbstractTile");
  const lockNote = document.getElementById("submitAbstractLockNote");
  if (!tile || profile.status === "approved") return;

  tile.classList.add("opacity-60", "cursor-not-allowed");
  tile.classList.remove("hover:shadow-lg", "hover:border-brand-200");
  lockNote?.classList.remove("hidden");

  tile.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Only approved accounts can submit an abstract. Please wait for your registration to be approved.");
  });
}

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

async function loadAbstractSubmissions(user, profile) {
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
      const certUnlocked = !!a.isscert || certificatesIssuedToAll;
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
          ${certUnlocked ? `<button data-cert-id="${d.id}" class="w-8 h-8 flex items-center justify-center rounded-full bg-brand-50 hover:bg-brand-100 transition" title="Download certificate">🎓</button>` : ""}
          ${statusKey === "accepted" ? `<button data-ticket-id="${d.id}" class="w-8 h-8 flex items-center justify-center rounded-full bg-lime/40 hover:bg-lime/70 transition" title="View your pass">🎫</button>` : ""}
        </div>`;
      list.appendChild(li);

      if (statusKey === "accepted") {
        li.querySelector(`[data-ticket-id="${d.id}"]`)?.addEventListener("click", () => openTicketModal(a, profile));

        const seenKey = `ticketSeen_${d.id}`;
        if (!localStorage.getItem(seenKey)) {
          localStorage.setItem(seenKey, "1");
          setTimeout(() => openTicketModal(a, profile), 400);
        }
      }

      if (certUnlocked) {
        li.querySelector(`[data-cert-id="${d.id}"]`)?.addEventListener("click", () => downloadCertificate(a, profile));
      }
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
