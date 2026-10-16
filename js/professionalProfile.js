// ====== PROFESSIONAL PROFILE (3 STEPS) ======
// Needs /js/api.js to be loaded first.

// Where to go after the account is created
const successPage = "../AuthenticationSection/accountCreateSuccess.html";

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

// Get what the user typed in a field (trim() removes extra spaces at the start and end).
// If a box is missing from the page (e.g. commented out in the HTML), don't crash:
// say which one in the Console (F12) and carry on with an empty value.
function getValue(inputId) {
  const field = document.getElementById(inputId);
  if (field === null) {
    console.warn(
      'professionalProfile.js: there is no box with id="' +
        inputId +
        '" on this page.',
    );
    return "";
  }
  return field.value.trim();
}

// Show one step (1, 2 or 3) and hide the others
function showStep(stepNumber) {
  for (let i = 1; i <= 3; i++) {
    document.getElementById("step" + i).classList.add("hidden");
  }
  document.getElementById("step" + stepNumber).classList.remove("hidden");

  // Go back to the top of the page
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Show / hide password ----------

// Make an eye button work for one password field.
// It uses the ids: inputId + "Toggle", inputId + "EyeOff" and inputId + "EyeOn"
function setupEyeButton(inputId) {
  const input = document.getElementById(inputId);

  document
    .getElementById(inputId + "Toggle")
    .addEventListener("click", function () {
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

// ---------- Back arrows (top left of each step) ----------

// Step 1 is the first step, so its arrow leaves the page and goes to the previous one
document.getElementById("stepOneArrow").addEventListener("click", function () {
  history.back();
});

// Step 2's arrow goes back to step 1
document.getElementById("stepTwoArrow").addEventListener("click", function () {
  showStep(1);
});

// Step 3's arrow goes back to step 2
document
  .getElementById("stepThreeArrow")
  .addEventListener("click", function () {
    showStep(2);
  });

// ==================================================
// STEP 1: PROFILE
// ==================================================

// REAL: ask the server if the email is free, so the user finds out now,
// not after filling in all 3 steps. The server answers { available: true } or { available: false }.
async function isEmailAvailable(email) {
  // Not on the server yet (see SERVER_HAS.emailCheck in api.js): the register call checks instead
  if (usesDemo("emailCheck")) {
    return true;
  }

  try {
    const data = await apiRequest(
      ENDPOINTS.emailAvailable + "?email=" + encodeURIComponent(email),
    );
    return data.available;
  } catch (error) {
    // If the check itself fails, let the user continue. The server checks again at the end.
    return true;
  }
}

const stepOneForm = document.getElementById("stepOneForm");

stepOneForm.addEventListener("submit", async function (event) {
  // Stop the page from reloading when the form is sent
  event.preventDefault();

  // This stays true unless we find a mistake
  let isValid = true;

  const fullName = getValue("fullName");
  const email = getValue("email").toLowerCase();
  const phone = getValue("phone");
  // const secondaryPhone = getValue("secondaryPhone");
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // 1. FULL NAME (placeholder "Luke Marcus": first and last name)
  if (fullName === "") {
    showError("fullName", "Please enter your full name.");
    isValid = false;
  } else if (!/^[A-Za-z ]+$/.test(fullName)) {
    // Only letters and spaces are allowed
    showError("fullName", "Your name can only contain letters.");
    isValid = false;
  } else if (!fullName.includes(" ")) {
    // A space means there are at least two words (first + last name)
    showError("fullName", "Please enter your first and last name.");
    isValid = false;
  } else {
    clearError("fullName");
  }

  // 2. EMAIL (placeholder "you@gmail.com")
  // This pattern checks for: something @ something . something
  if (email === "") {
    showError("email", "Please enter your email address.");
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("email", "Please enter a valid email, like you@gmail.com.");
    isValid = false;
  } else {
    clearError("email");
  }

  // 3. PHONE NUMBER (placeholder "0812 345 6789": 11 numbers)
  // Remove everything that is not a number, e.g. "0812 345 6789" becomes "08123456789"
  const phoneNumbers = phone.replace(/[^0-9]/g, "");

  if (phone === "") {
    showError("phone", "Please enter your phone number.");
    isValid = false;
  } else if (phoneNumbers.length !== 11) {
    showError("phone", "Phone number must have 11 digits, like 0812 345 6789.");
    isValid = false;
  } else {
    clearError("phone");
  }

  // 4. SECONDARY PHONE NUMBER (optional, so we only check it if something was typed)
  // const secondaryNumbers = secondaryPhone.replace(/[^0-9]/g, "");

  // if (secondaryPhone === "") {
  //   clearError("secondaryPhone"); // empty is fine
  // } else if (secondaryNumbers.length !== 11) {
  //   showError("secondaryPhone", "Phone number must have 11 digits, like 0812 345 6789.");
  //   isValid = false;
  // } else if (secondaryNumbers === phoneNumbers) {
  //   showError("secondaryPhone", "Please use a different number from your main phone number.");
  //   isValid = false;
  // } else {
  //   clearError("secondaryPhone");
  // }

  // 5. PASSWORD (at least 8 characters, uppercase and lowercase letters, and a number or symbol)
  if (password === "") {
    showError("password", "Please enter a password.");
    isValid = false;
  } else if (password.length < 8) {
    showError("password", "Password must be at least 8 characters.");
    isValid = false;
  } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    // /[A-Z]/ looks for a capital letter, /[a-z]/ looks for a small letter
    showError(
      "password",
      "Password must include uppercase and lowercase letters.",
    );
    isValid = false;
  } else if (!/[^A-Za-z]/.test(password)) {
    // [^A-Za-z] means "anything that is NOT a letter", so a number or a symbol
    showError(
      "password",
      "Password must include a number or special character.",
    );
    isValid = false;
  } else {
    clearError("password");
  }

  // 6. CONFIRM PASSWORD (must match the password)
  if (confirmPassword === "") {
    showError("confirmPassword", "Please confirm your password.");
    isValid = false;
  } else if (confirmPassword !== password) {
    showError("confirmPassword", "Passwords do not match.");
    isValid = false;
  } else {
    clearError("confirmPassword");
  }

  if (!isValid) {
    return;
  }

  // 7. EMAIL NOT ALREADY USED (asks the server, only with the real backend)
  const continueButton = stepOneForm.querySelector('button[type="submit"]');
  setLoading(continueButton, true, "Checking…");
  const available = await isEmailAvailable(email);
  setLoading(continueButton, false);

  if (!available) {
    showError(
      "email",
      "An account with this email already exists. Try logging in instead.",
    );
    return;
  }

  // Everything is correct: go to step 2
  showStep(2);
});

// ==================================================
// STEP 2: PROFESSIONAL EXPERIENCE
// ==================================================

document.getElementById("stepTwoBack").addEventListener("click", function () {
  showStep(1);
});

document
  .getElementById("stepTwoForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    let isValid = true;

    // 1. ROLE, SPECIALTY AND CERTIFICATION (dropdowns: the first option has an empty value)

    // 1. ROLE AND SPECIALTY (dropdowns: the first option has an empty value)
    // (Certification is left out while its box is commented out in the HTML)
    const dropdowns = [
      { id: "role", message: "Please choose your professional role." },
      { id: "specialty", message: "Please choose your specialty." },
    ];

    dropdowns.forEach(function (dropdown) {
      if (getValue(dropdown.id) === "") {
        showError(dropdown.id, dropdown.message);
        isValid = false;
      } else {
        clearError(dropdown.id);
      }
    });
    // We check all three the same way, using a loop.
    // const dropdowns = [
    //   { id: "role", message: "Please choose your professional role." },
    //   { id: "specialty", message: "Please choose your specialty." },
    //   { id: "certification", message: "Please choose a certification." },
    // ];

    // dropdowns.forEach(function (dropdown) {
    //   if (getValue(dropdown.id) === "") {
    //     showError(dropdown.id, dropdown.message);
    //     isValid = false;
    //   } else {
    //     clearError(dropdown.id);
    //   }
    // });

    // 2. YEARS OF EXPERIENCE (placeholder "2 years": a whole number from 0 to 60)
    const experience = getValue("experience");
    // Number() turns the text "2" into the number 2
    const years = Number(experience);

    if (experience === "") {
      showError("experience", "Please enter your years of experience.");
      isValid = false;
    } else if (!Number.isInteger(years) || years < 0 || years > 60) {
      showError("experience", "Please enter a whole number between 0 and 60.");
      isValid = false;
    } else {
      clearError("experience");
    }

    // If everything is correct, go to step 3
    if (isValid) {
      showStep(3);
    }
  });

// ==================================================
// STEP 3: LOCATION / AREA (and create the account)
// ==================================================

document.getElementById("stepThreeBack").addEventListener("click", function () {
  showStep(2);
});

// Get a field's value, or "" if the field isn't on the page
// (e.g. Certifications and the secondary phone are commented out in the HTML for now)
function getOptionalValue(inputId) {
  const field = document.getElementById(inputId);
  if (field === null) {
    return "";
  }
  return field.value.trim();
}

// Collect the details from all 3 steps into one object, ready to send to the server
function getAllDetails() {
  return {
    fullName: getValue("fullName"),
    email: getValue("email").toLowerCase(),
    phone: getValue("phone").replace(/[^0-9]/g, ""),
    // The secondary phone box is commented out in the HTML for now, so it may not be there
    secondaryPhone: getOptionalValue("secondaryPhone").replace(/[^0-9]/g, ""),
    password: document.getElementById("password").value,
    role: getOptionalValue("role"),
    specialty: getOptionalValue("specialty"),
    experience: Number(getValue("experience")),
    certification: getOptionalValue("certification"),
    address: getValue("address"),
    city: getValue("city"),
    state: getValue("state"),
    country: getValue("country"),
  };
}

const stepThreeForm = document.getElementById("stepThreeForm");

stepThreeForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  let isValid = true;

  // 1. ADDRESS (at least 5 characters)
  if (getValue("address").length < 5) {
    showError("address", "Please enter your street address.");
    isValid = false;
  } else {
    clearError("address");
  }

  // 2. CITY, STATE AND COUNTRY (required, letters only). Checked the same way with a loop.
  const places = ["city", "state", "country"];

  places.forEach(function (inputId) {
    const value = getValue(inputId);

    if (value === "") {
      showError(inputId, "This field is required.");
      isValid = false;
    } else if (!/^[A-Za-z\s-]+$/.test(value)) {
      showError(inputId, "Please use letters only.");
      isValid = false;
    } else {
      clearError(inputId);
    }
  });

  // 3. TERMS CHECKBOX (must be ticked)
  // A checkbox has no border to color, so we only show or hide the message
  const termsError = document.getElementById("termsError");

  if (!document.getElementById("terms").checked) {
    termsError.textContent = "Please agree to the terms & conditions.";
    termsError.classList.remove("hidden");
    isValid = false;
  } else {
    termsError.classList.add("hidden");
  }

  if (!isValid) {
    return;
  }

  // DEMO: go straight to the success page
  if (USE_DEMO_MODE) {
    window.location.href = successPage;
    return;
  }

  // REAL: create the account with the details from all 3 steps
  const createButton = stepThreeForm.querySelector('button[type="submit"]');
  setLoading(createButton, true, "Creating account…");

  try {
    const details = getAllDetails();
    await Backend.registerWorker(details);
    // The backend emails a 6-digit code to confirm the email address: go and enter it
    sessionStorage.setItem("verifyEmail", details.email);
    window.location.href = "../AuthenticationSection/verifyAccount.html";
  } catch (error) {
    termsError.textContent = "Couldn't create your account: " + error.message;
    termsError.classList.remove("hidden");
    setLoading(createButton, false);
  }
});
