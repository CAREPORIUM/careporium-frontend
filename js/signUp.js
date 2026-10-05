// ====== CREATE ACCOUNT PAGE ======

// Grab the two cards and the button from the page
const professionalCard = document.getElementById("professionalCard");
const facilityCard = document.getElementById("facilityCard");
const getStartedButton = document.getElementById("getStartedButton");

// Remember which card is picked. Professional is picked at the start.
let selectedRole = "professional";

// Make a card look "picked": blue border and light blue background
function selectCard(card) {
  card.classList.remove("border-gray-200", "bg-white");
  card.classList.add("border-blue-400", "bg-blue-50");
}

// Make a card look "not picked": gray border and white background
function unselectCard(card) {
  card.classList.remove("border-blue-400", "bg-blue-50");
  card.classList.add("border-gray-200", "bg-white");
}

// When the professional card is clicked
professionalCard.addEventListener("click", function () {
  selectedRole = "professional";
  selectCard(professionalCard);
  unselectCard(facilityCard);
});

// When the facility card is clicked
facilityCard.addEventListener("click", function () {
  selectedRole = "facility";
  selectCard(facilityCard);
  unselectCard(professionalCard);
});

// When "Get started" is clicked, go to the right form page
getStartedButton.addEventListener("click", function () {
  if (selectedRole === "professional") {
    window.location.href = "/HealthWorkerSection/professionalProfile.html";
  } else {
    window.location.href = "/FacilitySection/facilityProfile.html";
  }
});
