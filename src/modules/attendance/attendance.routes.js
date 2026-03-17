import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import studentAuth from "../../middlewares/studentAuth.middleware.js";
import {
  studentCheckIn,
  studentCheckOut,
  adminMarkAttendance,
  getAttendanceHistory,
  getMonthlyAttendancePercentage,
  getTodayAttendanceSummary
} from "./attendance.controller.js";

const router = express.Router();

router.post("/check-in", studentAuth, studentCheckIn);
router.post("/check-out", studentAuth, studentCheckOut);
router.post("/admin-mark", adminAuth, adminMarkAttendance);
router.get("/history", studentAuth, getAttendanceHistory);
router.get("/admin-history", adminAuth, getAttendanceHistory);
router.get("/monthly-percentage", studentAuth, getMonthlyAttendancePercentage);
router.get("/today-summary", adminAuth, getTodayAttendanceSummary);

export default router;