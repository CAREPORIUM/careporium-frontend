// ====== FACILITY DASHBOARD (shared by all facility pages) ======
// Needs /js/api.js to be loaded first.
//
// Every page loads this same file, but not every page has every part.
// So before each part, we check that its elements exist on the current page.

// The facility pages that the JS links to. Make these match your real file names exactly.
const PAGES = {
  reviewShift: "/FacilityHiringSection/ReviewShift.html",
  applicants: "/FacilityHiringSection/Applicants.html",
  workerProfile: "/FacilityHiringSection/WorkerProfile.html",
};

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

  // Collect every field of the form into one object, ready to send to the server
  function getShiftDetails(status) {
    return {
      profession: getValue("profession"),
      specialty: getValue("specialty"),
      shiftDate: getValue("shiftDate"),
      shiftType: getValue("shiftType"),
      startTime: getValue("startTime"),
      endTime: getValue("endTime"),
      workersNeeded: Number(getValue("workersNeeded")),
      experience: getValue("experience"),
      location: getValue("location"),
      hourlyPay: Number(getValue("hourlyPay")),
      responsibilities: getValue("responsibilities"),
      credentials: getValue("credentials"),
      arrival: getValue("arrival"),
      urgent: document.getElementById("urgent").checked,
      status: status, // "draft" or "published"
    };
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

  const saveDraftButton = document.getElementById("saveDraft");
  const draftMessage = document.getElementById("draftMessage");

  saveDraftButton.addEventListener("click", async function () {
    if (!USE_DEMO_MODE) {
      setLoading(saveDraftButton, true, "Saving…");
      try {
        await apiRequest(
          ENDPOINTS.createShift,
          "POST",
          getShiftDetails("draft"),
        );
      } catch (error) {
        showGeneralError("Couldn't save the draft: " + error.message);
        setLoading(saveDraftButton, false);
        return;
      }
      setLoading(saveDraftButton, false);
    }

    draftMessage.classList.remove("hidden");
  });

  // ---------- Validation, then Review shift ----------

  reviewShiftButton.addEventListener("click", async function () {
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

    if (!isValid) {
      return;
    }

    // DEMO: go straight to the review page
    if (USE_DEMO_MODE) {
      window.location.href = PAGES.reviewShift;
      return;
    }

    // REAL: save the shift as a draft first. The server answers with { id: "SH-0824", ... }.
    // The review page then shows that shift, and "Publish" makes it live.
    setLoading(reviewShiftButton, true, "Saving…");
    try {
      const shift = await apiRequest(
        ENDPOINTS.createShift,
        "POST",
        getShiftDetails("draft"),
      );
      window.location.href =
        PAGES.reviewShift + "?id=" + encodeURIComponent(shift.id);
    } catch (error) {
      showGeneralError("Couldn't save the shift: " + error.message);
      setLoading(reviewShiftButton, false);
    }
  });
}

// ==================================================
// 3. REVIEW YOUR URGENT SHIFT (Review shift page)
// ==================================================

// The "Publish urgent shift" button needs id="publishShift" in the HTML
const publishShiftButton = document.getElementById("publishShift");

if (publishShiftButton) {
  // The shift comes from the address, e.g. reviewShift.html?id=SH-0824
  const shiftId = getUrlValue("id");

  // Show the shift's details in the elements with data-field="..."
  async function loadShift() {
    if (USE_DEMO_MODE || !shiftId) {
      return; // keep the sample shift in the HTML
    }

    try {
      const shift = await apiRequest(ENDPOINTS.shift(shiftId));
      fillFields(shift);
    } catch (error) {
      showGeneralError("Couldn't load this shift: " + error.message);
    }
  }

  loadShift();

  publishShiftButton.addEventListener("click", async function () {
    if (!USE_DEMO_MODE) {
      setLoading(publishShiftButton, true, "Publishing…");
      try {
        await apiRequest(ENDPOINTS.publishShift(shiftId), "POST");
      } catch (error) {
        showGeneralError("Couldn't publish the shift: " + error.message);
        setLoading(publishShiftButton, false);
        return;
      }
    }

    // After publishing, go to the applicants list for this shift
    let page = PAGES.applicants;
    if (shiftId) {
      page = page + "?shift=" + encodeURIComponent(shiftId);
    }
    window.location.href = page;
  });
}

// ==================================================
// 4. APPLICANTS (Applicants page)
// ==================================================

const applicantSearch = document.getElementById("applicantSearch");

if (applicantSearch) {
  const applicantList = document.getElementById("applicantList");

  // The shift comes from the address, e.g. applicants.html?shift=SH-0824
  const shiftId = getUrlValue("shift");

  function getCards() {
    return document.querySelectorAll(".applicant-card");
  }

  // Update "3 verified applicants" ("1 verified applicant" for just one)
  function updateCount(count) {
    let word = "applicants";
    if (count === 1) {
      word = "applicant";
    }
    let text = count + " verified " + word;
    if (USE_DEMO_MODE) {
      text = text + " · Sample applicant data";
    }
    document.getElementById("applicantCount").textContent = text;
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

  // Load the applicants from the server.
  // The server should answer with a list like:
  // [ { applicationId: "AP-201", workerId: "WK-1048", name: "Amara Okafor",
  //     details: "Registered nurse · Acute care · 5 years",
  //     stats: "★ 4.9 (24 reviews) · 32 completed shifts · 98% attendance", shortlisted: false }, ... ]
  // The applicant cards need a wrapper with id="applicantList" in the HTML.
  async function loadApplicants() {
    if (USE_DEMO_MODE || !shiftId || !applicantList) {
      return; // keep the sample applicants in the HTML
    }

    try {
      const applicants = await apiRequest(ENDPOINTS.applicants(shiftId));

      let html = "";
      applicants.forEach(function (person) {
        // Shortlisted applicants get a green button
        let buttonText = "Shortlist";
        let buttonColor = "bg-blue-600 text-white";
        if (person.shortlisted) {
          buttonText = "Shortlisted ✓";
          buttonColor = "bg-green-50 text-green-700";
        }

        html += `
          <div class="applicant-card bg-white border border-gray-200 rounded-2xl p-6" data-application="${escapeHtml(person.applicationId)}">
            <h2 class="text-base font-semibold">${escapeHtml(person.name)}</h2>
            <div class="mt-3"><span class="inline-block bg-green-50 text-green-700 text-xs font-semibold uppercase px-3 py-1 rounded">Licence verified · Active</span></div>
            <p class="text-xs text-gray-700 mt-3">${escapeHtml(person.details)}</p>
            <p class="text-xs text-gray-700 mt-1">${escapeHtml(person.stats)}</p>
            <div class="flex flex-wrap gap-3 mt-5">
              <a href="${PAGES.workerProfile}?worker=${encodeURIComponent(person.workerId)}&shift=${encodeURIComponent(shiftId)}" class="border border-blue-600 text-blue-600 text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-50 px-8">View worker profile</a>
              <button type="button" class="shortlist-button ${buttonColor} text-sm font-medium text-center py-3 rounded-lg px-8">${buttonText}</button>
            </div>
          </div>`;
      });

      applicantList.innerHTML = html;
      updateCount(applicants.length);
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
  if (!USE_DEMO_MODE) {
    const applicationId = button
      .closest(".applicant-card")
      .getAttribute("data-application");
    try {
      await apiRequest(
        ENDPOINTS.shortlist(applicationId),
        isShortlisted ? "DELETE" : "POST",
      );
    } catch (error) {
      showGeneralError("Couldn't update the shortlist: " + error.message);
      return;
    }
  }

  if (!isShortlisted) {
    button.textContent = "Shortlisted ✓";
    button.classList.remove("bg-blue-600", "text-white");
    button.classList.add("bg-green-50", "text-green-700");
  } else {
    button.textContent = "Shortlist";
    button.classList.remove("bg-green-50", "text-green-700");
    button.classList.add("bg-blue-600", "text-white");
  }
});

// ==================================================
// 5. WORKER PROFILE (Worker profile page)
// ==================================================

const shortlistWorker = document.getElementById("shortlistWorker");

if (shortlistWorker) {
  const offerShift = document.getElementById("offerShift");

  // The worker and shift come from the address, e.g. workerProfile.html?worker=WK-1048&shift=SH-0824
  const workerId = getUrlValue("worker");
  const shiftId = getUrlValue("shift");

  // Show the worker's details in the elements with data-field="..."
  async function loadWorker() {
    if (USE_DEMO_MODE || !workerId) {
      return; // keep the sample profile in the HTML
    }

    try {
      const worker = await apiRequest(ENDPOINTS.workerProfile(workerId));
      fillFields(worker);
    } catch (error) {
      showGeneralError("Couldn't load this profile: " + error.message);
    }
  }

  loadWorker();

  // Shortlist worker: switch between "Shortlist worker" and "Shortlisted ✓"
  // (on this page it's only a reminder; the real shortlist is on the Applicants page)
  shortlistWorker.addEventListener("click", function () {
    if (shortlistWorker.textContent.trim() === "Shortlist worker") {
      shortlistWorker.textContent = "Shortlisted ✓";
    } else {
      shortlistWorker.textContent = "Shortlist worker";
    }
  });

  // Offer shift: send the offer, then stop it being sent twice
  offerShift.addEventListener("click", async function () {
    if (!USE_DEMO_MODE) {
      setLoading(offerShift, true, "Sending offer…");
      try {
        await apiRequest(ENDPOINTS.offerShift(shiftId), "POST", {
          workerId: workerId,
        });
      } catch (error) {
        showGeneralError("Couldn't send the offer: " + error.message);
        setLoading(offerShift, false);
        return;
      }
    }

    offerShift.textContent = "Offer sent ✓";
    offerShift.disabled = true;
    offerShift.classList.remove("hover:bg-blue-700");
    offerShift.classList.add("opacity-60", "cursor-not-allowed");
  });
}

// (The log out button is handled in api.js, shared by every page.)
