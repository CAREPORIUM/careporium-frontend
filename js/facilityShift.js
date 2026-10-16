// ====== FACILITY SHIFT PAGE (one shift: workers, attendance QR, completing the shift) ======
// Needs /js/api.js and /js/shifts.js first, and the QR drawing library (qrcode-generator).
//
// The page has these versions, worked out from the shift's data (see getPageState):
//   "open"       not every place is accepted yet → no QR yet, "Review remaining applicants"
//   "filled"     every place accepted, nobody clocked in → QR showing
//   "inProgress" someone has clocked in → QR showing, Complete Shift still locked
//   "ready"      every worker is done → Complete Shift unlocks
//   "confirm"    the "Complete this shift?" question
//   "completed"  done → green banner, "Attendance recorded"

const shiftCode = getUrlValue("shift") || "CP-1042";
let shiftData = null; // the shift, as the server (or the demo) sends it
let confirming = false; // true while the "Complete this shift?" question is showing

// ==================================================
// WORKING OUT THE STATE
// ==================================================

// The workers that count towards the shift (declined, expired or replaced ones don't)
function acceptedWorkers() {
  return shiftData.workers.filter(function (worker) {
    return worker.offer === "accepted";
  });
}

// A worker whose attendance needs nothing more from anyone
function isResolved(worker) {
  return worker.attendance === "completed" || worker.attendance === "fixed" || worker.attendance === "noshow";
}

function getPageState() {
  if (shiftData.status === "completed") {
    return "completed";
  }
  if (confirming) {
    return "confirm";
  }

  const accepted = acceptedWorkers();
  if (accepted.length === 0) {
    return "open";
  }
  const unfilled = accepted.length < shiftData.needed;
  // REAL: when the backend doesn't send each worker's clock times, the shift can be completed
  // once it has started (the server still checks before completing)
  if (shiftData.attendanceKnown === false) {
    if (shiftData.started || shiftData.ended) return "ready";
    return unfilled ? "open" : "filled";
  }
  if (accepted.every(isResolved)) {
    return "ready";
  }
  const anyStarted = accepted.some(function (worker) {
    return worker.attendance !== "none";
  });
  if (anyStarted) return "inProgress";
  return unfilled ? "open" : "filled";
}

// ==================================================
// DRAWING THE PAGE
// ==================================================

// The texts that change with the state
function bannerFor(state, accepted) {
  const both = shiftData.needed === 2 ? "Both workers" : "All workers";
  const count = accepted.length + " of " + shiftData.needed + " workers accepted";

  if (state === "open") {
    if (accepted.length > 0) {
      return { title: "Open · " + count, text: "Booked workers can already clock in with the QR. Review your applicants to fill the remaining places." };
    }
    if (shiftData.awaitingPayment) {
      return { title: "Awaiting payment", text: "This shift isn't visible to workers yet. Fund the escrow to publish it." };
    }
    return { title: "Open · " + count, text: "Book a worker from your applicants. The attendance QR appears as soon as someone is booked." };
  }
  if (state === "filled") {
    return { title: "Filled · " + count, text: "Your shift is filled. Keep this QR available at the facility so your workers can clock in." };
  }
  if (state === "inProgress") {
    return { title: "Filled · " + count, text: "Attendance is in progress. Complete Shift unlocks after " + both.toLowerCase() + " have clocked out." };
  }
  if (state === "ready") {
    if (shiftData.attendanceKnown === false) {
      return { title: (accepted.length < shiftData.needed ? "Open · " : "Filled · ") + count, text: "The shift has started. Complete the shift once your booked workers have clocked out." };
    }
    return { title: "Filled · " + count, text: both + " have clocked out. Review their attendance, then complete the shift." };
  }
  return { title: "Completed", text: "You've marked this shift as completed. " + both + "' attendance is recorded." };
}

// The small line under "Assigned workers"
function summaryFor(state, accepted) {
  if (shiftData.attendanceKnown === false && state !== "open") {
    return accepted.length + " booked" + (accepted.length < shiftData.needed ? " · " + (shiftData.needed - accepted.length) + " to fill" : "");
  }
  if (state === "open") {
    const toFill = shiftData.needed - accepted.length;
    return accepted.length + " accepted · " + toFill + (toFill === 1 ? " place" : " places") + " to fill";
  }
  if (state === "filled") {
    return "0 of " + accepted.length + " clocked in";
  }
  if (state === "inProgress") {
    const working = accepted.filter(function (w) { return w.attendance === "working"; }).length;
    const finished = accepted.filter(isResolved).length;
    return working + " working · " + finished + " finished";
  }
  return accepted.filter(isResolved).length + " of " + accepted.length + " attendance records completed";
}

// One worker's status line: text and color
function workerStatus(worker, state) {
  if (worker.offer === "awaiting") return ["Awaiting acceptance · offer expires in " + (worker.offerExpiresIn || "24 h"), "text-gray-700"];
  if (worker.offer === "declined") return ["Declined · this place is open again", "text-red-600"];
  if (worker.offer === "expired") return ["Offer expired · this place is open again", "text-red-600"];
  if (worker.attendance === "noshow") return ["No-show", "text-red-600"];
  if (worker.attendance === "fixed") return ["Attendance fixed by facility" + (worker.fixReason ? " · " + worker.fixReason : ""), "text-green-700"];
  if (worker.attendance === "completed") return ["Attendance completed", "text-green-700"];
  if (worker.attendance === "working") {
    return worker.clockOutMissing ? ["Clock-out missing", "text-amber-700"] : ["Working", "text-blue-600"];
  }
  if (state === "open") return ["Accepted", "text-gray-700"];
  if (shiftData.attendanceKnown === false) return ["Booked · clock times aren't shown here yet", "text-gray-700"];
  if (worker.late) return ["Late · not clocked in", "text-amber-700"];
  return ["Not clocked in", "text-gray-700"];
}

// The buttons a worker's row needs (no-show, replacement, fixing a missing clock-out)
function workerActions(worker) {
  const small = "text-xs font-medium text-center px-4 py-2 rounded-lg";
  let html = "";
  if (worker.canMarkNoShow) {
    html += `<button type="button" data-action="noshow" data-worker="${escapeHtml(worker.id)}" class="${small} border border-red-600 text-red-600 hover:bg-red-50">Mark as no-show</button>`;
  }
  if (worker.canMarkNoShow || worker.attendance === "noshow") {
    html += `<button type="button" data-action="replace" data-worker="${escapeHtml(worker.id)}" class="${small} border border-blue-600 text-blue-600 hover:bg-blue-50">Find a replacement</button>`;
  }
  if (worker.clockOutMissing) {
    html += `<button type="button" data-action="fix" data-worker="${escapeHtml(worker.id)}" class="${small} bg-blue-600 text-white hover:bg-blue-700">Fix attendance</button>`;
  }
  return html ? `<div class="flex flex-wrap gap-2 mt-3">${html}</div>` : "";
}

// The small form for fixing a missing clock-out (hidden until "Fix attendance" is clicked)
function fixForm(worker) {
  return `
    <div id="fixForm-${escapeHtml(worker.id)}" class="hidden border-t border-gray-200 mt-3 pt-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold mb-1" for="fixTime-${escapeHtml(worker.id)}">Actual clock-out time</label>
          <input type="time" id="fixTime-${escapeHtml(worker.id)}" value="16:00" class="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1" for="fixReason-${escapeHtml(worker.id)}">Reason</label>
          <input type="text" id="fixReason-${escapeHtml(worker.id)}" placeholder="e.g. Forgot to clock out" class="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm" />
        </div>
      </div>
      <p id="fixError-${escapeHtml(worker.id)}" class="hidden text-xs font-medium text-red-500 mt-1"></p>
      <p class="text-xs text-gray-500 mt-2">${escapeHtml(worker.name.split(" ")[0])} will be told about this change and can dispute it within 48 hours.</p>
      <div class="flex gap-2 mt-3">
        <button type="button" data-action="saveFix" data-worker="${escapeHtml(worker.id)}" class="text-xs font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save attendance</button>
        <button type="button" data-action="cancelFix" data-worker="${escapeHtml(worker.id)}" class="text-xs font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
      </div>
    </div>`;
}

// One worker's card
function workerHtml(worker, state) {
  const status = workerStatus(worker, state);
  const times = "Clock in: " + (worker.clockIn || "Not yet") + " · Clock out: " + (worker.clockOut || "Not yet");
  return `
    <div class="bg-slate-50 border border-gray-200 rounded-xl p-4">
      <p class="text-sm font-semibold">${escapeHtml(worker.name)} · ${escapeHtml(worker.role)}</p>
      <p class="text-xs font-medium ${status[1]} mt-2">${escapeHtml(status[0])}</p>
      <p class="text-xs text-gray-700 mt-1">${escapeHtml(times)}</p>
      ${workerActions(worker)}
      ${worker.clockOutMissing ? fixForm(worker) : ""}
    </div>`;
}

// Show the QR for the workers to scan: the backend's own drawn QR when it sends one,
// otherwise draw it from the code (qrcode-generator library)
function drawQr() {
  const holder = document.getElementById("qrImage");
  const key = shiftData.qrImage || shiftData.qrValue;
  if (!key) {
    return;
  }
  if (holder.getAttribute("data-value") === key) {
    return; // already showing this code
  }
  if (shiftData.qrImage) {
    holder.innerHTML = "";
    const img = document.createElement("img");
    img.src = shiftData.qrImage;
    img.alt = "Attendance QR code";
    img.className = "w-full h-full object-contain";
    holder.appendChild(img);
    holder.setAttribute("data-value", key);
    return;
  }
  try {
    const qr = qrcode(0, "M"); // 0 = pick the size automatically, "M" = medium error correction
    qr.addData(shiftData.qrValue);
    qr.make();
    holder.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    holder.setAttribute("data-value", key);
  } catch (error) {
    // The library refuses codes that are too long to fit in a QR
    holder.innerHTML = '<p class="text-xs text-gray-700">This code is too long to show as a QR. Workers can paste the attendance code below instead.</p>';
    holder.removeAttribute("data-value");
  }
}

function render() {
  const state = getPageState();
  const accepted = acceptedWorkers();

  // The heading
  document.getElementById("shiftTitle").textContent = shiftData.title;
  document.getElementById("shiftFacility").textContent = shiftData.facilityLine;
  document.getElementById("shiftWhen").textContent = shiftData.whenLine;
  document.getElementById("pageLoading").classList.add("hidden");

  // "Complete this shift?" replaces the normal view
  document.getElementById("confirmView").classList.toggle("hidden", state !== "confirm");
  document.getElementById("mainView").classList.toggle("hidden", state === "confirm");
  if (state === "confirm") {
    document.getElementById("confirmList").innerHTML = accepted.map(function (worker) {
      const status = workerStatus(worker, state);
      let times = "";
      if (worker.clockIn && worker.clockOut) {
        times = worker.clockIn.replace(" WAT", "") + "–" + worker.clockOut;
      }
      return `
        <div class="bg-slate-50 border border-gray-200 rounded-xl p-4">
          <p class="text-sm font-semibold">${escapeHtml(worker.name)} · ${escapeHtml(worker.role)}</p>
          <p class="text-xs font-medium ${status[1]} mt-2">${escapeHtml(status[0])}</p>
          <p class="text-xs text-gray-700 mt-1">${escapeHtml(times)}</p>
        </div>`;
    }).join("");
    return;
  }

  // The banner (green when completed)
  const banner = bannerFor(state, accepted);
  const bannerBox = document.getElementById("stateBanner");
  bannerBox.className = "border rounded-2xl p-6 mt-5 " + (state === "completed" ? "bg-green-50 border-green-100" : "bg-blue-50 border-blue-100");
  document.getElementById("bannerTitle").textContent = banner.title;
  document.getElementById("bannerText").textContent = banner.text;

  // The workers. Replaced workers are hidden; declined and expired ones stay visible as a reminder.
  document.getElementById("workerSummary").textContent = summaryFor(state, accepted);
  document.getElementById("workerList").innerHTML = shiftData.workers
    .filter(function (worker) { return worker.offer !== "replaced"; })
    .map(function (worker) { return workerHtml(worker, state); })
    .join("");

  // The Complete Shift button: blue only when every worker is done
  const completeButton = document.getElementById("completeShift");
  const note = document.getElementById("completeNote");
  completeButton.className = "w-full text-sm font-medium text-center py-3 rounded-lg mt-5 ";
  if (state === "ready") {
    completeButton.disabled = false;
    completeButton.textContent = "Complete Shift";
    completeButton.className += "bg-blue-600 text-white hover:bg-blue-700";
    note.textContent = "All attendance records are complete. You can now finish the shift.";
  } else {
    completeButton.disabled = true;
    completeButton.textContent = state === "completed" ? "Shift completed" : "Complete Shift";
    completeButton.className += "bg-slate-200 text-gray-600 cursor-not-allowed";
    note.textContent = state === "completed" ? "" : "Complete Shift becomes available when every assigned worker has clocked out.";
  }
  note.classList.toggle("hidden", state === "completed");

  // "Review remaining applicants" while places are still open
  const placesOpen = accepted.length < shiftData.needed && state !== "completed";
  document.getElementById("reviewRemaining").classList.toggle("hidden", !placesOpen);
  document.getElementById("reviewRemaining").href = "../FacilityHiringSection/Applicants.html?shift=" + encodeURIComponent(shiftData.id);

  // The right-hand card: waiting for workers, the QR (as soon as one worker is booked), or "Attendance recorded"
  const showQr = accepted.length > 0 && state !== "completed";
  document.getElementById("qrWaiting").classList.toggle("hidden", showQr || state === "completed");
  document.getElementById("qrReady").classList.toggle("hidden", !showQr);
  document.getElementById("qrDone").classList.toggle("hidden", state !== "completed");
  document.getElementById("qrCardTitle").textContent = state === "completed" ? "Attendance recorded" : "Attendance QR";
  if (showQr) {
    drawQr();
    document.getElementById("qrCaption").textContent = "Shift " + String(shiftData.id).slice(-6).toUpperCase() + " · " + shiftData.shortDay;
    const codeLine = document.getElementById("backupCode").parentElement;
    if (shiftData.backupCode) {
      // A 6-digit backup code from the server
      document.getElementById("backupCode").textContent = spacedCode(shiftData.backupCode);
      codeLine.classList.remove("hidden");
    } else if (shiftData.qrValue && !USE_DEMO_MODE && !/^data:/i.test(shiftData.qrValue)) {
      // No 6-digit code on the backend: the QR's own text works the same way (copy and paste it)
      codeLine.classList.remove("hidden");
      codeLine.innerHTML = 'Can\'t scan? Attendance code: <span id="backupCode" class="font-mono break-all select-all"></span> ' +
        '<button type="button" id="copyCode" class="text-blue-600 font-medium hover:underline">Copy</button>';
      document.getElementById("backupCode").textContent = shiftData.qrValue;
      document.getElementById("copyCode").addEventListener("click", function () {
        const button = document.getElementById("copyCode");
        const done = function () { button.textContent = "Copied ✓"; };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(shiftData.qrValue).then(done, done);
        } else {
          window.prompt("Copy the attendance code:", shiftData.qrValue);
        }
      });
    } else {
      codeLine.classList.add("hidden");
    }
    // No QR from the server (e.g. it couldn't be made): say so instead of an empty box
    if (!shiftData.qrValue && !shiftData.qrImage) {
      document.getElementById("qrImage").innerHTML = '<p class="text-xs text-gray-700">The QR code isn\'t available right now' +
        (shiftData.qrError ? " (" + escapeHtml(shiftData.qrError) + ")" : "") + '. Refresh the page in a moment.</p>';
      document.getElementById("qrImage").removeAttribute("data-value");
    }
  }

  showPaymentStatus();
}

// The shift's payment: while the escrow isn't funded, the shift isn't live for workers.
// Show that, with a link to the Fund shift page (the payment link and bank details are there).
function showPaymentStatus() {
  let box = document.getElementById("paymentBox");
  if (!shiftData.awaitingPayment || shiftData.status === "completed") {
    if (box) box.remove();
    return;
  }
  if (!box) {
    box = document.createElement("div");
    box.id = "paymentBox";
    box.className = "bg-amber-50 border border-amber-100 rounded-2xl p-5 mt-5 flex flex-wrap items-center justify-between gap-3";
    document.getElementById("stateBanner").insertAdjacentElement("afterend", box);
  }
  box.innerHTML = `
    <div>
      <p class="text-sm font-semibold text-amber-700">Awaiting payment</p>
      <p class="text-xs text-gray-700 mt-1">Fund this shift's escrow so workers can see and apply for it.</p>
    </div>
    <a href="../FacilityHiringSection/FundShift.html?shift=${encodeURIComponent(shiftData.id)}" class="text-sm font-medium px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Fund shift</a>`;
}

// ==================================================
// LOADING (and refreshing)
// ==================================================

async function loadShift() {
  if (USE_DEMO_MODE) {
    shiftData = demoFacilityShift();
    render();
    return;
  }

  // REAL: the server answers with the shift (see the API document). The flags late, canMarkNoShow
  // and clockOutMissing are worked out by the server.
  try {
    shiftData = await Backend.facilityShift(shiftCode);
    render();
  } catch (error) {
    showGeneralError("Couldn't load this shift: " + ((error && error.message) || String(error)));
  }
}

loadShift();

// Keep the page up to date while workers clock in and out:
// REAL: ask the server again every 30 seconds (this also picks up a refreshed QR code).
// DEMO: redraw when the worker page (in another tab) changes the demo shift.
if (USE_DEMO_MODE) {
  window.addEventListener("storage", function (event) {
    if (event.key === DEMO_SHIFT_KEY) {
      loadShift();
    }
  });
} else {
  setInterval(function () {
    if (shiftData && shiftData.status !== "completed" && !confirming) {
      loadShift();
    }
  }, 30000);
}

// ==================================================
// ACTIONS
// ==================================================

// Run one action: on the server (REAL), or on the demo shift (DEMO). Then redraw.
// The server answers every action with the updated shift.
// serverCall: a function that does the action on the real backend
async function runAction(serverCall, demoChange) {
  if (USE_DEMO_MODE) {
    const shift = getDemoShift();
    demoChange(shift);
    saveDemoShift(shift);
    shiftData = demoFacilityShift();
    render();
    return true;
  }

  try {
    await serverCall();
    shiftData = await Backend.facilityShift(shiftCode); // load the updated shift
    render();
    return true;
  } catch (error) {
    showGeneralError(error.message);
    return false;
  }
}

// Complete Shift → ask first
document.getElementById("completeShift").addEventListener("click", function () {
  confirming = true;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// "Keep reviewing" → back to the shift
document.getElementById("keepReviewing").addEventListener("click", function () {
  confirming = false;
  render();
});

// "Confirm and complete shift"
const confirmButton = document.getElementById("confirmComplete");
confirmButton.addEventListener("click", async function () {
  setLoading(confirmButton, true, "Completing…");
  const done = await runAction(function () { return Backend.completeShift(shiftCode); }, function (shift) {
    shift.status = "completed";
  });
  setLoading(confirmButton, false);
  if (done) {
    confirming = false;
    render();
  }
});

// The buttons inside the worker cards. One listener catches them all, even after a redraw.
document.getElementById("workerList").addEventListener("click", async function (event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const workerId = button.getAttribute("data-worker");
  const worker = shiftData.workers.find(function (w) { return w.id === workerId; });
  const firstName = worker.name.split(" ")[0];
  const action = button.getAttribute("data-action");

  if (action === "noshow") {
    if (!confirm("Mark " + worker.name + " as a no-show?\n" + firstName + " won't be paid for this shift, and can dispute it within 48 hours.")) {
      return;
    }
    runAction(function () { throw new Error("Marking a no-show isn't available on the server yet."); }, function (shift) {
      demoWorker(shift, workerId).attendance = "noshow";
    });
  }

  if (action === "replace") {
    if (!confirm("Open " + firstName + "'s place again so another professional can be booked?")) {
      return;
    }
    runAction(function () { throw new Error("Replacing a worker isn't available on the server yet."); }, function (shift) {
      demoWorker(shift, workerId).offer = "replaced";
    });
  }

  if (action === "fix") {
    document.getElementById("fixForm-" + workerId).classList.remove("hidden");
  }

  if (action === "cancelFix") {
    document.getElementById("fixForm-" + workerId).classList.add("hidden");
  }

  if (action === "saveFix") {
    const time = document.getElementById("fixTime-" + workerId).value;
    const reason = document.getElementById("fixReason-" + workerId).value.trim();
    const error = document.getElementById("fixError-" + workerId);

    // Both are needed, and the clock-out must be after the clock-in
    let message = "";
    if (time === "" || reason.length < 5) {
      message = "Enter the clock-out time and a short reason (at least 5 characters).";
    } else if (timeToMinutes(time) <= timeToMinutes(worker.clockIn.replace(" WAT", ""))) {
      message = "The clock-out time must be after the clock-in time.";
    }
    if (message) {
      error.textContent = message;
      error.classList.remove("hidden");
      return;
    }

    runAction(function () { throw new Error("Fixing attendance isn't available on the server yet."); }, function (shift) {
      const w = demoWorker(shift, workerId);
      w.attendance = "fixed";
      w.clockOut = time;
      w.fixReason = reason;
    });
  }
});

// ==================================================
// DEMO ONLY: pretend to be the other workers, and change the time
// ==================================================

if (USE_DEMO_MODE) {
  document.getElementById("demoPanel").classList.remove("hidden");
  setupDemoTimePicker(document.getElementById("demoTime"), loadShift);

  // What each demo button does to Chidinma (the second worker)
  const demoChanges = {
    accept: function (w) { w.offer = "accepted"; },
    decline: function (w) { w.offer = "declined"; },
    clockIn: function (w, shift) { w.offer = "accepted"; w.attendance = "working"; w.clockIn = shift.demoTime; },
    clockOut: function (w, shift) {
      if (w.attendance !== "working") { return; }
      w.attendance = "completed";
      w.clockOut = shift.demoTime;
    },
  };

  document.querySelectorAll("[data-demo]").forEach(function (button) {
    button.addEventListener("click", function () {
      const name = button.getAttribute("data-demo");
      if (name === "reset") {
        resetDemoShift();
      } else {
        const shift = getDemoShift();
        demoChanges[name](demoWorker(shift, "WK-1052"), shift);
        saveDemoShift(shift);
      }
      confirming = false;
      loadShift();
    });
  });
}