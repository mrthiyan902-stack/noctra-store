module.exports.isAdmin = (req, res, next) => {
  if (req.session.admin) return next();
  req.flash('error', 'Please login to access admin panel');
  res.redirect('/admin/login');
};
