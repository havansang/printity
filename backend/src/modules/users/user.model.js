const mongoose = require('mongoose');

const { AUTH_PROVIDERS } = require('../../constants/auth');

const googleSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    picture: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
      default: null,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: null,
    },
    authProviders: {
      type: [
        {
          type: String,
          enum: AUTH_PROVIDERS,
        },
      ],
      default: [],
    },
    passwordHash: {
      type: String,
      default: null,
    },
    google: {
      type: googleSchema,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ 'google.googleId': 1 }, { unique: true, sparse: true });

userSchema.pre('validate', function validateProviders(next) {
  if (this.authProviders.includes('local') && !this.passwordHash) {
    this.invalidate('passwordHash', 'passwordHash is required when local auth is enabled');
  }

  if (this.authProviders.includes('google') && !this.google?.googleId) {
    this.invalidate('google.googleId', 'googleId is required when google auth is enabled');
  }

  this.authProviders = [...new Set(this.authProviders)];
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
