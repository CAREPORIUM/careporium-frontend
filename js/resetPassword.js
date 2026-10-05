// ====== RESET PASSWORD (OTP) PAGE ======

// ---------- The 6 OTP boxes ----------

// Get all 6 boxes. This gives us a list we can go through one by one.
const otpBoxes = document.querySelectorAll(".otp-box");

// Go through each box. "index" is its position: 0, 1, 2, 3, 4 or 5.
otpBoxes.forEach(function (box, index) {
  // When the user types in a box
  box.addEventListener("input", function () {
    // Remove anything that is not a number (so letters can't be typed)
    box.value = box.value.replace(/[^0-9]/g, "");

    // If a number was typed and this is not the last box, jump to the next box
    if (box.value !== "" && index < otpBoxes.length - 1) {
      otpBoxes[index + 1].focus();
    }
  });

  // When the user presses a key in a box
  box.addEventListener("keydown", function (event) {
    // If they press Backspace in an empty box, go back to the box before it
    if (event.key === "Backspace" && box.value === "" && index > 0) {
      otpBoxes[index - 1].focus();
    }
  });
});

// Put the cursor in the first box when the page opens
otpBoxes[0].focus();

// ---------- Resend countdown ----------

const resendButton = document.getElementById("resendButton");
const timerText = document.getElementById("timer");

// How many seconds to wait before "Resend" can be clicked
let secondsLeft = 30;

// This will hold our timer so we can stop it later
let countdown;

function startCountdown() {
  secondsLeft = 30;
  resendButton.disabled = true;
  resendButton.classList.add("opacity-50");

  // setInterval runs this code every 1000 milliseconds (1 second)
  countdown = setInterval(function () {
    secondsLeft = secondsLeft - 1;

    // Show the time as 00:29, 00:28 ... (padStart adds a 0 in front of single numbers)
    timerText.textContent = "00:" + String(secondsLeft).padStart(2, "0");

    // When we reach 0, stop the timer and let the user click Resend
    if (secondsLeft === 0) {
      clearInterval(countdown);
      resendButton.disabled = false;
      resendButton.classList.remove("opacity-50");
    }
  }, 1000);
}

// Start the countdown when the page opens
startCountdown();

// When Resend is clicked, start the countdown again
// NOTE: Sending a new code needs a backend. For now we only restart the timer.
resendButton.addEventListener("click", function () {
  timerText.textContent = "00:30";
  startCountdown();
});

// ---------- Form validation ----------

const form = document.getElementById("otpForm");
const otpError = document.getElementById("otpError");

form.addEventListener("submit", function (event) {
  // Stop the page from reloading when the form is sent
  event.preventDefault();

  // Join the 6 boxes into one code, e.g. "6", "8", "1"... becomes "681..."
  let code = "";
  otpBoxes.forEach(function (box) {
    code = code + box.value;
  });

  // The code must have exactly 6 numbers
  if (code.length !== 6) {
    otpError.textContent = "Please enter the full 6-digit code.";
    otpError.classList.remove("hidden");

    // Make the empty boxes red so the user can see what's missing
    otpBoxes.forEach(function (box) {
      if (box.value === "") {
        box.classList.remove("border-gray-300");
        box.classList.add("border-red-500");
      } else {
        box.classList.remove("border-red-500");
        box.classList.add("border-gray-300");
      }
    });
  } else {
    // All 6 numbers are there: go to the page for choosing a new password.
    // NOTE: Only a backend can check if the code is actually correct.
    window.location.href = "/AuthenticationSection/newPassword.html";
  }
});
