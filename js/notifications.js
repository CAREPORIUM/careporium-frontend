// ====== NOTIFICATIONS PAGE (worker and facility) ======
// Needs /js/api.js to be loaded first.
//
// The <body> says whose page it is: data-account="professional" or data-account="facility".
// What shows depends on the account's verification status (see api.js):
// - not verified yet: a note about verification, and verification updates only
// - verified: shift, application and payment updates

// Not on the server yet (SERVER_HAS.notifications in api.js): sample data, with a note
if (usesDemo("notifications")) {
  document.addEventListener("DOMContentLoaded", function () {
    showPreviewNote("Notifications");
  });
}

const accountType = document.body.getAttribute("data-account");

//  The pages the notification buttons open. Make these match your real file names exactly.
const W = "../WorkerShiftMarket/";
const F = "../FacilityHiringSection/";
const STATUS_PAGE = "../StatusSection/VerificationStatus.html";
const UPLOAD_PAGES = {
  professional: "../HealthWorkerSection/healthWorkerCredentials.html",
  facility: "../FacilitySection/facilityRegistration.html",
};
const DASHBOARDS = { professional: W + "Dashboard.html", facility: F + "Dashboard.html" };

// ==================================================
// DEMO NOTIFICATIONS (only used when USE_DEMO_MODE is true in api.js)
// ==================================================

// Each notification: { id, group: "Today" | "Yesterday" | "Earlier", title, text, time,
//                       actionText, actionLink, read: true | false }
// Which list shows depends on the account type and its verification status.
const DEMO_NOTIFICATIONS = {
  professional: {
    not_submitted: [
      { id: "w-n1", group: "Today", title: "Finish your verification", text: "Upload your licence, ID, education certificate and proof of address so we can review your profile.", time: "Today · 9:00 AM WAT", actionText: "Upload documents", actionLink: UPLOAD_PAGES.professional, read: false },
      { id: "w-n2", group: "Yesterday", title: "Welcome to Careporium, Amara", text: "You're one step closer to finding shifts that fit your skills and schedule.", time: "Yesterday · 4:30 PM WAT", actionText: "View my profile", actionLink: W + "Profile.html", read: true },
    ],
    rejected: [
      { id: "w-r1", group: "Today", title: "Your documents need attention", text: "One of your documents couldn't be approved. Check the reason and upload a corrected copy.", time: "Today · 9:20 AM WAT", actionText: "Fix documents", actionLink: STATUS_PAGE, read: false },
      { id: "w-r2", group: "Yesterday", title: "Your documents are safely submitted", text: "We've received your licence, ID, education certificate and proof of address.", time: "Yesterday · 9:10 AM WAT", actionText: "View documents", actionLink: W + "Dashboard.html", read: true },
      { id: "w-r3", group: "Earlier", title: "Welcome to Careporium, Amara", text: "You're one step closer to finding shifts that fit your skills and schedule.", time: "Earlier · 6 October, 4:30 PM WAT", actionText: "View my profile", actionLink: W + "Profile.html", read: true },
    ],
    pending: [
      { id: "w-p1", group: "Today", title: "We're reviewing your documents", text: "Your documents are with our team. We'll let you know when the review is complete.", time: "Today · 9:20 AM WAT", actionText: "View progress", actionLink: STATUS_PAGE, read: true },
      { id: "w-p2", group: "Today", title: "Your documents are safely submitted", text: "We've received your licence, ID, education certificate and proof of address. You don't need to upload them again.", time: "Today · 9:10 AM WAT", actionText: "View documents", actionLink: W + "Dashboard.html", read: true },
      { id: "w-p3", group: "Yesterday", title: "Welcome to Careporium, Amara", text: "You're one step closer to finding shifts that fit your skills and schedule.", time: "Yesterday · 4:30 PM WAT", actionText: "View my profile", actionLink: W + "Profile.html", read: true },
    ],
    verified: [
      { id: "w-v0", group: "Today", title: "Mainland Care Hospital offered you a shift", text: "Registered nurse · General ward on Friday, 9 October, 08:00–16:00 WAT. Accept to confirm your place.", time: "Today · 9:40 AM WAT", actionText: "View offer", actionLink: W + "UpcomingShifts.html?shift=CP-1042", read: false },
      { id: "w-v1", group: "Today", title: "Your application was accepted", text: "Yaba Community Clinic has booked you for the community nurse shift on 9 October.", time: "Today · 9:20 AM WAT", actionText: "View my shift", actionLink: W + "UpcomingShifts.html", read: false },
      { id: "w-v2", group: "Today", title: "Your shift starts tomorrow", text: "You're due at Yaba Community Clinic at 8:00 AM WAT. Please arrive 15 minutes early.", time: "Today · 8:00 AM WAT", actionText: "Check shift details", actionLink: W + "UpcomingShifts.html", read: false },
      { id: "w-v3", group: "Yesterday", title: "Your payment has been released", text: "Your ₦30,000 payment for a completed shift at Yaba Medical Centre has been released.", time: "Yesterday · 5:10 PM WAT", actionText: "View payment", actionLink: W + "PaymentDetails.html?payment=CP-1026", read: false },
      { id: "w-v4", group: "Yesterday", title: "Your application is being reviewed", text: "Mainland Care Hospital is reviewing your application for the registered nurse shift.", time: "Yesterday · 2:30 PM WAT", actionText: "View application", actionLink: W + "MyApplications.html", read: true },
      { id: "w-v5", group: "Earlier", title: "Your profile is verified", text: "You're ready to go. Find shifts that match your skills and availability.", time: "Earlier · 6 October, 10:00 AM WAT", actionText: "Find shifts", actionLink: W + "FindShifts.html", read: true },
      { id: "w-v6", group: "Earlier", title: "How was your last shift?", text: "Share your experience at Mainland Care Hospital to help other professionals choose their next shift.", time: "Earlier · 5 October, 4:00 PM WAT", actionText: "Leave a review", actionLink: W + "FacilityRatingReview.html?facility=FC-0216", read: true },
    ],
  },
  facility: {
    not_submitted: [
      { id: "f-n1", group: "Today", title: "Finish your verification", text: "Upload your registration certificate, facility licence and tax document so we can review your facility.", time: "Today · 9:00 AM WAT", actionText: "Upload documents", actionLink: UPLOAD_PAGES.facility, read: false },
      { id: "f-n2", group: "Yesterday", title: "Welcome to Careporium, Mainland Care", text: "You're one step closer to finding qualified professionals for your shifts.", time: "Yesterday · 4:30 PM WAT", actionText: "View facility profile", actionLink: F + "FacilityProfile.html", read: true },
    ],
    rejected: [
      { id: "f-r1", group: "Today", title: "Your documents need attention", text: "One of your facility documents couldn't be approved. Check the reason and upload a corrected copy.", time: "Today · 9:20 AM WAT", actionText: "Fix documents", actionLink: STATUS_PAGE, read: false },
      { id: "f-r2", group: "Yesterday", title: "Your documents are safely submitted", text: "We've received your registration certificate, facility licence and tax document.", time: "Yesterday · 9:10 AM WAT", actionText: "View documents", actionLink: F + "Dashboard.html", read: true },
      { id: "f-r3", group: "Earlier", title: "Welcome to Careporium, Mainland Care", text: "You're one step closer to finding qualified professionals for your shifts.", time: "Earlier · 6 October, 4:30 PM WAT", actionText: "View facility profile", actionLink: F + "FacilityProfile.html", read: true },
    ],
    pending: [
      { id: "f-p1", group: "Today", title: "We're reviewing your facility documents", text: "Your documents are with our team. We'll let you know when the review is complete.", time: "Today · 9:20 AM WAT", actionText: "View progress", actionLink: STATUS_PAGE, read: true },
      { id: "f-p2", group: "Today", title: "Your documents are safely submitted", text: "We've received your registration certificate, facility licence and tax document. You don't need to upload them again.", time: "Today · 9:10 AM WAT", actionText: "View documents", actionLink: F + "Dashboard.html", read: true },
      { id: "f-p3", group: "Yesterday", title: "Welcome to Careporium, Mainland Care", text: "You're one step closer to finding qualified professionals for your shifts.", time: "Yesterday · 4:30 PM WAT", actionText: "View facility profile", actionLink: F + "FacilityProfile.html", read: true },
    ],
    verified: [
      { id: "f-v1", group: "Today", title: "Amara applied for your ICU nurse shift", text: "Amara Okafor's licence is verified. Review her profile to see if she's a good fit.", time: "Today · 9:20 AM WAT", actionText: "Review applicants", actionLink: F + "Applicants.html", read: false },
      { id: "f-v2", group: "Today", title: "Your urgent shifts still need cover", text: "You still need one ICU nurse and one pharmacist for tomorrow's shifts.", time: "Today · 9:00 AM WAT", actionText: "Manage shifts", actionLink: F + "ManageShifts.html", read: false },
      { id: "f-v3", group: "Today", title: "3 completed shifts need your confirmation", text: "Confirm attendance and completion so the professionals can receive their payments.", time: "Today · 8:30 AM WAT", actionText: "Review shifts", actionLink: F + "ManageShifts.html", read: false },
      { id: "f-v4", group: "Today", title: "Your general ward shift starts today", text: "Both nurses are booked for 8:00 AM WAT. Check the shift details before they arrive.", time: "Today · 7:00 AM WAT", actionText: "View shift", actionLink: F + "ShiftDetails.html?shift=CP-1042", read: true },
      { id: "f-v5", group: "Yesterday", title: "A worker's payment has been released", text: "₦30,000 has been released for a completed shift at your facility.", time: "Yesterday · 5:10 PM WAT", actionText: "View payments", actionLink: F + "Payments.html", read: true },
      { id: "f-v6", group: "Yesterday", title: "Your facility is verified", text: "You're ready to post shifts and connect with qualified healthcare professionals.", time: "Yesterday · 11:00 AM WAT", actionText: "Post a shift", actionLink: F + "PostShift.html", read: true },
    ],
  },
};

// The page's subtitle, and the note shown above the list before the account is verified
const SUBTITLES = {
  professional: {
    unverified: "Stay up to date with your profile and verification.",
    verified: "Your latest shift, application and payment updates, all in one place.",
  },
  facility: {
    unverified: "Stay up to date with your facility and verification.",
    verified: "Keep up with applicants, staffing needs and completed shifts.",
  },
};
const LATER_UPDATES = {
  professional: "Shift and payment updates will appear here once you're approved and start taking shifts.",
  facility: "Applicant and shift updates will appear here once you're approved and start posting shifts.",
};

// ==================================================
// READ / UNREAD (demo memory)
// ==================================================

// DEMO: the ids of notifications this account has read, saved in the browser,
// e.g. "readNotifications:professional@careporium.com" → ["w-v1", "w-v3"]
function readKey() {
  return "readNotifications:" + (sessionGet("userEmail") || "guest");
}

function getReadIds() {
  return JSON.parse(localStorage.getItem(readKey()) || "[]");
}

function saveReadIds(ids) {
  localStorage.setItem(readKey(), JSON.stringify(ids));
}

// ==================================================
// THE PAGE
// ==================================================

let notifications = []; // the list being shown
let currentTab = "all"; // "all" or "unread"

const list = document.getElementById("notificationList");
const emptyCard = document.getElementById("notificationsEmpty");
const markAllButton = document.getElementById("markAllRead");
const tabs = document.querySelectorAll(".notification-tab");

// Build one notification card. Unread ones are light blue with a blue dot.
function notificationHtml(item) {
  let cardColor = "bg-white border-gray-200";
  let dot = '<span class="w-2 h-2 flex-shrink-0"></span>'; // an empty space keeps the cards lined up
  if (!item.read) {
    cardColor = "bg-blue-50 border-blue-100";
    dot = '<span class="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" title="Unread"></span>';
  }

  return `
    <div class="notification-item flex flex-col sm:flex-row sm:items-center gap-4 border rounded-xl p-5 ${cardColor}">
      <img src="../icons/bell.png" alt="" class="hidden sm:block w-4 h-4 flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold">${escapeHtml(item.title)}</p>
        <p class="text-xs text-gray-700 mt-1">${escapeHtml(item.text)}</p>
        <p class="text-xs text-gray-500 mt-1">${escapeHtml(item.time)}</p>
      </div>
      <div class="flex items-center gap-4">
        <a href="${escapeHtml(item.actionLink)}" data-id="${escapeHtml(item.id)}" class="notification-action w-40 bg-white border border-blue-600 text-blue-600 text-xs font-medium text-center py-3 rounded-lg hover:bg-blue-50">${escapeHtml(item.actionText)}</a>
        ${dot}
      </div>
    </div>`;
}

// Draw the list, the tab numbers and the "Mark all as read" button
function render() {
  const unreadCount = notifications.filter(function (item) {
    return !item.read;
  }).length;

  document.getElementById("allCount").textContent = notifications.length;
  document.getElementById("unreadCount").textContent = unreadCount;

  // "Mark all as read" becomes "All caught up" (and can't be clicked) when nothing is unread
  if (unreadCount === 0) {
    markAllButton.textContent = "All caught up";
    markAllButton.disabled = true;
    markAllButton.classList.add("cursor-default");
    markAllButton.classList.remove("hover:bg-blue-50");
  } else {
    markAllButton.textContent = "Mark all as read";
    markAllButton.disabled = false;
    markAllButton.classList.remove("cursor-default");
    markAllButton.classList.add("hover:bg-blue-50");
  }

  // Which notifications this tab shows
  const shown = notifications.filter(function (item) {
    return currentTab === "all" || !item.read;
  });

  // Nothing to show: the "You're all caught up" card
  if (shown.length === 0) {
    list.innerHTML = "";
    emptyCard.classList.remove("hidden");
    return;
  }
  emptyCard.classList.add("hidden");

  // Group them under "Today", "Yesterday" and "Earlier", in that order
  let html = "";
  ["Today", "Yesterday", "Earlier"].forEach(function (group) {
    const inGroup = shown.filter(function (item) {
      return item.group === group;
    });
    if (inGroup.length === 0) {
      return;
    }

    html += `<h2 class="text-sm font-semibold mt-8">${group}</h2><div class="space-y-3 mt-3">`;
    inGroup.forEach(function (item) {
      html += notificationHtml(item);
    });
    html += "</div>";
  });
  list.innerHTML = html;
}

// ---------- Tabs ----------

tabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    currentTab = tab.getAttribute("data-tab");

    // The picked tab is light blue, the other is white
    tabs.forEach(function (otherTab) {
      otherTab.classList.remove("bg-blue-50");
      otherTab.classList.add("bg-white");
    });
    tab.classList.remove("bg-white");
    tab.classList.add("bg-blue-50");

    render();
  });
});

// ---------- Mark all as read ----------

markAllButton.addEventListener("click", async function () {
  if (!usesDemo("notifications")) {
    try {
      await Backend.markAllNotificationsRead();
    } catch (error) {
      showGeneralError("Couldn't update your notifications: " + error.message);
      return;
    }
  } else {
    saveReadIds(notifications.map(function (item) {
      return item.id;
    }));
  }

  notifications.forEach(function (item) {
    item.read = true;
  });
  render();
});

// ---------- Opening a notification marks it as read ----------

// One listener on the whole list catches every button, even after the list is redrawn
list.addEventListener("click", async function (event) {
  const action = event.target.closest(".notification-action");
  if (!action) {
    return;
  }

  event.preventDefault(); // wait until it's marked as read, then open the page
  const id = action.getAttribute("data-id");
  const link = action.getAttribute("href");

  if (usesDemo("notifications")) {
    const ids = getReadIds();
    if (!ids.includes(id)) {
      ids.push(id);
      saveReadIds(ids);
    }
  } else {
    try {
      await Backend.markNotificationRead(id);
    } catch (error) {
      // Even if this fails, still open the page
    }
  }

  if (link && link !== "#") {
    window.location.href = link;
  } else {
    // No page to open yet: just show it as read
    notifications.forEach(function (item) {
      if (item.id === id) {
        item.read = true;
      }
    });
    render();
  }
});

// ==================================================
// LOAD
// ==================================================

// Show the verification note (and the right subtitle) before the account is verified
function showVerificationNote(info) {
  const verified = info.status === "verified";
  document.getElementById("notificationsSubtitle").textContent =
    SUBTITLES[accountType][verified ? "verified" : "unverified"];

  if (verified) {
    return;
  }

  const note = document.getElementById("verificationNote");
  let title = "Your verification is in progress.";
  let text = LATER_UPDATES[accountType];

  if (info.status === "not_submitted") {
    title = "Your verification hasn't started yet.";
    text = "Upload your documents to get verified. " + LATER_UPDATES[accountType];
  } else if (info.status === "rejected") {
    title = "Your documents need attention.";
    text = info.feedback || "One of your documents couldn't be approved. Please upload a corrected copy.";
    note.classList.remove("bg-amber-50", "border-amber-100");
    note.classList.add("bg-red-50", "border-red-100");
  }

  document.getElementById("noteTitle").textContent = title;
  document.getElementById("noteText").textContent = text;
  note.classList.remove("hidden");
}

async function loadNotifications() {
  // "Back to dashboard" on the empty card
  document.getElementById("backToDashboard").href = DASHBOARDS[accountType];

  let info;
  try {
    info = await getVerificationStatus();
  } catch (error) {
    info = { status: "verified" }; // can't tell: show the list without the note
  }
  showVerificationNote(info);

  if (usesDemo("notifications")) {
    // Copy the demo list for this account and status, then apply what this account has read
    let status = info.status;
    if (status === "resubmission") {
      status = "pending";
    }
    const readIds = getReadIds();
    notifications = DEMO_NOTIFICATIONS[accountType][status].map(function (item) {
      return Object.assign({}, item, { read: item.read || readIds.includes(item.id) });
    });
  } else {
    // REAL: the server answers with { notifications: [ { id, group, title, text, time,
    //       actionText, actionLink, read }, ... ] } (see the API document)
    try {
      notifications = await Backend.notifications();
    } catch (error) {
      showGeneralError("Couldn't load your notifications: " + error.message);
      notifications = [];
    }
  }

  document.getElementById("notificationsLoading").classList.add("hidden");
  render();
}

loadNotifications();
