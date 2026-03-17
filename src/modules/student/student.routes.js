import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import studentAuth from "../../middlewares/studentAuth.middleware.js";
import {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  getStudentProfile
} from "./student.controller.js";
import { studentLogin } from "./studentAuth.controller.js"

const router = express.Router();

/* Create Student */
router.post("/", adminAuth, createStudent);

/* Get All Students */
router.get("/", adminAuth, getAllStudents);

/* Get Single Student */
router.get("/:id", adminAuth, getStudentById);

/* Update Student */
router.put("/:id", adminAuth, updateStudent);

/* Delete Student */
router.delete("/:id", adminAuth, deleteStudent);

router.get("/profile", studentAuth, getStudentProfile);

router.post("/login", studentLogin);

export default router;