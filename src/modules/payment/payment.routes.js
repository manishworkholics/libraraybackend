import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import studentAuth from "../../middlewares/studentAuth.middleware.js";
import {
  addPayment,
  getStudentPayments,
  getAllPayments
} from "./payment.controller.js";

const router = express.Router();

router.post("/add", adminAuth, addPayment);
router.get("/student", studentAuth, getStudentPayments);
router.get("/admin", adminAuth, getAllPayments);

export default router;