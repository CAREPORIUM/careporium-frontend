// ====== LOG IN PAGE ======

// ---------- Demo accounts ----------

// Two test accounts, one for each type of user.
// ⚠️ This is only for testing the design. Anyone can read this file in the browser,
// so real emails and passwords must NEVER be written here. A backend will check them later.
const professionalAccount = {
  email: "professional@careporium.com",
  password: "Nurse@123",
  // Where a healthcare professional goes after logging in
  page: "/HealthWorkerSection/healthWorkerCredentials.html",
};

const facilityAccount = {
  email: "facility@careporium.com",
  password: "Facility@123",
  // Where a facility goes after logging in
  page: "/FacilitySection/facilityRegistration.html",
};

// ---------- Helper functions ----------

// Show a red error message under an input and make its border red
function showError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorText = document.getElementById(inputId + "Error");

  errorText.textContent = message;
  errorText.classList.remove("hidden");

  input.classList.remove("border-blue-400");
  input.classList.add("border-red-500");
}

// Hide the error message and make the border blue again
function clearError(inputId) {
  const input = document.getElementById(inputId);
  const errorText = document.getElementById(inputId + "Error");

  errorText.textContent = "";
  errorText.classList.add("hidden");

  input.classList.remove("border-red-500");
  input.classList.add("border-blue-400");
}

// ---------- Show / hide password ----------

const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", function () {
  const passwordInput = document.getElementById("password");

  // If the password is hidden, show it. Otherwise, hide it.
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
  } else {
    passwordInput.type = "password";
  }

  // Swap the eye icons
  document.getElementById("passwordEyeOff").classList.toggle("hidden");
  document.getElementById("passwordEyeOn").classList.toggle("hidden");
});

// ---------- Form validation ----------

const form = document.getElementById("loginForm");

form.addEventListener("submit", function (event) {
  // Stop the page from reloading when the form is sent
  event.preventDefault();

  // This stays true unless we find a mistake
  let isValid = true;

  // Get what the user typed. trim() removes extra spaces at the start and end.
  // toLowerCase() makes "Facility@Careporium.com" the same as "facility@careporium.com".
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  // 1. EMAIL (placeholder "you@gmail.com")
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

  // 2. PASSWORD (just make sure it's not empty)
  if (password === "") {
    showError("password", "Please enter your password.");
    isValid = false;
  } else {
    clearError("password");
  }

  // Stop here if something is missing
  if (!isValid) {
    return;
  }

  // 3. CHECK THE EMAIL AND PASSWORD AGAINST THE DEMO ACCOUNTS
  // if (email === professionalAccount.email && password === professionalAccount.password) {
  // Healthcare professional
  // window.location.href = professionalAccount.page;
  // } else if (email === facilityAccount.email && password === facilityAccount.password) {
  // Facility
  //   window.location.href = facilityAccount.page;
  // } else {
  // The details don't match any account
  //   window.location.href = "/AuthenticationSection/invalidCredentials.html";
  // }

  // 3. CHECK THE EMAIL AND PASSWORD AGAINST THE DEMO ACCOUNTS

  // First, find which account the email belongs to (if any)
  let account = null;

  if (email === professionalAccount.email) {
    account = professionalAccount;
  } else if (email === facilityAccount.email) {
    account = facilityAccount;
  }

  // No account has this email
  if (account === null) {
    showError("email", "No account found with this email.");
    return;
  }

  // The email is right, but the password doesn't match that account
  if (password !== account.password) {
    showError("password", "Incorrect password. Please try again.");
    return;
  }

  // Both are correct: go to that account's page
  window.location.href = account.page;
});
