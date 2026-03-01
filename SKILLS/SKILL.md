---

name: "BDM Reminder \& AI Communications Platform"

description: "Web (mobile-friendly) platform for BDMs to manage account/program reminders in a calendar with email alerts, AI-generated email communications (Subject+Body), customer knowledge profiles, token budget governance, and Director/Admin oversight."

---



\## 1. Overview



\### General objective

Provide a mobile-friendly web application (English-only UI) where BMs manage reminders per Account/Program, receive email alerts, and generate AI-assisted customer communications with full traceability and managerial KPIs.



\### Specific objectives

\- Manage Accounts, Programs (including Program = “N/A”), and BDM assignments (including shared accounts by program).

\- Allow BDMs to create/edit single and recurring reminders in a calendar.

\- Send email alerts 7 days before, 1 day before, and when overdue (if still Open).

\- Generate AI-assisted communications (Subject + Body) in English using templates + customer profile + tone.

\- Enforce monthly token budgets per BDM and per Director; alert Admin when exceeded.

\- Store customer knowledge (structured fields + PDF/Word attachments), build a Customer Profile, and allow manual refresh.

\- Track credit limit and debt (current values), including bulk upload.

\- Provide dashboards for BDM (per account/program) and Director (team KPIs), plus Excel export (1-year calendar summary).



\### Problem it solves

BDMs miss or postpone customer follow-ups and produce inconsistent communications. The platform centralizes reminders, automates alerting, standardizes communications via templates and AI, and provides traceability and managerial control.



\### Target users

\- \*\*BDM (Seller):\*\* create/manage reminders; generate communications; complete reminders; manage notes and contact details.

\- \*\*Commercial Director:\*\* oversee all BDM activity with KPIs; export; run AI team diagnosis within budget.

\- \*\*Admin:\*\* configure and govern the system (accounts/programs/assignments/types/templates/custom fields/budgets/branding). Only role allowed to delete.



---



\## 2. Approved architecture



\### Selected stack

\- \*\*Frontend:\*\* Next.js + TypeScript (English-only UI), Tailwind CSS, i18n scaffolding (EN only)

\- \*\*Backend:\*\* FastAPI (Python) + Pydantic + SQLAlchemy (or equivalent)

\- \*\*Database:\*\* PostgreSQL (recommended; supports relational model + JSONB for custom fields)

\- \*\*Jobs/Queue:\*\* Redis + worker service (recommended)

\- \*\*File storage:\*\* S3-compatible (PDF/Word attachments)

\- \*\*Email provider:\*\* SES or SendGrid (configurable)

\- \*\*Secrets/Encryption:\*\* AWS Secrets Manager + KMS (API keys encrypted at rest; never displayed back)



\### Justification (summary)

\- Next.js for modern responsive dashboards and calendar UX.

\- FastAPI for rapid, clean API development and AI orchestration.

\- ECS/Fargate for managed container scaling and simplified operations.

\- PostgreSQL for strong relational consistency + reporting/KPIs.



\### 3-layer architecture (clean separation)

1\) \*\*Presentation Layer (Next.js)\*\*

&nbsp;  - BDM dashboard, calendar, reminder details, AI generation UI

&nbsp;  - Director dashboard + KPIs + export + AI diagnosis

&nbsp;  - Admin console (master data, templates, custom fields, budgets, branding)



2\) \*\*Business Logic Layer (FastAPI use-cases)\*\*

&nbsp;  - Auth (email/password + 2FA), RBAC (Admin/BDM/Director)

&nbsp;  - Accounts/Programs/Assignments

&nbsp;  - Reminders (single + recurring), statuses, edit history indicators

&nbsp;  - Email alert scheduling and dispatch

&nbsp;  - Templates + LLM orchestration (tone, no-hallucination rules)

&nbsp;  - Token metering + monthly budgets + admin alerts

&nbsp;  - Customer profile build/refresh

&nbsp;  - Credit/debt and bulk upload

&nbsp;  - Audit/interaction logs (all user actions)



3\) \*\*Data Access Layer (repositories/adapters)\*\*

&nbsp;  - PostgreSQL repositories (including audit logs)

&nbsp;  - Redis queue adapters (jobs)

&nbsp;  - S3 adapters (documents)

&nbsp;  - Email provider adapter

&nbsp;  - LLM provider adapter

&nbsp;  - Secrets adapter (API key retrieval/decryption)



---



\## 3. Approved visual definition



\### Selected style

\*\*Modern SaaS Blue\*\* aligned to the provided reference (clean white/off-white layout, large whitespace, minimal header, green accents).



\### Color guidelines

\*\*Day mode\*\*

\- Background: `#FAF9F7`

\- Surface: `#FFFFFF`

\- Text: `#1C1D1D`, secondary `#5E6060`

\- Border: `#E7E5E4`

\- Brand accent (green): `#94AA20`

\- Primary action blue: `#2563EB`



\*\*Night mode\*\*

\- Background: `#0B1220`

\- Surface: `#111A2E`

\- Text: `#F3F4F6`, secondary `#CBD5E1`

\- Border: `#22304A`

\- Brand accent green: `#B3C270`

\- Action blue: `#60A5FA`



\### Typography

\- Primary font: \*\*Inter\*\* (headings SemiBold, body Regular)



\### Day/Night behavior

\- Consistent tokens across modes; AA contrast; visible focus states.



\### Responsive rules

\- Mobile-first navigation (bottom nav) + desktop sidebar/header.

\- Touch targets ≥ 44px; minimum font 14–16px.

\- UI text and menus must be \*\*English-only\*\*.



\### Branding module (Admin)

\- Admin can upload \*\*Logo\*\* (SVG/PNG; optional light/dark variants) and \*\*Favicon\*\* (PNG/ICO).

\- Branding must reflect immediately in header/tab across the app.



---



\## 4. Phase structure (incremental delivery)



\### Phase 1 — Foundation + Security + UI Shell

\- \*\*Objective:\*\* runnable baseline with auth, RBAC, 2FA, English UI, and branding.

\- \*\*Deliverables:\*\* login + 2FA, role gating, base layout, day/night, Admin branding (logo/favicon), containerized dev environment.

\- \*\*Acceptance criteria:\*\* auth+2FA works in containers; RBAC enforced; UI English; branding configurable.



\### Phase 2 — Admin Master Data (Accounts/Programs/Assignments/Contacts/Custom Fields)

\- \*\*Objective:\*\* master data and governance foundation.

\- \*\*Deliverables:\*\* CRUD Account/Program; assignment supports Program “N/A”; contact fields (Primary Contact + Email + Decision Maker); Admin defines reminder types and custom field definitions; BDM can edit contact info (logged).

\- \*\*Acceptance criteria:\*\* shared accounts by program supported; all edits logged.



\### Phase 3 — Reminders + Calendar Core + Logging

\- \*\*Objective:\*\* core reminder lifecycle.

\- \*\*Deliverables:\*\* calendar view; create/edit reminders (title/type/date/notes/status); recurring series; edit count indicator + history; BDM dashboard (open/completed/overdue); audit log per action.

\- \*\*Acceptance criteria:\*\* recurrence correct; timezone correct; “Edited X times” visible; logs complete.



\### Phase 4 — Email Alerts Engine (Jobs + Provider)

\- \*\*Objective:\*\* automated email alerts.

\- \*\*Deliverables:\*\* scheduler/worker; rules (7-day, 1-day, overdue); provider integration; retries + logging.

\- \*\*Acceptance criteria:\*\* no duplicates; stops after completion; failures logged/retried.



\### Phase 5 — Templates + LLM + Budgets/Tokens + Traceability

\- \*\*Objective:\*\* generate communications with governance.

\- \*\*Deliverables:\*\* template builder (drag/drop variables); tone selector; LLM integration returns Subject+Body; “PLEASE DEFINE IT” rule; token metering by BDM \& account; monthly budgets (BDM + Director); admin email alerts when exceeded; attach generated message to reminder completion.

\- \*\*Acceptance criteria:\*\* no hallucinations; budgets enforced; full traceability.



\### Phase 6 — Knowledge Base + Customer Profile (Build/Refresh)

\- \*\*Objective:\*\* customer-aware generation.

\- \*\*Deliverables:\*\* upload PDF/Word; structured fields (website, main email, industry, type, observations, additional custom); profile build once + manual refresh by Admin; prompt uses current profile; when BDM adds notes, system asks to refresh profile.

\- \*\*Acceptance criteria:\*\* profile versioning; correct permissions; stable prompt behavior.



\### Phase 7 — Credit/Debt + Bulk Upload

\- \*\*Objective:\*\* financial visibility per assignment.

\- \*\*Deliverables:\*\* credit limit + debt (current only); dashboard display; bulk upload (BDM, Account, Program, Contact, email, credit limit, debt) with validation report.

\- \*\*Acceptance criteria:\*\* import safe and idempotent; dashboards reflect latest values.



\### Phase 8 — Director Module + KPIs + Export + AI Diagnosis

\- \*\*Objective:\*\* team oversight and reporting.

\- \*\*Deliverables:\*\* KPIs (% on-time completed, overdue pending, completed by type, activity by account/program, messages/tokens by BDM/account); Excel export (1-year calendar summary); AI diagnosis button (consumes Director budget) + logged.

\- \*\*Acceptance criteria:\*\* KPI accuracy verified; export correct; diagnosis respects budget and logs usage.



---



\## 5. Development rules

\- Incremental development with \*\*MVP per phase\*\*.

\- Do \*\*not\*\* start a new phase without explicit user validation.

\- Strict Git flow:

&nbsp; - branches: `main` (protected) and `develop`

&nbsp; - \*\*never\*\* develop directly on `main`

&nbsp; - PRs into `develop`, then release to `main` when a phase is accepted.



---



\## 6. Testing and non-regression

\- Each phase adds tests; \*\*never remove previous tests\*\*.

\- Required per phase:

&nbsp; - unit tests (backend services/use-cases; frontend key components where feasible)

&nbsp; - integration tests for critical APIs and jobs

&nbsp; - run tests inside containers

\- Phase close gate: all tests pass + functional validation + docs updated.



---



\## 7. Containers and execution



\### Mandatory containerization

\- Use Docker for local dev parity and ECS/Fargate production parity.



\### Startup command (must)

A single command/script must:

\- stop previous services and remove orphans

\- clean zombie processes (if applicable)

\- free ports used by the app (e.g., 3000/8000/5432/6379)

\- start frontend, backend, worker, database, redis



\*\*Suggested\*\*

\- `./scripts/dev-up.sh` or `make up`



\### Shutdown command (must)

A single command/script must:

\- stop all services

\- release ports/resources

\- remove orphans



\*\*Suggested\*\*

\- `./scripts/dev-down.sh` or `make down`



---



\## 8. Change governance

Any change after a phase is approved requires:

\- Impact analysis on:

&nbsp; - implemented functionality

&nbsp; - architecture

&nbsp; - tests

&nbsp; - documentation

&nbsp; - future phases

\- Change classification:

&nbsp; - \*\*Minor\*\* (localized, low-risk)

&nbsp; - \*\*Moderate\*\* (multiple modules affected)

&nbsp; - \*\*Major\*\* (architecture/data model changes)

\- Mandatory updates:

&nbsp; - adjust tests (accumulative)

&nbsp; - update user + technical docs

&nbsp; - update phase plan if scope changes

