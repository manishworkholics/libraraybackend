import Student from "./student.model.js";
import Library from "../commonmodel/Library.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// export const studentLogin = async (req, res) => {
//   try {
//     const { enrollmentNumber, password } = req.body;

//     // 1️⃣ Find student
//     const student = await Student.findOne({ enrollmentNumber });

//     if (!student) {
//       return res.status(404).json({
//         message: "Student not found"
//       });
//     }

//     // 2️⃣ Check library active
//     const library = await Library.findById(student.libraryId);

//     if (!library || !library.isActive) {
//       return res.status(403).json({
//         message: "Library account inactive"
//       });
//     }

//     // 3️⃣ Check subscription expiry
//     if (
//       library.subscriptionExpiresAt &&
//       new Date(library.subscriptionExpiresAt) < new Date()
//     ) {
//       return res.status(403).json({
//         message: "Library subscription expired"
//       });
//     }

//     // 4️⃣ Compare password
//     const isMatch = await bcrypt.compare(password, student.password);

//     if (!isMatch) {
//       return res.status(400).json({
//         message: "Invalid password"
//       });
//     }

//     // 5️⃣ Generate SaaS-safe token
//     const token = jwt.sign(
//       {
//         userId: student._id,
//         libraryId: student.libraryId,
//         role: "student"
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     // 6️⃣ Return safe response
//     res.json({
//       message: "Login successful",
//       token,
//       student: {
//         id: student._id,
//         name: student.name,
//         enrollmentNumber: student.enrollmentNumber,
//         email: student.email
//       }
//     });

//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };




export const studentLogin = async (req, res) => {
  try {
    const { enrollmentNumber, password } = req.body;

    // 1️⃣ Find student
    const student = await Student.findOne({ enrollmentNumber });

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    // 🆕 2️⃣ Check student active/inactive
    if (student.status !== "active") {
      return res.status(403).json({
        message: "Your account is inactive. Please contact admin."
      });
    }

    // 3️⃣ Check library active
    const library = await Library.findById(student.libraryId);

    if (!library || !library.isActive) {
      return res.status(403).json({
        message: "Library account inactive"
      });
    }

    // 4️⃣ Check subscription expiry
    if (
      library.subscriptionExpiresAt &&
      new Date(library.subscriptionExpiresAt) < new Date()
    ) {
      return res.status(403).json({
        message: "Library subscription expired"
      });
    }

    // 5️⃣ Compare password
    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password"
      });
    }

    // 6️⃣ Generate token
    const token = jwt.sign(
      {
        userId: student._id,
        libraryId: student.libraryId,
        role: "student"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 7️⃣ Response
    res.json({
      message: "Login successful",
      token,
      student: {
        id: student._id,
        name: student.name,
        enrollmentNumber: student.enrollmentNumber,
        email: student.email
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};