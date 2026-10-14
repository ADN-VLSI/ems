import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const dhakaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

initializeApp({ credential: cert(JSON.parse(required("FIREBASE_SERVICE_ACCOUNT"))) });
const db = getFirestore();

const [updatesSnap, usersSnap] = await Promise.all([
  db.collection("dailyUpdates").get(),
  db.collection("users").where("status", "==", "approved").get(),
]);

const updates = updatesSnap.docs
  .map((d) => ({ ref: d.ref, ...d.data() }))
  .sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName)));
const submitted = new Set(updates.map((u) => u.employeeId));
const missing = usersSnap.docs
  .map((d) => d.data())
  .filter((u) => !submitted.has(u.uid))
  .map((u) => u.displayName || u.email)
  .sort((a, b) => a.localeCompare(b));

const text = [`Daily updates for ${dhakaDate}`, ""];
const html = [`<h2>Daily updates for ${dhakaDate}</h2>`];

if (!updates.length) {
  text.push("No updates were submitted today.", "");
  html.push("<p>No updates were submitted today.</p>");
}

for (const update of updates) {
  text.push(`${update.employeeName} <${update.employeeEmail}>`, "=".repeat(40));
  html.push(`<h3>${escapeHtml(update.employeeName)} &lt;${escapeHtml(update.employeeEmail)}&gt;</h3>`);
  for (const [key, title] of SECTIONS) {
    const items = update[key] ?? [];
    text.push(title, ...(items.length ? items.map((i) => `  • ${i}`) : ["  • None"]), "");
    html.push(
      `<h4>${title}</h4><ul>${
        items.length ? items.map((i) => `<li>${escapeHtml(i)}</li>`).join("") : "<li>None</li>"
      }</ul>`,
    );
  }
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

await transport.sendMail({
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
  to: RECIPIENT,
  subject: `Daily updates – ${dhakaDate}`,
  text: text.join("\n"),
  html: html.join("\n"),
});
console.log(`Sent ${updates.length} update(s) to ${RECIPIENT}`);

// Clear only after the email was accepted, so a failed run can be retried.
for (let i = 0; i < updates.length; i += 400) {
  const batch = db.batch();
  updates.slice(i, i + 400).forEach((u) => batch.delete(u.ref));
  await batch.commit();
}
console.log("Cleared daily updates");
