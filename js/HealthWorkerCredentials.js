// ====== CREDENTIAL VERIFICATION PAGE ======

// The files the user has picked. They start empty (null means "nothing yet").
let licenseFile = null;
let idFile = null;
let educationFile = null;
let addressFile = null;

// The ID type the user picked. National ID is picked at the start, like in the design.
let selectedIdType = "National ID";

// ==================================================
// HELPER FUNCTIONS
// ==================================================

// Check a file and give back an error message. An empty message "" means the file is fine.
function checkFile(file) {
  // The only file types we accept
  const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];

  // 10 MB written in bytes (1 MB = 1024 × 1024 bytes)
  const maxSize = 10 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    return "Only PDF, PNG or JPG files are allowed.";
  }

  if (file.size > maxSize) {
    return "This file is too big. The maximum size is 10 MB.";
  }

  return "";
}

// Turn a size in bytes into text like "2.48 MB"
function formatSize(bytes) {
  const megabytes = bytes / (1024 * 1024);
  return megabytes.toFixed(2) + " MB";
}

// Show a red error message
function showError(errorId, message) {
  const errorText = document.getElementById(errorId);
  errorText.textContent = message;
  errorText.classList.remove("hidden");
}

// Hide an error message
function clearError(errorId) {
  const errorText = document.getElementById(errorId);
  errorText.textContent = "";
  errorText.classList.add("hidden");
}

// Show a picture of the file. PDFs can't be shown as a picture, so we show a "PDF" box instead.
function showPreview(file, imageId, pdfBoxId) {
  const image = document.getElementById(imageId);
  const pdfBox = document.getElementById(pdfBoxId);

  if (file.type === "application/pdf") {
    image.classList.add("hidden");
    pdfBox.classList.remove("hidden");
  } else {
    // URL.createObjectURL gives the browser a temporary link to the picked file
    image.src = URL.createObjectURL(file);
    image.classList.remove("hidden");
    pdfBox.classList.add("hidden");
  }
}

// ==================================================
// MOVING BETWEEN STEPS
// ==================================================

// Show one step and hide the others. stepNumber is 1, 2, 3 or 4 (4 = success).
function showStep(stepNumber) {
  document.getElementById("step1").classList.add("hidden");
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step3").classList.add("hidden");
  document.getElementById("successStep").classList.add("hidden");

  if (stepNumber === 1) {
    document.getElementById("step1").classList.remove("hidden");
  } else if (stepNumber === 2) {
    document.getElementById("step2").classList.remove("hidden");
  } else if (stepNumber === 3) {
    document.getElementById("step3").classList.remove("hidden");
  } else {
    document.getElementById("successStep").classList.remove("hidden");
  }

  // The success screen has no sidebar in the design.
  // The sidebar always has "hidden" (hidden on mobile). "md:block" is what shows it on desktop,
  // so we only need to add or remove "md:block".
  const sidebar = document.getElementById("sidebar");
  if (stepNumber === 4) {
    sidebar.classList.remove("md:block");
  } else {
    sidebar.classList.add("md:block");
  }

  updateSidebar(stepNumber);

  // Go back to the top of the page
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Color the 4 sidebar items: done (blue check), current (light blue row), or not yet (gray)
function updateSidebar(currentStep) {
  for (let i = 1; i <= 4; i++) {
    const row = document.getElementById("nav" + i);
    const circle = document.getElementById("navCircle" + i);

    if (i < currentStep) {
      // DONE: blue circle with a check
      row.className = "flex items-center gap-3 p-3 rounded-lg";
      circle.className =
        "w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center";
      circle.textContent = "✓";
    } else if (i === currentStep) {
      // CURRENT: light blue row and blue circle with the number
      row.className = "flex items-center gap-3 p-3 rounded-lg bg-blue-50";
      circle.className =
        "w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center";
      circle.textContent = i;
    } else {
      // NOT YET: white circle with a gray border
      row.className = "flex items-center gap-3 p-3 rounded-lg";
      circle.className =
        "w-5 h-5 rounded-full border border-gray-300 text-gray-700 text-xs flex items-center justify-center";
      circle.textContent = i;
    }
  }
}

// ---------- Back arrows (top left of each step) ----------

// Each arrow's data-step="..." says where it goes. "0" means leave this page.
document.querySelectorAll(".back-arrow").forEach(function (arrow) {
  arrow.addEventListener("click", function () {
    const step = Number(arrow.getAttribute("data-step"));

    if (step === 0) {
      history.back(); // go to the previous page
    } else {
      showStep(step); // go to that step
    }
  });
});

// ==================================================
// STEP 1: PROFESSIONAL LICENSE
// ==================================================

const licenseInput = document.getElementById("licenseInput");

// Clicking the upload box (or the preview, to change the file) opens the file picker
document
  .getElementById("licenseUploadBox")
  .addEventListener("click", function () {
    licenseInput.click();
  });
document
  .getElementById("licensePreviewCard")
  .addEventListener("click", function () {
    licenseInput.click();
  });

// When a file is picked
licenseInput.addEventListener("change", function () {
  const file = licenseInput.files[0];

  // The user closed the picker without choosing anything
  if (!file) {
    return;
  }

  // Check the file type and size
  const error = checkFile(file);
  if (error !== "") {
    showError("licenseError", error);
    licenseInput.value = ""; // clear the picker so the same file can be picked again later
    return;
  }

  // The file is fine: save it and show the preview
  clearError("licenseError");
  licenseFile = file;

  showPreview(file, "licensePreviewImage", "licensePdfBox");
  document.getElementById("licenseFileText").textContent =
    file.name + " · " + formatSize(file.size);

  // Swap the upload box for the preview
  document.getElementById("licenseUploadBox").classList.add("hidden");
  document.getElementById("licensePreviewBox").classList.remove("hidden");

  // Change the text at the top, like in the design
  document.getElementById("step1Title").textContent = "Professional license";
  document.getElementById("step1Subtitle").textContent =
    "Make sure the document is clear, valid, and not expired.";
  document.getElementById("step1BannerText").textContent =
    "Your information is safe with us.";
});

// Back: go to the page the user came from
document.getElementById("step1Back").addEventListener("click", function () {
  history.back();
});

// Next: only move on if a license was uploaded
document.getElementById("step1Next").addEventListener("click", function () {
  if (licenseFile === null) {
    showError(
      "licenseError",
      "Please upload your professional license to continue.",
    );
    return;
  }
  showStep(2);
});

// ==================================================
// STEP 2: ID DOCUMENT
// ==================================================

const idInput = document.getElementById("idInput");

document.getElementById("idUploadBox").addEventListener("click", function () {
  idInput.click();
});
document.getElementById("idPreviewCard").addEventListener("click", function () {
  idInput.click();
});

idInput.addEventListener("change", function () {
  const file = idInput.files[0];

  if (!file) {
    return;
  }

  const error = checkFile(file);
  if (error !== "") {
    showError("idError", error);
    idInput.value = "";
    return;
  }

  clearError("idError");
  idFile = file;

  showPreview(file, "idPreviewImage", "idPdfBox");
  document.getElementById("idFileText").textContent =
    file.name + " · " + formatSize(file.size);

  // Swap the upload box for the preview
  document.getElementById("idUploadBox").classList.add("hidden");
  document.getElementById("idPreviewCard").classList.remove("hidden");
});

// Document type buttons: only one can be picked at a time
const idTypeOptions = document.querySelectorAll(".id-type-option");

idTypeOptions.forEach(function (option) {
  option.addEventListener("click", function () {
    // Make every option look "not picked"
    idTypeOptions.forEach(function (otherOption) {
      otherOption.classList.remove(
        "border-blue-400",
        "bg-blue-50",
        "text-blue-600",
      );
      otherOption.classList.add("border-gray-200", "bg-white", "text-gray-900");
    });

    // Make the clicked option look "picked"
    option.classList.remove("border-gray-200", "bg-white", "text-gray-900");
    option.classList.add("border-blue-400", "bg-blue-50", "text-blue-600");

    // Remember which one was picked (from its data-type="..." attribute)
    selectedIdType = option.getAttribute("data-type");
  });
});

document.getElementById("step2Back").addEventListener("click", function () {
  showStep(1);
});

// Next: only move on if an ID was uploaded and a type is picked
document.getElementById("step2Next").addEventListener("click", function () {
  if (idFile === null) {
    showError("idError", "Please upload your ID document to continue.");
    return;
  }
  if (selectedIdType === "") {
    showError("idError", "Please choose a document type.");
    return;
  }
  showStep(3);
});

// ==================================================
// STEPS 3–4: EDUCATION CERTIFICATE & PROOF OF ADDRESS
// ==================================================

// Save a picked education file (used by both clicking and drag and drop)
function handleEducationFile(file) {
  const error = checkFile(file);
  if (error !== "") {
    showError("educationError", error);
    document.getElementById("educationInput").value = "";
    return;
  }

  clearError("educationError");
  educationFile = file;

  // Show the file name and size in green
  const fileText = document.getElementById("educationFileText");
  fileText.textContent = "✓ " + file.name + " · " + formatSize(file.size);
  fileText.classList.add("text-green-600");
}

// Save a picked address file (same idea as above)
function handleAddressFile(file) {
  const error = checkFile(file);
  if (error !== "") {
    showError("addressError", error);
    document.getElementById("addressInput").value = "";
    return;
  }

  clearError("addressError");
  addressFile = file;

  const fileText = document.getElementById("addressFileText");
  fileText.textContent = "✓ " + file.name + " · " + formatSize(file.size);
  fileText.classList.add("text-green-600");
}

const educationInput = document.getElementById("educationInput");
const addressInput = document.getElementById("addressInput");
const educationBox = document.getElementById("educationUploadBox");
const addressBox = document.getElementById("addressUploadBox");

// Clicking a box opens its file picker
educationBox.addEventListener("click", function () {
  educationInput.click();
});
addressBox.addEventListener("click", function () {
  addressInput.click();
});

// When a file is picked with the file picker
educationInput.addEventListener("change", function () {
  if (educationInput.files[0]) {
    handleEducationFile(educationInput.files[0]);
  }
});
addressInput.addEventListener("change", function () {
  if (addressInput.files[0]) {
    handleAddressFile(addressInput.files[0]);
  }
});

// Drag and drop: "dragover" must be stopped, or the browser opens the file instead of dropping it
educationBox.addEventListener("dragover", function (event) {
  event.preventDefault();
});
educationBox.addEventListener("drop", function (event) {
  event.preventDefault();
  handleEducationFile(event.dataTransfer.files[0]);
});

addressBox.addEventListener("dragover", function (event) {
  event.preventDefault();
});
addressBox.addEventListener("drop", function (event) {
  event.preventDefault();
  handleAddressFile(event.dataTransfer.files[0]);
});

document.getElementById("step3Back").addEventListener("click", function () {
  showStep(2);
});

// Submit: both documents are required
document.getElementById("step3Submit").addEventListener("click", function () {
  let isValid = true;

  if (educationFile === null) {
    showError("educationError", "Please upload your education certificate.");
    isValid = false;
  }

  if (addressFile === null) {
    showError("addressError", "Please upload your proof of address.");
    isValid = false;
  }

  // NOTE: Sending the files to the server needs a backend. For now we just show the success screen.
  if (isValid) {
    showStep(4);
  }
});

// ==================================================
// LOG OUT (every page)
// ==================================================

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", function () {
    // Ask first, so nobody logs out by accident
    const confirmed = confirm("Are you sure you want to log out?");
    if (!confirmed) {
      return;
    }

    // Forget who was logged in (saved by the login page)
    localStorage.removeItem("userType");

    // Go to the sign-in page written in the button's data-login="..."
    // replace() also stops the Back button from returning to the dashboard
    window.location.replace(logoutButton.getAttribute("data-login"));
  });
}
