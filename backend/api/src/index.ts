import { Env, UserSessionPayload } from './types';
import { getCorsHeaders, jsonResponse, errorResponse, checkPayloadLimit } from './utils';
import {
  authenticateRequest,
  signJwt,
  exchangeGitHubCode,
  fetchGitHubUser,
  upsertEmployee,
  ADMIN_GITHUB_USERNAME,
} from './auth';
import { fetchAssignedIssues } from './githubApp';
import { prepareDailyReports, recordReportDelivery } from './reports';
import {
  getDeadlineStatus,
  validateUpdateSections,
  DEFAULT_APP_TIMEZONE,
} from '../../../shared/validation';

async function isAdminSession(session: UserSessionPayload, env: Env): Promise<boolean> {
  if (session.githubUsername.toLowerCase() !== ADMIN_GITHUB_USERNAME) return false;
  const employee = await env.DB.prepare('SELECT github_username, role FROM employees WHERE id = ?')
    .bind(session.userId)
    .first<{ github_username: string; role: string }>();
  return (
    employee?.github_username.toLowerCase() === ADMIN_GITHUB_USERNAME &&
    employee.role === 'admin'
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // 1. CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(env, request),
      });
    }

    const timezone = env.APP_TIMEZONE || DEFAULT_APP_TIMEZONE;

    try {
      // 2. Health & Free-Tier Quota Status
      if (url.pathname === '/api/health' || url.pathname === '/') {
        return jsonResponse(
          {
            status: 'ok',
            service: 'EMS Employee Daily Update API',
            version: '1.0.0',
            timezone,
            freeTierNotice: 'System running within free-tier limits (Cloudflare Workers 100k req/day, D1 5M reads/day).',
          },
          200,
          env,
          request
        );
      }

      // 3. Deadline Status (Visible to all, calculated strictly on server)
      if (url.pathname === '/api/deadline-status' && method === 'GET') {
        const deadline = getDeadlineStatus(new Date(), timezone);
        return jsonResponse(deadline, 200, env, request);
      }

      // 4. GitHub OAuth Initiation URL
      if (url.pathname === '/api/auth/github/url' && method === 'GET') {
        if (!env.GITHUB_CLIENT_ID) {
          return errorResponse(
            'GITHUB_CLIENT_ID is not configured in worker secrets.',
            500,
            { notice: 'For local testing, use the Dev Sign-In option.' },
            env,
            request
          );
        }

        const redirectUri = `${url.origin}/api/auth/github/callback`;
        const scope = 'read:user user:email';
        const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
          env.GITHUB_CLIENT_ID
        )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;

        return jsonResponse({ url: githubAuthUrl }, 200, env, request);
      }

      // 5. GitHub OAuth Callback
      if (url.pathname === '/api/auth/github/callback' && method === 'GET') {
        if (!env.JWT_SECRET) {
          return errorResponse('JWT_SECRET is not configured in worker secrets.', 500, null, env, request);
        }

        const code = url.searchParams.get('code');
        if (!code) {
          return errorResponse('Missing authorization code from GitHub.', 400, null, env, request);
        }

        const accessToken = await exchangeGitHubCode(code, env);
        const githubUser = await fetchGitHubUser(accessToken);
        const employee = await upsertEmployee(env.DB, githubUser);

        // Create JWT valid for 7 days
        const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        const sessionPayload: UserSessionPayload = {
          userId: employee.id,
          githubId: employee.githubId,
          githubUsername: employee.githubUsername,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          exp,
        };

        const token = await signJwt(sessionPayload, env.JWT_SECRET);

        // Redirect back to frontend with the auth token
        const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
        const redirectTarget = new URL(frontendUrl);
        redirectTarget.hash = `token=${encodeURIComponent(token)}`;

        return Response.redirect(redirectTarget.toString(), 302);
      }

      // 6. Dev / Demo Login (Useful for local testing without setting up OAuth keys)
      if (url.pathname === '/api/auth/dev-login' && method === 'POST') {
        if (env.DEV_SIGN_IN_ENABLED !== 'true') {
          return errorResponse('Not found.', 404, null, env, request);
        }
        if (!env.JWT_SECRET) {
          return errorResponse('JWT_SECRET is not configured in worker secrets.', 500, null, env, request);
        }

        const body: any = await request.json().catch(() => ({}));
        const username = body.username || 'foez-ahmed';
        const name = body.name || 'Foez Ahmed';
        const email = body.email || 'foez.ahmed@adnsemicon.com';

        const employee = await upsertEmployee(env.DB, {
          id: 'dev-' + username,
          login: username,
          name,
          email,
          avatar_url: `https://github.com/${username}.png`,
        });

        const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        const token = await signJwt(
          {
            userId: employee.id,
            githubId: employee.githubId,
            githubUsername: employee.githubUsername,
            name: employee.name,
            email: employee.email,
            role: employee.role,
            exp,
          },
          env.JWT_SECRET
        );

        return jsonResponse({ success: true, token, employee }, 200, env, request);
      }

      // 7. Protected Route: Get Current User Profile
      if (url.pathname === '/api/auth/me' && method === 'GET') {
        const session = await authenticateRequest(request, env);
        if (!session) {
          return errorResponse('Unauthorized. Invalid or missing session token.', 401, null, env, request);
        }

        const emp = await env.DB.prepare(
          `SELECT e.*, t.name as team_name, t.manager_name, t.manager_email
           FROM employees e
           LEFT JOIN teams t ON e.team_id = t.id
           WHERE e.id = ?`
        )
          .bind(session.userId)
          .first<any>();

        if (!emp) {
          return errorResponse('Employee profile not found.', 404, null, env, request);
        }

        return jsonResponse(
          {
            id: emp.id,
            githubId: emp.github_id,
            githubUsername: emp.github_username,
            name: emp.name,
            email: emp.email,
            officialEmail: emp.official_email || null,
            avatarUrl: emp.avatar_url,
            teamId: emp.team_id,
            teamName: emp.team_name,
            role: emp.role,
            managerName: emp.manager_name,
            managerEmail: emp.manager_email,
          },
          200,
          env,
          request
        );
      }

      // Admin-only employee profile management
      if (url.pathname === '/api/admin/employees' && method === 'GET') {
        const session = await authenticateRequest(request, env);
        if (!session) return errorResponse('Unauthorized', 401, null, env, request);
        if (!(await isAdminSession(session, env))) {
          return errorResponse('Forbidden: Administrator access required.', 403, null, env, request);
        }

        const { results } = await env.DB.prepare(
          `SELECT e.*, t.name AS team_name
           FROM employees e
           LEFT JOIN teams t ON e.team_id = t.id
           ORDER BY e.name COLLATE NOCASE ASC`
        ).all<any>();

        return jsonResponse(
          {
            employees: results.map((emp: any) => ({
              id: emp.id,
              githubId: emp.github_id,
              githubUsername: emp.github_username,
              name: emp.name,
              email: emp.email,
              officialEmail: emp.official_email || null,
              avatarUrl: emp.avatar_url,
              teamId: emp.team_id,
              teamName: emp.team_name,
              role: emp.role,
              createdAt: emp.created_at,
              updatedAt: emp.updated_at,
            })),
          },
          200,
          env,
          request
        );
      }

      if (url.pathname.startsWith('/api/admin/employees/') && method === 'PUT') {
        const session = await authenticateRequest(request, env);
        if (!session) return errorResponse('Unauthorized', 401, null, env, request);
        if (!(await isAdminSession(session, env))) {
          return errorResponse('Forbidden: Administrator access required.', 403, null, env, request);
        }

        const employeeId = url.pathname.slice('/api/admin/employees/'.length);
        if (!employeeId || employeeId.includes('/')) {
          return errorResponse('Invalid employee profile path.', 400, null, env, request);
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return errorResponse('Invalid JSON request body.', 400, null, env, request);
        }

        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const officialEmail =
          body.officialEmail === null || body.officialEmail === ''
            ? null
            : typeof body.officialEmail === 'string'
              ? body.officialEmail.trim()
              : undefined;
        const teamId = body.teamId === '' ? null : body.teamId;
        const requestedRole = body.role;

        if (!name || name.length > 120) {
          return errorResponse('Name is required and must be at most 120 characters.', 400, null, env, request);
        }
        if (
          officialEmail === undefined ||
          (officialEmail !== null &&
            (officialEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail)))
        ) {
          return errorResponse('Official email must be a valid email address or empty.', 400, null, env, request);
        }
        if (teamId !== null && typeof teamId !== 'string') {
          return errorResponse('Team assignment must be a team ID or empty.', 400, null, env, request);
        }
        if (!['employee', 'manager', 'admin'].includes(requestedRole)) {
          return errorResponse('Role must be employee or manager.', 400, null, env, request);
        }

        const target = await env.DB.prepare('SELECT github_username FROM employees WHERE id = ?')
          .bind(employeeId)
          .first<{ github_username: string }>();
        if (!target) return errorResponse('Employee profile not found.', 404, null, env, request);

        const isFixedAdmin = target.github_username.toLowerCase() === ADMIN_GITHUB_USERNAME;
        if (requestedRole === 'admin' && !isFixedAdmin) {
          return errorResponse('Only the designated GitHub account can be an administrator.', 400, null, env, request);
        }
        const role = isFixedAdmin ? 'admin' : requestedRole;

        if (teamId !== null) {
          const team = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(teamId).first();
          if (!team) return errorResponse('Selected team does not exist.', 400, null, env, request);
        }

        await env.DB.prepare(
          `UPDATE employees
           SET name = ?, official_email = ?, team_id = ?, role = ?, updated_at = ?
           WHERE id = ?`
        )
          .bind(name, officialEmail, teamId, role, new Date().toISOString(), employeeId)
          .run();

        const updated = await env.DB.prepare(
          `SELECT e.*, t.name AS team_name
           FROM employees e
           LEFT JOIN teams t ON e.team_id = t.id
           WHERE e.id = ?`
        )
          .bind(employeeId)
          .first<any>();

        return jsonResponse(
          {
            success: true,
            employee: {
              id: updated.id,
              githubId: updated.github_id,
              githubUsername: updated.github_username,
              name: updated.name,
              email: updated.email,
              officialEmail: updated.official_email || null,
              avatarUrl: updated.avatar_url,
              teamId: updated.team_id,
              teamName: updated.team_name,
              role: updated.role,
              createdAt: updated.created_at,
              updatedAt: updated.updated_at,
            },
          },
          200,
          env,
          request
        );
      }

      // 8. Protected Route: Get Assigned GitHub Issues with Linked Projects
      if (url.pathname === '/api/github/issues' && method === 'GET') {
        const session = await authenticateRequest(request, env);
        if (!session) {
          return errorResponse('Unauthorized', 401, null, env, request);
        }

        const issuesResult = await fetchAssignedIssues(session.githubUsername, env);
        return jsonResponse(issuesResult, 200, env, request);
      }

      // 9. Protected Route: Get Today's Update (or by date)
      if (url.pathname === '/api/updates/today' && method === 'GET') {
        const session = await authenticateRequest(request, env);
        if (!session) {
          return errorResponse('Unauthorized', 401, null, env, request);
        }

        const deadlineStatus = getDeadlineStatus(new Date(), timezone);
        const queryDate = url.searchParams.get('date') || deadlineStatus.currentDate;

        const row = await env.DB.prepare(
          `SELECT * FROM daily_updates WHERE employee_id = ? AND date = ?`
        )
          .bind(session.userId, queryDate)
          .first<any>();

        if (!row) {
          return jsonResponse(
            {
              exists: false,
              date: queryDate,
              deadlineStatus,
              update: null,
            },
            200,
            env,
            request
          );
        }

        return jsonResponse(
          {
            exists: true,
            date: queryDate,
            deadlineStatus,
            update: {
              id: row.id,
              employeeId: row.employee_id,
              date: row.date,
              todaysTasks: JSON.parse(row.todays_tasks || '[]'),
              suddenTasks: JSON.parse(row.sudden_tasks || '[]'),
              blockers: JSON.parse(row.blockers || '[]'),
              plansGoingForward: JSON.parse(row.plans_going_forward || '[]'),
              status: row.status,
              submittedAt: row.submitted_at,
              lockedAt: row.locked_at,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            },
          },
          200,
          env,
          request
        );
      }

      // 10. Protected Route: Submit or Save Today's Update (Strictly enforces 11:30 PM cutoff!)
      if (url.pathname === '/api/updates/today' && method === 'POST') {
        const session = await authenticateRequest(request, env);
        if (!session) {
          return errorResponse('Unauthorized', 401, null, env, request);
        }

        const rawBody = await request.text();
        if (!checkPayloadLimit(rawBody)) {
          return errorResponse('Payload too large. Exceeds free tier quota limit of 128KB.', 413, null, env, request);
        }

        const body: any = JSON.parse(rawBody || '{}');
        const deadlineStatus = getDeadlineStatus(new Date(), timezone);
        const targetDate = body.date || deadlineStatus.currentDate;

        // CRITICAL REQUIREMENT: Backend must enforce the 11:30 PM cutoff independently of frontend
        if (targetDate === deadlineStatus.currentDate && deadlineStatus.isLocked) {
          return errorResponse(
            `Submission deadline for ${targetDate} passed at 11:30 PM (${timezone}). Today's updates are locked.`,
            403,
            { deadlineStatus },
            env,
            request
          );
        }

        // If targetDate is a past date, cannot edit
        if (targetDate < deadlineStatus.currentDate) {
          return errorResponse('Past daily updates are locked and cannot be edited.', 403, null, env, request);
        }

        // Validate sections
        const validation = validateUpdateSections(body);
        const isSubmitting = body.submit === true;

        if (isSubmitting && !validation.valid) {
          return errorResponse(validation.errors.join(' '), 400, { errors: validation.errors }, env, request);
        }

        const now = new Date().toISOString();
        const updateStatus = isSubmitting ? 'submitted' : 'draft';
        const submittedAt = isSubmitting ? now : null;

        // Check if update already exists
        const existing = await env.DB.prepare(
          `SELECT id, status FROM daily_updates WHERE employee_id = ? AND date = ?`
        )
          .bind(session.userId, targetDate)
          .first<any>();

        if (existing && existing.status === 'locked') {
          return errorResponse('This update has been locked and can no longer be modified.', 403, null, env, request);
        }

        const updateId = existing ? existing.id : 'upd-' + crypto.randomUUID();

        if (existing) {
          await env.DB.prepare(
            `UPDATE daily_updates SET
               todays_tasks = ?,
               sudden_tasks = ?,
               blockers = ?,
               plans_going_forward = ?,
               status = ?,
               submitted_at = COALESCE(?, submitted_at),
               updated_at = ?
             WHERE id = ?`
          )
            .bind(
              JSON.stringify(validation.sanitized.todaysTasks),
              JSON.stringify(validation.sanitized.suddenTasks),
              JSON.stringify(validation.sanitized.blockers),
              JSON.stringify(validation.sanitized.plansGoingForward),
              updateStatus,
              submittedAt,
              now,
              updateId
            )
            .run();
        } else {
          await env.DB.prepare(
            `INSERT INTO daily_updates (
               id, employee_id, date, todays_tasks, sudden_tasks, blockers, plans_going_forward,
               status, submitted_at, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              updateId,
              session.userId,
              targetDate,
              JSON.stringify(validation.sanitized.todaysTasks),
              JSON.stringify(validation.sanitized.suddenTasks),
              JSON.stringify(validation.sanitized.blockers),
              JSON.stringify(validation.sanitized.plansGoingForward),
              updateStatus,
              submittedAt,
              now,
              now
            )
            .run();
        }

        return jsonResponse(
          {
            success: true,
            message: isSubmitting ? 'Update successfully submitted!' : 'Draft saved successfully.',
            updateId,
            status: updateStatus,
            deadlineStatus,
          },
          200,
          env,
          request
        );
      }

      // 11. Protected Route: Get User's Past Updates History
      if (url.pathname === '/api/updates/history' && method === 'GET') {
        const session = await authenticateRequest(request, env);
        if (!session) {
          return errorResponse('Unauthorized', 401, null, env, request);
        }

        const limit = Math.min(30, parseInt(url.searchParams.get('limit') || '15', 10));
        const { results } = await env.DB.prepare(
          `SELECT * FROM daily_updates WHERE employee_id = ? ORDER BY date DESC LIMIT ?`
        )
          .bind(session.userId, limit)
          .all<any>();

        const updates = results.map(row => ({
          id: row.id,
          date: row.date,
          todaysTasks: JSON.parse(row.todays_tasks || '[]'),
          suddenTasks: JSON.parse(row.sudden_tasks || '[]'),
          blockers: JSON.parse(row.blockers || '[]'),
          plansGoingForward: JSON.parse(row.plans_going_forward || '[]'),
          status: row.status,
          submittedAt: row.submitted_at,
          lockedAt: row.locked_at,
          createdAt: row.created_at,
        }));

        return jsonResponse({ updates }, 200, env, request);
      }

      // 12. Teams list
      if (url.pathname === '/api/teams' && method === 'GET') {
        const { results: teams } = await env.DB.prepare('SELECT * FROM teams ORDER BY name ASC').all();
        return jsonResponse({ teams }, 200, env, request);
      }

      // 13. Assign / Update Team
      if (url.pathname === '/api/employees/team' && method === 'PUT') {
        const session = await authenticateRequest(request, env);
        if (!session) return errorResponse('Unauthorized', 401, null, env, request);

        const body: any = await request.json().catch(() => ({}));
        if (!body.teamId) return errorResponse('Missing teamId', 400, null, env, request);

        await env.DB.prepare('UPDATE employees SET team_id = ?, updated_at = ? WHERE id = ?')
          .bind(body.teamId, new Date().toISOString(), session.userId)
          .run();

        return jsonResponse({ success: true, message: 'Team assignment updated.' }, 200, env, request);
      }

      // 14. Protected Scheduled Endpoint: Prepare Daily Reports and Lock Updates
      // Called by GitHub Actions with Authorization: Bearer <REPORT_API_KEY>
      if (url.pathname === '/api/reports/daily/prepare' && method === 'POST') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();

        if (!env.REPORT_API_KEY) {
          return errorResponse('REPORT_API_KEY is not configured in worker secrets.', 500, null, env, request);
        }
        const expectedKey = env.REPORT_API_KEY;
        if (!token || token !== expectedKey) {
          return errorResponse('Forbidden: Invalid REPORT_API_KEY.', 403, null, env, request);
        }

        const body: any = await request.json().catch(() => ({}));
        const deadlineStatus = getDeadlineStatus(new Date(), timezone);
        const targetDate = body.date || deadlineStatus.currentDate;
        const bypassCutoff = body.bypassCutoff === true; // For testing workflows

        const reportBatch = await prepareDailyReports(env.DB, targetDate, timezone, env, bypassCutoff);

        return jsonResponse(
          {
            success: true,
            date: targetDate,
            timezone,
            alreadySentCount: reportBatch.alreadySentCount,
            emailsCount: reportBatch.emailsToSend.length,
            emailsToSend: reportBatch.emailsToSend,
          },
          200,
          env,
          request
        );
      }

      // 15. Protected Scheduled Endpoint: Confirm Email Delivery (Idempotent audit record)
      if (url.pathname === '/api/reports/daily/confirm' && method === 'POST') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!env.REPORT_API_KEY) {
          return errorResponse('REPORT_API_KEY is not configured in worker secrets.', 500, null, env, request);
        }
        const expectedKey = env.REPORT_API_KEY;
        if (!token || token !== expectedKey) {
          return errorResponse('Forbidden: Invalid REPORT_API_KEY.', 403, null, env, request);
        }

        const body: any = await request.json().catch(() => ({}));
        const { date, reportType, recipientEmail, status, messageId, errorMessage } = body;

        if (!date || !reportType || !recipientEmail || !status) {
          return errorResponse('Missing required delivery confirmation fields.', 400, null, env, request);
        }

        await recordReportDelivery(env.DB, date, reportType, recipientEmail, status, messageId, errorMessage);

        return jsonResponse({ success: true, message: 'Delivery recorded.' }, 200, env, request);
      }

      return errorResponse('Not Found', 404, null, env, request);
    } catch (err: any) {
      console.error('API Error:', err);
      return errorResponse(err.message || 'Internal Server Error', 500, null, env, request);
    }
  },
};
