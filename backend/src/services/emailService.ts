import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  family: 4,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendForgotOutEmail(options: {
  personName: string;
  personId: string;
  attendanceDate: string;
  attendanceTime: string;
  expectedEndTime: string;
}) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP configuration is missing. Email notification skipped.");
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.ADMIN_NOTIFICATION_EMAIL,
    subject: `Attendance Alert: OUT missing for ${options.personName}`,
    text:
      `Attendance Alert\n\n` +
      `Name: ${options.personName}\n` +
      `ID: ${options.personId}\n` +
      `Date: ${options.attendanceDate}\n` +
      `IN Time: ${options.attendanceTime}\n` +
      `Expected OUT by: ${options.expectedEndTime}\n\n` +
      `The person has not marked OUT within the expected attendance window.`,
  });
}
export async function sendTestEmail() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.ADMIN_NOTIFICATION_EMAIL
  ) {
    throw new Error("SMTP or admin email configuration is missing.");
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.ADMIN_NOTIFICATION_EMAIL,
    subject: "Attendance System - Test Email",
    text:
      "This is a test email from your QR Attendance System.\n\n" +
      "If you received this message, Gmail SMTP is configured correctly.",
  });
}
