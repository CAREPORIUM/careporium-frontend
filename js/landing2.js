// ====== LANDING PAGE ======

// Grab things we need from the page
const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");
const navLinks = document.querySelectorAll(".nav-link");

// ---------- Mobile menu ----------

// When the menu button is clicked, show the menu if it's hidden, or hide it if it's showing
menuButton.addEventListener("click", function () {
  mobileMenu.classList.toggle("hidden");
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
      // The logo link has only "#", so it scrolls back to the top of the page
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
    mobileMenu.classList.add("hidden");
  });
});

// ---------- Active nav link ----------

// Decide which section the user is looking at, and color its link blue
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

    // A section counts as "on screen" once its top has reached the top 120px of the screen.
    // If more than one section counts, pick the one we reached most recently (the lowest one).
    if (sectionTop <= 120 && sectionTop > closestTop) {
      activeId = targetId;
      closestTop = sectionTop;
    }
  });

  // Color the links: blue for the active one, dark gray for the rest
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

// Check again every time the user scrolls
window.addEventListener("scroll", updateActiveLink);

// Check once when the page opens too
updateActiveLink();