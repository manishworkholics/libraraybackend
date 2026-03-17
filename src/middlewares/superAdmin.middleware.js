const superAdminOnly = (req, res, next) => {
  if (req.user.role !== "superAdmin") {
    return res.status(403).json({
      message: "Super Admin access required"
    });
  }
  next();
};

export default superAdminOnly;