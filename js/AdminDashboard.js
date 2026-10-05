// ====== ADMIN DASHBOARD (shared by all admin workspace pages) ======

// Every page loads this same file, but not every page has every part.
// So before each part, we check that its elements exist on the current page.

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
// 2. VERIFICATION QUEUE (search, filters and "Oldest first")
// ==================================================

const queueSearch = document.getElementById("queueSearch");

if (queueSearch) {
  const queueBody = document.getElementById("queueBody");
  const rows = document.querySelectorAll(".queue-row");
  const links = document.querySelectorAll(".filter-link");
  let typeFilter = "all"; // "all", "worker" or "facility"

  // Show only the rows that match the search text AND the type filter
  function filterQueue() {
    const searchText = queueSearch.value.trim().toLowerCase();

    rows.forEach(function (row) {
      const matchesSearch = row.textContent.toLowerCase().includes(searchText);
      const matchesType =
        typeFilter === "all" || row.getAttribute("data-type") === typeFilter;

      if (matchesSearch && matchesType) {
        row.classList.remove("hidden");
      } else {
        row.classList.add("hidden");
      }
    });

    toggleEmptyMessage(rows, "queueEmpty");
  }

  queueSearch.addEventListener("input", filterQueue);

  links.forEach(function (link) {
    link.addEventListener("click", function () {
      setActiveLink(links, link);
      const filter = link.getAttribute("data-filter");

      if (filter === "oldest") {
        // Sort the rows: smaller data-order = older, so it goes first
        const sortedRows = Array.from(rows).sort(function (a, b) {
          return (
            Number(a.getAttribute("data-order")) -
            Number(b.getAttribute("data-order"))
          );
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
}

// ==================================================
// 3. REVIEW PAGES (worker and facility)
// ==================================================

// Document buttons: show which document is being previewed
document.querySelectorAll(".document-button").forEach(function (button) {
  button.addEventListener("click", function () {
    // NOTE: Opening the real uploaded file needs a backend.
    document.getElementById("documentPreview").textContent =
      "Previewing: " +
      button.getAttribute("data-document") +
      ". Check the issuing body, name, number and expiry.";
  });
});

const approveButton = document.getElementById("approveButton");

if (approveButton) {
  const checks = document.querySelectorAll(".review-check");
  const notesInput = document.getElementById("reviewNotes");
  const checksError = document.getElementById("checksError");

  // APPROVE: every checkbox must be ticked
  approveButton.addEventListener("click", function () {
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

    // Remember the decision so the decisions page shows the right card
    localStorage.setItem("lastDecision", "approved");
    window.location.href = "verificationDecisions.html";
  });

  // REJECT: a reason of at least 10 characters is required
  document
    .getElementById("rejectButton")
    .addEventListener("click", function () {
      const reason = notesInput.value.trim();

      if (reason.length < 10) {
        showError(
          "reviewNotes",
          "Please write a rejection reason (at least 10 characters).",
        );
        return;
      }

      // Remember the decision and the reason for the decisions page
      localStorage.setItem("lastDecision", "rejected");
      localStorage.setItem("rejectionReason", reason);
      window.location.href = "verificationDecisions.html";
    });
}

// ==================================================
// 4. VERIFICATION DECISIONS (show the card for the last decision)
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

  // Forget the decision, so the next visit starts fresh
  localStorage.removeItem("lastDecision");
  localStorage.removeItem("rejectionReason");
}

// ==================================================
// 5. MANAGE USERS (search, filters, view account, suspend)
// ==================================================

const userSearch = document.getElementById("userSearch");

if (userSearch) {
  const rows = document.querySelectorAll(".user-row");
  const links = document.querySelectorAll(".filter-link");
  const suspendButton = document.getElementById("suspendButton");
  let userFilter = "all";

  // The row whose details are in the "Selected account" card. It starts as the first row.
  let selectedRow = rows[0];

  // A row matches a filter if its role, verification or access equals the filter word
  function filterUsers() {
    const searchText = userSearch.value.trim().toLowerCase();

    rows.forEach(function (row) {
      // Search the visible text and the email (which isn't shown in the table)
      const rowText = (
        row.textContent +
        " " +
        row.getAttribute("data-email")
      ).toLowerCase();
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
    document.getElementById("selectedName").textContent =
      "Selected account · " + row.getAttribute("data-name");
    document.getElementById("selectedInfo").textContent =
      row.getAttribute("data-role") +
      " · " +
      row.getAttribute("data-email") +
      " · " +
      row.getAttribute("data-verification");
    document.getElementById("selectedDetails").textContent =
      row.getAttribute("data-details") +
      " · Account " +
      row.getAttribute("data-account");

    // The button says "Re-enable access" for suspended accounts
    if (row.getAttribute("data-access") === "Suspended") {
      suspendButton.textContent = "Re-enable access";
    } else {
      suspendButton.textContent = "Suspend account";
    }
    clearError("accessReason");
  }

  // "View account" buttons
  document.querySelectorAll(".view-account").forEach(function (button) {
    button.addEventListener("click", function () {
      // closest("tr") finds the table row the button is in
      showAccount(button.closest("tr"));
    });
  });

  // Suspend / re-enable the selected account
  suspendButton.addEventListener("click", function () {
    const reason = document.getElementById("accessReason").value.trim();
    const name = selectedRow.getAttribute("data-name");

    if (selectedRow.getAttribute("data-access") === "Suspended") {
      // RE-ENABLE: set access back to Active
      selectedRow.setAttribute("data-access", "Active");
      selectedRow.querySelector(".access-cell").textContent = "Active";
      suspendButton.textContent = "Suspend account";
      return;
    }

    // SUSPEND: a reason is required
    if (reason.length < 5) {
      showError(
        "accessReason",
        "Please give a reason before suspending this account.",
      );
      return;
    }

    // Ask the admin to confirm (confirm() shows a box with OK and Cancel)
    const confirmed = confirm("Suspend " + name + "?\nReason: " + reason);
    if (!confirmed) {
      return;
    }

    // NOTE: Really disabling the account needs a backend.
    selectedRow.setAttribute("data-access", "Suspended");
    selectedRow.querySelector(".access-cell").textContent = "Suspended";
    suspendButton.textContent = "Re-enable access";
    document.getElementById("accessReason").value = "";
    clearError("accessReason");
  });
}

// ==================================================
// 6. DISPUTES LIST (search and status filters)
// ==================================================

const disputeSearch = document.getElementById("disputeSearch");

if (disputeSearch) {
  const rows = document.querySelectorAll(".dispute-row");
  const links = document.querySelectorAll(".filter-link");
  let statusFilter = "open";

  // The card title for each filter
  const titles = {
    open: "Open cases",
    review: "Cases in review",
    resolved: "Resolved cases",
  };

  function filterDisputes() {
    const searchText = disputeSearch.value.trim().toLowerCase();

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
}

// ==================================================
// 7. DISPUTE DETAIL (save notes, resolve the case)
// ==================================================

const reviewResolution = document.getElementById("reviewResolution");

if (reviewResolution) {
  const resolveMessage = document.getElementById("resolveMessage");

  // Save notes: show a message.
  // NOTE: Really saving needs a backend.
  document.getElementById("saveNotes").addEventListener("click", function () {
    resolveMessage.textContent = "Review notes saved.";
    resolveMessage.classList.remove("hidden");
  });

  reviewResolution.addEventListener("click", function () {
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
      showError(
        "resolutionReason",
        "Please explain the outcome (at least 10 characters).",
      );
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

    // Mark the case as resolved
    document.getElementById("caseStatus").textContent = "Resolved";
    resolveMessage.textContent =
      "Case resolved: " + decision + ". Both parties will be notified.";
    resolveMessage.classList.remove("hidden");

    // Add a line to the timeline with the current time, e.g. "10:05"
    const now = new Date();
    const time =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");
    const newLine = document.createElement("p");
    newLine.textContent = time + " — Case resolved by platform admin";
    document.getElementById("timeline").appendChild(newLine);

    // Stop the case being resolved twice
    reviewResolution.disabled = true;
    reviewResolution.classList.add("opacity-50", "cursor-not-allowed");
  });
}

// ==================================================
// 8. ACTIVITY & REPORTS (event filter, export)
// ==================================================

const eventType = document.getElementById("eventType");

if (eventType) {
  const rows = document.querySelectorAll(".activity-row");

  // Show only the rows of the chosen type
  eventType.addEventListener("change", function () {
    rows.forEach(function (row) {
      if (
        eventType.value === "All activity" ||
        row.getAttribute("data-category") === eventType.value
      ) {
        row.classList.remove("hidden");
      } else {
        row.classList.add("hidden");
      }
    });
  });

  // Export report: download the visible rows as a CSV file (opens in Excel)
  document
    .getElementById("exportReport")
    .addEventListener("click", function () {
      // The first line holds the column names
      let csv = "Time,Event,Account / actor,Result,Reference\n";

      rows.forEach(function (row) {
        if (!row.classList.contains("hidden")) {
          // Take the text of each cell and join them with commas
          const cells = Array.from(row.querySelectorAll("td")).map(
            function (cell) {
              return cell.textContent.trim();
            },
          );
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
// 9. MANAGE ADMINS (invite, cancel invitation, deactivate)
// ==================================================

const sendInvite = document.getElementById("sendInvite");

if (sendInvite) {
  const inviteBody = document.getElementById("inviteBody");
  const roleSelect = document.getElementById("inviteRole");

  // ---------- Role description ----------

  // What each role is allowed to do
  const roleDescriptions = {
    "Full admin":
      "Full admin: everything, including inviting admins and suspending accounts.",
    "Verification reviewer":
      "Verification reviewer: can review and decide worker and facility verifications only.",
    "Dispute support": "Dispute support: can review and resolve disputes only.",
  };

  roleSelect.addEventListener("change", function () {
    document.getElementById("roleDescription").textContent =
      roleDescriptions[roleSelect.value];
  });

  // ---------- Helpers ----------

  // Turn a date into text like "3 Oct · 10:05"
  function formatDateTime(date) {
    const day = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    const time =
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0");
    return day + " · " + time;
  }

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

  // ---------- Send invitation ----------

  sendInvite.addEventListener("click", function () {
    const email = document
      .getElementById("inviteEmail")
      .value.trim()
      .toLowerCase();
    const role = roleSelect.value;

    // 1. Must look like an email and end with @careporium.com
    if (!/^[^\s@]+@careporium\.com$/.test(email)) {
      showError(
        "inviteEmail",
        "Enter a @careporium.com work email, like name@careporium.com.",
      );
      return;
    }

    // 2. Must not already be an admin
    if (emailExists(".admin-row", email)) {
      showError("inviteEmail", "This person is already an admin.");
      return;
    }

    // 3. Must not already have a pending invitation
    if (emailExists(".invite-row", email)) {
      showError(
        "inviteEmail",
        "An invitation is already waiting for this email.",
      );
      return;
    }

    clearError("inviteEmail");

    // Work out the sent and expiry times (the link lasts 48 hours)
    const sent = new Date();
    const expires = new Date(sent.getTime() + 48 * 60 * 60 * 1000); // 48 hours in milliseconds

    // Build a new table row, cell by cell.
    // textContent (not innerHTML) puts the email in as plain text, which is safer.
    const row = document.createElement("tr");
    row.className = "invite-row border-t border-gray-100";
    row.setAttribute("data-email", email);

    [email, role, formatDateTime(sent), formatDateTime(expires)].forEach(
      function (text) {
        const cell = document.createElement("td");
        cell.className = "py-3 pr-5";
        cell.textContent = text;
        row.appendChild(cell);
      },
    );

    // Last cell: the demo link and the Cancel button
    const actionCell = document.createElement("td");
    actionCell.className = "py-3 pr-5 space-x-3";

    // Demo only: in real life the link arrives by email.
    // encodeURIComponent makes the email and role safe to put in a link (spaces become %20).
    const link = document.createElement("a");
    link.href =
      "acceptInvite.html?email=" +
      encodeURIComponent(email) +
      "&role=" +
      encodeURIComponent(role);
    link.className = "text-blue-600 hover:underline";
    link.textContent = "Open link (demo)";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "cancel-invite text-red-600 hover:underline";
    cancel.textContent = "Cancel";

    actionCell.appendChild(link);
    actionCell.appendChild(cancel);
    row.appendChild(actionCell);

    // Put the new row at the top of the table
    inviteBody.prepend(row);
    updateInviteEmpty();

    // NOTE: Really sending the email needs a backend.
    const message = document.getElementById("inviteMessage");
    message.textContent = "Invitation sent to " + email + " as " + role + ".";
    message.classList.remove("hidden");
    document.getElementById("inviteEmail").value = "";
  });

  // ---------- Cancel invitation ----------

  // One listener on the whole table catches clicks on any Cancel button,
  // even on rows added later by "Send invitation".
  inviteBody.addEventListener("click", function (event) {
    if (event.target.classList.contains("cancel-invite")) {
      const row = event.target.closest("tr");
      const confirmed = confirm(
        "Cancel the invitation for " + row.getAttribute("data-email") + "?",
      );

      if (confirmed) {
        row.remove();
        updateInviteEmpty();
      }
    }
  });

  // ---------- Deactivate / reactivate an admin ----------

  document.querySelectorAll(".deactivate-button").forEach(function (button) {
    button.addEventListener("click", function () {
      const row = button.closest("tr");
      const statusCell = row.querySelector(".status-cell");

      if (statusCell.textContent === "Active") {
        const confirmed = confirm(
          "Deactivate " +
            row.getAttribute("data-email") +
            "? They will no longer be able to sign in.",
        );
        if (!confirmed) {
          return;
        }
        statusCell.textContent = "Deactivated";
        button.textContent = "Reactivate";
      } else {
        statusCell.textContent = "Active";
        button.textContent = "Deactivate";
      }
    });
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
