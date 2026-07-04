import {
  auth,
  db,
  createUserWithEmailAndPassword,
  doc,
  setDoc,
  serverTimestamp,
  USERS_COLLECTION,
} from "./firebase-config.js";
import {
  friendlyAuthError,
  showAlert,
  hideAlert,
  setButtonLoading,
  isValidEmail,
  isValidPhone,
} from "./helpers.js";

const form = document.getElementById("signupForm");
const alertBox = document.getElementById("alertBox");
const submitBtn = document.getElementById("submitBtn");

function setFieldError(fieldName, message) {
  const el = form.querySelector(`.field-error[data-for="${fieldName}"]`);
  const input = document.getElementById(fieldName);
  if (el) {
    el.textContent = message;
    el.classList.toggle("hidden", !message);
  }
  if (input) {
    input.classList.toggle("border-red-400", !!message);
    input.classList.toggle("ring-2", !!message);
    input.classList.toggle("ring-red-100", !!message);
  }
}

function clearFieldErrors() {
  ["fullName", "email", "phone", "organization", "password", "confirmPassword"].forEach((f) =>
    setFieldError(f, "")
  );
}

function validate(data) {
  let valid = true;

  if (!data.fullName || data.fullName.trim().length < 3) {
    setFieldError("fullName", "Please enter your full name (min 3 characters).");
    valid = false;
  }
  if (!isValidEmail(data.email)) {
    setFieldError("email", "Please enter a valid email address.");
    valid = false;
  }
  if (!isValidPhone(data.phone)) {
    setFieldError("phone", "Please enter a valid phone number.");
    valid = false;
  }
  if (!data.organization || data.organization.trim().length < 2) {
    setFieldError("organization", "Please enter your institution/organization.");
    valid = false;
  }
  if (!data.password || data.password.length < 6) {
    setFieldError("password", "Password must be at least 6 characters.");
    valid = false;
  }
  if (data.password !== data.confirmPassword) {
    setFieldError("confirmPassword", "Passwords do not match.");
    valid = false;
  }

  return valid;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert(alertBox);
  clearFieldErrors();

  const data = {
    fullName: form.fullName.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    organization: form.organization.value.trim(),
    password: form.password.value,
    confirmPassword: form.confirmPassword.value,
  };

  if (!validate(data)) return;

  setButtonLoading(submitBtn, true, "Creating account...");

  try {
    // 1. Create the Firebase Auth user
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const uid = cred.user.uid;

    // 2. Create the Firestore profile document — status starts as "pending"
    await setDoc(doc(db, USERS_COLLECTION, uid), {
      uid,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      organization: data.organization,
      role: "participant",
      status: "pending", // pending | approved | blocked
      serial: null, // assigned by admin only upon approval
      createdAt: serverTimestamp(),
    });

    // 3. Redirect to login with a success flag
    window.location.href = "login.html?registered=1";
  } catch (error) {
    console.error(error);
    showAlert(alertBox, friendlyAuthError(error), "error");
    setButtonLoading(submitBtn, false);
  }
});
