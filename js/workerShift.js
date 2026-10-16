// ====== WORKER SHIFT PAGE (offer → clock in → working → clock out → done) ======
// Needs /js/api.js and /js/shifts.js first, and the QR reading library (jsQR).
//
// The page shows one "view" at a time, worked out from the shift's data (see pickView):
//   offered, declined, expired, confirmed (clock-in not open yet), ready (can clock in),
//   scanning (camera), code (typing the backup code), error, working, completed,
//   noshow, missed (shift ended without a clock-in), none (no upcoming shift)

const DASHBOARD_PAGE = "../WorkerShiftMarket/Dashboard.html";
const FIND_SHIFTS_PAGE = "../WorkerShiftMarket/FindShifts.html";

// Which shift: from the address (UpcomingShifts.html?shift=CP-1042), or the next upcoming one
const requestedShift = getUrlValue("shift");

let myShift = null; // the shift, as the server (or the demo) sends it

// The 6-digit backup code works in demo mode, or once the backend has it (SERVER_HAS in api.js).
// With the real backend before that, the worker can paste the attendance code shown under the
// facility's QR (it's the QR's own text), so "Enter the code" is always offered.
const codeAvailable = true;
const longCode = !USE_DEMO_MODE && usesDemo("backupCode");
let currentView = "loading";
let currentError = null; // which error is showing (see ERRORS)

// ==================================================
// THE ERRORS (all use the same red layout)
// ==================================================

// buttons: which buttons to show under the message
const ERRORS = {
  wrong_shift: { title: "This QR doesn't match your shift", text: "Ask the coordinator for the QR for shift {id}, then try again.", buttons: ["scanAgain", "backToShift"] },
  code_wrong: { title: "This code doesn't match your shift", text: "Check the 6-digit code under the QR for shift {id}, then try again.", buttons: ["typeAgain", "backToShift"] },
  too_early: { title: "Clock-in isn't open yet", text: "Clock-in opens at {opens}. Please try again then.", buttons: ["backToShift"] },
  ended: { title: "This shift has ended", text: "You can't clock in after the shift ends. Ask the coordinator to update your attendance.", buttons: ["backToShift"] },
  expired: { title: "This QR has expired", text: "Ask the coordinator to refresh the QR on their screen, then scan again.", buttons: ["scanAgain", "backToShift"] },
  camera_blocked: { title: "Camera access is off", text: "Allow camera access for this site in your browser settings, or enter the code instead.", buttons: ["scanAgain", "typeCode"] },
  camera_unavailable: { title: "We can't open a camera here", text: "This device or browser can't use a camera for scanning. Enter the code instead.", buttons: ["typeCode", "backToShift"] },
  already_clocked_in: { title: "You're already clocked in", text: "Your clock-in time is already recorded for this shift.", buttons: ["toMyShift"] },
  offline: { title: "You're offline", text: "Connect to the internet and try again. Nothing was recorded.", buttons: ["scanAgain", "backToShift"] },
  other: { title: "Something went wrong", text: "{message}", buttons: ["scanAgain", "backToShift"] },
};

// The buttons the error screen can show
const ERROR_BUTTONS = {
  scanAgain: ["Try scanning again", "scanning", "blue"],
  typeAgain: ["Enter the code again", "code", "blue"],
  typeCode: ["Enter code instead", "code", "outline"],
  backToShift: ["Back to shift", "back", "outline"],
  toMyShift: ["Go to my shift", "back", "blue"],
};

// ==================================================
// HELPERS FOR DRAWING
// ==================================================

const BLUE_BUTTON = "block w-full bg-blue-600 text-white text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-700";
const OUTLINE_BUTTON = "block w-full border border-blue-600 text-blue-600 text-sm font-medium text-center py-3 rounded-lg hover:bg-blue-50";
const GREY_BUTTON = "block w-full bg-slate-200 text-gray-600 text-sm font-medium text-center py-3 rounded-lg cursor-not-allowed";

// The colored box at the top: "blue", "green", "red", "amber" or "gray"
function setBanner(color, title, text) {
  const colors = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    red: "bg-red-50 border-red-100",
    amber: "bg-amber-50 border-amber-100",
    gray: "bg-white border-gray-200",
  };
  const banner = document.getElementById("stateBanner");
  banner.className = "border rounded-2xl p-6 mt-5 " + colors[color];
  banner.classList.remove("hidden");
  document.getElementById("bannerTitle").textContent = title;
  document.getElementById("bannerText").textContent = text;
}

// The "Your attendance" card
function attendanceCard(extraHtml) {
  return `
    <section class="bg-white border border-gray-200 rounded-2xl p-6 mt-5">
      <h2 class="text-lg font-semibold">Your attendance</h2>
      <div class="text-xs text-gray-700 space-y-1 mt-3">
        <p>Clock in: ${escapeHtml(myShift.clockIn || "Not yet")}</p>
        <p>Clock out: ${escapeHtml(myShift.clockOut || "Not yet")}</p>
        ${myShift.recordedTime ? `<p>Recorded time: ${escapeHtml(myShift.recordedTime)}</p>` : ""}
      </div>
      ${extraHtml}
    </section>`;
}

// Fill in the {id}, {opens} and {message} parts of a message
function fillIn(text, message) {
  return text
    .replace("{id}", myShift ? myShift.id : "")
    .replace("{opens}", myShift ? myShift.clockInOpensAt : "")
    .replace("{message}", message || "Please try again.");
}

// ==================================================
// WHICH VIEW TO SHOW
// ==================================================

// Work out the view from the shift's data (used after loading and after every action)
function pickView() {
  if (!myShift) return "none";
  if (myShift.offer === "awaiting") return "offered";
  if (myShift.offer === "declined") return "declined";
  if (myShift.offer === "expired" || myShift.offer === "replaced") return "expired";
  if (myShift.attendance === "noshow") return "noshow";
  if (myShift.attendance === "completed" || myShift.attendance === "fixed") return "completed";
  if (myShift.attendance === "working") return "working";
  if (myShift.ended) return "missed";
  if (myShift.clockInOpen) return "ready";
  return "confirmed";
}

function show(view, errorName, message) {
  // Leaving the scanner: switch the camera off
  if (currentView === "scanning" && view !== "scanning") {
    stopCamera();
  }
  currentView = view;
  currentError = errorName || null;
  render(message);
}

// ==================================================
// DRAWING THE PAGE
// ==================================================

function render(message) {
  const card = document.getElementById("stateCard");
  document.getElementById("pageLoading").classList.add("hidden");
  document.getElementById("scanView").classList.add("hidden");
  document.getElementById("codeView").classList.add("hidden");
  card.innerHTML = "";

  if (currentView === "none") {
    document.getElementById("shiftTitle").textContent = "Upcoming shifts";
    setBanner("gray", "You don't have an upcoming shift", "When a facility books you, the shift will appear here with everything you need to clock in.");
    card.innerHTML = `<a href="${FIND_SHIFTS_PAGE}" class="${BLUE_BUTTON} mt-5">Find shifts</a>`;
    return;
  }

  // The heading
  document.getElementById("shiftTitle").textContent = myShift.title;
  document.getElementById("shiftFacility").textContent = myShift.facilityLine;
  document.getElementById("shiftWhen").textContent = myShift.whenLine;
  const facility = myShift.facilityName;

  if (currentView === "offered") {
    setBanner("blue", "You've been offered this shift", facility + " would like to book you. Accept to confirm your place. This offer expires in " + myShift.offerExpiresIn + ".");
    card.innerHTML = `
      <section class="bg-white border border-gray-200 rounded-2xl p-6 mt-5">
        <h2 class="text-lg font-semibold">Shift details</h2>
        <div class="text-xs text-gray-700 space-y-1 mt-3">
          <p>${escapeHtml(myShift.payLine)}</p>
          <p>${escapeHtml(myShift.arrival)}</p>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-5">
          <button type="button" data-go="decline" class="${OUTLINE_BUTTON}">Decline</button>
          <button type="button" data-go="accept" class="${BLUE_BUTTON}">Accept shift</button>
        </div>
      </section>`;
  }

  if (currentView === "declined" || currentView === "expired") {
    const declined = currentView === "declined";
    setBanner("gray",
      declined ? "You declined this offer" : "This offer is no longer available",
      declined ? facility + " has been told. You can find other shifts that fit your schedule." : "The offer expired or the place was given to someone else.");
    card.innerHTML = `<a href="${FIND_SHIFTS_PAGE}" class="${BLUE_BUTTON} mt-5">Find shifts</a>`;
  }

  if (currentView === "confirmed") {
    setBanner("blue", "You're booked", "Clock-in opens at " + myShift.clockInOpensAt + ". " + myShift.arrival);
    card.innerHTML = attendanceCard(`
      <button type="button" class="${GREY_BUTTON} mt-5" disabled>Clock in</button>
      <p class="text-xs text-gray-700 mt-3">The Clock in button turns on at ${escapeHtml(myShift.clockInOpensAt)}. You'll scan the QR displayed by ${escapeHtml(facility)}.</p>`);
  }

  if (currentView === "ready") {
    setBanner("blue", "Ready to clock in", "You can clock in now. Scan the QR displayed by " + facility + " when you arrive.");
    card.innerHTML = attendanceCard(`<button type="button" data-go="scanning" class="${BLUE_BUTTON} mt-5">Clock in</button>`);
  }

  if (currentView === "scanning") {
    if (scanPurpose === "out") {
      setBanner("blue", "Scan to clock out", "Scan the QR displayed by " + facility + " again to record your finish time.");
    } else {
      setBanner("blue", "Clock in for your shift", "Scan the QR displayed by " + facility + ".");
    }
    document.getElementById("scanView").classList.remove("hidden");
    // Hide "Camera not working? Enter the code instead" when the backup code isn't available
    document.querySelector('#scanView [data-go="code"]').classList.toggle("hidden", !codeAvailable);
    document.getElementById("allowCamera").classList.remove("hidden");
  }

  if (currentView === "code") {
    if (longCode) {
      setBanner("blue", "Enter the attendance code", "Ask the coordinator at " + facility + " for the attendance code shown under the QR, then paste it here.");
    } else {
      setBanner("blue", "Enter the backup code", "Ask the coordinator for the 6-digit code shown under the QR at " + facility + ".");
    }
    document.getElementById("codeView").classList.remove("hidden");
    document.getElementById("backupCodeInput").value = "";
  }

  if (currentView === "error") {
    const error = ERRORS[currentError] || ERRORS.other;
    // Without the backup code on the server, don't offer "Enter code instead"
    const buttonNames = codeAvailable ? error.buttons : error.buttons.filter(function (name) {
      return name !== "typeCode" && name !== "typeAgain";
    });
    setBanner("red", error.title, fillIn(error.text, message));
    const buttons = (buttonNames.length ? buttonNames : ["backToShift"]).map(function (name) {
      const b = ERROR_BUTTONS[name];
      return `<button type="button" data-go="${b[1]}" class="${b[2] === "blue" ? BLUE_BUTTON : OUTLINE_BUTTON}">${b[0]}</button>`;
    }).join("");
    card.innerHTML = `
      <p class="text-xs text-gray-700 mt-5">You haven't been clocked in. Your attendance record hasn't changed.</p>
      <div class="space-y-3 mt-5">${buttons}</div>`;
  }

  if (currentView === "working") {
    if (myShift.clockOutMissing) {
      setBanner("amber", "You haven't clocked out yet", "Your shift has ended. Clock out now, or the facility will add your finish time for you.");
    } else {
      setBanner("blue", "Working", "You're clocked in. Clock out when your work is finished.");
    }
    card.innerHTML = attendanceCard(`
      <p class="text-xs text-gray-700 mt-3">Keep this page handy. Your clock-out time will be added to your attendance record.</p>
      <button type="button" data-go="clockOut" class="${BLUE_BUTTON} mt-5">Clock Out</button>`);
  }

  if (currentView === "completed") {
    setBanner("green", "Attendance completed", "You've clocked out. The facility will complete the shift after all assigned workers finish.");
    let note = "No further clock-in or clock-out action is needed.";
    if (myShift.attendance === "fixed") {
      note = "Your clock-out time was added by the facility" + (myShift.fixReason ? " (" + myShift.fixReason + ")" : "") +
        ". If it's wrong, contact Careporium support within 48 hours.";
    }
    card.innerHTML = attendanceCard(`
      <p class="text-xs text-gray-700 mt-3">${escapeHtml(note)}</p>
      <a href="${DASHBOARD_PAGE}" class="${OUTLINE_BUTTON} mt-5">Back to dashboard</a>`);
  }

  if (currentView === "noshow" || currentView === "missed") {
    const noshow = currentView === "noshow";
    setBanner("red",
      noshow ? "Marked as a no-show" : "You didn't clock in for this shift",
      noshow ? facility + " marked you as a no-show. If this is wrong, contact Careporium support within 48 hours."
             : "The shift has ended. If you worked it, ask the coordinator to update your attendance.");
    card.innerHTML = `<a href="${DASHBOARD_PAGE}" class="${OUTLINE_BUTTON} mt-5">Back to dashboard</a>`;
  }
}

// ==================================================
// LOADING
// ==================================================

async function loadMyShift() {
  if (USE_DEMO_MODE) {
    myShift = demoWorkerShift();
  } else {
    // REAL: one shift by its id, or the next booked one (backend.js puts it together from the
    // worker's accepted application and the shift)
    try {
      myShift = await Backend.workerShift(requestedShift);
    } catch (error) {
      showGeneralError("Couldn't load your shift: " + error.message);
      myShift = null;
    }
  }
  show(pickView());
}

loadMyShift();

// DEMO: redraw when the facility page (in another tab) changes the demo shift,
// unless the worker is in the middle of scanning or typing
if (USE_DEMO_MODE) {
  window.addEventListener("storage", function (event) {
    if (event.key === DEMO_SHIFT_KEY && currentView !== "scanning" && currentView !== "code") {
      loadMyShift();
    }
  });
}

// ==================================================
// ACTIONS: accept, decline, clock in, clock out
// ==================================================

// Run one action on the server (REAL) or on the demo shift (DEMO), then redraw.
// The server answers with the updated shift. If it refuses, it sends a "reason" (see clock-in).
// serverCall: a function that does the action on the real backend and gives back the updated shift
async function runAction(serverCall, demoChange) {
  if (USE_DEMO_MODE) {
    const shift = getDemoShift();
    const problem = demoChange(shift, demoWorker(shift, DEMO_WORKER_ID));
    if (problem) {
      return problem; // the name of an error
    }
    saveDemoShift(shift);
    myShift = demoWorkerShift();
    return null;
  }

  try {
    myShift = await serverCall();
    return null;
  } catch (error) {
    if (!error.status) {
      return "offline"; // the request never reached the server
    }
    return error.reason || { message: error.message };
  }
}

// DEMO: check a scanned QR or typed code the way the server would
function demoCheckCode(shift, me, code, typed) {
  const now = timeToMinutes(shift.demoTime);
  const opens = timeToMinutes(shift.start) - SHIFT_RULES.clockInOpensBefore;
  if (me.attendance === "working") return "already_clocked_in";
  if (now < opens) return "too_early";
  if (now >= timeToMinutes(shift.end)) return "ended";
  const matches = typed ? code === shift.backupCode : code === shift.qrValue;
  if (!matches) return typed ? "code_wrong" : "wrong_shift";
  me.attendance = "working";
  me.clockIn = shift.demoTime;
  return null;
}

// Send a scanned QR (or a typed backup code) to clock in
// What the next scan is for: "in" (clock in), or "out" when the backend asked for a fresh QR to clock out
let scanPurpose = "in";

async function clockIn(code, typed) {
  const purpose = scanPurpose;
  const problem = await runAction(function () {
    return purpose === "out" ? Backend.clockOut(myShift.id, code) : Backend.clockIn(myShift.id, code);
  }, function (shift, me) {
    return demoCheckCode(shift, me, code, typed);
  });
  scanPurpose = "in";

  if (problem === null) {
    show(pickView()); // → "Working"
  } else if (typeof problem === "string") {
    show("error", problem);
  } else {
    show("error", "other", problem.message);
  }
}

// Every button with data-go="..." on the page
document.addEventListener("click", async function (event) {
  const button = event.target.closest("[data-go]");
  if (!button) {
    return;
  }
  const go = button.getAttribute("data-go");

  if (go === "accept" || go === "decline") {
    if (go === "decline" && !confirm("Decline this shift? The facility will offer it to someone else.")) {
      return;
    }
    setLoading(button, true, go === "accept" ? "Accepting…" : "Declining…");
    const problem = await runAction(function () {
      // Not on the backend yet: there, the facility accepts the application and the shift is booked
      throw new Error("Accepting or declining offers isn't available on the server yet.");
    }, function (shift, me) {
      me.offer = go === "accept" ? "accepted" : "declined";
    });
    if (problem) {
      showGeneralError(typeof problem === "string" ? "You're offline. Please try again." : problem.message);
      setLoading(button, false);
      return;
    }
    show(pickView());
  }

  if (go === "scanning") show("scanning");
  if (go === "code") show("code");
  if (go === "back") show(pickView());

  if (go === "clockOut") {
    if (!confirm("Clock out now? Your finish time will be recorded.")) {
      return;
    }
    setLoading(button, true, "Clocking out…");
    const problem = await runAction(function () {
      return Backend.clockOut(myShift.id);
    }, function (shift, me) {
      me.attendance = "completed";
      me.clockOut = shift.demoTime;
    });
    // REAL: the backend wants a QR to clock out too. If the one from clock-in isn't accepted
    // any more (e.g. it expired), ask the worker to scan the facility's QR again.
    if (problem && problem !== "offline" && !USE_DEMO_MODE) {
      setLoading(button, false);
      scanPurpose = "out";
      show("scanning");
      return;
    }
    if (problem) {
      showGeneralError(typeof problem === "string" ? "You're offline. Nothing was recorded. Please try again." : problem.message);
      setLoading(button, false);
      return;
    }
    show(pickView()); // → "Attendance completed"
  }
});

// ==================================================
// THE CAMERA SCANNER (jsQR library)
// ==================================================

let cameraStream = null; // the camera, while it's on
const video = document.getElementById("scanVideo");
const canvas = document.createElement("canvas"); // used to read each camera picture

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(function (track) { track.stop(); });
    cameraStream = null;
  }
  video.classList.add("hidden");
}

// Look at the camera picture again and again until a QR code is found
function scanFrame() {
  if (!cameraStream || currentView !== "scanning") {
    return;
  }
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const picture = context.getImageData(0, 0, canvas.width, canvas.height);
    const found = jsQR(picture.data, picture.width, picture.height);
    if (found && found.data) {
      stopCamera();
      clockIn(found.data, false);
      return;
    }
  }
  requestAnimationFrame(scanFrame);
}

document.getElementById("allowCamera").addEventListener("click", async function () {
  // Cameras only work on secure (https) pages, and need a browser that supports them
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    show("error", "camera_unavailable");
    return;
  }

  try {
    // "environment" = the back camera on phones
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (error) {
    // NotAllowedError = the user (or the browser) said no; anything else = no camera
    show("error", error.name === "NotAllowedError" ? "camera_blocked" : "camera_unavailable");
    return;
  }

  video.srcObject = cameraStream;
  video.classList.remove("hidden");
  document.getElementById("allowCamera").classList.add("hidden");
  await video.play();
  requestAnimationFrame(scanFrame);
});

// Read the QR from a photo or screenshot (for laptops without a camera)
const qrPhoto = document.getElementById("qrPhoto");
if (qrPhoto) {
  qrPhoto.addEventListener("change", function () {
    const file = qrPhoto.files && qrPhoto.files[0];
    qrPhoto.value = "";
    if (!file) {
      return;
    }
    const image = new Image();
    image.onload = function () {
      // Large photos are scaled down, which also makes them quicker to read
      const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const picture = context.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(picture.data, picture.width, picture.height, { inversionAttempts: "attemptBoth" });
      URL.revokeObjectURL(image.src);
      if (found && found.data) {
        stopCamera();
        clockIn(found.data, false);
      } else {
        show("error", "other", "We couldn't find a QR code in that picture. Try a clearer photo, or enter the code instead.");
      }
    };
    image.onerror = function () {
      show("error", "other", "That file couldn't be opened as a picture.");
    };
    image.src = URL.createObjectURL(file);
  });
}

document.getElementById("cancelScan").addEventListener("click", function () {
  show(pickView());
});

// ==================================================
// THE BACKUP CODE
// ==================================================

const codeInput = document.getElementById("backupCodeInput");

// The real backend's attendance code is the QR's text (long, letters and numbers)
if (longCode) {
  codeInput.removeAttribute("maxlength");
  codeInput.setAttribute("inputmode", "text");
  codeInput.setAttribute("placeholder", "Paste the attendance code");
  codeInput.classList.remove("tracking-widest", "text-lg");
  codeInput.classList.add("text-sm");
  document.getElementById("backupCodeLabel").textContent = "Attendance code";
}

// Numbers only, like the other code boxes on the site (6-digit code)
codeInput.addEventListener("input", function () {
  if (!longCode) {
    codeInput.value = codeInput.value.replace(/[^0-9]/g, "");
  }
});

document.getElementById("codeForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const error = document.getElementById("backupCodeInputError");
  if (longCode) {
    const code = codeInput.value.trim();
    if (code.length < 4) {
      error.textContent = "Please paste the attendance code shown under the facility's QR.";
      error.classList.remove("hidden");
      return;
    }
    error.classList.add("hidden");
    clockIn(code, false);
    return;
  }
  if (codeInput.value.length !== 6) {
    error.textContent = "Please enter the 6-digit code.";
    error.classList.remove("hidden");
    return;
  }
  error.classList.add("hidden");
  clockIn(codeInput.value, true);
});

// ==================================================
// DEMO ONLY: change the time, and pretend to scan
// ==================================================

if (USE_DEMO_MODE) {
  document.getElementById("demoPanel").classList.remove("hidden");
  setupDemoTimePicker(document.getElementById("demoTime"), loadMyShift);

  document.querySelectorAll("[data-demo]").forEach(function (button) {
    button.addEventListener("click", function () {
      const name = button.getAttribute("data-demo");
      if (name === "reset") {
        resetDemoShift();
        loadMyShift();
        return;
      }
      // Pretend the camera read a QR: the right one, or another shift's
      stopCamera();
      clockIn(name === "rightQr" ? getDemoShift().qrValue : "CAREPORIUM|CP-0999|demo-111111", false);
    });
  });
}
