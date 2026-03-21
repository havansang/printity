const router = require('express').Router();

const { requireAuth } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const authController = require('./auth.controller');
const {
  forgotPasswordRequestSchema,
  googleLoginSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyPasswordResetOtpSchema,
} = require('./auth.validation');

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/google', validate(googleLoginSchema), authController.googleLogin);
router.post('/forgot-password/request-otp', validate(forgotPasswordRequestSchema), authController.requestPasswordResetOtp);
router.post('/forgot-password/verify-otp', validate(verifyPasswordResetOtpSchema), authController.verifyPasswordResetOtp);
router.post('/forgot-password/reset', validate(resetPasswordSchema), authController.resetPassword);
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', authController.logout);

module.exports = router;
