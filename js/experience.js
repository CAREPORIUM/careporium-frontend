// ====== WORK EXPERIENCE & SOFT SKILLS ======
// Needs /js/api.js to be loaded first.
//
// Used on 4 pages. Each part below checks that its elements exist before running:
//   1. WorkerShiftMarket/Experience.html      the worker adds, edits and removes roles, and picks soft skills
//   2. WorkerShiftMarket/Profile.html         a summary card with a link to the page above
//   3. FacilityHiringSection/WorkerProfile.html  the facility sees the worker's roles and skills
//   4. FacilityHiringSection/Applicants.html  each applicant card shows their latest role and skills
//
// One experience looks like this:
//   { id, title: "Staff nurse", workplace: "Mainland Care Hospital", location: "Yaba, Lagos",
//     start: "2023-06", end: "" (empty while current), current: true, responsibilities: "..." }

const MAX_EXPERIENCES = 3;

const SOFT_SKILLS = [
  "Communication", "Teamwork", "Empathy", "Problem solving",
  "Time management", "Adaptability", "Attention to detail", "Conflict resolution",
];

// ==================================================
// DEMO DATA (only used when USE_DEMO_MODE is true in api.js)
// ==================================================

// Saved under Amara's worker id, so the facility pages (logged in as the facility, in the same
// browser) can show what she saved on her side.
const EXP_DEMO_KEY = "demoExperience:WK-1048";

function expNewDemo() {
  return {
    experiences: [
      { id: "EX-1", title: "Staff nurse", workplace: "Mainland Care Hospital", location: "Yaba, Lagos", start: "2023-06", end: "", current: true, responsibilities: "Support acute care patients, coordinate handovers, and work closely with the ward team." },
      { id: "EX-2", title: "Registered nurse", workplace: "Community Health Centre", location: "Surulere, Lagos", start: "2021-01", end: "2023-05", current: false, responsibilities: "Provided community nursing care, supported patient education, and maintained clear clinical records." },
    ],
    softSkills: ["Communication", "Teamwork", "Empathy", "Time management"],
  };
}

// With the real backend (which doesn't store experience yet), each worker's own entries are kept
// in this browser under their account, starting empty, instead of showing Amara's sample roles.
function expKey() {
  return USE_DEMO_MODE ? EXP_DEMO_KEY : "experience:" + (sessionGet("userId") || "me");
}

function expDemo() {
  const saved = localStorage.getItem(expKey());
  if (saved) return JSON.parse(saved);
  return USE_DEMO_MODE ? expNewDemo() : { experiences: [], softSkills: [] };
}

function expSaveDemo(data) {
  localStorage.setItem(expKey(), JSON.stringify(data));
}

// ==================================================
// HELPERS
// ==================================================

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2023-06" → "Jun 2023"
function monthText(value) {
  const parts = value.split("-");
  return MONTHS[Number(parts[1]) - 1] + " " + parts[0];
}

// "Jun 2023 – Present" or "Jan 2021 – May 2023"
function rangeText(exp) {
  return monthText(exp.start) + " – " + (exp.current ? "Present" : monthText(exp.end));
}

// Newest first: current roles first, then by start date (latest first)
function sortNewestFirst(list) {
  return list.slice().sort(function (a, b) {
    if (a.current !== b.current) {
      return a.current ? -1 : 1;
    }
    return b.start.localeCompare(a.start);
  });
}

// The box shows "06 / 2023"; we save "2023-06"
function boxToValue(text) {
  const digits = text.replace(/[^0-9]/g, "");
  return digits.length === 6 ? digits.slice(2) + "-" + digits.slice(0, 2) : "";
}

function valueToBox(value) {
  if (!value) {
    return "";
  }
  const parts = value.split("-");
  return parts[1] + " / " + parts[0];
}

// ==================================================
// LOADING AND SAVING (server, or the demo data)
// ==================================================
// Every change sends back the whole updated { experiences, softSkills }, so the page just redraws.

async function expLoad() {
  if (usesDemo("experience")) {
    return expDemo();
  }
  return await apiRequest(ENDPOINTS.workerExperience);
}

// Run a change on the server (REAL), or on the demo data (DEMO)
async function expChange(method, path, body, demoChange) {
  if (usesDemo("experience")) {
    const data = expDemo();
    demoChange(data);
    expSaveDemo(data);
    return data;
  }
  return await apiRequest(path, method, body);
}

// A small skill "chip"
function skillChips(skills) {
  return skills.map(function (skill) {
    return `<span class="inline-block bg-blue-50 text-blue-600 text-xs font-medium px-2 py-1 rounded">${escapeHtml(skill)}</span>`;
  }).join(" ");
}

// One role, as text lines (used on the profile pages)
function roleLines(exp) {
  return `
    <div class="bg-slate-50 border border-gray-200 rounded-xl p-4">
      <p class="text-sm font-semibold">${escapeHtml(exp.title)}</p>
      <p class="text-xs text-gray-700 mt-1">${escapeHtml(exp.workplace)} · ${escapeHtml(exp.location)}</p>
      <p class="text-xs text-gray-700 mt-1">${escapeHtml(rangeText(exp))}</p>
      <p class="text-xs text-gray-700 mt-2">${escapeHtml(exp.responsibilities)}</p>
    </div>`;
}

// ==================================================
// 1. THE EXPERIENCE PAGE (worker)
// ==================================================

const experiencePage = document.getElementById("experiencePage");

if (experiencePage) {
  // Not on the server yet (SERVER_HAS.experience in api.js): sample data, with a note
  if (usesDemo("experience")) {
    showPreviewNote("Work experience and soft skills", "Work experience and soft skills are saved on this device for now. Facilities will see them once the server stores them.");
  }

  let data = { experiences: [], softSkills: [] };
  let editingId = null; // the role being edited (null = adding a new one)
  let removingId = null; // the role waiting for "Remove experience"

  // Show one of the 4 views: "list", "form", "remove" or "saved"
  function showView(view) {
    ["listView", "formView", "removeView", "savedView"].forEach(function (id) {
      document.getElementById(id).classList.toggle("hidden", id !== view + "View");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- The list ----------

  function experienceCard(exp) {
    const button = "w-40 border border-blue-600 text-blue-600 bg-white text-xs font-medium text-center py-3 rounded-lg hover:bg-blue-50";
    return `
      <div class="bg-slate-50 border border-gray-200 rounded-xl p-5">
        <p class="text-base font-semibold">${escapeHtml(exp.title)}</p>
        <p class="text-xs text-gray-700 mt-1">${escapeHtml(exp.workplace)} · ${escapeHtml(exp.location)}</p>
        <p class="text-xs text-gray-700 mt-2">${escapeHtml(rangeText(exp))}</p>
        <p class="text-xs text-gray-700 mt-3">${escapeHtml(exp.responsibilities)}</p>
        <div class="flex flex-wrap gap-3 mt-3">
          <button type="button" data-edit="${escapeHtml(exp.id)}" class="${button}">Edit experience</button>
          <button type="button" data-remove="${escapeHtml(exp.id)}" class="${button}">Remove</button>
        </div>
      </div>`;
  }

  function drawList() {
    const list = sortNewestFirst(data.experiences);
    const count = list.length;
    document.getElementById("experienceCount").textContent = count + " of " + MAX_EXPERIENCES + " experiences";
    document.getElementById("experienceList").innerHTML = list.map(experienceCard).join("");

    // "Add experience": blue while there's room, grey at 3
    const addButton = document.getElementById("addExperience");
    const full = count >= MAX_EXPERIENCES;
    addButton.disabled = full;
    addButton.className = "text-sm font-medium text-center px-6 py-3 rounded-lg mt-5 " +
      (full ? "bg-slate-200 text-gray-600 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700");

    // The note under the button
    const note = document.getElementById("experienceNote");
    if (count === 0) {
      note.textContent = "No experience added yet. Start with your most recent role.";
    } else if (full) {
      note.textContent = "You've added 3 experiences. Edit a role or remove an older one to add another.";
    } else {
      note.textContent = "";
    }

    // The soft skills boxes
    document.querySelectorAll(".skill-box").forEach(function (box) {
      box.checked = data.softSkills.includes(box.value);
    });
  }

  // ---------- The add / edit form ----------

  const fields = ["expTitle", "expWorkplace", "expLocation", "expStart", "expEnd", "expResponsibilities"];
  const currentBox = document.getElementById("expCurrent");
  const endBox = document.getElementById("expEnd");

  function setError(id, message) {
    const error = document.getElementById(id + "Error");
    error.textContent = message;
    error.classList.toggle("hidden", message === "");
    document.getElementById(id).classList.toggle("border-red-500", message !== "");
  }

  // "I currently work here" → the end date shows "Present" and can't be typed in
  function updateEndBox() {
    if (currentBox.checked) {
      endBox.value = "Present";
      endBox.disabled = true;
      endBox.classList.add("bg-slate-50");
      setError("expEnd", "");
    } else {
      if (endBox.value === "Present") {
        endBox.value = "";
      }
      endBox.disabled = false;
      endBox.classList.remove("bg-slate-50");
    }
  }

  currentBox.addEventListener("change", updateEndBox);

  // Typing "062023" in a date box becomes "06 / 2023"
  ["expStart", "expEnd"].forEach(function (id) {
    const box = document.getElementById(id);
    box.addEventListener("input", function () {
      const digits = box.value.replace(/[^0-9]/g, "").slice(0, 6);
      box.value = digits.length > 2 ? digits.slice(0, 2) + " / " + digits.slice(2) : digits;
    });
  });

  // Open the form: empty to add a role, or filled in to edit one
  function openForm(exp) {
    editingId = exp ? exp.id : null;
    const left = MAX_EXPERIENCES - data.experiences.length;
    const roomText = left === 1 ? "one more experience" : left + " more experiences";

    document.getElementById("formTitle").textContent = exp ? "Edit experience" : "Add experience";
    document.getElementById("formIntro").textContent = exp
      ? "Update the details of this role."
      : (data.experiences.length === 0 ? "Start with your most recent role." : "You have room for " + roomText + ". Add a recent role.");
    document.getElementById("saveExperience").textContent = exp ? "Save changes" : "Save experience";

    document.getElementById("expTitle").value = exp ? exp.title : "";
    document.getElementById("expWorkplace").value = exp ? exp.workplace : "";
    document.getElementById("expLocation").value = exp ? exp.location : "";
    document.getElementById("expStart").value = exp ? valueToBox(exp.start) : "";
    endBox.value = exp && !exp.current ? valueToBox(exp.end) : "";
    currentBox.checked = exp ? exp.current : false;
    document.getElementById("expResponsibilities").value = exp ? exp.responsibilities : "";
    fields.forEach(function (id) { setError(id, ""); });
    updateEndBox();
    showView("form");
  }

  // Check a "MM / YYYY" box. Gives back an error message, or "" if it's fine.
  function checkMonth(text, label) {
    const value = boxToValue(text);
    if (value === "") {
      return "Enter the " + label + " as MM / YYYY, like 06 / 2023.";
    }
    const month = Number(value.split("-")[1]);
    const year = Number(value.split("-")[0]);
    const now = new Date();
    const thisMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    if (month < 1 || month > 12) {
      return "The month must be between 01 and 12.";
    }
    if (year < 1950 || value > thisMonth) {
      return "The " + label + " can't be in the future.";
    }
    return "";
  }

  // Check the whole form. Gives back the role, or null if something needs fixing.
  function checkForm() {
    let isValid = true;
    const required = { expTitle: "Enter your job title.", expWorkplace: "Enter where you worked.", expLocation: "Enter the location, like Yaba, Lagos." };
    Object.keys(required).forEach(function (id) {
      if (document.getElementById(id).value.trim().length < 2) {
        setError(id, required[id]);
        isValid = false;
      } else {
        setError(id, "");
      }
    });

    const startText = document.getElementById("expStart").value;
    const startError = checkMonth(startText, "start date");
    setError("expStart", startError);
    if (startError) isValid = false;

    if (!currentBox.checked) {
      let endError = checkMonth(endBox.value, "end date");
      if (!endError && !startError && boxToValue(endBox.value) < boxToValue(startText)) {
        endError = "The end date must be after the start date.";
      }
      setError("expEnd", endError);
      if (endError) isValid = false;
    }

    const responsibilities = document.getElementById("expResponsibilities").value.trim();
    if (responsibilities.length < 10 || responsibilities.length > 300) {
      setError("expResponsibilities", "Describe your responsibilities in 10 to 300 characters.");
      isValid = false;
    } else {
      setError("expResponsibilities", "");
    }

    if (!isValid) {
      return null;
    }
    return {
      title: document.getElementById("expTitle").value.trim(),
      workplace: document.getElementById("expWorkplace").value.trim(),
      location: document.getElementById("expLocation").value.trim(),
      start: boxToValue(startText),
      end: currentBox.checked ? "" : boxToValue(endBox.value),
      current: currentBox.checked,
      responsibilities: responsibilities,
    };
  }

  // ---------- Buttons ----------

  async function save(button, loadingText, runChange) {
    setLoading(button, true, loadingText);
    try {
      data = await runChange();
    } catch (error) {
      showGeneralError("Couldn't save your changes: " + error.message);
      setLoading(button, false);
      return;
    }
    setLoading(button, false);
    drawList();
    showView("saved");
  }

  document.getElementById("experienceForm").addEventListener("submit", function (event) {
    event.preventDefault();
    const role = checkForm();
    if (role === null) {
      return;
    }
    const button = document.getElementById("saveExperience");

    if (editingId) {
      const id = editingId;
      save(button, "Saving…", function () {
        return expChange("PUT", ENDPOINTS.workerExperienceItem(id), role, function (d) {
          const index = d.experiences.findIndex(function (e) { return e.id === id; });
          d.experiences[index] = Object.assign({ id: id }, role);
        });
      });
    } else {
      save(button, "Saving…", function () {
        return expChange("POST", ENDPOINTS.workerExperience, role, function (d) {
          d.experiences.push(Object.assign({ id: "EX-" + Date.now() }, role));
        });
      });
    }
  });

  document.getElementById("addExperience").addEventListener("click", function () {
    if (data.experiences.length < MAX_EXPERIENCES) {
      openForm(null);
    }
  });

  // "Edit experience" and "Remove" on the cards (one listener catches them all)
  document.getElementById("experienceList").addEventListener("click", function (event) {
    const editButton = event.target.closest("[data-edit]");
    const removeButton = event.target.closest("[data-remove]");
    if (editButton) {
      openForm(data.experiences.find(function (e) { return e.id === editButton.getAttribute("data-edit"); }));
    }
    if (removeButton) {
      removingId = removeButton.getAttribute("data-remove");
      showView("remove");
    }
  });

  document.getElementById("confirmRemove").addEventListener("click", function () {
    const id = removingId;
    save(document.getElementById("confirmRemove"), "Removing…", function () {
      return expChange("DELETE", ENDPOINTS.workerExperienceItem(id), null, function (d) {
        d.experiences = d.experiences.filter(function (e) { return e.id !== id; });
      });
    });
  });

  // "Cancel", "Keep experience" and "Back to experience" all go back to the list
  document.querySelectorAll("[data-back-to-list]").forEach(function (button) {
    button.addEventListener("click", function () {
      showView("list");
    });
  });

  // Save soft skills: at least one must be ticked
  document.getElementById("saveSkills").addEventListener("click", function () {
    const chosen = Array.from(document.querySelectorAll(".skill-box:checked")).map(function (box) { return box.value; });
    const error = document.getElementById("skillsError");
    if (chosen.length === 0) {
      error.textContent = "Choose at least one skill.";
      error.classList.remove("hidden");
      return;
    }
    error.classList.add("hidden");
    save(document.getElementById("saveSkills"), "Saving…", function () {
      return expChange("PUT", ENDPOINTS.workerSoftSkills, { softSkills: chosen }, function (d) {
        d.softSkills = chosen;
      });
    });
  });

  // ---------- Start ----------

  async function start() {
    try {
      data = await expLoad();
    } catch (error) {
      showGeneralError("Couldn't load your experience: " + error.message);
    }
    document.getElementById("experienceLoading").classList.add("hidden");
    drawList();
    showView("list");
  }

  start();
}

// ==================================================
// 2. THE WORKER'S PROFILE PAGE: summary card
// ==================================================

const profileExperience = document.getElementById("profileExperience");

if (profileExperience) {
  expLoad().then(function (data) {
    const list = sortNewestFirst(data.experiences);
    profileExperience.innerHTML = list.length
      ? list.map(roleLines).join("")
      : '<p class="text-xs text-gray-700">No experience added yet.</p>';
    document.getElementById("profileSkills").innerHTML = data.softSkills.length
      ? skillChips(data.softSkills)
      : '<span class="text-xs text-gray-700">No soft skills chosen yet.</span>';
  }).catch(function (error) {
    showGeneralError("Couldn't load your experience: " + error.message);
  });
}

// ==================================================
// 3. THE FACILITY'S VIEW OF A WORKER'S PROFILE
// ==================================================

const workerExperience = document.getElementById("workerExperience");

// Draw the worker's roles and skills. With the real backend, facilityDashboard.js calls this
// after loading the worker (the server sends "experiences" and "softSkills" with the profile).
function showWorkerExperience(worker) {
  if (!workerExperience) {
    return;
  }
  const list = sortNewestFirst(worker.experiences || []);
  workerExperience.innerHTML = list.length
    ? list.map(roleLines).join("")
    : '<p class="text-xs text-gray-700">No work experience added yet.</p>';
  document.getElementById("workerSkills").innerHTML = (worker.softSkills || []).length
    ? skillChips(worker.softSkills)
    : '<span class="text-xs text-gray-700">No soft skills added yet.</span>';
}

// DEMO: the sample profile is Amara's, so show what she saved
if (workerExperience && USE_DEMO_MODE) {
  showWorkerExperience(expDemo());
}

// ==================================================
// 4. APPLICANT CARDS (facility)
// ==================================================

// Fill one applicant card's "Latest role" line and skill chips
function fillApplicantExperience(card, latestRole, softSkills) {
  const role = card.querySelector(".applicant-role");
  const skills = card.querySelector(".applicant-skills");
  if (role) {
    role.textContent = latestRole ? "Latest role: " + latestRole : "No work experience added yet";
  }
  if (skills) {
    skills.innerHTML = skillChips((softSkills || []).slice(0, 3));
  }
}

// "Staff nurse · Mainland Care Hospital (Jun 2023 – Present)"
function latestRoleText(experiences) {
  const latest = sortNewestFirst(experiences || [])[0];
  return latest ? latest.title + " · " + latest.workplace + " (" + rangeText(latest) + ")" : "";
}

// DEMO: Amara's card shows what she saved on her side
if (USE_DEMO_MODE) {
  const amaraCard = document.querySelector('.applicant-card[data-worker="WK-1048"]');
  if (amaraCard) {
    const demo = expDemo();
    fillApplicantExperience(amaraCard, latestRoleText(demo.experiences), demo.softSkills);
  }
}
