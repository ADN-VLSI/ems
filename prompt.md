## Prompt: Build a production-ready Employee Management System

Act as a senior product designer, frontend engineer, Firebase architect, and security engineer. Design and implement a production-ready Employee Management System (EMS) as a responsive web application.

Before writing code, briefly state:

1. The proposed architecture, technology choices, Firebase services, and folder structure.
2. Any assumptions you must make, along with important trade-offs.
3. The data model and Firestore security strategy.
4. The implementation phases and the tests you will use to verify each phase.

Ask only questions that block a secure or correct implementation. Otherwise, make sensible assumptions, document them, and continue.

## Platform and deployment

- The application must be deployable as a static single-page application on GitHub Pages.
- Use Google Firebase as the backend. Prefer Firebase Authentication, Cloud Firestore, Cloud Storage, Cloud Functions, and Firebase Cloud Messaging where appropriate.
- Do not put Firebase Admin SDK credentials, private keys, GitHub client secrets, or other sensitive credentials in the frontend or repository.
- Include GitHub Pages deployment instructions and environment-variable configuration. Account for SPA routing and refresh behavior on GitHub Pages.
- Use a maintainable, typed, component-based frontend architecture and a clear separation between UI, domain logic, Firebase access, and GitHub integration.

## Authentication and authorization

- Users may register and sign in only with their GitHub profile using Firebase Authentication and GitHub OAuth.
- The initial administrator is the GitHub account `foez-ahmed`.
- A newly registered user must have a `pending` status and must not access EMS data or features until approved by the administrator.
- The administrator can approve, reject, suspend, reactivate, and remove users. The UI must clearly show the status and next action for pending or suspended users.
- Implement role-based access control with, at minimum, `administrator`, `manager`, and `employee` roles. Define permissions explicitly and make them easy to extend.
- Enforce authorization in Firestore and Cloud Functions security rules, not only in the UI. Prevent users from reading or modifying records they are not authorized to access.
- Protect administrator operations, validate all writes, and record security-sensitive actions in an immutable audit log.

## Core functionality

### Calendar, tasks, and reminders

- Create, edit, view, delete, search, and filter events and tasks.
- Support meetings, deadlines, event categories, descriptions, attendees, status, priority, date/time, time zone, and recurring events.
- Link events and tasks to GitHub projects, issues, and pull requests. Display useful GitHub metadata and handle unavailable or deleted GitHub resources gracefully.
- Support date/time-based reminders, in-app notifications, and notification preferences.
- Support import and export using a documented format such as iCalendar/ICS and CSV where appropriate.
- Handle recurring-event updates and deletion without corrupting the original series.

### User management

- Provide administrator screens for user approval, roles, permissions, profiles, status, and activity history.
- Allow users to manage permitted profile fields and notification preferences.
- Track meaningful user activity without collecting unnecessary personal data.
- Make loading, empty, error, unauthorized, and offline states clear and recoverable.

### Notifications and alerts

- Notify users about approvals, role or status changes, assignments, event reminders, leave decisions, messages, and other relevant activity.
- Include read/unread state, timestamps, deep links to the related item, filtering, and a way to mark notifications read.
- Do not claim browser or email delivery unless the required Firebase or third-party service is actually configured.

### Attendance and leave management

- Record attendance with date, user, status, and optional notes, subject to role permissions.
- Support leave requests, approval or rejection workflows, comments, leave types, leave balances, and configurable policies.
- Prevent unauthorized changes and preserve an audit trail for edits and approvals.
- Provide attendance and leave reports with date, user, department or team where applicable, status, and export options.

### Reporting and analytics

- Provide administrator and manager dashboards appropriate to their permissions.
- Include user activity reports, attendance and leave summaries, system usage statistics, and exportable reports.
- Use privacy-conscious aggregation and avoid exposing sensitive information to unauthorized users.

### System settings and administration

- Provide administrator-only settings for configuration, access control, event categories, leave policies, notification preferences, and other system options.
- Provide searchable audit logs with actor, action, target, timestamp, and relevant metadata.
- Explain what backup, restore, update, and maintenance operations are supported by Firebase. Do not present an unimplemented feature as functional; provide a documented operational procedure or a disabled state instead.

### Messaging

- Support permission-aware direct messages and group chats.
- Include message notifications, timestamps, unread counts, search, filtering, pagination, and a clear empty state.
- Apply appropriate privacy rules so users can access only conversations in which they participate or that their role permits.
- Consider edit/delete policy, abuse prevention, and audit requirements before implementing message mutation features.

## UX and UI requirements

- Create a professional, accessible, responsive interface for desktop, tablet, and mobile.
- Use a consistent navigation structure, clear role-aware dashboards, readable data tables, useful filters, confirmation dialogs for destructive actions, and keyboard-accessible controls.
- Include loading, empty, error, permission-denied, offline, and success states throughout the application.
- Meet WCAG 2.1 AA basics: semantic HTML, keyboard navigation, visible focus, sufficient contrast, labels, and accessible status messages.
- Use realistic seed/demo data only when it cannot be confused with production data. Do not expose secrets or personally identifiable data in demo content.

### ADN Semiconductors visual identity

The EMS must visually belong to ADN Semiconductors. Use https://adnsemicon.com/ as the primary visual reference and inspect the live site before implementing the interface. Match its current brand language rather than creating a generic dashboard:

- Preserve the site's engineering-led, precise, premium, and technically confident character.
- Use the same overall color direction, typography hierarchy, spacing rhythm, border treatment, button language, navigation behavior, and image treatment as the reference site. Treat the live site's CSS and assets as the source of truth for exact values.
- Carry the reference site's high-contrast presentation, strong editorial headings, concise supporting copy, structured content sections, and technical semiconductor imagery into the EMS experience.
- Use relevant ADN/semiconductor visual details for the authenticated application, such as subtle circuit or silicon imagery, only where they support orientation and do not reduce readability or performance.
- Adapt the public site's navigation into a compact application shell with a role-aware sidebar or top navigation, breadcrumbs where useful, and a clear active-state treatment. Do not copy marketing hero sections into operational screens.
- Keep dashboards information-dense and practical while retaining ADN's visual polish. Favor clear hierarchy, generous whitespace, strong alignment, restrained decoration, and purposeful motion.
- Do not invent a competing brand palette, use a generic purple SaaS theme, or rely on placeholder graphics when an appropriate ADN asset or treatment is available.
- Do not reproduce the reference site's text, layout, or imagery in a way that misrepresents the EMS as the public marketing website. Reuse brand assets only when permitted and document any required asset attribution or licensing.
- Verify the result at desktop and mobile widths against the reference site and ensure that tables, calendars, forms, charts, messaging, and navigation remain usable at every width.

## Engineering and security requirements

- Use strict validation at the UI and backend boundaries, with clear user-facing error messages.
- Design Firestore collections, indexes, query patterns, retention expectations, and cost considerations before implementation.
- Use Cloud Functions for privileged or scheduled work, such as recurring reminders, GitHub synchronization, notification fan-out, and audit-sensitive operations.
- Handle GitHub OAuth scopes, API rate limits, pagination, revoked access, missing resources, and API failures gracefully.
- Add automated tests for authentication states, approval gating, role permissions, critical workflows, validation, and Firestore security rules.
- Include a README covering local setup, Firebase project configuration, GitHub OAuth setup, required indexes, deployment, environment variables, security considerations, and known limitations.

## Deliverables and acceptance criteria

Provide:

1. The complete source code and project structure.
2. Firebase configuration, security rules, indexes, Cloud Functions, and data-model documentation where required.
3. A polished responsive UI implementing the workflows above.
4. Tests and clear commands for linting, type-checking, testing, building, and deploying.
5. A concise list of implemented features, assumptions, known limitations, and future improvements.

The solution is acceptable only if:

- An unapproved GitHub user can register but cannot access protected EMS data or features.
- The `foez-ahmed` GitHub account is recognized as the initial administrator without relying on a client-side-only check.
- Every role restriction is enforced server-side and covered by tests.
- Core calendar, user approval, attendance/leave, notifications, reporting, settings, audit, and messaging flows work end to end.
- The application builds successfully for GitHub Pages and does not require a private backend server to render the frontend.
- Failures, empty states, loading states, and unsupported operational features are handled honestly and clearly.

