import jwt from "jsonwebtoken";
import Student from "../modules/student/student.model.js";
import Library from "../modules/commonmodel/Library.model.js";

const studentAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "No token provided"
      });
    }

    // 1️⃣ Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2️⃣ Ensure role is student
    if (decoded.role !== "student") {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    // 3️⃣ Find student
    const student = await Student.findById(decoded.userId);
    if (!student) {
      return res.status(401).json({
        message: "Student not found"
      });
    }

    // 4️⃣ Check library
    const library = await Library.findById(decoded.libraryId);
    if (!library || !library.isActive) {
      return res.status(403).json({
        message: "Library account inactive"
      });
    }

    // 5️⃣ Check subscription expiry
    if (
      library.subscriptionExpiresAt &&
      new Date(library.subscriptionExpiresAt) < new Date()
    ) {
      return res.status(403).json({
        message: "Library subscription expired"
      });
    }

    // 6️⃣ Attach user safely
    req.user = {
      userId: student._id,
      libraryId: student.libraryId,
      role: "student"
    };

    next();

  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
};

export default studentAuth;