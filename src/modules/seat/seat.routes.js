import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import { createSeat, cancelSeatBooking, getMySeat, getSeatStatus, bookSeat, getSeatDashboardSummary, allotSeatToStudent } from "./seat.controller.js";
import studentAuth from "../../middlewares/studentAuth.middleware.js";


const router = express.Router();

router.post("/create", adminAuth, createSeat);
router.post("/allot", adminAuth, allotSeatToStudent);
router.get("/status", adminAuth, getSeatStatus);
router.post("/book", studentAuth, bookSeat);
router.delete("/cancel", studentAuth, cancelSeatBooking);
router.get("/my-seat", studentAuth, getMySeat);
router.get("/dashboard-summary", adminAuth, getSeatDashboardSummary);

export default router;  