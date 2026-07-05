import { guardPage, attachLogout } from "./auth-guard.js";
import { renderTopbar } from "./topbar.js";
import {
  INSTITUTES, FIELDS_OF_STUDY, YEARS_OF_STUDY, PROVINCES, CITIES_BY_PROVINCE,
  SPECIALTIES, ABSTRACT_TYPES, AUTHOR_RANKS, AUTHOR_STATUSES
} from "./abstract-data.js";
import { db, collection, doc, setDoc, serverTimestamp, ABSTRACTS_COLLECTION } from "./firebase-config.js";
import { syncAbstractReviewView } from "./abstract-review-sync.js";

const WORD_LIMIT = 300;
const MAX_FILE_MB = 5;
const COUNTED_FIELDS = ["introduction", "objectives", "methodology", "results", "conclusion"];

const state = {
  currentStep: 1,
  completedSteps: new Set(),
  erroredSteps: new Set(),
  values: {},        // flat field values, keyed by data-field
  files: {},         // { resultCard, figure1, figure2 } -> File
  keywords: [],
  authors: [],        // { id, firstName, lastName, email, affiliation, status, rank }
  editingAuthorId: null,
};

// ---------------------------------------------------------------
// Autofill from the user's existing Firestore profile (users/{uid})
// so they don't retype what we already know about them.
// ---------------------------------------------------------------
function prefillFromProfile(user, profile) {
  const setValue = (name, value) => {
    if (!value) return;
    const el = document.querySelector(`[data-field="${name}"]`);
    if (!el) return;
    el.value = value;
    state.values[name] = value;
  };

  const [firstName, ...rest] = (profile.fullName || "").trim().split(/\s+/);
  if (firstName) setValue("firstName", firstName);
  if (rest.length) setValue("lastName", rest.join(" "));

  setValue("email", profile.email || user.email || "");
  setValue("phone", profile.phone || profile.whatsapp || "");

  // Institute: only prefill if it's an exact match in our list, otherwise
  // fall back to "Others" + the free-text field so nothing is silently lost.
  if (profile.organization) {
    if (INSTITUTES.includes(profile.organization)) {
      setValue("institute", profile.organization);
    } else {
      setValue("institute", "Others");
      document.querySelector('[data-field-wrap="instituteOther"]').classList.remove("hidden");
      setValue("instituteOther", profile.organization);
    }
  }

  if (profile.province) {
    setValue("province", profile.province);
    const citySelect = document.querySelector('[data-field="city"]');
    const cities = CITIES_BY_PROVINCE[profile.province] || [];
    citySelect.disabled = cities.length === 0;
    fillSelect(citySelect, cities, cities.length ? "Select your city" : "Select a province first");
    if (profile.city) setValue("city", profile.city);
  }
}

function fillSelect(select, options, placeholder) {
  select.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  select.appendChild(opt0);
  options.forEach((label) => {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

function wordCount(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
// File inputs live inside a `data-dropzone` box; their error message lives
// in the OUTER wrapper (a sibling of the dropzone), not inside it.
function findFieldWrapper(fieldEl) {
  const dropzone = fieldEl.closest("[data-dropzone]");
  if (dropzone) return dropzone.parentElement;
  return fieldEl.closest("div");
}


function setError(fieldEl, show) {
  const wrap = findFieldWrapper(fieldEl);
  const msg = wrap ? wrap.querySelector(".field-error-msg") : null;
  fieldEl.classList.toggle("field-error", show);
  if (msg) msg.classList.toggle("show", show);
}

// Returns the human-readable text already sitting in a field's
// `.field-error-msg` element, so the summary box and the inline
// per-field message always say exactly the same thing.
function getFieldErrorMsg(fieldEl) {
  const wrap = findFieldWrapper(fieldEl);
    const msg = wrap ? wrap.querySelector(".field-error-msg") : null;
  return msg ? msg.textContent.trim() : null;
}

// Renders (or hides) the red "Please fix the following" box that sits
// directly under each step's heading/instructions.
function renderStepSummary(step, messages) {
  const panel = document.querySelector(`[data-panel-step="${step}"]`);
  if (!panel) return;
  const summary = panel.querySelector("[data-step-summary]");
  const list = panel.querySelector("[data-step-summary-list]");
  if (!summary || !list) return;

  if (messages.length === 0) {
    summary.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  list.innerHTML = messages.map((m) => `<li>${m}</li>`).join("");
  summary.classList.remove("hidden");
}

// ---------------------------------------------------------------
// Step grid + panel switching
// ---------------------------------------------------------------
function refreshStepGrid() {
  document.querySelectorAll(".step-tile").forEach((tile) => {
    const step = Number(tile.dataset.step);
    const isActive = step === state.currentStep;
    const isComplete = state.completedSteps.has(step);
    const hasError = state.erroredSteps.has(step);
    tile.dataset.state = hasError ? "error" : isComplete ? "complete" : isActive ? "active" : "upcoming";

    const numEl = tile.querySelector(".step-num");
    const flagEl = tile.querySelector(".step-tile-flag");
    tile.classList.remove(
      "border-brand-500", "bg-brand-50", "border-emerald-300", "bg-emerald-50",
      "border-slate-200", "border-red-300", "bg-red-50"
    );
    numEl.classList.remove("bg-brand-600", "text-white", "bg-emerald-500", "bg-slate-100", "text-slate-500", "bg-red-500");

    if (hasError) {
      tile.classList.add("border-red-300", "bg-red-50");
      numEl.classList.add("bg-red-500", "text-white");
    } else if (isComplete) {
      tile.classList.add("border-emerald-300", "bg-emerald-50");
      numEl.classList.add("bg-emerald-500", "text-white");
    } else if (isActive) {
      tile.classList.add("border-brand-500", "bg-brand-50");
      numEl.classList.add("bg-brand-600", "text-white");
    } else {
      tile.classList.add("border-slate-200");
      numEl.classList.add("bg-slate-100", "text-slate-500");
    }

    if (flagEl) flagEl.classList.toggle("hidden", !hasError);
  });
}

// Jumps to the first field with a visible error inside a panel, scrolls it
// into view, and focuses it so the person can fix it in one tap/click.
function scrollToFirstInvalid(step) {
  const panel = document.querySelector(`[data-panel-step="${step}"]`);
  if (!panel) return;
  // Prefer scrolling to the summary box itself so the person sees the full
  // list of what's wrong before landing on any one field.
  const summary = panel.querySelector("[data-step-summary]:not(.hidden)");
  if (summary) {
    summary.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const firstInvalid = panel.querySelector(".field-error, [data-keywords-box].field-error");
  if (!firstInvalid) return;
  firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
  if (typeof firstInvalid.focus === "function") firstInvalid.focus({ preventScroll: true });
}

function goToStep(step) {
  state.currentStep = step;
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("active", Number(panel.dataset.panelStep) === step);
  });
  refreshStepGrid();
  document.getElementById("content").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------
// Validation per step
// ---------------------------------------------------------------
function validateStep(step) {
  let valid = true;
  const messages = [];
  const panel = document.querySelector(`[data-panel-step="${step}"]`);

  const requiredFields = Array.from(panel.querySelectorAll("[data-field]")).filter((el) => {
    // Skip fields hidden inside a collapsed wrapper (e.g. institute "Others" free text)
    const wrap = el.closest("[data-field-wrap]");
    if (wrap && wrap.classList.contains("hidden")) return false;
    if (el.disabled) return false;
    return true;
  });

  requiredFields.forEach((el) => {
    const name = el.dataset.field;
    const label = el.closest("div").querySelector("label");
    const isOptional = label && !label.querySelector(".text-red-500");
    if (isOptional) return;

    let empty;
    if (el.type === "file") {
      empty = !state.files[name];
    } else {
      empty = !el.value || !el.value.trim();
    }

    if (name === "email" && !empty) {
      empty = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
    }
    if (name === "phone" && !empty) {
      empty = !/^[0-9+\-\s]{7,15}$/.test(el.value.trim());
    }

    setError(el, empty);
    if (empty) {
      valid = false;
      const msg = getFieldErrorMsg(el);
      if (msg && !messages.includes(msg)) messages.push(msg);
    }
  });

  // File type/size checks (already validated on change, but re-check for safety)
  panel.querySelectorAll('input[type="file"][data-field]').forEach((input) => {
    const name = input.dataset.field;
    const file = state.files[name];
    if (!file) return;
    const isTiff = /\.(tif|tiff)$/i.test(file.name);
    const isResultCard = name === "resultCard";
    const sizeOk = file.size <= MAX_FILE_MB * 1024 * 1024;
    const typeOk = isResultCard ? /\.(jpg|jpeg|png|pdf)$/i.test(file.name) : isTiff;
    if (!sizeOk || !typeOk) {
      setError(input, true);
      valid = false;
      const msg = getFieldErrorMsg(input);
      if (msg && !messages.includes(msg)) messages.push(msg);
    }
  });

  if (step === 3) {
    const totalWords = COUNTED_FIELDS.reduce((sum, f) => sum + wordCount(state.values[f]), 0);
    const wordLimitMsgEl = document.querySelector("[data-word-limit-msg]");

    console.groupCollapsed("[Step 3 debug] Continue clicked");
    console.log("values:", { ...state.values });
    console.log("keywords:", [...state.keywords]);
    console.log("files:", {
      figure1: state.files.figure1 ? state.files.figure1.name : null,
      figure2: state.files.figure2 ? state.files.figure2.name : null,
    });


    if (totalWords > WORD_LIMIT) {
      valid = false;
      if (wordLimitMsgEl) wordLimitMsgEl.classList.remove("hidden");
      messages.push(`Your abstract is ${totalWords} words — please shorten it to ${WORD_LIMIT} words or fewer.`);
    } else if (wordLimitMsgEl) {
      wordLimitMsgEl.classList.add("hidden");
    }

    if (state.keywords.length === 0) {
      const box = document.querySelector("[data-keywords-box]");
      const msg = box.parentElement.querySelector(".field-error-msg");
      msg.classList.add("show");
      box.classList.add("field-error");
      valid = false;
      messages.push("Add at least one keyword.");
    } else {
      const box = document.querySelector("[data-keywords-box]");
      box.classList.remove("field-error");
      box.parentElement.querySelector(".field-error-msg").classList.remove("show");
    }
  }

  if (step === 3) {
    console.log("messages:", messages, "| valid:", valid);
    console.groupEnd();
  }
  
  renderStepSummary(step, messages);

  return valid;
}

// ---------------------------------------------------------------
// Field wiring (text/select inputs -> state.values)
// ---------------------------------------------------------------
function wireGenericFields() {
  document.querySelectorAll("[data-field]").forEach((el) => {
    if (el.type === "file") return;
    el.addEventListener("input", () => {
      state.values[el.dataset.field] = el.value;
      setError(el, false);
      if (el.dataset.counted !== undefined) updateWordCount();
    });
  });

  // Institute "Others" reveal
  const instituteSelect = document.querySelector('[data-field="institute"]');
  const instituteOtherWrap = document.querySelector('[data-field-wrap="instituteOther"]');
  instituteSelect.addEventListener("change", () => {
    const isOther = instituteSelect.value === "Others";
    instituteOtherWrap.classList.toggle("hidden", !isOther);
  });

  // Province -> City
  const provinceSelect = document.querySelector('[data-field="province"]');
  const citySelect = document.querySelector('[data-field="city"]');
  provinceSelect.addEventListener("change", () => {
    const cities = CITIES_BY_PROVINCE[provinceSelect.value] || [];
    citySelect.disabled = cities.length === 0;
    fillSelect(citySelect, cities, cities.length ? "Select your city" : "Select a province first");
    state.values.city = "";
  });

  // Speciality -> Sub-speciality
  const specialitySelect = document.querySelector('[data-field="speciality"]');
  const subSelect = document.querySelector('[data-field="subSpeciality"]');
  specialitySelect.addEventListener("change", () => {
    const entry = SPECIALTIES.find((s) => s.specialty === specialitySelect.value);
    const subs = entry ? entry.subspecialties : [];
    subSelect.disabled = subs.length === 0;
    fillSelect(subSelect, subs, subs.length ? "Select a sub speciality" : "No sub specialities for this field");
    state.values.subSpeciality = "";
  });
}

function updateWordCount() {
  const total = COUNTED_FIELDS.reduce((sum, f) => sum + wordCount(state.values[f]), 0);
  const el = document.querySelector("[data-word-count]");
  el.textContent = total;
  el.classList.toggle("text-red-600", total > WORD_LIMIT);
  el.classList.toggle("text-brand-600", total <= WORD_LIMIT);

  // Hide the dedicated word-limit warning as soon as they're back under the
  // limit, without waiting for them to click Continue again.
  const wordLimitMsgEl = document.querySelector("[data-word-limit-msg]");
  if (wordLimitMsgEl && total <= WORD_LIMIT) wordLimitMsgEl.classList.add("hidden");
}

// ---------------------------------------------------------------
// File dropzones
// ---------------------------------------------------------------
function wireDropzones() {
  document.querySelectorAll("[data-dropzone]").forEach((zone) => {
    const name = zone.dataset.dropzone;
    const input = zone.querySelector('input[type="file"]');
    const label = zone.querySelector("[data-dropzone-label]");
    const defaultText = label.textContent;

    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;

      const isResultCard = name === "resultCard";
      const sizeOk = file.size <= MAX_FILE_MB * 1024 * 1024;
      const typeOk = isResultCard ? /\.(jpg|jpeg|png|pdf)$/i.test(file.name) : /\.(tif|tiff)$/i.test(file.name);

      if (!sizeOk || !typeOk) {
        setError(input, true);
        state.files[name] = null;
        label.textContent = defaultText;
        return;
      }

      setError(input, false);
      state.files[name] = file;
      label.textContent = file.name;
      zone.classList.add("border-emerald-400");
    });
  });
}

// ---------------------------------------------------------------
// Keywords chip input
// ---------------------------------------------------------------
function wireKeywords() {
  const box = document.querySelector("[data-keywords-box]");
  const input = document.querySelector("[data-keywords-input]");

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    if (state.keywords.length >= 3) return;
    if (state.keywords.includes(value)) { input.value = ""; return; }

    state.keywords.push(value);
    renderKeywordChip(value);
    input.value = "";
    if (state.keywords.length >= 3) input.disabled = true;

    box.classList.remove("field-error");
    box.parentElement.querySelector(".field-error-msg").classList.remove("show");
  });

  function renderKeywordChip(value) {
    const chip = document.createElement("span");
    chip.className = "chip-in inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-bold px-2.5 py-1 rounded-full";
    chip.textContent = value;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-brand-400 hover:text-brand-700";
    remove.innerHTML = "&times;";
    remove.addEventListener("click", () => {
      state.keywords = state.keywords.filter((k) => k !== value);
      chip.remove();
      input.disabled = false;
    });
    chip.appendChild(remove);
    box.insertBefore(chip, input);
  }
}

// ---------------------------------------------------------------
// Author modal
// ---------------------------------------------------------------
let openAuthorModal = () => {};

function wireAuthorModal() {
  const modal = document.querySelector("[data-author-modal]");
  const affiliationSelect = modal.querySelector('[data-author-field="affiliation"]');
  const statusSelect = modal.querySelector('[data-author-field="status"]');
  const rankSelect = modal.querySelector('[data-author-field="rank"]');

  fillSelect(affiliationSelect, INSTITUTES, "Select institute or organisation");
  fillSelect(statusSelect, AUTHOR_STATUSES, "Select status");
  fillSelect(rankSelect, AUTHOR_RANKS, "Select rank");

  function openModal(editId = null) {
    state.editingAuthorId = editId;
    modal.querySelectorAll("[data-author-field]").forEach((el) => { el.value = ""; setError(el, false); });

    if (editId) {
      const author = state.authors.find((a) => a.id === editId);
      modal.querySelector('[data-author-field="firstName"]').value = author.firstName;
      modal.querySelector('[data-author-field="lastName"]').value = author.lastName;
      modal.querySelector('[data-author-field="email"]').value = author.email;
      modal.querySelector('[data-author-field="affiliation"]').value = author.affiliation;
      modal.querySelector('[data-author-field="status"]').value = author.status;
      modal.querySelector('[data-author-field="rank"]').value = author.rank;
    }
    modal.classList.remove("hidden");
  }
  function closeModal() { modal.classList.add("hidden"); state.editingAuthorId = null; }

  openAuthorModal = openModal;

  document.querySelector("[data-open-author-modal]").addEventListener("click", () => openModal());
  modal.querySelectorAll("[data-close-author-modal]").forEach((btn) => btn.addEventListener("click", closeModal));

  modal.querySelector("[data-save-author]").addEventListener("click", () => {
    const get = (name) => modal.querySelector(`[data-author-field="${name}"]`).value.trim();
    const firstName = get("firstName"), lastName = get("lastName"), email = get("email");
    const affiliation = get("affiliation"), status = get("status"), rank = get("rank");

    let valid = true;
    const checks = [
      ["firstName", firstName], ["lastName", lastName], ["affiliation", affiliation],
      ["status", status], ["rank", rank],
    ];
    checks.forEach(([name, value]) => {
      const el = modal.querySelector(`[data-author-field="${name}"]`);
      setError(el, !value);
      if (!value) valid = false;
    });
    const emailEl = modal.querySelector('[data-author-field="email"]');
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setError(emailEl, !emailValid);
    if (!emailValid) valid = false;

    // Uniqueness: one Co Presenter, unique rank (excluding the author being edited)
    const others = state.authors.filter((a) => a.id !== state.editingAuthorId);
    if (status === "Co Presenter" && others.some((a) => a.status === "Co Presenter")) {
      setError(modal.querySelector('[data-author-field="status"]'), true);
      valid = false;
    }
    if (rank && others.some((a) => a.rank === rank)) {
      setError(modal.querySelector('[data-author-field="rank"]'), true);
      valid = false;
    }

    if (!valid) return;

    if (state.editingAuthorId) {
      const author = state.authors.find((a) => a.id === state.editingAuthorId);
      Object.assign(author, { firstName, lastName, email, affiliation, status, rank });
    } else {
      state.authors.push({ id: crypto.randomUUID(), firstName, lastName, email, affiliation, status, rank });
    }
    renderAuthorList();
    closeModal();
  });
}

function renderAuthorList() {
  const list = document.querySelector("[data-author-list]");
  const empty = document.querySelector("[data-author-empty]");
  list.innerHTML = "";
  empty.classList.toggle("hidden", state.authors.length > 0);

  state.authors.forEach((author) => {
    const li = document.createElement("li");
    li.className = "flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3";
    li.innerHTML = `
      <div class="min-w-0">
        <p class="font-bold text-sm text-slate-900 truncate">${author.firstName} ${author.lastName}
          <span class="ml-2 inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${author.status === "Co Presenter" ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600"}">${author.status}</span>
        </p>
        <p class="text-xs text-slate-500 truncate">${author.affiliation} · ${author.rank}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button type="button" data-edit-author="${author.id}" class="text-xs font-bold text-brand-600 hover:underline">Edit</button>
        <button type="button" data-remove-author="${author.id}" class="text-xs font-bold text-red-500 hover:underline">Remove</button>
      </div>`;
    list.appendChild(li);
  });

  list.querySelectorAll("[data-edit-author]").forEach((btn) =>
    btn.addEventListener("click", () => openAuthorModal(btn.dataset.editAuthor))
  );
  list.querySelectorAll("[data-remove-author]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.authors = state.authors.filter((a) => a.id !== btn.dataset.removeAuthor);
      renderAuthorList();
    })
  );
}

// ---------------------------------------------------------------
// Submission
// ---------------------------------------------------------------
// Short, unique-enough code shown to the submitter for tracking and to
// reviewers in place of any identifying information.
function generateReviewKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `AB-${code}`;
}

async function submitAbstract(user, profile) {
  const submitBtn = document.querySelector("[data-submit-abstract]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  const reviewKey = generateReviewKey();
  const docRef = doc(collection(db, ABSTRACTS_COLLECTION)); // auto-generated id
  const abstractId = docRef.id;

  const payload = {
    reviewKey,
    submittedBy: {
      uid: user.uid, email: profile.email || user.email, serial: profile.serial || null,
    },
    personalInfo: {
      firstName: state.values.firstName, lastName: state.values.lastName,
      email: state.values.email, phone: state.values.phone,
      institute: state.values.institute === "Others" ? state.values.instituteOther : state.values.institute,
      fieldOfStudy: state.values.fieldOfStudy, yearOfStudy: state.values.yearOfStudy,
      province: state.values.province, city: state.values.city,
    },
    abstractType: {
      speciality: state.values.speciality, subSpeciality: state.values.subSpeciality || null,
      abstractType: state.values.abstractType,
    },
    abstract: {
      title: state.values.title, introduction: state.values.introduction,
      objectives: state.values.objectives, methodology: state.values.methodology,
      results: state.values.results, conclusion: state.values.conclusion,
      keywords: state.keywords,
    },
    authors: state.authors,
    // --- Tracking fields, shown on the dashboard and used by admin/reviewers ---
    status: "submitted",       // submitted | under_review | accepted | rejected
    track: null,               // poster | oral | observer — set by admin once decided
    reviewDecision: null,      // null | accepted | rejected — reviewer's recommendation
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // NOTE: file uploads (resultCard, figure1, figure2) live in state.files as
  // File objects. Wire these to Firebase Storage alongside this Firestore
  // write, then attach the resulting URLs to `payload` before saving, e.g.:
  //   payload.personalInfo.resultCardUrl = await uploadAbstractFile(state.files.resultCard, `abstracts/${abstractId}/result-card`);
  //   payload.abstract.figure1Url = await uploadAbstractFile(state.files.figure1, `abstracts/${abstractId}/figure1`);
  try {
    await setDoc(docRef, payload);
    // Mirrors a PII-free copy into a separate collection so reviewers can be
    // granted read access to that collection only — see abstract-review-sync.js.
    await syncAbstractReviewView(abstractId, payload);

    document.querySelector("[data-review-key]").textContent = reviewKey;
    document.querySelector("[data-success-overlay]").classList.remove("hidden");
  } catch (err) {
    console.error(err);
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Abstract";
    alert("We couldn't submit your abstract just now. Please check your connection and try again.");
  }
}

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------
guardPage({
  requireAdmin: false,
  onReady: (user, profile) => {
    renderTopbar("submit-abstract", { isAdmin: profile.role === "admin" });
    attachLogout("logoutBtn");

    // Populate all static dropdowns
    fillSelect(document.querySelector('[data-field="institute"]'), INSTITUTES, "Select your institute");
    fillSelect(document.querySelector('[data-field="fieldOfStudy"]'), FIELDS_OF_STUDY, "Select your field of study");
    fillSelect(document.querySelector('[data-field="yearOfStudy"]'), YEARS_OF_STUDY, "Select your year of study");
    fillSelect(document.querySelector('[data-field="province"]'), PROVINCES, "Select your province");
    fillSelect(document.querySelector('[data-field="speciality"]'), SPECIALTIES.map((s) => s.specialty), "Select the speciality");
    fillSelect(document.querySelector('[data-field="abstractType"]'), ABSTRACT_TYPES, "Select the category that best describes your submission");

    wireGenericFields();
    wireDropzones();
    wireKeywords();
    wireAuthorModal();
    prefillFromProfile(user, profile);

    // Step grid taps — free navigation, matching "navigate between sections freely"
    document.querySelectorAll(".step-tile").forEach((tile) => {
      tile.addEventListener("click", () => goToStep(Number(tile.dataset.step)));
    });

    // Continue buttons validate before advancing + marking complete/error
    document.querySelectorAll("[data-continue]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const step = Number(btn.dataset.continue);
        const valid = validateStep(step);
        if (!valid) {
          state.completedSteps.delete(step);
          state.erroredSteps.add(step);
          refreshStepGrid();
          scrollToFirstInvalid(step);
          return;
        }
        state.completedSteps.add(step);
        state.erroredSteps.delete(step);
        goToStep(Math.min(step + 1, 4));
      });
    });
    document.querySelectorAll("[data-back]").forEach((btn) => {
      btn.addEventListener("click", () => goToStep(Math.max(Number(btn.dataset.back) - 1, 1)));
    });

    document.querySelector("[data-submit-abstract]").addEventListener("click", () => {
      const results = [1, 2, 3].map((step) => ({ step, valid: validateStep(step) }));
      results.forEach(({ step, valid }) => {
        if (valid) { state.completedSteps.add(step); state.erroredSteps.delete(step); }
        else { state.completedSteps.delete(step); state.erroredSteps.add(step); }
      });
      refreshStepGrid();

      const firstInvalid = results.find((r) => !r.valid);
      if (firstInvalid) {
        goToStep(firstInvalid.step);
        scrollToFirstInvalid(firstInvalid.step);
        return;
      }
      submitAbstract(user, profile);
    });

    goToStep(1);
    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  },
});
