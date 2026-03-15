const { z } = require('../../utils/validation');

const registerSchema = z
  .object({
    email: z.string().trim().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    displayName: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

const googleLoginSchema = z
  .object({
    idToken: z.string().trim().min(1, 'idToken is required'),
  })
  .strict();

module.exports = {
  registerSchema,
  loginSchema,
  googleLoginSchema,
};
