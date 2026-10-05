// ====== FACILITY REGISTRATION PAGE ======

// ---------- Helper functions ----------

// Show a red error message under a field and make its border red.
// The documents in step 3 have no box to color, so "if (field)" skips the border for them.
function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorText = document.getElementById(fieldId + "Error");

  errorText.textContent = message;
  errorText.classList.remove("hidden");
  if (field) {
    field.classList.remove("border-gray-200");
    field.classList.add("border-red-500");
  }
}

// Hide the error message and make the border gray again
function clearError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorText = document.getElementById(fieldId + "Error");

  errorText.classList.add("hidden");
  if (field) {
    field.classList.remove("border-red-500");
    field.classList.add("border-gray-200");
  }
}

// Get what the user typed in a field (trim() removes extra spaces at the start and end)
function getValue(fieldId) {
  return document.getElementById(fieldId).value.trim();
}

// ---------- Moving between steps ----------

// Show one step (1 to 4) and update the sidebar
function showStep(stepNumber) {
  // Hide all 4 steps, then show the one we want
  for (let i = 1; i <= 4; i++) {
    document.getElementById("step" + i).classList.add("hidden");
  }
  document.getElementById("step" + stepNumber).classList.remove("hidden");

  // Sidebar: done = blue check, current = light blue row, not yet = gray circle
  for (let i = 1; i <= 4; i++) {
    const row = document.getElementById("nav" + i);
    const circle = document.getElementById("navCircle" + i);

    if (i === stepNumber) {
      row.classList.add("bg-blue-50");
    } else {
      row.classList.remove("bg-blue-50");
    }

    if (i <= stepNumber) {
      circle.className = "w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center";
    } else {
      circle.className = "w-5 h-5 rounded-full border border-gray-300 text-gray-700 text-xs flex items-center justify-center";
    }

    if (i < stepNumber) {
      circle.textContent = "✓";
    } else {
      circle.textContent = i;
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
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

// ---------- Step 1: Basic information ----------

function checkStep1() {
  let isValid = true;

  const name = getValue("facilityName");
  const type = getValue("facilityType");
  const email = getValue("facilityEmail");
  // Remove spaces and dashes, so "+234 812 345 6789" becomes "+2348123456789"
  const phone = getValue("facilityPhone").replace(/[\s-]/g, "");

  // Facility name: at least 3 characters
  if (name.length < 3) {
    showError("facilityName", "Please enter the facility name.");
    isValid = false;
  } else {
    clearError("facilityName");
  }

  // Facility type: an option must be picked (the first option has an empty value)
  if (type === "") {
    showError("facilityType", "Please select a facility type.");
    isValid = false;
  } else {
    clearError("facilityType");
  }

  // Email: must look like something@something.something
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("facilityEmail", "Please enter a valid email address.");
    isValid = false;
  } else {
    clearError("facilityEmail");
  }

  // Phone: Nigerian number, like +234 812 345 6789 or 0812 345 6789
  if (!/^\+234[0-9]{10}$/.test(phone) && !/^0[0-9]{10}$/.test(phone)) {
    showError("facilityPhone", "Enter a valid number, like +234 812 345 6789.");
    isValid = false;
  } else {
    clearError("facilityPhone");
  }

  return isValid;
}

// ---------- Step 2: Location & address ----------

function checkStep2() {
  let isValid = true;

  // Street address: at least 5 characters
  if (getValue("street").length < 5) {
    showError("street", "Please enter the facility's street address.");
    isValid = false;
  } else {
    clearError("street");
  }

  // City, state and country: required, letters and spaces only.
  // We check all three the same way, using a loop.
  const places = ["city", "state", "country"];

  places.forEach(function (fieldId) {
    const value = getValue(fieldId);

    if (value === "") {
      showError(fieldId, "This field is required.");
      isValid = false;
    } else if (!/^[A-Za-z\s-]+$/.test(value)) {
      showError(fieldId, "Please use letters only.");
      isValid = false;
    } else {
      clearError(fieldId);
    }
  });

  return isValid;
}

// ---------- Step 3: Facility documents ----------

// The 3 documents. Each one uses the ids: nameInput, nameButton, nameFileText, nameError
const documents = ["registrationDoc", "licenseDoc", "tinDoc"];

// The picked files. null means "nothing picked yet".
let files = { registrationDoc: null, licenseDoc: null, tinDoc: null };

documents.forEach(function (name) {
  const input = document.getElementById(name + "Input");

  // "Choose file" opens the hidden file picker
  document.getElementById(name + "Button").addEventListener("click", function () {
    input.click();
  });

  // When a file is picked, check its type and size
  input.addEventListener("change", function () {
    const file = input.files[0];
    if (!file) {
      return; // the user closed the picker without choosing
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      showError(name, "Only PDF, JPG, JPEG or PNG files are allowed.");
      input.value = "";
    } else if (file.size > 5 * 1024 * 1024) {
      // 5 MB written in bytes (1 MB = 1024 × 1024 bytes)
      showError(name, "This file is too big. The maximum size is 5 MB.");
      input.value = "";
    } else {
      // The file is fine: save it and show its name
      clearError(name);
      files[name] = file;
      document.getElementById(name + "FileText").textContent = "✓ " + file.name;
    }
  });
});

function checkStep3() {
  let isValid = true;

  documents.forEach(function (name) {
    if (files[name] === null) {
      showError(name, "Please upload this document.");
      isValid = false;
    }
  });

  return isValid;
}

// ---------- Step 4: Review & submit ----------

// Copy what the user entered into the review cards
function fillReview() {
  document.getElementById("reviewNameType").textContent = getValue("facilityName") + " · " + getValue("facilityType");
  document.getElementById("reviewEmail").textContent = getValue("facilityEmail");
  document.getElementById("reviewPhone").textContent = getValue("facilityPhone");
  document.getElementById("reviewStreet").textContent = getValue("street");
  document.getElementById("reviewCityLine").textContent =
    getValue("city") + " · " + getValue("state") + " · " + getValue("country");
}

// The "Edit" buttons go back to the step written in their data-step="..." attribute
document.querySelectorAll(".edit-button").forEach(function (button) {
  button.addEventListener("click", function () {
    showStep(Number(button.getAttribute("data-step")));
  });
});

// ---------- Buttons ----------

document.getElementById("step1Next").addEventListener("click", function () {
  if (checkStep1()) {
    showStep(2);
  }
});

document.getElementById("step2Back").addEventListener("click", function () {
  showStep(1);
});
document.getElementById("step2Next").addEventListener("click", function () {
  if (checkStep2()) {
    showStep(3);
  }
});

document.getElementById("step3Back").addEventListener("click", function () {
  showStep(2);
});
document.getElementById("step3Next").addEventListener("click", function () {
  if (checkStep3()) {
    fillReview();
    showStep(4);
  }
});

document.getElementById("step4Back").addEventListener("click", function () {
  showStep(3);
});

// Submit: the terms checkbox must be ticked
document.getElementById("submitButton").addEventListener("click", function () {
  const termsError = document.getElementById("termsError");

  if (!document.getElementById("terms").checked) {
    termsError.textContent = "Please agree to the Terms & Conditions and Privacy Policy.";
    termsError.classList.remove("hidden");
    return;
  }

  // NOTE: Sending the details and files to a server needs a backend.
  // For now we go straight to the "Registration Success" page.
  window.location.href = "/AuthenticationSection/registrationSuccess.html";
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