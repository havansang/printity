const { OAuth2Client } = require('google-auth-library');

const { env } = require('./env');
const ApiError = require('../utils/ApiError');

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

async function verifyGoogleIdToken(idToken) {
  if (!googleClient || !env.GOOGLE_CLIENT_ID) {
    throw new ApiError(500, 'Google login is not configured');
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email) {
      throw new ApiError(401, 'Invalid Google token');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: Boolean(payload.email_verified),
      displayName: payload.name || null,
      avatarUrl: payload.picture || null,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, 'Invalid Google token');
  }
}

module.exports = { verifyGoogleIdToken };
