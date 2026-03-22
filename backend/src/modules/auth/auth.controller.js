const { asyncHandler } = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const { TURNSTILE_ACTIONS } = require('../../constants/turnstile');
const { getRequestIp, verifyTurnstileToken } = require('../../utils/turnstile');
const authService = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  await verifyTurnstileToken({
    token: req.body.turnstileToken,
    remoteIp: getRequestIp(req),
    expectedAction: TURNSTILE_ACTIONS.register,
  });
  const result = await authService.registerLocalUser(req.body);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Registration successful',
    data: result,
  });
});

const login = asyncHandler(async (req, res) => {
  await verifyTurnstileToken({
    token: req.body.turnstileToken,
    remoteIp: getRequestIp(req),
    expectedAction: TURNSTILE_ACTIONS.login,
  });
  const result = await authService.loginLocalUser(req.body);
  sendSuccess(res, {
    message: 'Login successful',
    data: result,
  });
});

const googleLogin = asyncHandler(async (req, res) => {
  const result = await authService.loginWithGoogle(req.body);
  sendSuccess(res, {
    message: 'Google login successful',
    data: result,
  });
});

const requestPasswordResetOtp = asyncHandler(async (req, res) => {
  await verifyTurnstileToken({
    token: req.body.turnstileToken,
    remoteIp: getRequestIp(req),
    expectedAction: TURNSTILE_ACTIONS.forgotPassword,
  });
  const result = await authService.requestPasswordResetOtp(req.body);
  sendSuccess(res, {
    message: 'If this email exists, we’ve sent a verification code',
    data: result,
  });
});

const verifyPasswordResetOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyPasswordResetOtp(req.body);
  sendSuccess(res, {
    message: 'OTP verified successfully',
    data: result,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  sendSuccess(res, {
    message: 'Password updated successfully',
    data: result,
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.userId);
  sendSuccess(res, {
    message: 'Current user fetched successfully',
    data: { user },
  });
});

const logout = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    message: 'Logout successful',
    data: {},
  });
});

module.exports = {
  register,
  login,
  googleLogin,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
  getMe,
  logout,
};
