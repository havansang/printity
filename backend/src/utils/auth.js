const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { env } = require('../config/env');
const { BCRYPT_SALT_ROUNDS } = require('../constants/auth');
const ApiError = require('./ApiError');

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function signAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id || user._id?.toString(),
      email: user.email,
      authProviders: user.authProviders,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired token');
  }
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

module.exports = {
  hashPassword,
  comparePassword,
  signAccessToken,
  verifyAccessToken,
  extractBearerToken,
};
