// ====== HEALTH FACILITY SIGN-UP PAGE ======
// Needs /js/api.js to be loaded first.

// Where to go after the account is created
const successPage = "/AuthenticationSection/accountCreateSuccess.html";

// ---------- Helper functions ----------

// Show a red error message under an input and make its border red
function showError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorText = document.getElementById(inputId + "Error");

  errorText.textContent = message;
  errorText.classList.remove("hidden");

  input.classList.remove("border-gray-200");
  input.classList.add("border-red-500");
}

// Hide the error message and make the border gray again
function clearError(inputId) {
  const input = document.getElementById(inputId);
  const errorText = document.getElementById(inputId + "Error");

  errorText.textContent = "";
  errorText.classList.add("hidden");

  input.classList.remove("border-red-500");
  input.classList.add("border-gray-200");
}

// ---------- Show / hide password ----------

// Make an eye button work for one password field.
// It uses the ids: inputId + "Toggle", inputId + "EyeOff" and inputId + "EyeOn"
function setupEyeButton(inputId) {
  const input = document.getElementById(inputId);

  document.getElementById(inputId + "Toggle").addEventListener("click", function () {
    // If the password is hidden, show it. Otherwise, hide it.
    if (input.type === "password") {
      input.type = "text";
    } else {
      input.type = "password";
    }

    // Swap the two eye icons
    document.getElementById(inputId + "EyeOff").classList.toggle("hidden");
    document.getElementById(inputId + "EyeOn").classList.toggle("hidden");
  });
}

setupEyeButton("password");
setupEyeButton("confirmPassword");

// ---------- Creating the account ----------

// REAL: the backend creates a facility account together with its address and 3 documents.
// So we keep these details in the browser (only in this tab, cleared after sign-up)
// and continue to the registration page, which collects the rest and creates the account.
async function createAccount(details, button) {
  setLoading(button, true, "Continuing…");

  try {
    details.facilityTypeLabel = Backend.facilityTypeLabel(details.facilityType);
    sessionStorage.setItem("pendingFacility", JSON.stringify(details));
    window.location.href = "/FacilitySection/facilityRegistration.html";
  } catch (error) {
    showGeneralError(error.message);
    setLoading(button, false);
  }
}

// ---------- Form validation ----------

const form = document.getElementById("facilityForm");

form.addEventListener("submit", function (event) {
  // Stop the page from reloading when the form is sent
  event.preventDefault();

  // This stays true unless we find a mistake
  let isValid = true;

  // Get what the user typed or picked. trim() removes extra spaces at the start and end.
  const facilityName = document.getElementById("facilityName").value.trim();
  const facilityType = document.getElementById("facilityType").value;
  const taxId = document.getElementById("taxId").value.trim();
  const businessEmail = document.getElementById("businessEmail").value.trim().toLowerCase();
  const phone = document.getElementById("phone").value.trim();
  const secondaryPhone = document.getElementById("secondaryPhone").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const termsChecked = document.getElementById("terms").checked;

  // 1. FACILITY LEGAL NAME (placeholder "Northside Regional Medical Center")
  if (facilityName === "") {
    showError("facilityName", "Please enter the facility's legal name.");
    isValid = false;
  } else if (facilityName.length < 3) {
    showError("facilityName", "The facility name is too short.");
    isValid = false;
  } else {
    clearError("facilityName");
  }

  // 2. FACILITY TYPE (the first option has an empty value)
  if (facilityType === "") {
    showError("facilityType", "Please choose a facility type.");
    isValid = false;
  } else {
    clearError("facilityType");
  }

  // 3. TAX ID EIN (placeholder "XX-XXXXXXX": 2 numbers, a dash, then 7 numbers)
  const einPattern = /^[0-9]{2}-[0-9]{7}$/;

  if (taxId === "") {
    showError("taxId", "Please enter your Tax ID (EIN).");
    isValid = false;
  } else if (!einPattern.test(taxId)) {
    showError("taxId", "EIN must look like 12-3456789.");
    isValid = false;
  } else {
    clearError("taxId");
  }

  // 4. BUSINESS EMAIL (placeholder "admin@facility.com")
  // This pattern checks for: something @ something . something
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (businessEmail === "") {
    showError("businessEmail", "Please enter your business email.");
    isValid = false;
  } else if (!emailPattern.test(businessEmail)) {
    showError("businessEmail", "Please enter a valid email, like admin@facility.com.");
    isValid = false;
  } else {
    clearError("businessEmail");
  }

  // 5. PHONE NUMBER (placeholder "0812 345 6789": 11 numbers)
  // Remove everything that is not a number, e.g. "0812 345 6789" becomes "08123456789"
  const phoneNumbers = phone.replace(/[^0-9]/g, "");

  if (phone === "") {
    showError("phone", "Please enter a phone number.");
    isValid = false;
  } else if (phoneNumbers.length !== 11) {
    showError("phone", "Phone number must have 11 digits, like 0812 345 6789.");
    isValid = false;
  } else {
    clearError("phone");
  }

  // 6. SECONDARY PHONE NUMBER (optional, so we only check it if something was typed)
  const secondaryNumbers = secondaryPhone.replace(/[^0-9]/g, "");

  if (secondaryPhone === "") {
    clearError("secondaryPhone"); // empty is fine
  } else if (secondaryNumbers.length !== 11) {
    showError("secondaryPhone", "Phone number must have 11 digits, like 0812 345 6789.");
    isValid = false;
  } else if (secondaryNumbers === phoneNumbers) {
    showError("secondaryPhone", "Please use a different number from the main phone number.");
    isValid = false;
  } else {
    clearError("secondaryPhone");
  }

  // 7. PASSWORD (at least 8 characters, uppercase and lowercase letters, and a number or symbol)
  if (password === "") {
    showError("password", "Please enter a password.");
    isValid = false;
  } else if (password.length < 8) {
    showError("password", "Password must be at least 8 characters.");
    isValid = false;
  } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    // /[A-Z]/ looks for a capital letter, /[a-z]/ looks for a small letter
    showError("password", "Password must include uppercase and lowercase letters.");
    isValid = false;
  } else if (!/[^A-Za-z]/.test(password)) {
    // [^A-Za-z] means "anything that is NOT a letter", so a number or a symbol
    showError("password", "Password must include a number or special character.");
    isValid = false;
  } else {
    clearError("password");
  }

  // 8. CONFIRM PASSWORD (must match the password)
  if (confirmPassword === "") {
    showError("confirmPassword", "Please confirm your password.");
    isValid = false;
  } else if (confirmPassword !== password) {
    showError("confirmPassword", "Passwords do not match.");
    isValid = false;
  } else {
    clearError("confirmPassword");
  }

  // 9. TERMS CHECKBOX (must be ticked)
  // A checkbox has no border to color, so we only show or hide the message
  const termsError = document.getElementById("termsError");

  if (!termsChecked) {
    termsError.textContent = "Please agree to the terms & conditions.";
    termsError.classList.remove("hidden");
    isValid = false;
  } else {
    termsError.textContent = "";
    termsError.classList.add("hidden");
  }

  if (!isValid) {
    return;
  }

  // Everything is correct
  if (USE_DEMO_MODE) {
    // DEMO: go straight to the "Account Created" page
    window.location.href = successPage;
  } else {
    // REAL: send the details to the server (the password is sent once, never stored here)
    createAccount(
      {
        facilityName: facilityName,
        facilityType: facilityType,
        taxId: taxId,
        businessEmail: businessEmail,
        phone: phoneNumbers,
        secondaryPhone: secondaryNumbers,
        password: password,
      },
      form.querySelector('button[type="submit"]'),
    );
  }
});
