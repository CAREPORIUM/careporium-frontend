// ====== SHIFT ATTENDANCE (shared by the facility and worker shift pages) ======
// Needs /js/api.js to be loaded first.
//
// HOW THE TWO PAGES WORK TOGETHER
// 1. The facility offers the shift → the worker accepts (or declines) on their shift page.
// 2. When every place is accepted, the facility page shows the attendance QR.
// 3. Each worker scans it (or types the backup code) to clock in, then clocks out after work.
// 4. When every worker is done, the facility completes the shift.
//
// DEMO MODE: both pages share ONE demo shift, saved in the browser (localStorage).
// Open the facility page in one tab and the worker page in another, and they update each other.
// REAL BACKEND: the server sends the shift, and works out the time rules (late, no-show, etc.).

// ==================================================
// THE TIME RULES (👉 the real values live on the server; these are used in demo mode)
// ==================================================

const SHIFT_RULES = {
  clockInOpensBefore: 30, // minutes before the start when clock-in opens
  lateAfter: 15, // minutes after the start without a clock-in → "Late"
  noShowAfter: 60, // minutes after the start → the facility can mark a no-show
  clockOutMissingAfter: 120, // minutes after the end while still working → "Clock-out missing"
};

// ==================================================
// SMALL HELPERS
// ==================================================

// "07:58" → 478 (minutes after midnight)
function timeToMinutes(time) {
  const parts = time.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

// 478 → "07:58"
function minutesToTime(minutes) {
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}

// "07:58" and "16:01" → "8 hours 3 minutes"
function recordedTime(clockIn, clockOut) {
  const total = timeToMinutes(clockOut) - timeToMinutes(clockIn);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours + (hours === 1 ? " hour " : " hours ") + minutes + (minutes === 1 ? " minute" : " minutes");
}

// "482913" → "482 913" (easier to read out loud)
function spacedCode(code) {
  return code.slice(0, 3) + " " + code.slice(3);
}

// ==================================================
// THE DEMO SHIFT (only used when USE_DEMO_MODE is true in api.js)
// ==================================================

const DEMO_SHIFT_KEY = "demoShift:CP-1042";

// The shift from the designs. The demo worker (professional@careporium.com) is Amara.
function newDemoShift() {
  return {
    id: "CP-1042",
    title: "Registered nurse · General ward",
    facilityLine: "Mainland Care Hospital · Yaba, Lagos",
    dayLabel: "Friday, 9 October",
    shortDay: "9 October",
    start: "08:00",
    end: "16:00",
    needed: 2,
    payLine: "₦30,000 for the shift · ₦3,750 an hour",
    arrival: "Please arrive at reception 15 minutes before your shift starts.",
    status: "active", // "active" or "completed"
    qrValue: "CAREPORIUM|CP-1042|demo-482913", // what the QR code contains
    backupCode: "482913", // what the worker can type instead
    demoTime: "07:58", // the pretend "now" (changed with the demo panel)
    workers: [
      { id: "WK-1048", name: "Amara Okafor", role: "Registered nurse", offer: "awaiting", attendance: "none", clockIn: "", clockOut: "", fixReason: "" },
      { id: "WK-1052", name: "Chidinma Eze", role: "Registered nurse", offer: "awaiting", attendance: "none", clockIn: "", clockOut: "", fixReason: "" },
    ],
  };
}

// The demo worker's id (Amara)
const DEMO_WORKER_ID = "WK-1048";

function getDemoShift() {
  const saved = localStorage.getItem(DEMO_SHIFT_KEY);
  if (saved === null) {
    return newDemoShift();
  }
  return JSON.parse(saved);
}

function saveDemoShift(shift) {
  localStorage.setItem(DEMO_SHIFT_KEY, JSON.stringify(shift));
}

function resetDemoShift() {
  localStorage.removeItem(DEMO_SHIFT_KEY);
}

// Find one worker in the demo shift
function demoWorker(shift, workerId) {
  return shift.workers.find(function (worker) {
    return worker.id === workerId;
  });
}

// Work out the time rules for one worker at the demo "now".
// (The real server sends these flags itself.)
function addDemoFlags(shift, worker) {
  const now = timeToMinutes(shift.demoTime);
  const start = timeToMinutes(shift.start);
  const end = timeToMinutes(shift.end);
  // Late and no-show only count once the shift is filled: before that there's no QR to scan
  const acceptedCount = shift.workers.filter(function (w) { return w.offer === "accepted"; }).length;
  const filled = acceptedCount >= shift.needed;
  const notClockedIn = filled && worker.offer === "accepted" && worker.attendance === "none";

  return Object.assign({}, worker, {
    clockIn: worker.clockIn ? worker.clockIn + " WAT" : "",
    clockOut: worker.clockOut ? worker.clockOut + " WAT" : "",
    late: notClockedIn && now > start + SHIFT_RULES.lateAfter && now < end,
    canMarkNoShow: notClockedIn && now >= start + SHIFT_RULES.noShowAfter,
    clockOutMissing: worker.attendance === "working" && now >= end + SHIFT_RULES.clockOutMissingAfter,
    offerExpiresIn: "22 h",
  });
}

// The demo shift in the same shape the server sends for the FACILITY page
function demoFacilityShift() {
  const shift = getDemoShift();
  return {
    id: shift.id,
    title: shift.title,
    facilityLine: shift.facilityLine,
    whenLine: shift.dayLabel + " · " + shift.start + "–" + shift.end + " WAT · Shift " + shift.id,
    shortDay: shift.shortDay,
    needed: shift.needed,
    status: shift.status,
    qrValue: shift.qrValue,
    backupCode: shift.backupCode,
    workers: shift.workers.map(function (worker) {
      return addDemoFlags(shift, worker);
    }),
  };
}

// The demo shift in the same shape the server sends for the WORKER page (Amara's view)
function demoWorkerShift() {
  const shift = getDemoShift();
  const me = addDemoFlags(shift, demoWorker(shift, DEMO_WORKER_ID));
  const now = timeToMinutes(shift.demoTime);
  const start = timeToMinutes(shift.start);
  const end = timeToMinutes(shift.end);
  const opens = start - SHIFT_RULES.clockInOpensBefore;
  const raw = demoWorker(shift, DEMO_WORKER_ID);

  return {
    id: shift.id,
    title: shift.title,
    facilityLine: shift.facilityLine,
    whenLine: shift.dayLabel + " · " + shift.start + "–" + shift.end + " WAT · Shift " + shift.id,
    facilityName: shift.facilityLine.split(" · ")[0],
    payLine: shift.payLine,
    arrival: shift.arrival,
    offer: me.offer,
    offerExpiresIn: me.offerExpiresIn,
    attendance: me.attendance,
    clockIn: me.clockIn,
    clockOut: me.clockOut,
    recordedTime: raw.clockIn && raw.clockOut ? recordedTime(raw.clockIn, raw.clockOut) : "",
    fixReason: me.fixReason,
    clockInOpensAt: minutesToTime(opens) + " WAT",
    clockInOpen: now >= opens && now < end,
    ended: now >= end,
    clockOutMissing: me.clockOutMissing,
  };
}

// ==================================================
// THE DEMO PANEL'S TIME PICKER (both pages)
// ==================================================

// Without a real clock, the demo picks a pretend time on the shift day.
const DEMO_TIMES = [
  ["07:00", "07:00 · clock-in not open yet"],
  ["07:58", "07:58 · clock-in open"],
  ["08:20", "08:20 · late"],
  ["09:10", "09:10 · no-show actions"],
  ["12:00", "12:00 · during the shift"],
  ["16:01", "16:01 · end of the shift"],
  ["18:30", "18:30 · clock-out missing"],
];

// Fill a <select> with the demo times, and save the chosen time when it changes
function setupDemoTimePicker(select, onChange) {
  const shift = getDemoShift();
  select.innerHTML = DEMO_TIMES.map(function (option) {
    const selected = option[0] === shift.demoTime ? " selected" : "";
    return `<option value="${option[0]}"${selected}>${option[1]}</option>`;
  }).join("");

  select.addEventListener("change", function () {
    const updated = getDemoShift();
    updated.demoTime = select.value;
    saveDemoShift(updated);
    onChange();
  });
}
