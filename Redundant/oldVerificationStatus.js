// ====== VERIFICATION STATUS PAGE ======

//  CHANGE THIS to "pending", "verified", "rejected" or "resubmission" to see each screen.
// (Later, a backend will tell us the real status.)
let status = "verified";

// Everything that is different for each status.
// Each status is an object holding its own texts, colors, icon and button.
const statusDetails = {
  pending: {
    panelColor: "bg-amber-50",
    icon: "/icons/status-pending.png",
    label: "In review",
    labelColor: "text-amber-700",
    title: "Pending Review",
    message:
      "Your profile and documents are under review. This usually takes 1–3 business days.",
    infoTitle: "Our verification team is checking your submitted credentials.",
    infoText: "Expected review time · 1–3 business days",
    buttonText: "View details",
    buttonColor: "bg-amber-700 text-white hover:bg-amber-800",
    buttonLink: "#",
  },

  verified: {
    panelColor: "bg-blue-50",
    icon: "/icons/status-verified.png",
    label: "Approved",
    labelColor: "text-teal-700",
    title: "Verified",
    message:
      "Your profile has been verified. You can now start receiving opportunities.",
    infoTitle: "Your credentials have passed verification.",
    infoText: "Your professional profile is ready to use.",
    buttonText: "Go to Dashboard",
    buttonColor: "bg-teal-700 text-white hover:bg-teal-800",
    buttonLink: "/WorkshiftMarket/Dashboard.html",
  },

  rejected: {
    panelColor: "bg-blue-50",
    icon: "/icons/status-rejected.png",
    label: "Action needed",
    labelColor: "text-red-600",
    title: "Rejected",
    message:
      "There's an issue with your document. Please review the feedback and resubmit.",
    infoTitle: "One or more submitted documents needs attention.",
    infoText: "Open the details to see feedback and upload a correction.",
    buttonText: "View details",
    buttonColor: "bg-red-600 text-white hover:bg-red-700",
    buttonLink: "#",
  },

  resubmission: {
    panelColor: "bg-blue-50",
    icon: "/icons/status-resubmission.png",
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

// Pick the details for the current status
const details = statusDetails[status];

// Put the texts on the page
document.getElementById("statusLabel").textContent = details.label;
document.getElementById("statusTitle").textContent = details.title;
document.getElementById("statusMessage").textContent = details.message;
document.getElementById("infoTitle").textContent = details.infoTitle;
document.getElementById("infoText").textContent = details.infoText;
document.getElementById("statusIcon").src = details.icon;

// Set the colors. className replaces ALL the classes, so we write the fixed ones too.
document.getElementById("statusPanel").className =
  "md:w-72 flex-shrink-0 flex flex-col items-center justify-center py-10 " +
  details.panelColor;

document.getElementById("statusLabel").className =
  "text-xs font-semibold uppercase mt-5 " + details.labelColor;

// Set up the button
const button = document.getElementById("statusButton");

button.textContent = details.buttonText;
button.className =
  "w-full md:w-1/2 text-sm font-medium py-3 rounded-lg mt-3 " +
  details.buttonColor;

// "Resubmission" has no link, so its button is turned off
if (details.buttonLink === "") {
  button.disabled = true;
}

// When the button is clicked, go to its link
button.addEventListener("click", function () {
  window.location.href = details.buttonLink;
});
