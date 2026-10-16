// ====== FACILITY DASHBOARD (shared by all facility pages) ======
// Needs /js/api.js to be loaded first.
//
// Every page loads this same file, but not every page has every part.
// So before each part, we check that its elements exist on the current page.
//
// HOW DATA LOADING WORKS
// In demo mode (USE_DEMO_MODE = true in api.js), the sample content written in the HTML is used.
// With the real backend, each "load..." function asks the server for the data and
// replaces the sample content with the real one.

// 👉 The facility pages that the JS links to. Make these match your real file names exactly.
const PAGES = {
  dashboard: "../FacilityHiringSection/Dashboard.html",
  postShift: "../FacilityHiringSection/PostShift.html",
  reviewShift: "../FacilityHiringSection/ReviewShift.html",
  shiftPublished: "../FacilityHiringSection/ShiftPublished.html",
  applicants: "../FacilityHiringSection/Applicants.html",
  manageShifts: "../FacilityHiringSection/ManageShifts.html",
  workerProfile: "../FacilityHiringSection/WorkerProfile.html",
  profileSaved: "../FacilityHiringSection/ProfileSaved.html",
  shiftDetails: "../FacilityHiringSection/ShiftDetails.html",
};

// The facility's name, shown in the shift summary.
// 👉 With the real backend, this could come from the facility profile.
const FACILITY_NAME = "Mainland Care Hospital";

// The shift being created is kept here between "Post a shift", "Review shift" and "Shift published".
// sessionStorage keeps it while the tab is open, so "Edit details" can bring the form back filled in.
const DRAFT_KEY = "draftShift";

// ==================================================
// HELPERS (used by several pages)
// ==================================================

// Get what the user typed (trim() removes extra spaces)
function getValue(id) {
  return document.getElementById(id).value.trim();
}

// Show a red error message under an input and make its border red
function showError(id, message) {
  const errorText = document.getElementById(id + "Error");
  errorText.textContent = message;
  errorText.classList.remove("hidden");
  document.getElementById(id).classList.add("border-red-500");
}

// Hide the error message and remove the red border
function clearError(id) {
  document.getElementById(id + "Error").classList.add("hidden");
  document.getElementById(id).classList.remove("border-red-500");
}

// Scroll to the first error message that is showing, so the user can see what needs fixing.
// [id$="Error"] means "an id that ends with Error"; :not(.hidden) means "that is showing".
function scrollToFirstError() {
  const firstError = document.querySelector('[id$="Error"]:not(.hidden)');
  if (firstError) {
    firstError.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Turn 36000 into "₦36,000"
function naira(amount) {
  return "₦" + amount.toLocaleString();
}

// Turn a date into text like "2026-10-08" (the format date boxes use), in the user's own time zone
function toDateText(date) {
  return (
    date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

// Turn "2026-10-09" into "9 October"
function prettyDate(dateText) {
  const parts = dateText.split("-");
  // new Date(year, month - 1, day) makes the date in the user's own time zone
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

// Turn "07:00" into minutes after midnight (7 × 60 = 420)
function toMinutes(time) {
  const parts = time.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

// How many hours a shift lasts. A night shift like 18:00–07:00 goes past midnight,
// so if the end is earlier than the start we add 24 hours.
function shiftHours(startTime, endTime) {
  let minutes = toMinutes(endTime) - toMinutes(startTime);
  if (minutes <= 0) {
    minutes = minutes + 24 * 60;
  }
  return minutes / 60;
}

// Build all the summary texts for a shift.
// shift = { profession, specialty, shiftDate, startTime, endTime, workersNeeded, location, hourlyPay }
// This is used by "Post a shift", "Review shift" and "Shift published", so they always match.
function buildSummary(shift) {
  const workers = Number(shift.workersNeeded);
  const pay = Number(shift.hourlyPay);
  const hours = shiftHours(shift.startTime, shift.endTime);
  const payEach = hours * pay;

  // "2 registered nurses" (add an "s" when there is more than 1)
  let role = shift.profession.toLowerCase();
  if (workers > 1) {
    role = role + "s";
  }

  // "1 person" or "2 people"
  let people = workers + " people";
  if (workers === 1) {
    people = "1 person";
  }

  return {
    role: workers + " " + role + " · " + shift.specialty,
    roleShort: shift.profession + " · " + shift.specialty,
    when: prettyDate(shift.shiftDate) + " · " + shift.startTime + "–" + shift.endTime + " WAT",
    place: FACILITY_NAME + " · " + shift.location,
    each: naira(payEach) + " for each person",
    total: naira(payEach * workers) + " for the whole shift",
    math: "That's " + hours + " hours at " + naira(pay) + " an hour for " + people +
      ". You'll see any platform fees before you confirm.",
    staffing: people + " needed · " + naira(payEach) + " each",
  };
}

// Put the summary texts into the summary card (Post a shift and Review shift use the same ids)
function showSummary(shift) {
  const summary = buildSummary(shift);
  document.getElementById("summaryRole").textContent = summary.role;
  document.getElementById("summaryWhen").textContent = summary.when;
  document.getElementById("summaryPlace").textContent = summary.place;
  document.getElementById("summaryEach").textContent = summary.each;
  document.getElementById("summaryTotal").textContent = summary.total;
  document.getElementById("summaryMath").textContent = summary.math;
}

// Read the saved shift (or null if there isn't one)
function getDraft() {
  const saved = sessionStorage.getItem(DRAFT_KEY);
  if (saved === null) {
    return null;
  }
  return JSON.parse(saved);
}

// Build one shift card for the Dashboard and Manage shifts lists.
// shift = { id, title, urgent, when, staffing, status: "open" | "confirmed" | "completed" }
// withButton adds "Review applicants" (or "See who's booked") under the card.
function shiftCardHtml(shift, withButton) {
  let badge = "";
  if (shift.urgent) {
    badge = '<div class="mb-2"><span class="inline-block bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-1 rounded">Urgent</span></div>';
  }

  // Green when the shift is fully booked, amber when people are still needed
  let staffingColor = "text-amber-700";
  if (shift.status !== "open") {
    staffingColor = "text-green-700";
  }

  if (shift.status === "awaiting_payment") {
    staffingColor = "text-amber-700";
  }

  let button = "";
  if (shift.status === "awaiting_payment") {
    badge = '<div class="mb-2"><span class="inline-block bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-1 rounded">Awaiting payment</span></div>';
    button = `<div class="grid grid-cols-2 gap-3 mt-3">
      <a href="../FacilityHiringSection/FundShift.html?shift=${encodeURIComponent(shift.id)}" class="block bg-blue-600 text-white text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-700">Fund shift</a>
      <button type="button" data-delete-shift="${escapeHtml(shift.id)}" class="block border border-red-600 text-red-600 text-sm font-medium text-center py-3 rounded-lg hover:bg-red-50">Delete</button>
    </div>`;
  } else if (withButton) {
    if (shift.status === "open") {
      button = `<div class="grid grid-cols-2 gap-3 mt-3">
        <a href="${PAGES.applicants}?shift=${encodeURIComponent(shift.id)}" class="block border border-blue-600 text-blue-600 text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-50">Review applicants</a>
        <a href="${PAGES.shiftDetails}?shift=${encodeURIComponent(shift.id)}" class="block border border-blue-600 text-blue-600 text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-50">Shift &amp; attendance</a>
      </div>`;
    } else {
      button = `<a href="${PAGES.shiftDetails}?shift=${encodeURIComponent(shift.id)}" class="block border border-blue-600 text-blue-600 text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-50 mt-3">See who's booked</a>`;
    }
  }

  return `
    <div class="shift-item" data-status="${escapeHtml(shift.status)}" data-urgent="${shift.urgent ? "true" : "false"}">
      <div class="bg-slate-50 border border-gray-200 rounded-xl p-5">
        ${badge}
        <a href="${PAGES.shiftDetails}?shift=${encodeURIComponent(shift.id)}" class="text-base font-semibold hover:underline">${escapeHtml(shift.title)}</a>
        <p class="text-xs text-gray-700 mt-1">${escapeHtml(shift.when)}</p>
        <p class="text-xs font-medium ${staffingColor} mt-2">${escapeHtml(shift.staffing)}</p>
      </div>
      ${button}
    </div>`;
}

// ==================================================
// DELETE AN UNFUNDED SHIFT
// Any button with data-delete-shift: on a shift card (data-delete-shift="<shiftId>"), or on the
// Fund shift page (empty value: the shift comes from the page address, ?shift=...).
// One listener for the whole page, so it also works on cards drawn later.
// ==================================================

document.addEventListener("click", async function (event) {
  const button = event.target.closest("[data-delete-shift]");
  if (!button) return;
  event.preventDefault();

  const shiftId = button.getAttribute("data-delete-shift") || getUrlValue("shift");
  if (!shiftId) return;
  if (!confirm("Delete this shift for good? It hasn't been paid for, so no money is involved. This can't be undone.")) return;

  if (USE_DEMO_MODE) {
    const card = button.closest(".shift-item");
    if (card) card.remove();
    else window.location.href = "../FacilityHiringSection/ManageShifts.html";
    return;
  }

  setLoading(button, true, "Deleting…");
  try {
    await Backend.deleteShift(shiftId);
    const card = button.closest(".shift-item");
    if (card) {
      card.remove(); // on Manage shifts / the dashboard: just remove the card
    } else {
      window.location.href = "../FacilityHiringSection/ManageShifts.html"; // on Fund shift: back to the list
    }
  } catch (error) {
    setLoading(button, false);
    showGeneralError("Couldn't delete this shift: " + ((error && error.message) || String(error)));
  }
});

// ==================================================
// 1. MOBILE MENU (every page)
// ==================================================

const menuButton = document.getElementById("menuButton");
const closeMenuButton = document.getElementById("closeMenuButton");
const sidebar = document.getElementById("sidebar");

if (menuButton) {
  // The menu icon opens the sidebar
  menuButton.addEventListener("click", function () {
    sidebar.classList.remove("hidden");
  });

  // The close icon (inside the sidebar) closes it
  closeMenuButton.addEventListener("click", function () {
    sidebar.classList.add("hidden");
  });
}

// ==================================================
// 2. DASHBOARD
// ==================================================

const upcomingShiftList = document.getElementById("upcomingShiftList");

if (upcomingShiftList) {
  const newApplicantList = document.getElementById("newApplicantList");

  // The server should answer with values for each data-field="..." on the page, plus two lists:
  // {
  //   facilityLine: "Mainland Care Hospital · Yaba, Lagos",
  //   openShifts: "8", openShiftsNote: "3 starting today", ...,
  //   upcomingShifts: [ { id, title, urgent, when, staffing, status }, ... ],
  //   newApplicantList: [ { name: "Amara Okafor", role: "Registered Nurse · ICU",
  //                      stats: "Licence verified · Rated 4.9 · 32 shifts completed" }, ... ]
  // }
  async function loadDashboard() {
    if (USE_DEMO_MODE) {
      return; // keep the sample content in the HTML
    }

    // Don't show the design's sample content while the real data loads
    fillFields({ openShifts: "…", openShiftsNote: "", newApplicants: "…", newApplicantsNote: "", urgentShifts: "…",
      urgentShiftsNote: "", applicantsWaiting: "", facilityLine: "" });
    upcomingShiftList.innerHTML = '<p class="text-xs text-gray-700">Loading…</p>';
    newApplicantList.innerHTML = '<p class="text-xs text-gray-700">Loading…</p>';

    try {
      // Put together from the facility's shifts and applications (backend.js)
      const data = await Backend.facilityDashboard();
      fillFields(data);

      let shiftsHtml = "";
      data.upcomingShifts.forEach(function (shift) {
        shiftsHtml += shiftCardHtml(shift, false);
      });
      upcomingShiftList.innerHTML = shiftsHtml ||
        `<p class="text-xs text-gray-700">No upcoming shifts. Post a shift to start receiving applications.</p>`;

      let applicantsHtml = "";
      data.newApplicantList.forEach(function (person) {
        const link = PAGES.workerProfile + "?worker=" + encodeURIComponent(person.workerId) +
          "&application=" + encodeURIComponent(person.applicationId) + "&shift=" + encodeURIComponent(person.shiftId);
        applicantsHtml += `
          <a href="${link}" class="block bg-slate-50 border border-gray-200 rounded-xl p-5 hover:border-blue-300">
            <p class="text-sm font-semibold">${escapeHtml(person.name)}</p>
            <p class="text-xs text-gray-700 mt-1">${escapeHtml(person.role)}</p>
            <p class="text-xs font-medium text-green-700 mt-2">${escapeHtml(person.stats)}</p>
          </a>`;
      });
      newApplicantList.innerHTML = applicantsHtml ||
        `<p class="text-xs text-gray-700">No new applicants right now.</p>`;
    } catch (error) {
      showGeneralError("Couldn't load your dashboard: " + error.message);
    }
  }

  // First show the right version for the account's verification status (see api.js).
  // Only a verified facility needs the full dashboard data.
  showDashboardState().then(function (status) {
    if (status === "verified") {
      loadDashboard();
    }
  });
}

// ==================================================
// 3. POST A SHIFT
// ==================================================

const reviewShiftButton = document.getElementById("reviewShift");

if (reviewShiftButton) {
  // The form's boxes, by id. Their ids match the names the server expects.
  const fieldIds = [
    "profession", "specialty", "shiftDate", "shiftType", "startTime", "endTime",
    "workersNeeded", "experience", "location", "hourlyPay",
    "responsibilities", "credentials", "arrival",
  ];
  const urgentCheckbox = document.getElementById("urgent");
  const urgentBadge = document.getElementById("urgentBadge");
  const shiftDateInput = document.getElementById("shiftDate");

  // Collect every field of the form into one object
  function getShiftDetails() {
    const shift = {};
    fieldIds.forEach(function (id) {
      shift[id] = getValue(id);
    });
    shift.workersNeeded = Number(shift.workersNeeded);
    shift.hourlyPay = Number(shift.hourlyPay);
    shift.urgent = urgentCheckbox.checked;
    return shift;
  }

  // Update the "Shift summary" card from what's in the form
  function updateSummary() {
    // Wait until the times and pay are filled in, so the summary never shows "NaN"
    if (getValue("startTime") === "" || getValue("endTime") === "" || getValue("shiftDate") === "") {
      return;
    }
    showSummary(getShiftDetails());
  }

  // Show "Urgent shift" in amber when ticked, "Not urgent" in gray when not
  function updateUrgentBadge() {
    if (urgentCheckbox.checked) {
      urgentBadge.textContent = "Urgent shift";
      urgentBadge.classList.remove("bg-gray-100", "text-gray-600");
      urgentBadge.classList.add("bg-amber-50", "text-amber-700");
    } else {
      urgentBadge.textContent = "Not urgent";
      urgentBadge.classList.remove("bg-amber-50", "text-amber-700");
      urgentBadge.classList.add("bg-gray-100", "text-gray-600");
    }
  }

  // ---------- Coming back with "Edit details": fill the form with the saved shift ----------
  const draft = getDraft();
  if (draft !== null) {
    fieldIds.forEach(function (id) {
      if (draft[id] !== undefined) {
        document.getElementById(id).value = draft[id];
      }
    });
    urgentCheckbox.checked = draft.urgent;
  }

  // ---------- Shift date: no dates in the past ----------
  const todayText = toDateText(new Date());
  shiftDateInput.min = todayText; // greys out past days in the date picker

  // If the date in the box is already in the past, start on tomorrow instead
  if (shiftDateInput.value < todayText) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    shiftDateInput.value = toDateText(tomorrow);
  }

  updateSummary();
  updateUrgentBadge();

  // Update the summary every time anything in the form changes
  document.querySelectorAll("input, select").forEach(function (field) {
    field.addEventListener("input", updateSummary);
  });
  urgentCheckbox.addEventListener("change", updateUrgentBadge);

  // ---------- Validation ----------

  function checkForm() {
    let isValid = true;

    // 1. These text fields must not be empty
    const requiredFields = ["shiftDate", "startTime", "endTime", "experience", "responsibilities", "credentials", "arrival"];
    requiredFields.forEach(function (id) {
      if (getValue(id) === "") {
        showError(id, "This field is required.");
        isValid = false;
      } else {
        clearError(id);
      }
    });

    // 2. Start and end time can't be the same
    if (getValue("startTime") !== "" && getValue("startTime") === getValue("endTime")) {
      showError("endTime", "The end time must be different from the start time.");
      isValid = false;
    }

    // 3. Shift date can't be in the past
    if (getValue("shiftDate") !== "" && getValue("shiftDate") < toDateText(new Date())) {
      showError("shiftDate", "Please choose today or a future date.");
      isValid = false;
    }

    // 4. Hourly pay: a whole number above 0
    const pay = Number(getValue("hourlyPay"));
    if (getValue("hourlyPay") === "" || !Number.isInteger(pay) || pay <= 0) {
      showError("hourlyPay", "Please enter the hourly pay, like 3000.");
      isValid = false;
    } else {
      clearError("hourlyPay");
    }

    if (!isValid) {
      scrollToFirstError();
    }
    return isValid;
  }

  // Save the shift on the server as a draft. If it was saved before (it has an id), update it
  // instead of making a second copy. The server answers with the shift, including its id.
  async function saveDraftOnServer(shift) {
    const details = Object.assign({}, shift, { status: "draft" });
    delete details.id;

    if (shift.id) {
      return await apiRequest(ENDPOINTS.shift(shift.id), "PUT", details);
    }
    return await apiRequest(ENDPOINTS.createShift, "POST", details);
  }

  // ---------- Save for later ----------

  const saveDraftButton = document.getElementById("saveDraft");
  const draftMessage = document.getElementById("draftMessage");

  saveDraftButton.addEventListener("click", async function () {
    // Keep the id of a shift that was already saved, so it is updated and not duplicated
    const previous = getDraft();
    const shift = getShiftDetails();
    if (previous && previous.id) {
      shift.id = previous.id;
    }

    // REAL with drafts on the server: save it there. Without them (SERVER_HAS.shiftDrafts),
    // the shift is kept on this device until it's posted.
    if (!usesDemo("shiftDrafts")) {
      setLoading(saveDraftButton, true, "Saving…");
      try {
        const saved = await saveDraftOnServer(shift);
        shift.id = saved.id;
      } catch (error) {
        showGeneralError("Couldn't save the shift: " + error.message);
        setLoading(saveDraftButton, false);
        return;
      }
      setLoading(saveDraftButton, false);
    }

    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(shift));
    if (!USE_DEMO_MODE && usesDemo("shiftDrafts")) {
      draftMessage.textContent = "Saved on this device. Post it when you're ready.";
    }
    draftMessage.classList.remove("hidden");
  });

  // ---------- Review shift ----------

  reviewShiftButton.addEventListener("click", async function () {
    if (!checkForm()) {
      return;
    }

    const previous = getDraft();
    const shift = getShiftDetails();
    if (previous && previous.id) {
      shift.id = previous.id;
    }

    // REAL with drafts on the server: save it as a draft first, so the review page can post it by its id
    if (!usesDemo("shiftDrafts")) {
      setLoading(reviewShiftButton, true, "Saving…");
      try {
        const saved = await saveDraftOnServer(shift);
        shift.id = saved.id;
      } catch (error) {
        showGeneralError("Couldn't save the shift: " + error.message);
        setLoading(reviewShiftButton, false);
        return;
      }
    }

    // Remember everything that was typed, for the review page
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(shift));
    window.location.href = PAGES.reviewShift;
  });
}

// ==================================================
// 4. REVIEW SHIFT (a normal review, or an urgent one)
// ==================================================

const publishShiftButton = document.getElementById("publishShift");

if (publishShiftButton) {
  const shift = getDraft();

  // Change the page into the urgent version: title, badge, note and button
  function showUrgentVersion() {
    document.getElementById("reviewTitle").textContent = "Review your urgent shift";
    document.getElementById("reviewUrgentBadge").classList.remove("hidden");
    document.getElementById("reviewUrgentNote").classList.remove("hidden");
    publishShiftButton.textContent = "Post urgent shift";
    document.title = "Careporium - Review Your Urgent Shift";
  }

  // Show the shift that was typed on "Post a shift".
  // If there isn't one (the page was opened directly), the sample summary in the HTML stays.
  if (shift !== null) {
    showSummary(shift);
    if (shift.urgent) {
      showUrgentVersion();
    }
  }

  publishShiftButton.addEventListener("click", async function () {
    // REAL without drafts: the shift is created now. The backend also starts its payment;
    // if it sends a payment page back, the facility goes there to pay.
    if (!USE_DEMO_MODE && usesDemo("shiftDrafts")) {
      if (shift === null) {
        showGeneralError("There's no shift to post. Go back to “Post a shift” and fill it in.");
        return;
      }
      setLoading(publishShiftButton, true, "Posting…");
      let created;
      try {
        created = await Backend.createShift(shift);
      } catch (error) {
        showGeneralError("Couldn't post the shift: " + error.message);
        setLoading(publishShiftButton, false);
        return;
      }
      sessionStorage.setItem("publishedShift", JSON.stringify(shift));
      sessionStorage.removeItem(DRAFT_KEY);
      // The shift only goes live once its escrow is funded: go to the Fund shift page, which
      // shows the payment link (a shift that's already live goes to "Shift published")
      if (created.id && created.status !== "open") {
        window.location.href = "../FacilityHiringSection/FundShift.html?shift=" + encodeURIComponent(created.id) + "&new=1";
      } else {
        window.location.href = PAGES.shiftPublished;
      }
      return;
    }

    // REAL with drafts on the server: post the saved draft
    if (!USE_DEMO_MODE) {
      if (shift === null || !shift.id) {
        showGeneralError("This shift hasn't been saved yet. Go back to “Edit details” and press Review shift again.");
        return;
      }

      setLoading(publishShiftButton, true, "Posting…");
      try {
        await apiRequest(ENDPOINTS.publishShift(shift.id), "POST");
      } catch (error) {
        showGeneralError("Couldn't post the shift: " + error.message);
        setLoading(publishShiftButton, false);
        return;
      }
    }

    // The shift is live. Keep its details for the "Shift published" page, under a new name,
    // and clear the draft so "Post a shift" starts empty next time.
    if (shift !== null) {
      sessionStorage.setItem("publishedShift", JSON.stringify(shift));
    }
    sessionStorage.removeItem(DRAFT_KEY);
    window.location.href = PAGES.shiftPublished;
  });
}

// ==================================================
// 5. SHIFT PUBLISHED
// ==================================================

const publishedRole = document.getElementById("publishedRole");

if (publishedRole) {
  const saved = sessionStorage.getItem("publishedShift");

  if (saved !== null) {
    const shift = JSON.parse(saved);
    const summary = buildSummary(shift);

    publishedRole.textContent = summary.roleShort;
    document.getElementById("publishedWhen").textContent = summary.when;
    document.getElementById("publishedStaffing").textContent = summary.staffing;

    if (shift.urgent) {
      document.getElementById("publishedUrgentBadge").classList.remove("hidden");
    }
  }
}

// ==================================================
// 6. MANAGE SHIFTS (tabs)
// ==================================================

const shiftTabs = document.querySelectorAll(".shift-tab");

if (shiftTabs.length > 0) {
  const shiftList = document.getElementById("shiftList");
  let currentFilter = "all";

  // The list title for each tab
  const titles = {
    all: "Open and upcoming shifts",
    urgent: "Urgent shifts",
    confirmed: "Confirmed shifts",
    completed: "Completed shifts",
  };

  // Does a shift belong in the chosen tab?
  function matchesTab(item) {
    const status = item.getAttribute("data-status");
    const urgent = item.getAttribute("data-urgent") === "true";

    if (currentFilter === "all") {
      return status !== "completed"; // "All" means open and upcoming, not past ones
    }
    if (currentFilter === "urgent") {
      return urgent && status !== "completed";
    }
    return status === currentFilter; // "confirmed" or "completed"
  }

  // Show only the shifts for the chosen tab
  function filterShifts() {
    let shownCount = 0;

    document.querySelectorAll(".shift-item").forEach(function (item) {
      if (matchesTab(item)) {
        item.classList.remove("hidden");
        shownCount = shownCount + 1;
      } else {
        item.classList.add("hidden");
      }
    });

    document.getElementById("shiftListTitle").textContent = titles[currentFilter];

    if (shownCount === 0) {
      document.getElementById("shiftEmpty").classList.remove("hidden");
    } else {
      document.getElementById("shiftEmpty").classList.add("hidden");
    }
  }

  shiftTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      currentFilter = tab.getAttribute("data-filter");

      // Make every tab look "not picked"...
      shiftTabs.forEach(function (otherTab) {
        otherTab.classList.remove("bg-blue-600", "text-white");
        otherTab.classList.add("text-blue-600", "hover:bg-blue-50");
      });
      // ...then make the clicked tab blue
      tab.classList.remove("text-blue-600", "hover:bg-blue-50");
      tab.classList.add("bg-blue-600", "text-white");

      filterShifts();
    });
  });

  // Load the shifts. The server should answer with:
  // {
  //   counts: { all: 8, urgent: 2, confirmed: 3, completed: 46 },
  //   shifts: [ { id, title, urgent, when, staffing, status: "open" | "confirmed" | "completed" }, ... ]
  // }
  async function loadShifts() {
    if (USE_DEMO_MODE) {
      return; // keep the sample shifts in the HTML
    }

    try {
      const data = await Backend.facilityShifts();

      let html = "";
      data.shifts.forEach(function (shift) {
        html += shiftCardHtml(shift, true);
      });
      shiftList.innerHTML = html;

      // Update the numbers on the tabs
      Object.keys(data.counts).forEach(function (key) {
        const countSpan = document.querySelector('[data-count="' + key + '"]');
        if (countSpan) {
          countSpan.textContent = data.counts[key];
        }
      });

      filterShifts();
    } catch (error) {
      showGeneralError("Couldn't load your shifts: " + error.message);
    }
  }

  filterShifts();
  loadShifts();
}

// ==================================================
// 7. APPLICANTS
// ==================================================

const applicantSearch = document.getElementById("applicantSearch");

if (applicantSearch) {
  const applicantList = document.getElementById("applicantList");
  const applicantCount = document.getElementById("applicantCount");

  // Opened from "Review applicants" on one shift: Applicants.html?shift=SH-0824
  // Opened from the menu: no shift, so all applicants are shown
  const shiftId = getUrlValue("shift");

  // The end of the count line, e.g. " · 12 waiting for your review" (kept from the HTML)
  let countEnding = "";
  const firstDot = applicantCount.textContent.indexOf(" · ");
  if (firstDot !== -1) {
    countEnding = applicantCount.textContent.slice(firstDot).trim();
    countEnding = " " + countEnding;
  }

  function getCards() {
    return document.querySelectorAll(".applicant-card");
  }

  // "Showing 3 applicants · 12 waiting for your review" ("1 applicant" for just one)
  function updateCount(count) {
    let word = "applicants";
    if (count === 1) {
      word = "applicant";
    }
    applicantCount.textContent = "Showing " + count + " " + word + countEnding;
  }

  // Search by name or specialty as you type
  applicantSearch.addEventListener("input", function () {
    const searchText = applicantSearch.value.trim().toLowerCase();
    let shownCount = 0;

    getCards().forEach(function (card) {
      if (card.textContent.toLowerCase().includes(searchText)) {
        card.classList.remove("hidden");
        shownCount = shownCount + 1;
      } else {
        card.classList.add("hidden");
      }
    });

    updateCount(shownCount);
  });

  // Load the applicants. The server should answer with:
  // {
  //   waitingForReview: 12,
  //   applicants: [ { applicationId: "AP-201", workerId: "WK-1048", name: "Amara Okafor",
  //                   details: "Registered nurse · Acute care · 5 years",
  //                   stats: "★ 4.9 (24 reviews) · 32 completed shifts · 98% attendance",
  //                   latestRole: "Staff nurse · Mainland Care Hospital (Jun 2023 – Present)",
  //                   softSkills: ["Communication", "Teamwork", "Empathy"],
  //                   shortlisted: false }, ... ]
  // }
  async function loadApplicants() {
    if (USE_DEMO_MODE) {
      return; // keep the sample applicants in the HTML
    }

    try {
      // One shift's applicants, or everyone's
      let data;
      if (shiftId) {
        data = await Backend.applicants(shiftId);
      } else {
        data = await Backend.applicants(null);
      }

      let html = "";
      data.applicants.forEach(function (person) {
        // Shortlisted applicants get a green button
        let buttonText = "Shortlist";
        let buttonColor = "bg-blue-600 text-white";
        if (person.shortlisted) {
          buttonText = "Shortlisted ✓";
          buttonColor = "bg-green-50 text-green-700";
        }

        let profileLink = PAGES.workerProfile + "?worker=" + encodeURIComponent(person.workerId) +
          "&application=" + encodeURIComponent(person.applicationId);
        if (shiftId || person.shiftId) {
          profileLink = profileLink + "&shift=" + encodeURIComponent(shiftId || person.shiftId);
        }

        const badgeColors = { green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-600", gray: "bg-gray-100 text-gray-600" };
        const statusColor = person.status === "Accepted" ? "bg-green-50 text-green-700" : person.status === "Not selected" ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-600";
        const credentialLink = profileLink.replace(PAGES.workerProfile, "../FacilityHiringSection/ApplicantProfile.html");

        html += `
          <div class="applicant-card bg-white border border-gray-200 rounded-2xl p-6" data-application="${escapeHtml(person.applicationId)}">
            <h2 class="text-base font-semibold">${escapeHtml(person.name)}</h2>
            <div class="flex flex-wrap gap-2 mt-3">
              ${person.badge ? `<span class="inline-block ${badgeColors[person.badge.color]} text-xs font-semibold px-3 py-1 rounded">${escapeHtml(person.badge.text)}</span>` : ""}
              <span class="inline-block ${statusColor} text-xs font-semibold px-3 py-1 rounded">${escapeHtml(person.status === "Accepted" ? "Booked" : person.status)}</span>
            </div>
            <p class="text-xs text-gray-700 mt-3">${escapeHtml(person.details)}</p>
            <p class="text-xs text-gray-700 mt-1">${escapeHtml(person.stats)}</p>
            <div class="flex flex-wrap gap-3 mt-5">
              <a href="${profileLink}" class="border border-blue-600 text-blue-600 text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-50 px-8">View profile</a>
              <a href="${credentialLink}" class="border border-blue-600 text-blue-600 text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-50 px-8">View credentials</a>
              ${person.status === "Under review"
                ? `<button type="button" class="shortlist-button ${buttonColor} text-sm font-medium text-center py-3 rounded-lg px-8">${buttonText}</button>`
                : person.status === "Accepted"
                  ? `<a href="${PAGES.shiftDetails}?shift=${encodeURIComponent(person.shiftId)}" class="bg-blue-600 text-white text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-700 px-8">Open shift</a>`
                  : ""}
            </div>
          </div>`;
      });
      applicantList.innerHTML = html ||
        `<p class="text-sm text-gray-700">No applications yet. Workers who apply for ${shiftId ? "this shift" : "your shifts"} will appear here.</p>`;

      countEnding = " · " + data.waitingForReview + " waiting for your review";
      updateCount(data.applicants.length);
    } catch (error) {
      showGeneralError("Couldn't load the applicants: " + error.message);
    }
  }

  loadApplicants();
}

// Shortlist buttons: clicking switches between "Shortlist" and "Shortlisted ✓".
// One listener on the whole page catches every Shortlist button, even ones added later.
document.addEventListener("click", async function (event) {
  const button = event.target;
  if (!button.classList.contains("shortlist-button")) {
    return;
  }

  const isShortlisted = button.textContent.trim() !== "Shortlist";

  // Tell the server: POST adds to the shortlist, DELETE removes from it
  // Not on the server yet (SERVER_HAS.shortlist): the button only changes on this page
  if (!usesDemo("shortlist")) {
    const applicationId = button.closest(".applicant-card").getAttribute("data-application");
    try {
      await apiRequest(ENDPOINTS.shortlist(applicationId), isShortlisted ? "DELETE" : "POST");
    } catch (error) {
      showGeneralError("Couldn't update the shortlist: " + error.message);
      return;
    }
  }

  if (!isShortlisted) {
    button.textContent = "Shortlisted ✓";
    button.classList.remove("bg-blue-600", "text-white", "hover:bg-blue-700");
    button.classList.add("bg-green-50", "text-green-700");
  } else {
    button.textContent = "Shortlist";
    button.classList.remove("bg-green-50", "text-green-700");
    button.classList.add("bg-blue-600", "text-white", "hover:bg-blue-700");
  }
});

// ==================================================
// 8. WORKER PROFILE
// ==================================================

const shortlistWorker = document.getElementById("shortlistWorker");

if (shortlistWorker) {
  const offerShift = document.getElementById("offerShift");

  // The worker and shift come from the address, e.g. WorkerProfile.html?worker=WK-1048&shift=SH-0824
  const workerId = getUrlValue("worker");
  const shiftId = getUrlValue("shift");

  // "View verified credential" opens the applicant's full profile (same worker, application and shift)
  const credentialLink = document.getElementById("viewCredentialLink");
  if (credentialLink) {
    credentialLink.href = "../FacilityHiringSection/ApplicantProfile.html" + window.location.search;
  }

  // Show the worker's details in the elements with data-field="..."
  async function loadWorker() {
    if (USE_DEMO_MODE || !workerId) {
      return; // keep the sample profile in the HTML
    }

    try {
      const worker = await Backend.workerForFacility(workerId, getUrlValue("application"));
      fillFields(worker);
      // The badge: only "Verified" when the worker really is
      const badge = document.getElementById("workerBadge");
      if (badge && worker.badge) {
        badge.textContent = worker.badge.text;
        badge.className = "inline-block text-xs font-semibold px-3 py-1 rounded " +
          { green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-600", gray: "bg-gray-100 text-gray-600" }[worker.badge.color];
      }
      // Already booked or declined: the Offer button says so
      if (worker.applicationStatus !== "Under review") {
        offerShift.textContent = worker.applicationStatus === "Accepted" ? "Booked ✓" : "Application declined";
        offerShift.disabled = true;
        offerShift.classList.remove("hover:bg-blue-700");
        offerShift.classList.add("opacity-60", "cursor-not-allowed");
      }
      // The roles and soft skills (drawn by experience.js, loaded on this page)
      if (typeof showWorkerExperience === "function") {
        showWorkerExperience(worker);
      }
    } catch (error) {
      showGeneralError("Couldn't load this profile: " + error.message);
    }
  }

  loadWorker();

  // Shortlist worker: switch between "Shortlist worker" and "Shortlisted ✓"
  shortlistWorker.addEventListener("click", function () {
    if (shortlistWorker.textContent.trim() === "Shortlist worker") {
      shortlistWorker.textContent = "Shortlisted ✓";
    } else {
      shortlistWorker.textContent = "Shortlist worker";
    }
  });

  // Offer shift: send the offer, then stop it being sent twice
  offerShift.addEventListener("click", async function () {
    // REAL: the backend books the worker by accepting their application
    if (!USE_DEMO_MODE) {
      const applicationId = getUrlValue("application");
      if (!applicationId) {
        showGeneralError("Open this profile from the Applicants page to book this worker.");
        return;
      }

      setLoading(offerShift, true, "Booking…");
      try {
        await Backend.acceptApplication(applicationId);
      } catch (error) {
        showGeneralError("Couldn't send the offer: " + error.message);
        setLoading(offerShift, false);
        return;
      }
    }

    offerShift.textContent = USE_DEMO_MODE ? "Offer sent ✓" : "Booked ✓";
    offerShift.disabled = true;
    offerShift.classList.remove("hover:bg-blue-700");
    offerShift.classList.add("opacity-60", "cursor-not-allowed");
  });
}

// ==================================================
// 9. FACILITY PROFILE
// ==================================================

const profileForm = document.getElementById("profileForm");

if (profileForm) {
  // The form's boxes, by id. Their ids match the names the server sends and expects.
  const profileFields = ["facilityName", "facilityType", "cityState", "address", "about", "contactPerson", "workEmail", "phone"];

  // Load the profile. The server should answer with a value for each box above,
  // plus registrationStatus, identityStatus and workplaceLocation for the "Verified facility" card.
  async function loadProfile() {
    if (USE_DEMO_MODE) {
      return; // keep the sample values in the HTML
    }

    try {
      const profile = await Backend.facilityProfileForm();

      // Put each value into its box (.value, because these are inputs, not text)
      profileFields.forEach(function (id) {
        if (profile[id] !== undefined) {
          document.getElementById(id).value = profile[id];
        }
      });
      fillFields(profile); // the verification card
      showFacilityVerification(profile.status);
    } catch (error) {
      showGeneralError("Couldn't load your profile: " + error.message);
    }
  }

  // The verification card: "Verified facility" only once an admin has approved every document
  function showFacilityVerification(status) {
    setBadge(document.getElementById("facilityBadge"), status, "facility");
    const copy = {
      verified: ["Verified facility", "We've checked your facility documents. You're ready to hire."],
      pending: ["Verification in progress", "Your documents are being reviewed. You can post shifts once they're approved."],
      resubmission: ["Verification in progress", "Your corrected documents are being reviewed."],
      rejected: ["Documents need attention", "One or more documents were rejected. Upload corrected documents to continue."],
      not_submitted: ["Verification needed", "Upload your registration documents so we can verify your facility."],
    }[status] || ["Verification needed", "Upload your registration documents so we can verify your facility."];
    const title = document.getElementById("verificationTitle");
    title.textContent = copy[0];
    title.className = "text-lg font-semibold mt-3 " + (status === "verified" ? "text-teal-700" : status === "rejected" ? "text-red-600" : "text-gray-900");
    document.getElementById("verificationText").textContent = copy[1];
    const action = document.getElementById("verificationAction");
    action.classList.toggle("hidden", status !== "not_submitted" && status !== "rejected");
    action.textContent = status === "rejected" ? "Upload corrected documents" : "Upload documents";
  }

  loadProfile();

  profileForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    let isValid = true;

    // 1. These must not be empty
    // "About your facility" isn't stored by the backend yet, so it's only required in demo mode
    const requiredProfileFields = ["facilityName", "cityState", "address", "contactPerson"];
    if (USE_DEMO_MODE) {
      requiredProfileFields.push("about");
    }
    requiredProfileFields.forEach(function (id) {
      if (getValue(id) === "") {
        showError(id, "This field is required.");
        isValid = false;
      } else {
        clearError(id);
      }
    });

    // 2. Facility name: at least 3 characters
    if (getValue("facilityName") !== "" && getValue("facilityName").length < 3) {
      showError("facilityName", "The facility name is too short.");
      isValid = false;
    }

    // 3. Work email: something@something.something
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(getValue("workEmail"))) {
      showError("workEmail", "Please enter a valid email, like staffing@facility.com.");
      isValid = false;
    } else {
      clearError("workEmail");
    }

    // 4. Phone: Nigerian number, like +234 800 000 0000 or 0800 000 0000
    const phone = getValue("phone").replace(/[\s-]/g, "");
    if (!/^\+234[0-9]{10}$/.test(phone) && !/^0[0-9]{10}$/.test(phone)) {
      showError("phone", "Enter a valid number, like +234 800 000 0000.");
      isValid = false;
    } else {
      clearError("phone");
    }

    if (!isValid) {
      scrollToFirstError();
      return;
    }

    // REAL: save the changes on the server
    if (!USE_DEMO_MODE) {
      const saveButton = profileForm.querySelector('button[type="submit"]');
      const details = {};
      profileFields.forEach(function (id) {
        details[id] = getValue(id);
      });

      setLoading(saveButton, true, "Saving…");
      try {
        await Backend.saveFacilityProfile(details);
      } catch (error) {
        // Show the error under the right box if the server said which one
        if (error.field && document.getElementById(error.field + "Error")) {
          showError(error.field, error.message);
        } else {
          showGeneralError("Couldn't save your changes: " + error.message);
        }
        setLoading(saveButton, false);
        return;
      }
    }

    window.location.href = PAGES.profileSaved;
  });
}

// (The log out button is handled in api.js, shared by every page.)