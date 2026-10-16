// ====== ADMIN SIGN-IN (login page + invitation setup page) ======
// Admins sign in with their email and password only (there's no emailed code step).
// Needs /js/api.js to be loaded first.

// ---------- Demo details (only used when USE_DEMO_MODE is true in api.js) ----------

// For testing the design only. Anyone can read this file in the browser,
// so real admin passwords and codes must NEVER be written here.
const adminAccount = {
  email: "admin@careporium.com",
  password: "Admin@123",
};

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
  // This is inside "if (adminLoginForm)" because only the login page has the eye button.
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

  // ---------- Form ----------
  adminLoginForm.addEventListener("submit", async function (event) {
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

    // ----- DEMO -----
    if (USE_DEMO_MODE) {
      // One general message, so strangers can't tell which part was wrong
      if (email !== adminAccount.email || password !== adminAccount.password) {
        showError("adminPassword", "Incorrect email or password.");
        return;
      }
      localStorage.setItem("userType", "admin");
      localStorage.setItem("userEmail", email);
      window.location.href = "../Admin/AdminOverview.html";
      return;
    }

    // ----- REAL BACKEND -----
    // Admins use the normal login; the account must have the "admin" role.
    const button = adminLoginForm.querySelector('button[type="submit"]');
    setLoading(button, true, "Signing in…");

    try {
      const result = await Backend.login(email, password);
      if (result.userType !== "admin") {
        showError("adminPassword", "This account doesn't have admin access.");
        setLoading(button, false);
        return;
      }
      Backend.saveSession(result, email);
      window.location.href = "../Admin/AdminOverview.html";
    } catch (error) {
      showError("adminPassword", error.message);
      setLoading(button, false);
    }
  });
}

// ==================================================
// 2. ACCEPT INVITATION (set up a new admin account)
// ==================================================

const setupForm = document.getElementById("setupForm");

if (setupForm) {
  // ---------- Read the invitation from the link ----------

  // URLSearchParams reads the parts after the "?" in the address.
  // DEMO links look like:  acceptInvite.html?email=ngozi.a@careporium.com&role=Verification%20reviewer
  // REAL links look like:  acceptInvite.html?token=8f3a91...  (the server makes the token)
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("token");

  // Show the invitation details, or send the user to the "not valid" page
  async function loadInvitation() {
    // ----- DEMO (also used until the server has invitations: SERVER_HAS.adminInvitations) -----
    if (usesDemo("adminInvitations")) {
      showPreviewNote("Admin invitations");
      const inviteEmail = params.get("email");
      const inviteRole = params.get("role");

      if (inviteEmail === null || !inviteEmail.endsWith("@careporium.com")) {
        window.location.href = "inviteExpired.html";
        return;
      }
      document.getElementById("inviteEmailText").textContent = inviteEmail;
      document.getElementById("inviteRoleText").textContent =
        inviteRole || "Admin";
      return;
    }

    // ----- REAL BACKEND -----
    // Ask the server if the token is still valid. It should answer with { email, role }.
    if (!inviteToken) {
      window.location.href = "inviteExpired.html";
      return;
    }

    try {
      const invitation = await apiRequest(
        ENDPOINTS.checkInvitation(inviteToken),
      );
      document.getElementById("inviteEmailText").textContent = invitation.email;
      document.getElementById("inviteRoleText").textContent = invitation.role;
    } catch (error) {
      // Expired, already used, or never existed
      window.location.href = "inviteExpired.html";
    }
  }

  loadInvitation();

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

  // ---------- Validation, then create the account ----------

  setupForm.addEventListener("submit", async function (event) {
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

    if (!isValid) {
      return;
    }

    // Everything is correct: create the account
    if (!usesDemo("adminInvitations")) {
      const button = setupForm.querySelector('button[type="submit"]');
      setLoading(button, true, "Creating account…");

      try {
        await apiRequest(ENDPOINTS.acceptInvitation, "POST", {
          token: inviteToken,
          name: name,
          password: password,
        });
      } catch (error) {
        showError("newPassword", error.message);
        setLoading(button, false);
        return;
      }
    }

    // Hide the form and show the success message
    document.getElementById("setupStep").classList.add("hidden");
    document.getElementById("doneStep").classList.remove("hidden");
  });
}
