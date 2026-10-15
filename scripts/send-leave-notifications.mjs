import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

const ADMIN_EMAIL = "info@adnsemicon.com";

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
      "Invalid FIREBASE_SERVICE_ACCOUNT: set it to the full JSON contents of a downloaded Firebase service-account key.",
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
      "Invalid FIREBASE_SERVICE_ACCOUNT: the JSON must include project_id, client_email, and a private_key.",
    );
  }
  return account;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function renderNotification(notification) {
  const status =
    notification.event === "submitted"
      ? "submitted and is awaiting review"
      : notification.event;
  const details = [
    ["Employee", notification.employeeName],
    ["Email", notification.employeeEmail],
    ["Leave type", notification.type],
    ["Start date", notification.startDate],
    ["End date", notification.endDate],
    ["Reason", notification.reason],
  ];
  return {
    subject:
      notification.event === "submitted"
        ? "Leave request submitted"
        : `Leave request ${notification.event}`,
    text: [
      `Leave request ${status}.`,
      "",
      ...details.map(([label, value]) => `${label}: ${value}`),
    ].join("\n"),
    html: [
      `<p>Leave request ${escapeHtml(status)}.</p>`,
      "<table>",
      ...details.map(
        ([label, value]) =>
          `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      ),
      "</table>",
    ].join(""),
  };
}

const app = initializeApp({
  credential: cert(firebaseServiceAccount()),
});
const firestore = getFirestore(app);
const port = Number(required("SMTP_PORT"));
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("SMTP_PORT must be a valid TCP port.");
}
const smtpUser = required("SMTP_USER");
const transporter = nodemailer.createTransport({
  host: required("SMTP_HOST"),
  port,
  secure: port === 465,
  auth: { user: smtpUser, pass: required("SMTP_PASS") },
});
const from = process.env.SMTP_FROM || smtpUser;
const pendingNotifications = await firestore
  .collection("leaveNotifications")
  .orderBy("createdAt", "asc")
  .limit(100)
  .get();

for (const notificationDocument of pendingNotifications.docs) {
  const notification = notificationDocument.data();
  if (
    !["submitted", "approved", "rejected"].includes(notification.event) ||
    typeof notification.employeeId !== "string" ||
    typeof notification.employeeEmail !== "string" ||
    typeof notification.employeeName !== "string" ||
    typeof notification.type !== "string" ||
    typeof notification.startDate !== "string" ||
    typeof notification.endDate !== "string" ||
    typeof notification.reason !== "string"
  ) {
    throw new Error(`Invalid leave notification document: ${notificationDocument.id}`);
  }

  const profile = await firestore.collection("users").doc(notification.employeeId).get();
  const officialEmail =
    typeof profile.data()?.officialEmail === "string"
      ? profile.data().officialEmail.trim()
      : "";
  const employeeEmail = officialEmail || notification.employeeEmail;
  const recipients = [...new Set([employeeEmail, ADMIN_EMAIL])];
  const result = await transporter.sendMail({
    from,
    to: recipients,
    ...renderNotification(notification),
  });
  const accepted = new Set(result.accepted.map((address) => String(address).toLowerCase()));
  const notAccepted = recipients.filter((address) => !accepted.has(address.toLowerCase()));
  if (notAccepted.length) {
    throw new Error(
      `SMTP did not accept leave notification ${notificationDocument.id} for: ${notAccepted.join(", ")}`,
    );
  }

  await notificationDocument.ref.delete();
  console.info(
    `Sent ${notification.event} leave notification ${notificationDocument.id}.`,
  );
}

transporter.close();
