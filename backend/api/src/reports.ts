import { Env } from './types';
import { PreparedEmail, DailyReportBatch } from '../../../shared/types';
import { COMPANY_REPORT_TO, COMPANY_REPORT_CC, getDeadlineStatus } from '../../../shared/validation';

interface UpdateRow {
  id: string;
  employee_id: string;
  name: string;
  github_username: string;
  email: string;
  official_email: string | null;
  team_id: string | null;
  manager_name: string | null;
  manager_email: string | null;
  date: string;
  todays_tasks: string;
  sudden_tasks: string;
  blockers: string;
  plans_going_forward: string;
  status: string;
  submitted_at: string | null;
  locked_at: string | null;
}

function parseBullets(jsonStr: string): string[] {
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderHtmlBullets(bullets: string[]): string {
  if (!bullets || bullets.length === 0) {
    return '<span style="color:#8c8c8c; font-style:italic;">None</span>';
  }
  return '<ul style="margin: 0; padding-left: 18px;">' +
    bullets.map(b => `<li style="margin-bottom: 4px;">${escapeHtml(b)}</li>`).join('') +
    '</ul>';
}

function renderTextBullets(bullets: string[]): string {
  if (!bullets || bullets.length === 0) {
    return 'None';
  }
  return bullets.map(b => `  • ${b}`).join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds HTML table for updates
 * Required table headers: | Name | GitHub ID | Today's Tasks | Sudden Tasks | Blockers | Plans Going Forward |
 */
function buildHtmlTable(rows: UpdateRow[]): string {
  let tableHtml = `
  <table style="width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #1f2937;">
    <thead>
      <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb; text-align: left;">
        <th style="padding: 10px 12px; border: 1px solid #e5e7eb; width: 14%;">Name</th>
        <th style="padding: 10px 12px; border: 1px solid #e5e7eb; width: 12%;">GitHub ID</th>
        <th style="padding: 10px 12px; border: 1px solid #e5e7eb; width: 22%;">Today's Tasks</th>
        <th style="padding: 10px 12px; border: 1px solid #e5e7eb; width: 16%;">Sudden Tasks</th>
        <th style="padding: 10px 12px; border: 1px solid #e5e7eb; width: 16%;">Blockers</th>
        <th style="padding: 10px 12px; border: 1px solid #e5e7eb; width: 20%;">Plans Going Forward</th>
      </tr>
    </thead>
    <tbody>
  `;

  rows.forEach((r, idx) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
    const todays = parseBullets(r.todays_tasks);
    const sudden = parseBullets(r.sudden_tasks);
    const blockers = parseBullets(r.blockers);
    const plans = parseBullets(r.plans_going_forward);

    tableHtml += `
      <tr style="background-color: ${bg}; vertical-align: top;">
        <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 600; color: #111827;">${escapeHtml(r.name)}</td>
        <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: #4b5563;">
          <a href="https://github.com/${escapeHtml(r.github_username)}" style="color: #2563eb; text-decoration: none;">@${escapeHtml(r.github_username)}</a>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${renderHtmlBullets(todays)}</td>
        <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${renderHtmlBullets(sudden)}</td>
        <td style="padding: 10px 12px; border: 1px solid #e5e7eb; color: ${blockers.length ? '#b91c1c' : 'inherit'};">${renderHtmlBullets(blockers)}</td>
        <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${renderHtmlBullets(plans)}</td>
      </tr>
    `;
  });

  tableHtml += `
    </tbody>
  </table>
  `;

  return tableHtml;
}

/**
 * Builds Plain-text representation of the table
 */
function buildTextTable(rows: UpdateRow[]): string {
  let out = '';
  for (const r of rows) {
    out += `\n------------------------------------------------------------\n`;
    out += `NAME: ${r.name} (@${r.github_username})\n`;
    out += `TODAY'S TASKS:\n${renderTextBullets(parseBullets(r.todays_tasks))}\n`;
    out += `SUDDEN TASKS:\n${renderTextBullets(parseBullets(r.sudden_tasks))}\n`;
    out += `BLOCKERS:\n${renderTextBullets(parseBullets(r.blockers))}\n`;
    out += `PLANS GOING FORWARD:\n${renderTextBullets(parseBullets(r.plans_going_forward))}\n`;
  }
  return out;
}

/**
 * Locks daily updates and prepares idempotent email batch
 */
export async function prepareDailyReports(
  db: D1Database,
  date: string,
  timezone: string,
  env: Env,
  bypassCutoff = false
): Promise<DailyReportBatch> {
  // 1. Verify deadline cutoff has passed
  const deadlineStatus = getDeadlineStatus(new Date(), timezone);
  const canBypassCutoffForTesting = bypassCutoff && env.DEV_SIGN_IN_ENABLED === 'true';

  if (date > deadlineStatus.currentDate) {
    throw new Error('Cannot prepare daily reports for a future date.');
  }

  // Production must never lock or send today's reports before the cutoff.
  if (
    date === deadlineStatus.currentDate &&
    !deadlineStatus.isLocked &&
    !canBypassCutoffForTesting
  ) {
    throw new Error(
      `Cannot send daily reports before 11:30 PM cutoff. Time remaining: ${Math.floor(
        deadlineStatus.remainingSeconds / 60
      )} minutes.`
    );
  }

  // 2. Lock any unlocked updates for this date
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE daily_updates
       SET status = 'locked', locked_at = ?
       WHERE date = ? AND status != 'locked'`
    )
    .bind(now, date)
    .run();

  // 3. Query all updates for this date with employee and team info
  const { results: rows } = await db
    .prepare(
      `SELECT 
         u.id, u.employee_id, u.date, u.todays_tasks, u.sudden_tasks, u.blockers, u.plans_going_forward,
         u.status, u.submitted_at, u.locked_at,
         e.name, e.github_username, e.email, e.official_email,
         t.id as team_id, t.manager_name, t.manager_email
       FROM daily_updates u
       JOIN employees e ON u.employee_id = e.id
       LEFT JOIN teams t ON e.team_id = t.id
       WHERE u.date = ?
       ORDER BY t.manager_name ASC, e.name ASC`
    )
    .bind(date)
    .all<UpdateRow>();

  // 4. Query already successfully delivered reports for idempotency
  const { results: deliveredRows } = await db
    .prepare(`SELECT report_type, recipient_email FROM report_deliveries WHERE date = ? AND status = 'sent'`)
    .bind(date)
    .all<{ report_type: string; recipient_email: string }>();

  const deliveredSet = new Set<string>();
  deliveredRows.forEach(d => {
    deliveredSet.add(`${d.report_type}:${d.recipient_email.toLowerCase()}`);
  });

  const emailsToSend: PreparedEmail[] = [];
  let alreadySentCount = 0;

  // 5. Generate Individual Employee Update Emails
  for (const row of rows) {
    const recipientEmail = row.official_email?.trim() || row.email;
    const key = `employee_individual:${recipientEmail.toLowerCase()}`;
    if (deliveredSet.has(key)) {
      alreadySentCount++;
      continue;
    }

    const todays = parseBullets(row.todays_tasks);
    const sudden = parseBullets(row.sudden_tasks);
    const blockers = parseBullets(row.blockers);
    const plans = parseBullets(row.plans_going_forward);

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1e3a8a;">Daily Update Confirmation</h2>
          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Date: <strong>${date}</strong> | Timezone: ${timezone}</p>
        </div>
        <p>Hi <strong>${escapeHtml(row.name)}</strong>,</p>
        <p>Here is a copy of your submitted daily work update for today:</p>
        
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Today's Tasks</h3>
          ${renderHtmlBullets(todays)}

          <h3 style="margin: 16px 0 8px 0; color: #1f2937; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Sudden Tasks</h3>
          ${renderHtmlBullets(sudden)}

          <h3 style="margin: 16px 0 8px 0; color: #1f2937; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Blockers</h3>
          ${renderHtmlBullets(blockers)}

          <h3 style="margin: 16px 0 8px 0; color: #1f2937; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Plans Going Forward</h3>
          ${renderHtmlBullets(plans)}
        </div>

        <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">This is an automated confirmation sent by the Employee Daily Update System (EMS).</p>
      </div>
    `;

    const textContent = `
Daily Update Confirmation - ${date}
Hi ${row.name},

Here is a copy of your daily update for ${date}:

TODAY'S TASKS:
${renderTextBullets(todays)}

SUDDEN TASKS:
${renderTextBullets(sudden)}

BLOCKERS:
${renderTextBullets(blockers)}

PLANS GOING FORWARD:
${renderTextBullets(plans)}
    `.trim();

    emailsToSend.push({
      id: `emp-${row.employee_id}-${date}`,
      type: 'employee_individual',
      to: recipientEmail,
      subject: `[EMS] Your Daily Work Update - ${date}`,
      htmlContent,
      textContent,
      recipientName: row.name,
      date,
    });
  }

  // 6. Generate Team-by-Team Manager Reports
  // Group rows by team
  const teamsMap = new Map<string, { managerName: string; managerEmail: string; rows: UpdateRow[] }>();
  for (const row of rows) {
    if (!row.team_id || !row.manager_email) continue;
    if (!teamsMap.has(row.team_id)) {
      teamsMap.set(row.team_id, {
        managerName: row.manager_name || 'Manager',
        managerEmail: row.manager_email,
        rows: [],
      });
    }
    teamsMap.get(row.team_id)!.rows.push(row);
  }

  for (const [teamId, teamInfo] of teamsMap.entries()) {
    const key = `team_manager:${teamInfo.managerEmail.toLowerCase()}`;
    if (deliveredSet.has(key)) {
      alreadySentCount++;
      continue;
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1e3a8a;">Daily Team Update Report</h2>
          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Date: <strong>${date}</strong> | Manager: <strong>${escapeHtml(teamInfo.managerName)}</strong></p>
        </div>
        <p>Dear <strong>${escapeHtml(teamInfo.managerName)}</strong>,</p>
        <p>Below is the combined daily updates summary for your team members on <strong>${date}</strong>:</p>

        <div style="margin: 20px 0; overflow-x: auto;">
          ${buildHtmlTable(teamInfo.rows)}
        </div>

        <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">Generated by EMS (Employee Daily Update System).</p>
      </div>
    `;

    const textContent = `
Daily Team Update Report - ${date}
Manager: ${teamInfo.managerName}

UPDATES:
${buildTextTable(teamInfo.rows)}
    `.trim();

    emailsToSend.push({
      id: `team-${teamId}-${date}`,
      type: 'team_manager',
      to: teamInfo.managerEmail,
      subject: `[EMS] Daily Team Report - ${date}`,
      htmlContent,
      textContent,
      recipientName: teamInfo.managerName,
      date,
    });
  }

  // 7. Generate Company-Wide Report
  // Recipients: foez.ahmed@adnsemicon.com, CC: mohiuddin.reyad@adnsemicon.com, farhan.efty@adnsemicon.com
  const companyTo = env.COMPANY_REPORT_TO || COMPANY_REPORT_TO;
  const companyCc = env.COMPANY_REPORT_CC ? env.COMPANY_REPORT_CC.split(',').map(s => s.trim()) : COMPANY_REPORT_CC;

  const companyKey = `company_wide:${companyTo.toLowerCase()}`;
  if (deliveredSet.has(companyKey)) {
    alreadySentCount++;
  } else {
    // Group table by team headings for clean executive review
    let companyTablesHtml = '';
    const groupedByTeamName = new Map<string, UpdateRow[]>();
    for (const row of rows) {
      const managerName = row.manager_name || 'No manager assigned';
      if (!groupedByTeamName.has(managerName)) {
        groupedByTeamName.set(managerName, []);
      }
      groupedByTeamName.get(managerName)!.push(row);
    }

    groupedByTeamName.forEach((teamRows, managerName) => {
      companyTablesHtml += `
        <h3 style="margin: 24px 0 8px 0; color: #1e3a8a; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px;">Manager: ${escapeHtml(managerName)} (${teamRows.length} members)</h3>
        <div style="margin-bottom: 24px; overflow-x: auto;">
          ${buildHtmlTable(teamRows)}
        </div>
      `;
    });

    if (rows.length === 0) {
      companyTablesHtml = '<p style="font-style: italic; color: #6b7280;">No employee updates were submitted for this date.</p>';
    }

    const companyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1e3a8a;">Company-wide Daily Update Report</h2>
          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Date: <strong>${date}</strong> | Total Updates: <strong>${rows.length}</strong> | ADN Semiconductor</p>
        </div>
        <p>Dear Leadership Team,</p>
        <p>Please find the compiled daily work updates for <strong>${date}</strong> across all teams below:</p>

        ${companyTablesHtml}

        <div style="margin-top: 32px; padding: 12px; background-color: #f1f5f9; border-radius: 6px; font-size: 12px; color: #64748b;">
          <strong>Recipients:</strong> To: ${escapeHtml(companyTo)} | CC: ${escapeHtml(companyCc.join(', '))}<br/>
          Automated delivery generated at 11:30 PM deadline cutoff by EMS.
        </div>
      </div>
    `;

    const companyText = `
Company-wide Daily Update Report - ${date}
ADN Semiconductor
Total Updates: ${rows.length}

${buildTextTable(rows)}
    `.trim();

    emailsToSend.push({
      id: `company-${date}`,
      type: 'company_wide',
      to: companyTo,
      cc: companyCc,
      subject: `[EMS] Company-wide Daily Update Report - ${date}`,
      htmlContent: companyHtml,
      textContent: companyText,
      recipientName: 'Leadership Team',
      date,
    });
  }

  if (emailsToSend.length > 0) {
    const createdAt = new Date().toISOString();
    await db.batch(
      emailsToSend.map(email =>
        db
          .prepare(
            `INSERT INTO report_deliveries (
               id, date, report_type, recipient_email, status, message_id, error_message, sent_at, created_at
             ) VALUES (?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)
             ON CONFLICT(date, report_type, recipient_email) DO UPDATE SET
               status = 'pending', message_id = NULL, error_message = NULL, sent_at = NULL
             WHERE report_deliveries.status <> 'sent'`
          )
          .bind(
            'rep-' + crypto.randomUUID(),
            date,
            email.type,
            email.to.toLowerCase(),
            createdAt
          )
      )
    );
  }

  await discardSentDailyUpdates(db, date);

  return {
    date,
    timezone,
    alreadySentCount,
    emailsToSend,
  };
}

async function discardSentDailyUpdates(db: D1Database, date: string): Promise<void> {
  const deliveryState = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN status <> 'sent' THEN 1 END) AS unfinished
       FROM report_deliveries
       WHERE date = ?`
    )
    .bind(date)
    .first<{ total: number; unfinished: number }>();

  if (!deliveryState || deliveryState.total === 0 || deliveryState.unfinished > 0) return;

  await db.prepare('DELETE FROM daily_updates WHERE date = ?').bind(date).run();
}

/**
 * Records confirmed delivery in D1 for idempotency
 */
export async function recordReportDelivery(
  db: D1Database,
  date: string,
  reportType: 'employee_individual' | 'team_manager' | 'company_wide',
  recipientEmail: string,
  status: 'sent' | 'failed',
  messageId?: string | null,
  errorMessage?: string | null
): Promise<void> {
  const now = new Date().toISOString();
  const id = 'rep-' + crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO report_deliveries (id, date, report_type, recipient_email, status, message_id, error_message, sent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, report_type, recipient_email) DO UPDATE SET
         status = excluded.status,
         message_id = excluded.message_id,
         error_message = excluded.error_message,
         sent_at = excluded.sent_at`
    )
    .bind(id, date, reportType, recipientEmail.toLowerCase(), status, messageId || null, errorMessage || null, status === 'sent' ? now : null, now)
    .run();

  if (status === 'sent') {
    await discardSentDailyUpdates(db, date);
  }
}
