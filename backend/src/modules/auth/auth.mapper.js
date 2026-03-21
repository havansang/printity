function mapAuthUser(user) {
  return {
    id: user._id?.toString() || user.id,
    email: user.email,
    displayName: user.displayName || null,
    avatarUrl: user.avatarUrl || null,
    authProviders: user.authProviders || [],
  };
}

module.exports = { mapAuthUser };
