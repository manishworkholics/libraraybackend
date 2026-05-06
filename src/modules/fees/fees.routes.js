import express from "express";
import adminAuth from "../../middlewares/adminAuth.middleware.js";
import { addFees, getStudentFees, getFees, deleteFees,getRevenueStats,getRenewalList, renewFees} from "./fees.controller.js";

const router = express.Router();

router.post("/add", adminAuth, addFees);
router.get("/stats", adminAuth, getRevenueStats);
router.get("/renewal-list", adminAuth, getRenewalList);
router.put("/renew/:id", adminAuth, renewFees);
router.get("/:studentId", adminAuth, getStudentFees);
router.get("/",adminAuth, getFees);
router.delete("/delete/:id", adminAuth, deleteFees);
export default router;
