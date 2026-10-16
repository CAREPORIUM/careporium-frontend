// ====== API (shared by every page) ======
//
// This file holds everything to do with talking to the backend (the server).
// Every page loads it BEFORE its own script, like this:
//
//   <script src="../js/api.js"></script>
//   <script src="../js/login.js"></script>
//
// (then /js/backend.js, which translates between the pages and the backend's field names)
//
// So the page scripts can use: USE_DEMO_MODE, usesDemo, ENDPOINTS, apiRequest, setLoading,
// escapeHtml, fillFields and showGeneralError.

// ==================================================
// 1. SETTINGS (the only part you normally change)
// ==================================================

// ---------- Who is logged in (one login per role) ----------
// The admin, a facility and a worker can all be logged in at the same time in one browser (handy for
// demos and testing): each role's login is kept under its own name, e.g. "authToken:admin", and every
// page uses the login for its own section of the site (Admin/ → admin, FacilityHiringSection/ and
// FacilitySection/ → facility, WorkerShiftMarket/ and HealthWorkerSection/ → worker). Pages outside
// those sections (sign-in, status) use the most recent login.
const SESSION_KEYS = ["authToken", "userType", "userId", "userEmail", "displayName"];
const PAGE_ROLE = (function () {
  const path = window.location.pathname;
  if (/\/Admin\//.test(path)) return "admin";
  if (/\/(FacilityHiringSection|FacilitySection)\//.test(path)) return "facility";
  if (/\/(WorkerShiftMarket|HealthWorkerSection)\//.test(path)) return "professional";
  return null;
})();

// Read one login value for this page's role
function sessionGet(key) {
  try {
    if (PAGE_ROLE) {
      const own = localStorage.getItem(key + ":" + PAGE_ROLE);
      if (own !== null) return own;
      // Logged in before this update (only the shared copy exists): use it if it's this role's
      return localStorage.getItem("userType") === PAGE_ROLE ? localStorage.getItem(key) : null;
    }
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

// Save one login value (the shared copy, and the copy for its role)
function sessionSet(key, value, role) {
  try {
    localStorage.setItem(key, value);
    const r = role || PAGE_ROLE;
    if (r) localStorage.setItem(key + ":" + r, value);
  } catch (error) {
    // storage blocked: nothing to do
  }
}

// Log one role out (only that role: the others stay logged in)
function sessionClear(role) {
  const r = role || PAGE_ROLE;
  try {
    const sharedIsThisRole = !r || localStorage.getItem("userType") === r;
    SESSION_KEYS.forEach(function (key) {
      if (r) localStorage.removeItem(key + ":" + r);
      if (sharedIsThisRole) localStorage.removeItem(key);
    });
  } catch (error) {
    // storage blocked: nothing to do
  }
}

// true  = no server needed. The pages use the demo accounts and sample data.
// false = the pages talk to the real backend at API_BASE_URL.
// Features the backend doesn't have yet keep using sample data either way (see SERVER_HAS below).
const USE_DEMO_MODE = false;

// The address of the backend (no slash at the end).
// While the backend developer runs it on their own computer, it's "http://localhost:8089".
// (For testing against another server, e.g. a local one, run this once in the browser Console:
//   localStorage.setItem("apiBaseUrl", "http://localhost:8089")   and remove it again to go back.)
const API_BASE_URL = (function () {
  try {
    return localStorage.getItem("apiBaseUrl") || "https://careporium-backend.onrender.com";
  } catch (error) {
    return "https://careporium-backend.onrender.com";
  }
})();

// What the backend can do today. When the backend developer adds a feature, change its false to
// true here (and connect it in backend.js). Until then, that part of the site keeps its sample
// data and shows a small "Preview" note, even with USE_DEMO_MODE = false.
const SERVER_HAS = {
  accounts: true, // sign up, email code, log in, log out, passwords
  verification: true, // documents and verification status
  profiles: true, // worker and facility profiles
  shifts: true, // posting, finding and completing shifts
  applications: true, // applying, accepting, rejecting
  attendance: true, // attendance QR, clock in, clock out
  adminVerification: true, // admin overview, queue, reviewing documents, user lists
  emailCheck: false, // "is this email taken?" during sign-up
  notifications: true, // /api/notifications/v1 (from the backend's Postman collection)
  workerDashboard: false,
  facilityDashboard: false,
  experience: false, // work experience and soft skills
  facilityReviews: false,
  shiftDrafts: false, // "Save for later" (the backend posts shifts straight away)
  shortlist: false,
  attendanceActions: false, // no-show, replacement, fixing a clock-out, live clock times
  backupCode: false, // the 6-digit code instead of scanning the QR
  payments: false, // the worker's bank details (no endpoint yet)
  workerPayouts: true, // the worker's Payments page: booked shifts + GET /api/payouts/v1/history
  disputes: true, // raising (payment issues) and the admin's Disputes pages: /api/disputes/v1
  facilityPayments: true, // funding each shift's escrow (HarrenaPay), worked out from the shifts
  adminInvitations: false,
  adminAccounts: false, // suspending and re-enabling accounts
  activity: false,
  adminTeam: false,
};

// Should this feature use sample data? Yes in demo mode, or when the server doesn't have it yet.
function usesDemo(feature) {
  return USE_DEMO_MODE || SERVER_HAS[feature] !== true;
}

// With the real backend, a page (or part of one) that still shows sample data says so
function showPreviewNote(what, fullText) {
  if (USE_DEMO_MODE) {
    return;
  }
  const main = document.querySelector("main");
  if (!main || document.getElementById("previewNote")) {
    return;
  }
  const note = document.createElement("p");
  note.id = "previewNote";
  note.className =
    "bg-slate-100 text-gray-700 text-xs font-medium rounded-lg p-3 mb-5";
  note.textContent = fullText ||
    "Preview: " +
    what +
    " isn't connected to the server yet, so this shows sample data.";
  main.insertBefore(note, main.firstChild);
}

// ==================================================
// 2. ENDPOINTS (every server address the frontend uses)
// ==================================================

// Keeping them all in one place means: if an address changes, you change it here only.
// The ones written as functions need an id, e.g. ENDPOINTS.shift("652abc...").
// The translation between the backend's field names and the pages is in backend.js.
const ENDPOINTS = {
  // ----- Accounts -----
  login: "/api/auth/v1/login", // POST { email, password } → { user, token }
  logout: "/api/auth/v1/logout", // POST
  registerProfessional: "/api/auth/v1/register/worker", // POST JSON (see backend.js)
  registerFacility: "/api/auth/v1/register/facility", // POST JSON (documents come later, after login)
  verifyAccount: "/api/auth/v1/verify-account", // POST { email, otp }
  resendAccountCode: "/api/auth/v1/resend-otp", // POST { email }
  getProfile: "/api/auth/v1/get-profile", // GET
  passwordForgot: "/api/auth/v1/forgot-password", // POST { email }
  passwordVerifyCode: "/api/auth/v1/verify-reset-code", // POST { otp } → { resetToken }
  passwordResendCode: "/api/auth/v1/resend-reset-code", // POST { email }
  passwordReset: "/api/auth/v1/reset-password", // POST { newPassword }, with the reset token

  // ----- Profiles -----
  // workerOwnProfile: function (userId) {
  //   // GET the worker's profile
  //   return "/api/worker/v1/get-worker-profile/" + userId;
  // },
  // workerProfile: function (userId) {
  //   // GET a worker's profile (facility view)
  //   return "/api/worker/v1/get-worker-profile/" + userId;
  // },

  // The newest Swagger file puts the USER id at the end of these two addresses
  // (get-worker-profile/{userId}, update-worker-profile/{userId}); backend.js tries that first
  // and falls back to the address without an id, so both server versions work.
  workerOwnProfile: function (userId) {
    // GET a worker's profile (the logged-in worker's own, or any worker's with their user id)
    return "/api/worker/v1/get-worker-profile" + (userId ? "/" + userId : "");
  },
  workerProfileUpdate: function (userId) {
    // PUT multipart: details and documents
    return "/api/worker/v1/update-worker-profile" + (userId ? "/" + userId : "");
  },
  workerCredentials: "/api/worker/v1/update-worker-profile", // (old address, without the id)
  facilityProfile: "/api/facility/v1/get-facility-profile", // GET
  facilityProfileUpdate: "/api/facility/v1/update-facility-profile", // PUT multipart (uses the login token): details and documents

  // ----- Shifts -----
  searchShifts: "/api/shifts/v1/get-shifts", // GET ?status=open&role=...&specialty=...
  shift: function (shiftId) {
    // GET one shift
    return "/api/shifts/v1/get-shift/" + shiftId;
  },
  createShift: "/api/shifts/v1/create-shift", // POST (also starts the shift's payment)
  updateShift: function (shiftId) {
    // PUT
    return "/api/shifts/v1/update-shift/" + shiftId;
  },
  closeShift: function (shiftId) {
    // PATCH
    return "/api/shifts/v1/close-shift/" + shiftId;
  },
  completeShift: function (shiftId) {
    // PATCH
    return "/api/shifts/v1/complete-shift/" + shiftId;
  },
  deleteShift: function (shiftId) {
    // DELETE
    return "/api/shifts/v1/delete-shift/" + shiftId;
  },
  facilityShifts: "/api/shifts/v1/get-facility-shifts", // GET

  // ----- Applications -----
  applyToShift: function (shiftId) {
    // POST
    return "/api/applications/v1/apply/" + shiftId;
  },
  myApplications: "/api/applications/v1/my-applications", // GET (worker)
  facilityApplicants: "/api/applications/v1/facility-applications", // GET (facility)
  acceptApplication: function (applicationId) {
    // PATCH
    return "/api/applications/v1/accept/" + applicationId;
  },
  rejectApplication: function (applicationId) {
    // PATCH
    return "/api/applications/v1/reject/" + applicationId;
  },

  // ----- Attendance -----
  attendanceQr: function (shiftId) {
    // GET the shift's QR token (facility)
    return "/api/attendance/v1/qr/" + shiftId;
  },
  clockIn: "/api/attendance/v1/clock-in", // POST { qrToken }
  clockOut: "/api/attendance/v1/clock-out", // POST { qrToken }

  // ----- Payments -----
  shiftPayment: function (shiftId) {
    // GET: the payment status (and link) for one shift
    return "/api/payments/v1/shift/" + shiftId;
  },
  paymentHistory: "/api/payments/v1/history", // GET: the logged-in user's payments
  payoutHistory: "/api/payouts/v1/history", // GET: the logged-in worker's payouts
  payoutProcess: "/api/payouts/v1/process", // POST { shiftId, workerId }
  payoutVerify: "/api/payouts/v1/verify", // POST { shiftId, workerId }
  raiseDispute: "/api/disputes/v1/raise-dispute", // POST { shiftId, reason, description }
  allDisputes: "/api/disputes/v1/get-all-disputes", // GET (admin)
  oneDispute: function (id) {
    // GET (admin). The Postman collection spells it "rget-dispute"; "get-dispute" is tried too.
    return "/api/disputes/v1/rget-dispute/" + id;
  },
  retryPayment: function (shiftId) {
    // POST: try a shift's payment again
    return "/api/payments/v1/retry/" + shiftId;
  },

  // ----- Admin -----
  adminOverview: "/api/admin/v1/dashboard/stats", // GET
  verifications: "/api/admin/v1/verification-queue", // GET: one item per document waiting
  adminWorkers: "/api/admin/v1/workers", // GET
  adminPendingWorkers: "/api/admin/v1/workers/pending", // GET
  adminWorker: function (workerId) {
    // GET
    return "/api/admin/v1/workers/" + workerId;
  },
  adminWorkerDocuments: function (workerId) {
    // PATCH { documentType, status, comment }
    return "/api/admin/v1/workers/" + workerId + "/documents";
  },
  adminFacilities: "/api/admin/v1/facilities", // GET
  adminPendingFacilities: "/api/admin/v1/facilities/pending", // GET
  adminFacility: function (facilityId) {
    // GET
    return "/api/admin/v1/facilities/" + facilityId;
  },
  adminFacilityDocuments: function (facilityId) {
    // PATCH { documentType, status, comment }
    return "/api/admin/v1/facilities/" + facilityId + "/documents";
  },

  // ----- NOT ON THE SERVER YET -----
  // These are kept so the demo code keeps working. They aren't called with the real backend
  // (see SERVER_HAS). When the backend adds one, put its real address here.
  emailAvailable: "/not-yet/email-available",
  verificationStatus: "/not-yet/verification-status",
  notifications: "/api/notifications/v1/", // GET: all my notifications
  unreadNotifications: "/api/notifications/v1/my-notifications?unread=true", // GET
  markNotificationRead: function (id) {
    // PATCH
    return "/api/notifications/v1/read/" + id;
  },
  markAllNotificationsRead: "/api/notifications/v1/read-all", // PATCH
  workerDashboard: "/not-yet/worker-dashboard",
  facilityReviews: function (id) {
    return "/not-yet/facilities/" + id + "/reviews";
  },
  workerExperience: "/not-yet/worker-experience",
  workerExperienceItem: function (id) {
    return "/not-yet/worker-experience/" + id;
  },
  workerSoftSkills: "/not-yet/soft-skills",
  workerPayments: "/not-yet/worker-payments",
  workerPayment: function (id) {
    return "/not-yet/worker-payments/" + id;
  },
  bankAccount: "/not-yet/bank-account",
  paymentIssue: function (id) {
    return "/not-yet/worker-payments/" + id + "/issues";
  },
  workerShift: function (id) {
    return "/not-yet/worker-shifts/" + id;
  },
  acceptOffer: function (id) {
    return "/not-yet/worker-shifts/" + id + "/accept";
  },
  declineOffer: function (id) {
    return "/not-yet/worker-shifts/" + id + "/decline";
  },
  upcomingShift: "/not-yet/upcoming-shift",
  facilityRegistration: "/not-yet/facility-registration",
  facilityDashboard: "/not-yet/facility-dashboard",
  facilityApplicantsForShift: function (id) {
    return "/not-yet/shifts/" + id + "/applicants";
  },
  applicants: function (id) {
    return "/not-yet/shifts/" + id + "/applicants";
  },
  publishShift: function (id) {
    return "/not-yet/shifts/" + id + "/publish";
  },
  shortlist: function (id) {
    return "/not-yet/applications/" + id + "/shortlist";
  },
  offerShift: function (id) {
    return "/not-yet/shifts/" + id + "/offers";
  },
  facilityShift: function (id) {
    return "/not-yet/facility-shifts/" + id;
  },
  markNoShow: function (s, w) {
    return "/not-yet/facility-shifts/" + s + "/workers/" + w + "/no-show";
  },
  replaceWorker: function (s, w) {
    return "/not-yet/facility-shifts/" + s + "/workers/" + w + "/replace";
  },
  fixAttendance: function (s, w) {
    return (
      "/not-yet/facility-shifts/" + s + "/workers/" + w + "/fix-attendance"
    );
  },
  facilityPayments: "/not-yet/facility-payments",
  facilityPayment: function (id) {
    return "/not-yet/facility-payments/" + id;
  },
  fundShift: function (id) {
    return "/not-yet/facility-payments/" + id + "/fund";
  },
  checkInvitation: function (token) {
    return "/not-yet/admin-invitations/" + token;
  },
  acceptInvitation: "/not-yet/admin-invitations/accept",
  verification: function (id) {
    return "/not-yet/verifications/" + id;
  },
  approveVerification: function (id) {
    return "/not-yet/verifications/" + id + "/approve";
  },
  rejectVerification: function (id) {
    return "/not-yet/verifications/" + id + "/reject";
  },
  users: "/not-yet/users",
  suspendUser: function (id) {
    return "/not-yet/users/" + id + "/suspend";
  },
  reactivateUser: function (id) {
    return "/not-yet/users/" + id + "/reactivate";
  },
  disputes: "/not-yet/disputes",
  dispute: function (id) {
    return "/not-yet/disputes/" + id;
  },
  disputeNotes: function (id) {
    return "/not-yet/disputes/" + id + "/notes";
  },
  resolveDispute: function (id) {
    return "/not-yet/disputes/" + id + "/resolve";
  },
  activity: "/not-yet/activity",
  admins: "/not-yet/admins",
  invitations: "/not-yet/invitations",
  cancelInvitation: function (id) {
    return "/not-yet/invitations/" + id;
  },
  deactivateAdmin: function (id) {
    return "/not-yet/admins/" + id + "/deactivate";
  },
  reactivateAdmin: function (id) {
    return "/not-yet/admins/" + id + "/reactivate";
  },
};

// ==================================================
// 3. apiRequest: send a request to the server and get the answer
// ==================================================

// path   = one of the ENDPOINTS above, e.g. ENDPOINTS.login
// method = "GET", "POST" or "DELETE" ("GET" if you leave it out)
// body   = the data to send: an object like { email, password }, or a FormData with files
//
// It gives back the server's answer (as an object), or throws an error if something went wrong.
// Because it's "async", you call it with "await", inside another async function:
//
//   const data = await apiRequest(ENDPOINTS.login, "POST", { email: email, password: password });
//
// settings (optional): { token: "..." } sends a different token, e.g. the password-reset token
async function apiRequest(path, method, body, settings) {
  const options = {
    method: method || "GET",
    headers: {},
  };

  // If someone is logged in, send their token so the server knows who is asking
  const token =
    (settings && settings.token) || sessionGet("authToken");
  if (token) {
    options.headers["Authorization"] = "Bearer " + token;
  }

  if (body instanceof FormData) {
    // Files: send the FormData as it is (the browser sets the right header itself)
    options.body = body;
  } else if (body) {
    // Normal data: turn the object into JSON text
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  // fetch() sends the request. "await" waits for the answer before moving on.
  let response;
  try {
    response = await fetch(API_BASE_URL + path, options);
  } catch (networkError) {
    // fetch only fails like this when there's no internet or the server can't be reached
    throw new Error(
      "Can't reach the server. Check your internet connection and try again.",
    );
  }

  // Read the answer as JSON. Some answers are empty, so we allow that.
  let data = null;
  try {
    data = await response.json();
  } catch (emptyAnswer) {
    data = null;
  }

  // The server said our login has expired (401): log out and go back to sign in
  if (response.status === 401 && token && !(settings && settings.token)) {
    sessionClear();
  }

  // response.ok is true for success codes (200–299). Anything else is an error.
  if (!response.ok) {
    // Use the server's message if it sent one, e.g. { "message": "Email already registered" }
    // Otherwise say what happened, e.g. "The server answered 404 (Not Found) for GET /api/...",
    // which helps find the problem in the Console
    let message =
      "The server answered " +
      response.status +
      (response.statusText ? " (" + response.statusText + ")" : "") +
      " for " +
      (method || "GET") +
      " " +
      path.split("?")[0] +
      ".";
    if (data && data.message) {
      message = data.message;
    }

    const error = new Error(message);
    error.status = response.status; // e.g. 400, 404, 429
    if (data && data.field) {
      error.field = data.field; // which input the error belongs to, e.g. "businessEmail"
    }
    if (data && data.reason) {
      error.reason = data.reason; // a short code for the problem, e.g. "too_early" when clocking in
    }
    throw error;
  }

  // The backend wraps its answers like { success: true, message: "...", data: {...} }.
  // The pages only need what's inside "data", so we unwrap it here.
  // (Answers without "data", like login's { user, token }, are returned as they are.)
  // Some answers have no "success", e.g. create-shift's { message: "...", data: { shift, payment } },
  // so any answer that only holds message / data (and similar wrapper fields) is unwrapped too.
  const WRAPPER_KEYS = ["success", "message", "data", "count", "total", "results", "pagination", "meta", "statusCode"];
  if (
    data && typeof data === "object" && !Array.isArray(data) && "data" in data &&
    Object.keys(data).every(function (key) { return WRAPPER_KEYS.includes(key); })
  ) {
    return data.data;
  }
  return data;
}

// ==================================================
// 4. HELPERS used while waiting for the server
// ==================================================

// Turn a button into a "loading" button (and back again).
// While loading, it can't be clicked twice and shows text like "Saving…".
function setLoading(button, isLoading, loadingText) {
  if (!button) {
    return;
  }

  if (isLoading) {
    // Remember the normal text so we can put it back later
    button.setAttribute("data-normal-text", button.textContent);
    button.textContent = loadingText || "Please wait…";
    button.disabled = true;
    button.classList.add("opacity-60", "cursor-not-allowed");
  } else {
    button.textContent =
      button.getAttribute("data-normal-text") || button.textContent;
    button.disabled = false;
    button.classList.remove("opacity-60", "cursor-not-allowed");
  }
}

// Make text from the server safe to put inside HTML.
// Without this, a name like "<script>..." could run as code on the page.
function escapeHtml(text) {
  return String(text === null || text === undefined ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Fill the page with data from the server.
// Any element with data-field="something" gets the value of data.something.
// Example: <p data-field="pendingVerifications">42 submissions</p>
//          fillFields({ pendingVerifications: "45 submissions" }) → the text becomes "45 submissions"
function fillFields(data) {
  document.querySelectorAll("[data-field]").forEach(function (element) {
    const key = element.getAttribute("data-field");
    if (data[key] !== undefined && data[key] !== null) {
      element.textContent = data[key];
    }
  });
}

// Show an error that doesn't belong to one input (like "Can't reach the server").
// It uses <p id="formError"> if the page has one, otherwise a pop-up box.
function showGeneralError(message) {
  const formError = document.getElementById("formError");

  if (formError) {
    formError.textContent = message;
    formError.classList.remove("hidden");
  } else {
    alert(message);
  }
}

// Read a value from the page address, e.g. "?id=WK-1048" → getUrlValue("id") gives "WK-1048"
function getUrlValue(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ==================================================
// 5. LOG OUT (every page with a logout button)
// ==================================================

// This lives here so every page shares one copy, instead of one copy in every script.
// A page can have more than one logout button (e.g. one in the sidebar for desktop and one
// at the top for mobile), so we find them all: the one with id="logoutButton" and any
// with class="logout-button".
document
  .querySelectorAll("#logoutButton, .logout-button")
  .forEach(function (button) {
    button.addEventListener("click", async function () {
      // Ask first, so nobody logs out by accident
      const confirmed = confirm("Are you sure you want to log out?");
      if (!confirmed) {
        return;
      }

      // Tell the server to end the session (only when using the real backend)
      if (!USE_DEMO_MODE) {
        try {
          await apiRequest(ENDPOINTS.logout, "POST");
        } catch (error) {
          // Even if the server can't be reached, we still log out on this browser
        }
      }

      // Forget who was logged in (only this section's role: other roles stay logged in)
      sessionClear();

      // Go to the sign-in page written in the button's data-login="..."
      // replace() also stops the Back button from returning to the dashboard
      window.location.replace(button.getAttribute("data-login"));
    });
  });

// ==================================================
// 6. VERIFICATION STATUS (worker and facility accounts)
// ==================================================

// Every worker and facility account is in one of these states:
//   "not_submitted"  no documents yet          → dashboard shows "Verification needed"
//   "pending"        documents being reviewed  → dashboard shows "Verification in progress"
//   "resubmission"   corrected documents sent  → same as pending
//   "rejected"       documents need fixing     → red banner with the admin's reason
//   "verified"       approved                  → full dashboard, every page unlocked
//
// DEMO: the browser remembers each demo account's state (saved by email in localStorage),
// so logging in again doesn't restart registration.
// REAL: the server sends it from GET /me/verification-status.

// The demo state is saved under the logged-in email, e.g. "demoStatus:facility@careporium.com"
function demoStatusKey() {
  return "demoStatus:" + (sessionGet("userEmail") || "guest");
}

// Read the demo state. A demo account that hasn't uploaded anything is "not_submitted".
function getDemoVerification() {
  const saved = localStorage.getItem(demoStatusKey());
  if (saved === null) {
    return { status: "not_submitted" };
  }
  return JSON.parse(saved);
}

// Save the demo state (used after uploading documents, and by the demo panel on the status page)
function setDemoVerification(status, feedback) {
  localStorage.setItem(
    demoStatusKey(),
    JSON.stringify({ status: status, feedback: feedback || "" }),
  );
}

// Ask for the status only once per page, even if several parts of the page need it.
// (The first call starts the request; later calls get the same answer.)
let verificationRequest = null;

function getVerificationStatus() {
  if (verificationRequest === null) {
    if (USE_DEMO_MODE) {
      verificationRequest = Promise.resolve(getDemoVerification());
    } else {
      // The server should answer with { status: "...", feedback: "..." (optional),
      // welcome: "Welcome, Amara." (optional, for the dashboard banner) }
      // Worked out from the worker or facility profile (see Backend.verificationStatus in backend.js)
      verificationRequest = Backend.verificationStatus();
    }
  }
  return verificationRequest;
}

// ---------- Locked menu items and locked pages ----------

// Until the account is verified:
// - menu links marked data-needs-verification are greyed out and can't be clicked
// - a page whose <body> has data-requires-verification="(dashboard address)" sends the user
//   back to their dashboard (e.g. if they type the address of a locked page)
async function applyVerificationLocks() {
  const lockedLinks = document.querySelectorAll("[data-needs-verification]");
  const dashboardPage = document.body.getAttribute(
    "data-requires-verification",
  );

  // This page has nothing to lock (e.g. admin pages), so don't ask for the status
  if (lockedLinks.length === 0 && dashboardPage === null) {
    return;
  }

  let info;
  try {
    info = await getVerificationStatus();
  } catch (error) {
    // If the status can't be checked, play it safe: treat the account as not verified yet
    console.warn(
      "Couldn't check the verification status, so the shift pages stay locked:",
      error.message,
    );
    info = { status: "not_submitted" };
  }

  if (info.status === "verified") {
    return; // full access
  }

  if (dashboardPage !== null) {
    window.location.replace(dashboardPage);
    return;
  }

  lockedLinks.forEach(function (link) {
    link.removeAttribute("href"); // a link without href can't be clicked
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("title", "Available after your account is verified");
    link.classList.add("opacity-40", "cursor-not-allowed");
    link.classList.remove("hover:bg-gray-50");
  });
}

// Run once every script on the page has loaded (backend.js comes after this file)
document.addEventListener("DOMContentLoaded", applyVerificationLocks);

// ---------- Dashboard states ----------

// Show the right part of a dashboard. The dashboard HTML has 4 parts:
//   #stateLoading (shown until we know), #stateLocked, #statePending and #stateVerified
// It gives back the status, so the dashboard script knows whether to load the full data.
async function showDashboardState() {
  let info;
  try {
    info = await getVerificationStatus();
  } catch (error) {
    showGeneralError(
      "Couldn't check your verification status: " + error.message,
    );
    info = { status: "not_submitted" };
  }

  document.getElementById("stateLoading").classList.add("hidden");
  fillFields(info); // e.g. the "Welcome, Amara." line, if the server sends it

  let stateId = "stateLocked"; // "not_submitted" and "rejected"
  if (info.status === "verified") {
    stateId = "stateVerified";
  } else if (info.status === "pending" || info.status === "resubmission") {
    stateId = "statePending";
  }
  document.getElementById(stateId).classList.remove("hidden");

  if (info.status === "rejected") {
    showRejectedBanner(info.feedback);
  }

  return info.status;
}

// Turn the "Verification needed" layout into the "documents rejected" version:
// red banner with the admin's reason, and "Upload corrected documents" buttons
function showRejectedBanner(feedback) {
  const banner = document.getElementById("lockedBanner");
  banner.classList.remove("bg-blue-600");
  banner.classList.add("bg-red-600");

  document.getElementById("lockedEyebrow").textContent = "Action needed";
  document.getElementById("lockedText").textContent =
    feedback ||
    "One or more of your documents needs to be updated before we can approve your account.";
  document.getElementById("lockedButton").textContent =
    "Upload corrected documents";
  document.getElementById("lockedButton").classList.remove("text-blue-600");
  document.getElementById("lockedButton").classList.add("text-red-600");
  document.getElementById("lockedDocsTitle").textContent =
    "Update your documents";
  document.getElementById("lockedUpload").textContent =
    "Upload corrected documents";

  // Each document now says it needs checking, in red
  document
    .querySelectorAll("#stateLocked .doc-status")
    .forEach(function (status) {
      status.textContent = "Check and upload again";
      status.classList.remove("text-amber-700");
      status.classList.add("text-red-600");
    });
}

// ==================================================
// 7. THE LOGGED-IN NAME (top right of every worker and facility page)
// ==================================================

// The header has <p data-user-name> and <span data-user-initials>. They're filled with the
// logged-in worker's name or the facility's name (remembered in the browser, so the next page
// shows it straight away, and refreshed from the server on every page).
function showUserName(name) {
  const initials = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(function (w) { return w.charAt(0); })
    .join("")
    .slice(0, 2)
    .toUpperCase();
  document.querySelectorAll("[data-user-name]").forEach(function (el) { el.textContent = name; });
  document.querySelectorAll("[data-user-initials]").forEach(function (el) { el.textContent = initials; });
}

function fillUserName() {
  if (document.querySelectorAll("[data-user-name], [data-user-initials]").length === 0) {
    return;
  }
  const type = sessionGet("userType");
  const saved = sessionGet("displayName");
  if (saved) {
    showUserName(saved);
  }
  if (USE_DEMO_MODE) {
    if (!saved) showUserName(type === "facility" ? "Mainland Care" : "Amara Okafor");
    return;
  }
  if (typeof Backend === "undefined" || !Backend.displayName || !sessionGet("authToken")) {
    return;
  }
  Backend.displayName()
    .then(function (name) {
      if (name) {
        sessionSet("displayName", name);
        showUserName(name);
      } else if (!saved) {
        showUserName(String(sessionGet("userEmail") || "").split("@")[0]);
      }
    })
    .catch(function () {
      if (!saved) showUserName(String(sessionGet("userEmail") || "").split("@")[0]);
    });
}

document.addEventListener("DOMContentLoaded", fillUserName);

// The bell in the top bar: a small count of unread notifications
async function showUnreadCount() {
  if (USE_DEMO_MODE || !sessionGet("authToken") || PAGE_ROLE === "admin") {
    return;
  }
  const bells = Array.from(document.querySelectorAll('header a[href*="Notifications.html"]'));
  if (bells.length === 0) {
    return;
  }
  let count = 0;
  try {
    const data = await apiRequest(ENDPOINTS.unreadNotifications);
    const list = Array.isArray(data) ? data : (data && (data.notifications || data.data)) || [];
    count = Array.isArray(list) ? list.filter(function (n) { return !(n.isRead || n.read || n.readAt); }).length : Number(data && data.count) || 0;
  } catch (error) {
    return;
  }
  if (!count) {
    return;
  }
  bells.forEach(function (bell) {
    bell.classList.add("relative");
    const badge = document.createElement("span");
    badge.className = "absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center";
    badge.textContent = count > 9 ? "9+" : String(count);
    bell.appendChild(badge);
  });
}

document.addEventListener("DOMContentLoaded", showUnreadCount);

// ==================================================
// 8. VERIFICATION BADGE (profile pages)
// ==================================================

// The badge text and colors for a verification status. "Verified" only when it really is.
function verificationBadge(status, kind) {
  const who = kind === "facility" ? "facility" : "professional";
  if (status === "verified") {
    return { text: "✓ Verified " + who, classes: "bg-green-50 text-green-700" };
  }
  if (status === "pending" || status === "resubmission") {
    return { text: "Verification in progress", classes: "bg-amber-50 text-amber-700" };
  }
  if (status === "rejected") {
    return { text: "Documents need attention", classes: "bg-red-50 text-red-600" };
  }
  return { text: "Not verified yet", classes: "bg-gray-100 text-gray-600" };
}

// Show a badge in an element (removes the old colors first)
function setBadge(element, status, kind) {
  if (!element) {
    return;
  }
  const badge = verificationBadge(status, kind);
  element.className = element.className
    .split(" ")
    .filter(function (c) { return !/^(bg|text)-(green|amber|red|gray)-/.test(c) && c !== "hidden"; })
    .join(" ") + " " + badge.classes;
  element.textContent = badge.text;
}
