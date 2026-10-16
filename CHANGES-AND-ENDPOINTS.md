# Careporium frontend — fixes, endpoint review and demo checklist

## 1. What was fixed

| Issue | Cause | Fix |
|---|---|---|
| Worker sees "documents submitted / pending", admin sees "not uploaded" | The frontend only looked for documents in one place (`profile.<key>` or `profile.documents.<key>`). The admin endpoints return the same profile in a different shape, so the admin side found nothing. | `js/backend.js` now finds each document wherever the server puts it: flat keys, a `documents` object, a list of `{ documentType, url }`, wrapped in `{ worker: … }` / `{ data: … }`, Cloudinary `secure_url`, plain URL strings. Missing links are also filled in from the verification queue (which lists each document with its URL). |
| Admin clicks Approve → "Submission approved" but the worker never becomes verified | Approve skipped every document it hadn't detected, so it sent **zero** requests and still showed success. | Approve now sends one PATCH per document that isn't already verified, then reloads the account and checks the result. It only shows "approved" when the account really is verified; otherwise it stays on the page and says exactly what failed (e.g. "Proof of address: Document has not been uploaded"). Same for facilities. |
| Worker/facility still unverified after approval | Status read only from a `verificationStatus` field. | Status is now worked out from the field **and** the documents: every required document verified ⇒ verified. |
| Dummy names ("Amara Okafor", "Mainland Care") top right | Hard-coded in the HTML. | Every worker and facility page now shows the logged-in user's name and initials (from the profile, cached for instant display). |
| "Verified professional" / "Verified facility" shown to unverified accounts | Hard-coded badges. | Badges now follow the real status: Verified / Verification in progress / Documents need attention / Not verified yet. Applicant cards and the facility's view of a worker also show the real status. |
| "View verified credential" did nothing | `href="#"`. | New page **FacilityHiringSection/ApplicantProfile.html**: full applicant profile (about, profession, specialty, experience, location, contact), each credential with its status and an "Open document" link, work experience, soft skills, the application (shift, pay, applied time) and **Book this worker / Decline application**. Also linked as "View credentials" on every applicant card. |
| Admin document buttons only changed a line of text | No link to the file. | They open the real uploaded file; worker review now has buttons for all 4 documents, facility review for all 3. |
| Manage users → "View profile" did nothing | `href="#"`. | Opens the review page for that worker/facility (so the admin can verify anyone, even if the queue misses them). |
| Worker "Edit professional profile" did nothing | `href="#"`. | Inline edit form → `PUT /api/worker/v1/update-worker-profile`. |
| My applications → "View application" did nothing | `href="#"`. | Accepted → "Go to my shift" (clock-in page); others → the shift's details. |
| Worker and facility dashboards showed sample data | No dashboard endpoint. | Both dashboards are now built from real data (applications, shifts, profile). |
| Find shifts could hide real shifts | Defaults were "Registered nurse", "Acute care", "6–12 October 2026", ₦3,000/hr minimum. | Defaults are now "Any …" and ₦0. Date and location filters work, and shifts that have already ended are hidden. |
| Attendance QR only appeared once **every** place was booked | Design rule. | The QR appears as soon as one worker is booked. Facilities can still fill the remaining places. |
| No way to clock in without a phone camera | The 6-digit backup code doesn't exist on the backend. | The facility page shows the QR's text as a copyable "attendance code"; the worker can paste it, or upload a photo/screenshot of the QR. |
| Complete Shift only unlocked after the end time | Attendance times aren't sent back by the backend. | Unlocks once the shift has started (the confirm step is still there, and the server still validates). If the backend starts sending clock times with applications, the stricter "everyone clocked out" rule is used automatically. |
| Payment not funded = silent | — | If the shift carries a payment status that isn't funded, the facility shift page shows it with **Retry payment** (`POST /api/payments/v1/retry/{shiftId}`). |

**Opening the project:** all links, images and scripts now use relative paths (e.g. `../icons/bell.png`), so the site works whichever folder VS Code / Live Server is opened on. Before, they started with `/` and only worked when the server's root was exactly the folder containing `index.html`. Four icons the pages referenced were never in the project (`info.png`, `location.png`, `famicons_eye-solid.png`, `red-warning.png`); they now point to existing or newly added icons.

**Facility applications 404:** the live server answers 404 for `GET /api/applications/v1/facility-applications`, although it's in the Swagger file. Until the backend deploys it, the frontend tries other likely addresses and applications embedded in the facility's shifts. If none exist, the Applicants page says clearly which route is missing.

**Shift payment (escrow) — how it works now** (based on the live `create-shift` response):
1. Facility posts a shift → `POST /api/shifts/v1/create-shift` answers `{ message, data: { shift: { status: "pending_payment" }, payment: { checkoutUrl, virtualAccountNumber, bankName, amountKobo, platformCommissionAmountKobo, providerReference, expiresAt } } }`. (This answer has no `success` field, which is why the frontend used to miss the payment link — fixed.)
2. The facility is taken to **Fund shift**: total to fund (e.g. ₦110,000 = 2 × ₦50,000 + 10% platform fee), a **“Make test payment to escrow”** button (opens `checkoutUrl`), the sandbox virtual account, the reference and expiry.
3. The page checks `GET /api/shifts/v1/get-shift/{id}` every 8 seconds (and when you come back to the tab). When the backend's HarrenaPay webhook changes the status from `pending_payment` to live, it shows **Shift funded** and the shift appears for workers.
4. Until then the shift shows **Awaiting payment · Fund shift** on Manage shifts, the dashboard and the shift page, and it's hidden from workers. “Get a new payment link” calls `POST /api/payments/v1/retry/{shiftId}`.
5. The payment details are kept in the browser that posted the shift (there's no “get payment” endpoint). On another device, use “Get a new payment link”.

**Applying twice:** once a worker has applied, “Apply for this shift” becomes a grey **Applied ✓** (or **Booked ✓** with “Go to my shift”), the submit button on the review page is disabled, and the shift's card on Find shifts shows an **Applied** badge.

Testing against another server (e.g. the backend developer's machine): in the browser Console run
`localStorage.setItem("apiBaseUrl", "http://localhost:8089")`, and `localStorage.removeItem("apiBaseUrl")` to go back.

## 2. Every endpoint in the Swagger file, and how the frontend uses it

### Authentication
| Method | Path | Used by | Workflow fit |
|---|---|---|---|
| POST | /api/auth/v1/register/worker | Sign-up (worker) | ✅ |
| POST | /api/auth/v1/register/facility | Sign-up (facility) | ⚠️ Server currently requires a location although Swagger says optional; frontend sends "To be provided" placeholders, replaced on the registration page |
| POST | /api/auth/v1/verify-account | Email code | ✅ |
| POST | /api/auth/v1/resend-otp | Email code | ✅ |
| POST | /api/auth/v1/login | Log in | ✅ |
| POST | /api/auth/v1/logout | Log out | ✅ |
| GET | /api/auth/v1/get-profile | Fallback when worker profile 404s | ✅ |
| POST | /api/auth/v1/forgot-password | Forgot password | ✅ |
| POST | /api/auth/v1/verify-reset-code | Reset code | ✅ |
| POST | /api/auth/v1/resend-reset-code | Reset code | ✅ |
| POST | /api/auth/v1/reset-password | New password | ✅ |

### Profiles
| Method | Path | Used by | Workflow fit |
|---|---|---|---|
| GET | /api/worker/v1/get-worker-profile | Worker dashboard, status, profile, header name | ✅ (own profile only) |
| PUT | /api/worker/v1/update-worker-profile | Document upload, Edit profile | ✅ ⚠️ has `locationStreet` but no `locationCity` |
| GET | /api/facility/v1/get-facility-profile | Facility dashboard, profile, header name | ✅ |
| PUT | /api/facility/v1/update-facility-profile | Registration documents, profile form | ✅ |

### Shifts
| Method | Path | Used by | Workflow fit |
|---|---|---|---|
| POST | /api/shifts/v1/create-shift | Post a shift (also starts payment) | ✅ |
| GET | /api/shifts/v1/get-shifts?status=open | Find shifts, worker dashboard | ✅ |
| GET | /api/shifts/v1/get-shift/{shiftId} | Shift details (both sides) | ✅ |
| GET | /api/shifts/v1/get-facility-shifts | Manage shifts, facility dashboard | ✅ |
| PATCH | /api/shifts/v1/complete-shift/{shiftId} | Complete Shift | ✅ |
| PUT | /api/shifts/v1/update-shift/{shiftId} | — not used | ⚠️ its schema (`role`, `date`) doesn't match create-shift (`profession`, `shiftDate`) |
| PATCH | /api/shifts/v1/close-shift/{shiftId} | — not used | optional (cancel a shift) |
| DELETE | /api/shifts/v1/delete-shift/{shiftId} | — not used | optional |

### Applications
| Method | Path | Used by | Workflow fit |
|---|---|---|---|
| POST | /api/applications/v1/apply/{shiftId} | Submit application | ✅ (the cover message isn't stored by the backend) |
| GET | /api/applications/v1/my-applications | My applications, worker dashboard, clock-in page | ✅ |
| GET | /api/applications/v1/facility-applications | Applicants, worker profile & applicant profile, facility shift page | ❌ **answers 404 on the live server** — must be deployed. This is the **only** source of a worker's details for facilities, so it must populate the worker profile (name, profession, documents/status) |
| PATCH | /api/applications/v1/accept/{applicationId} | Book worker / Offer shift | ✅ |
| PATCH | /api/applications/v1/reject/{applicationId} | Decline application (new) | ✅ |

### Attendance
| Method | Path | Used by | Workflow fit |
|---|---|---|---|
| GET | /api/attendance/v1/qr/{shiftId} | Facility shift page (QR + attendance code) | ✅ |
| POST | /api/attendance/v1/clock-in | Worker clock in | ✅ |
| POST | /api/attendance/v1/clock-out | Worker clock out | ✅ |

### Admin
| Method | Path | Used by | Workflow fit |
|---|---|---|---|
| GET | /api/admin/v1/dashboard/stats | Admin overview | ✅ |
| GET | /api/admin/v1/verification-queue | Verification queue (+ document links) | ✅ |
| GET | /api/admin/v1/workers | Manage users, fallback lookup | ✅ |
| GET | /api/admin/v1/workers/pending | Queue (backup source) | ⚠️ if Express registers `/workers/:workerId` before `/workers/pending`, "pending" is treated as an id. The frontend tolerates this |
| GET | /api/admin/v1/workers/{workerId} | Review worker | ✅ |
| PATCH | /api/admin/v1/workers/{workerId}/documents | Approve / reject worker (one call per document) | ✅ |
| GET | /api/admin/v1/facilities | Manage users, fallback lookup | ✅ |
| GET | /api/admin/v1/facilities/pending | Queue (backup source) | ✅ |
| GET | /api/admin/v1/facilities/{facilityId} | Review facility | ✅ |
| PATCH | /api/admin/v1/facilities/{facilityId}/documents | Approve / reject facility | ✅ |

### Payments
| Method | Path | Used by | Workflow fit |
|---|---|---|---|
| POST | /api/payments/v1/harrenapay/webhook | Server-to-server only | ✅ (not for the frontend) |
| POST | /api/payments/v1/retry/{shiftId} | Retry payment (facility shift page) | ✅ |
| POST | harrenapay.com /api/public/v1/escrow/{reference}/simulate-fund | Sandbox only, needs the secret key | must be called by the backend/Postman, never the browser |

## 3. Gaps between the endpoints and the workflow (for the backend developer)

1. **No way for a facility to read a worker's profile by id.** Everything a facility sees about an applicant comes from `facility-applications`. Make sure it populates the worker (and their user) including document statuses, or add `GET /api/worker/v1/get-worker-profile/{workerId}` for facilities.
2. **Attendance can't be read back.** No endpoint returns clock-in/clock-out times, so the facility can't see who has clocked in, and the worker's times are only remembered in their browser. Add `clockInTime` / `clockOutTime` to each application in `facility-applications` / `my-applications` (the frontend already reads them if present), or add `GET /api/attendance/v1/shift/{shiftId}`.
3. **No overall verification-status endpoint.** The status is worked out from the profile. Fine, but the profile should expose one consistent `verificationStatus` field ("pending" / "verified" / "rejected").
4. **Payments.** `create-shift` starts the HarrenaPay escrow. Confirm that a new shift is listed by `get-shifts?status=open` in sandbox **without** waiting for a webhook; otherwise workers won't see it until the backend simulates funding. There are no endpoints for payment lists, payouts or bank details yet (those pages stay as previews).
5. **Not on the backend yet (pages show preview/sample data):** notifications, work experience & soft skills (saved on the worker's device for now), facility ratings, shortlist, no-show/replacement/fix attendance, 6-digit backup code, payments lists, disputes, activity reports, admin invitations/team, suspending accounts.
6. **Swagger text issues:** `register/facility` says documents go through the "worker profile update endpoint" (should be the facility one); `VerificationQueueItem._id` doesn't say whose id it is (document or profile). The frontend prefers `workerId` / `facilityId` when present.

## 4. Demo checklist (end-to-end shift)

1. Admin: Verification queue → review the worker → tick the 3 checks → Approve. Repeat for the facility. You should land on "Submission approved — … is now verified". Any error message names the missing document.
2. Facility: Post a shift for **today**, starting a few minutes from now (clock-in opens 30 minutes before the start), **1 professional needed**.
3. Worker: Find shifts → View shift → Apply → write a short message → Submit.
4. Facility: Applicants → View credentials (full profile) → **Book this worker** → Open shift & attendance QR.
5. Worker: Upcoming shifts → Clock in → scan the QR with a phone (the site must be on **https**), or "Enter the code instead" and paste the attendance code shown under the QR, or upload a screenshot of the QR.
6. Worker: Clock Out.
7. Facility: Complete Shift → Confirm.

All of the above was run end-to-end in a browser against a stand-in server that follows this Swagger file, with the documents sent in two different shapes. Everything passed: 38 checks, plus the "approve with missing documents" case. Run it once against the live server before the presentation, because the live server's exact response shapes couldn't be reached from the build environment.
