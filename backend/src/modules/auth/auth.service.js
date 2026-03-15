const { verifyGoogleIdToken } = require('../../config/google');
const ApiError = require('../../utils/ApiError');
const { comparePassword, hashPassword, signAccessToken } = require('../../utils/auth');
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
    token: signAccessToken(mappedUser),
  };
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
  getCurrentUser,
};
