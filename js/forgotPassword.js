// ====== FORGOT PASSWORD PAGE (enter your email) ======
// Needs /js/api.js to be loaded first.
//
// This is the first step of resetting a password:
// 1. this page: the user types their email and we ask the server to send a code
// 2. resetPassword.html: they type the 6-digit code
// 3. newPassword.html: they choose a new password

const form = document.getElementById("forgotForm");
const emailInput = document.getElementById("email");
const emailError = document.getElementById("emailError");

// Show a red error message under the email box and make its border red
function showError(message) {
  emailError.textContent = message;
  emailError.classList.remove("hidden");
  emailInput.classList.remove("border-blue-400");
  emailInput.classList.add("border-red-500");
}

form.addEventListener("submit", async function (event) {
  // Stop the page from reloading when the form is sent
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();

  // The email must look like something@something.something
  if (email === "") {
    showError("Please enter your email address.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("Please enter a valid email, like you@gmail.com.");
    return;
  }

  // Remember the email, so the code page knows who the code was sent to.
  // sessionStorage is cleared when the tab is closed.
  sessionStorage.setItem("resetEmail", email);

  // REAL: ask the server to email a code (in demo mode we skip this)
  if (!USE_DEMO_MODE) {
    const button = form.querySelector('button[type="submit"]');
    setLoading(button, true, "Sending code…");

    try {
      await Backend.forgotPassword(email);
    } catch (error) {
      showError(error.message);
      setLoading(button, false);
      return;
    }
  }

  // Go to the page where the user types the code
  window.location.href = "../AuthenticationSection/resetPassword.html";
});
