import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  USERS_COLLECTION,
} from "./firebase-config.js";
import {
  friendlyAuthError,
  showAlert,
  hideAlert,
  setButtonLoading,
  isValidEmail,
} from "./helpers.js";

const form = document.getElementById("loginForm");
const alertBox = document.getElementById("alertBox");
const submitBtn = document.getElementById("submitBtn");

// Show a success message if redirected here right after signing up
const params = new URLSearchParams(window.location.search);
if (params.get("registered") === "1") {
  showAlert(
    alertBox,
    "Account created! Your registration is pending admin approval. You can log in anytime to check your status.",
    "success"
  );
}
if (params.get("blocked") === "1") {
  showAlert(alertBox, "Your account has been temporarily blocked. Please contact the organizers.", "warning");
}

function setFieldError(fieldName, message) {
  const el = form.querySelector(`.field-error[data-for="${fieldName}"]`);
  const input = document.getElementById(fieldName);
  if (el) {
    el.textContent = message;
    el.classList.toggle("hidden", !message);
  }
  if (input) {
    input.classList.toggle("border-red-400", !!message);
  }
}

function clearFieldErrors() {
  ["email", "password"].forEach((f) => setFieldError(f, ""));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert(alertBox);
  clearFieldErrors();

  const email = form.email.value.trim();
  const password = form.password.value;

  let valid = true;
  if (!isValidEmail(email)) {
    setFieldError("email", "Please enter a valid email address.");
    valid = false;
  }
  if (!password) {
    setFieldError("password", "Please enter your password.");
    valid = false;
  }
  if (!valid) return;

  setButtonLoading(submitBtn, true, "Logging in...");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Fetch the Firestore profile to check status + role
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));

    if (!snap.exists()) {
      await signOut(auth);
      showAlert(alertBox, "No profile found for this account. Please contact the organizers.", "error");
      setButtonLoading(submitBtn, false);
      return;
    }

    const profile = snap.data();

    if (profile.status === "blocked") {
      await signOut(auth);
      showAlert(alertBox, "Your account has been temporarily blocked. Please contact the organizers.", "warning");
      setButtonLoading(submitBtn, false);
      return;
    }

    // Route by role — admins go to the admin panel, participants to the dashboard
    if (profile.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    console.error(error);
    showAlert(alertBox, friendlyAuthError(error), "error");
    setButtonLoading(submitBtn, false);
  }
});
