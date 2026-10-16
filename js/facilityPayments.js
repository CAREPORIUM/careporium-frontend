// ====== FACILITY PAYMENTS (payments list, fund a shift, shift funded, payment unsuccessful) ======
// Needs /js/api.js to be loaded first.
//
// Every shift's pay goes through these statuses:
//   "awaiting_funding"  posted, but the money isn't set aside yet → "Fund this shift"
//   "funds_secured"     the money is set aside until the shift is completed → "View shift attendance"
//   "paid"              the shift was completed and the workers were paid

// Demo mode only: sample data, with a note. With the real backend these pages are worked out from
// the facility's shifts and each shift's HarrenaPay escrow payment (see "5b" in backend.js).
if (usesDemo("facilityPayments")) {
  document.addEventListener("DOMContentLoaded", function () {
    showPreviewNote("Payments");
  });
}

// The facility payment pages (make these match your real file names exactly)
const FP_PAGES = {
  list: "../FacilityHiringSection/Payments.html",
  fund: "../FacilityHiringSection/FundShift.html",
  funded: "../FacilityHiringSection/ShiftFunded.html",
  failed: "../FacilityHiringSection/PaymentUnsuccessful.html",
  shift: "../FacilityHiringSection/ShiftDetails.html",
};

const FP_STATUS = {
  awaiting_funding: ["Awaiting funding", "text-gray-700"],
  funds_secured: ["Funds secured", "text-green-700"],
  paid: ["Paid", "text-green-700"],
};

// Turn 60000 into "₦60,000"
function fpNaira(amount) {
  return "₦" + Number(amount).toLocaleString();
}

// ==================================================
// DEMO DATA (only used when USE_DEMO_MODE is true in api.js)
// ==================================================

// Saved in the browser, so funding a shift is remembered
const FP_DEMO_KEY = "demoFacilityPayments";

function fpNewDemo() {
  return {
    // The numbers at the top (the real server works these out)
    totals: { awaiting: 60000, awaitingCount: 1, secured: 120000, securedCount: 2, paidThisMonth: 240000 },
    payments: [
      { id: "CP-1045", title: "Registered nurse · General ward", facilityLine: "Mainland Care Hospital · Yaba, Lagos", date: "10 Oct 2026", time: "08:00–16:00 WAT", workers: 2, perWorker: 30000, amount: 60000, status: "awaiting_funding", reference: "" },
      { id: "CP-1042", title: "Registered nurse · General ward", facilityLine: "Mainland Care Hospital · Yaba, Lagos", date: "9 Oct 2026", time: "08:00–16:00 WAT", workers: 2, perWorker: 30000, amount: 60000, status: "funds_secured", reference: "CP-FUND-1042" },
      { id: "CP-1029", title: "Pharmacist · Day shift", facilityLine: "Mainland Care Hospital · Yaba, Lagos", date: "5 Oct 2026", time: "08:00–16:00 WAT", workers: 1, perWorker: 40000, amount: 40000, status: "paid", reference: "CP-FUND-1029" },
    ],
  };
}

function fpDemo() {
  const saved = localStorage.getItem(FP_DEMO_KEY);
  return saved ? JSON.parse(saved) : fpNewDemo();
}

function fpSaveDemo(data) {
  localStorage.setItem(FP_DEMO_KEY, JSON.stringify(data));
}

// Turn the demo totals into the texts the page shows (the server sends these texts itself)
function fpSummary(totals) {
  return {
    awaitingFunding: fpNaira(totals.awaiting),
    awaitingFundingNote: totals.awaitingCount + (totals.awaitingCount === 1 ? " shift needs" : " shifts need") + " funding",
    fundsSecured: fpNaira(totals.secured),
    fundsSecuredNote: totals.securedCount + " upcoming " + (totals.securedCount === 1 ? "shift" : "shifts") + " covered",
    paidThisMonth: fpNaira(totals.paidThisMonth),
    paidThisMonthNote: "Payments for completed shifts",
  };
}

// ==================================================
// LOADING
// ==================================================

// The Payments page. The server should answer with:
// { summary: { awaitingFunding, awaitingFundingNote, fundsSecured, fundsSecuredNote, paidThisMonth, paidThisMonthNote },
//   payments: [ { id, title, facilityLine, date, time, workers, perWorker, amount, status, reference }, ... ] }
async function fpLoadAll() {
  if (usesDemo("facilityPayments")) {
    const data = fpDemo();
    return { summary: fpSummary(data.totals), payments: data.payments };
  }
  return await Backend.facilityPayments();
}

// One shift's payment (same shape as one item above)
async function fpLoadOne(id) {
  if (usesDemo("facilityPayments")) {
    return fpDemo().payments.find(function (p) { return p.id === id; }) || null;
  }
  return await Backend.shiftPayment(id);
}

// The shift the page is about, from the address (e.g. FundShift.html?shift=CP-1045)
const fpShiftId = getUrlValue("shift") || "CP-1045";

// ==================================================
// 1. PAYMENTS PAGE
// ==================================================

const shiftPaymentList = document.getElementById("shiftPaymentList");

if (shiftPaymentList) {
  // One shift's row, with the button its status needs
  function rowHtml(p) {
    const status = FP_STATUS[p.status] || ["", "text-gray-700"];
    let button = "";
    if (p.status === "awaiting_funding") {
      button = `<a href="${FP_PAGES.fund}?shift=${encodeURIComponent(p.id)}" class="inline-block bg-blue-600 text-white text-xs font-medium text-center px-6 py-3 rounded-lg hover:bg-blue-700 mt-5">Fund this shift</a>`;
    }
    if (p.status === "funds_secured") {
      button = `<a href="${FP_PAGES.shift}?shift=${encodeURIComponent(p.id)}" class="inline-block border border-blue-600 text-blue-600 text-xs font-medium text-center px-6 py-3 rounded-lg hover:bg-blue-50 mt-5">View shift attendance</a>`;
    }
    const people = p.workers + (p.workers === 1 ? " worker" : " workers");
    return `
      <div class="border-b border-gray-200 py-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold">${escapeHtml(p.title)}</p>
            <p class="text-xs text-gray-700 mt-2">${escapeHtml(p.date)} · ${people}${USE_DEMO_MODE ? " · " + escapeHtml(p.id) : ""}</p>
          </div>
          <div class="flex items-center gap-8">
            <p class="text-sm font-semibold">${fpNaira(p.amount)}</p>
            <p class="w-32 text-xs font-medium ${status[1]}">${escapeHtml(status[0])}</p>
          </div>
        </div>
        ${button}
      </div>`;
  }

  async function loadFacilityPayments() {
    let data;
    try {
      data = await fpLoadAll();
    } catch (error) {
      showGeneralError("Couldn't load your payments: " + error.message);
      return;
    }
    document.getElementById("paymentsLoading").classList.add("hidden");
    fillFields(data.summary);
    shiftPaymentList.innerHTML = data.payments.map(rowHtml).join("");
    document.getElementById("shiftPaymentsEmpty").classList.toggle("hidden", data.payments.length > 0);
  }

  loadFacilityPayments();
}

// ==================================================
// 2. FUND SHIFT
// ==================================================

const fundForm = document.getElementById("fundForm");

if (fundForm) {
  async function loadFundPage() {
    let p;
    try {
      p = await fpLoadOne(fpShiftId);
    } catch (error) {
      showGeneralError("Couldn't load this shift's payment: " + error.message);
      return;
    }
    if (!p) {
      showGeneralError("We couldn't find this shift.");
      return;
    }
    // Already funded? Don't let the facility pay twice: show the funded page instead
    if (p.status !== "awaiting_funding") {
      window.location.replace(FP_PAGES.funded + "?shift=" + encodeURIComponent(p.id));
      return;
    }

    document.getElementById("fundTitle").textContent = p.title;
    document.getElementById("fundFacility").textContent = p.facilityLine;
    document.getElementById("fundWhen").textContent = p.date + " · " + p.time + (USE_DEMO_MODE ? " · " + p.id : "");
    document.getElementById("fundPeople").textContent =
      p.workers + (p.workers === 1 ? " worker" : " workers") + " × " + fpNaira(p.perWorker);
    document.getElementById("fundTotal").textContent = "Total to fund: " + fpNaira(p.amount);
    document.getElementById("fundLoading").classList.add("hidden");
    fundForm.classList.remove("hidden");

    if (!usesDemo("facilityPayments")) {
      showEscrow(p);
    }
  }

  // ---------- REAL: the HarrenaPay escrow payment ----------

  // The payment details: the test-payment link, the bank account to transfer to, the reference
  function showEscrow(p) {
    document.getElementById("demoPaymentMethod").classList.add("hidden");
    document.getElementById("escrowBox").classList.remove("hidden");
    document.getElementById("fundFeeNote").textContent = p.commission
      ? "Workers' pay " + fpNaira(p.workerTotal) + " + platform fee " + fpNaira(p.commission) +
        (p.commissionRate ? " (" + p.commissionRate + ")" : "") + "."
      : "Workers' pay for the whole shift. Any platform fee is shown on the payment page.";

    const payLink = document.getElementById("payLink");
    if (p.checkoutUrl) {
      payLink.href = p.checkoutUrl;
      payLink.classList.remove("hidden");
    } else {
      payLink.classList.add("hidden");
    }
    document.getElementById("payLinkNote").textContent =
      "Opens the " + (p.provider ? p.provider + " " : "") + "test checkout in a new tab. No real money is taken.";
    document.getElementById("testCardBox").classList.toggle("hidden", p.provider !== "Paystack");
    document.getElementById("bankBox").classList.toggle("hidden", !p.accountNumber);
    document.getElementById("bankName").textContent = p.bankName || "—";
    document.getElementById("accountNumber").textContent = p.accountNumber || "—";
    document.getElementById("bankAmount").textContent = fpNaira(p.amount);
    document.getElementById("paymentReference").textContent = p.reference || "—";
    document.getElementById("paymentExpires").textContent = p.expiresAt || "—";
    document.getElementById("paymentExpiresLine").classList.toggle("hidden", !p.expiresAt);

    // No payment link in this browser (posted on another device, or before this update):
    // ask the backend for one straight away (once)
    if (!p.checkoutUrl && !p.accountNumber && !askedForLink) {
      askedForLink = true;
      document.getElementById("newPaymentLink").click();
    }
  }
  let askedForLink = false;

  // Funded: say so, then go to the "Shift funded" page
  function showFunded() {
    stopPolling();
    const banner = document.getElementById("escrowBanner");
    banner.className = "bg-green-50 border border-green-100 rounded-xl p-5 mt-5";
    document.getElementById("escrowTitle").className = "text-sm font-semibold text-green-700";
    document.getElementById("escrowTitle").textContent = "Payment received · your shift is live";
    document.getElementById("escrowText").textContent = "Workers can now see and apply for this shift. Taking you to the confirmation…";
    document.getElementById("payOptions").classList.add("hidden");
    setTimeout(function () {
      window.location.href = FP_PAGES.funded + "?shift=" + encodeURIComponent(fpShiftId);
    }, 1500);
  }

  // Ask the server whether the shift is funded yet (the backend's HarrenaPay webhook makes it "open")
  async function checkFunding(fromButton) {
    const button = document.getElementById("checkPayment");
    if (fromButton) setLoading(button, true, "Checking…");
    try {
      const p = await fpLoadOne(fpShiftId);
      if (p && p.status !== "awaiting_funding") {
        showFunded();
        return;
      }
      if (fromButton) {
        document.getElementById("paymentCheckNote").textContent =
          "Not confirmed yet (status: " + (p.shiftStatus || "pending payment").replace(/_/g, " ") +
          (p.escrowStatus ? ", escrow " + p.escrowStatus.replace(/_/g, " ") : "") +
          "). It can take a minute after paying. This page keeps checking.";
      }
    } catch (error) {
      if (fromButton) showGeneralError("Couldn't check the payment: " + error.message);
    }
    if (fromButton) setLoading(button, false);
  }

  let pollTimer = null;
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  if (!usesDemo("facilityPayments")) {
    document.getElementById("checkPayment").addEventListener("click", function () {
      checkFunding(true);
    });

    document.getElementById("newPaymentLink").addEventListener("click", async function () {
      const button = document.getElementById("newPaymentLink");
      setLoading(button, true, "Getting a new link…");
      try {
        const p = await Backend.retryShiftPayment(fpShiftId);
        if (p.status !== "awaiting_funding") {
          showFunded();
          return;
        }
        showEscrow(p);
        document.getElementById("paymentCheckNote").textContent = p.checkoutUrl
          ? "New payment link ready."
          : "The server didn't send a payment link back. Ask the backend developer to check the HarrenaPay sandbox.";
      } catch (error) {
        // The server can't make a new link for this payment (e.g. its retry supports another
        // provider): if this page already has a link, that one still works
        if (document.getElementById("payLink").getAttribute("href") !== "#" &&
            !document.getElementById("payLink").classList.contains("hidden")) {
          document.getElementById("paymentCheckNote").textContent =
            "Use “Make test payment to escrow” above: it's this shift's payment link.";
        } else {
          showGeneralError("Couldn't get a payment link: " + error.message);
        }
      }
      setLoading(button, false);
    });

    // Check every 8 seconds, and as soon as the facility comes back from the payment tab
    pollTimer = setInterval(function () { checkFunding(false); }, 8000);
    window.addEventListener("focus", function () { checkFunding(false); });
  }

  loadFundPage();

  fundForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const method = document.getElementById("paymentMethod").value;
    const button = fundForm.querySelector('button[type="submit"]');

    // DEMO: succeed, unless "Pretend the payment fails" is ticked in the demo panel
    if (usesDemo("facilityPayments")) {
      if (document.getElementById("demoFail").checked) {
        window.location.href = FP_PAGES.failed + "?shift=" + encodeURIComponent(fpShiftId);
        return;
      }
      const data = fpDemo();
      const p = data.payments.find(function (item) { return item.id === fpShiftId; });
      if (!p) {
        showGeneralError("We couldn't find this shift.");
        return;
      }
      p.status = "funds_secured";
      p.reference = "CP-FUND-" + p.id.replace("CP-", "");
      data.totals.awaiting -= p.amount;
      data.totals.awaitingCount -= 1;
      data.totals.secured += p.amount;
      data.totals.securedCount += 1;
      fpSaveDemo(data);
      window.location.href = FP_PAGES.funded + "?shift=" + encodeURIComponent(fpShiftId);
      return;
    }

    // REAL: the server starts the payment. It answers with either
    //   { checkoutUrl: "https://..." } → we go to the payment provider's page to pay, and the provider
    //                                   sends the facility back to ShiftFunded.html?shift=... afterwards
    //   { status: "funds_secured" }    → paid straight away
    setLoading(button, true, "Starting payment…");
    try {
      const result = await apiRequest(ENDPOINTS.fundShift(fpShiftId), "POST", { method: method });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        window.location.href = FP_PAGES.funded + "?shift=" + encodeURIComponent(fpShiftId);
      }
    } catch (error) {
      window.location.href = FP_PAGES.failed + "?shift=" + encodeURIComponent(fpShiftId);
    }
  });

  // DEMO ONLY: the "Pretend the payment fails" box
  if (usesDemo("facilityPayments")) {
    document.getElementById("demoPanel").classList.remove("hidden");
  }
}

// ==================================================
// 3. SHIFT FUNDED
// ==================================================

const fundedDetails = document.getElementById("fundedDetails");

if (fundedDetails) {
  async function loadFunded() {
    let p;
    try {
      p = await fpLoadOne(fpShiftId);
    } catch (error) {
      showGeneralError("Couldn't load this shift's payment: " + error.message);
      return;
    }
    if (!p) {
      showGeneralError("We couldn't find this shift.");
      return;
    }
    // Coming back from the payment provider, but the money didn't arrive: show the failure page
    if (p.status === "awaiting_funding") {
      window.location.replace(FP_PAGES.failed + "?shift=" + encodeURIComponent(p.id));
      return;
    }

    const people = p.workers === 1 ? "assigned worker" : p.workers + " assigned workers";
    document.getElementById("fundedText").textContent =
      fpNaira(p.amount) + " is secured for your " + people + ". You can now follow their attendance on the shift details page.";
    document.getElementById("fundedTitle").textContent = p.title;
    document.getElementById("fundedShift").textContent = "Shift " + (p.shortId || p.id) + " · " + p.date;
    document.getElementById("fundedAmount").textContent = "Funding amount: " + fpNaira(p.amount);
    document.getElementById("fundedReference").textContent = "Payment reference: " + (p.reference || "—");
    document.getElementById("fundedStatus").textContent = "Status: " + (FP_STATUS[p.status] || ["Funds secured"])[0] +
      (USE_DEMO_MODE ? "" : " · workers can now see and apply for this shift");
    document.getElementById("fundedLoading").classList.add("hidden");
    fundedDetails.classList.remove("hidden");
  }

  loadFunded();
}

// ==================================================
// 4. PAYMENT UNSUCCESSFUL
// ==================================================

const retryPayment = document.getElementById("retryPayment");

if (retryPayment) {
  // "Shift CP-1045 · ₦60,000"
  fpLoadOne(fpShiftId).then(function (p) {
    if (p) {
      document.getElementById("failedShift").textContent = "Shift " + (p.shortId || p.id) + " · " + fpNaira(p.amount);
    }
  }).catch(function () {});

  // Try again: check first whether the money arrived after all, so the facility never pays twice
  retryPayment.addEventListener("click", async function () {
    setLoading(retryPayment, true, "Checking…");
    let p = null;
    try {
      p = await fpLoadOne(fpShiftId);
    } catch (error) {
      showGeneralError("Couldn't check the payment status: " + error.message);
      setLoading(retryPayment, false);
      return;
    }
    if (p && p.status !== "awaiting_funding") {
      window.location.href = FP_PAGES.funded + "?shift=" + encodeURIComponent(fpShiftId);
    } else {
      window.location.href = FP_PAGES.fund + "?shift=" + encodeURIComponent(fpShiftId);
    }
  });
}
