# ADN Employee Portal

A responsive employee portal built with React, TypeScript, Vite, Firebase Authentication, and Cloud Firestore. It is configured for GitHub Pages at `https://adn-vlsi.github.io/ems/`.

## Features

- Google sign-in and employee account registration.
- New employees stay pending until the ADN administrator (`adn.semicon@gmail.com`) approves them.
- Approved employees can submit leave requests and view their decisions.
- Employees can view attendance; only the administrator can add or change attendance records.
- Approved employees can view their own profile details in the My profile section, including phone, GitHub ID, and track records.
- Administrators can edit employee display names and leave requests, and can edit or delete leave and attendance records. Deleting an employee profile also deletes their associated leave and attendance records, but does not delete their Google sign-in account.
- The notice board appears first in the overview and has its own navigation section. Administrators can publish and manage notices there. Employee profiles include editable display name, GitHub ID, track records, and phone details.
- Firestore security rules enforce these permissions independently of the UI.

## Daily updates

Approved employees open **Daily update** and fill four bullet-point sections: Today's Tasks, Sudden Tasks, Blockers, and Plans Going Forward. They can submit, edit, or remove updates for the current reporting day until 11:30 PM Asia/Dhaka (enforced by Firestore rules). At 11:30 PM the `.github/workflows/daily-updates.yml` workflow runs `scripts/send-daily-updates.mjs`, which emails that day's updates (plus employees who didn't submit) to `info@adnsemicon.com` and sends each submitting employee a private copy of their own update. It deletes the `dailyUpdates` documents only after all emails are accepted. Only then does the next calendar day's reporting window open; it remains open until 11:30 PM. If sending fails, submissions remain closed and the workflow can be re-run manually.

Add these GitHub repository secrets (**Settings → Secrets and variables → Actions**):

- `FIREBASE_SERVICE_ACCOUNT`: the full contents of a downloaded Firebase service-account JSON key (Project settings → Service accounts → Generate new private key). Do not enter only the service-account email, project ID, or key filename.
- `SMTP_HOST`, `SMTP_PORT` (465 or 587), `SMTP_USER`, `SMTP_PASS`, and optional `SMTP_FROM`.

Then deploy the updated rules (`npx firebase-tools deploy --only firestore:rules`). GitHub cron can start a few minutes late.

## Local development

Requirements: Node.js 22+ and npm.

Run the helper script to install dependencies if needed and start the local development server:

```sh
python run_local.py
```

The portal opens at `http://localhost:5173/`. Stop the server with Ctrl+C.

Alternatively, start it manually:

```sh
npm ci
npm run dev
```

The Firebase web configuration is in `src/firebase.ts`. Firebase web API keys and app IDs are public client configuration; authorization must remain enforced by Firebase Authentication and Firestore rules.

## Firebase setup

The Firebase project is `adn-employee-management-system`. It is configured for this portal:

- Google sign-in is enabled.
- `adn-vlsi.github.io` and `localhost` are authorized sign-in domains.
- The Firestore security rules are published. The two composite indexes are created and may take a few minutes to finish building.

To publish later changes to Firestore rules or indexes, use an authenticated terminal with Firebase CLI:

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project adn-employee-management-system
```

The administrator account is `adn.semicon@gmail.com`.

Google sign-in accepts Google accounts. A new account creates a Firestore profile with `pending` status; it cannot submit leave or read attendance until approved. Only the verified administrator email can approve employees, review leave, or write attendance.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys on pushes to `main`.

1. In the GitHub repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
2. Push to `main`, or run **Deploy to GitHub Pages** from the Actions tab.
3. The Vite build detects the repository name in GitHub Actions and sets the project-site base path automatically.

The deployed site will be available at `https://adn-vlsi.github.io/ems/`.

## Data model

- `users/{uid}`: verified email, display name, GitHub ID, track records, phone, and admin-controlled approval status.
- `leaveRequests/{requestId}`: employee-owned submissions and admin-controlled decisions.
- `attendance/{uid_YYYY-MM-DD}`: daily status entered by the administrator.
- `notices/{noticeId}`: announcements published and managed by the administrator.
- `dailyUpdates/{uid}`: the employee's current-day update; emailed and deleted at 11:30 PM.

Attendance is intentionally not a clock-in system: employees cannot create or modify attendance records.
