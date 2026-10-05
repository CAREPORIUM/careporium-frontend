// ====== WORKER DASHBOARD (shared by all 9 pages) ======

// Every page loads this same file, but not every page has every part.
// So before each part, we check that its elements exist on the current page:
// "if (something)" is false when getElementById finds nothing (null).

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
// 2. SEARCH SHIFTS (Find shifts page)
// ==================================================

const shiftSearch = document.getElementById("shiftSearch");

if (shiftSearch) {
  const shiftCards = document.querySelectorAll(".shift-card");
  const noResults = document.getElementById("noResults");
  const resultsText = document.getElementById("resultsText");

  // Every time the user types, show only the cards that contain the search text
  shiftSearch.addEventListener("input", function () {
    // toLowerCase() so "nurse" also finds "Nurse"
    const searchText = shiftSearch.value.trim().toLowerCase();
    let shownCount = 0;

    shiftCards.forEach(function (card) {
      // textContent is all the words inside the card (title, facility, place...)
      const cardText = card.textContent.toLowerCase();

      if (cardText.includes(searchText)) {
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
    resultsText.textContent =
      "Showing " + shownCount + " of 24 sample shifts · All times are WAT";
  });
}

// ==================================================
// 3. FILTER TABS (My applications page)
// ==================================================

const filterTabs = document.querySelectorAll(".filter-tab");

if (filterTabs.length > 0) {
  const applications = document.querySelectorAll(".application-item");

  filterTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      // Which tab was clicked: "all", "review", "accepted" or "not-selected"
      const filter = tab.getAttribute("data-filter");

      // Make every tab look "not picked"...
      filterTabs.forEach(function (otherTab) {
        otherTab.classList.remove("bg-blue-600", "text-white");
        otherTab.classList.add("text-gray-700");
      });
      // ...then make the clicked tab blue
      tab.classList.remove("text-gray-700");
      tab.classList.add("bg-blue-600", "text-white");

      // Show the applications that match the tab, hide the rest
      applications.forEach(function (application) {
        const status = application.getAttribute("data-status");

        if (filter === "all" || filter === status) {
          application.classList.remove("hidden");
        } else {
          application.classList.add("hidden");
        }
      });
    });
  });
}

// ==================================================
// 4. SUBMIT APPLICATION (Review application page)
// ==================================================

const submitApplication = document.getElementById("submitApplication");

if (submitApplication) {
  submitApplication.addEventListener("click", function () {
    const messageInput = document.getElementById("message");
    const messageError = document.getElementById("messageError");
    const message = messageInput.value.trim();

    // The message must be between 10 and 300 characters
    let error = "";

    if (message.length < 10) {
      error =
        "Please write a short message to the facility (at least 10 characters).";
    } else if (message.length > 300) {
      error = "Your message is too long. Please keep it under 300 characters.";
    }

    if (error !== "") {
      // Show the error and make the border red
      messageError.textContent = error;
      messageError.classList.remove("hidden");
      messageInput.classList.remove("border-gray-200");
      messageInput.classList.add("border-red-500");
      return;
    }

    // NOTE: Sending the application needs a backend. For now we go to the "submitted" page.
    window.location.href = "applicationSubmitted.html";
  });
}

// ==================================================
// 5. SEARCH & FILTERS (Search shifts page)
// ==================================================

const applyFilters = document.getElementById("applyFilters");

if (applyFilters) {
  const resultCards = document.querySelectorAll(".result-card");
  const resultSearch = document.getElementById("resultSearch");
  const minPayInput = document.getElementById("minPay");
  const minPayError = document.getElementById("minPayError");

  // Show only the cards that match the search box, shift type and minimum pay
  function filterResults() {
    const searchText = resultSearch.value.trim().toLowerCase();
    const shiftType = document.getElementById("shiftType").value;
    const minPay = Number(minPayInput.value);
    let shownCount = 0;

    resultCards.forEach(function (card) {
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

    // "1 shift matches" but "2 shifts match"
    if (shownCount === 1) {
      document.getElementById("resultCount").textContent =
        "1 shift matches your filters";
    } else {
      document.getElementById("resultCount").textContent =
        shownCount + " shifts match your filters";
    }
  }

  // Apply filters: check the minimum pay first, then filter
  applyFilters.addEventListener("click", function () {
    const minPay = minPayInput.value.trim();

    // Minimum pay must be a whole number of 0 or more
    if (
      minPay === "" ||
      !Number.isInteger(Number(minPay)) ||
      Number(minPay) < 0
    ) {
      minPayError.textContent = "Please enter a whole number, like 3000.";
      minPayError.classList.remove("hidden");
      return;
    }
    minPayError.classList.add("hidden");

    // Update the blue summary line, e.g. "Registered nurse · Acute care · Lagos · Day shift · ₦3,000+/hr"
    // toLocaleString() adds commas: 3000 becomes "3,000"
    const location = document
      .getElementById("filterLocation")
      .value.split(" · ")[0];
    document.getElementById("filterSummary").textContent =
      document.getElementById("profession").value +
      " · " +
      document.getElementById("filterSpecialty").value +
      " · " +
      location +
      " · " +
      document.getElementById("shiftType").value +
      " · ₦" +
      Number(minPay).toLocaleString() +
      "+/hr";

    filterResults();
  });

  // Reset filters: put every dropdown back to its first option and pay back to 3000
  document
    .getElementById("resetFilters")
    .addEventListener("click", function () {
      document.querySelectorAll("select").forEach(function (select) {
        select.selectedIndex = 0;
      });
      minPayInput.value = "3000";
      resultSearch.value = "";
      minPayError.classList.add("hidden");
      document.getElementById("filterSummary").textContent =
        "Registered nurse · Acute care · Lagos · Day shift · ₦3,000+/hr";

      // Show every card again
      resultCards.forEach(function (card) {
        card.classList.remove("hidden");
      });
      document.getElementById("resultCount").textContent =
        "24 shifts match your filters";
    });

  // The search box filters as you type
  resultSearch.addEventListener("input", filterResults);
}

// ==================================================
// 6. SORT REVIEWS (Facility reviews page)
// ==================================================

const sortReviews = document.getElementById("sortReviews");

if (sortReviews) {
  const reviewList = document.getElementById("reviewList");

  sortReviews.addEventListener("change", function () {
    // Turn the review cards into a normal list so we can sort them
    const reviews = Array.from(reviewList.querySelectorAll(".review-card"));

    reviews.sort(function (a, b) {
      if (sortReviews.value === "Highest rated") {
        // Bigger rating first
        return (
          Number(b.getAttribute("data-rating")) -
          Number(a.getAttribute("data-rating"))
        );
      }
      // "Most recent": newer date first. Dates like "2026-09-28" can be compared as text.
      return b
        .getAttribute("data-date")
        .localeCompare(a.getAttribute("data-date"));
    });

    // appendChild moves each card to the end, so they end up in the sorted order
    reviews.forEach(function (review) {
      reviewList.appendChild(review);
    });
  });
}
