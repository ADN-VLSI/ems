# Employee Daily Update & Reporting System (EMS)

An enterprise daily work update and reporting system for employees of ADN Semiconductor. Employees sign in using their GitHub accounts, track assigned issues and project boards, and save editable daily updates before the strict 11:30 PM cutoff. An idempotent automated workflow locks updates and dispatches individual, team, and company-wide tabular email reports through SMTP.

---

## Architecture & Cost Requirement Guarantee

The entire system is architected to operate on **100% ongoing free tiers**, with zero paid plans, zero trial-to-paid transitions, and no billing-enabled overages.

```
┌────────────────────────────────┐
│   GitHub Pages (Frontend)      │  <-- Static React + Vite + Tailwind SPA
│   (100 GB/mo free bandwidth)   │      Zero credentials / secrets in Git
└───────────────┬────────────────┘
                │ HTTPS (Bearer JWT)
                ▼
┌────────────────────────────────┐
│   Cloudflare Worker (API)      │  <-- Authenticates GitHub OAuth
│   (100,000 requests/day free)  │      Enforces 11:30 PM cutoff
└───────┬────────────────┬───────┘      Integrates GitHub App for Projects
        │                │
        │ SQL queries    │ GraphQL queries
        ▼                ▼
┌──────────────────┐  ┌──────────────────┐
│  Cloudflare D1   │  │  GitHub App      │
│  (Database)      │  │  (Issues/Proj)   │
│  (5M reads/day)  │  │  (Read-only)     │
└──────────────────┘  └──────────────────┘
        ▲
        │ Idempotent lock & batch retrieve
        │ POST /api/reports/daily/prepare
        │
┌────────────────────────────────┐
│ Scheduled GitHub Actions Cron  │  <-- Runs daily at 11:35 PM Asia/Dhaka
│ (Free runner minutes)          │      Retrieves locked updates
└───────────────┬────────────────┘      Dispatches via SMTP
                │
                │ SMTP with SSL / TLS
                ▼
┌────────────────────────────────┐
│   Free-Tier SMTP Service       │  <-- Brevo / Gmail SMTP / Resend
│   (300–500 emails/day free)    │      1. Employee copy
└────────────────────────────────┘      2. Manager team-by-team report
                                        3. Company-wide report
```

### Provider Free-Tier Limits & Behavior

| Service                | Free Tier Limit                                     | Expected Daily Volume      | Behavior at Limit                       |
| :--------------------- | :-------------------------------------------------- | :------------------------- | :-------------------------------------- |
| **GitHub Pages**       | 100 GB/month bandwidth                              | &lt; 2 GB / month          | HTTP 429; no automatic charges          |
| **Cloudflare Workers** | 100,000 requests / day                              | ~500–1,500 req / day       | HTTP 429 (quota error); no paid overage |
| **Cloudflare D1**      | 5,000,000 read rows / day, 100,000 write rows / day | &lt; 10,000 reads / day    | Rejects excess writes safely with error |
| **GitHub Actions**     | 2,000 min/mo (public repos unlimited)               | ~5 min / day (~150 min/mo) | Workflow pauses safely                  |
| **SMTP Service**       | Brevo: 300/day, Gmail: 500/day                      | 20–80 emails / day         | Safe queue pause / retry                |

---

## Directory Organization

```text
├── frontend/             # Static SPA deployed to GitHub Pages (React + Vite + Tailwind)
│   ├── src/
│   │   ├── components/   # DeadlineBanner, UpdateForm, AssignedIssues, TeamOverview, etc.
│   │   ├── api.ts        # Cloudflare Worker API client
│   │   └── App.tsx       # State coordination and tab navigation
│   └── vite.config.ts    # Configured for GitHub Pages relative asset paths
├── backend/
│   └── api/              # Cloudflare Worker API & D1 integration
│       ├── schema.sql    # D1 SQLite database tables & indices
│       ├── src/
│       │   ├── auth.ts       # GitHub OAuth exchange & HMAC-SHA256 JWT
│       │   ├── githubApp.ts  # GitHub App RS256 token & GraphQL Project items
│       │   ├── reports.ts    # Update locking, tabular HTML formatter, idempotency
│       │   └── index.ts      # Cloudflare Worker router & endpoints
│       └── wrangler.toml # Worker and D1 bindings
├── shared/               # Shared TypeScript types and validation
│   ├── types.ts          # Core domain models (Employee, DailyUpdate, Issue, etc.)
│   └── validation.ts     # 11:30 PM cutoff calculation & bullet validation
├── .github/
│   ├── workflows/
│   │   ├── daily-report.yml  # Scheduled report trigger (17:35 UTC = 23:35 Asia/Dhaka)
│   │   └── deploy-pages.yml  # Automatic GitHub Pages frontend deployment
│   └── scripts/
│       └── send-daily-reports.mjs # Nodemailer dispatcher with idempotency auditing
├── .env.example          # Template for all environment variables & secrets
└── README.md
```

---

## Daily Update Workflow & Deadline Cutoff

New GitHub accounts are created with pending access and cannot use the portal until an administrator approves them in **Manage User Profiles**. Existing employee accounts remain approved.

1. **Daily Update Window:**
   - Employees can create, edit, and save drafts of their daily updates up until **11:30 PM (Asia/Dhaka)**. No separate submission is required; the scheduled report includes the latest saved draft.
   - The UI shows a real-time countdown timer to the deadline.
2. **Cutoff Enforcement:**
   - At **11:30 PM**, updates for the day are strictly locked by the backend (`daily_updates.status = 'locked'`).
   - The backend enforces the deadline independently of frontend status. Any late `POST /api/updates/today` returns `403 Forbidden`.
3. **Next-Day Updates:**
   - Once reports are locked and dispatched, the system advances to the next date and opens a fresh update.

### Required Form Sections

Each daily update must include:

- **Today's Tasks:** Planned core tasks and deliverables worked on today (Required).
- **Sudden Tasks:** Urgent requests, unexpected bugs, or ad-hoc meetings.
- **Blockers:** Impediments, dependencies, or waiting on external partners.
- **Plans Going Forward:** Key priorities planned for tomorrow.

Employees can add, reorder, and remove multiple bullet points under each section.

---

## Assigned GitHub Issues & Project Boards

When GitHub App credentials are configured, the system connects to GitHub via a read-only GitHub App:

- Retrieves open issues assigned to the signed-in employee's GitHub username.
- Queries GitHub Projects (v2) tracking boards, displaying project titles (e.g. _EMS Sprint Board_) and statuses (e.g. _In Progress_, _Review_).
- An issue can belong to multiple tracking boards; all associated boards are displayed.
- **1-Click Integration:** Employees can click `+ Today's Task` or `+ Plan` directly on any issue card to immediately append it to their update form!
- Zero personal access tokens (PATs) are requested from employees.
- The issue panel links directly to [ADN-VLSI open issues assigned to you](https://github.com/issues/assigned?q=is%3Aissue+state%3Aopen+archived%3Afalse+assignee%3A%40me+sort%3Aupdated-desc+org%3AADN-VLSI). If the GitHub App issue sync is unavailable, the panel does not display fabricated demo issues.
- Without those App credentials, employees can still open their live assigned issue list on GitHub; issue cards and project-board details are unavailable in EMS.

---

## Daily Email Reports & Tabular Structure

At **11:35 PM Asia/Dhaka** (5 minutes after cutoff), the scheduled GitHub Actions workflow triggers the dispatcher:

1. **Individual Employee Copy:** Sent to each employee with a copy of their saved daily update.
2. **Manager Team Report:** Combined tabular report sent to the team manager.
3. **Company-Wide Leadership Report:** Sent to:
   - **To:** `foez.ahmed@adnsemicon.com`
   - **CC:** `mohiuddin.reyad@adnsemicon.com`, `farhan.efty@adnsemicon.com`

Individual copies are sent to each employee's official email when configured, with their GitHub/personal email as fallback. The sole administrator, GitHub account [@foez-ahmed](https://github.com/foez-ahmed), can manage employee names, official emails, reporting managers, and employee/manager roles from the **Manage Users** tab. Selecting a manager automatically creates or assigns the employee to that manager's team; nightly combined team reports are sent to the manager's official email, or personal email when no official email is configured. Admin access cannot be assigned to another account.

### Combined Report Table Structure

| Name            | GitHub ID    | Today's Tasks                      | Sudden Tasks                | Blockers                    | Plans Going Forward          |
| :-------------- | :----------- | :--------------------------------- | :-------------------------- | :-------------------------- | :--------------------------- |
| Mohiuddin Reyad | @reyad07     | • Verified floorplan power margins | • Emergency DRC deck review | _None_                      | • Run full tape-out sign-off |
| Farhan Efty     | @farhan-efty | • Finished RTL synthesis for ALU   | • CTS skew debug            | • Waiting on IO pad library | • Placement optimization     |
| Foez Ahmed      | @foez-ahmed  | • Built daily report pipeline      | • Resolved CORS preflight   | _None_                      | • Monitor 11:35 PM dispatch  |

### Idempotency Guarantee

- Every dispatched report is recorded in the `report_deliveries` table in Cloudflare D1 with `(date, report_type, recipient_email)`.
- If a workflow run is retried or re-executed, any report already marked as `sent` is automatically skipped. Duplicate emails can never be sent.

---

## Setup & Deployment Guide

### 1. Configure Cloudflare Worker & D1 Database

```bash
# 1. Navigate to worker directory
cd backend/api

# 2. Login to Cloudflare (Free Account)
npx wrangler login

# 3. Create Cloudflare D1 Database
npx wrangler d1 create ems-db

# 4. Copy the database_id from the output into wrangler.toml:
# database_id = "<your-d1-database-id>"

# 5. Initialize the database schema
npx wrangler d1 execute ems-db --remote --file=./schema.sql

# For databases created before the approval feature, apply its migration once:
# npx wrangler d1 execute ems-db --remote --file=./migrations/0003_employee_approval.sql

# 6. Set worker secrets
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put JWT_SECRET
npx wrangler secret put REPORT_API_KEY
npx wrangler secret put GITHUB_APP_ID              # (Optional for issue sync)
npx wrangler secret put GITHUB_APP_INSTALLATION_ID # (Optional for issue sync)
npx wrangler secret put GITHUB_APP_PRIVATE_KEY     # (Optional for issue sync)

# 7. Deploy worker to free tier
npx wrangler deploy
```

### 2. Configure GitHub Repository Secrets

In your GitHub repository, navigate to **Settings > Secrets and variables > Actions** and add:

| Secret Name       | Description                                      | Example                                            |
| :---------------- | :----------------------------------------------- | :------------------------------------------------- |
| `BACKEND_API_URL` | URL of deployed Cloudflare Worker                | `https://ems-worker-api.yoursubdomain.workers.dev` |
| `REPORT_API_KEY`  | Same key configured in Cloudflare Worker secrets | `strong_random_secret_string`                      |
| `SMTP_HOST`       | Free SMTP host                                   | `smtp-relay.brevo.com` or `smtp.gmail.com`         |
| `SMTP_PORT`       | SMTP port                                        | `587`                                              |
| `SMTP_USER`       | SMTP username                                    | `your-smtp-account@domain.com`                     |
| `SMTP_PASS`       | SMTP password / app password                     | `your_smtp_app_password`                           |
| `SMTP_FROM`       | Sender display name & email                      | `EMS Updates <updates@adnsemicon.com>`             |
| `VITE_API_URL`    | Worker API URL for frontend build                | `https://ems-worker-api.yoursubdomain.workers.dev` |

### 3. Deploy Frontend to GitHub Pages

1. Navigate to **Settings > Pages** in your GitHub repository.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. Push to `main` branch; the `.github/workflows/deploy-pages.yml` workflow will automatically build and publish the frontend to `https://<org>.github.io/<repo>/`.

---

## Local Development

```bash
# Run unit tests
npx tsx shared/test-runner.mjs

# Start frontend dev server (http://localhost:5173)
cd frontend
npm install
npm run dev

# Start worker dev server (http://localhost:8787)
cd ../backend/api
npm install
npm run dev
```

During local development, you can use the **Dev Sign-In** button on the login screen to sign in as any employee without needing to register OAuth applications.
