import jwt from "jsonwebtoken";
import Admin from "../modules/admin/admin.model.js";
import Library from "../modules/commonmodel/Library.model.js";
import Branch from "../modules/commonmodel/Branch.model.js";

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // 1️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2️⃣ Find admin
    const admin = await Admin.findById(decoded.userId);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 3️⃣ Find library
    const library = await Library.findById(decoded.libraryId);
    if (!library || !library.isActive) {
      return res.status(403).json({
        message: "Library account is inactive"
      });
    }

    // 4️⃣ Check subscription expiry
    if (
      library.subscriptionExpiresAt &&
      new Date(library.subscriptionExpiresAt) < new Date()
    ) {
      return res.status(403).json({
        message: "Subscription expired. Please renew."
      });
    }

    // 5️⃣ Attach SaaS-safe user object
    let activeBranch = null;
    if (admin.role === "branchAdmin") {
      activeBranch = await Branch.findOne({
        _id: admin.branchId,
        libraryId: library._id,
        isActive: true
      });
      if (!activeBranch) {
        return res.status(403).json({ message: "Branch account is inactive or invalid" });
      }
    }

    req.user = {
      userId: admin._id,
      libraryId: activeBranch?._id || library._id,
      parentLibraryId: library._id,
      branchId: activeBranch?._id || null,
      role: admin.role
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default adminAuth;
