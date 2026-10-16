// ====== WORKER PAYMENTS (payments list, payment details, bank details, payment support) ======
// Needs /js/api.js to be loaded first.
//
// Every worker payments page loads this file. Each part below checks that its elements
// exist on the current page before running, like the other shared scripts.
//
// A payment is the pay for one shift. Its status moves like this:
//   "funds_secured"        the facility has set the money aside (before or during the shift)
//   "awaiting_completion"  the worker's attendance is done; waiting for the facility to complete the shift
//   "processing"           the facility completed the shift; the money is on its way to the bank
//   "paid"                 the money reached the worker's bank

// Demo mode: sample data, with a note. With the real backend the Payments page is built from the
// worker's booked shifts and GET /api/payouts/v1/history (bank details aren't on the server yet).
if (usesDemo("workerPayouts")) {
  document.addEventListener("DOMContentLoaded", function () {
    showPreviewNote("Payments");
  });
}

// The worker payment pages (make these match your real file names exactly)
const WP_PAGES = {
  list: "../WorkerShiftMarket/Payments.html",
  details: "../WorkerShiftMarket/PaymentDetails.html",
  bankSaved: "../WorkerShiftMarket/BankDetailsSaved.html",
  support: "../WorkerShiftMarket/PaymentSupport.html",
  issueSubmitted: "../WorkerShiftMarket/PaymentIssueSubmitted.html",
};

// How each status is written, and its color
const WP_STATUS = {
  funds_secured: ["Funds secured", "text-green-700"],
  awaiting_completion: ["Awaiting completion", "text-gray-700"],
  processing: ["Processing", "text-gray-700"],
  paid: ["Paid", "text-green-700"],
};

// Turn 30000 into "₦30,000"
function formatNaira(amount) {
  return "₦" + Number(amount).toLocaleString();
}

// ==================================================
// DEMO DATA (only used when USE_DEMO_MODE is true in api.js)
// ==================================================

const WP_DEMO_PAYMENTS = [
  { id: "CP-1042", title: "Registered nurse · General ward", facility: "Mainland Care Hospital", place: "Yaba, Lagos", date: "9 Oct 2026", time: "08:00–16:00 WAT", amount: 30000, deductions: 0, status: "awaiting_completion", reference: "CP-PAY-1042", paidOn: "" },
  { id: "CP-1037", title: "Registered nurse · Night shift", facility: "Lagoon Clinic", place: "Ikoyi, Lagos", date: "7 Oct 2026", time: "19:00–07:00 WAT", amount: 30000, deductions: 0, status: "processing", reference: "CP-PAY-1037", paidOn: "" },
  { id: "CP-1026", title: "Registered nurse · Day shift", facility: "Yaba Medical Centre", place: "Yaba, Lagos", date: "4 Oct 2026", time: "08:00–16:00 WAT", amount: 30000, deductions: 0, status: "paid", reference: "CP-PAY-1026", paidOn: "5 Oct 2026" },
  { id: "CP-1045", title: "Registered nurse · General ward", facility: "Mainland Care Hospital", place: "Yaba, Lagos", date: "10 Oct 2026", time: "08:00–16:00 WAT", amount: 30000, deductions: 0, status: "funds_secured", reference: "", paidOn: "" },
];

// The numbers at the top of the Payments page (the real server works these out)
const WP_DEMO_SUMMARY = {
  pending: "₦60,000", pendingNote: "2 shifts awaiting payment",
  processing: "₦30,000", processingNote: "On its way to your bank",
  received: "₦120,000", receivedNote: "4 payments received",
};

// The demo bank account, saved in the browser so "Save bank details" is remembered
function wpBankKey() {
  return "demoBank:" + (sessionGet("userEmail") || "guest");
}

function wpDemoBank() {
  const saved = localStorage.getItem(wpBankKey());
  if (saved) {
    return JSON.parse(saved);
  }
  return { name: "Amara Okafor", bank: "GTBank", last4: "4821" };
}

// The demo shift CP-1042 is the same one as on the shift pages, so its payment follows it:
// not worked yet → funds secured; attendance done → awaiting completion; completed → processing
function wpDemoPayments() {
  const payments = WP_DEMO_PAYMENTS.map(function (payment) {
    return Object.assign({}, payment);
  });
  const savedShift = localStorage.getItem("demoShift:CP-1042");
  if (savedShift) {
    const shift = JSON.parse(savedShift);
    const amara = shift.workers.find(function (worker) { return worker.id === "WK-1048"; });
    const payment = payments[0];
    if (shift.status === "completed") {
      payment.status = "processing";
    } else if (amara && (amara.attendance === "completed" || amara.attendance === "fixed")) {
      payment.status = "awaiting_completion";
    } else {
      payment.status = "funds_secured";
    }
  }
  return payments;
}

// ==================================================
// LOADING (from the server, or the demo data)
// ==================================================

// Everything for the Payments page.
// The server should answer with:
// { summary: { pending, pendingNote, processing, processingNote, received, receivedNote },
//   account: { name, bank, last4 },
//   payments: [ { id, title, facility, place, date, time, amount, deductions, status, reference, paidOn }, ... ] }
async function wpLoadAll() {
  if (usesDemo("workerPayouts")) {
    // Before verification there are no shifts, so no payments (the empty page shows)
    const info = getDemoVerification();
    const payments = info.status === "verified" ? wpDemoPayments() : [];
    return { summary: WP_DEMO_SUMMARY, account: wpDemoBank(), payments: payments };
  }
  return await Backend.workerPayments();
}

// One payment, by its shift code (e.g. "CP-1042"). The server answers with one payment, plus
// "account": "GTBank · •••• 4821" (where it's paid to).
async function wpLoadOne(id) {
  if (usesDemo("workerPayouts")) {
    const payment = wpDemoPayments().find(function (p) { return p.id === id; });
    if (!payment) {
      return null;
    }
    const bank = wpDemoBank();
    return Object.assign({ account: bank.bank + " · •••• " + bank.last4 }, payment);
  }
  return await Backend.workerPayment(id);
}

// ==================================================
// 1. PAYMENTS PAGE (summary, payout account, search, status filter, history)
// ==================================================

const paymentHistory = document.getElementById("paymentHistory");

if (paymentHistory) {
  const searchInput = document.getElementById("paymentSearch");
  const filterButton = document.getElementById("statusFilter");
  const filterMenu = document.getElementById("statusMenu");
  let allPayments = [];
  let statusFilter = "all"; // "all" or one of the statuses

  // One row in the history. The whole row is a link to that payment's page.
  function rowHtml(payment) {
    const status = WP_STATUS[payment.status] || ["", "text-gray-700"];
    return `
      <a href="${WP_PAGES.details}?payment=${encodeURIComponent(payment.id)}" class="payment-row block border-b border-gray-200 py-5 hover:bg-slate-50">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold">${escapeHtml(payment.title)}</p>
            <p class="text-xs text-gray-700 mt-2">${escapeHtml([payment.facility, payment.date, USE_DEMO_MODE ? payment.id : ""].filter(Boolean).join(" · "))}</p>
          </div>
          <div class="flex items-center gap-8">
            <p class="text-sm font-semibold">${formatNaira(payment.amount)}</p>
            <p class="w-36 text-xs font-medium ${status[1]}">${escapeHtml(status[0])}</p>
          </div>
        </div>
      </a>`;
  }

  // Show the payments that match the search box and the status filter
  function showHistory() {
    const searchText = searchInput.value.trim().toLowerCase();
    const shown = allPayments.filter(function (payment) {
      const text = (payment.title + " " + payment.facility + " " + payment.id).toLowerCase();
      return text.includes(searchText) && (statusFilter === "all" || payment.status === statusFilter);
    });

    paymentHistory.innerHTML = shown.map(rowHtml).join("");
    document.getElementById("historyEmpty").classList.toggle("hidden", shown.length > 0);

    // The filter button says "All statuses", or e.g. "Processing · Clear" while a filter is on
    filterButton.textContent = statusFilter === "all" ? "All statuses" : WP_STATUS[statusFilter][0] + " · Clear";
  }

  // The button opens the list of statuses; while a filter is on, the same button clears it
  filterButton.addEventListener("click", function () {
    if (statusFilter !== "all") {
      statusFilter = "all";
      showHistory();
      return;
    }
    filterMenu.classList.toggle("hidden");
  });

  filterMenu.addEventListener("click", function (event) {
    const option = event.target.closest("[data-status]");
    if (!option) {
      return;
    }
    statusFilter = option.getAttribute("data-status");
    filterMenu.classList.add("hidden");
    showHistory();
  });

  searchInput.addEventListener("input", showHistory);

  async function loadPaymentsPage() {
    let data;
    try {
      data = await wpLoadAll();
    } catch (error) {
      showGeneralError("Couldn't load your payments: " + error.message);
      return;
    }
    document.getElementById("paymentsLoading").classList.add("hidden");

    // No payments yet: only the "Your first payment starts with a shift" card shows
    if (data.payments.length === 0) {
      document.getElementById("paymentsEmpty").classList.remove("hidden");
      return;
    }

    document.getElementById("paymentsContent").classList.remove("hidden");
    fillFields(data.summary); // the 3 numbers at the top
    document.getElementById("payoutAccount").textContent = data.account
      ? data.account.name + " · " + data.account.bank + " · •••• " + data.account.last4
      : (data.accountName ? data.accountName + " · " : "") + "Your bank account on file";

    allPayments = data.payments;
    showHistory();
  }

  loadPaymentsPage();
}

// ==================================================
// 2. PAYMENT DETAILS (one page for every status: details, processing, receipt)
// ==================================================

const paymentDetail = document.getElementById("paymentDetail");

if (paymentDetail) {
  const paymentId = getUrlValue("payment") || "CP-1042";

  // The 4 steps of a payment, and which are done for each status
  const STEPS = ["Facility funded the shift", "Your attendance was recorded", "Facility confirms completion", "Payment sent to your bank"];
  const STEPS_DONE = { funds_secured: 1, awaiting_completion: 2, processing: 3, paid: 4 };

  function stepsHtml(status) {
    const done = STEPS_DONE[status] || 0;
    return STEPS.map(function (step, index) {
      return `<p>${index < done ? "✓" : "○"} ${step}</p>`;
    }).join("");
  }

  const backButton = `<a href="${WP_PAGES.list}" class="inline-block border border-blue-600 text-blue-600 text-sm font-medium text-center px-8 py-3 rounded-lg hover:bg-blue-50">Back to payments</a>`;

  function render(p) {
    const title = document.getElementById("detailTitle");
    let banner = ["", ""];
    let card = "";

    if (p.status === "funds_secured" || p.status === "awaiting_completion") {
      // "Payment details": the full breakdown and the progress list
      title.textContent = "Payment details";
      banner = p.status === "awaiting_completion"
        ? ["Waiting for the facility to complete your shift", "Your attendance is complete. We'll start your payment once " + p.facility + " confirms the shift is complete."]
        : ["Your pay for this shift is secured", p.facility + " has set aside your pay. You'll be paid after you work the shift and the facility confirms it's complete."];
      card = `
        <p class="text-2xl font-semibold">${formatNaira(p.amount)}</p>
        <h2 class="text-lg font-semibold mt-3">${escapeHtml(p.title)}</h2>
        <div class="text-xs text-gray-700 space-y-1 mt-3">
          <p>${escapeHtml(p.facility)} · ${escapeHtml(p.place)}</p>
          <p>${escapeHtml(p.date)} · ${escapeHtml(p.time)}</p>
          <p>Shift ${escapeHtml(p.id)}</p>
        </div>
        <div class="text-xs text-gray-700 space-y-1 mt-5">
          <p>Shift pay: ${formatNaira(p.amount)}</p>
          <p>Deductions: ${formatNaira(p.deductions)}</p>
          <p>You receive: ${formatNaira(p.amount - p.deductions)}</p>
        </div>
        <h3 class="text-base font-semibold mt-5">Payment progress</h3>
        <div class="text-xs text-gray-700 space-y-1 mt-3">${stepsHtml(p.status)}</div>
        <a href="${WP_PAGES.support}?payment=${encodeURIComponent(p.id)}" class="inline-block border border-blue-600 text-blue-600 text-sm font-medium text-center px-8 py-3 rounded-lg hover:bg-blue-50 mt-5">Report a payment issue</a>`;
      document.getElementById("detailBack").classList.remove("hidden");
    }

    if (p.status === "processing") {
      // "Payment processing"
      title.textContent = "Payment processing";
      banner = ["Your payment is on its way", "The facility has completed the shift. We're processing your " + formatNaira(p.amount - p.deductions) + " payout. We'll notify you when it reaches your bank."];
      card = `
        <h2 class="text-lg font-semibold">${escapeHtml(p.facility)} · ${escapeHtml(p.title.split(" · ")[0])}</h2>
        <div class="text-xs text-gray-700 space-y-1 mt-3">
          <p>Shift ${escapeHtml(p.id)} · ${escapeHtml(p.date)}</p>
          <p>Amount: ${formatNaira(p.amount - p.deductions)}</p>
          <p>To: ${escapeHtml(p.account)}</p>
          <p>Reference: ${escapeHtml(p.reference)}</p>
        </div>
        <div class="mt-5">${backButton}</div>`;
    }

    if (p.status === "paid") {
      // "Payment receipt"
      title.textContent = "Payment receipt";
      banner = ["Payment received", formatNaira(p.amount - p.deductions) + " was paid to your bank account."];
      card = `
        <p class="text-2xl font-semibold">${formatNaira(p.amount - p.deductions)}</p>
        <h2 class="text-lg font-semibold mt-3">${escapeHtml(p.facility)} · ${escapeHtml(p.title.split(" · ")[0])}</h2>
        <div class="text-xs text-gray-700 space-y-1 mt-3">
          <p>Shift ${escapeHtml(p.id)} · ${escapeHtml(p.date)}</p>
          <p>Paid on ${escapeHtml(p.paidOn)}</p>
          <p>${escapeHtml(p.account)}</p>
          <p>Payment reference: ${escapeHtml(p.reference)}</p>
          <p>Shift pay: ${formatNaira(p.amount)} · Deductions: ${formatNaira(p.deductions)}</p>
        </div>
        <div class="mt-5">${backButton}</div>`;
    }

    document.title = "Careporium - " + title.textContent;
    document.getElementById("detailBannerTitle").textContent = banner[0];
    document.getElementById("detailBannerText").textContent = banner[1];
    document.getElementById("detailBanner").classList.remove("hidden");
    document.getElementById("detailCard").innerHTML = card;
    document.getElementById("detailCard").classList.remove("hidden");
  }

  async function loadDetail() {
    try {
      const payment = await wpLoadOne(paymentId);
      document.getElementById("detailLoading").classList.add("hidden");
      if (!payment) {
        showGeneralError("We couldn't find this payment.");
        return;
      }
      render(payment);
    } catch (error) {
      showGeneralError("Couldn't load this payment: " + error.message);
    }
  }

  loadDetail();
}

// ==================================================
// 3. BANK DETAILS
// ==================================================

const bankForm = document.getElementById("bankForm");

if (bankForm) {
  // Show an error under a box, or hide it
  function setError(id, message) {
    const error = document.getElementById(id + "Error");
    error.textContent = message;
    error.classList.toggle("hidden", message === "");
    document.getElementById(id).classList.toggle("border-red-500", message !== "");
  }

  // Load the account that's saved now. The server should answer with { name, bank, last4 }.
  async function loadBank() {
    let account;
    try {
      account = usesDemo("payments") ? wpDemoBank() : await apiRequest(ENDPOINTS.bankAccount);
    } catch (error) {
      showGeneralError("Couldn't load your bank details: " + error.message);
      return;
    }
    document.getElementById("bankName").value = account.bank;
    document.getElementById("accountName").value = account.name;
    // The full number is never sent back to the browser; only the last 4 digits as a hint
    document.getElementById("accountNumber").placeholder = "••••••" + account.last4;
  }

  loadBank();

  // Account numbers: numbers only
  const accountNumber = document.getElementById("accountNumber");
  accountNumber.addEventListener("input", function () {
    accountNumber.value = accountNumber.value.replace(/[^0-9]/g, "");
  });

  bankForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const bank = document.getElementById("bankName").value;
    const number = accountNumber.value.trim();
    const name = document.getElementById("accountName").value.trim();
    let isValid = true;

    // Nigerian account numbers (NUBAN) have 10 digits
    if (number.length !== 10) {
      setError("accountNumber", "Enter your 10-digit account number.");
      isValid = false;
    } else {
      setError("accountNumber", "");
    }

    if (name === "") {
      setError("accountName", "Enter the name on the account.");
      isValid = false;
    } else if (usesDemo("payments") && name.toLowerCase() !== "amara okafor") {
      // DEMO: the real server checks the name against the bank and the verified profile
      setError("accountName", "The account name must match your verified profile (Amara Okafor).");
      isValid = false;
    } else {
      setError("accountName", "");
    }

    if (!isValid) {
      return;
    }

    const button = bankForm.querySelector('button[type="submit"]');

    if (usesDemo("payments")) {
      localStorage.setItem(wpBankKey(), JSON.stringify({ name: name, bank: bank, last4: number.slice(-4) }));
    } else {
      setLoading(button, true, "Saving…");
      try {
        await apiRequest(ENDPOINTS.bankAccount, "PUT", { bank: bank, accountNumber: number, accountName: name });
      } catch (error) {
        // e.g. { message: "This account name doesn't match your profile.", field: "accountName" }
        if (error.field && document.getElementById(error.field + "Error")) {
          setError(error.field, error.message);
        } else {
          showGeneralError("Couldn't save your bank details: " + error.message);
        }
        setLoading(button, false);
        return;
      }
    }

    // Remember what to show on the "saved" page
    sessionStorage.setItem("savedBank", JSON.stringify({ bank: bank, last4: number.slice(-4) }));
    window.location.href = WP_PAGES.bankSaved;
  });
}

// The "Bank details saved" page: "Future payments will go to your GTBank account ending in 4821."
const bankSavedText = document.getElementById("bankSavedText");

if (bankSavedText) {
  const saved = JSON.parse(sessionStorage.getItem("savedBank") || "null");
  if (saved) {
    bankSavedText.textContent = "Future payments will go to your " + saved.bank + " account ending in " + saved.last4 + ".";
  }
}

// ==================================================
// 4. PAYMENT SUPPORT (report a payment issue)
// ==================================================

const supportForm = document.getElementById("supportForm");

if (supportForm) {
  const paymentId = getUrlValue("payment") || "CP-1042";
  const detailsLink = WP_PAGES.details + "?payment=" + encodeURIComponent(paymentId);
  document.getElementById("backToDetails").href = detailsLink;

  // "Payment for shift CP-1042 · ₦30,000"
  wpLoadOne(paymentId).then(function (payment) {
    if (payment) {
      document.getElementById("supportPayment").textContent =
        "Payment for " + payment.title + " · " + payment.date + " · " + formatNaira(payment.amount - payment.deductions);
    }
  }).catch(function () {});

  supportForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const issue = document.getElementById("issueType").value;
    const message = document.getElementById("issueMessage").value.trim();
    const error = document.getElementById("issueMessageError");

    // A short explanation helps the team (at least 10 characters)
    if (message.length < 10) {
      error.textContent = "Please add a short explanation (at least 10 characters).";
      error.classList.remove("hidden");
      document.getElementById("issueMessage").classList.add("border-red-500");
      return;
    }
    error.classList.add("hidden");
    document.getElementById("issueMessage").classList.remove("border-red-500");

    if (!usesDemo("disputes")) {
      const button = supportForm.querySelector('button[type="submit"]');
      setLoading(button, true, "Submitting…");
      try {
        // A payment issue is raised as a dispute on the shift (POST /api/disputes/v1/raise-dispute)
        await Backend.raiseDispute(paymentId, issue, message);
      } catch (requestError) {
        showGeneralError("Couldn't submit your issue: " + requestError.message);
        setLoading(button, false);
        return;
      }
    }

    window.location.href = WP_PAGES.issueSubmitted + "?payment=" + encodeURIComponent(paymentId);
  });
}

// The "Payment issue submitted" page: "Your report is linked to shift CP-1042..."
const issueSubmittedText = document.getElementById("issueSubmittedText");

if (issueSubmittedText) {
  const paymentId = getUrlValue("payment") || "CP-1042";
  issueSubmittedText.textContent = "Your report is linked to shift " + paymentId + ". Our team will review it and update you in notifications.";
}
