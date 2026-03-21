const nodemailer = require('nodemailer');

const { env } = require('../config/env');

let transporter = null;

function isMailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}

function getTransporter() {
  if (!isMailConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }

  return transporter;
}

async function sendPasswordResetOtpEmail({ email, otp, expiresInMinutes }) {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    if (env.NODE_ENV !== 'production') {
      console.warn('SMTP is not configured. Password reset OTP email was not sent.');
    }

    return false;
  }

  const fromAddress = env.SMTP_FROM || env.SMTP_USER;

  await activeTransporter.sendMail({
    from: fromAddress,
    to: email,
    subject: 'Your Printity password reset code',
    text: `Your Printity verification code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">Reset your Printity password</h2>
        <p style="margin: 0 0 12px;">Use the verification code below to continue resetting your password.</p>
        <div style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #f3f4f6; font-size: 28px; font-weight: 700; letter-spacing: 0.3em;">
          ${otp}
        </div>
        <p style="margin: 16px 0 0;">This code expires in ${expiresInMinutes} minutes and can only be used once.</p>
        <p style="margin: 12px 0 0; color: #6b7280;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return true;
}

module.exports = {
  isMailConfigured,
  sendPasswordResetOtpEmail,
};
