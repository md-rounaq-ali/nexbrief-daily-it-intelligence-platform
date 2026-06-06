const adminOnly = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
};

module.exports = { adminOnly };
