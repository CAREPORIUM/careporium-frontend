// ====== VERIFICATION STATUS PAGE ======
// Needs /js/api.js to be loaded first (it holds getVerificationStatus and the demo helpers).

// ---------- Who is logged in? ----------

// The login page saved "professional" or "facility" in localStorage.
// If nothing was saved (e.g. the page was opened directly), use "professional".
let userType = sessionGet("userType");

if (userType === null) {
  userType = "professional";
}

// Each type of user has their own dashboard and their own page for uploading documents.
// Change these paths to where your pages really are.
const dashboards = {
  professional: "../WorkerShiftMarket/Dashboard.html",
  facility: "../FacilityHiringSection/Dashboard.html",
};
const uploadPages = {
  professional: "../HealthWorkerSection/healthWorkerCredentials.html",
  facility: "../FacilitySection/facilityRegistration.html",
};

// ---------- The 5 statuses ----------

// Everything that is different for each status.
// Each status is an object holding its own texts, colors, icon and button.
const statusDetails = {
  not_submitted: {
    panelColor: "bg-blue-50",
    icon: "../icons/status-pending.png",
    label: "Not started",
    labelColor: "text-blue-600",
    title: "Verification needed",
    message: "You haven't uploaded your documents yet. Upload them to start your review.",
    infoTitle: "We check every account before it can take or post shifts.",
    infoText: "Reviews usually take 1–3 business days after you submit.",
    buttonText: "Upload my documents",
    buttonColor: "bg-blue-600 text-white hover:bg-blue-700",
    buttonLink: uploadPages[userType],
  },

  pending: {
    panelColor: "bg-amber-50",
    icon: "../icons/status-pending.png",
    label: "In review",
    labelColor: "text-amber-700",
    title: "Pending Review",
    message: "Your profile and documents are under review. This usually takes 1–3 business days.",
    infoTitle: "Our verification team is checking your submitted credentials.",
    infoText: "Expected review time · 1–3 business days",
    buttonText: "Back to dashboard",
    buttonColor: "bg-amber-700 text-white hover:bg-amber-800",
    buttonLink: dashboards[userType],
  },

  verified: {
    panelColor: "bg-blue-50",
    icon: "../icons/status-verified.png",
    label: "Approved",
    labelColor: "text-teal-700",
    title: "Verified",
    message: "Your profile has been verified. You can now start receiving opportunities.",
    infoTitle: "Your credentials have passed verification.",
    infoText: "Your professional profile is ready to use.",
    buttonText: "Go to Dashboard",
    buttonColor: "bg-teal-700 text-white hover:bg-teal-800",
    buttonLink: dashboards[userType],
  },

  rejected: {
    panelColor: "bg-blue-50",
    icon: "../icons/status-rejected.png",
    label: "Action needed",
    labelColor: "text-red-600",
    title: "Rejected",
    message: "There's an issue with your document. Please review the feedback and resubmit.",
    infoTitle: "One or more submitted documents needs attention.",
    infoText: "Upload a corrected document to continue your review.",
    buttonText: "Upload corrected documents",
    buttonColor: "bg-red-600 text-white hover:bg-red-700",
    buttonLink: uploadPages[userType],
  },

  resubmission: {
    panelColor: "bg-blue-50",
    icon: "../icons/status-resubmission.png",
    label: "Reviewing again",
    labelColor: "text-blue-600",
    title: "Resubmission",
    message: "You've updated your documents. We're reviewing them again.",
    infoTitle: "Your revised documents have been received.",
    infoText: "We'll notify you when the new review is complete.",
    buttonText: "Reviewing",
    buttonColor: "bg-slate-200 text-gray-600 cursor-not-allowed",
    buttonLink: "", // no link: this button can't be clicked
  },
};

// ---------- Show a status on the page ----------

const button = document.getElementById("statusButton");

// The link the button goes to (it changes with the status)
let buttonLink = "";

// Put one status's texts, colors and button on the page.
// feedback (optional) is the reviewer's note, shown for "rejected".
function showStatus(status, feedback) {
  // If the status is one we don't know, show "pending" to be safe
  const details = statusDetails[status] || statusDetails.pending;

  // Put the texts on the page
  document.getElementById("statusLabel").textContent = details.label;
  document.getElementById("statusTitle").textContent = details.title;
  document.getElementById("statusMessage").textContent = details.message;
  document.getElementById("infoTitle").textContent = details.infoTitle;
  document.getElementById("infoText").textContent = feedback || details.infoText;
  document.getElementById("statusIcon").src = details.icon;

  // Set the colors. className replaces ALL the classes, so we write the fixed ones too.
  document.getElementById("statusPanel").className =
    "md:w-72 flex-shrink-0 flex flex-col items-center justify-center py-10 " + details.panelColor;

  document.getElementById("statusLabel").className = "text-xs font-semibold uppercase mt-5 " + details.labelColor;

  // Set up the button
  button.textContent = details.buttonText;
  button.className = "w-full md:w-1/2 text-sm font-medium py-3 rounded-lg mt-3 " + details.buttonColor;
  buttonLink = details.buttonLink;

  // "Resubmission" has no link, so its button is turned off
  button.disabled = buttonLink === "";
}

// When the button is clicked, go to its link
button.addEventListener("click", function () {
  if (buttonLink !== "") {
    window.location.href = buttonLink;
  }
});

// The "Back to dashboard" link under the card
document.getElementById("backToDashboard").href = dashboards[userType];

// ---------- Get the status (from the server, or the demo memory) ----------

async function loadStatus() {
  try {
    const info = await getVerificationStatus();
    showStatus(info.status, info.feedback);
  } catch (error) {
    showGeneralError("Couldn't load your verification status: " + error.message);
  }
}

loadStatus();

// ---------- DEMO ONLY: change this account's status ----------

// Without a backend, nobody can approve the documents. These buttons pretend to be the admin,
// so every version of the dashboard can be shown. They only appear in demo mode.
const demoPanel = document.getElementById("demoPanel");

if (USE_DEMO_MODE) {
  demoPanel.classList.remove("hidden");

  document.querySelectorAll("[data-demo-status]").forEach(function (demoButton) {
    demoButton.addEventListener("click", function () {
      const status = demoButton.getAttribute("data-demo-status");

      let feedback = "";
      if (status === "rejected") {
        feedback = "Your licence has expired. Please upload a current licence.";
      }

      setDemoVerification(status, feedback);
      window.location.reload(); // show the page again with the new status
    });
  });
}
