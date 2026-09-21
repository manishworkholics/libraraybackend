import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import spreadsheetUpload from "../../middlewares/spreadsheetUpload.middleware.js";
import studentAuth from "../../middlewares/studentAuth.middleware.js";
import {
  createStudent,
  importStudents,
  downloadStudentImportTemplate,
  exportStudents,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  getStudentProfile,
  getAvailableSeats,
  bookSeat,
  checkoutSeat
} from "./student.controller.js";
import { studentLogin } from "./studentAuth.controller.js"

const router = express.Router();

// 🔥 FIRST — student auth routes
router.get("/profile", studentAuth, getStudentProfile);
router.get("/seats", studentAuth, getAvailableSeats);
router.post("/book-seat", studentAuth, bookSeat);
router.post("/checkout-seat", studentAuth, checkoutSeat);

// 🔥 THEN login
router.post("/login", studentLogin);


// 🔥 ADMIN ROUTES
router.get("/import-template", adminAuth, downloadStudentImportTemplate);
router.get("/export", adminAuth, exportStudents);
router.post("/import", adminAuth, spreadsheetUpload.single("file"), importStudents);
router.post("/", adminAuth, createStudent);
router.get("/", adminAuth, getAllStudents);

// ❗ LAST — dynamic route
router.get("/:id", adminAuth, getStudentById);
router.put("/:id", adminAuth, updateStudent);
router.delete("/:id", adminAuth, deleteStudent);

export default router;
