// ====== BACKEND CONNECTION (translates between our pages and the Careporium backend) ======
// Needs /js/api.js to be loaded first. Load this file right after api.js on every page.
//
// WHY THIS FILE EXISTS
// The pages were built with their own names for things (e.g. "phone", "hourlyPay", "professional").
// The backend uses different names (e.g. "phoneNumber", "payRate", "worker").
// Every translation lives here, in one place. If the backend renames a field, only this file changes.
//
// The backend's answers look like { success, message, data }. apiRequest() in api.js already
// unwraps them, so the functions below receive what's inside "data".
//
// Where the backend's documentation doesn't say exactly which fields come back (it often just says
// "data"), these functions try the most likely names with pick(). Look for "CHECK:" comments:
// those are the places to confirm with the backend developer.

const Backend = {};

// ==================================================
// SMALL HELPERS
// ==================================================

// Read a value that might be stored under different names, e.g.
// pick(shift, ["facility.facilityName", "facilityName"]) → the first one that has a value.
function pick(object, names, fallback) {
  for (const name of names) {
    let value = object;
    for (const part of name.split(".")) {
      value = value === null || value === undefined ? undefined : value[part];
    }
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return fallback === undefined ? "" : fallback;
}

// The id of anything the backend sends (MongoDB uses "_id")
function idOf(item) {
  return pick(item, ["_id", "id"]);
}

// Make sure we have a list, even if the server wraps it, e.g. { shifts: [...] }
function asList(value, wrapperNames) {
  if (Array.isArray(value)) {
    return value;
  }
  for (const name of wrapperNames || []) {
    if (value && Array.isArray(value[name])) {
      return value[name];
    }
  }
  return [];
}

// Try the same request at several addresses, in order, until one exists on the server.
// (The Swagger file and the routes the backend actually has don't always match, so the Swagger
// address is tried first, then the alternatives seen in the backend's Postman collection.)
// Only "not found" answers (404, or 405 for a wrong method) move on to the next address.
// Each item is [path, method, body] (method and body optional: they default to the first item's).
async function apiFirst(attempts) {
  let lastError = null;
  const method0 = attempts[0][1] || "GET";
  const body0 = attempts[0][2];
  for (const attempt of attempts) {
    try {
      return await apiRequest(
        attempt[0],
        attempt[1] || method0,
        attempt.length > 2 ? attempt[2] : body0,
      );
    } catch (error) {
      if (error.status !== 404 && error.status !== 405) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
}

// "worker" (backend) ↔ "professional" (our pages)
function toUserType(role) {
  return role === "worker" ? "professional" : role;
}

// 30000 → "₦30,000"
function nairaText(amount) {
  return "₦" + Number(amount || 0).toLocaleString();
}

// "2026-10-20" → "Tue, 20 Oct"
function shortDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(String(value).slice(0, 10) + "T12:00:00");
  if (isNaN(date)) {
    return String(value);
  }
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// "2026-10-20" → "Tuesday, 20 October"
function longDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(String(value).slice(0, 10) + "T12:00:00");
  if (isNaN(date)) {
    return String(value);
  }
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// A time from the server, e.g. "2026-10-09T07:58:00.000Z" or "07:58" → "07:58 WAT"
function timeText(value) {
  if (!value) {
    return "";
  }
  if (/^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5) + " WAT";
  }
  const date = new Date(value);
  return isNaN(date)
    ? String(value)
    : date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      }) + " WAT";
}

// The logged-in user's id, saved at login
function myUserId() {
  return sessionGet("userId") || "";
}

// ==================================================
// THE SHIFT, AS THE BACKEND STORES IT
// ==================================================
// Field names from create-shift: profession, specialty, shiftDate, shiftType, startTime, endTime,
// professionalsNeeded, minimumExperience, location, responsibilities, reqCredentials,
// arrivalInstructions, payRate, isUrgent. Plus _id and status.

function shiftFacilityName(shift) {
  // CHECK: how the facility comes back with a shift (a populated "facility" object or just a name)
  return pick(
    shift,
    [
      "facility.facilityName",
      "facilityId.facilityName",
      "facilityName",
      "facility.name",
    ],
    "Healthcare facility",
  );
}

function shiftTitle(shift) {
  const profession = pick(shift, ["profession", "role"], "Shift");
  const specialty = pick(shift, ["specialty"]);
  return specialty ? profession + " · " + specialty : profession;
}

// How many hours, from "08:00" and "20:00" (a night shift can end the next day)
function shiftHours(shift) {
  const start = pick(shift, ["startTime"], "00:00").split(":");
  const end = pick(shift, ["endTime"], "00:00").split(":");
  let minutes =
    Number(end[0]) * 60 +
    Number(end[1]) -
    (Number(start[0]) * 60 + Number(start[1]));
  if (minutes <= 0) {
    minutes += 24 * 60;
  }
  return minutes / 60;
}

// CHECK: payRate is treated as the pay for ONE professional for the WHOLE shift (the example is
// 50,000 for 08:00–20:00). If it's an hourly rate, change the two lines marked "payRate" below.
function payForShift(shift) {
  return Number(pick(shift, ["payRate"], 0)); // payRate
}

function shiftTypeLabel(shift) {
  const type = pick(shift, ["shiftType", "workType"], "Day");
  return /shift/i.test(type) ? type : type + " shift";
}

// ==================================================
// 1. ACCOUNTS: sign up, email code, log in, passwords
// ==================================================

// The account type in the words our pages use: "professional", "facility" or "admin".
// Accepts the different ways a backend might write it ("worker", "Worker", "WORKER", "healthWorker"...).
// Gives back "" if it can't tell.
function normaliseRole(role) {
  const r = String(role || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (r.includes("admin")) return "admin";
  if (r.includes("facility") || r.includes("hospital") || r.includes("clinic"))
    return "facility";
  if (
    r.includes("worker") ||
    r.includes("professional") ||
    r.includes("nurse") ||
    r.includes("health")
  )
    return "professional";
  return "";
}

// Log in. Gives back what the login page needs: { token, userId, userType, emailConfirmed }.
Backend.login = async function (email, password) {
  const answer = await apiRequest(ENDPOINTS.login, "POST", {
    email: email,
    password: password,
  });

  // The Swagger file says { user, token }, but the answer might be wrapped once more
  // (e.g. { data: { user, token } }), so look in both places.
  const body =
    answer && answer.data && (answer.data.user || answer.data.token)
      ? answer.data
      : answer;
  const user = pick(body, ["user"], {});
  const token = pick(body, ["token", "accessToken", "jwt"]);

  let userType = normaliseRole(
    pick(
      user,
      ["role", "userType", "accountType", "type"],
      pick(body, ["role", "userType"]),
    ),
  );
  // CHECK: the user's id (the worker profile address needs it)
  let userId = pick(
    user,
    ["id", "_id", "userId"],
    pick(body, ["userId", "id", "_id"]),
  );

  // Still missing the account type or the id: ask the backend who just logged in
  if ((!userType || !userId) && token) {
    try {
      const profile = await apiRequest(ENDPOINTS.getProfile, "GET", null, {
        token: token,
      });
      console.info(
        "get-profile answer from the backend:",
        JSON.stringify(profile),
      );
      userType =
        userType ||
        normaliseRole(
          pick(profile, ["role", "user.role", "userType", "accountType"]),
        );
      userId =
        userId || pick(profile, ["id", "_id", "userId", "user._id", "user.id"]);
    } catch (error) {
      // leave them empty: the login page shows a clear message if the type is missing
    }
  }

  // Shown in the Console (F12), so we can see what the backend really sends at login.
  // (The token itself is left out.)
  console.info(
    "Login answer from the backend:",
    JSON.stringify(Object.assign({}, body, { token: token ? "(hidden)" : "" })),
  );

  return {
    token: token,
    userId: userId,
    userType: userType,
    // CHECK: isVerified is read as "the email address has been confirmed with the code"
    emailConfirmed: pick(user, ["isVerified"], true) !== false,
  };
};

// Save a logged-in session in the browser
Backend.saveSession = function (result, email) {
  // Saved for this role only (see "one login per role" in api.js), so logging in as another role
  // in the same browser doesn't log this one out
  const role = result.userType;
  try {
    localStorage.removeItem("displayName");
    localStorage.removeItem("displayName:" + role);
  } catch (error) {
    // ignore
  }
  sessionSet("authToken", result.token, role);
  sessionSet("userType", role, role);
  sessionSet("userId", result.userId, role);
  sessionSet("userEmail", email, role);
};

// The words a dropdown shows for its chosen value, e.g. "nurse" → "Nurse",
// "emergency" → "Emergency Medicine". The backend expects the words, not the hidden values.
function optionText(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select || !value) {
    return value || "";
  }
  const option = Array.from(select.options).find(function (o) {
    return o.value === value;
  });
  return option ? option.text.trim() : value;
}

// Health worker sign-up. "details" is what professionalProfile.js collects.
// Sent as JSON, with the same field names that worked in the backend's Swagger test:
// fullName, email, phoneNumber, password, profession, specialty, yearsOfExperience and
// location.address / location.city / location.state / location.country.
// (No documents at sign-up: they're uploaded later, from the credentials page.)
Backend.registerWorker = async function (details) {
  return await apiRequest(ENDPOINTS.registerProfessional, "POST", {
    fullName: details.fullName,
    email: details.email,
    phoneNumber: details.phone,
    password: details.password,
    profession: optionText("role", details.role),
    specialty: optionText("specialty", details.specialty),
    yearsOfExperience: Number(details.experience),
    "location.address": details.address,
    "location.city": details.city,
    "location.state": details.state,
    "location.country": details.country,
  });
};

// Facility sign-up (JSON, no documents: those are uploaded after logging in, from the
// registration page). "account" is what facilityProfile.js collects.
Backend.registerFacility = async function (account) {
  const body = {
    facilityName: account.facilityName,
    facilityType:
      account.facilityTypeLabel ||
      Backend.facilityTypeLabel(account.facilityType),
    email: account.businessEmail,
    phoneNumber: account.phone,
    password: account.password,
  };
  if (account.secondaryPhone) {
    body["secondaryContact.phoneNumber"] = account.secondaryPhone;
  }

  // TEMPORARY: the backend's database currently requires a location at sign-up (although the
  // Swagger file says it's optional), but the sign-up page doesn't ask for the address: it's
  // added on the registration page, with the documents, which replaces these placeholders.
  // Remove these 3 lines once the backend makes the location optional at sign-up.
  body["location.address"] = "To be provided";
  body["location.city"] = "To be provided";
  body["location.country"] = "Nigeria";

  return await apiRequest(ENDPOINTS.registerFacility, "POST", body);
};

// The logged-in facility's address and 3 documents (the registration page, after logging in).
// Also used to upload corrected documents after a rejection.
Backend.uploadFacilityDocuments = function (details, files) {
  const form = new FormData();
  if (details.facilityName) form.append("facilityName", details.facilityName);
  form.append("locationAddress", details.street);
  form.append("locationCity", details.city);
  form.append("locationState", details.state);
  form.append("locationCountry", details.country);
  form.append("businessRegCert", files.registrationDoc);
  form.append("facilityLicense", files.licenseDoc);
  form.append("taxID", files.tinDoc);
  return apiRequest(ENDPOINTS.facilityProfileUpdate, "PUT", form);
};

Backend.verifyAccount = function (email, code) {
  return apiRequest(ENDPOINTS.verifyAccount, "POST", {
    email: email,
    otp: code,
  });
};

Backend.resendAccountCode = function (email) {
  return apiRequest(ENDPOINTS.resendAccountCode, "POST", { email: email });
};

// Password reset: 1. send the code, 2. check it (gives a reset token), 3. save the new password
Backend.forgotPassword = function (email) {
  return apiRequest(ENDPOINTS.passwordForgot, "POST", { email: email });
};

Backend.verifyResetCode = async function (code) {
  const data = await apiRequest(ENDPOINTS.passwordVerifyCode, "POST", {
    otp: code,
  });
  return data.resetToken;
};

Backend.resendResetCode = function (email) {
  return apiRequest(ENDPOINTS.passwordResendCode, "POST", { email: email });
};

// The reset token goes in the Authorization header (not the normal login token)
Backend.resetPassword = function (resetToken, newPassword) {
  return apiRequest(
    ENDPOINTS.passwordReset,
    "POST",
    { newPassword: newPassword },
    { token: resetToken },
  );
};

// ==================================================
// 2. PROFILES, DOCUMENTS AND VERIFICATION STATUS
// ==================================================
// The backend has no separate "verification status" endpoint, so we read the worker or facility
// profile and work it out from the documents.
//
// IMPORTANT: different endpoints can send the same profile in different shapes, e.g. the worker's
// own profile might be { professionalLicense: {...} } while the admin endpoint sends
// { worker: { documents: { professionalLicense: {...} } } } or a list of documents.
// Everything below looks in all of those places, so the worker, the facility and the admin always
// see the same documents.

const WORKER_DOCUMENTS = {
  professionalLicense: "Professional licence",
  idDocument: "ID document",
  educationCert: "Education certificate",
  proofOfLocation: "Proof of address",
};
const FACILITY_DOCUMENTS = {
  businessRegCert: "Business registration certificate",
  facilityLicense: "Facility licence",
  taxID: "Tax identification document",
};

// Other spellings the backend might use for the same document
const DOCUMENT_ALIASES = {
  professionalLicense: [
    "professionalLicense",
    "professionalLicence",
    "professional_license",
  ],
  idDocument: [
    "idDocument",
    "id_document",
    "identityDocument",
    "governmentId",
    "idCard",
  ],
  educationCert: [
    "educationCert",
    "educationCertificate",
    "education_cert",
    "educationalCertificate",
  ],
  proofOfLocation: [
    "proofOfLocation",
    "proofOfAddress",
    "proof_of_location",
    "addressProof",
  ],
  businessRegCert: [
    "businessRegCert",
    "businessRegistrationCertificate",
    "business_reg_cert",
    "cacCertificate",
  ],
  facilityLicense: [
    "facilityLicense",
    "facilityLicence",
    "facility_license",
    "operatingLicense",
  ],
  taxID: ["taxID", "taxId", "tax_id", "taxIdentification"],
};

// Where a list or object of documents might sit inside a profile
const DOCUMENT_CONTAINERS = [
  "documents",
  "verificationDocuments",
  "credentials",
  "docs",
  "uploads",
  "files",
];

// Does this object look like a worker (or facility) profile?
function looksLikeProfile(object, kind) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    return false;
  }
  const keys =
    kind === "facility"
      ? ["facilityName", "facilityType"].concat(Object.keys(FACILITY_DOCUMENTS))
      : ["profession", "specialty", "yearsOfExperience"].concat(
          Object.keys(WORKER_DOCUMENTS),
        );
  return (
    keys.some(function (key) {
      return key in object;
    }) ||
    DOCUMENT_CONTAINERS.some(function (key) {
      return object[key] && typeof object[key] === "object";
    })
  );
}

// Take the profile out of whatever the server wrapped it in, e.g. { worker: {...} } or [ {...} ]
function unwrapProfile(data, kind) {
  if (Array.isArray(data)) {
    data = data[0] || {};
  }
  if (!data || typeof data !== "object") {
    return {};
  }
  if (looksLikeProfile(data, kind)) {
    return data;
  }
  const wrappers =
    kind === "facility"
      ? ["facility", "facilityProfile", "profile", "data", "result", "user"]
      : ["worker", "workerProfile", "profile", "data", "result", "user"];
  for (const outer of wrappers) {
    const inner = Array.isArray(data[outer]) ? data[outer][0] : data[outer];
    if (looksLikeProfile(inner, kind)) {
      return inner;
    }
    for (const second of wrappers) {
      if (inner && looksLikeProfile(inner[second], kind)) {
        return inner[second];
      }
    }
  }
  return data;
}

// The id inside a field that may be an id or a populated object
function idValue(value) {
  if (value && typeof value === "object") {
    return idOf(value);
  }
  return value || "";
}

// "Verified", "approved", "UNDER_REVIEW"... → "verified" | "rejected" | "pending" | "not_submitted" | ""
function normaliseStatus(value) {
  const s = String(value || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!s) return "";
  if (["verified", "approved", "accepted", "valid"].includes(s))
    return "verified";
  if (["rejected", "declined", "invalid", "failed"].includes(s))
    return "rejected";
  if (["resubmission", "resubmitted"].includes(s)) return "resubmission";
  if (
    [
      "pending",
      "submitted",
      "underreview",
      "inreview",
      "awaitingreview",
      "awaitingverification",
      "processing",
    ].includes(s)
  )
    return "pending";
  if (
    [
      "notsubmitted",
      "notuploaded",
      "missing",
      "unverified",
      "none",
      "incomplete",
    ].includes(s)
  )
    return "not_submitted";
  return "";
}

// Is this list item the document we're looking for? (e.g. { documentType: "idDocument", url })
function documentItemMatches(item, aliases) {
  if (!item || typeof item !== "object") return false;
  const name = String(
    pick(item, [
      "documentType",
      "type",
      "name",
      "key",
      "fieldname",
      "fieldName",
      "docType",
    ]),
  ).toLowerCase();
  return aliases.some(function (alias) {
    return alias.toLowerCase() === name;
  });
}

// Find one document's raw value in a profile, wherever it is
function findRawDocument(profile, key) {
  const aliases = DOCUMENT_ALIASES[key] || [key];
  if (!profile || typeof profile !== "object") {
    return null;
  }

  // 1. The usual places: profile.key, profile.documents.key, or a list of documents
  const containers = [profile].concat(
    DOCUMENT_CONTAINERS.map(function (c) {
      return profile[c];
    }),
  );
  for (const container of containers) {
    if (!container || typeof container !== "object") continue;
    if (Array.isArray(container)) {
      const found = container.find(function (item) {
        return documentItemMatches(item, aliases);
      });
      if (found) return found;
      continue;
    }
    for (const alias of aliases) {
      if (
        container[alias] !== undefined &&
        container[alias] !== null &&
        container[alias] !== ""
      ) {
        return container[alias];
      }
    }
  }

  // 2. Anywhere deeper (up to 4 levels), in case the backend nests it differently
  const seen = new Set();
  function search(value, depth) {
    if (!value || typeof value !== "object" || depth > 4 || seen.has(value))
      return null;
    seen.add(value);
    if (Array.isArray(value)) {
      const found = value.find(function (item) {
        return documentItemMatches(item, aliases);
      });
      if (found) return found;
      for (const item of value) {
        const deeper = search(item, depth + 1);
        if (deeper) return deeper;
      }
      return null;
    }
    for (const alias of [key]) {
      if (
        value[alias] !== undefined &&
        value[alias] !== null &&
        value[alias] !== ""
      )
        return value[alias];
    }
    for (const name of Object.keys(value)) {
      if (name === "password" || name === "otp") continue;
      const deeper = search(value[name], depth + 1);
      if (deeper) return deeper;
    }
    return null;
  }
  return search(profile, 0);
}

// One document from a profile: { url, status, comment, uploaded }
function documentOf(profile, key) {
  const doc = findRawDocument(profile, key);
  if (!doc) {
    return null;
  }
  if (typeof doc === "string") {
    // A plain text value only counts when it looks like a file address (not, say, a licence number)
    if (!/^(https?:)?\/\/|^\/|\.(pdf|png|jpe?g|webp|heic)$/i.test(doc)) {
      return null;
    }
    return { url: doc, status: "pending", comment: "", uploaded: true };
  }
  if (typeof doc !== "object") {
    return null;
  }
  let url = "";
  for (const name of [
    "url",
    "documentUrl",
    "fileUrl",
    "secure_url",
    "secureUrl",
    "link",
    "path",
    "location",
    "file.url",
    "file.secure_url",
    "file",
  ]) {
    const value = pick(doc, [name]);
    if (typeof value === "string" && value) {
      url = value;
      break;
    }
  }
  let status = normaliseStatus(
    pick(doc, [
      "verificationStatus",
      "documentVerificationStatus",
      "status",
      "verification.status",
      "reviewStatus",
    ]),
  );
  if (status === "resubmission") status = "pending";
  const touched = status === "verified" || status === "rejected";
  if (!url && !touched) {
    return { url: "", status: "missing", comment: "", uploaded: false };
  }
  return {
    url: url,
    status: status && status !== "not_submitted" ? status : "pending",
    comment: pick(doc, [
      "verificationComment",
      "comment",
      "rejectionReason",
      "reason",
    ]),
    uploaded: true,
  };
}

function documentsOf(profile, labels) {
  return Object.keys(labels).map(function (key) {
    return Object.assign(
      { key: key, label: labels[key] },
      documentOf(profile, key) || {
        url: "",
        status: "missing",
        comment: "",
        uploaded: false,
      },
    );
  });
}

// The overall status from the profile's own field (if any) and its documents
function overallStatusOf(profile, docs) {
  const field = normaliseStatus(
    pick(profile, [
      "verificationStatus",
      "overallVerificationStatus",
      "overallStatus",
      "verification.status",
      "verification.overallStatus",
      "profileStatus",
    ]),
  );
  const uploaded = docs.filter(function (d) {
    return d.uploaded;
  });
  if (
    docs.length > 0 &&
    docs.every(function (d) {
      return d.status === "verified";
    })
  )
    return "verified";
  if (field === "verified") return "verified";
  if (
    docs.some(function (d) {
      return d.status === "rejected";
    }) ||
    field === "rejected"
  )
    return "rejected";
  if (uploaded.length === 0) return "not_submitted";
  return field === "resubmission" ? "resubmission" : "pending";
}

// Do we know anything about this person's verification? (used for applicants, where the
// backend may not send the documents at all)
function hasVerificationInfo(profile, docs) {
  return (
    docs.some(function (d) {
      return d.uploaded;
    }) ||
    normaliseStatus(
      pick(profile, [
        "verificationStatus",
        "overallVerificationStatus",
        "overallStatus",
        "verification.status",
      ]),
    ) !== ""
  );
}

// A person's name from a worker profile (or the user inside it)
function workerNameOf(p) {
  return String(
    pick(
      p,
      ["fullName", "user.fullName", "name", "user.name", "userId.fullName"],
      "",
    ),
  ).trim();
}

// "Ada Okafor" → "AO"
function initialsOf(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(function (w) {
      return w.charAt(0);
    })
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// The logged-in worker's or facility's profile, unwrapped. Asked for once per page.
let myProfileRequest = null;

async function loadMyProfile() {
  const type = sessionGet("userType");
  if (type === "facility") {
    return unwrapProfile(
      await apiRequest(ENDPOINTS.facilityProfile),
      "facility",
    );
  }
  // get-worker-profile (from the token), or get-worker-profile/{userId} as in one Swagger version.
  // Last resort: get-profile (the account only, without documents).
  let profile = null;
  // (The latest Postman collection uses the address without an id, from the login token.)
  const addresses = [ENDPOINTS.workerOwnProfile()].concat(
    myUserId() ? [ENDPOINTS.workerOwnProfile(myUserId())] : [],
  );
  for (const address of addresses) {
    try {
      profile = await apiRequest(address);
      break;
    } catch (error) {
      if (error.status !== 404 && error.status !== 400) {
        throw error;
      }
    }
  }
  if (profile === null) {
    console.warn(
      "get-worker-profile isn't available on the server (404), so get-profile is used instead.",
    );
    profile = await apiRequest(ENDPOINTS.getProfile);
  }
  // Shown in the Console (F12), so we can check the field names the backend really uses
  console.info("Worker profile from the backend:", JSON.stringify(profile));
  return unwrapProfile(profile, "worker");
}

Backend.myProfile = function () {
  if (myProfileRequest === null) {
    myProfileRequest = loadMyProfile().catch(function (error) {
      myProfileRequest = null; // try again next time
      throw error;
    });
  }
  return myProfileRequest;
};

// The name for the top-right corner of every worker / facility page
Backend.displayName = async function () {
  const type = sessionGet("userType");
  const profile = await Backend.myProfile();
  if (type === "facility") {
    return String(
      pick(profile, ["facilityName", "name", "user.fullName"], ""),
    ).trim();
  }
  return workerNameOf(profile);
};

// Gives back { status, feedback, welcome, documents } in the shape the pages use (see api.js)
Backend.verificationStatus = async function () {
  const type = sessionGet("userType");
  const profile = await Backend.myProfile();
  const docs = documentsOf(
    profile,
    type === "facility" ? FACILITY_DOCUMENTS : WORKER_DOCUMENTS,
  );
  const status = overallStatusOf(profile, docs);
  const rejected = docs.filter(function (d) {
    return d.status === "rejected";
  });

  const name =
    type === "facility"
      ? pick(profile, ["facilityName", "name"])
      : workerNameOf(profile).split(" ")[0];

  return {
    status: status,
    documents: docs,
    feedback: rejected
      .map(function (d) {
        return d.label + ": " + (d.comment || "needs to be uploaded again");
      })
      .join(" "),
    welcome: name ? "Welcome, " + name + "." : "Welcome.",
  };
};

// PUT the worker's profile form: update-worker-profile/{userId} on the newest server,
// update-worker-profile (from the token) on the older one
async function putWorkerProfile(form) {
  // Latest Postman collection: no id (the login token says whose). One Swagger version: /{userId}.
  try {
    return await apiRequest(ENDPOINTS.workerProfileUpdate(), "PUT", form);
  } catch (error) {
    if (error.status !== 404 || !myUserId()) {
      throw error;
    }
  }
  return await apiRequest(
    ENDPOINTS.workerProfileUpdate(myUserId()),
    "PUT",
    form,
  );
}

// Health worker documents (from the credentials page)
Backend.uploadWorkerDocuments = function (files) {
  const form = new FormData();
  form.append("professionalLicense", files.licence);
  form.append("idDocument", files.id);
  form.append("educationCert", files.education);
  form.append("proofOfLocation", files.address);
  return putWorkerProfile(form);
};

// The worker's "Edit professional profile" form → the backend (multipart, the Swagger field names)
Backend.saveWorkerProfile = function (details) {
  const form = new FormData();
  Object.keys(details).forEach(function (key) {
    if (
      details[key] !== undefined &&
      details[key] !== null &&
      details[key] !== ""
    ) {
      form.append(key, details[key]);
    }
  });
  myProfileRequest = null;
  return putWorkerProfile(form);
};

// ==================================================
// 3. HEALTH WORKER: profile, shifts, applications
// ==================================================

// The worker's own profile page (data-field names on WorkerShiftMarket/Profile.html)
Backend.workerOwnProfile = async function () {
  const p = await Backend.myProfile();
  const name = workerNameOf(p);
  const years = pick(p, ["yearsOfExperience"], "");
  const docs = documentsOf(p, WORKER_DOCUMENTS);
  const status = overallStatusOf(p, docs);
  const docStatus = function (key) {
    const d = docs.find(function (x) {
      return x.key === key;
    });
    return d.status === "missing"
      ? "Not uploaded"
      : d.status.charAt(0).toUpperCase() + d.status.slice(1);
  };
  const verifiedCount = docs.filter(function (d) {
    return d.status === "verified";
  }).length;
  const loc = pick(p, ["location"], {});
  const place = [pick(loc, ["city", "street"]), pick(loc, ["state"])]
    .filter(Boolean)
    .join(", ");
  return {
    status: status,
    raw: p,
    initials: initialsOf(name),
    name: name,
    headline: [
      pick(p, ["profession"]),
      pick(p, ["specialty"]),
      pick(loc, ["state", "city"]),
    ]
      .filter(Boolean)
      .join(" · "),
    about: pick(
      p,
      ["about", "bio"],
      "Add a short introduction to your profile.",
    ),
    licence: "Professional licence · " + docStatus("professionalLicense"),
    specialty: pick(p, ["specialty"], "—"),
    experience:
      years === "" ? "—" : years + (Number(years) === 1 ? " year" : " years"),
    searchArea: place || pick(loc, ["address"], "—"),
    identityStatus: docStatus("idDocument"),
    licenceStatus: docStatus("professionalLicense"),
    certificates: docStatus("educationCert"),
    lastReviewed: verifiedCount + " of " + docs.length + " documents verified",
  };
};

// One shift card for Find shifts / the worker dashboard
function shiftCard(shift) {
  const urgent = pick(shift, ["isUrgent"], false) === true;
  const pay = payForShift(shift);
  return {
    id: idOf(shift),
    title: shiftTitle(shift),
    badge: urgent ? "Urgent" : "",
    badgeColor: "amber",
    facility: shiftFacilityName(shift),
    facilityId: pick(
      shift,
      ["facility._id", "facilityId._id", "facilityId", "facility"],
      "",
    ),
    when:
      shortDate(pick(shift, ["shiftDate", "date"])) +
      " · " +
      pick(shift, ["startTime"]) +
      "–" +
      pick(shift, ["endTime"]) +
      " WAT · " +
      pick(shift, ["location"], ""),
    pay: nairaText(pay) + " for the shift",
    payPerHour: Math.round(pay / shiftHours(shift)),
    type: shiftTypeLabel(shift),
  };
}

// Find shifts. Only open shifts are asked for; every other filter (profession, specialty,
// location, date, type, minimum pay, search text) is applied here, so it works whatever
// the server does with extra query parameters. Shifts that have already ended are left out.
Backend.searchShifts = async function (filters) {
  filters = filters || {};
  const answers = await Promise.all([
    apiRequest(
      ENDPOINTS.searchShifts +
        "?" +
        new URLSearchParams({ status: "open" }).toString(),
    ),
    Backend.myAppliedShifts().catch(function () {
      return {};
    }),
  ]);
  const shifts = asList(answers[0], ["shifts", "data"]);
  const applied = answers[1];
  const any = function (value) {
    return !value || /^(all|any)\b/i.test(value);
  };
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  });
  const daysAhead = { Today: 0, "Next 7 days": 7, "Next 30 days": 30 }[
    filters.date
  ];
  const now = new Date();
  return shifts
    .filter(function (s) {
      const status = String(pick(s, ["status"], "open")).toLowerCase();
      if (
        ["closed", "cancelled", "canceled", "completed", "filled"].includes(
          status,
        )
      )
        return false;
      if (isAwaitingPayment(s)) return false; // not funded yet: not live for workers
      if (shiftTimes(s).end <= now) return false;
      if (
        !any(filters.profession) &&
        String(pick(s, ["profession", "role"])).toLowerCase() !==
          filters.profession.toLowerCase()
      )
        return false;
      if (
        !any(filters.specialty) &&
        String(pick(s, ["specialty"])).toLowerCase() !==
          filters.specialty.toLowerCase()
      )
        return false;
      if (
        !any(filters.location) &&
        !String(pick(s, ["location"]))
          .toLowerCase()
          .includes(filters.location.split(" · ")[0].toLowerCase())
      )
        return false;
      if (daysAhead !== undefined) {
        const day = String(pick(s, ["shiftDate", "date"])).slice(0, 10);
        const last = new Date(
          Date.now() + daysAhead * 86400000,
        ).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
        if (day < today || day > last) return false;
      }
      return true;
    })
    .sort(function (a, b) {
      return shiftTimes(a).start - shiftTimes(b).start;
    })
    .map(function (s) {
      const card = shiftCard(s);
      card.applied = applied[card.id] || "";
      if (card.applied) {
        card.badge =
          card.applied === "Accepted"
            ? "Booked"
            : card.applied === "Not selected"
              ? "Not selected"
              : "Applied";
        card.badgeColor = card.applied === "Not selected" ? "gray" : "green";
      }
      return card;
    })
    .filter(function (card) {
      const text = (
        card.title +
        " " +
        card.facility +
        " " +
        card.when
      ).toLowerCase();
      if (filters.search && !text.includes(filters.search.toLowerCase()))
        return false;
      if (
        !any(filters.type) &&
        card.type.toLowerCase() !== filters.type.toLowerCase()
      )
        return false;
      if (filters.minPay && card.payPerHour < Number(filters.minPay))
        return false;
      return true;
    });
};

// One shift for the worker's Shift details and Review application pages
Backend.shiftForWorker = async function (shiftId) {
  const s = unwrapShift(await apiRequest(ENDPOINTS.shift(shiftId)));
  const pay = payForShift(s);
  const when =
    longDate(pick(s, ["shiftDate", "date"])) +
    " · " +
    pick(s, ["startTime"]) +
    "–" +
    pick(s, ["endTime"]) +
    " WAT · " +
    shiftTypeLabel(s);
  return {
    title: shiftTitle(s),
    facility: shiftFacilityName(s),
    facilityLine: shiftFacilityName(s) + " · " + pick(s, ["location"]),
    about: [
      pick(s, ["responsibilities", "description"]),
      pick(s, ["reqCredentials"])
        ? "Credentials: " + pick(s, ["reqCredentials"])
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    when: when,
    location:
      pick(s, ["location"]) +
      (pick(s, ["arrivalInstructions"])
        ? " · " + pick(s, ["arrivalInstructions"])
        : ""),
    pay: nairaText(pay) + " for the shift",
    totalPay: nairaText(pay),
    payNote: "For the whole shift · " + Math.round(shiftHours(s)) + " hours",
    closes: pick(s, ["minimumExperience"])
      ? "Minimum experience: " + pick(s, ["minimumExperience"])
      : "",
    professional: sessionGet("displayName") || "",
    licence: pick(s, ["reqCredentials"]),
    availability: when,
  };
};

// Apply for a shift. (The backend doesn't take a message yet, so the message isn't sent.)
Backend.applyToShift = async function (shiftId) {
  const result = await apiRequest(ENDPOINTS.applyToShift(shiftId), "POST");
  rememberApplied(shiftId);
  const now = new Date();
  return {
    reference: idOf(result || {}) || "Submitted",
    submitted:
      now.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) +
      " · " +
      timeText(now.toISOString()),
    status: "Under review",
    facility: "",
  };
};

// Backend application status → the 4 texts My applications uses
function applicationStatusText(status) {
  const s = String(status || "").toLowerCase();
  if (
    [
      "accepted",
      "approved",
      "hired",
      "booked",
      "confirmed",
      "completed",
    ].includes(s)
  )
    return "Accepted";
  if (
    ["rejected", "declined", "cancelled", "canceled", "withdrawn"].includes(s)
  )
    return "Not selected";
  return "Under review";
}

// The shift an application belongs to (populated by the server, or fetched by withShifts below)
function applicationShift(app) {
  if (app && app._shift) {
    return app._shift;
  }
  const s = pick(app, ["shift", "shiftId", "shiftDetails"], {});
  return typeof s === "object" ? s : {};
}

// The shift's id, whether the server sent the whole shift or just its id
function applicationShiftId(app) {
  return (
    idOf(applicationShift(app)) || idValue(pick(app, ["shiftId", "shift"]))
  );
}

// If the server sent only shift ids, fetch those shifts (once each) so the pages can show them.
// knownShifts (optional): shifts we already have, e.g. the facility's own list
async function withShifts(apps, knownShifts) {
  const byId = {};
  (knownShifts || []).forEach(function (shift) {
    byId[idOf(shift)] = shift;
  });
  const missing = [];
  apps.forEach(function (app) {
    if (!idOf(applicationShift(app))) {
      const id = applicationShiftId(app);
      if (id && !byId[id] && !missing.includes(id)) missing.push(id);
    }
  });
  await Promise.all(
    missing.map(async function (id) {
      try {
        byId[id] = unwrapShift(await apiRequest(ENDPOINTS.shift(id)));
      } catch (error) {
        // leave it out; the page shows what it can
      }
    }),
  );
  apps.forEach(function (app) {
    if (!idOf(applicationShift(app))) {
      const id = applicationShiftId(app);
      if (byId[id]) app._shift = byId[id];
    }
  });
  return apps;
}

// A shift from get-shift may come as { shift: {...} }
function unwrapShift(data) {
  if (data && !data.startTime && data.shift && typeof data.shift === "object") {
    return data.shift;
  }
  return data || {};
}

// The start and end of a shift as dates (times are WAT; a night shift can end the next day)
function shiftTimes(s) {
  const day = String(pick(s, ["shiftDate", "date"])).slice(0, 10);
  const start = new Date(
    day + "T" + pick(s, ["startTime"], "00:00").slice(0, 5) + ":00+01:00",
  );
  let end = new Date(
    day + "T" + pick(s, ["endTime"], "00:00").slice(0, 5) + ":00+01:00",
  );
  if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000);
  return { day: day, start: start, end: end };
}

async function loadMyApplicationsRaw() {
  const apps = asList(await apiRequest(ENDPOINTS.myApplications), [
    "applications",
    "data",
  ]);
  return await withShifts(apps);
}

Backend.myApplications = async function () {
  const apps = await loadMyApplicationsRaw();
  return apps.map(function (app) {
    const s = applicationShift(app);
    return {
      id: idOf(app),
      title: shiftTitle(s),
      status: applicationStatusText(pick(app, ["status"])),
      shiftId: applicationShiftId(app),
      details:
        shiftFacilityName(s) +
        " · " +
        shortDate(pick(s, ["shiftDate", "date"])) +
        " · " +
        pick(s, ["startTime"]) +
        "–" +
        pick(s, ["endTime"]) +
        " WAT",
    };
  });
};

// The shifts this worker has already applied for: { shiftId: "Under review" | "Accepted" | "Not selected" }
// (also remembers applications made in this browser, in case the list is a moment behind)
Backend.myAppliedShifts = async function () {
  const applied = {};
  try {
    JSON.parse(sessionStorage.getItem("appliedShifts") || "[]").forEach(
      function (id) {
        applied[id] = "Under review";
      },
    );
  } catch (error) {
    // ignore
  }
  const apps = asList(await apiRequest(ENDPOINTS.myApplications), [
    "applications",
    "data",
  ]);
  apps.forEach(function (app) {
    const id = applicationShiftId(app);
    if (id) applied[id] = applicationStatusText(pick(app, ["status"]));
  });
  return applied;
};

function rememberApplied(shiftId) {
  try {
    const list = JSON.parse(sessionStorage.getItem("appliedShifts") || "[]");
    if (!list.includes(shiftId)) list.push(shiftId);
    sessionStorage.setItem("appliedShifts", JSON.stringify(list));
  } catch (error) {
    // ignore
  }
}

// The verified worker dashboard, put together from the applications and the open shifts
Backend.workerDashboard = async function () {
  const results = await Promise.all([
    loadMyApplicationsRaw(),
    Backend.searchShifts({}).catch(function () {
      return [];
    }),
    Backend.myProfile().catch(function () {
      return {};
    }),
  ]);
  const apps = results[0];
  const openShifts = results[1];
  const profile = results[2];
  const now = new Date();

  const booked = apps
    .filter(function (a) {
      return applicationStatusText(pick(a, ["status"])) === "Accepted";
    })
    .map(function (a) {
      return applicationShift(a);
    })
    .filter(function (s) {
      return (
        idOf(s) &&
        String(pick(s, ["status"])) !== "completed" &&
        shiftTimes(s).end > now
      );
    })
    .sort(function (a, b) {
      return shiftTimes(a).start - shiftTimes(b).start;
    });
  const next = booked[0] || null;

  const appliedIds = apps.map(applicationShiftId);
  const recommended =
    openShifts.find(function (card) {
      return !appliedIds.includes(card.id);
    }) || null;

  const hour = Number(
    now.toLocaleString("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Africa/Lagos",
    }),
  );
  const part =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = workerNameOf(profile).split(" ")[0];
  const count = function (text) {
    const n = apps.filter(function (a) {
      return applicationStatusText(pick(a, ["status"])) === text;
    }).length;
    return n + (n === 1 ? " application" : " applications");
  };

  return {
    greeting: part + (firstName ? ", " + firstName : "") + ".",
    underReviewCount: count("Under review"),
    acceptedCount: count("Accepted"),
    nextShift: next
      ? {
          id: idOf(next),
          nextShiftTitle: shiftTitle(next),
          nextShiftPlace:
            shiftFacilityName(next) + " · " + pick(next, ["location"]),
          nextShiftWhen:
            longDate(pick(next, ["shiftDate", "date"])) +
            " · " +
            pick(next, ["startTime"]) +
            "–" +
            pick(next, ["endTime"]) +
            " WAT",
          nextShiftNote: pick(
            next,
            ["arrivalInstructions"],
            "Your booking is confirmed.",
          ),
        }
      : null,
    recommended: recommended,
  };
};

// ==================================================
// 4. HEALTH WORKER: the shift page (clock in / clock out)
// ==================================================
// The backend has no single "my shift" endpoint yet, so we put it together:
// the worker's accepted application + the shift. Clock-in and clock-out times are remembered in the
// browser (the backend doesn't send them back yet).

function attendanceKey(shiftId) {
  return "attendance:" + myUserId() + ":" + shiftId;
}

function savedAttendance(shiftId) {
  return JSON.parse(localStorage.getItem(attendanceKey(shiftId)) || "{}");
}

// Clock-in / clock-out times, if the server sends them with the application (several likely names)
function attendanceFromServer(app) {
  if (!app || typeof app !== "object") return null;
  const names = {
    clockIn: [
      "clockInTime",
      "clockIn",
      "clockedInAt",
      "attendance.clockInTime",
      "attendance.clockIn",
      "attendance.clockedInAt",
    ],
    clockOut: [
      "clockOutTime",
      "clockOut",
      "clockedOutAt",
      "attendance.clockOutTime",
      "attendance.clockOut",
      "attendance.clockedOutAt",
    ],
  };
  const known = names.clockIn.concat(names.clockOut).some(function (name) {
    let value = app;
    for (const part of name.split("."))
      value = value === null || value === undefined ? undefined : value[part];
    return value !== undefined;
  });
  if (!known) return null;
  const inAt = pick(app, names.clockIn);
  const outAt = pick(app, names.clockOut);
  return {
    clockIn: inAt ? timeText(inAt) : "",
    clockInAt: inAt && !/^\d{2}:\d{2}/.test(inAt) ? inAt : "",
    clockOut: outAt ? timeText(outAt) : "",
    clockOutAt: outAt && !/^\d{2}:\d{2}/.test(outAt) ? outAt : "",
  };
}

Backend.workerShift = async function (shiftId) {
  const apps = await loadMyApplicationsRaw();
  const accepted = apps.filter(function (a) {
    return applicationStatusText(pick(a, ["status"])) === "Accepted";
  });
  const now = new Date();
  let app = shiftId
    ? accepted.find(function (a) {
        return applicationShiftId(a) === shiftId;
      })
    : accepted
        .filter(function (a) {
          const sh = applicationShift(a);
          return (
            String(pick(sh, ["status"])) !== "completed" &&
            (!idOf(sh) || shiftTimes(sh).end > now)
          );
        })
        .sort(function (a, b) {
          return (
            shiftTimes(applicationShift(a)).start -
            shiftTimes(applicationShift(b)).start
          );
        })[0] ||
      // nothing still to come: show the most recent booked shift (so "completed" can be seen)
      accepted.slice().sort(function (a, b) {
        return (
          shiftTimes(applicationShift(b)).start -
          shiftTimes(applicationShift(a)).start
        );
      })[0];
  if (!app) {
    return null; // no booked shift
  }

  const id = applicationShiftId(app);
  const s = unwrapShift(await apiRequest(ENDPOINTS.shift(id)));
  // The server's attendance (if it sends it) wins over what this browser remembers
  const att = Object.assign({}, savedAttendance(id));
  const server = attendanceFromServer(app);
  if (server) {
    if (server.clockIn) {
      att.clockIn = server.clockIn;
      att.clockInAt = server.clockInAt || att.clockInAt;
    }
    if (server.clockOut) {
      att.clockOut = server.clockOut;
      att.clockOutAt = server.clockOutAt || att.clockOutAt;
    }
  }

  // The time rules (clock-in opens 30 minutes before the start, etc.)
  const times = shiftTimes(s);
  const day = times.day;
  const start = times.start;
  const end = times.end;
  const opens = new Date(
    start.getTime() - SHIFT_RULES_LIVE.clockInOpensBefore * 60000,
  );

  let attendance = "none";
  if (att.clockIn) attendance = "working";
  if (att.clockOut) attendance = "completed";
  if (String(pick(s, ["status"])) === "completed" && att.clockIn)
    attendance = "completed";

  let recorded = "";
  if (att.clockInAt && att.clockOutAt) {
    const minutes = Math.max(
      0,
      Math.round((new Date(att.clockOutAt) - new Date(att.clockInAt)) / 60000),
    );
    recorded =
      Math.floor(minutes / 60) + " hours " + (minutes % 60) + " minutes";
  }

  return {
    id: id,
    title: shiftTitle(s),
    facilityLine: shiftFacilityName(s) + " · " + pick(s, ["location"]),
    facilityName: shiftFacilityName(s),
    whenLine:
      longDate(day) +
      " · " +
      pick(s, ["startTime"]) +
      "–" +
      pick(s, ["endTime"]) +
      " WAT · Shift " +
      String(id).slice(-6).toUpperCase(),
    payLine: nairaText(payForShift(s)) + " for the shift",
    arrival: pick(
      s,
      ["arrivalInstructions"],
      "Please arrive a little before your shift starts.",
    ),
    offer: "accepted", // the facility accepted the application, so the shift is booked
    offerExpiresIn: "",
    attendance: attendance,
    clockIn: att.clockIn || "",
    clockOut: att.clockOut || "",
    recordedTime: recorded,
    fixReason: "",
    clockInOpensAt:
      opens.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      }) +
      " WAT, " +
      shortDate(day),
    clockInOpen: now >= opens && now < end,
    ended: now >= end || String(pick(s, ["status"])) === "completed",
    clockOutMissing:
      attendance === "working" &&
      now - end > SHIFT_RULES_LIVE.clockOutMissingAfter * 60000,
  };
};

// The time rules used above (the same values as in shifts.js)
const SHIFT_RULES_LIVE = { clockInOpensBefore: 30, clockOutMissingAfter: 120 };

// Turn the backend's refusal message into one of the error screens the worker page has
function clockReason(message) {
  const m = String(message || "").toLowerCase();
  if (m.includes("expire")) return "expired";
  if (m.includes("already")) return "already_clocked_in";
  if (m.includes("not started") || m.includes("early") || m.includes("not yet"))
    return "too_early";
  if (m.includes("ended") || m.includes("over") || m.includes("closed"))
    return "ended";
  if (m.includes("invalid") || m.includes("match") || m.includes("not found"))
    return "wrong_shift";
  return "";
}

// Clock in with the scanned QR. Remembers the QR so clock-out can reuse it (the backend wants
// a QR token for clock-out too). Gives back the updated shift.
Backend.clockIn = async function (shiftId, qrToken) {
  try {
    await apiRequest(ENDPOINTS.clockIn, "POST", { qrToken: qrToken });
  } catch (error) {
    error.reason = error.reason || clockReason(error.message);
    throw error;
  }
  const now = new Date();
  localStorage.setItem(
    attendanceKey(shiftId),
    JSON.stringify({
      clockIn: timeText(now.toISOString()),
      clockInAt: now.toISOString(),
      qrToken: qrToken,
    }),
  );
  return await Backend.workerShift(shiftId);
};

// Clock out. Uses the QR scanned at clock-in; if the backend refuses it (e.g. it has expired),
// the page asks the worker to scan the QR again and passes the new one here.
Backend.clockOut = async function (shiftId, newQrToken) {
  const att = savedAttendance(shiftId);
  try {
    await apiRequest(ENDPOINTS.clockOut, "POST", {
      qrToken: newQrToken || att.qrToken || "",
    });
  } catch (error) {
    error.reason =
      error.reason || clockReason(error.message) || "scan_to_clock_out";
    throw error;
  }
  const now = new Date();
  att.clockOut = timeText(now.toISOString());
  att.clockOutAt = now.toISOString();
  localStorage.setItem(attendanceKey(shiftId), JSON.stringify(att));
  return await Backend.workerShift(shiftId);
};

// ==================================================
// 5. FACILITY: profile, shifts, applicants
// ==================================================

const FACILITY_TYPE_LABELS = {
  hospital: "Hospital",
  clinic: "Clinic",
  "medical-lab": "Medical lab",
  "nursing-home": "Nursing home",
  pharmacy: "Pharmacy",
};
Backend.facilityTypeLabel = function (value) {
  return FACILITY_TYPE_LABELS[value] || value;
};

// "Verified", "Pending review", "Not uploaded"... for one document
function documentStatusText(doc) {
  if (!doc || doc.status === "missing") return "Not uploaded";
  if (doc.status === "verified") return "Verified";
  if (doc.status === "rejected")
    return "Rejected" + (doc.comment ? " · " + doc.comment : "");
  return "Uploaded · waiting for review";
}

// The Facility profile page boxes ← the backend's facility profile
Backend.facilityProfileForm = async function () {
  const p = await Backend.myProfile();
  const loc = pick(p, ["location"], {});
  const contact = pick(p, ["secondaryContact"], {});
  const docs = documentsOf(p, FACILITY_DOCUMENTS);
  const placeholder = function (value) {
    return /^to be provided$/i.test(String(value || "").trim()) ? "" : value;
  };
  return {
    status: overallStatusOf(p, docs),
    facilityName: pick(p, ["facilityName"]),
    facilityType: Backend.facilityTypeLabel(pick(p, ["facilityType"])),
    cityState: [
      placeholder(pick(loc, ["city"])),
      placeholder(pick(loc, ["state"])),
    ]
      .filter(Boolean)
      .join(", "),
    address: placeholder(pick(loc, ["address", "street"])),
    about: pick(p, ["about", "description"]),
    contactPerson: [pick(contact, ["fullName"]), pick(contact, ["position"])]
      .filter(Boolean)
      .join(" · "),
    workEmail: pick(contact, ["email"], pick(p, ["email", "user.email"])),
    phone: pick(
      contact,
      ["phoneNumber"],
      pick(p, ["phoneNumber", "user.phoneNumber"]),
    ),
    registrationStatus: documentStatusText(docs[0]),
    identityStatus: documentStatusText(docs[1]),
    taxStatus: documentStatusText(docs[2]),
    workplaceLocation:
      [
        placeholder(pick(loc, ["city"])),
        placeholder(pick(loc, ["state"])),
        pick(loc, ["country"]),
      ]
        .filter(Boolean)
        .join(" · ") || "—",
  };
};

// The Facility profile page boxes → the backend (a form, with the backend's flat field names)
Backend.saveFacilityProfile = function (details) {
  const cityState = details.cityState.split(",");
  const contact = details.contactPerson.split("·");
  const form = new FormData();
  form.append("facilityName", details.facilityName);
  form.append("facilityType", details.facilityType);
  form.append("locationAddress", details.address);
  form.append("locationCity", (cityState[0] || "").trim());
  form.append("locationState", (cityState[1] || "").trim());
  form.append("secondaryContactFullName", (contact[0] || "").trim());
  form.append("secondaryContactPosition", (contact[1] || "").trim());
  form.append("secondaryContactEmail", details.workEmail);
  form.append(
    "secondaryContactPhoneNumber",
    details.phone.replace(/[\s-]/g, ""),
  );
  return apiRequest(ENDPOINTS.facilityProfileUpdate, "PUT", form);
};

// Post a shift. "shift" is what PostShift collects. Posting also starts the shift's payment.
Backend.createShift = async function (shift) {
  const hours = (function () {
    const s = shift.startTime.split(":"),
      e = shift.endTime.split(":");
    let m =
      Number(e[0]) * 60 + Number(e[1]) - (Number(s[0]) * 60 + Number(s[1]));
    if (m <= 0) m += 24 * 60;
    return m / 60;
  })();
  const result = await apiRequest(ENDPOINTS.createShift, "POST", {
    profession: shift.profession,
    specialty: shift.specialty,
    shiftDate: shift.shiftDate,
    shiftType: shift.shiftType.replace(/ shift$/i, ""), // "Day shift" → "Day"
    startTime: shift.startTime,
    endTime: shift.endTime,
    professionalsNeeded: Number(shift.workersNeeded),
    minimumExperience: shift.experience,
    location: shift.location,
    responsibilities: shift.responsibilities,
    reqCredentials: shift.credentials,
    arrivalInstructions: shift.arrival,
    payRate: Math.round(Number(shift.hourlyPay) * hours), // payRate: one professional, whole shift
    isUrgent: shift.urgent === true,
  });
  // The server answers { shift: {...status: "pending_payment"}, payment: { checkoutUrl, ... } }.
  // The shift only goes live (status "open") once its escrow is funded, so the payment is kept
  // for the Fund shift page, which shows the payment link.
  const created = (result && result.shift) || result || {};
  const payment =
    (result && result.payment) || pick(created, ["payment"], null);
  const id = idOf(created);
  if (id && payment && typeof payment === "object") {
    saveShiftPayment(id, payment);
  }
  return {
    id: id,
    status: pick(created, ["status"]),
    payment: payment,
    paymentUrl: payment ? paymentLinkOf(payment) : "",
  };
};

// ==================================================
// 5b. FACILITY: paying for a shift (HarrenaPay escrow)
// ==================================================
// Posting a shift creates a payment. The shift stays "pending_payment" (hidden from workers) until
// the escrow is funded; the backend's HarrenaPay webhook then makes it "open".
// There's no "get payment" endpoint, so the payment from create-shift (or from "retry") is kept in
// this browser, per shift.

// The HarrenaPay checkout address (seen in create-shift's answer:
// http://www.harrenapay.com/checkout/careporium_shift_<shift id>)
const HARRENAPAY_CHECKOUT = "http://www.harrenapay.com/checkout/";

function shiftPaymentKey(shiftId) {
  return "shiftPayment:" + shiftId;
}

function saveShiftPayment(shiftId, payment) {
  try {
    localStorage.setItem(shiftPaymentKey(shiftId), JSON.stringify(payment));
  } catch (error) {
    // storage full or blocked: the page can still get a new link with "retry"
  }
}

function savedShiftPayment(shiftId) {
  try {
    return JSON.parse(localStorage.getItem(shiftPaymentKey(shiftId)) || "null");
  } catch (error) {
    return null;
  }
}

// The payment page address, whatever the field is called:
// Paystack → authorization_url / authorizationUrl, HarrenaPay → checkoutUrl
function paymentLinkOf(payment) {
  return pick(payment || {}, [
    "authorizationUrl",
    "authorization_url",
    "checkoutUrl",
    "checkout_url",
    "paymentUrl",
    "paymentLink",
    "data.authorization_url",
    "paystack.authorization_url",
    "providerResponse.authorization_url",
    "link",
    "url",
  ]);
}

// "Paystack", "HarrenaPay" or "" (from the payment's provider field or its link)
function providerName(payment) {
  const text = (
    pick(payment || {}, ["provider"]) +
    " " +
    paymentLinkOf(payment)
  ).toLowerCase();
  if (text.includes("paystack")) return "Paystack";
  if (text.includes("harrena")) return "HarrenaPay";
  return "";
}

// Is this shift still waiting for its escrow to be funded?
function isAwaitingPayment(shift) {
  const status = String(pick(shift, ["status"])).toLowerCase();
  return /pending_payment|awaiting_payment|awaiting_funding|unfunded|payment_pending|pending_funding/.test(
    status,
  );
}

// Shift status → the facility's payment status
function shiftPaymentStatus(shift, payment) {
  if (isAwaitingPayment(shift)) return "awaiting_funding";
  const status = String(pick(shift, ["status"])).toLowerCase();
  const payout = String(pick(payment || {}, ["payoutStatus"])).toLowerCase();
  if (status === "completed" && /paid|released|complete/.test(payout))
    return "paid";
  if (["cancelled", "canceled", "closed", "deleted"].includes(status))
    return "cancelled";
  return "funds_secured";
}

// "₦110,000" from 11000000 kobo
function koboText(kobo) {
  return nairaText(Number(kobo || 0) / 100);
}

// One shift's payment, in the shape the payment pages use
function paymentView(s, payment) {
  const needed = Number(pick(s, ["professionalsNeeded"], 1));
  const perWorker = payForShift(s);
  const workerTotal = perWorker * needed;
  const hasKobo = payment && pick(payment, ["amountKobo"], "") !== "";
  const amount = hasKobo ? Number(payment.amountKobo) / 100 : workerTotal;
  const commission = hasKobo
    ? Number(pick(payment, ["platformCommissionAmountKobo"], 0)) / 100
    : 0;
  const bps = payment ? Number(pick(payment, ["commissionRateBps"], 0)) : 0;
  return {
    id: idOf(s),
    shortId: String(idOf(s)).slice(-6).toUpperCase(),
    title: shiftTitle(s),
    facilityLine: shiftFacilityName(s) + " · " + pick(s, ["location"]),
    date: shortDate(pick(s, ["shiftDate", "date"])),
    time: pick(s, ["startTime"]) + "–" + pick(s, ["endTime"]) + " WAT",
    workers: needed,
    perWorker: perWorker,
    workerTotal: hasKobo
      ? Number(pick(payment, ["workerPayoutAmountKobo"], workerTotal * 100)) /
        100
      : workerTotal,
    commission: commission,
    commissionRate: bps ? bps / 100 + "%" : "",
    amount: amount,
    status: shiftPaymentStatus(s, payment),
    shiftStatus: pick(s, ["status"]),
    reference: payment
      ? pick(payment, [
          "providerReference",
          "reference",
          "paystackReference",
          "data.reference",
          "_id",
        ])
      : "",
    escrowStatus: payment
      ? pick(payment, ["providerEscrowStatus", "fundingStatus"])
      : "",
    // No saved payment (posted on another device, or before this update): HarrenaPay's checkout
    // link always follows the shift's reference, careporium_shift_<shift id>, so it is built from that
    // HarrenaPay's checkout link can be rebuilt from the shift's reference; Paystack's can't
    // (the page asks the backend for a fresh one instead, with "retry")
    checkoutUrl:
      (payment && paymentLinkOf(payment)) ||
      (isAwaitingPayment(s) &&
      payment &&
      /harrena/i.test(pick(payment, ["provider"]))
        ? HARRENAPAY_CHECKOUT + "careporium_shift_" + idOf(s)
        : ""),
    provider: providerName(payment),
    bankName: payment ? pick(payment, ["bankName"]) : "",
    accountNumber: payment
      ? pick(payment, ["virtualAccountNumber", "accountNumber"])
      : "",
    expiresAt:
      payment && pick(payment, ["expiresAt"])
        ? new Date(payment.expiresAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Africa/Lagos",
          }) + " WAT"
        : "",
    hasPayment: !!payment,
  };
}

// One shift's payment (the Fund shift / Shift funded / Payment unsuccessful pages)
Backend.shiftPayment = async function (shiftId) {
  const answers = await Promise.all([
    apiRequest(ENDPOINTS.shift(shiftId)),
    // GET /api/payments/v1/shift/{shiftId}: the payment record (status and link); older servers don't have it
    apiRequest(ENDPOINTS.shiftPayment(shiftId)).catch(function () {
      return null;
    }),
  ]);
  const s = unwrapShift(answers[0]);
  let fromServer = answers[1];
  if (
    fromServer &&
    typeof fromServer === "object" &&
    fromServer.payment &&
    typeof fromServer.payment === "object"
  ) {
    fromServer = fromServer.payment;
  }
  if (Array.isArray(fromServer))
    fromServer = fromServer[fromServer.length - 1] || null;
  const fromShift = pick(s, ["payment"], null);
  // Keep any link this browser saved if the server's record doesn't include one
  const saved = savedShiftPayment(shiftId);
  let payment =
    (fromServer && typeof fromServer === "object" ? fromServer : null) ||
    (fromShift && typeof fromShift === "object" ? fromShift : null) ||
    saved;
  if (payment && saved && !paymentLinkOf(payment) && paymentLinkOf(saved)) {
    payment = Object.assign({}, saved, payment, {
      authorizationUrl: paymentLinkOf(saved),
    });
  }
  if (payment && payment !== saved) saveShiftPayment(shiftId, payment);
  const view = paymentView(s, payment);
  // The payment record may say it's funded before the shift's status catches up
  if (
    payment &&
    /^(funded|success|successful|paid|completed)$/i.test(
      String(pick(payment, ["fundingStatus", "status"])),
    )
  ) {
    view.status =
      view.status === "awaiting_funding" ? "funds_secured" : view.status;
  }
  return view;
};

// "Get a new payment link": asks the backend to retry funding with the existing payment record
Backend.retryShiftPayment = async function (shiftId) {
  const result = await apiRequest(ENDPOINTS.retryPayment(shiftId), "POST");
  const payment = (result && result.payment) || result;
  if (
    payment &&
    typeof payment === "object" &&
    (paymentLinkOf(payment) || pick(payment, ["virtualAccountNumber"]))
  ) {
    const merged = Object.assign({}, savedShiftPayment(shiftId) || {}, payment);
    saveShiftPayment(shiftId, merged);
  }
  return await Backend.shiftPayment(shiftId);
};

// The facility's Payments page, worked out from its shifts
Backend.facilityPayments = async function () {
  const results = await Promise.all([
    loadFacilityShiftsRaw(),
    // GET /api/payments/v1/history: the facility's payment records (amounts, status, reference)
    apiRequest(ENDPOINTS.paymentHistory).catch(function () {
      return [];
    }),
  ]);
  const shifts = results[0];
  const history = {};
  asList(results[1], ["payments", "data", "history"]).forEach(function (p) {
    const id = idValue(pick(p, ["shift", "shiftId"]));
    if (id) history[id] = p;
  });
  const payments = shifts
    .map(function (s) {
      const fromShift = pick(s, ["payment"], null);
      const payment =
        history[idOf(s)] ||
        (fromShift && typeof fromShift === "object" ? fromShift : null) ||
        savedShiftPayment(idOf(s));
      const view = paymentView(s, payment);
      if (
        payment &&
        /^(funded|success|successful|paid|completed)$/i.test(
          String(pick(payment, ["fundingStatus", "status"])),
        ) &&
        view.status === "awaiting_funding"
      ) {
        view.status = "funds_secured";
      }
      return view;
    })
    .filter(function (p) {
      return p.status !== "cancelled";
    });
  const sum = function (status) {
    return payments.filter(function (p) {
      return p.status === status;
    });
  };
  const total = function (list) {
    return list.reduce(function (n, p) {
      return n + p.amount;
    }, 0);
  };
  const awaiting = sum("awaiting_funding");
  const secured = sum("funds_secured");
  const paid = sum("paid");
  return {
    summary: {
      awaitingFunding: nairaText(total(awaiting)),
      awaitingFundingNote:
        awaiting.length +
        (awaiting.length === 1 ? " shift needs" : " shifts need") +
        " funding",
      fundsSecured: nairaText(total(secured)),
      fundsSecuredNote:
        secured.length +
        (secured.length === 1 ? " shift" : " shifts") +
        " covered",
      paidThisMonth: nairaText(total(paid)),
      paidThisMonthNote: "Payments for completed shifts",
    },
    payments: payments.map(function (p) {
      return Object.assign({}, p, {
        id: p.id,
        date: p.date + " · " + p.shortId,
      });
    }),
  };
};

// Backend shift status → the Manage shifts tabs
function facilityShiftStatus(shift, acceptedCount) {
  const s = String(pick(shift, ["status"], "open")).toLowerCase();
  if (s === "completed") return "completed";
  if (isAwaitingPayment(shift)) return "awaiting_payment";
  const needed = Number(pick(shift, ["professionalsNeeded"], 1));
  if (
    s === "filled" ||
    s === "confirmed" ||
    s === "booked" ||
    (acceptedCount || 0) >= needed
  )
    return "confirmed";
  return "open";
}

// Who applied to the facility's shifts, with each application's shift filled in
// The facility's applications. The Swagger address is tried first. If the live server answers
// 404 (route not deployed, or under another name), a few likely alternatives are tried, and then
// the applications are collected from the facility's own shifts. Whatever works is remembered for
// the rest of the browser session, so the 404s only happen once.
const FACILITY_APPLICATION_LISTS = [
  ENDPOINTS.facilityApplicants, // GET /api/applications/v1/facility-applications (Swagger)
  "/api/shifts/v1/fetch-applications", // the route in the backend's Postman collection
  "/api/applications/v1/get-facility-applications",
  "/api/applications/v1/facility",
];
const SHIFT_APPLICATION_LISTS = [
  function (id) {
    return "/api/shifts/v1/get-shift-applications/" + id;
  }, // the backend's Postman collection
  function (id) {
    return "/api/shifts/v1/fetch-applications/" + id;
  },
  function (id) {
    return "/api/applications/v1/shift/" + id;
  },
  function (id) {
    return "/api/applications/v1/shift-applications/" + id;
  },
  function (id) {
    return "/api/applications/v1/get-shift-applications/" + id;
  },
  function (id) {
    return "/api/shifts/v1/" + id + "/applications";
  },
];

// Applications embedded in a shift (e.g. shift.applications = [{ worker, status }])
function applicationsInsideShift(shift) {
  const list = pick(
    shift,
    ["applications", "applicants", "shiftApplications"],
    [],
  );
  if (!Array.isArray(list)) return [];
  return list
    .filter(function (a) {
      return a && typeof a === "object";
    })
    .map(function (a) {
      return Object.assign({ shift: idOf(shift) }, a, { _shift: shift });
    });
}

async function loadFacilityApplicationsList(knownShifts) {
  let remembered = null;
  try {
    remembered = sessionStorage.getItem("facilityApplicationsSource3");
  } catch (e) {
    /* ignore */
  }
  const remember = function (value) {
    try {
      sessionStorage.setItem("facilityApplicationsSource3", value);
    } catch (e) {
      /* ignore */
    }
  };

  // 1. A whole-facility list
  const lists =
    remembered && remembered.indexOf("list:") === 0
      ? [remembered.slice(5)]
      : remembered
        ? []
        : FACILITY_APPLICATION_LISTS;
  for (const path of lists) {
    try {
      const apps = asList(await apiRequest(path), ["applications", "data"]);
      remember("list:" + path);
      return apps;
    } catch (error) {
      if (error.status !== 404) throw error; // a real error (e.g. not logged in): show it
    }
  }

  // 2. Per shift: applications inside each shift, or a per-shift address
  const shifts =
    knownShifts && knownShifts.length > 1
      ? knownShifts
      : await loadFacilityShiftsRaw();
  let apps = [];
  shifts.forEach(function (shift) {
    apps = apps.concat(applicationsInsideShift(shift));
  });
  if (apps.length > 0 || remembered === "embedded") {
    remember("embedded");
    return apps;
  }
  let perShift = null;
  if (remembered && remembered.indexOf("shift:") === 0) {
    perShift = SHIFT_APPLICATION_LISTS[Number(remembered.slice(6))];
  } else if (shifts.length > 0) {
    for (let i = 0; i < SHIFT_APPLICATION_LISTS.length; i += 1) {
      try {
        await apiRequest(SHIFT_APPLICATION_LISTS[i](idOf(shifts[0])));
        perShift = SHIFT_APPLICATION_LISTS[i];
        remember("shift:" + i);
        break;
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }
  }
  if (perShift) {
    const lists = await Promise.all(
      shifts.map(async function (shift) {
        const list = asList(await apiRequest(perShift(idOf(shift))), [
          "applications",
          "data",
        ]);
        return list.map(function (a) {
          return Object.assign({ shift: idOf(shift) }, a);
        });
      }),
    );
    return [].concat.apply([], lists);
  }
  if (shifts.length === 0) {
    return []; // no shifts yet, so no applications either
  }
  throw new Error(
    "The server doesn't have a facility applications endpoint yet: GET /api/shifts/v1/get-shift-applications/{shiftId} " +
      "and GET /api/applications/v1/facility-applications both answered 404. Ask the backend developer to deploy one of them.",
  );
}

async function loadFacilityApplicationsRaw(knownShifts) {
  const apps = await loadFacilityApplicationsList(knownShifts);
  return await withShifts(apps, knownShifts);
}

async function loadFacilityShiftsRaw() {
  return asList(await apiRequest(ENDPOINTS.facilityShifts), ["shifts", "data"]);
}

function isAccepted(app) {
  return applicationStatusText(pick(app, ["status"])) === "Accepted";
}

Backend.facilityShifts = async function () {
  const list = await loadFacilityShiftsRaw();
  let apps = [];
  try {
    apps = await loadFacilityApplicationsRaw(list);
  } catch (error) {
    apps = []; // the counts just show what's needed
  }
  const shifts = list
    .filter(function (s) {
      return !["closed", "cancelled", "canceled", "deleted"].includes(
        String(pick(s, ["status"])).toLowerCase(),
      );
    })
    .map(function (s) {
      const id = idOf(s);
      const acceptedCount = apps.filter(function (a) {
        return applicationShiftId(a) === id && isAccepted(a);
      }).length;
      const waiting = apps.filter(function (a) {
        return (
          applicationShiftId(a) === id &&
          applicationStatusText(pick(a, ["status"])) === "Under review"
        );
      }).length;
      const status = facilityShiftStatus(s, acceptedCount);
      const needed = Number(pick(s, ["professionalsNeeded"], 1));
      let staffing;
      if (status === "completed") {
        staffing = "Completed";
      } else if (status === "awaiting_payment") {
        staffing =
          "Awaiting payment · fund the escrow so workers can see this shift";
      } else if (status === "confirmed") {
        staffing =
          "All places filled (" + acceptedCount + " of " + needed + ")";
      } else {
        staffing =
          acceptedCount +
          " of " +
          needed +
          " booked" +
          (waiting ? " · " + waiting + " waiting for review" : "");
      }
      return {
        id: id,
        title: shiftTitle(s),
        urgent: pick(s, ["isUrgent"], false) === true,
        when:
          longDate(pick(s, ["shiftDate", "date"])) +
          " · " +
          pick(s, ["startTime"]) +
          "–" +
          pick(s, ["endTime"]) +
          " WAT",
        staffing: staffing + " · " + nairaText(payForShift(s)) + " each",
        status: status,
        start: shiftTimes(s).start.getTime() || 0,
        waiting: waiting,
      };
    })
    .sort(function (a, b) {
      return a.start - b.start;
    });
  const count = function (test) {
    return shifts.filter(test).length;
  };
  return {
    counts: {
      all: count(function (s) {
        return s.status !== "completed";
      }),
      urgent: count(function (s) {
        return s.urgent && s.status !== "completed";
      }),
      confirmed: count(function (s) {
        return s.status === "confirmed";
      }),
      completed: count(function (s) {
        return s.status === "completed";
      }),
    },
    shifts: shifts,
    applications: apps,
  };
};

// How each application brings its worker: a populated "worker" / "workerId" / "applicant" / "user"
function applicationWorker(app) {
  for (const name of [
    "worker",
    "workerId",
    "workerProfile",
    "applicant",
    "applicantId",
    "professional",
    "user",
    "userId",
  ]) {
    const w = app && app[name];
    if (w && typeof w === "object" && !Array.isArray(w)) {
      return unwrapProfile(w, "worker");
    }
  }
  return {};
}

// The worker's id, to find them again on the profile pages
function applicationWorkerId(app) {
  const w = applicationWorker(app);
  return (
    idOf(w) ||
    idValue(pick(app, ["workerId", "worker", "applicantId", "userId", "user"]))
  );
}

// The verification badge for an applicant: { text, color } (or null when we don't know)
function applicantBadge(w) {
  const docs = documentsOf(w, WORKER_DOCUMENTS);
  if (!hasVerificationInfo(w, docs)) return null;
  const status = overallStatusOf(w, docs);
  if (status === "verified") return { text: "Verified worker", color: "green" };
  if (status === "rejected")
    return { text: "Documents need attention", color: "red" };
  if (status === "not_submitted")
    return { text: "Not verified", color: "gray" };
  return { text: "Verification in progress", color: "amber" };
}

// Applicants: all of the facility's, or one shift's
Backend.applicants = async function (shiftId) {
  const apps = await loadFacilityApplicationsRaw();
  const forShift = apps.filter(function (a) {
    return !shiftId || applicationShiftId(a) === shiftId;
  });
  return {
    waitingForReview: forShift.filter(function (a) {
      return applicationStatusText(pick(a, ["status"])) === "Under review";
    }).length,
    applicants: forShift.map(function (a) {
      const w = applicationWorker(a);
      const years = pick(w, ["yearsOfExperience"], "");
      const status = applicationStatusText(pick(a, ["status"]));
      const sh = applicationShift(a);
      return {
        applicationId: idOf(a),
        workerId: applicationWorkerId(a),
        shiftId: applicationShiftId(a),
        name: workerNameOf(w) || "Applicant",
        badge: applicantBadge(w),
        status: status,
        details: [
          pick(w, ["profession"]),
          pick(w, ["specialty"]),
          years !== ""
            ? years + (Number(years) === 1 ? " year" : " years")
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        stats:
          "Application " +
          status.toLowerCase() +
          " · " +
          shiftTitle(sh) +
          (pick(sh, ["shiftDate", "date"])
            ? " · " + shortDate(pick(sh, ["shiftDate", "date"]))
            : ""),
        latestRole: "",
        softSkills: [],
        shortlisted: false,
        accepted: status === "Accepted",
      };
    }),
  };
};

// Work experience the backend may send with a worker (several likely names)
function experiencesOf(p) {
  const list = pick(
    p,
    ["workExperience", "experiences", "experience", "workHistory"],
    [],
  );
  if (!Array.isArray(list)) return [];
  return list.map(function (e) {
    const start = String(pick(e, ["startDate", "start", "from"])).slice(0, 7);
    const endRaw = pick(e, ["endDate", "end", "to"]);
    const current =
      pick(e, ["current", "isCurrent"], false) === true || !endRaw;
    return {
      id: idOf(e),
      title: pick(e, ["title", "role", "position", "jobTitle"], "Role"),
      workplace: pick(e, [
        "workplace",
        "facility",
        "employer",
        "company",
        "organisation",
        "organization",
      ]),
      location: pick(e, ["location", "city"]),
      start: /^\d{4}-\d{2}$/.test(start) ? start : "",
      end: current ? "" : String(endRaw).slice(0, 7),
      current: current,
      responsibilities: pick(e, ["responsibilities", "description", "summary"]),
    };
  });
}

// Find one applicant (and their application) among the facility's applications
async function findApplicant(workerId, applicationId) {
  const apps = await loadFacilityApplicationsRaw();
  const app =
    (applicationId &&
      apps.find(function (a) {
        return idOf(a) === applicationId;
      })) ||
    apps.find(function (a) {
      const w = applicationWorker(a);
      return [
        applicationWorkerId(a),
        idOf(w),
        idValue(pick(w, ["user"])),
        idValue(pick(w, ["userId"])),
      ].includes(workerId);
    });
  if (!app) {
    throw new Error("We couldn't find this worker among your applicants.");
  }
  // Every application from the same worker (to count how many shifts they've done with you)
  const id = applicationWorkerId(app);
  const all = apps.filter(function (a) {
    return applicationWorkerId(a) === id;
  });
  let worker = applicationWorker(app);
  // The newest server lets anyone logged in read a worker's profile by their USER id
  // (get-worker-profile/{userId}): use it to fill in what the application didn't include
  const userId =
    idValue(pick(worker, ["user"])) ||
    idValue(pick(worker, ["userId"])) ||
    idValue(pick(app, ["worker.user", "userId"]));
  if (userId || idOf(worker)) {
    try {
      // Swagger: worker/v1/get-worker-profile/{userId}. Postman: shifts/v1/get-worker-profile/{id}
      const workerProfileId = idOf(worker);
      // Latest Postman collection: worker/v1/get-worker-profile/{worker profile id}
      const full = unwrapProfile(
        await apiFirst(
          (workerProfileId
            ? [[ENDPOINTS.workerOwnProfile(workerProfileId), "GET"]]
            : []
          )
            .concat(
              userId
                ? [
                    [ENDPOINTS.workerOwnProfile(userId), "GET"],
                    ["/api/shifts/v1/get-worker-profile/" + userId, "GET"],
                  ]
                : [],
            )
            .concat(
              workerProfileId
                ? [
                    [
                      "/api/shifts/v1/get-worker-profile/" + workerProfileId,
                      "GET",
                    ],
                  ]
                : [],
            ),
        ),
        "worker",
      );
      if (full && typeof full === "object") {
        worker = Object.assign({}, full, worker, {
          user: Object.assign({}, full.user || {}, worker.user || {}),
        });
        // the profile's documents and status are the up-to-date ones
        Object.keys(WORKER_DOCUMENTS)
          .concat(["documents", "verificationStatus", "about", "location"])
          .forEach(function (key) {
            if (full[key] !== undefined && full[key] !== null)
              worker[key] = full[key];
          });
      }
    } catch (error) {
      // not allowed or not there: use what the application has
    }
  }
  return { app: app, worker: worker, all: all };
}

// The applicant's full profile: details, credentials, experience and this application
Backend.applicantProfile = async function (workerId, applicationId) {
  const found = await findApplicant(workerId, applicationId);
  const p = found.worker;
  const app = found.app;
  const sh = applicationShift(app);
  const loc = pick(p, ["location"], {});
  const docs = documentsOf(p, WORKER_DOCUMENTS);
  const years = pick(p, ["yearsOfExperience"], "");
  const name = workerNameOf(p) || "Applicant";
  const status = applicationStatusText(pick(app, ["status"]));
  const appliedAt = pick(app, ["createdAt", "appliedAt", "submittedAt"]);
  const booked = found.all.filter(isAccepted);
  return {
    applicationId: idOf(app),
    workerId: applicationWorkerId(app),
    shiftId: applicationShiftId(app),
    applicationStatus: status,
    badge: applicantBadge(p),
    documents: docs.map(function (d) {
      return {
        label: d.label,
        url: d.url,
        status: d.status,
        text: documentStatusText(d),
      };
    }),
    experiences: experiencesOf(p),
    softSkills: asList(pick(p, ["softSkills", "skills"], [])),
    fields: {
      name: name,
      initials: initialsOf(name),
      headline: [
        pick(p, ["profession"]),
        pick(p, ["specialty"]),
        [pick(loc, ["city"]), pick(loc, ["state"])].filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join(" · "),
      about: pick(
        p,
        ["about", "bio"],
        "This worker hasn't added an introduction yet.",
      ),
      profession: pick(p, ["profession"], "—"),
      specialty: pick(p, ["specialty"], "—"),
      experienceYears:
        years === "" ? "—" : years + (Number(years) === 1 ? " year" : " years"),
      location:
        [
          pick(loc, ["address"]),
          pick(loc, ["city", "street"]),
          pick(loc, ["state"]),
          pick(loc, ["country"]),
        ]
          .filter(Boolean)
          .join(", ") || "—",
      email: pick(p, ["email", "user.email", "userId.email"], "—"),
      phone: pick(
        p,
        ["phoneNumber", "user.phoneNumber", "userId.phoneNumber"],
        "—",
      ),
      shiftTitle: shiftTitle(sh),
      shiftWhen: pick(sh, ["shiftDate", "date"])
        ? longDate(pick(sh, ["shiftDate", "date"])) +
          " · " +
          pick(sh, ["startTime"]) +
          "–" +
          pick(sh, ["endTime"]) +
          " WAT"
        : "",
      shiftPay:
        pick(sh, ["payRate"]) !== ""
          ? nairaText(payForShift(sh)) + " for the shift"
          : "",
      applied: appliedAt
        ? "Applied " +
          new Date(appliedAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Africa/Lagos",
          }) +
          " WAT"
        : "",
      applicationStatus: status === "Accepted" ? "Booked" : status,
      bookedWithYou:
        booked.length +
        (booked.length === 1
          ? " shift booked with you"
          : " shifts booked with you"),
    },
  };
};

// A worker's profile, as the facility sees it (WorkerProfile.html data-fields).
// The backend has no "look at another worker's profile" endpoint for facilities
// (get-worker-profile only gives the logged-in worker their OWN profile), so we use the
// worker details that come with the facility's applications.
Backend.workerForFacility = async function (workerId, applicationId) {
  const found = await findApplicant(workerId, applicationId);
  const p = found.worker;
  const docs = documentsOf(p, WORKER_DOCUMENTS);
  const years = pick(p, ["yearsOfExperience"], "");
  const loc = pick(p, ["location"], {});
  const sh = applicationShift(found.app);
  const booked = found.all.filter(isAccepted).length;
  return {
    applicationId: idOf(found.app),
    applicationStatus: applicationStatusText(pick(found.app, ["status"])),
    badge: applicantBadge(p),
    experiences: experiencesOf(p),
    softSkills: asList(pick(p, ["softSkills", "skills"], [])),
    name: workerNameOf(p),
    summary: [
      pick(p, ["profession"]),
      pick(p, ["specialty"]),
      pick(loc, ["state", "city"]),
    ]
      .filter(Boolean)
      .join(" · "),
    specialty:
      [
        pick(p, ["specialty"]),
        years !== "" ? years + " years of experience" : "",
      ]
        .filter(Boolean)
        .join(" · ") || "—",
    licenceBody: "Professional licence",
    licenceStatus: "Status: " + documentStatusText(docs[0]),
    licenceNumber: "ID document: " + documentStatusText(docs[1]),
    certification1: "Education certificate · " + documentStatusText(docs[2]),
    certification2: "Proof of address · " + documentStatusText(docs[3]),
    education: pick(
      p,
      ["education", "qualification"],
      "See education certificate above",
    ),
    review: "No reviews yet",
    reviewSource: "Reviews appear after completed shifts.",
    rating: "No ratings yet",
    completedShifts:
      booked +
      (booked === 1 ? " shift booked with you" : " shifts booked with you"),
    attendance: "",
    noShows: "",
    availability: pick(sh, ["shiftDate", "date"])
      ? shortDate(pick(sh, ["shiftDate", "date"])) +
        " · " +
        pick(sh, ["startTime"]) +
        "–" +
        pick(sh, ["endTime"]) +
        " WAT"
      : "—",
    availabilityNote: "Applied for " + shiftTitle(sh) + ".",
  };
};

// "Offer shift" accepts the worker's application (the backend books the worker straight away)
// Swagger: PATCH accept/{id} and reject/{id}.
// Postman: PATCH applications/{id}/status, and (latest) PATCH shifts/v1/{id}/status, with { status }.
Backend.acceptApplication = function (applicationId) {
  return apiFirst([
    [ENDPOINTS.acceptApplication(applicationId), "PATCH"],
    [
      "/api/applications/v1/applications/" + applicationId + "/status",
      "PATCH",
      { status: "accepted" },
    ],
    [
      "/api/shifts/v1/" + applicationId + "/status",
      "PATCH",
      { status: "accepted" },
    ], // latest Postman collection
  ]);
};

Backend.rejectApplication = function (applicationId) {
  return apiFirst([
    [ENDPOINTS.rejectApplication(applicationId), "PATCH"],
    [
      "/api/applications/v1/applications/" + applicationId + "/status",
      "PATCH",
      { status: "rejected" },
    ],
    [
      "/api/shifts/v1/" + applicationId + "/status",
      "PATCH",
      { status: "rejected" },
    ], // latest Postman collection
  ]);
};

// The verified facility dashboard, put together from the facility's shifts and applications
Backend.facilityDashboard = async function () {
  const results = await Promise.all([
    Backend.facilityShifts(),
    Backend.myProfile().catch(function () {
      return {};
    }),
  ]);
  const data = results[0];
  const profile = results[1];
  const loc = pick(profile, ["location"], {});
  const active = data.shifts.filter(function (s) {
    return s.status !== "completed";
  });
  const open = active.filter(function (s) {
    return s.status === "open";
  });
  const urgentOpen = open.filter(function (s) {
    return s.urgent;
  });
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  });
  const startingToday = active.filter(function (s) {
    return (
      s.start &&
      new Date(s.start).toLocaleDateString("en-CA", {
        timeZone: "Africa/Lagos",
      }) === today
    );
  }).length;
  const waiting = data.applications.filter(function (a) {
    return applicationStatusText(pick(a, ["status"])) === "Under review";
  });
  const city = [pick(loc, ["city"]), pick(loc, ["state"])]
    .filter(function (v) {
      return v && !/to be provided/i.test(v);
    })
    .join(", ");
  return {
    facilityLine: [pick(profile, ["facilityName"]), city]
      .filter(Boolean)
      .join(" · "),
    openShifts: String(open.length),
    openShiftsNote:
      startingToday +
      (startingToday === 1 ? " shift starts today" : " shifts start today"),
    newApplicants: String(waiting.length),
    newApplicantsNote: waiting.length
      ? "Ready for you to review"
      : "No one is waiting right now",
    urgentShifts: String(urgentOpen.length),
    urgentShiftsNote: urgentOpen.length
      ? "Find cover for these shifts"
      : "No urgent shifts open",
    applicantsWaiting:
      waiting.length +
      (waiting.length === 1 ? " person is" : " people are") +
      " waiting to hear from you",
    upcomingShifts: active.slice(0, 4),
    newApplicantList: waiting.slice(0, 3).map(function (a) {
      const w = applicationWorker(a);
      const badge = applicantBadge(w);
      return {
        workerId: applicationWorkerId(a),
        applicationId: idOf(a),
        shiftId: applicationShiftId(a),
        name: workerNameOf(w) || "Applicant",
        role:
          [pick(w, ["profession"]), pick(w, ["specialty"])]
            .filter(Boolean)
            .join(" · ") || "Health professional",
        stats:
          (badge ? badge.text + " · " : "") +
          "Applied for " +
          shiftTitle(applicationShift(a)),
      };
    }),
  };
};

// ==================================================
// 6. FACILITY: the shift page (workers, attendance QR, completing)
// ==================================================

// The QR answer can hold a drawn image ("data:image/png;base64,...", or an image address) and/or
// the code itself. Find each, wherever it is: { qrCode: "data:image/..." , qrToken: "..." }, etc.
function qrParts(answer) {
  const isImage = function (v) {
    return (
      typeof v === "string" &&
      (/^data:image\//i.test(v) ||
        /^https?:\/\/\S+\.(png|jpe?g|svg|gif|webp)(\?|$)/i.test(v))
    );
  };
  let image = "";
  let code = "";
  const seen = new Set();
  (function walk(value, key, depth) {
    if (value === null || value === undefined || depth > 4) return;
    if (typeof value === "string") {
      if (isImage(value)) {
        if (!image) image = value;
      } else if (
        !code &&
        /token|code|qr|value|payload/i.test(key || "") &&
        value.length >= 4 &&
        value.length < 2000
      ) {
        code = value;
      }
      return;
    }
    if (typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    // the likely names first, so the right field wins
    const keys = Object.keys(value).sort(function (a, b) {
      const rank = function (k) {
        return /^(qrToken|token|code|backupCode)$/i.test(k)
          ? 0
          : /qr/i.test(k)
            ? 1
            : 2;
      };
      return rank(a) - rank(b);
    });
    keys.forEach(function (k) {
      walk(value[k], k, depth + 1);
    });
  })(answer, "qr", 0);
  return { image: image, code: code };
}

Backend.facilityShift = async function (shiftId) {
  const s = unwrapShift(await apiRequest(ENDPOINTS.shift(shiftId)));
  const apps = (await loadFacilityApplicationsRaw([s])).filter(function (a) {
    return applicationShiftId(a) === shiftId;
  });
  const accepted = apps.filter(isAccepted);
  const needed = Number(pick(s, ["professionalsNeeded"], 1));
  const status =
    String(pick(s, ["status"])) === "completed" ? "completed" : "active";

  // The attendance QR as soon as at least one worker is booked
  let qrValue = ""; // the code itself (for "can't scan? paste this code")
  let qrImage = ""; // the QR already drawn by the backend (a data:image/... address)
  let qrError = "";
  if (accepted.length > 0 && status !== "completed") {
    try {
      // Postman: shifts/{shiftId}/qr (returns the drawn QR). Swagger: qr/{shiftId}
      const qr = await apiFirst([
        ["/api/attendance/v1/shifts/" + shiftId + "/qr", "GET"],
        [ENDPOINTS.attendanceQr(shiftId), "GET"],
      ]);
      const found = qrParts(qr);
      qrValue = found.code;
      qrImage = found.image;
    } catch (error) {
      qrError = error.message;
    }
  }

  const times = shiftTimes(s);
  const now = new Date();

  // Clock times, if the server sends them with each application
  const attendance = accepted.map(attendanceFromServer);
  const attendanceKnown = attendance.some(function (a) {
    return a !== null;
  });

  return {
    id: shiftId,
    ended: now >= times.end,
    started: now >= times.start,
    title: shiftTitle(s),
    facilityLine: shiftFacilityName(s) + " · " + pick(s, ["location"]),
    whenLine:
      longDate(pick(s, ["shiftDate", "date"])) +
      " · " +
      pick(s, ["startTime"]) +
      "–" +
      pick(s, ["endTime"]) +
      " WAT",
    shortDay: longDate(pick(s, ["shiftDate", "date"])).split(", ")[1] || "",
    needed: needed,
    status: status,
    rawStatus: String(pick(s, ["status"]) || "").toLowerCase(), // e.g. "open", "closed", "pending_payment"
    qrValue: qrValue,
    qrImage: qrImage,
    qrError: qrError,
    backupCode: "", // the backend has no 6-digit backup code; the page shows the QR's text instead
    attendanceKnown: attendanceKnown,
    paymentStatus: pick(s, [
      "paymentStatus",
      "payment.fundingStatus",
      "payment.status",
      "fundingStatus",
      "escrowStatus",
    ]),
    awaitingPayment: isAwaitingPayment(s),
    workers: accepted.map(function (a, index) {
      const w = applicationWorker(a);
      const att = attendance[index] || { clockIn: "", clockOut: "" };
      let state = "none";
      if (att.clockIn) state = "working";
      if (att.clockOut) state = "completed";
      if (status === "completed") state = "completed";
      return {
        id: idOf(a),
        workerId: applicationWorkerId(a),
        name: workerNameOf(w) || "Worker",
        role: pick(w, ["profession"], ""),
        offer: "accepted",
        attendance: state,
        clockIn: att.clockIn,
        clockOut: att.clockOut,
        late: false,
        canMarkNoShow: false,
        clockOutMissing: false,
      };
    }),
  };
};

Backend.completeShift = function (shiftId) {
  return apiRequest(ENDPOINTS.completeShift(shiftId), "PATCH");
};

// Close a shift: it stays on record, but stops taking applications
Backend.closeShift = function (shiftId) {
  return apiRequest(ENDPOINTS.closeShift(shiftId), "PATCH");
};

// Delete a shift for good
Backend.deleteShift = function (shiftId) {
  return apiRequest(ENDPOINTS.deleteShift(shiftId), "DELETE");
};

Backend.retryPayment = function (shiftId) {
  return apiRequest(ENDPOINTS.retryPayment(shiftId), "POST");
};

// ==================================================
// 7. ADMIN
// ==================================================

Backend.adminOverview = async function () {
  const d = await apiRequest(ENDPOINTS.adminOverview);
  return {
    healthWorkers:
      pick(d, ["totalWorkers"], 0) +
      " total · " +
      pick(d, ["verifiedWorkers"], 0) +
      " verified",
    facilities:
      pick(d, ["totalFacilities"], 0) +
      " total · " +
      pick(d, ["verifiedFacilities"], 0) +
      " verified",
    pendingVerifications: String(pick(d, ["pendingVerifications"], 0)),
    activeShifts: String(pick(d, ["activeShifts"], 0)),
    completedShiftsTotal: String(pick(d, ["completedShifts"], 0)),
  };
};

// Which worker or facility a queue item belongs to (the queue lists each document separately)
function queueOwnerId(item) {
  return (
    idValue(
      pick(item, [
        "workerId",
        "facilityId",
        "profileId",
        "ownerId",
        "worker",
        "facility",
      ]),
    ) || idOf(item)
  );
}

function queueType(item) {
  const t = String(pick(item, ["type", "userType", "role"])).toLowerCase();
  return t.includes("facility") ? "facility" : "worker";
}

// The document key (e.g. "idDocument") from a queue item's documentType, whatever the spelling
function documentKeyOf(name, labels) {
  const n = String(name || "").toLowerCase();
  return (
    Object.keys(labels).find(function (key) {
      return (
        (DOCUMENT_ALIASES[key] || [key]).some(function (alias) {
          return alias.toLowerCase() === n;
        }) || labels[key].toLowerCase() === n
      );
    }) || ""
  );
}

async function loadQueueItems() {
  return asList(await apiRequest(ENDPOINTS.verifications), [
    "queue",
    "items",
    "data",
  ]);
}

// The queue: one row per worker or facility.
// It joins the document queue with the "pending" worker and facility lists, so nobody with
// uploaded documents is missed even if one of those lists is incomplete.
Backend.adminQueue = async function () {
  const results = await Promise.all([
    loadQueueItems().catch(function () {
      return [];
    }),
    apiRequest(ENDPOINTS.adminPendingWorkers).catch(function () {
      return [];
    }),
    apiRequest(ENDPOINTS.adminPendingFacilities).catch(function () {
      return [];
    }),
  ]);
  const rows = {};
  const addRow = function (type, id, name, submittedAt) {
    const key = type + ":" + id;
    if (!rows[key]) {
      rows[key] = {
        id: id,
        name: name || "Unnamed",
        type: type,
        typeLabel: type === "facility" ? "Facility" : "Worker",
        submitted: submittedAt
          ? new Date(submittedAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        order: submittedAt ? new Date(submittedAt).getTime() : 0,
        status: "Pending",
        documents: 0,
      };
    }
    return rows[key];
  };

  results[0].forEach(function (item) {
    const row = addRow(
      queueType(item),
      queueOwnerId(item),
      pick(item, ["name", "fullName", "facilityName"]),
      pick(item, ["submittedAt", "updatedAt", "createdAt"]),
    );
    row.documents += 1;
  });

  const addProfiles = function (list, type) {
    asList(list, ["workers", "facilities", "data"]).forEach(function (raw) {
      const p = unwrapProfile(raw, type);
      const docs = documentsOf(
        p,
        type === "facility" ? FACILITY_DOCUMENTS : WORKER_DOCUMENTS,
      );
      const waiting = docs.filter(function (d) {
        return d.uploaded && d.status === "pending";
      }).length;
      if (waiting === 0) return; // nothing to review yet
      const name =
        type === "facility" ? pick(p, ["facilityName"]) : workerNameOf(p);
      const row = addRow(
        type,
        idOf(p),
        name,
        pick(p, ["updatedAt", "createdAt"]),
      );
      row.documents = Math.max(row.documents, waiting);
    });
  };
  addProfiles(results[1], "worker");
  addProfiles(results[2], "facility");

  return Object.values(rows).map(function (row) {
    row.typeLabel +=
      " · " +
      row.documents +
      (row.documents === 1 ? " document" : " documents");
    return row;
  });
};

// One worker or facility (with its documents) for the review pages.
// Looks the person up by id; if that fails, finds them in the full list (the id might be the
// user's id rather than the profile's). Missing document links are filled in from the queue.
async function loadSubmission(type, id) {
  const labels = type === "facility" ? FACILITY_DOCUMENTS : WORKER_DOCUMENTS;
  let profile = null;
  let firstError = null;
  try {
    const raw = await apiRequest(
      type === "facility"
        ? ENDPOINTS.adminFacility(id)
        : ENDPOINTS.adminWorker(id),
    );
    console.info("Admin " + type + " from the backend:", JSON.stringify(raw));
    profile = unwrapProfile(raw, type);
    if (!looksLikeProfile(profile, type) && !Object.keys(profile).length)
      profile = null;
  } catch (error) {
    firstError = error;
  }
  if (!profile) {
    const list = asList(
      await apiRequest(
        type === "facility"
          ? ENDPOINTS.adminFacilities
          : ENDPOINTS.adminWorkers,
      ),
      ["workers", "facilities", "data"],
    );
    const raw = list.find(function (item) {
      const p = unwrapProfile(item, type);
      return [
        idOf(p),
        idOf(item),
        idValue(pick(p, ["user"])),
        idValue(pick(p, ["userId"])),
      ].includes(id);
    });
    if (!raw) {
      throw firstError || new Error("We couldn't find this " + type + ".");
    }
    profile = unwrapProfile(raw, type);
  }

  const docs = documentsOf(profile, labels);

  // Fill in any document the profile didn't show, from the verification queue
  if (
    docs.some(function (d) {
      return !d.uploaded;
    })
  ) {
    try {
      const items = (await loadQueueItems()).filter(function (item) {
        return (
          queueType(item) === type &&
          [id, idOf(profile)].includes(queueOwnerId(item))
        );
      });
      items.forEach(function (item) {
        const key = documentKeyOf(pick(item, ["documentType", "type"]), labels);
        const doc = docs.find(function (d) {
          return d.key === key;
        });
        if (doc && !doc.uploaded) {
          doc.url = pick(item, ["documentUrl", "url", "fileUrl"]);
          doc.status =
            normaliseStatus(
              pick(item, [
                "documentVerificationStatus",
                "verificationStatus",
                "status",
              ]),
            ) || "pending";
          doc.comment = pick(item, ["verificationComment", "comment"]);
          doc.uploaded = true;
        }
      });
    } catch (error) {
      // the queue is only a backup source
    }
  }

  // The id the document review endpoint needs: the one that worked for looking them up
  return {
    profile: profile,
    docs: docs,
    id: firstError ? idOf(profile) || id : id,
  };
}

Backend.adminSubmission = async function (type, id) {
  const loaded = await loadSubmission(type, id);
  const p = loaded.profile;
  const docs = loaded.docs;
  const status = overallStatusOf(p, docs);
  const docLine = function (d) {
    return (
      d.label +
      " · " +
      (d.status === "missing" ? "not uploaded" : d.status) +
      (d.comment ? " (" + d.comment + ")" : "")
    );
  };
  if (type === "facility") {
    const loc = pick(p, ["location"], {});
    return {
      status: status,
      documents: docs,
      fields: {
        subtitle: [
          pick(p, ["facilityName"]),
          Backend.facilityTypeLabel(pick(p, ["facilityType"])),
          "Status: " + status.replace("_", " "),
        ]
          .filter(Boolean)
          .join(" · "),
        address: [
          pick(loc, ["address", "street"]),
          pick(loc, ["city"]),
          pick(loc, ["state"]),
          pick(loc, ["country"]),
        ]
          .filter(Boolean)
          .join(", "),
        contact:
          "Contact: " +
          ([
            pick(p, ["secondaryContact.fullName"]),
            pick(p, ["secondaryContact.position"]),
          ]
            .filter(Boolean)
            .join(" · ") || pick(p, ["facilityName"])),
        contactDetails: [
          pick(p, ["user.email", "email", "userId.email"]),
          pick(p, ["user.phoneNumber", "phoneNumber", "userId.phoneNumber"]),
        ]
          .filter(Boolean)
          .join(" · "),
      },
    };
  }
  return {
    status: status,
    documents: docs,
    fields: {
      subtitle: [
        workerNameOf(p),
        pick(p, ["profession"]),
        pick(p, ["specialty"]),
        "Status: " + status.replace("_", " "),
      ]
        .filter(Boolean)
        .join(" · "),
      licence: docLine(docs[0]),
      licenceDates: [
        pick(p, ["user.email", "email", "userId.email"]),
        pick(p, ["user.phoneNumber", "phoneNumber", "userId.phoneNumber"]),
      ]
        .filter(Boolean)
        .join(" · "),
      certification: docLine(docs[2]),
      identity: docLine(docs[1]) + " · " + docLine(docs[3]),
      experience:
        pick(p, ["yearsOfExperience"], "") !== ""
          ? pick(p, ["yearsOfExperience"]) + " years of experience"
          : "",
    },
  };
};

// Approve: mark every document that isn't verified yet as verified.
// Reject: mark every uploaded document that isn't verified as rejected, with the reason.
// The backend reviews one document at a time, so we send one request per document, then load
// the person again to confirm the result. Gives back
// { status, done: [...labels], failed: [{ label, message }] }.
Backend.adminDecide = async function (type, id, decision, reason) {
  const loaded = await loadSubmission(type, id);
  const path =
    type === "facility"
      ? ENDPOINTS.adminFacilityDocuments(loaded.id)
      : ENDPOINTS.adminWorkerDocuments(loaded.id);
  const done = [];
  const failed = [];
  let sent = 0;
  for (const doc of loaded.docs) {
    if (doc.status === "verified") continue; // already approved: never undo it
    if (decision === "rejected" && doc.status === "rejected") continue;
    // A document we didn't see is still tried when approving: if it really isn't uploaded,
    // the server says so and the admin sees why the account can't be verified yet.
    if (decision === "rejected" && !doc.uploaded) continue;
    const body = { documentType: doc.key, status: decision };
    if (decision === "rejected") body.comment = reason;
    sent += 1;
    try {
      // Swagger: PATCH. Postman: POST
      await apiFirst([
        [path, "PATCH", body],
        [path, "POST", body],
      ]);
      done.push(doc.label);
    } catch (error) {
      failed.push({ label: doc.label, message: error.message });
    }
  }

  // Check what the server now says
  let status =
    decision === "verified" && failed.length === 0 ? "verified" : decision;
  try {
    const after = await loadSubmission(type, id);
    status = overallStatusOf(after.profile, after.docs);
  } catch (error) {
    // keep the best guess
  }
  if (sent === 0 && decision === "verified" && status !== "verified") {
    failed.push({
      label: "Documents",
      message: "There were no documents to approve.",
    });
  }
  return { status: status, done: done, failed: failed };
};

// Manage users: the backend has two lists (workers and facilities); the page shows one
Backend.adminUsers = async function () {
  const workers = asList(await apiRequest(ENDPOINTS.adminWorkers), [
    "workers",
    "data",
  ]);
  const facilities = asList(await apiRequest(ENDPOINTS.adminFacilities), [
    "facilities",
    "data",
  ]);
  const verification = function (p, type) {
    const docs = documentsOf(
      p,
      type === "facility" ? FACILITY_DOCUMENTS : WORKER_DOCUMENTS,
    );
    const status = overallStatusOf(p, docs);
    return {
      verified: "Verified",
      rejected: "Rejected",
      not_submitted: "Not submitted",
      pending: "Pending",
      resubmission: "Pending",
    }[status];
  };
  return workers
    .map(function (raw) {
      const w = unwrapProfile(raw, "worker");
      return {
        id: idOf(w),
        type: "worker",
        name: workerNameOf(w) || "Worker",
        role: "Worker",
        email: pick(w, ["user.email", "email", "userId.email"]),
        verification: verification(w, "worker"),
        access: "Active",
        details: [pick(w, ["profession"]), pick(w, ["specialty"])]
          .filter(Boolean)
          .join(" · "),
      };
    })
    .concat(
      facilities.map(function (raw) {
        const f = unwrapProfile(raw, "facility");
        return {
          id: idOf(f),
          type: "facility",
          name: pick(f, ["facilityName"], "Facility"),
          role: "Facility",
          email: pick(f, ["user.email", "email", "userId.email"]),
          verification: verification(f, "facility"),
          access: "Active",
          details: [
            Backend.facilityTypeLabel(pick(f, ["facilityType"])),
            pick(f, ["location.city"]),
          ]
            .filter(function (v) {
              return v && !/to be provided/i.test(v);
            })
            .join(" · "),
        };
      }),
    );
};

// ==================================================
// 8. NOTIFICATIONS (GET /api/notifications/v1/, PATCH read/{id}, PATCH read-all)
// ==================================================

// Where a notification's button goes, from what it's about
function notificationLink(n, role) {
  const link = pick(n, ["link", "url", "actionLink", "actionUrl", "data.link"]);
  if (link) return link;
  const text = (
    pick(n, ["type", "category", "event"]) +
    " " +
    pick(n, ["title"]) +
    " " +
    pick(n, ["message", "body", "text"])
  ).toLowerCase();
  const shiftId = idValue(
    pick(n, [
      "shift",
      "shiftId",
      "data.shiftId",
      "data.shift",
      "relatedShift",
      "metadata.shiftId",
    ]),
  );
  const W = "../WorkerShiftMarket/";
  const F = "../FacilityHiringSection/";
  if (role === "facility") {
    if (/applica|applied|applicant/.test(text))
      return (
        F +
        "Applicants.html" +
        (shiftId ? "?shift=" + encodeURIComponent(shiftId) : "")
      );
    if (/payment|fund|escrow|paid|payout/.test(text))
      return shiftId
        ? F + "FundShift.html?shift=" + encodeURIComponent(shiftId)
        : F + "Payments.html";
    if (/verif|document|approv|reject/.test(text))
      return F + "FacilityProfile.html";
    if (shiftId)
      return F + "ShiftDetails.html?shift=" + encodeURIComponent(shiftId);
    return F + "Dashboard.html";
  }
  if (/accept|booked|clock|attendance|starts|reminder/.test(text) && shiftId)
    return W + "UpcomingShifts.html?shift=" + encodeURIComponent(shiftId);
  if (/applica|applied/.test(text)) return W + "MyApplications.html";
  if (/payment|payout|paid/.test(text)) return W + "Payments.html";
  if (/verif|document|approv|reject/.test(text)) return W + "Profile.html";
  if (shiftId)
    return W + "ShiftDetails.html?shift=" + encodeURIComponent(shiftId);
  return W + "Dashboard.html";
}

// "Today" | "Yesterday" | "Earlier", from the date
function notificationGroup(date) {
  if (isNaN(date)) return "Earlier";
  const day = function (d) {
    return d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  };
  const today = day(new Date());
  const yesterday = day(new Date(Date.now() - 86400000));
  if (day(date) === today) return "Today";
  if (day(date) === yesterday) return "Yesterday";
  return "Earlier";
}

// The notifications page list: [ { id, group, title, text, time, actionText, actionLink, read } ]
Backend.notifications = async function () {
  const role = sessionGet("userType");
  const data = await apiFirst([
    [ENDPOINTS.notifications, "GET"],
    ["/api/notifications/v1/my-notifications", "GET"],
  ]);
  const list = asList(data, ["notifications", "data", "items"]);
  return list
    .map(function (n) {
      const created = new Date(
        pick(n, ["createdAt", "date", "sentAt", "updatedAt"]),
      );
      const group = notificationGroup(created);
      const time = isNaN(created)
        ? ""
        : group +
          " · " +
          created.toLocaleString(
            "en-GB",
            group === "Earlier"
              ? {
                  day: "numeric",
                  month: "long",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Africa/Lagos",
                }
              : {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Africa/Lagos",
                },
          ) +
          " WAT";
      const type = String(pick(n, ["type", "category"])).replace(/[_-]+/g, " ");
      return {
        id: idOf(n),
        order: isNaN(created) ? 0 : created.getTime(),
        group: group,
        title: pick(
          n,
          ["title", "subject", "heading"],
          type ? type.charAt(0).toUpperCase() + type.slice(1) : "Notification",
        ),
        text: pick(n, ["message", "body", "text", "content", "description"]),
        time: time,
        actionText: pick(n, ["actionText", "action.label"], "View"),
        actionLink: notificationLink(n, role),
        read:
          pick(n, ["isRead", "read"], false) === true || !!pick(n, ["readAt"]),
      };
    })
    .sort(function (a, b) {
      return b.order - a.order;
    });
};

Backend.markNotificationRead = function (id) {
  return apiRequest(ENDPOINTS.markNotificationRead(id), "PATCH");
};

Backend.markAllNotificationsRead = function () {
  return apiRequest(ENDPOINTS.markAllNotificationsRead, "PATCH");
};

// ==================================================
// 9. WORKER PAYMENTS (booked shifts + GET /api/payouts/v1/history)
// ==================================================
// One payment per booked shift. Status: "funds_secured" (booked, not completed yet),
// "processing" (shift completed, payout on its way) and "paid" (payout succeeded).

function payoutAmount(p) {
  const kobo = pick(p, ["amountKobo", "workerPayoutAmountKobo"], "");
  if (kobo !== "") return Number(kobo) / 100;
  return Number(pick(p, ["amount", "payoutAmount", "netAmount"], 0));
}

function payoutStatusOf(p) {
  const s = String(
    pick(p, ["status", "transferStatus", "payoutStatus"]),
  ).toLowerCase();
  if (/success|paid|complete|sent/.test(s)) return "paid";
  if (/fail|revers|declin/.test(s)) return "failed";
  return "processing";
}

async function loadWorkerPayments() {
  const results = await Promise.all([
    loadMyApplicationsRaw().catch(function () {
      return [];
    }),
    apiRequest(ENDPOINTS.payoutHistory).catch(function () {
      return [];
    }),
  ]);
  const booked = results[0].filter(isAccepted);
  const payouts = asList(results[1], ["payouts", "data", "history"]);
  const byShift = {};
  payouts.forEach(function (p) {
    const id = idValue(pick(p, ["shift", "shiftId"]));
    if (id) byShift[id] = p;
  });
  const used = {};
  const payments = booked.map(function (app) {
    const s = applicationShift(app);
    const id = applicationShiftId(app);
    const payout = byShift[id];
    if (payout) used[id] = true;
    let status = "funds_secured";
    if (String(pick(s, ["status"])) === "completed") status = "processing";
    if (payout)
      status = payoutStatusOf(payout) === "paid" ? "paid" : "processing";
    const paidAt = payout
      ? pick(payout, ["paidAt", "completedAt", "updatedAt"])
      : "";
    return {
      id: id,
      title: shiftTitle(s),
      facility: shiftFacilityName(s),
      place: pick(s, ["location"]),
      date: shortDate(pick(s, ["shiftDate", "date"])),
      time: pick(s, ["startTime"]) + "–" + pick(s, ["endTime"]) + " WAT",
      amount: payout ? payoutAmount(payout) || payForShift(s) : payForShift(s),
      deductions: 0,
      status: status,
      reference: payout
        ? pick(payout, [
            "reference",
            "transferReference",
            "transferCode",
            "_id",
          ])
        : "",
      paidOn:
        status === "paid" && paidAt
          ? new Date(paidAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "",
    };
  });
  // Payouts for shifts not in the applications list
  payouts.forEach(function (p) {
    const id = idValue(pick(p, ["shift", "shiftId"]));
    if (id && used[id]) return;
    const s = typeof p.shift === "object" && p.shift ? p.shift : {};
    payments.push({
      id: id || idOf(p),
      title: idOf(s) ? shiftTitle(s) : "Shift payment",
      facility: idOf(s) ? shiftFacilityName(s) : "",
      place: pick(s, ["location"]),
      date: shortDate(pick(s, ["shiftDate"]) || pick(p, ["createdAt"])),
      time: idOf(s)
        ? pick(s, ["startTime"]) + "–" + pick(s, ["endTime"]) + " WAT"
        : "",
      amount: payoutAmount(p),
      deductions: 0,
      status: payoutStatusOf(p) === "paid" ? "paid" : "processing",
      reference: pick(p, ["reference", "transferReference", "_id"]),
      paidOn: pick(p, ["paidAt"])
        ? new Date(p.paidAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "",
    });
  });
  return payments;
}

Backend.workerPayments = async function () {
  const payments = await loadWorkerPayments();
  const sum = function (status) {
    const list = payments.filter(function (p) {
      return p.status === status;
    });
    return {
      total: list.reduce(function (n, p) {
        return n + p.amount;
      }, 0),
      count: list.length,
    };
  };
  const secured = sum("funds_secured");
  const processing = sum("processing");
  const paid = sum("paid");
  const name = sessionGet("displayName") || "";
  return {
    summary: {
      pending: nairaText(secured.total),
      pendingNote:
        secured.count +
        (secured.count === 1 ? " booked shift" : " booked shifts") +
        " awaiting payment",
      processing: nairaText(processing.total),
      processingNote: "On its way to your bank",
      received: nairaText(paid.total),
      receivedNote:
        paid.count +
        (paid.count === 1 ? " payment" : " payments") +
        " received",
    },
    account: null, // no bank details endpoint yet
    accountName: name,
    payments: payments,
  };
};

Backend.workerPayment = async function (id) {
  const payments = await loadWorkerPayments();
  const payment = payments.find(function (p) {
    return p.id === id;
  });
  return payment
    ? Object.assign({ account: "Your bank account" }, payment)
    : null;
};

// Report a problem with a shift's payment = a dispute
Backend.raiseDispute = function (shiftId, reason, description) {
  return apiRequest(ENDPOINTS.raiseDispute, "POST", {
    shiftId: shiftId,
    reason: reason,
    description: description,
  });
};

// ==================================================
// 10. ADMIN: DISPUTES (GET get-all-disputes, GET rget-dispute/{id})
// ==================================================

function disputeView(d) {
  const s = typeof d.shift === "object" && d.shift ? d.shift : {};
  const raisedBy = pick(d, [
    "raisedBy.fullName",
    "raisedBy.facilityName",
    "raisedBy.name",
    "raisedBy.email",
    "user.fullName",
    "user.email",
  ]);
  const role = String(
    pick(d, ["raisedByRole", "raisedBy.role", "role", "user.role"]),
  ).toLowerCase();
  const status = String(pick(d, ["status"], "open"));
  const created = pick(d, ["createdAt"]);
  return {
    id: idOf(d),
    parties:
      [raisedBy, idOf(s) ? shiftFacilityName(s) : ""]
        .filter(Boolean)
        .join(" / ") || "—",
    issue: pick(d, ["reason", "title", "issue"], "Dispute"),
    status: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "),
    fields: {
      title: "Dispute " + String(idOf(d)).slice(-6).toUpperCase(),
      subtitle: [
        pick(d, ["reason", "title"], "Dispute"),
        raisedBy
          ? "raised by " + raisedBy + (role ? " (" + role + ")" : "")
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      shift:
        "Shift: " +
        (idOf(s)
          ? shiftTitle(s) +
            " · " +
            shortDate(pick(s, ["shiftDate"])) +
            " · " +
            pick(s, ["startTime"]) +
            "–" +
            pick(s, ["endTime"]) +
            " WAT"
          : idValue(pick(d, ["shift", "shiftId"])) || "—"),
      amount: idOf(s)
        ? "Amount: " + nairaText(payForShift(s)) + " per worker"
        : "Amount: —",
      openedAt: created
        ? new Date(created).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Africa/Lagos",
          })
        : "—",
      status:
        status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "),
      // The person who raised it explains what happened; the other side hasn't replied (no endpoint yet)
      workerStatement: role.includes("facility")
        ? "No statement yet."
        : "“" + pick(d, ["description", "details", "message"], "—") + "”",
      facilityStatement: role.includes("facility")
        ? "“" + pick(d, ["description", "details", "message"], "—") + "”"
        : "No statement yet.",
    },
    timeline: asList(pick(d, ["timeline", "history", "notes"], []), []).map(
      function (t) {
        return typeof t === "string"
          ? t
          : [
              pick(t, ["at", "createdAt"])
                ? new Date(pick(t, ["at", "createdAt"])).toLocaleString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )
                : "",
              pick(t, ["text", "note", "message", "event"]),
            ]
              .filter(Boolean)
              .join(" — ");
      },
    ),
  };
}

Backend.disputes = async function () {
  return asList(await apiRequest(ENDPOINTS.allDisputes), [
    "disputes",
    "data",
  ]).map(disputeView);
};

Backend.dispute = async function (id) {
  const data = await apiFirst([
    [ENDPOINTS.oneDispute(id), "GET"],
    ["/api/disputes/v1/get-dispute/" + id, "GET"],
  ]);
  return disputeView((data && data.dispute) || data);
};
