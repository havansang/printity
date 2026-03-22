const { env } = require('../config/env');
const ApiError = require('./ApiError');

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function isTurnstileConfigured() {
  return Boolean(env.TURNSTILE_SECRET_KEY);
}

function getRequestIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || '';
}

async function verifyTurnstileToken({ token, remoteIp, expectedAction }) {
  if (!isTurnstileConfigured()) {
    return null;
  }

  if (!token) {
    throw new ApiError(400, 'Verification challenge is required', [
      {
        field: 'turnstileToken',
        message: 'Please complete the verification challenge.',
      },
    ]);
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });

  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body,
  });

  if (!response.ok) {
    throw new ApiError(502, 'Verification service is unavailable');
  }

  const payload = await response.json();

  if (!payload.success) {
    throw new ApiError(400, 'Verification failed', [
      {
        field: 'turnstileToken',
        message: 'Please complete the verification challenge again.',
      },
    ]);
  }

  if (expectedAction && payload.action && payload.action !== expectedAction) {
    throw new ApiError(400, 'Verification failed', [
      {
        field: 'turnstileToken',
        message: 'Verification action mismatch.',
      },
    ]);
  }

  return payload;
}

module.exports = {
  getRequestIp,
  isTurnstileConfigured,
  verifyTurnstileToken,
};
