import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import { addFees, getStudentFees,createFees, getFees, deleteFees,getRevenueStats} from "./fees.controller.js";

const router = express.Router();

router.post("/add", adminAuth, addFees);
router.get("/:studentId", adminAuth, getStudentFees);
router.post("/create",adminAuth, createFees);
router.get("/",adminAuth, getFees);
router.delete("delete/:studentId", deleteFees);
router.get("/stats", getRevenueStats);
export default router;
