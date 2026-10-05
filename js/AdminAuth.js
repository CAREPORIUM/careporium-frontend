// ====== ADMIN SIGN-IN (login page + security code page) ======

// ⚠️ Demo details for testing the design only. Anyone can read this file in the browser,
// so real admin passwords and codes must NEVER be written here. A backend will check them later.
const adminAccount = {
  email: "admin@careporium.com",
  password: "Admin@123",
};
const demoCode = "123456";

// How many wrong codes are allowed before sign-in is blocked
const maxAttempts = 3;

// ---------- Helper functions ----------

// Show a red error message under an input and make its border red
function showError(inputId, message) {
  const errorText = document.getElementById(inputId + "Error");
  errorText.textContent = message;
  errorText.classList.remove("hidden");
  document.getElementById(inputId).classList.add("border-red-500");
}

// Hide the error message and remove the red border
function clearError(inputId) {
  document.getElementById(inputId + "Error").classList.add("hidden");
  document.getElementById(inputId).classList.remove("border-red-500");
}


// ==================================================
// 1. LOGIN PAGE
// ==================================================

const adminLoginForm = document.getElementById("adminLoginForm");

if (adminLoginForm) {

// ---------- Show / hide password ----------

document
  .getElementById("togglePassword")
  .addEventListener("click", function () {
    const passwordInput = document.getElementById("adminPassword");

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


  adminLoginForm.addEventListener("submit", function (event) {
    // Stop the page from reloading
    event.preventDefault();

    const email = document
      .getElementById("adminEmail")
      .value.trim()
      .toLowerCase();
    const password = document.getElementById("adminPassword").value;
    let isValid = true;

    // EMAIL: must be a work email ending in @careporium.com
    if (email === "") {
      showError("adminEmail", "Please enter your work email.");
      isValid = false;
    } else if (!email.endsWith("@careporium.com")) {
      showError("adminEmail", "Use your @careporium.com work email.");
      isValid = false;
    } else {
      clearError("adminEmail");
    }

    // PASSWORD: must not be empty
    if (password === "") {
      showError("adminPassword", "Please enter your password.");
      isValid = false;
    } else {
      clearError("adminPassword");
    }

    if (!isValid) {
      return;
    }

    // Check the details against the demo admin account.
    // One general message, so strangers can't tell which part was wrong.
    if (email !== adminAccount.email || password !== adminAccount.password) {
      showError("adminPassword", "Incorrect email or password.");
      return;
    }

    // Correct: go to the security code page
    window.location.href = "/Admin/AdminVerify.html";
  });
}

// ==================================================
// 2. SECURITY CODE PAGE
// ==================================================

const codeForm = document.getElementById("codeForm");

if (codeForm) {
  const codeInput = document.getElementById("securityCode");
  const verifyButton = document.getElementById("verifyButton");

  // Count the wrong codes
  let failedAttempts = 0;

  // Only allow numbers to be typed (letters are removed straight away)
  codeInput.addEventListener("input", function () {
    codeInput.value = codeInput.value.replace(/[^0-9]/g, "");
  });

  codeForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const code = codeInput.value;

    // The code must have exactly 6 numbers
    if (code.length !== 6) {
      showError("securityCode", "Please enter the 6-digit code.");
      return;
    }

    // Right code: sign in
    if (code === demoCode) {
      window.location.href = "/Admin/AdminOverview.html";
      return;
    }

    // Wrong code: count it
    failedAttempts = failedAttempts + 1;
    const attemptsLeft = maxAttempts - failedAttempts;

    if (attemptsLeft > 0) {
      showError(
        "securityCode",
        "Incorrect code. " + attemptsLeft + " attempt(s) left.",
      );
    } else {
      // Too many wrong codes: turn the button off
      showError(
        "securityCode",
        "Too many failed attempts. Sign-in is temporarily blocked.",
      );
      verifyButton.disabled = true;
      verifyButton.classList.add("opacity-50", "cursor-not-allowed");
    }
  });

  // Resend code: show a message.
  // NOTE: Really sending a new code needs a backend.
  document.getElementById("resendCode").addEventListener("click", function () {
    document.getElementById("resendMessage").classList.remove("hidden");
  });
}

// ==================================================
// 3. ACCEPT INVITATION (set up a new admin account)
// ==================================================

const setupForm = document.getElementById("setupForm");

if (setupForm) {
  // ---------- Read the invitation from the link ----------

  // The invitation link looks like: acceptInvite.html?email=ngozi.a@careporium.com&role=Verification%20reviewer
  // URLSearchParams reads the parts after the "?".
  const params = new URLSearchParams(window.location.search);
  const inviteEmail = params.get("email");
  const inviteRole = params.get("role");

  // No email, or not a @careporium.com email: the link isn't valid.
  // NOTE: Only a backend can really check if a link has expired or was already used.
  if (inviteEmail === null || !inviteEmail.endsWith("@careporium.com")) {
    window.location.href = "inviteExpired.html";
  } else {
    // Show the invitation details on the page
    document.getElementById("inviteEmailText").textContent = inviteEmail;
    document.getElementById("inviteRoleText").textContent =
      inviteRole || "Admin";
  }

  // ---------- Show / hide password ----------

  // Make an eye button work for one password field (same as the other password pages)
  function setupEyeButton(inputId) {
    const input = document.getElementById(inputId);

    document
      .getElementById(inputId + "Toggle")
      .addEventListener("click", function () {
        if (input.type === "password") {
          input.type = "text";
        } else {
          input.type = "password";
        }
        document.getElementById(inputId + "EyeOff").classList.toggle("hidden");
        document.getElementById(inputId + "EyeOn").classList.toggle("hidden");
      });
  }

  setupEyeButton("newPassword");
  setupEyeButton("confirmPassword");

  // ---------- Password rules (same rules as the other password pages) ----------

  function hasEightCharacters(password) {
    return password.length >= 8;
  }

  function hasUpperAndLower(password) {
    return /[A-Z]/.test(password) && /[a-z]/.test(password);
  }

  function hasNumberOrSpecial(password) {
    // [^A-Za-z] means "anything that is NOT a letter", so a number or a symbol
    return /[^A-Za-z]/.test(password);
  }

  // Turn a rule green if it's met, or gray if it's not
  function colorRule(ruleId, isMet) {
    const rule = document.getElementById(ruleId);
    if (isMet) {
      rule.classList.remove("text-gray-400");
      rule.classList.add("text-green-600");
    } else {
      rule.classList.remove("text-green-600");
      rule.classList.add("text-gray-400");
    }
  }

  // Update the rule colors every time the user types a password
  const passwordInput = document.getElementById("newPassword");

  passwordInput.addEventListener("input", function () {
    colorRule("ruleLength", hasEightCharacters(passwordInput.value));
    colorRule("ruleCase", hasUpperAndLower(passwordInput.value));
    colorRule("ruleNumber", hasNumberOrSpecial(passwordInput.value));
  });

  // ---------- Validation ----------

  setupForm.addEventListener("submit", function (event) {
    event.preventDefault();

    let isValid = true;
    const name = document.getElementById("adminName").value.trim();
    const password = passwordInput.value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // 1. FULL NAME: letters and spaces, first and last name
    if (!/^[A-Za-z ]+$/.test(name) || !name.includes(" ")) {
      showError("adminName", "Please enter your first and last name.");
      isValid = false;
    } else {
      clearError("adminName");
    }

    // 2. PASSWORD: must meet all 3 rules
    if (
      !hasEightCharacters(password) ||
      !hasUpperAndLower(password) ||
      !hasNumberOrSpecial(password)
    ) {
      showError(
        "newPassword",
        "Your password doesn't meet all the rules below yet.",
      );
      isValid = false;
    } else {
      clearError("newPassword");
    }

    // 3. CONFIRM PASSWORD: must match
    if (confirmPassword === "" || confirmPassword !== password) {
      showError("confirmPassword", "Passwords do not match.");
      isValid = false;
    } else {
      clearError("confirmPassword");
    }

    // 4. AUDIT LOG CHECKBOX: must be ticked
    const auditAgreeError = document.getElementById("auditAgreeError");
    if (!document.getElementById("auditAgree").checked) {
      auditAgreeError.textContent =
        "Please confirm you understand the audit log.";
      auditAgreeError.classList.remove("hidden");
      isValid = false;
    } else {
      auditAgreeError.classList.add("hidden");
    }

    // Everything is correct: hide the form and show the success message.
    // NOTE: Really creating the account needs a backend.
    if (isValid) {
      document.getElementById("setupStep").classList.add("hidden");
      document.getElementById("doneStep").classList.remove("hidden");
    }
  });
}
