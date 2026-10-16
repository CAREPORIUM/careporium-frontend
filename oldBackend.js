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
  return localStorage.getItem("userId") || "";
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

// Log in. Saves the session and gives back what the login page needs.
Backend.login = async function (email, password) {
  const data = await apiRequest(ENDPOINTS.login, "POST", {
    email: email,
    password: password,
  });
  const user = data.user || {};
  return {
    token: data.token,
    userId: idOf(user),
    userType: toUserType(user.role),
    // CHECK: isVerified is read as "the email address has been confirmed with the code"
    emailConfirmed: user.isVerified !== false,
  };
};

// Save a logged-in session in the browser
Backend.saveSession = function (result, email) {
  localStorage.setItem("authToken", result.token);
  localStorage.setItem("userType", result.userType);
  localStorage.setItem("userId", result.userId);
  localStorage.setItem("userEmail", email);
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

// Facility sign-up. The backend needs the account, the address AND the 3 documents together,
// so facilityProfile.js keeps the account details until the registration page has the rest.
Backend.registerFacility = async function (account, place, files) {
  const form = new FormData();
  form.append("facilityName", account.facilityName);
  form.append("facilityType", account.facilityTypeLabel);
  form.append("email", account.businessEmail);
  form.append("phoneNumber", account.phone);
  form.append("password", account.password);
  form.append("location.address", place.street);
  form.append("location.city", place.city);
  form.append("location.state", place.state);
  form.append("location.country", place.country);
  if (account.secondaryPhone) {
    form.append("secondaryContact.phoneNumber", account.secondaryPhone);
  }
  form.append("businessRegCert", files.registrationDoc);
  form.append("facilityLicense", files.licenseDoc);
  form.append("taxID", files.tinDoc);
  return await apiRequest(ENDPOINTS.registerFacility, "POST", form);
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
// 2. VERIFICATION STATUS (worked out from the profile)
// ==================================================
// The backend has no separate "verification status" endpoint, so we read the worker or facility
// profile and work it out from the documents.

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

// One document from a profile: { url, status, comment }.
// CHECK: where the documents sit in the profile (e.g. profile.professionalLicense or profile.documents.professionalLicense)
function documentOf(profile, key) {
  const doc = pick(profile, ["documents." + key, key], null);
  if (!doc) {
    return null;
  }
  if (typeof doc === "string") {
    return { url: doc, status: "pending", comment: "" };
  }
  return {
    url: pick(doc, ["url", "documentUrl", "fileUrl", "secure_url"]),
    status: pick(
      doc,
      ["verificationStatus", "documentVerificationStatus", "status"],
      "pending",
    ),
    comment: pick(doc, ["verificationComment", "comment"]),
  };
}

function documentsOf(profile, labels) {
  return Object.keys(labels).map(function (key) {
    return Object.assign(
      { key: key, label: labels[key] },
      documentOf(profile, key) || { url: "", status: "missing", comment: "" },
    );
  });
}

Backend.myProfile = async function () {
  const type = localStorage.getItem("userType");
  if (type === "facility") {
    return await apiRequest(ENDPOINTS.facilityProfile);
  }
  return await apiRequest(ENDPOINTS.workerOwnProfile(myUserId()));
};

// Gives back { status, feedback, welcome } in the shape the pages use (see api.js)
Backend.verificationStatus = async function () {
  const type = localStorage.getItem("userType");
  const profile = await Backend.myProfile();
  const docs = documentsOf(
    profile,
    type === "facility" ? FACILITY_DOCUMENTS : WORKER_DOCUMENTS,
  );
  const uploaded = docs.filter(function (d) {
    return d.url;
  });
  const rejected = docs.filter(function (d) {
    return d.status === "rejected";
  });

  // CHECK: the overall status field name (the admin endpoints mention an "overall verification status")
  let status = String(
    pick(
      profile,
      ["verificationStatus", "overallVerificationStatus", "status"],
      "pending",
    ),
  ).toLowerCase();
  if (status === "approved") status = "verified";
  if (uploaded.length === 0 && status !== "verified") status = "not_submitted";
  if (rejected.length > 0) status = "rejected";

  const name =
    type === "facility"
      ? pick(profile, ["facilityName", "name"])
      : String(pick(profile, ["fullName", "user.fullName", "name"])).split(
          " ",
        )[0];

  return {
    status: status,
    feedback: rejected
      .map(function (d) {
        return d.label + ": " + (d.comment || "needs to be uploaded again");
      })
      .join(" "),
    welcome: name ? "Welcome, " + name + "." : "Welcome.",
  };
};

// Health worker documents (from the credentials page)
Backend.uploadWorkerDocuments = function (files) {
  const form = new FormData();
  form.append("professionalLicense", files.licence);
  form.append("idDocument", files.id);
  form.append("educationCert", files.education);
  form.append("proofOfLocation", files.address);
  return apiRequest(ENDPOINTS.workerCredentials(myUserId()), "PUT", form);
};

// ==================================================
// 3. HEALTH WORKER: profile, shifts, applications
// ==================================================

// The worker's own profile page (data-field names on WorkerShiftMarket/Profile.html)
Backend.workerOwnProfile = async function () {
  const p = await apiRequest(ENDPOINTS.workerOwnProfile(myUserId()));
  const name = pick(p, ["fullName", "user.fullName", "name"], "");
  const years = pick(p, ["yearsOfExperience"], "");
  const docs = documentsOf(p, WORKER_DOCUMENTS);
  const docStatus = function (key) {
    const d = docs.find(function (x) {
      return x.key === key;
    });
    return d.status === "missing"
      ? "Not uploaded"
      : d.status.charAt(0).toUpperCase() + d.status.slice(1);
  };
  return {
    initials: name
      .split(" ")
      .map(function (w) {
        return w.charAt(0);
      })
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    name: name,
    headline: [pick(p, ["profession"]), pick(p, ["specialty"])]
      .filter(Boolean)
      .join(" · "),
    about: pick(p, ["about"], "Add a short introduction to your profile."),
    licence: "Professional licence · " + docStatus("professionalLicense"),
    specialty: pick(p, ["specialty"], "—"),
    experience:
      years === "" ? "—" : years + (Number(years) === 1 ? " year" : " years"),
    searchArea: pick(p, ["state", "address"], "—"),
    identityStatus: docStatus("idDocument"),
    licenceStatus: docStatus("professionalLicense"),
    certificates: docStatus("educationCert"),
    lastReviewed: "—",
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

// Find shifts. The backend filters by status, role (profession) and specialty;
// the other filters (location, date, type, minimum pay, search text) are applied here.
Backend.searchShifts = async function (filters) {
  const query = new URLSearchParams({ status: "open" });
  if (filters.profession && !/all|any/i.test(filters.profession))
    query.set("role", filters.profession);
  if (filters.specialty && !/all|any/i.test(filters.specialty))
    query.set("specialty", filters.specialty);

  const shifts = asList(
    await apiRequest(ENDPOINTS.searchShifts + "?" + query.toString()),
    ["shifts"],
  );
  return shifts.map(shiftCard).filter(function (card) {
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
      filters.type &&
      !/all|any/i.test(filters.type) &&
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
  const s = await apiRequest(ENDPOINTS.shift(shiftId));
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
    professional: "",
    licence: pick(s, ["reqCredentials"]),
    availability: when,
  };
};

// Apply for a shift. (The backend doesn't take a message yet, so the message isn't sent.)
Backend.applyToShift = async function (shiftId) {
  const result = await apiRequest(ENDPOINTS.applyToShift(shiftId), "POST");
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
  if (s === "accepted" || s === "approved") return "Accepted";
  if (s === "rejected" || s === "declined") return "Not selected";
  return "Under review";
}

// CHECK: whether each application comes with its shift populated ("shift" or "shiftId")
function applicationShift(app) {
  const s = pick(app, ["shift", "shiftId"], {});
  return typeof s === "object" ? s : {};
}

Backend.myApplications = async function () {
  const apps = asList(await apiRequest(ENDPOINTS.myApplications), [
    "applications",
  ]);
  return apps.map(function (app) {
    const s = applicationShift(app);
    return {
      id: idOf(app),
      title: shiftTitle(s),
      status: applicationStatusText(pick(app, ["status"])),
      shiftId: idOf(s) || pick(app, ["shiftId"]),
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

Backend.workerShift = async function (shiftId) {
  const apps = asList(await apiRequest(ENDPOINTS.myApplications), [
    "applications",
  ]);
  const accepted = apps.filter(function (a) {
    return applicationStatusText(pick(a, ["status"])) === "Accepted";
  });
  let app = shiftId
    ? accepted.find(function (a) {
        return (idOf(applicationShift(a)) || pick(a, ["shiftId"])) === shiftId;
      })
    : accepted
        .sort(function (a, b) {
          return String(pick(applicationShift(a), ["shiftDate"])).localeCompare(
            pick(applicationShift(b), ["shiftDate"]),
          );
        })
        .find(function (a) {
          return String(pick(applicationShift(a), ["status"])) !== "completed";
        });
  if (!app) {
    return null; // no booked shift
  }

  const id = idOf(applicationShift(app)) || pick(app, ["shiftId"]);
  const s = await apiRequest(ENDPOINTS.shift(id));
  const att = savedAttendance(id);

  // The time rules (clock-in opens 30 minutes before the start, etc.), in the user's time
  const day = String(pick(s, ["shiftDate", "date"])).slice(0, 10);
  const start = new Date(
    day + "T" + pick(s, ["startTime"], "00:00") + ":00+01:00",
  );
  let end = new Date(day + "T" + pick(s, ["endTime"], "00:00") + ":00+01:00");
  if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000);
  const opens = new Date(
    start.getTime() - SHIFT_RULES_LIVE.clockInOpensBefore * 60000,
  );
  const now = new Date();

  let attendance = "none";
  if (att.clockIn) attendance = "working";
  if (att.clockOut) attendance = "completed";
  if (String(pick(s, ["status"])) === "completed" && att.clockIn)
    attendance = "completed";

  let recorded = "";
  if (att.clockInAt && att.clockOutAt) {
    const minutes = Math.round(
      (new Date(att.clockOutAt) - new Date(att.clockInAt)) / 60000,
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
      }) + " WAT",
    clockInOpen: now >= opens && now < end,
    ended: now >= end,
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

// The Facility profile page boxes ← the backend's facility profile
Backend.facilityProfileForm = async function () {
  const p = await apiRequest(ENDPOINTS.facilityProfile);
  const loc = pick(p, ["location"], {});
  const contact = pick(p, ["secondaryContact"], {});
  return {
    facilityName: pick(p, ["facilityName"]),
    facilityType: Backend.facilityTypeLabel(pick(p, ["facilityType"])),
    cityState: [pick(loc, ["city"]), pick(loc, ["state"])]
      .filter(Boolean)
      .join(", "),
    address: pick(loc, ["address", "street"]),
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
    registrationStatus: "Status: " + pick(p, ["verificationStatus"], "pending"),
    identityStatus: "",
    workplaceLocation: [
      pick(loc, ["city"]),
      pick(loc, ["state"]),
      pick(loc, ["country"]),
    ]
      .filter(Boolean)
      .join(" · "),
  };
};

// The Facility profile page boxes → the backend
Backend.saveFacilityProfile = function (details) {
  const cityState = details.cityState.split(",");
  const contact = details.contactPerson.split("·");
  return apiRequest(ENDPOINTS.facilityProfileUpdate, "PUT", {
    facilityName: details.facilityName,
    facilityType: details.facilityType,
    location: {
      address: details.address,
      city: (cityState[0] || "").trim(),
      state: (cityState[1] || "").trim(),
    },
    secondaryContact: {
      fullName: (contact[0] || "").trim(),
      position: (contact[1] || "").trim(),
      email: details.workEmail,
      phoneNumber: details.phone.replace(/[\s-]/g, ""),
    },
  });
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
  // CHECK: if the backend sends a payment page address back, the facility is sent there to pay
  const created = result && (result.shift || result);
  return {
    id: idOf(created || {}),
    paymentUrl: pick(result || {}, [
      "payment.checkoutUrl",
      "payment.authorizationUrl",
      "payment.paymentUrl",
      "payment.url",
      "checkoutUrl",
      "paymentUrl",
    ]),
  };
};

// Backend shift status → the Manage shifts tabs
function facilityShiftStatus(shift) {
  const s = String(pick(shift, ["status"], "open")).toLowerCase();
  if (s === "completed") return "completed";
  if (s === "filled" || s === "confirmed") return "confirmed";
  return "open";
}

Backend.facilityShifts = async function () {
  const list = asList(await apiRequest(ENDPOINTS.facilityShifts), ["shifts"]);
  const shifts = list
    .filter(function (s) {
      return String(pick(s, ["status"])) !== "closed";
    })
    .map(function (s) {
      const status = facilityShiftStatus(s);
      const needed = Number(pick(s, ["professionalsNeeded"], 1));
      return {
        id: idOf(s),
        title: shiftTitle(s),
        urgent: pick(s, ["isUrgent"], false) === true,
        when:
          longDate(pick(s, ["shiftDate", "date"])) +
          " · " +
          pick(s, ["startTime"]) +
          "–" +
          pick(s, ["endTime"]) +
          " WAT",
        staffing:
          (status === "open"
            ? needed + (needed === 1 ? " person needed" : " people needed")
            : status === "confirmed"
              ? "All places filled"
              : "Completed") +
          " · " +
          nairaText(payForShift(s)) +
          " each",
        status: status,
      };
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
  };
};

// CHECK: how each application brings its worker (a populated "worker" or "workerId")
function applicationWorker(app) {
  const w = pick(app, ["worker", "workerId", "applicant"], {});
  return typeof w === "object" ? w : {};
}

// Applicants: all of the facility's, or one shift's
Backend.applicants = async function (shiftId) {
  const apps = asList(await apiRequest(ENDPOINTS.facilityApplicants), [
    "applications",
  ]);
  const forShift = apps.filter(function (a) {
    return (
      !shiftId ||
      (idOf(applicationShift(a)) || pick(a, ["shiftId"])) === shiftId
    );
  });
  return {
    waitingForReview: forShift.filter(function (a) {
      return applicationStatusText(pick(a, ["status"])) === "Under review";
    }).length,
    applicants: forShift.map(function (a) {
      const w = applicationWorker(a);
      const years = pick(w, ["yearsOfExperience"], "");
      return {
        applicationId: idOf(a),
        // CHECK: the worker profile endpoint takes the worker's USER id
        workerId: pick(w, ["user._id", "user", "userId", "_id"]),
        name: pick(w, ["fullName", "user.fullName", "name"], "Applicant"),
        details: [
          pick(w, ["profession"]),
          pick(w, ["specialty"]),
          years !== "" ? years + " years" : "",
        ]
          .filter(Boolean)
          .join(" · "),
        stats:
          "Application " +
          applicationStatusText(pick(a, ["status"])).toLowerCase() +
          " · " +
          shiftTitle(applicationShift(a)),
        latestRole: "",
        softSkills: [],
        shortlisted: false,
        accepted: applicationStatusText(pick(a, ["status"])) === "Accepted",
      };
    }),
  };
};

// A worker's profile, as the facility sees it (WorkerProfile.html data-fields)
Backend.workerForFacility = async function (userId) {
  const p = await apiRequest(ENDPOINTS.workerProfile(userId));
  const docs = documentsOf(p, WORKER_DOCUMENTS);
  const licence = docs[0];
  const years = pick(p, ["yearsOfExperience"], "");
  return {
    name: pick(p, ["fullName", "user.fullName", "name"]),
    summary: [
      pick(p, ["profession"]),
      pick(p, ["specialty"]),
      pick(p, ["state"]),
    ]
      .filter(Boolean)
      .join(" · "),
    specialty: [
      pick(p, ["specialty"]),
      years !== "" ? years + " years of experience" : "",
    ]
      .filter(Boolean)
      .join(" · "),
    licenceBody: "Professional licence",
    licenceStatus: "Status: " + licence.status,
    licenceNumber: "",
    certification1: "Education certificate · " + docs[2].status,
    certification2: "",
    education: "",
    review: "",
    reviewSource: "",
    rating: "No ratings yet",
    completedShifts: "",
    attendance: "",
    noShows: "",
    availability: "",
    availabilityNote: "",
  };
};

// "Offer shift" accepts the worker's application (the backend books the worker straight away)
Backend.acceptApplication = function (applicationId) {
  return apiRequest(ENDPOINTS.acceptApplication(applicationId), "PATCH");
};

Backend.rejectApplication = function (applicationId) {
  return apiRequest(ENDPOINTS.rejectApplication(applicationId), "PATCH");
};

// ==================================================
// 6. FACILITY: the shift page (workers, attendance QR, completing)
// ==================================================

Backend.facilityShift = async function (shiftId) {
  const s = await apiRequest(ENDPOINTS.shift(shiftId));
  const apps = asList(await apiRequest(ENDPOINTS.facilityApplicants), [
    "applications",
  ]).filter(function (a) {
    return (idOf(applicationShift(a)) || pick(a, ["shiftId"])) === shiftId;
  });
  const accepted = apps.filter(function (a) {
    return applicationStatusText(pick(a, ["status"])) === "Accepted";
  });
  const needed = Number(pick(s, ["professionalsNeeded"], 1));
  const status =
    String(pick(s, ["status"])) === "completed" ? "completed" : "active";

  // The attendance QR only once every place is accepted (like the designs)
  let qrValue = "";
  if (accepted.length >= needed && status !== "completed") {
    try {
      const qr = await apiRequest(ENDPOINTS.attendanceQr(shiftId));
      qrValue =
        typeof qr === "string"
          ? qr
          : pick(qr, ["qrToken", "token", "qr", "code"]);
    } catch (error) {
      qrValue = "";
    }
  }

  // Has the shift's end time passed? (Complete Shift unlocks then, since clock times aren't sent yet)
  const day = String(pick(s, ["shiftDate", "date"])).slice(0, 10);
  const start = new Date(
    day + "T" + pick(s, ["startTime"], "00:00") + ":00+01:00",
  );
  let end = new Date(day + "T" + pick(s, ["endTime"], "00:00") + ":00+01:00");
  if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000);

  return {
    id: shiftId,
    ended: new Date() >= end,
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
    qrValue: qrValue,
    backupCode: "", // the backend has no backup code yet
    attendanceKnown: false, // the backend doesn't send each worker's clock times yet
    workers: accepted.map(function (a) {
      const w = applicationWorker(a);
      return {
        id: idOf(a),
        name: pick(w, ["fullName", "user.fullName", "name"], "Worker"),
        role: pick(w, ["profession"], ""),
        offer: "accepted",
        attendance: status === "completed" ? "completed" : "none",
        clockIn: "",
        clockOut: "",
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

// The queue: the backend lists each document separately; the page shows one row per person
Backend.adminQueue = async function () {
  const items = asList(await apiRequest(ENDPOINTS.verifications), [
    "queue",
    "items",
  ]);
  const rows = {};
  items.forEach(function (item) {
    const key = item.type + ":" + idOf(item);
    if (!rows[key]) {
      rows[key] = {
        id: idOf(item),
        name: pick(item, ["name"], "Unnamed"),
        type: item.type,
        typeLabel: item.type === "facility" ? "Facility" : "Worker",
        submitted: pick(item, ["submittedAt"])
          ? new Date(item.submittedAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        order: pick(item, ["submittedAt"])
          ? new Date(item.submittedAt).getTime()
          : 0,
        status: "Pending",
        documents: 0,
      };
    }
    rows[key].documents += 1;
  });
  return Object.values(rows).map(function (row) {
    row.typeLabel +=
      " · " +
      row.documents +
      (row.documents === 1 ? " document" : " documents");
    return row;
  });
};

// One worker or facility for the review pages, with their documents
Backend.adminSubmission = async function (type, id) {
  const p = await apiRequest(
    type === "facility"
      ? ENDPOINTS.adminFacility(id)
      : ENDPOINTS.adminWorker(id),
  );
  const docs = documentsOf(
    p,
    type === "facility" ? FACILITY_DOCUMENTS : WORKER_DOCUMENTS,
  );
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
      documents: docs,
      fields: {
        subtitle: [
          Backend.facilityTypeLabel(pick(p, ["facilityType"])),
          pick(loc, ["city"]),
          pick(loc, ["state"]),
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
        contact: pick(p, ["facilityName"]),
        contactDetails: [
          pick(p, ["user.email", "email"]),
          pick(p, ["user.phoneNumber", "phoneNumber"]),
        ]
          .filter(Boolean)
          .join(" · "),
      },
    };
  }
  return {
    documents: docs,
    fields: {
      subtitle: [
        pick(p, ["user.fullName", "fullName"]),
        pick(p, ["profession"]),
        pick(p, ["specialty"]),
      ]
        .filter(Boolean)
        .join(" · "),
      licence: docLine(docs[0]),
      licenceDates: "",
      certification: docLine(docs[2]),
      identity: docLine(docs[1]) + " · " + docLine(docs[3]),
      experience:
        pick(p, ["yearsOfExperience"], "") !== ""
          ? pick(p, ["yearsOfExperience"]) + " years of experience"
          : "",
    },
  };
};

// Approve: mark every uploaded document as verified.
// Reject: mark every document that isn't verified yet as rejected, with the reason.
// (The backend reviews one document at a time, so we send one request per document.)
Backend.adminDecide = async function (type, id, decision, reason) {
  const submission = await Backend.adminSubmission(type, id);
  const path =
    type === "facility"
      ? ENDPOINTS.adminFacilityDocuments(id)
      : ENDPOINTS.adminWorkerDocuments(id);
  for (const doc of submission.documents) {
    if (!doc.url) continue;
    if (decision === "verified" && doc.status === "verified") continue;
    if (decision === "rejected" && doc.status === "verified") continue;
    const body = { documentType: doc.key, status: decision };
    if (decision === "rejected") body.comment = reason;
    await apiRequest(path, "PATCH", body);
  }
};

// Manage users: the backend has two lists (workers and facilities); the page shows one
Backend.adminUsers = async function () {
  const workers = asList(await apiRequest(ENDPOINTS.adminWorkers), ["workers"]);
  const facilities = asList(await apiRequest(ENDPOINTS.adminFacilities), [
    "facilities",
  ]);
  const verification = function (p) {
    return String(
      pick(p, ["verificationStatus", "overallVerificationStatus"], "pending"),
    ).toLowerCase() === "verified"
      ? "Verified"
      : "Pending";
  };
  return workers
    .map(function (w) {
      return {
        id: idOf(w),
        name: pick(w, ["user.fullName", "fullName"], "Worker"),
        role: "Worker",
        email: pick(w, ["user.email", "email"]),
        verification: verification(w),
        access: "Active",
        details: [pick(w, ["profession"]), pick(w, ["specialty"])]
          .filter(Boolean)
          .join(" · "),
      };
    })
    .concat(
      facilities.map(function (f) {
        return {
          id: idOf(f),
          name: pick(f, ["facilityName"], "Facility"),
          role: "Facility",
          email: pick(f, ["user.email", "email"]),
          verification: verification(f),
          access: "Active",
          details: [
            Backend.facilityTypeLabel(pick(f, ["facilityType"])),
            pick(f, ["location.city"]),
          ]
            .filter(Boolean)
            .join(" · "),
        };
      }),
    );
};
