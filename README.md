# ADN EMS

A responsive Employee Management System for ADN Semiconductors. The frontend is a static Vite + React + TypeScript SPA designed for GitHub Pages, with Firebase Authentication, Firestore, Storage, and Functions as the backend boundary.

## Current release

- ADN-inspired operational shell with responsive mobile navigation
- Role-aware navigation model for administrator, manager, and employee
- Interactive overview: capacity, people, requests, schedule, activity, allocation, and attendance check-in
- Calendar, people, attendance, leave, messages, reports, and settings module states with search affordance
- Administrator teammate invitation dialog with pending-account messaging
- Firebase client boundary that stays inert until environment variables are present
- Firestore rules for approval gating, self-profile updates, role checks, and immutable client-side audit logs

The module views are intentionally honest placeholders until Firebase data services and Cloud Functions are configured. Demo metrics are static and must not be treated as production records.

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set the Firebase values in `.env.local`. Frontend Firebase configuration is not a secret; OAuth client secrets and Admin SDK credentials must never be placed in this repository. Enable GitHub as an Authentication provider in Firebase, register the Firebase auth-domain callback, and configure the GitHub OAuth app with the Firebase callback URL. The GitHub username `foez-ahmed` should be promoted by a trusted Cloud Function on first profile creation, never by a client-only check.

## Verification

```bash
npm run lint
npm run build
npm run preview
```

Rules and indexes are in `firestore.rules` and `firestore.indexes.json`. Deploy them with the Firebase CLI after selecting the correct project:

```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore,hosting
```

## Data model and security

Core collections are `users`, `events`, `tasks`, `projects`, `attendance`, `leaveRequests`, `notifications`, `conversations`, `messages`, and `auditLogs`. User documents contain `githubLogin`, `status`, `role`, team metadata, and notification preferences. Dates use Firestore `Timestamp`; recurring events should use an immutable series id plus exception documents. Audit entries are written only by trusted Cloud Functions and include actor, action, target, createdAt, and relevant metadata.

Firestore rules require an authenticated user document with `status == active` before protected reads. Role-sensitive mutations such as approval, suspension, leave decisions, recurring reminder fan-out, GitHub synchronization, and audit writes belong in callable or scheduled Cloud Functions. Storage rules should follow the same profile gate and limit file size/content type.

## Delivery phases

1. **Foundation:** auth provider, profile creation, pending gate, role claims/profile rules, and rules emulator tests.
2. **Operations:** events/tasks, recurring-series exceptions, attendance, leave workflow, and notification preferences.
3. **Collaboration:** GitHub sync via Functions, conversations/messages, FCM token registration, and pagination.
4. **Governance:** reports, exports, audit search, retention policy, and operational backup documentation.
5. **Release:** accessibility checks, mobile/desktop browser tests, rules tests, build, and GitHub Pages deployment.

Firebase scheduled exports and point-in-time restore are operational responsibilities of the Firebase project. No backup or restore button is presented in this UI because it is not implemented.

## GitHub Pages

Set the Vite `base` option to the repository name when deploying under `https://USER.github.io/REPOSITORY/`, or keep `/` for a custom domain. A GitHub Actions workflow should build with the Firebase environment variables stored as repository secrets and publish `dist`. Hosting rewrites are included in `firebase.json`; GitHub Pages needs a static SPA fallback (for example, copying `dist/index.html` to `dist/404.html`) if browser refreshes must resolve to the app route.
