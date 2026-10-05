// ====== PROFESSIONAL PROFILE - STEP 1 ======

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

const form = document.getElementById("stepOneForm");

form.addEventListener("submit", function (event) {
  // Stop the page from reloading when the form is sent
  event.preventDefault();

  // This stays true unless we find a mistake
  let isValid = true;

  // Get what the user typed. trim() removes extra spaces at the start and end.
  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const role = document.getElementById("role").value;
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
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (email === "") {
    showError("email", "Please enter your email address.");
    isValid = false;
  } else if (!emailPattern.test(email)) {
    showError("email", "Please enter a valid email, like you@gmail.com.");
    isValid = false;
  } else {
    clearError("email");
  }

  // 3. PROFESSIONAL ROLE (the first option has an empty value)
  if (role === "") {
    showError("role", "Please choose your professional role.");
    isValid = false;
  } else {
    clearError("role");
  }

  // 4. PASSWORD (at least 8 characters, with a letter and a number)
  if (password === "") {
    showError("password", "Please enter a password.");
    isValid = false;
  } else if (password.length < 8) {
    showError("password", "Password must be at least 8 characters.");
    isValid = false;
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    showError(
      "password",
      "Password must include at least one letter and one number.",
    );
    isValid = false;
  } else {
    clearError("password");
  }

  // 5. CONFIRM PASSWORD (must match the password)
  if (confirmPassword === "") {
    showError("confirmPassword", "Please confirm your password.");
    isValid = false;
  } else if (confirmPassword !== password) {
    showError("confirmPassword", "Passwords do not match.");
    isValid = false;
  } else {
    clearError("confirmPassword");
  }

  // If everything is correct, go to step 2
  if (isValid) {
    window.location.href = "profileTwo.html";
  }
});
