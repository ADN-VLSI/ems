import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

const RECIPIENT = process.env.DAILY_UPDATE_RECIPIENT || "info@adnsemicon.com";
const SECTIONS = [
  ["todaysTasks", "Today's Tasks"],
  ["suddenTasks", "Sudden Tasks"],
  ["blockers", "Blockers"],
  ["plans", "Plans Going Forward"],
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function firebaseServiceAccount() {
  let account;
  try {
    account = JSON.parse(required("FIREBASE_SERVICE_ACCOUNT").replace(/^\uFEFF/, "").trim());
  } catch {
    throw new Error(
      "Invalid FIREBASE_SERVICE_ACCOUNT: set the GitHub Actions secret to the full JSON contents of a downloaded Firebase service-account key, not its email address or filename.",
    );
  }
  if (
    !account ||
    typeof account !== "object" ||
    typeof account.project_id !== "string" ||
    typeof account.client_email !== "string" ||
    typeof account.private_key !== "string" ||
    !account.private_key.includes("-----BEGIN PRIVATE KEY-----")
  ) {
    throw new Error(
      "Invalid FIREBASE_SERVICE_ACCOUNT: the JSON must include project_id, client_email, and a private_key from a Firebase service-account key.",
    );
  }
  return account;
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function renderUpdate(update) {
  const text = [`${update.employeeName} <${update.employeeEmail}>`, "=".repeat(40)];
  const html = [
    `<h3>${escapeHtml(update.employeeName)} &lt;${escapeHtml(update.employeeEmail)}&gt;</h3>`,
  ];
  for (const [key, title] of SECTIONS) {
    const items = update[key] ?? [];
    text.push(title, ...(items.length ? items.map((item) => `  • ${item}`) : ["  • None"]), "");
    html.push(
      `<h4>${title}</h4><ul>${
        items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>None</li>"
      }</ul>`,
    );
  }
  return { text: text.join("\n"), html: html.join("\n") };
}

function dhakaDate(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function nextDate(date) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + 1);
  return result.toISOString().slice(0, 10);
}

function dhakaMinutesOfDay(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

initializeApp({ credential: cert(firebaseServiceAccount()) });
const db = getFirestore();

const now = new Date();
const controlRef = db.collection("system").doc("dailyUpdates");
let reportDate;
await db.runTransaction(async (transaction) => {
  const controlSnap = await transaction.get(controlRef);
  if (!controlSnap.exists) {
    if (dhakaMinutesOfDay(now) < 23 * 60 + 30) {
      throw new Error("Daily updates are still being collected; the email runs at 11:30 PM Dhaka time.");
    }
    reportDate = dhakaDate(now);
  } else {
    const control = controlSnap.data();
    if (
      typeof control.collectingDate !== "string" ||
      typeof control.accepting !== "boolean" ||
      typeof control.acceptingUntil?.toDate !== "function"
    ) {
      throw new Error("Daily update collection status is invalid.");
    }
    if (control.accepting && now < control.acceptingUntil.toDate()) {
      throw new Error("Daily updates are still being collected for the current reporting day.");
    }
    reportDate = control.collectingDate;
  }
  const cutoff = new Date(`${reportDate}T17:30:00.000Z`);
  transaction.set(controlRef, {
    collectingDate: reportDate,
    accepting: false,
    acceptingUntil: Timestamp.fromDate(cutoff),
  });
});

const [updatesSnap, usersSnap] = await Promise.all([
  db.collection("dailyUpdates").get(),
  db.collection("users").where("status", "==", "approved").get(),
]);

if (updatesSnap.docs.some((document) => document.data().date !== reportDate)) {
  throw new Error(`Found daily updates outside the ${reportDate} reporting day; refusing to email or clear them.`);
}

const updates = updatesSnap.docs
  .map((d) => ({ ref: d.ref, ...d.data() }))
  .sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName)));
const submitted = new Set(updates.map((u) => u.employeeId));
const missing = usersSnap.docs
  .map((d) => d.data())
  .filter((u) => !submitted.has(u.uid))
  .map((u) => u.displayName || u.email)
  .sort((a, b) => a.localeCompare(b));

const text = [`Daily updates for ${reportDate}`, ""];
const html = [`<h2>Daily updates for ${reportDate}</h2>`];

if (!updates.length) {
  text.push("No updates were submitted for this reporting day.", "");
  html.push("<p>No updates were submitted for this reporting day.</p>");
}

for (const update of updates) {
  const rendered = renderUpdate(update);
  text.push(rendered.text, "");
  html.push(rendered.html);
}

if (missing.length) {
  text.push("No update submitted by:", ...missing.map((n) => `  • ${n}`));
  html.push(`<h4>No update submitted by</h4><ul>${missing.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`);
}

const port = Number(process.env.SMTP_PORT || 465);
const transport = nodemailer.createTransport({
  host: required("SMTP_HOST"),
  port,
  secure: port === 465,
  auth: { user: required("SMTP_USER"), pass: required("SMTP_PASS") },
});

const from = process.env.SMTP_FROM || process.env.SMTP_USER;

async function sendEmail(message) {
  const result = await transport.sendMail(message);
  if (!result.accepted.length || result.rejected.length) {
    throw new Error("SMTP server did not accept the email for all recipients.");
  }
}

await sendEmail({
  from,
  to: RECIPIENT,
  subject: `Daily updates – ${reportDate}`,
  text: text.join("\n"),
  html: html.join("\n"),
});
console.log(`Sent ${updates.length} update(s) to ${RECIPIENT}`);

for (const update of updates) {
  const rendered = renderUpdate(update);
  await sendEmail({
    from,
    to: update.employeeEmail,
    subject: `Your daily update – ${reportDate}`,
    text: [`Your daily update for ${reportDate}`, "", rendered.text].join("\n"),
    html: [`<h2>Your daily update for ${reportDate}</h2>`, rendered.html].join("\n"),
  });
}
console.log(`Sent personal update copies to ${updates.length} employee(s)`);

// Clear only after the email was accepted, so a failed run can be retried.
for (let i = 0; i < updates.length; i += 400) {
  const batch = db.batch();
  updates.slice(i, i + 400).forEach((u) => batch.delete(u.ref));
  await batch.commit();
}
console.log("Cleared daily updates");

const nextCollectingDate = nextDate(reportDate);
await controlRef.set({
  collectingDate: nextCollectingDate,
  accepting: true,
  acceptingUntil: Timestamp.fromDate(new Date(`${nextCollectingDate}T17:30:00.000Z`)),
});
console.log(`Opened daily updates for ${nextCollectingDate}`);
