// ====== LANDING PAGE ======

// Grab things we need from the page
const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");
const menuIcon = document.getElementById("menuIcon");
const closeIcon = document.getElementById("closeIcon");
const navLinks = document.querySelectorAll(".nav-link");

// ---------- Mobile menu: open and close ----------

// Open the menu and show the close icon
function openMenu() {
  mobileMenu.classList.remove("hidden");
  menuIcon.classList.add("hidden");
  closeIcon.classList.remove("hidden");
}

// Close the menu and show the menu icon again
function closeMenu() {
  mobileMenu.classList.add("hidden");
  menuIcon.classList.remove("hidden");
  closeIcon.classList.add("hidden");
}

// The same button opens and closes the menu.
// If the menu is hidden, open it. Otherwise, close it.
menuButton.addEventListener("click", function () {
  if (mobileMenu.classList.contains("hidden")) {
    openMenu();
  } else {
    closeMenu();
  }
});

// ---------- Smooth scroll ----------

// Find every link on the page whose href starts with "#" (navbar, footer and logo links)
const pageLinks = document.querySelectorAll('a[href^="#"]');

pageLinks.forEach(function (link) {
  link.addEventListener("click", function (event) {
    // Stop the browser from jumping straight to the section
    event.preventDefault();

    // Get the link's href, for example "#shifts"
    const targetId = link.getAttribute("href");

    if (targetId === "#") {
      // Links with only "#" (like the logo) scroll back to the top of the page
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Find the section with that id and glide to it.
      // "if (section)" makes sure the section exists, so a broken link doesn't cause an error.
      const section = document.querySelector(targetId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    }

    // Close the mobile menu after a link is picked
    closeMenu();
  });
});

// ---------- Active nav link ----------

// Color the link of the section the user is looking at blue
function updateActiveLink() {
  // "Find jobs" is blue by default, like in the design
  let activeId = "#shifts";

  // This will remember the top position of the section we pick
  let closestTop = -Infinity;

  navLinks.forEach(function (link) {
    const targetId = link.getAttribute("href");
    const section = document.querySelector(targetId);

    // How far the section's top is from the top of the screen (in pixels)
    const sectionTop = section.getBoundingClientRect().top;

    // A section counts once its top reaches the top 120px of the screen.
    // If more than one counts, pick the one we reached most recently (the lowest one).
    if (sectionTop <= 120 && sectionTop > closestTop) {
      activeId = targetId;
      closestTop = sectionTop;
    }
  });

  // Blue for the active link, dark gray for the rest
  navLinks.forEach(function (link) {
    if (link.getAttribute("href") === activeId) {
      link.classList.remove("text-gray-900");
      link.classList.add("text-blue-600");
    } else {
      link.classList.remove("text-blue-600");
      link.classList.add("text-gray-900");
    }
  });
}

// Check every time the user scrolls, and once when the page opens
window.addEventListener("scroll", updateActiveLink);
updateActiveLink();
