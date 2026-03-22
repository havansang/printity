const { z } = require('../../utils/validation');

const registerSchema = z
  .object({
    email: z.string().trim().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    displayName: z.string().trim().min(1).max(100).optional(),
    turnstileToken: z.string().trim().min(1, 'turnstileToken is required'),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
    turnstileToken: z.string().trim().min(1, 'turnstileToken is required'),
  })
  .strict();

const googleLoginSchema = z
  .object({
    idToken: z.string().trim().min(1, 'idToken is required'),
  })
  .strict();

const forgotPasswordRequestSchema = z
  .object({
    email: z.string().trim().email('Invalid email'),
    turnstileToken: z.string().trim().min(1, 'turnstileToken is required'),
  })
  .strict();

const verifyPasswordResetOtpSchema = z
  .object({
    email: z.string().trim().email('Invalid email'),
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  })
  .strict();

const resetPasswordSchema = z
  .object({
    email: z.string().trim().email('Invalid email'),
    resetToken: z.string().trim().min(1, 'resetToken is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

module.exports = {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  forgotPasswordRequestSchema,
  verifyPasswordResetOtpSchema,
  resetPasswordSchema,
};
