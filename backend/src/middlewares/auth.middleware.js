const User = require('../modules/users/user.model');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/asyncHandler');
const { extractBearerToken, verifyAccessToken } = require('../utils/auth');

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    throw new ApiError(401, 'Authentication required');
  }

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.userId).select('_id email displayName avatarUrl authProviders');

  if (!user) {
    throw new ApiError(401, 'Authentication required');
  }

  req.user = {
    userId: user._id.toString(),
    email: user.email,
    displayName: user.displayName || null,
    avatarUrl: user.avatarUrl || null,
    authProviders: user.authProviders,
  };

  req.authToken = token;
  next();
});

module.exports = { requireAuth };
