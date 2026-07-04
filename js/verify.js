import { db, doc, getDoc, PASSES_COLLECTION } from "./firebase-config.js";

const form = document.getElementById("verifyForm");
const input = document.getElementById("serialInput");

const states = {
  idle: document.getElementById("idleState"),
  loading: document.getElementById("loadingState"),
  valid: document.getElementById("validState"),
  invalid: document.getElementById("invalidState"),
  revoked: document.getElementById("revokedState"),
};

function showState(name) {
  Object.values(states).forEach((el) => el.classList.add("hidden"));
  states[name].classList.remove("hidden");
}

function renderCpackBadge(issued) {
  const el = document.getElementById("resultCpack");
  if (issued) {
    el.textContent = "✔ Issued";
    el.className = "font-bold text-green-700";
  } else {
    el.textContent = "Not Issued";
    el.className = "font-bold text-amber-700";
  }
}

async function verifySerial(serial) {
  const clean = serial.trim().toUpperCase();
  if (!clean) return;

  showState("loading");

  try {
    // `passes/{serial}` only ever contains fullName, organization, serial,
    // status, and cpackIssued -- never email/phone -- so it's safe to read
    // without authentication.
    const snap = await getDoc(doc(db, PASSES_COLLECTION, clean));

    if (!snap.exists()) {
      showState("invalid");
      return;
    }

    const pass = snap.data();

    if (pass.status === "approved") {
      document.getElementById("resultName").textContent = pass.fullName || "—";
      document.getElementById("resultOrg").textContent = pass.organization || "—";
      document.getElementById("resultSerial").textContent = pass.serial;
      renderCpackBadge(!!pass.cpackIssued);
      showState("valid");
    } else {
      showState("revoked");
    }
  } catch (err) {
    console.error(err);
    showState("invalid");
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  verifySerial(input.value);
});

// Auto-run if a serial was passed in the URL (e.g. from a scanned QR code)
const params = new URLSearchParams(window.location.search);
const serialParam = params.get("serial");
if (serialParam) {
  input.value = serialParam;
  verifySerial(serialParam);
}