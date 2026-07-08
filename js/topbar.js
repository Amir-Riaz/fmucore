// ============================================================
// FMUCORE — Shared Top Bar
// Injects the logo/name + nav links into a <div id="topbar"></div>
// Call renderTopbar(activePage, { isAdmin }) after you know the
// signed-in user's profile.
// ============================================================

const NAV_LINKS = [
  { key: "about", label: "About Us", href: "about.html" },
  { key: "teams", label: "Teams", href: "teams.html" },
  { key: "speakers", label: "Speakers", href: "speakers.html" },
  { key: "myqr", label: "My QR", href: "myqr.html" },
];

export function renderTopbar(activePage, { isAdmin = false } = {}) {
  const el = document.getElementById("topbar");
  if (!el) return;

  const linkHtml = (link) => `
    <a href="${link.href}"
       class="px-3 py-2 rounded-lg text-sm font-medium transition ${
         activePage === link.key
           ? "bg-brand-50 text-brand-700"
           : "text-slate-600 hover:text-brand-700 hover:bg-brand-50"
       }">
      ${link.label}
    </a>`;

  const adminLinkHtml = isAdmin
    ? `<a href="admin.html"
          class="px-3 py-2 rounded-lg text-sm font-medium transition ${
            activePage === "admin" ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:text-brand-700 hover:bg-brand-50"
          }">Admin</a>
       <a href="verify.html" target="_blank" rel="noopener"
          class="px-3 py-2 rounded-lg text-sm font-medium transition text-slate-600 hover:text-brand-700 hover:bg-brand-50">
          Verify
       </a>`
    : "";

  el.innerHTML = `
    <div class="w-full border-b border-slate-200 border-t-2 border-t-lime bg-white/90 backdrop-blur sticky top-0 z-40">
      <div class="max-w-6xl mx-auto px-4 sm:px-6">
        <div class="h-16 flex items-center justify-between">

         <a href="dashboard.html" class="flex items-center gap-2 shrink-0">
  <span class="font-mark text-lg text-brand-900 tracking-widest">FMU</span>
  <span class="font-display text-lg text-brand-600 leading-none">CORE</span>
</a>

          <!-- Desktop nav -->
          <nav class="hidden md:flex items-center gap-1">
            ${NAV_LINKS.map(linkHtml).join("")}
            ${adminLinkHtml}
            <button id="logoutBtn" class="ml-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition">
              Logout
            </button>
          </nav>

          <!-- Mobile hamburger -->
          <button id="mobileMenuBtn" class="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition" aria-label="Open menu">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile menu -->
      <div id="mobileMenu" class="md:hidden hidden border-t border-slate-200 bg-white">
        <div class="px-4 py-3 flex flex-col gap-1">
          ${NAV_LINKS.map(linkHtml).join("")}
          ${adminLinkHtml}
          <button id="logoutBtnMobile" class="mt-1 text-left px-3.5 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition">
            Logout
          </button>
        </div>
      </div>
    </div>
  `;

  const menuBtn = document.getElementById("mobileMenuBtn");
  const menu = document.getElementById("mobileMenu");
  menuBtn?.addEventListener("click", () => menu.classList.toggle("hidden"));

  // Mirror logout click on mobile button to the desktop one so auth-guard's
  // attachLogout (bound to #logoutBtn) also fires it
  document.getElementById("logoutBtnMobile")?.addEventListener("click", () => {
    document.getElementById("logoutBtn")?.click();
  });
}