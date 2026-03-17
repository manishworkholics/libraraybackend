import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import studentAuth from "../../middlewares/studentAuth.middleware.js";
import {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  updateComplaintStatus
} from "./complaint.controller.js";

import { getStudentProfile } from "../student/student.controller.js";

const router = express.Router();

// Student
router.post("/create", studentAuth, createComplaint);
router.get("/my", studentAuth, getMyComplaints);
router.get("/my/profile", studentAuth, getStudentProfile);

// Admin
router.get("/admin", adminAuth, getAllComplaints);
router.put("/admin/:complaintId", adminAuth, updateComplaintStatus);


export default router;