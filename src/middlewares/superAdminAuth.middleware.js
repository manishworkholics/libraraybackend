import jwt from "jsonwebtoken";
import SuperAdmin from "../modules/superadmin/superAdmin.model.js";

const superAdminAuth = async (req, res, next) => {
  try {
    // 1️⃣ Get token from header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "No token provided"
      });
    }

    // 2️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Check role
    if (decoded.role !== "superAdmin") {
      return res.status(403).json({
        message: "Super Admin access required"
      });
    }

    // 4️⃣ Check super admin exists
    const superAdmin = await SuperAdmin.findById(decoded.userId);

    if (!superAdmin) {
      return res.status(401).json({
        message: "Super Admin not found"
      });
    }

    // 5️⃣ Attach user
    req.user = {
      userId: superAdmin._id,
      role: "superAdmin"
    };

    next();

  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
};

export default superAdminAuth;