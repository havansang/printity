const { verifyGoogleIdToken } = require('../../config/google');
const { PASSWORD_RESET_OTP_LENGTH } = require('../../constants/password-reset');
const { env } = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const {
  comparePassword,
  generateNumericOtp,
  generateOpaqueToken,
  hashPassword,
  hashSecretValue,
  signAccessToken,
} = require('../../utils/auth');
const { sendPasswordResetOtpEmail } = require('../../utils/mailer');
const PasswordReset = require('./password-reset.model');
const User = require('../users/user.model');
const { mapAuthUser } = require('./auth.mapper');

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function addAuthProvider(user, provider) {
  if (!user.authProviders.includes(provider)) {
    user.authProviders.push(provider);
  }
}

function buildAuthResponse(user) {
  const mappedUser = mapAuthUser(user);

  return {
    user: mappedUser,
    token: signAccessToken(user),
  };
}

function getPasswordResetOtpTtlMs() {
  return env.PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000;
}

function getPasswordResetWindowMs() {
  return env.PASSWORD_RESET_OTP_WINDOW_MINUTES * 60 * 1000;
}

function getPasswordResetCooldownMs() {
  return env.PASSWORD_RESET_OTP_COOLDOWN_SECONDS * 1000;
}

function getPasswordResetTokenTtlMs() {
  return env.PASSWORD_RESET_RESET_TOKEN_TTL_MINUTES * 60 * 1000;
}

function buildPasswordResetRequestResponse() {
  return {
    resendAfterSeconds: env.PASSWORD_RESET_OTP_COOLDOWN_SECONDS,
    otpExpiresInSeconds: env.PASSWORD_RESET_OTP_TTL_MINUTES * 60,
  };
}

function pruneSendHistory(sendHistory = [], now) {
  const threshold = now.getTime() - getPasswordResetWindowMs();
  return sendHistory.filter((sentAt) => new Date(sentAt).getTime() >= threshold);
}

function getResetNamespace(email, suffix) {
  return `password-reset:${normalizeEmail(email)}:${suffix}`;
}

async function findLocalUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.authProviders.includes('local') || !user.passwordHash) {
    return null;
  }

  return user;
}

async function upsertPasswordResetRecord(email) {
  const normalizedEmail = normalizeEmail(email);
  let record = await PasswordReset.findOne({ email: normalizedEmail });

  if (!record) {
    record = new PasswordReset({ email: normalizedEmail });
  }

  return record;
}

async function requestPasswordResetOtp({ email }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await findLocalUserByEmail(normalizedEmail);

  if (!user) {
    return buildPasswordResetRequestResponse();
  }

  const now = new Date();
  const resetRecord = await upsertPasswordResetRecord(normalizedEmail);
  const recentSends = pruneSendHistory(resetRecord.sendHistory, now);
  const lastSentAt = resetRecord.lastSentAt ? new Date(resetRecord.lastSentAt) : null;

  if (lastSentAt && (now.getTime() - lastSentAt.getTime()) < getPasswordResetCooldownMs()) {
    resetRecord.sendHistory = recentSends;
    await resetRecord.save();
    return buildPasswordResetRequestResponse();
  }

  if (recentSends.length >= env.PASSWORD_RESET_OTP_MAX_SENDS_PER_WINDOW) {
    resetRecord.sendHistory = recentSends;
    await resetRecord.save();
    return buildPasswordResetRequestResponse();
  }

  const otp = generateNumericOtp(PASSWORD_RESET_OTP_LENGTH);

  resetRecord.otpHash = hashSecretValue(getResetNamespace(normalizedEmail, 'otp'), otp);
  resetRecord.expiresAt = new Date(now.getTime() + getPasswordResetOtpTtlMs());
  resetRecord.attempts = 0;
  resetRecord.lastSentAt = now;
  resetRecord.lockedAt = null;
  resetRecord.consumedAt = null;
  resetRecord.resetTokenHash = null;
  resetRecord.resetTokenExpiresAt = null;
  resetRecord.sendHistory = [...recentSends, now];

  await resetRecord.save();

  try {
    await sendPasswordResetOtpEmail({
      email: normalizedEmail,
      otp,
      expiresInMinutes: env.PASSWORD_RESET_OTP_TTL_MINUTES,
    });
  } catch (error) {
    if (env.NODE_ENV !== 'production') {
      console.error('Failed to send password reset OTP email', error);
    }
  }

  return buildPasswordResetRequestResponse();
}

async function verifyPasswordResetOtp({ email, otp }) {
  const normalizedEmail = normalizeEmail(email);
  const resetRecord = await PasswordReset.findOne({ email: normalizedEmail });

  if (!resetRecord?.otpHash || !resetRecord.expiresAt) {
    throw new ApiError(400, 'Invalid code');
  }

  const now = new Date();

  if (resetRecord.lockedAt || resetRecord.attempts >= env.PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, 'Too many invalid attempts. Please request a new code.');
  }

  if (new Date(resetRecord.expiresAt).getTime() < now.getTime()) {
    throw new ApiError(400, 'This code has expired. Please request a new one.');
  }

  const hashedOtp = hashSecretValue(getResetNamespace(normalizedEmail, 'otp'), otp);

  if (hashedOtp !== resetRecord.otpHash) {
    resetRecord.attempts += 1;

    if (resetRecord.attempts >= env.PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
      resetRecord.lockedAt = now;
      await resetRecord.save();
      throw new ApiError(429, 'Too many invalid attempts. Please request a new code.');
    }

    await resetRecord.save();
    throw new ApiError(400, 'Invalid code');
  }

  const resetToken = generateOpaqueToken();

  resetRecord.resetTokenHash = hashSecretValue(getResetNamespace(normalizedEmail, 'reset-token'), resetToken);
  resetRecord.resetTokenExpiresAt = new Date(now.getTime() + getPasswordResetTokenTtlMs());
  resetRecord.otpHash = null;
  resetRecord.expiresAt = null;
  resetRecord.attempts = 0;
  resetRecord.lockedAt = null;
  resetRecord.consumedAt = now;

  await resetRecord.save();

  return {
    resetToken,
    resetTokenExpiresInSeconds: env.PASSWORD_RESET_RESET_TOKEN_TTL_MINUTES * 60,
  };
}

async function resetPassword({ email, resetToken, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await findLocalUserByEmail(normalizedEmail);

  if (!user) {
    throw new ApiError(400, 'Unable to reset password for this account');
  }

  const resetRecord = await PasswordReset.findOne({ email: normalizedEmail });
  if (!resetRecord?.resetTokenHash || !resetRecord.resetTokenExpiresAt) {
    throw new ApiError(400, 'Reset session is invalid or has expired');
  }

  const now = new Date();
  if (new Date(resetRecord.resetTokenExpiresAt).getTime() < now.getTime()) {
    throw new ApiError(400, 'Reset session is invalid or has expired');
  }

  const hashedResetToken = hashSecretValue(getResetNamespace(normalizedEmail, 'reset-token'), resetToken);
  if (hashedResetToken !== resetRecord.resetTokenHash) {
    throw new ApiError(400, 'Reset session is invalid or has expired');
  }

  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = now;
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  user.lastLoginAt = null;
  addAuthProvider(user, 'local');

  await user.save();
  await PasswordReset.deleteOne({ _id: resetRecord._id });

  return {};
}

async function registerLocalUser({ email, password, displayName }) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser?.authProviders.includes('local')) {
    throw new ApiError(409, 'Email is already registered');
  }

  if (existingUser) {
    existingUser.passwordHash = await hashPassword(password);
    existingUser.displayName = displayName || existingUser.displayName || null;
    addAuthProvider(existingUser, 'local');
    existingUser.lastLoginAt = new Date();
    await existingUser.save();
    return buildAuthResponse(existingUser);
  }

  const user = await User.create({
    email: normalizedEmail,
    displayName: displayName || null,
    authProviders: ['local'],
    passwordHash: await hashPassword(password),
    lastLoginAt: new Date(),
  });

  return buildAuthResponse(user);
}

async function loginLocalUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.authProviders.includes('local') || !user.passwordHash) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return buildAuthResponse(user);
}

async function loginWithGoogle({ idToken }) {
  const googleProfile = await verifyGoogleIdToken(idToken);

  if (!googleProfile.email) {
    throw new ApiError(401, 'Google account email is required');
  }

  let user = await User.findOne({ 'google.googleId': googleProfile.googleId });

  if (!user) {
    user = await User.findOne({ email: googleProfile.email });

    if (user) {
      if (!googleProfile.emailVerified) {
        throw new ApiError(409, 'Google email must be verified before linking the account');
      }

      if (user.authProviders.includes('google') && user.google?.googleId && user.google.googleId !== googleProfile.googleId) {
        throw new ApiError(409, 'This email is already linked to another Google account');
      }

      addAuthProvider(user, 'google');
    } else {
      user = new User({
        email: googleProfile.email,
        authProviders: ['google'],
      });
    }
  }

  user.google = {
    googleId: googleProfile.googleId,
    email: googleProfile.email,
    emailVerified: googleProfile.emailVerified,
    picture: googleProfile.avatarUrl,
  };
  user.displayName = googleProfile.displayName || user.displayName || null;
  user.avatarUrl = googleProfile.avatarUrl || user.avatarUrl || null;
  user.lastLoginAt = new Date();

  await user.save();

  return buildAuthResponse(user);
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId).select('_id email displayName avatarUrl authProviders');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return mapAuthUser(user);
}

module.exports = {
  registerLocalUser,
  loginLocalUser,
  loginWithGoogle,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
  getCurrentUser,
};
