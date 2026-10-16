// ====== CREATE NEW PASSWORD PAGE ======
// Needs /js/api.js to be loaded first.

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

// New password eye button
document.getElementById("toggleNewPassword").addEventListener("click", function () {
  const input = document.getElementById("newPassword");

  // If the password is hidden, show it. Otherwise, hide it.
  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }

  // Swap the eye icons
  document.getElementById("newEyeOff").classList.toggle("hidden");
  document.getElementById("newEyeOn").classList.toggle("hidden");
});

// Confirm password eye button (same idea as above)
document.getElementById("toggleConfirmPassword").addEventListener("click", function () {
  const input = document.getElementById("confirmPassword");

  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }

  document.getElementById("confirmEyeOff").classList.toggle("hidden");
  document.getElementById("confirmEyeOn").classList.toggle("hidden");
});

// ---------- Password rules ----------

// Check each rule. Each one gives back true (rule met) or false (not met).
function hasEightCharacters(password) {
  return password.length >= 8;
}

function hasUpperAndLower(password) {
  // /[A-Z]/ looks for a capital letter, /[a-z]/ looks for a small letter
  return /[A-Z]/.test(password) && /[a-z]/.test(password);
}

function hasNumberOrSpecial(password) {
  // [^A-Za-z] means "anything that is NOT a letter", so a number or a symbol like ! or @
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

// Every time the user types in the new password box, update the rule colors
const newPasswordInput = document.getElementById("newPassword");

newPasswordInput.addEventListener("input", function () {
  const password = newPasswordInput.value;

  colorRule("ruleLength", hasEightCharacters(password));
  colorRule("ruleCase", hasUpperAndLower(password));
  colorRule("ruleNumber", hasNumberOrSpecial(password));
});

// ---------- Form validation ----------

const form = document.getElementById("newPasswordForm");

form.addEventListener("submit", async function (event) {
  // Stop the page from reloading when the form is sent
  event.preventDefault();

  // This stays true unless we find a mistake
  let isValid = true;

  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // 1. NEW PASSWORD (must follow all 3 rules)
  if (newPassword === "") {
    showError("newPassword", "Please enter a new password.");
    isValid = false;
  } else if (!hasEightCharacters(newPassword) || !hasUpperAndLower(newPassword) || !hasNumberOrSpecial(newPassword)) {
    showError("newPassword", "Your password doesn't meet all the rules below yet.");
    isValid = false;
  } else {
    clearError("newPassword");
  }

  // 2. CONFIRM PASSWORD (must match the new password)
  if (confirmPassword === "") {
    showError("confirmPassword", "Please confirm your new password.");
    isValid = false;
  } else if (confirmPassword !== newPassword) {
    showError("confirmPassword", "Passwords do not match.");
    isValid = false;
  } else {
    clearError("confirmPassword");
  }

  if (!isValid) {
    return;
  }

  // REAL: save the new password. The resetToken was saved by the code page.
  if (!USE_DEMO_MODE) {
    const resetToken = sessionStorage.getItem("resetToken");

    if (!resetToken) {
      showError("newPassword", "Your reset session has expired. Please request a new code.");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    setLoading(button, true, "Saving…");

    try {
      // The reset token is sent in place of a login token (see backend.js)
      await Backend.resetPassword(resetToken, newPassword);
    } catch (error) {
      showError("newPassword", error.message);
      setLoading(button, false);
      return;
    }

    // The token can only be used once, so forget it
    sessionStorage.removeItem("resetToken");
    sessionStorage.removeItem("resetEmail");
  }

  // Done: go back to the login page
  window.location.href = "../AuthenticationSection/login.html";
});
