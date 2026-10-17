/**
 * Scheduled Daily Reports Dispatcher
 * Sends daily updates through SMTP with strict idempotency and audit tracking.
 * Secrets are consumed from environment variables and NEVER logged.
 */

import nodemailer from 'nodemailer';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('--- Starting Daily Update Email Dispatcher ---');

  // 1. Validate required environment variables
  const {
    BACKEND_API_URL,
    REPORT_API_KEY,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    REPORT_DATE,
    BYPASS_CUTOFF,
  } = process.env;

  const missing = [];
  if (!BACKEND_API_URL) missing.push('BACKEND_API_URL');
  if (!REPORT_API_KEY) missing.push('REPORT_API_KEY');
  if (!SMTP_HOST) missing.push('SMTP_HOST');
  if (!SMTP_PORT) missing.push('SMTP_PORT');
  if (!SMTP_USER) missing.push('SMTP_USER');
  if (!SMTP_PASS) missing.push('SMTP_PASS');
  if (!SMTP_FROM) missing.push('SMTP_FROM');

  if (missing.length > 0) {
    console.error(`ERROR: Missing required environment variables: ${missing.join(', ')}`);
    console.error('Ensure all SMTP and backend secrets are configured in GitHub Actions secrets.');
    process.exit(1);
  }

  // 2. Request prepared, locked reports batch from backend
  const apiUrl = `${BACKEND_API_URL.replace(/\/+$/, '')}/api/reports/daily/prepare`;
  console.log(`Contacting backend endpoint to lock updates and retrieve report batch...`);

  let response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${REPORT_API_KEY}`,
      },
      body: JSON.stringify({
        date: REPORT_DATE || undefined,
        bypassCutoff: BYPASS_CUTOFF === 'true',
      }),
    });
  } catch (err) {
    console.error(`Failed to reach backend API at ${apiUrl}:`, err.message);
    process.exit(1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Backend returned error (${response.status}): ${errorText}`);
    process.exit(1);
  }

  const batch = await response.json();
  const date = batch.date;
  const emailsToSend = batch.emailsToSend || [];
  const alreadySentCount = batch.alreadySentCount || 0;

  console.log(`Report Date: ${date} (${batch.timezone})`);
  console.log(`Already delivered reports for today (skipped for idempotency): ${alreadySentCount}`);
  console.log(`New reports to dispatch: ${emailsToSend.length}`);

  if (emailsToSend.length === 0) {
    console.log('No pending emails to send. System is up to date.');
    return;
  }

  // 3. Configure SMTP transporter
  const port = parseInt(SMTP_PORT, 10);
  const secure = port === 465; // SSL for 465, STARTTLS for 587/25

  console.log(`Configuring SMTP transport (${SMTP_HOST}:${port}, secure=${secure})...`);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // Useful options for free-tier SMTP reliability
    pool: false,
    rateLimit: 5, // max 5 messages per second
    tls: {
      rejectUnauthorized: true,
    },
  });

  // Verify connection configuration
  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully.');
  } catch (err) {
    console.error('Failed to authenticate with SMTP server. Check SMTP credentials:', err.message);
    process.exit(1);
  }

  // 4. Dispatch emails with rate-limiting delay between sends
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < emailsToSend.length; i++) {
    const email = emailsToSend[i];
    console.log(
      `[${i + 1}/${emailsToSend.length}] Dispatching ${email.type} report to ${email.to}${
        email.cc?.length ? ' (CC: ' + email.cc.join(', ') + ')' : ''
      }...`
    );

    let messageId = null;
    let errorMessage = null;
    let deliveryStatus = 'failed';

    try {
      const info = await transporter.sendMail({
        from: SMTP_FROM,
        to: email.to,
        cc: email.cc && email.cc.length > 0 ? email.cc : undefined,
        subject: email.subject,
        text: email.textContent,
        html: email.htmlContent,
      });

      messageId = info.messageId;
      deliveryStatus = 'sent';
      successCount++;
      console.log(` -> Delivered successfully. Message ID: ${messageId}`);
    } catch (sendErr) {
      errorMessage = sendErr.message || 'SMTP delivery failed';
      failureCount++;
      console.error(` -> Failed to deliver email to ${email.to}:`, errorMessage);
    }

    // 5. Confirm delivery with backend to record audit and enforce idempotency
    try {
      const confirmUrl = `${BACKEND_API_URL.replace(/\/+$/, '')}/api/reports/daily/confirm`;
      await fetch(confirmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${REPORT_API_KEY}`,
        },
        body: JSON.stringify({
          date,
          reportType: email.type,
          recipientEmail: email.to,
          status: deliveryStatus,
          messageId,
          errorMessage,
        }),
      });
    } catch (confirmErr) {
      console.warn(` -> Warning: Failed to record delivery confirmation in database:`, confirmErr.message);
    }

    // Delay between sends (300ms) to respect free-tier SMTP rate limits
    if (i < emailsToSend.length - 1) {
      await sleep(300);
    }
  }

  console.log('\n--- Delivery Summary ---');
  console.log(`Successfully sent: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Previously completed: ${alreadySentCount}`);

  if (failureCount > 0) {
    console.error('Completed with delivery errors. Check logs above.');
    process.exit(1);
  } else {
    console.log('All daily reports processed successfully.');
  }
}

main().catch(err => {
  console.error('Unexpected fatal error in report sender:', err);
  process.exit(1);
});
