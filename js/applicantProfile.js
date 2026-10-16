// ====== APPLICANT PROFILE (facility) ======
// Needs /js/api.js and /js/backend.js first.
//
// The full profile of one applicant: details, credentials, work experience, soft skills and the
// application itself, with "Book this worker" and "Decline application".
// Opened from "View verified credential" on the worker profile page, e.g.
//   ApplicantProfile.html?worker=652...&application=653...&shift=654...

(function () {
  const workerId = getUrlValue("worker");
  const applicationId = getUrlValue("application");
  const shiftId = getUrlValue("shift");
  let profile = null;

  // "Back to applicants" goes back to the same shift's applicants
  if (shiftId) {
    document.getElementById("backLink").href = "../FacilityHiringSection/Applicants.html?shift=" + encodeURIComponent(shiftId);
  }

  const STATUS_COLORS = {
    verified: "bg-green-50 text-green-700",
    pending: "bg-amber-50 text-amber-700",
    rejected: "bg-red-50 text-red-600",
    missing: "bg-gray-100 text-gray-600",
  };

  function drawDocuments(documents) {
    document.getElementById("documentList").innerHTML = documents.map(function (doc) {
      const color = STATUS_COLORS[doc.status] || STATUS_COLORS.pending;
      const open = doc.url
        ? `<a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener" class="text-xs font-medium text-blue-600 hover:underline">Open document</a>`
        : "";
      return `
        <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-gray-200 rounded-xl p-4">
          <div>
            <p class="text-sm font-semibold">${escapeHtml(doc.label)}</p>
            <span class="inline-block ${color} text-xs font-semibold px-2 py-1 rounded mt-1">${escapeHtml(doc.text)}</span>
          </div>
          ${open}
        </div>`;
    }).join("");
  }

  // "Jun 2023 – Present"
  function range(e) {
    const month = function (value) {
      const parts = String(value || "").split("-");
      if (parts.length < 2) return "";
      const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return (names[Number(parts[1]) - 1] || "") + " " + parts[0];
    };
    const start = month(e.start);
    const end = e.current ? "Present" : month(e.end);
    return start && end ? start + " – " + end : start || end;
  }

  function drawExperience(data) {
    const list = data.experiences || [];
    document.getElementById("experienceList").innerHTML = list.length
      ? list.map(function (e) {
          return `
            <div class="bg-slate-50 border border-gray-200 rounded-xl p-4">
              <p class="text-sm font-semibold">${escapeHtml(e.title)}${e.workplace ? " · " + escapeHtml(e.workplace) : ""}</p>
              <p class="text-xs text-gray-700 mt-1">${escapeHtml([range(e), e.location].filter(Boolean).join(" · "))}</p>
              ${e.responsibilities ? `<p class="text-xs text-gray-700 mt-2">${escapeHtml(e.responsibilities)}</p>` : ""}
            </div>`;
        }).join("")
      : `<p class="text-xs text-gray-700">${escapeHtml(data.fields.experienceYears !== "—"
          ? data.fields.experienceYears + " of experience as " + data.fields.profession.toLowerCase() + ". No individual roles have been added yet."
          : "No work experience added yet.")}</p>`;
    const skills = data.softSkills || [];
    document.getElementById("skillList").innerHTML = skills.length
      ? skills.map(function (skill) {
          return `<span class="inline-block bg-blue-50 text-blue-600 text-xs font-medium px-2 py-1 rounded">${escapeHtml(skill)}</span>`;
        }).join("")
      : '<span class="text-xs text-gray-700">No soft skills added yet.</span>';
  }

  function drawDecision(status) {
    document.getElementById("decisionButtons").classList.toggle("hidden", status !== "Under review");
    document.getElementById("bookedNote").classList.toggle("hidden", status !== "Accepted");
    document.getElementById("declinedNote").classList.toggle("hidden", status !== "Not selected");
    const badge = document.getElementById("applicationBadge");
    badge.textContent = status === "Accepted" ? "Booked" : status;
    badge.className = "inline-block text-xs font-semibold uppercase px-2 py-1 rounded " +
      (status === "Accepted" ? "bg-green-50 text-green-700" : status === "Not selected" ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-600");
  }

  async function load() {
    if (USE_DEMO_MODE) {
      document.getElementById("pageLoading").textContent = "Open this page from an applicant (it needs the real backend).";
      return;
    }
    if (!workerId && !applicationId) {
      document.getElementById("pageLoading").textContent = "Open this page from the Applicants page.";
      return;
    }
    try {
      profile = await Backend.applicantProfile(workerId, applicationId);
    } catch (error) {
      document.getElementById("pageLoading").classList.add("hidden");
      showGeneralError("Couldn't load this applicant: " + error.message);
      return;
    }
    fillFields(profile.fields);
    const badge = document.getElementById("verificationBadge");
    if (profile.badge) {
      badge.textContent = profile.badge.text;
      badge.className = "inline-block text-xs font-semibold uppercase px-2 py-1 rounded " +
        { green: "bg-green-50 text-green-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-600", gray: "bg-gray-100 text-gray-600" }[profile.badge.color];
    }
    drawDocuments(profile.documents);
    drawExperience(profile);
    drawDecision(profile.applicationStatus);
    document.getElementById("shiftLink").href = "../FacilityHiringSection/ShiftDetails.html?shift=" + encodeURIComponent(profile.shiftId);
    document.getElementById("pageLoading").classList.add("hidden");
    document.getElementById("profileView").classList.remove("hidden");
  }

  document.getElementById("bookWorker").addEventListener("click", async function () {
    const button = document.getElementById("bookWorker");
    setLoading(button, true, "Booking…");
    try {
      await Backend.acceptApplication(profile.applicationId);
    } catch (error) {
      showGeneralError("Couldn't book this worker: " + error.message);
      setLoading(button, false);
      return;
    }
    setLoading(button, false);
    profile.applicationStatus = "Accepted";
    drawDecision("Accepted");
  });

  document.getElementById("declineWorker").addEventListener("click", async function () {
    if (!confirm("Decline " + profile.fields.name + "'s application?")) {
      return;
    }
    const button = document.getElementById("declineWorker");
    setLoading(button, true, "Declining…");
    try {
      await Backend.rejectApplication(profile.applicationId);
    } catch (error) {
      showGeneralError("Couldn't decline this application: " + error.message);
      setLoading(button, false);
      return;
    }
    setLoading(button, false);
    profile.applicationStatus = "Not selected";
    drawDecision("Not selected");
  });

  load();
})();
