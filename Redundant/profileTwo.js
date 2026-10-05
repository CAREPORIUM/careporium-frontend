// ====== PROFESSIONAL PROFILE - STEP 2 ======

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

// ---------- Form validation ----------

const form = document.getElementById("stepTwoForm");

form.addEventListener("submit", function (event) {
  // Stop the page from reloading when the form is sent
  event.preventDefault();

  // This stays true unless we find a mistake
  let isValid = true;

  // Get what the user typed or picked
  const experience = document.getElementById("experience").value.trim();
  const specialty = document.getElementById("specialty").value;
  const certification = document.getElementById("certification").value;
  const location = document.getElementById("location").value;
  const availability = document.getElementById("availability").value.trim();
  const termsChecked = document.getElementById("terms").checked;

  // 1. YEARS OF EXPERIENCE (placeholder "2 years": a whole number)
  // Number() turns the text "2" into the number 2
  const years = Number(experience);

  if (experience === "") {
    showError("experience", "Please enter your years of experience.");
    isValid = false;
  } else if (!Number.isInteger(years) || years < 0 || years > 60) {
    // Must be a whole number (no decimals) between 0 and 60
    showError("experience", "Please enter a whole number between 0 and 60.");
    isValid = false;
  } else {
    clearError("experience");
  }

  // 2. SPECIALTY (the first option has an empty value)
  if (specialty === "") {
    showError("specialty", "Please choose your specialty.");
    isValid = false;
  } else {
    clearError("specialty");
  }

  // 3. CERTIFICATIONS
  if (certification === "") {
    showError("certification", "Please choose a certification.");
    isValid = false;
  } else {
    clearError("certification");
  }

  // 4. LOCATION
  if (location === "") {
    showError("location", "Please choose a location.");
    isValid = false;
  } else {
    clearError("location");
  }

  // 5. AVAILABILITY (placeholder "e.g., evening shifts": a short description)
  if (availability === "") {
    showError("availability", "Please tell us when you're available.");
    isValid = false;
  } else if (availability.length < 3) {
    showError(
      "availability",
      "Please add a bit more detail, like evening shifts.",
    );
    isValid = false;
  } else {
    clearError("availability");
  }

  // 6. TERMS CHECKBOX (must be ticked)
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

  // If everything is correct, go to the success page
  if (isValid) {
    window.location.href = "/AuthenticationSection/AccountCreateSuccess.html";
  }
});
