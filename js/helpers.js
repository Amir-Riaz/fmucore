// ============================================================
// FMUCORE — Shared Helpers
// ============================================================

// Turn raw Firebase error codes into friendly, human messages
export function friendlyAuthError(error) {
  const code = error?.code || "";
  const map = {
    "auth/email-already-in-use": "An account with this email already exists. Try logging in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
  };
  return map[code] || error?.message || "Something went wrong. Please try again.";
}

// Show an inline alert box inside a container element
export function showAlert(el, message, type = "error") {
  if (!el) return;
  const styles = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-700 border-green-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
  };
  el.className = `border rounded-lg px-4 py-3 text-sm mb-4 ${styles[type] || styles.error}`;
  el.textContent = message;
  el.classList.remove("hidden");
}

export function hideAlert(el) {
  if (!el) return;
  el.classList.add("hidden");
  el.textContent = "";
}

// Toggle a button into a loading state (disables it + shows spinner text)
export function setButtonLoading(btn, isLoading, loadingText = "Please wait...") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <span class="inline-flex items-center gap-2">
        <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        ${loadingText}
      </span>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
  }
}

// Simple client-side validators
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone) {
  return /^[+]?[\d\s-]{7,15}$/.test(phone);
}

// Generates a random serial like FMU-2026-4F8K2P (used at approval time later)
export function generateSerial() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FMU-${year}-${rand}`;
}
