// ====== WORKER DASHBOARD (shared by all worker pages) ======
// Needs /js/api.js to be loaded first.
//
// Every page loads this same file, but not every page has every part.
// So before each part, we check that its elements exist on the current page:
// "if (something)" is false when getElementById finds nothing (null).
//
// HOW DATA LOADING WORKS
// In demo mode (USE_DEMO_MODE = true in api.js), the sample cards written in the HTML are used.
// With the real backend, each "load..." function asks the server for the data and
// replaces the sample cards with the real ones.

// 👉 The worker pages that the JS links to. Make these match your real file names exactly.
const PAGES = {
  shiftDetails: "../WorkerShiftMarket/ShiftDetails.html",
  applicationSubmitted: "../WorkerShiftMarket/ApplicationSubmitted.html",
  facilityReviews: "../WorkerShiftMarket/FacilityRatingReview.html",
};

// ==================================================
// HELPERS
// ==================================================

// The colors for each badge color name the server can send
const BADGE_COLORS = {
  amber: "bg-amber-50 text-amber-700",
  green: "bg-green-50 text-green-700",
  blue: "bg-blue-50 text-blue-600",
  gray: "bg-gray-100 text-gray-600",
  red: "bg-red-50 text-red-600",
};

// Build a small colored badge, e.g. badgeHtml("Urgent", "amber")
function badgeHtml(text, color) {
  if (!text) {
    return "";
  }
  const colors = BADGE_COLORS[color] || BADGE_COLORS.blue;
  return `<span class="inline-block ${colors} text-xs font-semibold uppercase px-2 py-1 rounded">${escapeHtml(text)}</span>`;
}

// The facility name, as a link to its reviews if the server sent a facilityId
function facilityHtml(shift) {
  if (shift.facilityId) {
    return `<a href="${PAGES.facilityReviews}?facility=${encodeURIComponent(shift.facilityId)}" class="hover:underline">${escapeHtml(shift.facility)}</a>`;
  }
  return escapeHtml(shift.facility);
}

// Build one shift card (used on the Find shifts page).
// shift = { id, title, badge, badgeColor, facility, when, pay }
function shiftCardHtml(shift, extraClass, extraAttributes) {
  return `
    <div class="${extraClass} border border-gray-200 rounded-xl p-5 bg-white" ${extraAttributes || ""}>
      <div class="flex justify-between items-start gap-3">
        <p class="text-base font-semibold">${escapeHtml(shift.title)}</p>
        ${badgeHtml(shift.badge, shift.badgeColor)}
      </div>
      <p class="text-xs text-gray-700 mt-1">${facilityHtml(shift)}</p>
      <p class="text-xs text-gray-700 mt-3">${escapeHtml(shift.when)}</p>
      <div class="flex justify-between items-center gap-3 mt-1">
        <p class="text-sm font-semibold">${escapeHtml(shift.pay)}</p>
        <a href="${PAGES.shiftDetails}?shift=${encodeURIComponent(shift.id)}" class="bg-blue-600 text-white text-sm font-medium px-8 py-3 rounded-lg hover:bg-blue-700">View shift</a>
      </div>
    </div>`;
}

// A worker can apply for a shift only once: if they already have, the Apply link/button becomes
// a grey "Applied ✓" (or "Booked ✓" once the facility accepted them)
async function lockIfApplied(element, kind) {
  const shiftId = getUrlValue("shift");
  if (USE_DEMO_MODE || !shiftId || !element) {
    return;
  }
  let applied = {};
  try {
    applied = await Backend.myAppliedShifts();
  } catch (error) {
    return; // can't tell: leave it as it is (the server still refuses a second application)
  }
  const status = applied[shiftId];
  if (!status) {
    return;
  }
  const label = status === "Accepted" ? "Booked ✓" : status === "Not selected" ? "Application not selected" : "Applied ✓";
  element.textContent = label;
  element.classList.remove("bg-blue-600", "hover:bg-blue-700", "text-white");
  element.classList.add("bg-slate-200", "text-gray-600", "cursor-not-allowed");
  element.setAttribute("aria-disabled", "true");
  element.setAttribute("title", "You've already applied for this shift");
  if (kind === "link") {
    element.removeAttribute("href");
  } else {
    element.disabled = true;
  }
  if (status === "Accepted") {
    const link = document.createElement("a");
    link.href = "../WorkerShiftMarket/UpcomingShifts.html?shift=" + encodeURIComponent(shiftId);
    link.className = "block border border-blue-600 text-blue-600 text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-50 px-8 mt-3";
    link.textContent = "Go to my shift";
    element.insertAdjacentElement("afterend", link);
  }
}

// ==================================================
// 1. MOBILE MENU (every page)
// ==================================================

const menuButton = document.getElementById("menuButton");
const closeMenuButton = document.getElementById("closeMenuButton");
const sidebar = document.getElementById("sidebar");

if (menuButton) {
  // Clicking the menu icon opens the sidebar
  menuButton.addEventListener("click", function () {
    sidebar.classList.remove("hidden");
  });

  // Clicking the close icon (inside the sidebar) closes it again.
  // We need this because the open sidebar covers the menu button on mobile.
  closeMenuButton.addEventListener("click", function () {
    sidebar.classList.add("hidden");
  });
}

// ==================================================
// 2. SIMPLE PAGES (Dashboard, Upcoming shifts, Profile)
// ==================================================

// These pages only need their texts filled in. Each page says which one it is
// with data-page="..." on its <body>, e.g. <body data-page="dashboard" ...>
// The server answers with values for every data-field="..." on that page.
const pageName = document.body.getAttribute("data-page");

async function loadSimplePage() {
  if (USE_DEMO_MODE) {
    return; // keep the sample texts in the HTML
  }

  try {
    if (pageName === "profile") {
      // The worker's own profile (backend.js translates the backend's fields)
      const profile = await Backend.workerOwnProfile();
      fillFields(profile);
      showProfileVerification(profile.status);
      setupProfileEditing(profile.raw);
    }
    if (pageName === "dashboard") {
      await loadWorkerDashboard();
    }
  } catch (error) {
    showGeneralError("Couldn't load this page: " + error.message);
  }
}

// The badges on the profile page: "Verified" only once an admin has approved the documents
function showProfileVerification(status) {
  setBadge(document.getElementById("profileBadge"), status, "professional");
  setBadge(document.getElementById("trustBadge"), status, "professional");
  const texts = {
    verified: "Your verified status helps facilities review applications with confidence.",
    pending: "Your documents are being reviewed. You'll be able to apply for shifts once they're approved.",
    resubmission: "Your corrected documents are being reviewed.",
    rejected: "One or more documents need to be uploaded again. Open Verification details to see why.",
    not_submitted: "Upload your documents to get verified and start applying for shifts.",
  };
  const trustText = document.getElementById("trustText");
  if (trustText) {
    trustText.textContent = texts[status] || texts.not_submitted;
  }
}

// "Edit professional profile": a small form under the profile card
function setupProfileEditing(raw) {
  const button = document.getElementById("editProfileButton");
  const form = document.getElementById("editProfileForm");
  if (!button || !form) {
    return;
  }
  const loc = (raw && raw.location) || {};
  const values = {
    editFullName: (raw && (raw.fullName || (raw.user && raw.user.fullName))) || "",
    editProfession: (raw && raw.profession) || "",
    editSpecialty: (raw && raw.specialty) || "",
    editYears: raw && raw.yearsOfExperience !== undefined && raw.yearsOfExperience !== null ? raw.yearsOfExperience : "",
    editAddress: loc.address || "",
    editState: loc.state || "",
    editAbout: (raw && raw.about) || "",
  };

  button.addEventListener("click", function () {
    Object.keys(values).forEach(function (id) {
      document.getElementById(id).value = values[id];
    });
    form.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("cancelEditProfile").addEventListener("click", function () {
    form.classList.add("hidden");
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const name = document.getElementById("editFullName").value.trim();
    const years = document.getElementById("editYears").value.trim();
    const nameError = document.getElementById("editFullNameError");
    const yearsError = document.getElementById("editYearsError");
    nameError.classList.add("hidden");
    yearsError.classList.add("hidden");
    if (name.length < 3) {
      nameError.textContent = "Please enter your full name.";
      nameError.classList.remove("hidden");
      return;
    }
    if (years !== "" && (Number(years) < 0 || Number(years) > 60)) {
      yearsError.textContent = "Enter a number between 0 and 60.";
      yearsError.classList.remove("hidden");
      return;
    }
    const saveButton = document.getElementById("saveProfileButton");
    setLoading(saveButton, true, "Saving…");
    try {
      await Backend.saveWorkerProfile({
        fullName: name,
        profession: document.getElementById("editProfession").value.trim(),
        specialty: document.getElementById("editSpecialty").value.trim(),
        yearsOfExperience: years,
        about: document.getElementById("editAbout").value.trim(),
        locationAddress: document.getElementById("editAddress").value.trim(),
        locationState: document.getElementById("editState").value.trim(),
      });
    } catch (error) {
      showGeneralError("Couldn't save your profile: " + error.message);
      setLoading(saveButton, false);
      return;
    }
    sessionSet("displayName", name);
    window.location.reload();
  });
}

// The verified dashboard: next booked shift, application counts and one recommended shift
async function loadWorkerDashboard() {
  // Don't show the design's sample content while the real data loads
  fillFields({ greeting: "Welcome back.", underReviewCount: "…", acceptedCount: "…", nextShiftTitle: "Loading…",
    nextShiftPlace: "", nextShiftWhen: "", nextShiftNote: "" });
  const recommendedBox = document.getElementById("recommendedList");
  if (recommendedBox) recommendedBox.innerHTML = '<p class="text-xs text-gray-700">Loading…</p>';
  const data = await Backend.workerDashboard();
  fillFields({
    greeting: data.greeting,
    underReviewCount: data.underReviewCount,
    acceptedCount: data.acceptedCount,
  });

  const nextCard = document.getElementById("nextShiftCard");
  if (nextCard) {
    if (data.nextShift) {
      fillFields(data.nextShift);
      document.getElementById("nextShiftLink").href = "../WorkerShiftMarket/UpcomingShifts.html?shift=" + encodeURIComponent(data.nextShift.id);
    } else {
      nextCard.innerHTML = `
        <p class="text-xs font-medium text-blue-600 uppercase">Next shift</p>
        <h2 class="text-xl font-semibold mt-3">No booked shifts yet</h2>
        <p class="text-sm text-gray-700 mt-3">When a facility accepts your application, your shift appears here with everything you need to clock in.</p>
        <a href="../WorkerShiftMarket/FindShifts.html" class="inline-block bg-blue-600 text-white text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-700 px-8 mt-5">Find shifts</a>`;
    }
  }

  const recommendedList = document.getElementById("recommendedList");
  if (recommendedList) {
    recommendedList.innerHTML = data.recommended
      ? shiftCardHtml(data.recommended, "shift-card")
      : `<p class="text-xs text-gray-700">No new open shifts right now. Check back soon.</p>`;
  }
}

// The dashboard first shows the right version for the account's verification status
// (see showDashboardState in api.js). Only a verified account needs the full dashboard data.
async function startPage() {
  if (pageName === "dashboard") {
    const status = await showDashboardState();
    if (status !== "verified") {
      return;
    }
  }
  loadSimplePage();
}

startPage();

// ==================================================
// 3. FIND SHIFTS (load and search)
// ==================================================

const shiftSearch = document.getElementById("shiftSearch");

if (shiftSearch) {
  const shiftList = document.getElementById("shiftList");
  const noResults = document.getElementById("noResults");
  const resultsText = document.getElementById("resultsText");

  // Get the cards each time, because loadShifts() can replace them
  function getCards() {
    return document.querySelectorAll(".shift-card");
  }

  // Show only the cards that contain the search text
  function searchShifts() {
    // toLowerCase() so "nurse" also finds "Nurse"
    const searchText = shiftSearch.value.trim().toLowerCase();
    const cards = getCards();
    let shownCount = 0;

    cards.forEach(function (card) {
      // textContent is all the words inside the card (title, facility, place...)
      if (card.textContent.toLowerCase().includes(searchText)) {
        card.classList.remove("hidden");
        shownCount = shownCount + 1;
      } else {
        card.classList.add("hidden");
      }
    });

    // Show the "No shifts match" message only when nothing is left
    if (shownCount === 0) {
      noResults.classList.remove("hidden");
    } else {
      noResults.classList.add("hidden");
    }

    // Update the small line under the list
    if (USE_DEMO_MODE) {
      resultsText.textContent = "Showing " + shownCount + " of 24 sample shifts · All times are WAT";
    } else {
      resultsText.textContent = "Showing " + shownCount + " of " + cards.length + " shifts · All times are WAT";
    }
  }

  // Load the recommended shifts. The server answers with a list like:
  // [ { id: "SH-0824", title: "Registered Nurse · Acute Care", badge: "Urgent", badgeColor: "amber",
  //     facility: "Mainland Care Hospital · Verified facility",
  //     when: "Tue, 6 Oct · 07:00–19:00 WAT · Ikeja, Lagos · 4.2 km", pay: "₦3,000/hr · ₦36,000 total" }, ... ]
  // The cards need a wrapper with id="shiftList" in the HTML.
  async function loadShifts() {
    if (USE_DEMO_MODE || !shiftList) {
      return; // keep the sample cards in the HTML
    }

    try {
      const shifts = await Backend.searchShifts({});

      let html = "";
      shifts.forEach(function (shift) {
        html += shiftCardHtml(shift, "shift-card");
      });
      shiftList.innerHTML = html;

      searchShifts();
    } catch (error) {
      showGeneralError("Couldn't load shifts: " + error.message);
    }
  }

  shiftSearch.addEventListener("input", searchShifts);
  loadShifts();
}

// ==================================================
// 4. SHIFT DETAILS (load one shift)
// ==================================================

// The "Apply for this shift" link needs id="applyLink" in the HTML
const applyLink = document.getElementById("applyLink");

if (applyLink) {
  // The shift comes from the address, e.g. shiftDetails.html?shift=SH-0824
  const shiftId = getUrlValue("shift");

  // Pass the shift on to the review page, so it knows which shift to apply for
  if (shiftId) {
    applyLink.href = applyLink.getAttribute("href").split("?")[0] + "?shift=" + encodeURIComponent(shiftId);
  }

  async function loadShiftDetails() {
    if (USE_DEMO_MODE || !shiftId) {
      return; // keep the sample shift in the HTML
    }

    try {
      const shift = await Backend.shiftForWorker(shiftId);
      fillFields(shift);
    } catch (error) {
      showGeneralError("Couldn't load this shift: " + error.message);
    }
    lockIfApplied(applyLink, "link");
  }

  loadShiftDetails();
}

// ==================================================
// 5. FILTER TABS (My applications page)
// ==================================================

const filterTabs = document.querySelectorAll(".filter-tab");

if (filterTabs.length > 0) {
  const applicationList = document.getElementById("applicationList");
  let currentFilter = "all";

  // The status text the server sends → the tab it belongs to, and its badge color
  const statusInfo = {
    "Offered": { key: "offered", color: "blue" },
    "Under review": { key: "review", color: "amber" },
    "Accepted": { key: "accepted", color: "green" },
    "Not selected": { key: "not-selected", color: "gray" },
  };

  // Show the applications that match the chosen tab, hide the rest
  function filterApplications() {
    document.querySelectorAll(".application-item").forEach(function (application) {
      const status = application.getAttribute("data-status");

      if (currentFilter === "all" || currentFilter === status) {
        application.classList.remove("hidden");
      } else {
        application.classList.add("hidden");
      }
    });
  }

  filterTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      // Which tab was clicked: "all", "review", "accepted" or "not-selected"
      currentFilter = tab.getAttribute("data-filter");

      // Make every tab look "not picked"...
      filterTabs.forEach(function (otherTab) {
        otherTab.classList.remove("bg-blue-600", "text-white");
        otherTab.classList.add("text-gray-700");
      });
      // ...then make the clicked tab blue
      tab.classList.remove("text-gray-700");
      tab.classList.add("bg-blue-600", "text-white");

      filterApplications();
    });
  });

  // Load the applications. The server answers with a list like:
  // [ { id: "AP-201", title: "Registered Nurse · Acute Care", status: "Offered" | "Under review" | "Accepted" | "Not selected",
  //     shiftId: "CP-1042" (needed for offers),
  //     details: "Mainland Care Hospital · 6 Oct · 07:00–19:00 WAT" }, ... ]
  // The items need a wrapper with id="applicationList" in the HTML.
  async function loadApplications() {
    if (USE_DEMO_MODE || !applicationList) {
      return; // keep the sample applications in the HTML
    }

    try {
      const applications = await Backend.myApplications();

      let html = "";
      applications.forEach(function (item) {
        const info = statusInfo[item.status] || { key: "review", color: "blue" };

        html += `
          <div class="application-item border border-gray-200 rounded-xl p-3" data-status="${info.key}">
            <div class="flex justify-between items-center gap-3">
              <p class="text-sm font-semibold">${escapeHtml(item.title)}</p>
              ${badgeHtml(item.status, info.color)}
            </div>
            <p class="text-xs text-gray-700 mt-3">${escapeHtml(item.details)}</p>
            ${item.status === "Offered" || item.status === "Accepted"
              ? `<a href="../WorkerShiftMarket/UpcomingShifts.html?shift=${encodeURIComponent(item.shiftId)}" class="inline-block text-xs font-medium text-blue-600 mt-2">${item.status === "Offered" ? "View offer" : "Go to my shift"} →</a>`
              : `<a href="${PAGES.shiftDetails}?shift=${encodeURIComponent(item.shiftId)}" class="inline-block text-xs font-medium text-blue-600 mt-2">View shift →</a>`}
          </div>`;
      });
      applicationList.innerHTML = html;

      filterApplications();
    } catch (error) {
      showGeneralError("Couldn't load your applications: " + error.message);
    }
  }

  loadApplications();
}

// ==================================================
// 6. SUBMIT APPLICATION (Review application page)
// ==================================================

const submitApplication = document.getElementById("submitApplication");

if (submitApplication) {
  // The shift comes from the address, e.g. ReviewApplication.html?shift=SH-0824
  const shiftId = getUrlValue("shift");

  // Show the shift's details in the "Shift summary" (elements with data-field="...")
  async function loadShiftSummary() {
    if (USE_DEMO_MODE || !shiftId) {
      return; // keep the sample shift in the HTML
    }

    try {
      const shift = await Backend.shiftForWorker(shiftId);
      fillFields(shift);
    } catch (error) {
      showGeneralError("Couldn't load this shift: " + error.message);
    }
  }

  loadShiftSummary();
  if (!USE_DEMO_MODE) {
    lockIfApplied(submitApplication, "button");
  }

  submitApplication.addEventListener("click", async function () {
    if (submitApplication.disabled) {
      return;
    }
    const messageInput = document.getElementById("message");
    const messageError = document.getElementById("messageError");
    const message = messageInput.value.trim();

    // The message must be between 10 and 300 characters
    let error = "";

    if (message.length < 10) {
      error = "Please write a short message to the facility (at least 10 characters).";
    } else if (message.length > 300) {
      error = "Your message is too long. Please keep it under 300 characters.";
    }

    // Show an error and make the border red
    function showMessageError(text) {
      messageError.textContent = text;
      messageError.classList.remove("hidden");
      messageInput.classList.remove("border-gray-200");
      messageInput.classList.add("border-red-500");
    }

    if (error !== "") {
      showMessageError(error);
      return;
    }

    // DEMO: go straight to the "submitted" page
    if (USE_DEMO_MODE) {
      window.location.href = PAGES.applicationSubmitted;
      return;
    }

    // REAL: send the application. The server answers with something like
    // { reference: "CP-2026-1048", submitted: "29 Sep 2026 · 09:55 WAT", status: "Under review", facility: "..." }
    setLoading(submitApplication, true, "Submitting…");

    try {
      // (The backend doesn't store the message yet)
      const application = await Backend.applyToShift(shiftId);

      // Save the answer so the "submitted" page can show the reference number
      sessionStorage.setItem("lastApplication", JSON.stringify(application));
      window.location.href = PAGES.applicationSubmitted;
    } catch (requestError) {
      // e.g. "You have already applied for this shift." or "Applications are closed."
      showMessageError(requestError.message);
      setLoading(submitApplication, false);
    }
  });
}

// ==================================================
// 7. APPLICATION SUBMITTED (show the reference number)
// ==================================================

// The submitted page says which one it is with <body data-page="submitted">
if (pageName === "submitted") {
  // The review page saved the server's answer. JSON.parse turns the saved text back into an object.
  const saved = sessionStorage.getItem("lastApplication");

  if (saved) {
    fillFields(JSON.parse(saved));
  }
}

// ==================================================
// 8. SEARCH & FILTERS (Search shifts page)
// ==================================================

const applyFilters = document.getElementById("applyFilters");

if (applyFilters) {
  const resultList = document.getElementById("resultList");
  const resultSearch = document.getElementById("resultSearch");
  const minPayInput = document.getElementById("minPay");
  const minPayError = document.getElementById("minPayError");

  function getCards() {
    return document.querySelectorAll(".result-card");
  }

  // Update "24 shifts match your filters" ("1 shift matches" for just one)
  function updateCount(count) {
    if (count === 1) {
      document.getElementById("resultCount").textContent = "1 shift matches your filters";
    } else {
      document.getElementById("resultCount").textContent = count + " shifts match your filters";
    }
  }

  // DEMO: show only the sample cards that match the search box, shift type and minimum pay
  function filterResults() {
    const searchText = resultSearch.value.trim().toLowerCase();
    const shiftType = document.getElementById("shiftType").value;
    const minPay = Number(minPayInput.value);
    let shownCount = 0;

    getCards().forEach(function (card) {
      // Read the card's details from its data-pay and data-type attributes
      const cardPay = Number(card.getAttribute("data-pay"));
      const cardType = card.getAttribute("data-type");
      const cardText = card.textContent.toLowerCase();

      // The card must pass all three checks to stay visible
      const matchesSearch = cardText.includes(searchText);
      const matchesType = shiftType === "Any shift" || shiftType === cardType;
      const matchesPay = cardPay >= minPay;

      if (matchesSearch && matchesType && matchesPay) {
        card.classList.remove("hidden");
        shownCount = shownCount + 1;
      } else {
        card.classList.add("hidden");
      }
    });

    updateCount(shownCount);
  }

  // REAL: ask the server for the shifts that match every filter.
  // The server answers with a list of shifts (same shape as on the Find shifts page,
  // plus pay and type), e.g. [ { id, title, badge, badgeColor, facility, when, pay, payPerHour, type }, ... ]
  // The cards need a wrapper with id="resultList" in the HTML.
  async function searchOnServer() {
    // URLSearchParams builds the "?search=...&type=..." part of the address safely
    const query = new URLSearchParams({
      search: resultSearch.value.trim(),
      profession: document.getElementById("profession").value,
      specialty: document.getElementById("filterSpecialty").value,
      location: document.getElementById("filterLocation").value,
      date: document.getElementById("filterDate").value,
      type: document.getElementById("shiftType").value,
      minPay: minPayInput.value.trim(),
    });

    setLoading(applyFilters, true, "Searching…");

    try {
      const shifts = await Backend.searchShifts(Object.fromEntries(query));

      let html = "";
      shifts.forEach(function (shift) {
        const attributes = `data-pay="${escapeHtml(shift.payPerHour)}" data-type="${escapeHtml(shift.type)}"`;
        html += shiftCardHtml(shift, "result-card", attributes);
      });
      resultList.innerHTML = html;

      updateCount(shifts.length);
    } catch (error) {
      showGeneralError("Couldn't search shifts: " + error.message);
    }

    setLoading(applyFilters, false);
  }

  // Apply filters: check the minimum pay first, then filter
  applyFilters.addEventListener("click", function () {
    const minPay = minPayInput.value.trim();

    // Minimum pay must be a whole number of 0 or more
    if (minPay === "" || !Number.isInteger(Number(minPay)) || Number(minPay) < 0) {
      minPayError.textContent = "Please enter a whole number, like 3000.";
      minPayError.classList.remove("hidden");
      return;
    }
    minPayError.classList.add("hidden");

    // Update the blue summary line, e.g. "Registered nurse · Acute care · Lagos · Day shift · ₦3,000+/hr"
    // toLocaleString() adds commas: 3000 becomes "3,000"
    const location = document.getElementById("filterLocation").value.split(" · ")[0];
    document.getElementById("filterSummary").textContent =
      document.getElementById("profession").value + " · " +
      document.getElementById("filterSpecialty").value + " · " +
      location + " · " +
      document.getElementById("filterDate").value + " · " +
      document.getElementById("shiftType").value + " · ₦" +
      Number(minPay).toLocaleString() + "+/hr";

    if (USE_DEMO_MODE || !resultList) {
      filterResults();
    } else {
      searchOnServer();
    }
  });

  // Reset filters: put every dropdown back to its first option and pay back to 3000
  document.getElementById("resetFilters").addEventListener("click", function () {
    document.querySelectorAll("select").forEach(function (select) {
      select.selectedIndex = 0;
    });
    minPayInput.value = USE_DEMO_MODE ? "3000" : "0";
    resultSearch.value = "";
    minPayError.classList.add("hidden");
    document.getElementById("filterSummary").textContent = USE_DEMO_MODE
      ? "Registered nurse · Acute care · Lagos · Day shift · ₦3,000+/hr"
      : "All open shifts";

    if (USE_DEMO_MODE || !resultList) {
      // Show every sample card again
      getCards().forEach(function (card) {
        card.classList.remove("hidden");
      });
      document.getElementById("resultCount").textContent = "24 shifts match your filters";
    } else {
      searchOnServer();
    }
  });

  // The search box filters the cards on the page as you type
  resultSearch.addEventListener("input", filterResults);

  // Load the first results when the page opens (real backend only)
  if (!USE_DEMO_MODE && resultList) {
    searchOnServer();
  }
}

// ==================================================
// 9. FACILITY REVIEWS (load and sort)
// ==================================================

const sortReviews = document.getElementById("sortReviews");

if (sortReviews) {
  const reviewList = document.getElementById("reviewList");

  // The facility comes from the address, e.g. facilityReviews.html?facility=FC-0216
  const facilityId = getUrlValue("facility");

  // Sort the review cards: by rating, or by date (newest first)
  function sortReviewCards() {
    // Turn the review cards into a normal list so we can sort them
    const reviews = Array.from(reviewList.querySelectorAll(".review-card"));

    reviews.sort(function (a, b) {
      if (sortReviews.value === "Highest rated") {
        // Bigger rating first
        return Number(b.getAttribute("data-rating")) - Number(a.getAttribute("data-rating"));
      }
      // "Most recent": newer date first. Dates like "2026-09-28" can be compared as text.
      return b.getAttribute("data-date").localeCompare(a.getAttribute("data-date"));
    });

    // appendChild moves each card to the end, so they end up in the sorted order
    reviews.forEach(function (review) {
      reviewList.appendChild(review);
    });
  }

  sortReviews.addEventListener("change", sortReviewCards);

  // Load the ratings and reviews. The server answers with values for every
  // data-field="..." on the page, plus a list of reviews like:
  // { ..., reviews: [ { name: "Amara O. · Registered nurse", rating: 5, date: "2026-09-28",
  //                     dateText: "28 Sep 2026", text: "Clear handover..." }, ... ] }
  async function loadReviews() {
    if (usesDemo("facilityReviews") || !facilityId) {
      showPreviewNote("Facility reviews");
      return; // keep the sample reviews in the HTML
    }

    try {
      const data = await apiRequest(ENDPOINTS.facilityReviews(facilityId));
      fillFields(data);

      let html = "";
      data.reviews.forEach(function (review) {
        // "★★★★☆" for a rating of 4: repeat() writes a character several times
        const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

        html += `
          <div class="review-card bg-white border border-gray-200 rounded-2xl p-5" data-rating="${escapeHtml(review.rating)}" data-date="${escapeHtml(review.date)}">
            <p class="text-base font-semibold">${escapeHtml(review.name)}</p>
            <p class="text-xs font-medium text-teal-700 mt-3">${stars} · ${escapeHtml(review.dateText)} · Verified completed shift</p>
            <p class="text-xs text-gray-700 mt-3">${escapeHtml(review.text)}</p>
          </div>`;
      });
      reviewList.innerHTML = html;

      sortReviewCards();
    } catch (error) {
      showGeneralError("Couldn't load the reviews: " + error.message);
    }
  }

  loadReviews();
}

// (The log out button is handled in api.js, shared by every page.)
