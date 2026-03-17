import jwt from "jsonwebtoken";
import Admin from "../modules/admin/admin.model.js";
import Library from "../modules/commonmodel/Library.model.js";

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
    if (!admin) {
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
    req.user = {
      userId: admin._id,
      libraryId: library._id,
      role: admin.role
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default adminAuth;