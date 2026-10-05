// ====== FACILITY DASHBOARD (shared by all facility pages) ======

// Every page loads this same file, but not every page has every part.
// So before each part, we check that its elements exist on the current page.

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
// 2. POST A SHIFT (Post a shift page)
// ==================================================

const reviewShiftButton = document.getElementById("reviewShift");

if (reviewShiftButton) {
  // ---------- Helpers ----------

  // Get what the user typed (trim() removes extra spaces)
  function getValue(id) {
    return document.getElementById(id).value.trim();
  }

  function showError(id, message) {
    const errorText = document.getElementById(id + "Error");
    errorText.textContent = message;
    errorText.classList.remove("hidden");
    document.getElementById(id).classList.add("border-red-500");
  }

  function clearError(id) {
    document.getElementById(id + "Error").classList.add("hidden");
    document.getElementById(id).classList.remove("border-red-500");
  }

  // Turn "07:00" into minutes after midnight (7 × 60 = 420)
  function toMinutes(time) {
    const parts = time.split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  // How many hours the shift lasts. A night shift like 18:00–07:00 goes past midnight,
  // so if the end is earlier than the start we add 24 hours.
  function getShiftHours() {
    let minutes =
      toMinutes(getValue("endTime")) - toMinutes(getValue("startTime"));
    if (minutes <= 0) {
      minutes = minutes + 24 * 60;
    }
    return minutes / 60;
  }

  // Turn 36000 into "₦36,000"
  function naira(amount) {
    return "₦" + amount.toLocaleString();
  }

  // ---------- Live summary ----------

  // Update the "Shift summary" card from what's in the form
  function updateSummary() {
    const workers = Number(getValue("workersNeeded"));
    const pay = Number(getValue("hourlyPay"));
    const hours = getShiftHours();

    // "2 registered nurses · Acute care" (add an "s" when there is more than 1)
    let role = getValue("profession").toLowerCase();
    if (workers > 1) {
      role = role + "s";
    }
    document.getElementById("summaryRole").textContent =
      workers + " " + role + " · " + getValue("specialty");

    // "6 Oct · 07:00–19:00 WAT"
    const date = new Date(getValue("shiftDate"));
    const dateText = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    document.getElementById("summaryWhen").textContent =
      dateText +
      " · " +
      getValue("startTime") +
      "–" +
      getValue("endTime") +
      " WAT";

    // "Mainland Care Hospital, Ikeja" (only the area, without ", Lagos")
    document.getElementById("summaryPlace").textContent =
      "Mainland Care Hospital, " + getValue("location").split(",")[0];

    // Pay: hours × hourly pay, then × number of workers
    const payEach = hours * pay;
    document.getElementById("summaryEach").textContent =
      naira(payEach) + " per professional";
    document.getElementById("summaryTotal").textContent =
      naira(payEach * workers) + " total shift pay";
    document.getElementById("summaryMath").textContent =
      hours +
      " hours × " +
      naira(pay) +
      "/hour × " +
      workers +
      " workers. Any platform fees are shown before confirmation.";
  }

  // Update the summary every time anything in the form changes
  document.querySelectorAll("input, select").forEach(function (field) {
    field.addEventListener("input", updateSummary);
  });

  // ---------- Urgent checkbox ----------

  const urgentCheckbox = document.getElementById("urgent");
  const urgentBadge = document.getElementById("urgentBadge");

  urgentCheckbox.addEventListener("change", function () {
    if (urgentCheckbox.checked) {
      urgentBadge.textContent = "Urgent shift · Enabled";
      urgentBadge.classList.remove("bg-gray-100", "text-gray-600");
      urgentBadge.classList.add("bg-amber-50", "text-amber-700");
    } else {
      urgentBadge.textContent = "Urgent shift · Disabled";
      urgentBadge.classList.remove("bg-amber-50", "text-amber-700");
      urgentBadge.classList.add("bg-gray-100", "text-gray-600");
    }
  });

  // ---------- Save draft ----------

  // NOTE: Really saving needs a backend. For now we only show a "Draft saved." message.
  document.getElementById("saveDraft").addEventListener("click", function () {
    document.getElementById("draftMessage").classList.remove("hidden");
  });

  // ---------- Validation, then Review shift ----------

  reviewShiftButton.addEventListener("click", function () {
    let isValid = true;

    // 1. These text fields must not be empty
    const requiredFields = [
      "shiftDate",
      "startTime",
      "endTime",
      "experience",
      "responsibilities",
      "credentials",
      "arrival",
    ];

    requiredFields.forEach(function (id) {
      if (getValue(id) === "") {
        showError(id, "This field is required.");
        isValid = false;
      } else {
        clearError(id);
      }
    });

    // 2. Start and end time can't be the same
    if (
      getValue("startTime") !== "" &&
      getValue("startTime") === getValue("endTime")
    ) {
      showError(
        "endTime",
        "The end time must be different from the start time.",
      );
      isValid = false;
    }

    // 3. Shift date can't be in the past
    const today = new Date().toISOString().slice(0, 10); // e.g. "2026-10-03"
    if (getValue("shiftDate") !== "" && getValue("shiftDate") < today) {
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

    // If everything is correct, go to the review page
    if (isValid) {
      window.location.href = "reviewShift.html";
    }
  });
}

// ==================================================
// 3. APPLICANTS (Applicants page)
// ==================================================

const applicantSearch = document.getElementById("applicantSearch");

if (applicantSearch) {
  const applicantCards = document.querySelectorAll(".applicant-card");

  // Search by name or specialty as you type
  applicantSearch.addEventListener("input", function () {
    const searchText = applicantSearch.value.trim().toLowerCase();
    let shownCount = 0;

    applicantCards.forEach(function (card) {
      if (card.textContent.toLowerCase().includes(searchText)) {
        card.classList.remove("hidden");
        shownCount = shownCount + 1;
      } else {
        card.classList.add("hidden");
      }
    });

    // "1 verified applicant" but "2 verified applicants"
    let word = "applicants";
    if (shownCount === 1) {
      word = "applicant";
    }
    document.getElementById("applicantCount").textContent =
      shownCount + " verified " + word + " · Sample applicant data";
  });
}

// Shortlist buttons: clicking switches between "Shortlist" and "Shortlisted ✓"
document.querySelectorAll(".shortlist-button").forEach(function (button) {
  button.addEventListener("click", function () {
    if (button.textContent.trim() === "Shortlist") {
      button.textContent = "Shortlisted ✓";
      button.classList.remove("bg-blue-600", "text-white");
      button.classList.add("bg-green-50", "text-green-700");
    } else {
      button.textContent = "Shortlist";
      button.classList.remove("bg-green-50", "text-green-700");
      button.classList.add("bg-blue-600", "text-white");
    }
  });
});

// ==================================================
// 4. WORKER PROFILE (Worker profile page)
// ==================================================

const shortlistWorker = document.getElementById("shortlistWorker");

if (shortlistWorker) {
  // Shortlist worker: switch between "Shortlist worker" and "Shortlisted ✓"
  shortlistWorker.addEventListener("click", function () {
    if (shortlistWorker.textContent.trim() === "Shortlist worker") {
      shortlistWorker.textContent = "Shortlisted ✓";
    } else {
      shortlistWorker.textContent = "Shortlist worker";
    }
  });

  // Offer shift: show that the offer was sent and stop it being sent twice
  // NOTE: Really sending the offer needs a backend.
  const offerShift = document.getElementById("offerShift");

  offerShift.addEventListener("click", function () {
    offerShift.textContent = "Offer sent ✓";
    offerShift.disabled = true;
    offerShift.classList.remove("hover:bg-blue-700");
    offerShift.classList.add("opacity-60", "cursor-not-allowed");
  });
}

// ==================================================
// LOG OUT (every page)
// ==================================================

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", function () {
    // Ask first, so nobody logs out by accident
    const confirmed = confirm("Are you sure you want to log out?");
    if (!confirmed) {
      return;
    }

    // Forget who was logged in (saved by the login page)
    localStorage.removeItem("userType");

    // Go to the sign-in page written in the button's data-login="..."
    // replace() also stops the Back button from returning to the dashboard
    window.location.replace(logoutButton.getAttribute("data-login"));
  });
}