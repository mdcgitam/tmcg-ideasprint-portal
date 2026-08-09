# TMCG IdeaSprint 4.0 Portal — Condensed Functional Specification

Condensed from the official `TMCG IdeaSprint 4.0.pdf` (Product Requirements & Functional Specification, 99 sections). This is the **functional source of truth**. Visual/UX interpretation is defined in `prompt.md`. If this file and the PDF ever disagree, the PDF wins — re-check it.

## 1. Overview

Centralized web platform managing the full lifecycle of IdeaSprint 4.0, an intra-campus innovation event at GITAM University Visakhapatnam, jointly organized by **TMCG** and **Meta Developer Communities (MDC) GITAM Visakhapatnam**. Digitizes registration, authentication, participant management, attendance, problem statements, NOC, food coupons, approvals, and admin. Role-based throughout.

## 2. Event Structure

**Phase 1 — Campus Level**, run independently at Visakhapatnam, Hyderabad, Bengaluru (this build = Visakhapatnam):
- Round 1: Naukri Assessment — 100 minutes
- Round 2: Build Hackathon — 18 hours
- Both mandatory for every registered participant. Non-eliminatory at campus level; teams progress to Grand Finale based on overall performance.

**Phase 2 — Grand Finale**: top teams from all three campuses. Cash prizes ₹15,000 / ₹10,000 / ₹5,000, awarded only at Grand Finale, common across campuses.

## 3. Modules

Public Website, Registration, Authentication, Team Management, Participant Management, Problem Statement Management, NOC Management, Attendance Management, Food Coupon Management, Exit Form Management, Dashboard, Approval Workflow, Notifications, Admin Configuration. Each protected by role-based permissions.

## 4. Roles

- **Super Admin** — unrestricted platform access, overall administration & configuration.
- **SPOC** — campus-level admin; actions limited to their assigned teams only.
- **Team Lead** — leads a registered team; manages team info & submissions.
- **Member** — regular participant; limited to viewing/self-service actions.

## 5–6. Public Website (no login required)

Homepage must contain: Event title "TMCG IdeaSprint 4.0", Hero section, Vizag campus image, Login button, Register button, Domains section, previous-year gallery, event timeline, prize section, judges photos, FAQs, Important Instructions, Contact section, Footer.

- **Hero**: event title, Vizag campus image, Login button, Register button.
- **Domains**: org-provided list, admin-configurable.
- **Gallery**: previous-year photos, admin-manageable.
- **Timeline**: official event timeline, admin-configurable.
- **Prizes**: ₹15,000 / ₹10,000 / ₹5,000, note "awarded at Grand Finale."
- **Registration Fee**: display "No Registration Fee."
- **Important Instructions**: admin-editable.
- **NOC Notice**: "NOC Submission is COMPULSORY for every participant" — must stay highly visible throughout registration.
- **FAQs**: admin-editable, organizer-provided.
- **Footer**: 3 TMCG contacts + 1 MDC contact, each with Name/Designation/Phone/Email, all admin-configurable.

## 7. Registration Workflow

Team-based. One participant registers the team and automatically becomes Team Lead.

Flow: Click Register → Registration Guidelines shown → user acknowledges → Basic Team Details → Member Details → Validation → Team Registration Complete → Google Login → Dashboard Access.

## 8. Registration Guidelines

Displayed before registration starts. Must be acknowledged before proceeding — registration cannot continue without it. Content editable from Admin Configuration.

## 9. Step 1 — Basic Team Details

Team Lead provides: Team Name, Domain, No. of Members. No other info requested at this stage.

## 10. Step 2 — Team Member Details

After Step 1, Team Lead provides their own info + every member's info. **All fields mandatory** for every member (including the lead):
Name, Reg No, GITAM Mail ID, Phone Number, Year of Study, School, Department, Branch, Gender, Stay.

## 11. Team Size Rules (permanent business rule)

Minimum 3, maximum 4 members. Team Lead counts as one member.

## 12. Registration Validations

- **Team Name** — must be unique.
- **University Email** — must be unique; same email cannot exist in multiple teams.
- **Registration Number** — must be unique; same participant cannot register twice.
- **Mobile Number** — must be unique; duplicates rejected.
- **Existing Participant Validation** — if a participant is already on another team (checked via Reg No or University Email), registration fails with a clear message that they already belong to another team.
- **Google Auth Domain** — only `@student.gitam.edu` or `gitam.in`; any other domain rejected.

## 13. Team Registration Completion

Successful only when: all validations pass, team size valid, every participant's mandatory info provided, no duplicate participant, team name unique. On success: a unique Team ID is generated, and every participant receives a unique User ID.

## 14. Team ID

Unique per team, system-generated, configurable format.

## 15. User ID Generation

Unique per participant, e.g. `VSP1001`, `VSP1002`, `VSP1003` — auto-incrementing. Campus-specific.

## 16–17. Authentication

Google Authentication + Supabase Authentication. Restricted to university Google accounts only (`@student.gitam.edu` / `gitam.in`). Available only after successful registration — unregistered users cannot authenticate/access protected areas.

Login flow: Login → Google Auth → Verify University Email → Fetch User → Identify Role → Redirect to Dashboard.

## 18. Dashboard Routing

Super Admin → Super Admin Dashboard. SPOC → SPOC Dashboard. Team Lead → Team Dashboard. Member → Member Dashboard. No intermediate landing page (guidelines already acknowledged pre-registration).

## 19. Session Management

Stay logged in until explicit logout or session expiry (15 min, per auth provider config). Unauthenticated access to protected routes → redirect to login.

## 20. Business Rules (Part 1)

Registration team-based; one Team Lead per team; guidelines must be acknowledged; team names/emails/reg numbers/mobile numbers unique; participant belongs to only one team; only university accounts authenticate; registration required before login; User IDs campus-specific; Team IDs system-generated; dashboard access role-based; homepage content configurable wherever applicable.

## 21. Team Management Module

Central workspace per registered team, storing: Team, Team Lead, Members, Problem Statement, NOCs, Attendance, Food Coupons, Exit Status. Available functionality depends on role.

## 22. Team Profile

Single source of truth for team info:
- **Basic Details**: Team ID, Team Name, Registration Status, Current Team Status.
- **Team Lead**: Name, Reg No, GITAM Mail ID, Phone, Year of Study, School, Department, Branch, Gender, Stay, User ID.
- **Team Members**: same fields per member + User ID.
- **Event Information**: Selected Problem Statement, NOC Status, Attendance Summary, Food Coupon Status, Exit Status.

## 23. Team Status

One of: Registered, Active, Pending Approval, Qualified for Grand Finale, Exited. System auto-updates as applicable.

## 24. Team Editing

Only Team Lead can edit team/participant info. User ID and Team ID are never editable.

## 25–26. Approval Workflow for Team Changes

Edits are **not** applied immediately — marked Pending Approval.

Flow: Team Lead edits → Submit Request → Pending Approval → SPOC/Super Admin Review → Approve (apply changes) OR Reject (keep previous info) → notify Team Lead.

While pending: system shows Current Information vs Requested Changes vs Approval Status. Team Lead **cannot** submit another modification request until the existing one is resolved.

## 27. Member Permissions

Can: view team info, view members, view problem statement, view attendance, view food coupon status, upload own NOC, view own uploaded NOC, view exit status.
Cannot: edit/delete team, delete/edit NOC, select/edit problem statement, approve requests.

## 28. Team Lead Permissions

Can: view/edit team, submit team edit requests, upload/view/edit/delete NOC (any team member's), select/change problem statement, view attendance, view food coupons, upload exit form.
Cannot: approve requests, assign SPOCs, modify other teams.

## 29. Team Dashboard

Primary workspace for Team Leads — quick access to: Team Profile, Members, Problem Statement, Attendance, Food Coupons, NOC, Exit Form, Notifications.

## 30–38. Problem Statement Module

- **Visibility**: not visible immediately; admin sets Release Date + Release Time; before release, participants see nothing.
- **Release**: a spreadsheet link is given for members to view problem statements (external, admin-provided link — not an in-app browsing catalog).
- **Selection**: Team Lead enters the **Problem Statement Number** (not browse-and-click); system validates the code.
- **Selection Time Window**: admin configures Selection Start / Selection End; outside this window, selection is disabled.
- **Editing**: before deadline, Team Lead may change selection any number of times — latest selection is final. After deadline, editing disabled.
- **Super Admin & SPOC Extension**: if a team misses the deadline, Super Admin/SPOC can extend the selection window **for that specific team only** (requires Duration, optional Reason). Other teams keep the original deadline.
- **Capacity**: no limit on teams per Problem Statement; multiple teams may pick the same one.
- **History**: system stores Initial Selection, every Modification, Final Selection, Time of Selection — for admin purposes.

## 39–48. NOC Module

- NOC submission mandatory for every participant; must be prominently communicated throughout the portal.
- Every participant has an **individual** NOC (no shared team NOC), managed separately.
- **Team Lead**: can Upload / View / Replace / Delete any team member's NOC.
- **Member**: can Upload / View only their own NOC — cannot Edit / Replace / Delete it. If the Team Lead deletes a member's NOC, that member can re-upload.
- **NOC Status** per participant: Not Uploaded, Uploaded, Verified (if verification introduced later), Missing.
- **Team NOC Summary** on Team Dashboard: per-member name + status (e.g. Member 1: Uploaded, Member 2: Uploaded, Member 3: Missing, Member 4: Uploaded) so Team Lead can spot pending items fast.
- **NOC Deadline**: configurable from Admin Configuration; post-deadline upload behavior follows configured policy (nothing further specified — keep configurable, don't hardcode a behavior).
- Notifications fire on: NOC Uploaded, NOC Deleted.
- NOC upload accepted only for registered participants.
- Every modification recorded in history where applicable.

## 49–56. Attendance Module

- Attendance maintained **per participant**, grouped under their team (team-level + participant-level views).
- **Sessions**: session-based; number of sessions fully configurable from Admin Configuration (example: Session 1–4) — never hardcode session count.
- **Attendance Record** fields: Attendance Session, Participant, Team, Attendance Status, Recorded By, Recorded Time.
- **Status**: Present or Absent only (no other values currently).
- **Entry**: only the assigned SPOC and Super Admin can record attendance; entered participant-wise (per team, per member, per session).
- **Modification**: only Super Admin / assigned SPOC can modify a record; every modification recorded in an audit history (Previous Status, New Status, Modified By, Modified Time) visible only to admins.
- **Attendance Dashboard** shows: Team Summary (Team Name, Present Count, Absent Count), Participant Summary (Name, User ID, Attendance Status), Session Summary (Total Present, Total Absent, Attendance Percentage per session).

## 57–62. Food Coupon Module

- Tracks meal **redemption only** — does not generate coupons.
- Meals tracked: **Lunch and Dinner only**. Breakfast is not provided and must never appear as a redeemable meal.
- **Status** per meal: Redeemed / Not Redeemed. No further workflow.
- **Recording**: only assigned SPOC and Super Admin can mark redemption; participants cannot change their own status.
- **Coupon Dashboard**: per participant — Lunch (Redeemed/Not Redeemed), Dinner (Redeemed/Not Redeemed); per team — Total Lunch Redeemed, Total Dinner Redeemed.
- **Attendance + Food Integration**: both manageable from the *same* administrative workspace so SPOCs record Attendance + Lunch + Dinner redemption together without switching modules.

## 63–67. Exit Form Module

- Used after the event concludes. The physical signed Exit Form is managed outside the portal; only the **already-signed** form is uploaded into the portal (portal is not responsible for collecting digital signatures).
- Only the **Team Lead** can upload the team's Exit Form; members cannot upload or modify it.
- **Exit Status** per team: Not Submitted, Submitted, Verified (if introduced later), Exited. Uploading updates the team's status accordingly.
- **Team Dashboard** shows: Exit Form Uploaded (bool), Exit Status.
- **Admin Dashboard** shows: Teams Pending Exit, Teams Completed Exit.

## 68–69. Super Admin

Unrestricted access, responsible for complete administration. Can: manage all users (view/manage/assign roles/change roles); manage all teams (view/edit any/delete if required/approve modifications); manage SPOCs (create/assign/reassign/remove); view+record+edit attendance; mark food redeemed/not redeemed; manage problem statements (create/edit/delete/release/hide); view+manage every NOC; view+manage all Exit Forms; access every dashboard; generate reports (Teams, Participants, Attendance, Food Coupons, NOCs, Exit Status); manage all configurable settings.

## 70–72. SPOC

Every SPOC is assigned specific teams; admin permissions apply only to those teams.

Can: view/manage assigned teams; approve Team Edit Requests (for assigned teams); record/modify attendance; record food redemption; view/manage NOCs; extend Problem Statement selection deadline (per assigned team); view Exit Forms; view Notifications.
Cannot: manage teams belonging to another SPOC; modify system-wide configuration; assign other SPOCs; create administrators.

Team assignment: every registered team assigned to exactly one SPOC, assignment performed only by Super Admin, a team belongs to only one SPOC at a time, reassignable anytime by Super Admin.

## 73–74. Approval Dashboard & Workflow

Shared approval queue for Super Admin + SPOC. Pending request types currently include Team Detail Changes (extensible for future workflow types).

Flow: Team Lead submits request → Pending → SPOC/Super Admin reviews → Approve (apply changes) OR Reject (keep existing data) → notify Team Lead.

## 75. Notifications — Administrative

Super Admin and SPOCs notified for: New Team Registration, Pending Team Edit Approval, NOC Uploads, Exit Form Uploads, Attendance Completion, Attendance Modification, Problem Statement Updates, (Problem Statement Deadline Extension Requests if introduced later).

## 76. Dashboard Metrics

**Super Admin Dashboard**: Total Registrations, Total Teams, List of Teams, List of Participants, Pending Approvals, NOC Completion, Exit Completion (if any), Food Redemption Summary.

**SPOC Dashboard**: Assigned Teams, Pending Approvals, Today's Attendance, Missing NOCs, Exit Forms Pending, Food Redemption Status.

## 77. Audit History

All administrative actions logged, e.g.: Attendance Edited, Team Edited, Team Approved, Team Rejected, NOC Deleted, Problem Statement Changed, SPOC Assignment Changed. Each log entry: User, Action, Timestamp, Previous Value (where applicable), New Value (where applicable).

## 78. Business Rules (Part 2)

Attendance is participant-wise, grouped under teams, sessions configurable; only SPOCs/Super Admin manage attendance; breakfast not tracked; Food Coupons only record redemption status; Exit Forms are physical docs uploaded post-signing; Team Leads upload Exit Forms; every team belongs to one SPOC; SPOCs only manage assigned teams; Super Admin has unrestricted access; administrative actions must be auditable.

## 79–88. Admin Configuration Module

Central control panel for everything configurable. **No event-specific values hardcoded** unless they are permanent business rules — this lets the same portal be reused for future IdeaSprint editions with minimal changes. Only Super Admin can access this module.

- **Event Configuration**: Event Name, Description, Banner, Hero Content, Homepage Announcement, Registration Status (Open/Closed), Registration Start/End Date & Time, Event Start/End Date, Grand Finale Info, Prize Info.
- **Homepage Configuration**: Hero Image, Hero Title, Event Description, Domain List, Gallery, Important Instructions, FAQs, Contact Details, Footer Info, Announcement Banner.
- **Timeline Configuration**: Round 1 Start/End, Problem Statement Release, Selection Start/End, Build Phase, Submission Deadline, Evaluation Time, Winner Announcement — portal automatically follows these configured timings.
- **Problem Statement Configuration**: Create/Edit/Delete, Assign Numbers, Release, Hide. Fields: Number, Title, Description, Status (Hidden/Released).
- **Attendance Configuration**: Number of Sessions, Session Names, Session Timings, Attendance Window — attendance automatically follows these settings.
- **Registration Configuration**: Registration Guidelines, Registration Timeline, Registration Status, Max Registration Capacity (if introduced later).
- **NOC Configuration**: NOC Submission Deadline, Accepted File Types, Maximum File Size.
- **Contact Configuration**: TMCG Contacts, MDC Contact — each Name, Designation, Phone, Email.
- **Notification Configuration**: enable/disable notifications per event type.

## Permanent business rules vs configurable content — critical separation

**Permanent (never move to config, hardcode as business logic)**: team size 3–4, one Team Lead per team, role permission matrix, university auth domain restriction, participant uniqueness rules, approval-required-for-team-edits, NOC mandatory & individually tracked, attendance Present/Absent only recorded by SPOC/Super Admin, food = Lunch+Dinner only redemption tracking, Exit Form Team-Lead-only upload, one-SPOC-per-team.

**Configurable (must live in DB/admin panel, never hardcoded in components)**: event dates & timeline, domains list, hero image/title, gallery images, FAQs, contacts, instructions/guidelines text, problem statements & their release/selection windows, prize amounts/info, attendance session count/names/timings, NOC deadline & file rules, notification toggles, registration status/dates.

## 89–91. Notification System

Auto-generated whenever important actions occur; appear inside the dashboard; architecture should allow future email notification support without reworking the flow.

**Participant notifications**: Registration Completed, Team Edit Approved, Team Edit Rejected, Problem Statements Released, Problem Statement Changed, Problem Statement Deadline Extended, NOC Uploaded, NOC Deleted, Exit Form Uploaded, Event Announcements Published.

**Administrative notifications**: New Team Registration, Pending Team Edit Approval, NOC Uploads, Exit Form Uploads, Attendance Completion, Attendance Modification, Problem Statement Updates.

## 92–93. Validation & Business Rules Summary

Team Name/ID unique; Registration Number/University Email/Mobile Number unique platform-wide; participant belongs to only one team; only `@student.gitam.edu`/`gitam.in` accounts authenticate; dashboards blocked pre-registration; Problem Statement selection only within configured window, modifiable until deadline, SPOC extension overrides deadline for that team only; every participant needs an individual NOC, members can't edit/delete their own upload, Team Leads manage all within their team; only Team Leads upload Exit Forms.

## 94. Suggested Database Entities

User (User ID, Name, Email, Mobile, Reg No, Role, Academic Year), Team (Team ID, Team Name, Team Lead, SPOC, Team Status), Team Members (user↔team mapping), Problem Statement (Number, Title, Description, Status), Problem Statement Selection (Team, Selected PS, Selection Time, Modification History), Attendance (Participant, Session, Status, Recorded By, Timestamp), Food Coupon (Participant, Lunch Status, Dinner Status), NOC (Participant, Uploaded File, Uploaded By, Upload Time), Exit Form (Team, Uploaded File, Uploaded By, Upload Time, Exit Status), Notifications (Recipient, Title, Message, Read Status, Timestamp), Approval Requests (Request Type, Requested Changes, Requested By, Status, Reviewed By, Review Timestamp), Audit Logs (User, Action, Previous Value, New Value, Timestamp), Configuration (all configurable values).

## 95. Edge Cases to Handle Gracefully

- **Registration**: duplicate team name / participant / email / registration number / mobile number.
- **Authentication**: unregistered user attempts login; non-university Google account attempts login.
- **Problem Statement**: selection attempted before release; after deadline; modification after deadline; invalid PS number entered.
- **NOC**: member uploads duplicate file; Team Lead deletes a member's NOC; member re-uploads after deletion.
- **Attendance**: modified after submission; same participant marked twice for the same session.
- **Exit Form**: team uploads multiple Exit Forms; upload attempted after event closure (behavior configurable).

## 96. Performance Requirements

~600–1000 concurrent users; responsive during peak registration; simultaneous logins across all campuses; concurrent admin operations without data inconsistency.

## 97. Security Requirements

Secure Google Auth via Supabase; role-based authorization; protection against unauthorized access; secure file uploads; audit logging of admin actions; protection of participant data; team info access restricted by role.

## 98. Future Scope (not required now, but architecture should not block these)

Email/SMS notifications, QR-based attendance & food redemption, Judge Portal, Evaluation Module, Live Leaderboard, Certificate Generation, Grand Finale Management, Analytics Dashboard, Campus Comparison Dashboard, PDF/Excel report export, Volunteer Module, Sponsor Management, Public Result Portal, API integrations.

## 99. Acceptance Criteria

Platform is functionally complete when: public website operational; team registration workflow fully functional; Google Auth restricted to university IDs; all four roles operate per defined permissions; team management functions correctly; Problem Statement workflow follows configured timelines; NOC management complete; attendance recorded participant-wise; food coupon redemption tracked; Exit Form uploads work; approval workflow operates correctly; Admin Configuration controls all configurable event settings; dashboard access is role-based; validation rules prevent inconsistent/duplicate data; audit logs capture admin activities; platform stable under expected concurrent load.
