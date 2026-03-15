const { asyncHandler } = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const authService = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await authService.registerLocalUser(req.body);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Registration successful',
    data: result,
  });
});

const login = asyncHandler(async (req, res) => {
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
  getMe,
  logout,
};
