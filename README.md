# FMUCORE Conference Portal

## How to run this on your PC (test locally)

Browsers block ES module imports (`type="module"`) when opened directly as a
`file://` path, so you need a tiny local web server. Pick whichever is easiest:

**Option A — VS Code Live Server (easiest, no terminal)**
1. Install the "Live Server" extension in VS Code.
2. Open the `fmucore` folder in VS Code.
3. Right-click `index.html` → "Open with Live Server".
4. It opens at something like `http://127.0.0.1:5500`.

**Option B — Python (already on most machines)**
```bash
cd fmucore
python -m http.server 8000
# then open http://localhost:8000
```

**Option C — Node**
```bash
cd fmucore
npx serve .
# then open the URL it prints
```

**Option D — Firebase Hosting emulator** (closest to production)
```bash
npm install -g firebase-tools
firebase login
cd fmucore
firebase init hosting   # point public directory to this folder
firebase serve
```

Any of these work for local testing. When you're ready to actually go live,
deploy with `firebase deploy` (Option D) or any static host (Netlify, Vercel,
GitHub Pages, etc.) since this is a pure static site.

## Firebase setup
1. Firebase Console → create/select project.
2. Add a Web App → copy config into `js/firebase-config.js` (marked block at the top).
3. Authentication → Sign-in method → enable **Email/Password**.
4. Firestore Database → create in production mode.
5. Paste the security rules below into Firestore → Rules.

To create your first admin: sign up normally through `signup.html`, then in
the Firestore console manually change that user's `role` field from
`"participant"` to `"admin"`.

## Firestore schema

**`users/{uid}`** — full profile, admin/owner-only reads (contains PII)
```
uid: string
fullName: string
email: string
phone: string
organization: string
role: "participant" | "admin"
status: "pending" | "approved"
blocked: boolean            // independent of status — a "temporary block" toggle
serial: string | null       // assigned once, the first time a user is approved
createdAt: timestamp
```

**`passes/{serial}`** — public-safe mirror, used only by `verify.html`.
Never contains email or phone. Kept in sync automatically by
`js/pass-sync.js` whenever an admin approves/unapproves/blocks/unblocks
someone.
```
serial: string
fullName: string
organization: string
status: "approved" | "pending" | "blocked"   // combined state
```

## Firestore security rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null &&
                   (request.auth.uid == userId || isAdmin());
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && isAdmin();

      function isAdmin() {
        return exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
      }
    }

    // Public read for the QR/serial verification page — no PII stored here.
    match /passes/{serial} {
      allow read: if true;
      allow write: if request.auth != null &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
  }
}
```

## Pages
| Page | Access | Purpose |
|---|---|---|
| `index.html` | public | landing page |
| `signup.html` | public | registration → status `pending` |
| `login.html` | public | login, routes admin vs participant, blocks blocked accounts |
| `dashboard.html` | logged-in | welcome card, status, quick links |
| `myqr.html` | logged-in | QR + serial once approved, else pending message |
| `admin.html` | admin only | searchable/paginated table, approve/unapprove, block/unblock |
| `user-details.html?uid=` | admin only | full profile + same actions |
| `verify.html` | public | look up a serial (typed or via `?serial=` from scanned QR) |
| `about.html`, `teams.html`, `speakers.html` | logged-in | placeholders — plug in real content later |

## Files
```
fmucore/
├── index.html, signup.html, login.html, dashboard.html, myqr.html,
│   admin.html, user-details.html, verify.html, about.html, teams.html, speakers.html
├── css/style.css
└── js/
    ├── firebase-config.js   ← edit this first with your real Firebase config
    ├── helpers.js           validation, alerts, serial generator
    ├── auth-guard.js        page protection + auto-logout
    ├── topbar.js            shared responsive nav bar
    ├── pass-sync.js         keeps passes/{serial} in sync on approve/block
    ├── signup.js, login.js, dashboard.js, myqr.js, admin.js,
    │   user-details.js, verify.js
```

## Notes on scale (1200–1600 participants)
- The admin table fetches all `users` docs once per page load, then
  searches/paginates client-side (25 rows/page) — fine at this scale
  (~1 read per doc, a few thousand reads total per admin session).
- If it later grows much larger, swap to Firestore `startAfter` cursor
  pagination instead of fetching everything up front — flag it if you want
  that built in.
