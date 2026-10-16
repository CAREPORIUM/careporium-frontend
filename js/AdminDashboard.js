// ====== ADMIN DASHBOARD (shared by all admin workspace pages) ======
// Needs /js/api.js to be loaded first.
//
// Every page loads this same file, but not every page has every part.
// So before each part, we check that its elements exist on the current page.
//
// HOW DATA LOADING WORKS
// In demo mode (USE_DEMO_MODE = true in api.js), the sample rows written in the HTML are used.
// With the real backend, each "load..." function asks the server for the data and
// replaces the sample rows with the real ones.

// 👉 The admin pages that the JS links to. Make these match your real file names exactly.
const PAGES = {
  reviewWorker: "../Admin/ReviewWorker.html",
  reviewFacility: "../Admin/ReviewFacility.html",
  decisions: "../Admin/VerificationDecisions.html",
  disputeDetail: "../Admin/DisputeDetail.html",
};

// ==================================================
// HELPERS (used by several pages)
// ==================================================

// Show a red error message under an input and make its border red
function showError(inputId, message) {
  const errorText = document.getElementById(inputId + "Error");
  errorText.textContent = message;
  errorText.classList.remove("hidden");
  document.getElementById(inputId).classList.add("border-red-500");
}

// Hide the error message and remove the red border
function clearError(inputId) {
  document.getElementById(inputId + "Error").classList.add("hidden");
  document.getElementById(inputId).classList.remove("border-red-500");
}

// Underline the clicked filter link, and remove the underline from the others
function setActiveLink(links, clickedLink) {
  links.forEach(function (link) {
    link.classList.remove("font-semibold", "underline");
  });
  clickedLink.classList.add("font-semibold", "underline");
}

// Show a message (like "No submissions match") only when no rows are visible
function toggleEmptyMessage(rows, messageId) {
  let shownCount = 0;
  rows.forEach(function (row) {
    if (!row.classList.contains("hidden")) {
      shownCount = shownCount + 1;
    }
  });

  if (shownCount === 0) {
    document.getElementById(messageId).classList.remove("hidden");
  } else {
    document.getElementById(messageId).classList.add("hidden");
  }
}

// Turn a date into text like "3 Oct · 10:05"
function formatDateTime(date) {
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  return day + " · " + time;
}

// The class every table cell uses
const CELL = "py-3 pr-5";

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
// 2. OVERVIEW (numbers and chart)
// ==================================================

// The overview page is the only one with the chart
const shiftChart = document.getElementById("shiftChart");

if (shiftChart) {
  // The server should answer with something like:
  // {
  //   healthWorkers: "1,240 total · 1,080 verified",
  //   facilities: "186 total · 164 verified",
  //   ...one value for each data-field="..." on the page...,
  //   completedShifts: [ { day: "Mon", count: 32 }, { day: "Tue", count: 44 }, ... ]
  // }
  async function loadOverview() {
    if (USE_DEMO_MODE) {
      return; // keep the sample numbers in the HTML
    }

    try {
      const data = await Backend.adminOverview();
      // The backend doesn't send disputes, payments or the weekly chart yet: those stay as samples
      showPreviewNote("Part of this page (disputes, payments and the weekly chart)");

      // Put each number into the element with the matching data-field="..."
      fillFields(data);

      // Rebuild the bar chart. The biggest day becomes 100% wide.
      if (data.completedShifts) {
        let biggest = 1;
        data.completedShifts.forEach(function (day) {
          if (day.count > biggest) {
            biggest = day.count;
          }
        });

        let html = "";
        data.completedShifts.forEach(function (day) {
          const width = Math.round((day.count / biggest) * 100);
          html += `
            <div class="flex items-center gap-3 text-xs">
              <span class="w-8 text-gray-700">${escapeHtml(day.day)}</span>
              <div class="flex-1"><div class="h-2 bg-blue-600 rounded" style="width: ${width}%"></div></div>
              <span class="w-6 text-right text-gray-700">${escapeHtml(day.count)}</span>
            </div>`;
        });
        shiftChart.innerHTML = html;
      }
    } catch (error) {
      showGeneralError("Couldn't load the overview: " + error.message);
    }
  }

  loadOverview();
}

// ==================================================
// 3. VERIFICATION QUEUE (load, search, filters and "Oldest first")
// ==================================================

const queueSearch = document.getElementById("queueSearch");

if (queueSearch) {
  const queueBody = document.getElementById("queueBody");
  const links = document.querySelectorAll(".filter-link");
  let typeFilter = "all"; // "all", "worker" or "facility"

  // Get the rows each time, because loadQueue() can replace them
  function getRows() {
    return document.querySelectorAll(".queue-row");
  }

  // Show only the rows that match the search text AND the type filter
  function filterQueue() {
    const searchText = queueSearch.value.trim().toLowerCase();
    const rows = getRows();

    rows.forEach(function (row) {
      const matchesSearch = row.textContent.toLowerCase().includes(searchText);
      const matchesType = typeFilter === "all" || row.getAttribute("data-type") === typeFilter;

      if (matchesSearch && matchesType) {
        row.classList.remove("hidden");
      } else {
        row.classList.add("hidden");
      }
    });

    toggleEmptyMessage(rows, "queueEmpty");
  }

  // Load the submissions from the server.
  // The server should answer with a list like:
  // [ { id: "WK-1048", name: "Amara Okafor", type: "worker", typeLabel: "Worker · RN",
  //     submitted: "2 Oct · 08:20", order: 3, status: "Pending" }, ... ]
  // (order: a number for sorting, smaller = older)
  async function loadQueue() {
    if (USE_DEMO_MODE) {
      return; // keep the sample rows in the HTML
    }

    try {
      // One row per person (the backend lists each document separately; backend.js groups them)
      const submissions = await Backend.adminQueue();

      let html = "";
      submissions.forEach(function (item) {
        // Workers and facilities open different review pages
        let page = PAGES.reviewFacility;
        let action = "Review facility";
        if (item.type === "worker") {
          page = PAGES.reviewWorker;
          action = "Review credentials";
        }

        html += `
          <tr class="queue-row border-t border-gray-100" data-type="${escapeHtml(item.type)}" data-order="${escapeHtml(item.order)}">
            <td class="${CELL}">${escapeHtml(item.name)}</td>
            <td class="${CELL}">${escapeHtml(item.typeLabel)}</td>
            <td class="${CELL}">${escapeHtml(item.submitted)}</td>
            <td class="${CELL}">${escapeHtml(item.status)}</td>
            <td class="${CELL}"><a href="${page}?id=${encodeURIComponent(item.id)}" class="text-blue-600 hover:underline">${action}</a></td>
          </tr>`;
      });

      queueBody.innerHTML = html;
      filterQueue();
    } catch (error) {
      showGeneralError("Couldn't load the queue: " + error.message);
    }
  }

  queueSearch.addEventListener("input", filterQueue);

  links.forEach(function (link) {
    link.addEventListener("click", function () {
      setActiveLink(links, link);
      const filter = link.getAttribute("data-filter");

      if (filter === "oldest") {
        // Sort the rows: smaller data-order = older, so it goes first
        const sortedRows = Array.from(getRows()).sort(function (a, b) {
          return Number(a.getAttribute("data-order")) - Number(b.getAttribute("data-order"));
        });
        // appendChild moves each row to the end, so they end up in the sorted order
        sortedRows.forEach(function (row) {
          queueBody.appendChild(row);
        });
      } else {
        typeFilter = filter;
        filterQueue();
      }
    });
  });

  loadQueue();
}

// ==================================================
// 4. REVIEW PAGES (worker and facility)
// ==================================================

// Document buttons: open the real uploaded file (the links come from the server, see below).
// In demo mode, or before the documents have loaded, they just say which document it is.
let reviewDocuments = [];

function documentForButton(button) {
  const index = Array.from(document.querySelectorAll(".document-button")).indexOf(button);
  const wanted = button.getAttribute("data-key");
  return reviewDocuments.find(function (d) { return d.key === wanted; }) || reviewDocuments[index];
}

document.querySelectorAll(".document-button").forEach(function (button) {
  button.addEventListener("click", function () {
    const doc = documentForButton(button);
    if (doc && doc.url) {
      window.open(doc.url, "_blank", "noopener");
      return;
    }
    document.getElementById("documentPreview").textContent = doc
      ? doc.label + " hasn't been uploaded."
      : "Previewing: " + button.getAttribute("data-document") + ". Check the issuing body, name, number and expiry.";
  });
});

const approveButton = document.getElementById("approveButton");

if (approveButton) {
  const checks = document.querySelectorAll(".review-check");
  const notesInput = document.getElementById("reviewNotes");
  const checksError = document.getElementById("checksError");
  const rejectButton = document.getElementById("rejectButton");

  // The submission being reviewed comes from the address, e.g. reviewWorker.html?id=WK-1048
  const submissionId = getUrlValue("id");
  // A worker or a facility, from the page's name
  const reviewType = window.location.pathname.includes("ReviewFacility") ? "facility" : "worker";

  // List the uploaded documents in the "Document preview" box, as links that open each file
  function showDocuments(documents) {
    reviewDocuments = documents;
    // Label each "Open ..." button with its real document and whether it's there
    document.querySelectorAll(".document-button").forEach(function (button) {
      const doc = documentForButton(button);
      if (!doc) {
        button.classList.add("hidden");
        return;
      }
      button.setAttribute("data-key", doc.key);
      button.textContent = doc.url ? "Open " + doc.label.toLowerCase() : doc.label + " · not uploaded";
      button.disabled = !doc.url;
      button.classList.toggle("opacity-50", !doc.url);
      button.classList.toggle("cursor-not-allowed", !doc.url);
    });
    const preview = document.getElementById("documentPreview");
    if (!preview) {
      return;
    }
    preview.innerHTML = documents.map(function (doc) {
      const status = doc.status === "missing" ? "not uploaded" : doc.status === "pending" ? "waiting for review" : doc.status;
      const link = doc.url
        ? `<a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener" class="text-blue-600 hover:underline">${escapeHtml(doc.label)}</a>`
        : escapeHtml(doc.label);
      return `<span class="block">${link} · ${escapeHtml(status)}${doc.comment ? " · " + escapeHtml(doc.comment) : ""}</span>`;
    }).join("");
  }

  // Load the submission details into the elements with data-field="..."
  async function loadSubmission() {
    if (USE_DEMO_MODE || !submissionId) {
      return; // keep the sample details in the HTML
    }

    try {
      const submission = await Backend.adminSubmission(reviewType, submissionId);
      fillFields(submission.fields);
      showDocuments(submission.documents);
      showVerifiedState(submission.status);
    } catch (error) {
      showGeneralError("Couldn't load this submission: " + error.message);
    }
  }

  // Already verified: nothing left to approve, so lock the buttons and say so
  function showVerifiedState(status) {
    const verified = String(status || "").toLowerCase() === "verified";
    if (!verified) return;
    const who = reviewType === "facility" ? "facility" : "worker";

    approveButton.disabled = true;
    approveButton.textContent = "Verified ✓";
    approveButton.title = "This " + who + " is already verified";
    approveButton.className = "w-full bg-green-50 text-green-700 border border-green-200 text-sm font-semibold text-center py-3 rounded-lg mt-3 cursor-not-allowed";

    rejectButton.disabled = true;
    rejectButton.title = "This " + who + " is already verified";
    rejectButton.classList.add("opacity-50", "cursor-not-allowed");
    rejectButton.classList.remove("hover:bg-blue-50");

    checks.forEach(function (check) {
      check.checked = true;
      check.disabled = true;
    });
    if (notesInput) notesInput.disabled = true;
    checksError.textContent = "This " + who + " has been verified. There's nothing left to review.";
    checksError.className = "text-xs font-medium text-green-700 mt-3";
  }

  loadSubmission();

  // APPROVE: every checkbox must be ticked
  approveButton.addEventListener("click", async function () {
    if (approveButton.disabled) return;
    let allTicked = true;
    checks.forEach(function (check) {
      if (!check.checked) {
        allTicked = false;
      }
    });

    if (!allTicked) {
      checksError.textContent = "Tick every check before approving.";
      checksError.classList.remove("hidden");
      return;
    }
    checksError.classList.add("hidden");

    // Tell the server (only with the real backend)
    if (!USE_DEMO_MODE) {
      setLoading(approveButton, true, "Approving…");
      let result;
      try {
        // Marks every document as verified (the backend reviews one document at a time),
        // then checks the account's status again
        result = await Backend.adminDecide(reviewType, submissionId, "verified");
      } catch (error) {
        showGeneralError("Couldn't approve: " + error.message);
        setLoading(approveButton, false);
        return;
      }
      // Something wasn't approved: say exactly what, and stay on this page
      if (result.failed.length > 0 || result.status !== "verified") {
        const problems = result.failed.map(function (f) { return f.label + ": " + f.message; });
        showGeneralError(
          (result.done.length ? "Approved: " + result.done.join(", ") + ". " : "") +
          "The account isn't verified yet. " +
          (problems.length ? problems.join(" · ") : "The server still reports the status as “" + result.status.replace("_", " ") + "”."),
        );
        setLoading(approveButton, false);
        loadSubmission();
        return;
      }
      localStorage.setItem("decisionDetail", (reviewType === "facility" ? "The facility" : "The worker") +
        " is now verified. They have full access the next time they open their dashboard.");
    }

    // Remember the decision so the decisions page shows the right card
    localStorage.setItem("lastDecision", "approved");
    window.location.href = PAGES.decisions;
  });

  // REJECT: a reason of at least 10 characters is required
  rejectButton.addEventListener("click", async function () {
    const reason = notesInput.value.trim();

    if (reason.length < 10) {
      showError("reviewNotes", "Please write a rejection reason (at least 10 characters).");
      return;
    }
    clearError("reviewNotes");

    // Tell the server (only with the real backend)
    if (!USE_DEMO_MODE) {
      setLoading(rejectButton, true, "Rejecting…");
      try {
        // Rejects every uploaded document that isn't verified yet, with the reason
        const result = await Backend.adminDecide(reviewType, submissionId, "rejected", reason);
        if (result.done.length === 0) {
          showGeneralError("Nothing was rejected. " + (result.failed.map(function (f) { return f.label + ": " + f.message; }).join(" · ") || "There are no documents waiting for review."));
          setLoading(rejectButton, false);
          return;
        }
        localStorage.setItem("decisionDetail", "Rejected: " + result.done.join(", ") + ".");
      } catch (error) {
        showGeneralError("Couldn't reject: " + error.message);
        setLoading(rejectButton, false);
        return;
      }
    }

    // Remember the decision and the reason for the decisions page
    localStorage.setItem("lastDecision", "rejected");
    localStorage.setItem("rejectionReason", reason);
    window.location.href = PAGES.decisions;
  });
}

// ==================================================
// 5. VERIFICATION DECISIONS (show the card for the last decision)
// ==================================================

const approvedCard = document.getElementById("approvedCard");

if (approvedCard) {
  const lastDecision = localStorage.getItem("lastDecision");

  if (lastDecision === "approved") {
    document.getElementById("rejectedCard").classList.add("hidden");
  } else if (lastDecision === "rejected") {
    approvedCard.classList.add("hidden");
    document.getElementById("rejectionReason").textContent =
      "Reason: " + localStorage.getItem("rejectionReason");
  }
  // If nothing was saved (the page was opened directly), both cards stay visible, like the design.

  // What exactly happened (sent by the review page)
  const detail = localStorage.getItem("decisionDetail");
  if (detail) {
    const card = lastDecision === "rejected" ? document.getElementById("rejectedCard") : approvedCard;
    const line = document.createElement("p");
    line.className = "text-xs font-medium text-gray-700 mt-3";
    line.textContent = detail;
    card.insertBefore(line, card.querySelector("a"));
  }

  // Forget the decision, so the next visit starts fresh
  localStorage.removeItem("decisionDetail");
  localStorage.removeItem("lastDecision");
  localStorage.removeItem("rejectionReason");
}

// ==================================================
// 6. MANAGE USERS (load, search, filters, view account, suspend)
// ==================================================

const userSearch = document.getElementById("userSearch");

if (userSearch) {
  const userBody = document.getElementById("userBody");
  const links = document.querySelectorAll(".filter-link");
  const suspendButton = document.getElementById("suspendButton");
  let userFilter = "all";

  // Get the rows each time, because loadUsers() can replace them
  function getRows() {
    return document.querySelectorAll(".user-row");
  }

  // The row whose details are in the "Selected account" card. It starts as the first row.
  let selectedRow = getRows()[0];

  // A row matches a filter if its role, verification or access equals the filter word
  function filterUsers() {
    const searchText = userSearch.value.trim().toLowerCase();
    const rows = getRows();

    rows.forEach(function (row) {
      // Search the visible text and the email (which isn't shown in the table)
      const rowText = (row.textContent + " " + row.getAttribute("data-email")).toLowerCase();
      const matchesSearch = rowText.includes(searchText);
      const matchesFilter =
        userFilter === "all" ||
        row.getAttribute("data-role") === userFilter ||
        row.getAttribute("data-verification") === userFilter ||
        row.getAttribute("data-access") === userFilter;

      if (matchesSearch && matchesFilter) {
        row.classList.remove("hidden");
      } else {
        row.classList.add("hidden");
      }
    });

    toggleEmptyMessage(rows, "userEmpty");
  }

  // Load the accounts from the server.
  // The server should answer with a list like:
  // [ { id: "WK-1048", name: "Amara Okafor", role: "Worker", email: "amara@example.com",
  //     verification: "Verified", access: "Active", details: "32 completed shifts · Last active 2 Oct" }, ... ]
  async function loadUsers() {
    if (USE_DEMO_MODE) {
      return; // keep the sample rows in the HTML
    }

    try {
      // Workers and facilities together (the backend has two lists; backend.js joins them)
      const users = await Backend.adminUsers();

      let html = "";
      users.forEach(function (user) {
        // "View account" goes straight to the review page (documents + verify)
        const userType = user.type || (user.role === "Facility" ? "facility" : "worker");
        const reviewLink = (userType === "facility" ? PAGES.reviewFacility : PAGES.reviewWorker) +
          "?id=" + encodeURIComponent(user.id);
        html += `
          <tr class="user-row border-t border-gray-100 cursor-pointer hover:bg-slate-50"
              data-name="${escapeHtml(user.name)}" data-role="${escapeHtml(user.role)}"
              data-email="${escapeHtml(user.email)}" data-verification="${escapeHtml(user.verification)}"
              data-access="${escapeHtml(user.access)}" data-details="${escapeHtml(user.details)}"
              data-account="${escapeHtml(user.id)}" data-type="${escapeHtml(user.type || "")}">
            <td class="${CELL}">${escapeHtml(user.name)}</td>
            <td class="${CELL}">${escapeHtml(user.role)}</td>
            <td class="${CELL}">${escapeHtml(user.verification)}</td>
            <td class="access-cell ${CELL}">${escapeHtml(user.access)}</td>
            <td class="${CELL}"><a href="${reviewLink}" class="view-account text-blue-600 hover:underline">View account</a></td>
          </tr>`;
      });

      userBody.innerHTML = html;

      // Show the first account in the "Selected account" card
      if (getRows().length > 0) {
        showAccount(getRows()[0]);
      }
      filterUsers();
    } catch (error) {
      showGeneralError("Couldn't load the accounts: " + error.message);
    }
  }

  userSearch.addEventListener("input", filterUsers);

  links.forEach(function (link) {
    link.addEventListener("click", function () {
      setActiveLink(links, link);
      userFilter = link.getAttribute("data-filter");
      filterUsers();
    });
  });

  // Fill the "Selected account" card with one row's details
  function showAccount(row) {
    selectedRow = row;
    document.getElementById("selectedName").textContent = "Selected account · " + row.getAttribute("data-name");
    document.getElementById("selectedInfo").textContent =
      row.getAttribute("data-role") + " · " + row.getAttribute("data-email") + " · " + row.getAttribute("data-verification");
    document.getElementById("selectedDetails").textContent =
      row.getAttribute("data-details") + " · Account " + row.getAttribute("data-account");

    // "View profile" opens the review page, where the admin can see the documents and verify
    const profileLink = document.getElementById("viewProfileLink");
    if (profileLink) {
      const type = row.getAttribute("data-type") || (row.getAttribute("data-role") === "Facility" ? "facility" : "worker");
      profileLink.href = (type === "facility" ? PAGES.reviewFacility : PAGES.reviewWorker) +
        "?id=" + encodeURIComponent(row.getAttribute("data-account"));
    }

    // The button says "Re-enable access" for suspended accounts
    if (row.getAttribute("data-access") === "Suspended") {
      suspendButton.textContent = "Re-enable access";
    } else {
      suspendButton.textContent = "Suspend account";
    }
    clearError("accessReason");
  }

  // "View account" buttons. One listener on the whole table catches every button,
  // even on rows added later by loadUsers().
  // "View account" is a link to the review page (the browser follows it).
  // Clicking anywhere else on a row selects it in the "Selected account" card (for suspending).
  userBody.addEventListener("click", function (event) {
    const row = event.target.closest("tr");
    if (!row) return;
    if (event.target.closest("a.view-account")) {
      if (USE_DEMO_MODE) {
        event.preventDefault(); // demo rows have no real account to open
        showAccount(row);
      }
      return;
    }
    showAccount(row);
  });

  // Change the access shown for the selected row
  function setAccess(access) {
    selectedRow.setAttribute("data-access", access);
    selectedRow.querySelector(".access-cell").textContent = access;
  }

  // Suspend / re-enable the selected account
  suspendButton.addEventListener("click", async function () {
    const reason = document.getElementById("accessReason").value.trim();
    const name = selectedRow.getAttribute("data-name");
    const accountId = selectedRow.getAttribute("data-account");

    // Not on the server yet (SERVER_HAS.adminAccounts)
    if (!USE_DEMO_MODE && usesDemo("adminAccounts")) {
      showError("accessReason", "Suspending and re-enabling accounts isn't available on the server yet.");
      return;
    }

    // ----- RE-ENABLE -----
    if (selectedRow.getAttribute("data-access") === "Suspended") {
      if (!USE_DEMO_MODE) {
        setLoading(suspendButton, true, "Re-enabling…");
        try {
          await apiRequest(ENDPOINTS.reactivateUser(accountId), "POST");
        } catch (error) {
          showError("accessReason", error.message);
          setLoading(suspendButton, false);
          return;
        }
        setLoading(suspendButton, false);
      }

      setAccess("Active");
      suspendButton.textContent = "Suspend account";
      return;
    }

    // ----- SUSPEND: a reason is required -----
    if (reason.length < 5) {
      showError("accessReason", "Please give a reason before suspending this account.");
      return;
    }

    // Ask the admin to confirm (confirm() shows a box with OK and Cancel)
    const confirmed = confirm("Suspend " + name + "?\nReason: " + reason);
    if (!confirmed) {
      return;
    }

    if (!USE_DEMO_MODE) {
      setLoading(suspendButton, true, "Suspending…");
      try {
        await apiRequest(ENDPOINTS.suspendUser(accountId), "POST", { reason: reason });
      } catch (error) {
        showError("accessReason", error.message);
        setLoading(suspendButton, false);
        return;
      }
      setLoading(suspendButton, false);
    }

    setAccess("Suspended");
    suspendButton.textContent = "Re-enable access";
    document.getElementById("accessReason").value = "";
    clearError("accessReason");
  });

  loadUsers();
}

// ==================================================
// 7. DISPUTES LIST (load, search and status filters)
// ==================================================

const disputeSearch = document.getElementById("disputeSearch");

if (disputeSearch) {
  const disputeBody = document.getElementById("disputeBody");
  const links = document.querySelectorAll(".filter-link");
  let statusFilter = "open";

  // The card title for each filter
  const titles = { open: "Open cases", review: "Cases in review", resolved: "Resolved cases" };

  // The status text the server sends → the filter it belongs to
  const statusKeys = { "Open": "open", "In review": "review", "Resolved": "resolved" };

  function getRows() {
    return document.querySelectorAll(".dispute-row");
  }

  function filterDisputes() {
    const searchText = disputeSearch.value.trim().toLowerCase();
    const rows = getRows();

    rows.forEach(function (row) {
      const matchesSearch = row.textContent.toLowerCase().includes(searchText);
      const matchesStatus = row.getAttribute("data-status") === statusFilter;

      if (matchesSearch && matchesStatus) {
        row.classList.remove("hidden");
      } else {
        row.classList.add("hidden");
      }
    });

    document.getElementById("disputeTitle").textContent = titles[statusFilter];
    toggleEmptyMessage(rows, "disputeEmpty");
  }

  // Load the cases from the server.
  // The server should answer with a list like:
  // [ { id: "DP-0128", parties: "Amara / Mainland Care", issue: "Shift completion", status: "Open" }, ... ]
  async function loadDisputes() {
    if (usesDemo("disputes")) {
      showPreviewNote("Disputes");
      return; // keep the sample rows in the HTML
    }

    try {
      const disputes = await Backend.disputes();

      let html = "";
      disputes.forEach(function (item) {
        html += `
          <tr class="dispute-row border-t border-gray-100" data-status="${statusKeys[item.status] || (/resolv|clos/i.test(item.status) ? "resolved" : "open")}">
            <td class="${CELL}">${escapeHtml(String(item.id).slice(-6).toUpperCase())}</td>
            <td class="${CELL}">${escapeHtml(item.parties)}</td>
            <td class="${CELL}">${escapeHtml(item.issue)}</td>
            <td class="${CELL}">${escapeHtml(item.status)}</td>
            <td class="${CELL}"><a href="${PAGES.disputeDetail}?id=${encodeURIComponent(item.id)}" class="text-blue-600 hover:underline">Review case</a></td>
          </tr>`;
      });

      disputeBody.innerHTML = html;
      filterDisputes();
    } catch (error) {
      showGeneralError("Couldn't load the disputes: " + error.message);
    }
  }

  disputeSearch.addEventListener("input", filterDisputes);

  links.forEach(function (link) {
    link.addEventListener("click", function () {
      setActiveLink(links, link);
      statusFilter = link.getAttribute("data-filter");
      filterDisputes();
    });
  });

  // "Open" is picked at the start, so filter once when the page opens
  filterDisputes();
  loadDisputes();
}

// ==================================================
// 8. DISPUTE DETAIL (load, save notes, resolve the case)
// ==================================================

const reviewResolution = document.getElementById("reviewResolution");

if (reviewResolution) {
  const resolveMessage = document.getElementById("resolveMessage");
  const saveNotesButton = document.getElementById("saveNotes");
  const timeline = document.getElementById("timeline");

  // The case comes from the address, e.g. disputeDetail.html?id=DP-0128
  const caseId = getUrlValue("id") || "DP-0128";

  // Add one line to the timeline
  function addTimelineLine(text) {
    const line = document.createElement("p");
    line.textContent = text;
    timeline.appendChild(line);
  }

  // Load the case details.
  // The server should answer with values for each data-field="..." on the page,
  // plus a timeline list, e.g. { ..., timeline: ["08:15 — Worker opened dispute", ...] }
  async function loadDispute() {
    if (usesDemo("disputes")) {
      showPreviewNote("Disputes");
      return; // keep the sample case in the HTML
    }

    try {
      const dispute = await Backend.dispute(caseId);
      fillFields(dispute.fields);

      if (dispute.timeline && dispute.timeline.length) {
        timeline.innerHTML = "<p>Timeline</p>";
        dispute.timeline.forEach(addTimelineLine);
      }
    } catch (error) {
      showGeneralError("Couldn't load this case: " + error.message);
    }
  }

  loadDispute();

  // Show a green message under the buttons
  function showResolveMessage(text) {
    resolveMessage.textContent = text;
    resolveMessage.classList.remove("hidden");
  }

  // ---------- Save notes ----------
  saveNotesButton.addEventListener("click", async function () {
    if (!USE_DEMO_MODE) {
      showGeneralError("Saving review notes isn't available on the server yet (no endpoint in the backend's collection).");
      return;
    }
    if (!usesDemo("disputeResolution")) {
      setLoading(saveNotesButton, true, "Saving…");
      try {
        await apiRequest(ENDPOINTS.disputeNotes(caseId), "POST", {
          decision: document.getElementById("decision").value,
          reason: document.getElementById("resolutionReason").value.trim(),
        });
      } catch (error) {
        showGeneralError("Couldn't save the notes: " + error.message);
        setLoading(saveNotesButton, false);
        return;
      }
      setLoading(saveNotesButton, false);
    }

    showResolveMessage("Review notes saved.");
  });

  // ---------- Resolve the case ----------
  reviewResolution.addEventListener("click", async function () {
    const decision = document.getElementById("decision").value;
    const reason = document.getElementById("resolutionReason").value.trim();
    let isValid = true;

    // A decision must be picked (the first option has an empty value)
    if (decision === "") {
      showError("decision", "Please choose a decision.");
      isValid = false;
    } else {
      clearError("decision");
    }

    // A reason of at least 10 characters is required
    if (reason.length < 10) {
      showError("resolutionReason", "Please explain the outcome (at least 10 characters).");
      isValid = false;
    } else {
      clearError("resolutionReason");
    }

    if (!isValid) {
      return;
    }

    // Ask the admin to confirm before closing the case
    const confirmed = confirm("Close this case?\nDecision: " + decision);
    if (!confirmed) {
      return;
    }

    if (!USE_DEMO_MODE) {
      showGeneralError("Resolving disputes isn't available on the server yet (no endpoint in the backend's collection).");
      return;
    }
    if (!usesDemo("disputeResolution")) {
      setLoading(reviewResolution, true, "Resolving…");
      try {
        await apiRequest(ENDPOINTS.resolveDispute(caseId), "POST", { decision: decision, reason: reason });
      } catch (error) {
        showGeneralError("Couldn't resolve the case: " + error.message);
        setLoading(reviewResolution, false);
        return;
      }
    }

    // Mark the case as resolved
    document.getElementById("caseStatus").textContent = "Resolved";
    showResolveMessage("Case resolved: " + decision + ". Both parties will be notified.");

    // Add a line to the timeline with the current time, e.g. "10:05"
    const now = new Date();
    const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    addTimelineLine(time + " — Case resolved by platform admin");

    // Stop the case being resolved twice
    reviewResolution.disabled = true;
    reviewResolution.classList.add("opacity-50", "cursor-not-allowed");
  });
}

// ==================================================
// 9. ACTIVITY & REPORTS (load, event filter, export)
// ==================================================

const eventType = document.getElementById("eventType");

if (eventType) {
  const activityBody = document.getElementById("activityBody");
  const dateRange = document.getElementById("dateRange");

  function getRows() {
    return document.querySelectorAll(".activity-row");
  }

  // DEMO: hide the rows that aren't the chosen type
  function filterActivity() {
    getRows().forEach(function (row) {
      if (eventType.value === "All activity" || row.getAttribute("data-category") === eventType.value) {
        row.classList.remove("hidden");
      } else {
        row.classList.add("hidden");
      }
    });
  }

  // REAL: ask the server for the chosen date range and type.
  // The server should answer with a list like:
  // [ { time: "09:40", event: "Worker approved", actor: "Platform admin", result: "Success",
  //     reference: "WK-1048", category: "Verifications" }, ... ]
  async function loadActivity() {
    // encodeURIComponent makes the values safe to put in an address (spaces become %20)
    const query = "?range=" + encodeURIComponent(dateRange.value) + "&type=" + encodeURIComponent(eventType.value);

    try {
      const events = await apiRequest(ENDPOINTS.activity + query);

      let html = "";
      events.forEach(function (item) {
        html += `
          <tr class="activity-row border-t border-gray-100" data-category="${escapeHtml(item.category)}">
            <td class="${CELL}">${escapeHtml(item.time)}</td>
            <td class="${CELL}">${escapeHtml(item.event)}</td>
            <td class="${CELL}">${escapeHtml(item.actor)}</td>
            <td class="${CELL}">${escapeHtml(item.result)}</td>
            <td class="${CELL}"><a href="#" class="text-blue-600 hover:underline">${escapeHtml(item.reference)}</a></td>
          </tr>`;
      });

      activityBody.innerHTML = html;
    } catch (error) {
      showGeneralError("Couldn't load the activity: " + error.message);
    }
  }

  // When a filter changes: filter the sample rows (demo), or ask the server again (real)
  function onFilterChange() {
    if (usesDemo("activity")) {
      filterActivity();
    } else {
      loadActivity();
    }
  }

  eventType.addEventListener("change", onFilterChange);
  dateRange.addEventListener("change", onFilterChange);

  // Load once when the page opens (real backend only, once it has the activity log)
  if (!usesDemo("activity")) {
    loadActivity();
  } else {
    showPreviewNote("The activity log");
  }

  // Export report: download the visible rows as a CSV file (opens in Excel)
  document.getElementById("exportReport").addEventListener("click", function () {
    // The first line holds the column names
    let csv = "Time,Event,Account / actor,Result,Reference\n";

    getRows().forEach(function (row) {
      if (!row.classList.contains("hidden")) {
        // Take the text of each cell and join them with commas
        const cells = Array.from(row.querySelectorAll("td")).map(function (cell) {
          return cell.textContent.trim();
        });
        csv = csv + cells.join(",") + "\n";
      }
    });

    // Turn the text into a file and click a hidden download link
    const file = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = "careporium-activity-report.csv";
    link.click();
  });
}

// ==================================================
// 10. MANAGE ADMINS (load, invite, cancel invitation, deactivate)
// ==================================================

const sendInvite = document.getElementById("sendInvite");

if (sendInvite) {
  const inviteBody = document.getElementById("inviteBody");
  const adminBody = document.getElementById("adminBody");
  const roleSelect = document.getElementById("inviteRole");

  // ---------- Role description ----------

  // What each role is allowed to do
  const roleDescriptions = {
    "Full admin": "Full admin: everything, including inviting admins and suspending accounts.",
    "Verification reviewer": "Verification reviewer: can review and decide worker and facility verifications only.",
    "Dispute support": "Dispute support: can review and resolve disputes only.",
  };

  roleSelect.addEventListener("change", function () {
    document.getElementById("roleDescription").textContent = roleDescriptions[roleSelect.value];
  });

  // ---------- Helpers ----------

  // Check if an email is already in a table (rows keep their email in data-email)
  function emailExists(rowClass, email) {
    let found = false;
    document.querySelectorAll(rowClass).forEach(function (row) {
      if (row.getAttribute("data-email") === email) {
        found = true;
      }
    });
    return found;
  }

  // Show "No pending invitations" when the table is empty
  function updateInviteEmpty() {
    if (inviteBody.querySelectorAll(".invite-row").length === 0) {
      document.getElementById("inviteEmpty").classList.remove("hidden");
    } else {
      document.getElementById("inviteEmpty").classList.add("hidden");
    }
  }

  // Build one row for the "Pending invitations" table.
  // invitation = { id, email, role, sentAt, expiresAt } (sentAt / expiresAt are text like "3 Oct · 10:05")
  function buildInviteRow(invitation) {
    const row = document.createElement("tr");
    row.className = "invite-row border-t border-gray-100";
    row.setAttribute("data-email", invitation.email);
    row.setAttribute("data-id", invitation.id || "");

    // textContent (not innerHTML) puts the text in as plain text, which is safer
    [invitation.email, invitation.role, invitation.sentAt, invitation.expiresAt].forEach(function (text) {
      const cell = document.createElement("td");
      cell.className = CELL;
      cell.textContent = text;
      row.appendChild(cell);
    });

    const actionCell = document.createElement("td");
    actionCell.className = CELL + " space-x-3";

    // Demo only: in real life the link arrives by email, so there's no link in the table
    if (usesDemo("adminTeam")) {
      const link = document.createElement("a");
      link.href = "../Admin/acceptInvite.html?email=" + encodeURIComponent(invitation.email) + "&role=" + encodeURIComponent(invitation.role);
      link.className = "text-blue-600 hover:underline";
      link.textContent = "Open link (demo)";
      actionCell.appendChild(link);
    }

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "cancel-invite text-red-600 hover:underline";
    cancel.textContent = "Cancel";
    actionCell.appendChild(cancel);

    row.appendChild(actionCell);
    return row;
  }

  // Build one row for the "Admin team" table.
  // admin = { id, name, email, role, status, isYou }
  function buildAdminRow(admin) {
    let action = '<td class="py-3 pr-5 text-gray-500">—</td>'; // you can't deactivate yourself
    if (!admin.isYou) {
      const label = admin.status === "Active" ? "Deactivate" : "Reactivate";
      action = `<td class="${CELL}"><button type="button" class="deactivate-button text-blue-600 hover:underline">${label}</button></td>`;
    }

    return `
      <tr class="admin-row border-t border-gray-100" data-email="${escapeHtml(admin.email)}" data-id="${escapeHtml(admin.id)}">
        <td class="${CELL}">${escapeHtml(admin.name)}${admin.isYou ? " (you)" : ""}</td>
        <td class="${CELL}">${escapeHtml(admin.email)}</td>
        <td class="${CELL}">${escapeHtml(admin.role)}</td>
        <td class="status-cell ${CELL}">${escapeHtml(admin.status)}</td>
        ${action}
      </tr>`;
  }

  // ---------- Load the admins and invitations ----------

  // The server should answer with: { admins: [...], invitations: [...] }
  async function loadAdmins() {
    if (usesDemo("adminTeam")) {
      showPreviewNote("Managing the admin team");
      return; // keep the sample rows in the HTML
    }

    try {
      const data = await apiRequest(ENDPOINTS.admins);

      let html = "";
      data.admins.forEach(function (admin) {
        html += buildAdminRow(admin);
      });
      adminBody.innerHTML = html;

      inviteBody.innerHTML = "";
      data.invitations.forEach(function (invitation) {
        inviteBody.appendChild(buildInviteRow(invitation));
      });
      updateInviteEmpty();
    } catch (error) {
      showGeneralError("Couldn't load the admin team: " + error.message);
    }
  }

  loadAdmins();

  // ---------- Send invitation ----------

  sendInvite.addEventListener("click", async function () {
    const email = document.getElementById("inviteEmail").value.trim().toLowerCase();
    const role = roleSelect.value;

    // 1. Must look like an email and end with @careporium.com
    if (!/^[^\s@]+@careporium\.com$/.test(email)) {
      showError("inviteEmail", "Enter a @careporium.com work email, like name@careporium.com.");
      return;
    }

    // 2. Must not already be an admin
    if (emailExists(".admin-row", email)) {
      showError("inviteEmail", "This person is already an admin.");
      return;
    }

    // 3. Must not already have a pending invitation
    if (emailExists(".invite-row", email)) {
      showError("inviteEmail", "An invitation is already waiting for this email.");
      return;
    }

    clearError("inviteEmail");

    let invitation;

    if (usesDemo("adminTeam")) {
      // DEMO: make the invitation here (the link lasts 48 hours)
      const sent = new Date();
      const expires = new Date(sent.getTime() + 48 * 60 * 60 * 1000); // 48 hours in milliseconds
      invitation = {
        id: "",
        email: email,
        role: role,
        sentAt: formatDateTime(sent),
        expiresAt: formatDateTime(expires),
      };
    } else {
      // REAL: the server creates the invitation, emails the link and sends back
      // { id, email, role, sentAt, expiresAt }
      setLoading(sendInvite, true, "Sending…");
      try {
        invitation = await apiRequest(ENDPOINTS.invitations, "POST", { email: email, role: role });
      } catch (error) {
        showError("inviteEmail", error.message);
        setLoading(sendInvite, false);
        return;
      }
      setLoading(sendInvite, false);
    }

    // Put the new row at the top of the table
    inviteBody.prepend(buildInviteRow(invitation));
    updateInviteEmpty();

    const message = document.getElementById("inviteMessage");
    message.textContent = "Invitation sent to " + email + " as " + role + ".";
    message.classList.remove("hidden");
    document.getElementById("inviteEmail").value = "";
  });

  // ---------- Cancel invitation ----------

  // One listener on the whole table catches clicks on any Cancel button,
  // even on rows added later.
  inviteBody.addEventListener("click", async function (event) {
    if (!event.target.classList.contains("cancel-invite")) {
      return;
    }

    const row = event.target.closest("tr");
    const confirmed = confirm("Cancel the invitation for " + row.getAttribute("data-email") + "?");
    if (!confirmed) {
      return;
    }

    if (!usesDemo("adminTeam")) {
      try {
        await apiRequest(ENDPOINTS.cancelInvitation(row.getAttribute("data-id")), "DELETE");
      } catch (error) {
        showGeneralError("Couldn't cancel the invitation: " + error.message);
        return;
      }
    }

    row.remove();
    updateInviteEmpty();
  });

  // ---------- Deactivate / reactivate an admin ----------

  // Also one listener on the whole table, because loadAdmins() can replace the rows
  adminBody.addEventListener("click", async function (event) {
    if (!event.target.classList.contains("deactivate-button")) {
      return;
    }

    const button = event.target;
    const row = button.closest("tr");
    const statusCell = row.querySelector(".status-cell");
    const adminId = row.getAttribute("data-id");
    const isActive = statusCell.textContent.trim() === "Active";

    if (isActive) {
      const confirmed = confirm("Deactivate " + row.getAttribute("data-email") + "? They will no longer be able to sign in.");
      if (!confirmed) {
        return;
      }
    }

    if (!usesDemo("adminTeam")) {
      try {
        if (isActive) {
          await apiRequest(ENDPOINTS.deactivateAdmin(adminId), "POST");
        } else {
          await apiRequest(ENDPOINTS.reactivateAdmin(adminId), "POST");
        }
      } catch (error) {
        showGeneralError("Couldn't change this admin: " + error.message);
        return;
      }
    }

    if (isActive) {
      statusCell.textContent = "Deactivated";
      button.textContent = "Reactivate";
    } else {
      statusCell.textContent = "Active";
      button.textContent = "Deactivate";
    }
  });
}

// (The log out button is handled in api.js, shared by every page.)