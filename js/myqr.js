import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";

guardPage({
  requireAdmin: false,
  onReady: (user, profile) => {
    renderTopbar("myqr", { isAdmin: profile.role === "admin" });
    attachLogout("logoutBtn");

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");

    if (profile.status === "approved" && profile.serial) {
      document.getElementById("approvedCard").classList.remove("hidden");
      document.getElementById("serialText").textContent = profile.serial;
      document.getElementById("qrName").textContent = profile.fullName || "—";
      document.getElementById("qrOrg").textContent = profile.organization || "—";

      const verifyUrl = `${window.location.origin}${window.location.pathname.replace(
        "myqr.html",
        "verify.html"
      )}?serial=${encodeURIComponent(profile.serial)}`;

      debugPrint(`[INFO] Generating QR for verify URL: ${verifyUrl}`);
      generateQrPng(verifyUrl);
    } else {
      debugPrint("[INFO] Profile not approved or missing serial — showing pending card.");
      document.getElementById("pendingCard").classList.remove("hidden");
    }
  },
});

function debugPrint(msg) {
  console.log(msg);
}

function showQrError(message) {
  const errEl = document.getElementById("qrError");
  errEl.textContent = message;
  errEl.className = "text-xs text-red-500 mt-3";
  errEl.classList.remove("hidden");
}

function generateQrPng(text) {
  const img = document.getElementById("qrImage");

  if (typeof QRCode === "undefined") {
    debugPrint("[ERROR] QRCode library not found — check js/lib/qrcode.min.js exists and path is correct.");
    showQrError("Couldn't load the QR code library. Please refresh the page.");
    return;
  }

  QRCode.toDataURL(
    text,
    { errorCorrectionLevel: "M", margin: 2, width: 220 },
    (err, dataUrl) => {
      if (err) {
        debugPrint(`[ERROR] QR generation failed: ${err.message || err}`);
        showQrError("Something went wrong generating your QR code.");
        return;
      }
      debugPrint("[SUCCESS] QR code generated.");
      img.src = dataUrl;
      img.classList.remove("hidden");
    }
  );
}